-- #229 / 1A. Repasse independente de produção e financeiro. Sem ativação automática.
CREATE SCHEMA IF NOT EXISTS handoff_private;
REVOKE ALL ON SCHEMA handoff_private FROM PUBLIC, anon;
ALTER TABLE public.orders ADD CONSTRAINT orders_handoff_scope UNIQUE(id,branch_id);
ALTER TABLE public.order_items ADD CONSTRAINT items_handoff_scope UNIQUE(id,order_id);
ALTER TABLE public.printer_jobs ADD CONSTRAINT jobs_handoff_scope UNIQUE(id,order_id,branch_id);
ALTER TABLE public.order_items ADD COLUMN handoff_revision bigint NOT NULL DEFAULT 1 CHECK(handoff_revision>0);
CREATE TABLE public.production_handoff_config(
 branch_id uuid REFERENCES public.branches(id), sector text CHECK(sector IN('KITCHEN','JUICE_POTATO')),
 mode text NOT NULL CHECK(mode IN('MANUAL','PRINTER')), enabled boolean NOT NULL DEFAULT false,
 version bigint NOT NULL DEFAULT 1 CHECK(version>0), updated_by uuid NOT NULL REFERENCES public.profiles(id),
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(branch_id,sector)
);
CREATE TABLE public.production_handoff_commands(
 branch_id uuid NOT NULL, command_id uuid NOT NULL, order_id uuid NOT NULL,
 actor_id uuid NOT NULL REFERENCES public.profiles(id), request jsonb NOT NULL, result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(branch_id,command_id),
 FOREIGN KEY(order_id,branch_id) REFERENCES public.orders(id,branch_id)
);
CREATE TABLE public.production_handoff_units(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), branch_id uuid NOT NULL, order_id uuid NOT NULL,
 order_item_id uuid NOT NULL, unit_no integer NOT NULL CHECK(unit_no>0), revision bigint NOT NULL CHECK(revision>0),
 batch_no smallint NOT NULL CHECK(batch_no>0), sector text NOT NULL CHECK(sector IN('KITCHEN','JUICE_POTATO')),
 version bigint NOT NULL DEFAULT 1 CHECK(version>0), state text NOT NULL CHECK(state IN('UNKNOWN','PENDING','CONFIRMED','SUPERSEDED')),
 confirmed_by uuid REFERENCES public.profiles(id), confirmed_at timestamptz,
 UNIQUE(order_item_id,revision,unit_no), UNIQUE(id,order_id,branch_id),
 CHECK((state='CONFIRMED' AND confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL) OR state<>'CONFIRMED'),
 FOREIGN KEY(order_item_id,order_id) REFERENCES public.order_items(id,order_id),
 FOREIGN KEY(order_id,branch_id) REFERENCES public.orders(id,branch_id)
);
CREATE INDEX handoff_units_order ON public.production_handoff_units(branch_id,order_id);
CREATE TABLE public.production_handoff_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), branch_id uuid NOT NULL, order_id uuid NOT NULL, unit_id uuid NOT NULL,
 command_id uuid, origin text NOT NULL CHECK(origin IN('MANUAL','MANUAL_RECOVERY','REVOKE','PRINT')),
 actor_id uuid REFERENCES public.profiles(id), actor_name text, printer_job_id uuid,
 reverses_event_id uuid REFERENCES public.production_handoff_events(id), reason text, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(unit_id,order_id,branch_id) REFERENCES public.production_handoff_units(id,order_id,branch_id),
 FOREIGN KEY(branch_id,command_id) REFERENCES public.production_handoff_commands(branch_id,command_id),
 FOREIGN KEY(printer_job_id,order_id,branch_id) REFERENCES public.printer_jobs(id,order_id,branch_id),
 CHECK((origin='PRINT' AND printer_job_id IS NOT NULL AND actor_id IS NULL AND command_id IS NULL)
   OR (origin<>'PRINT' AND actor_id IS NOT NULL AND command_id IS NOT NULL)),
 CHECK(origin NOT IN('REVOKE','MANUAL_RECOVERY') OR coalesce(length(btrim(reason)),0)>0)
);
CREATE UNIQUE INDEX handoff_print_once ON public.production_handoff_events(unit_id,printer_job_id) WHERE origin='PRINT';
CREATE INDEX handoff_events_unit ON public.production_handoff_events(unit_id,created_at);
CREATE TABLE public.production_print_coverage(
 printer_job_id uuid NOT NULL, unit_id uuid NOT NULL, order_id uuid NOT NULL, branch_id uuid NOT NULL,
 PRIMARY KEY(printer_job_id,unit_id),
 FOREIGN KEY(printer_job_id,order_id,branch_id) REFERENCES public.printer_jobs(id,order_id,branch_id),
 FOREIGN KEY(unit_id,order_id,branch_id) REFERENCES public.production_handoff_units(id,order_id,branch_id)
);
CREATE INDEX handoff_coverage_unit ON public.production_print_coverage(unit_id);

-- Revisões não afetam preço, pagamentos, status ou condições de impressão.
CREATE FUNCTION handoff_private.revise_item() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF ROW(NEW.quantity,NEW.production_sector,NEW.observation,NEW.product_id,NEW.product_name_snapshot,NEW.is_takeout)
 IS DISTINCT FROM ROW(OLD.quantity,OLD.production_sector,OLD.observation,OLD.product_id,OLD.product_name_snapshot,OLD.is_takeout)
 OR (pg_trigger_depth()>1 AND NEW.handoff_revision<>OLD.handoff_revision) THEN
   NEW.handoff_revision:=OLD.handoff_revision+1;
 ELSE NEW.handoff_revision:=OLD.handoff_revision;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER handoff_item_revision BEFORE UPDATE ON public.order_items FOR EACH ROW EXECUTE FUNCTION handoff_private.revise_item();
CREATE FUNCTION handoff_private.materialize_item() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b uuid;
BEGIN
 IF TG_OP='UPDATE' AND NEW.handoff_revision=OLD.handoff_revision THEN RETURN NEW; END IF;
 SELECT branch_id INTO b FROM public.orders WHERE id=NEW.order_id;
 UPDATE public.production_handoff_units SET state='SUPERSEDED',version=version+1
 WHERE order_item_id=NEW.id AND revision<>NEW.handoff_revision AND state<>'SUPERSEDED';
 IF NEW.production_sector::text IN('KITCHEN','JUICE_POTATO') THEN
 INSERT INTO public.production_handoff_units(branch_id,order_id,order_item_id,unit_no,revision,batch_no,sector,state)
 SELECT b,NEW.order_id,NEW.id,n,NEW.handoff_revision,NEW.addition_batch_no,NEW.production_sector::text,'PENDING'
 FROM generate_series(1,NEW.quantity) n ON CONFLICT(order_item_id,revision,unit_no) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER handoff_item_units AFTER INSERT OR UPDATE ON public.order_items
 FOR EACH ROW EXECUTE FUNCTION handoff_private.materialize_item();
CREATE FUNCTION handoff_private.revise_child() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND to_jsonb(NEW)=to_jsonb(OLD) THEN RETURN NULL; END IF;
 IF TG_OP<>'INSERT' THEN UPDATE public.order_items SET handoff_revision=handoff_revision+1 WHERE id=OLD.order_item_id; END IF;
 IF TG_OP='INSERT' OR (TG_OP='UPDATE' AND NEW.order_item_id<>OLD.order_item_id) THEN
 UPDATE public.order_items SET handoff_revision=handoff_revision+1 WHERE id=NEW.order_item_id;
 END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER handoff_addon_revision AFTER INSERT OR UPDATE OR DELETE ON public.order_item_addons FOR EACH ROW EXECUTE FUNCTION handoff_private.revise_child();
CREATE TRIGGER handoff_removed_revision AFTER INSERT OR UPDATE OR DELETE ON public.order_item_removed_ingredients FOR EACH ROW EXECUTE FUNCTION handoff_private.revise_child();
INSERT INTO public.production_handoff_units(branch_id,order_id,order_item_id,unit_no,revision,batch_no,sector,state)
 SELECT o.branch_id,i.order_id,i.id,n,i.handoff_revision,i.addition_batch_no,i.production_sector::text,'UNKNOWN'
 FROM public.order_items i JOIN public.orders o ON o.id=i.order_id CROSS JOIN LATERAL generate_series(1,i.quantity) n
 WHERE i.production_sector::text IN('KITCHEN','JUICE_POTATO');

-- Metadados vêm do MESMO snapshot usado no texto. Nunca inferir cobertura pelo pedido.
-- Mismatch deixa o job imprimível mas sem cobertura (não confirma repasse).
CREATE FUNCTION handoff_private.cover_job() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE entry jsonb; i public.order_items; entries jsonb:=NEW.content->'handoff_items';
BEGIN
 IF NEW.sector NOT IN('KITCHEN','JUICE_POTATO') OR jsonb_typeof(entries) IS DISTINCT FROM 'array' OR jsonb_array_length(entries)=0 THEN RETURN NEW; END IF;
 -- Subtransação: qualquer snapshot inválido descarta TODA a cobertura, preservando job/texto.
 BEGIN
 FOR entry IN SELECT value FROM jsonb_array_elements(entries) LOOP
 SELECT * INTO i FROM public.order_items WHERE id=(entry->>'id')::uuid AND order_id=NEW.order_id FOR SHARE;
 IF NOT FOUND OR i.handoff_revision<>(entry->>'revision')::bigint OR i.production_sector::text<>NEW.sector
   OR i.status='CANCELLED' OR (entry->>'revision') IS NULL THEN RAISE EXCEPTION 'snapshot obsoleto'; END IF;
 INSERT INTO public.production_print_coverage(printer_job_id,unit_id,order_id,branch_id)
 SELECT NEW.id,u.id,NEW.order_id,NEW.branch_id FROM public.production_handoff_units u
 WHERE u.order_item_id=i.id AND u.revision=i.handoff_revision AND u.state<>'SUPERSEDED'
 ON CONFLICT DO NOTHING;
 END LOOP;
 EXCEPTION WHEN invalid_text_representation OR raise_exception OR foreign_key_violation THEN
 -- Rollback da subtransação remove cobertura parcial. O operador verá desconhecido.
 NULL;
 END;
 RETURN NEW;
END $$;
CREATE TRIGGER handoff_job_coverage AFTER INSERT ON public.printer_jobs FOR EACH ROW EXECUTE FUNCTION handoff_private.cover_job();
-- Uma cobertura não pode ser reutilizada para outro texto/setor/pedido.
CREATE FUNCTION handoff_private.freeze_covered_job() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF ROW(NEW.content,NEW.sector,NEW.order_id,NEW.branch_id) IS DISTINCT FROM ROW(OLD.content,OLD.sector,OLD.order_id,OLD.branch_id)
 AND EXISTS(SELECT 1 FROM public.production_print_coverage WHERE printer_job_id=OLD.id) THEN
 RAISE EXCEPTION 'Comanda com cobertura é imutável. Crie novo job para reimpressão.';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER handoff_job_content_immutable BEFORE UPDATE OF content,sector,order_id,branch_id ON public.printer_jobs FOR EACH ROW EXECUTE FUNCTION handoff_private.freeze_covered_job();
CREATE FUNCTION handoff_private.print_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status='PRINTED' AND current_setting('role') IN ('none','service_role') AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'PRINTED') THEN
 INSERT INTO public.production_handoff_events(branch_id,order_id,unit_id,origin,printer_job_id)
 SELECT c.branch_id,c.order_id,c.unit_id,'PRINT',NEW.id FROM public.production_print_coverage c WHERE c.printer_job_id=NEW.id
 ON CONFLICT(unit_id,printer_job_id) WHERE origin='PRINT' DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER handoff_job_printed AFTER INSERT OR UPDATE OF status ON public.printer_jobs FOR EACH ROW EXECUTE FUNCTION handoff_private.print_event();

CREATE FUNCTION handoff_private.assert_operator(p_branch uuid,p_manage boolean DEFAULT false) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_access_branch(p_branch) OR NOT EXISTS(
 SELECT 1 FROM public.profiles WHERE id=auth.uid() AND active AND role IN('ADMIN','ATTENDANT'))
 OR (p_manage AND NOT public.can_manage_branch(p_branch)) THEN RAISE EXCEPTION 'Sem permissão para esta filial.' USING ERRCODE='42501'; END IF;
END $$;
CREATE FUNCTION handoff_private.configure(p_branch uuid,p_sector text,p_mode text,p_enabled boolean,p_version bigint)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cfg public.production_handoff_config; result jsonb;
BEGIN
 PERFORM handoff_private.assert_operator(p_branch,true);
 IF p_sector IS NULL OR p_sector NOT IN('KITCHEN','JUICE_POTATO') OR p_mode IS NULL OR p_mode NOT IN('MANUAL','PRINTER') OR p_enabled IS NULL
 THEN RAISE EXCEPTION 'Configuração inválida.'; END IF;
 PERFORM 1 FROM public.branches WHERE id=p_branch FOR UPDATE;
 SELECT * INTO cfg FROM public.production_handoff_config WHERE branch_id=p_branch AND sector=p_sector FOR UPDATE;
 IF (FOUND AND cfg.version IS DISTINCT FROM p_version) OR (NOT FOUND AND p_version IS NOT NULL)
 THEN RAISE EXCEPTION 'Configuração alterada por outro operador. Atualize.' USING ERRCODE='40001'; END IF;
 INSERT INTO public.production_handoff_config(branch_id,sector,mode,enabled,updated_by) VALUES(p_branch,p_sector,p_mode,p_enabled,auth.uid())
 ON CONFLICT(branch_id,sector) DO UPDATE SET mode=excluded.mode,enabled=excluded.enabled,updated_by=auth.uid(),updated_at=now(),version=production_handoff_config.version+1
 RETURNING to_jsonb(production_handoff_config.*) INTO result;
 INSERT INTO public.audit_logs(action,table_name,record_id,user_id,branch_id,old_data,new_data)
 VALUES('HANDOFF_CONFIG','production_handoff_config',p_branch,auth.uid(),p_branch,to_jsonb(cfg),result);
 RETURN result;
END $$;
CREATE FUNCTION public.configure_production_handoff(p_branch uuid,p_sector text,p_mode text,p_enabled boolean,p_version bigint DEFAULT NULL)
 RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT handoff_private.configure(p_branch,p_sector,p_mode,p_enabled,p_version) $$;

CREATE FUNCTION handoff_private.confirm(p_command uuid,p_order uuid,p_targets jsonb,p_action text,p_reason text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.orders; u public.production_handoff_units; t jsonb; cfg public.production_handoff_config;
 req jsonb; saved public.production_handoff_commands; result jsonb; done int:=0; actor_name text; previous_event uuid; related_job uuid;
BEGIN
 SELECT * INTO o FROM public.orders WHERE id=p_order;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pedido indisponível.' USING ERRCODE='42501'; END IF;
 PERFORM handoff_private.assert_operator(o.branch_id,p_action='REVOKE');
 IF p_command IS NULL OR p_action IS NULL OR p_action NOT IN('MANUAL','MANUAL_RECOVERY','REVOKE') OR jsonb_typeof(p_targets) IS DISTINCT FROM 'array'
 THEN RAISE EXCEPTION 'Comando inválido.'; END IF;
 IF jsonb_array_length(p_targets) NOT BETWEEN 1 AND 200 OR (p_action IN('REVOKE','MANUAL_RECOVERY') AND coalesce(length(btrim(p_reason)),0)=0)
 OR length(coalesce(p_reason,''))>500 THEN RAISE EXCEPTION 'Seleção ou motivo inválido.'; END IF;
 SELECT jsonb_build_object('targets',jsonb_agg(value ORDER BY value->>'id'),'action',p_action,'reason',p_reason,'actor',auth.uid(),'order',p_order)
 INTO req FROM jsonb_array_elements(p_targets);
 -- Serializa a chave inclusive quando dois pedidos diferentes usam a mesma chave.
 PERFORM pg_advisory_xact_lock(hashtextextended(o.branch_id::text||p_command::text,0));
 SELECT * INTO saved FROM public.production_handoff_commands WHERE branch_id=o.branch_id AND command_id=p_command;
 IF FOUND THEN
 IF saved.request<>req THEN RAISE EXCEPTION 'Chave reutilizada com outro comando.'; END IF;
 RETURN saved.result;
 END IF;
 SELECT * INTO o FROM public.orders WHERE id=p_order FOR UPDATE;
 IF o.status IN('CANCELADO','EXPIRADO','ENTREGUE','AGUARDANDO_CONFIRMACAO','AGUARDANDO_PAGAMENTO') THEN RAISE EXCEPTION 'Pedido não aceita repasse neste estado.'; END IF;
 IF (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(p_targets))<>jsonb_array_length(p_targets) THEN RAISE EXCEPTION 'Unidade repetida.'; END IF;
 SELECT name INTO actor_name FROM public.profiles WHERE id=auth.uid();
 INSERT INTO public.production_handoff_commands(branch_id,command_id,order_id,actor_id,request,result)
 VALUES(o.branch_id,p_command,o.id,auth.uid(),req,'{}');
 PERFORM 1 FROM public.order_items WHERE id IN(SELECT x.order_item_id FROM public.production_handoff_units x JOIN jsonb_array_elements(p_targets) v ON x.id=(v->>'id')::uuid) ORDER BY id FOR SHARE;
 FOR t IN SELECT value FROM jsonb_array_elements(p_targets) ORDER BY value->>'id' LOOP
 SELECT * INTO u FROM public.production_handoff_units WHERE id=(t->>'id')::uuid AND order_id=o.id FOR UPDATE;
 IF NOT FOUND OR u.state='SUPERSEDED' OR u.version IS DISTINCT FROM (t->>'version')::bigint
 OR u.revision IS DISTINCT FROM (t->>'revision')::bigint THEN RAISE EXCEPTION 'Repasse alterado. Atualize e revise a seleção.' USING ERRCODE='40001'; END IF;
 -- O lock no item impede confirmar enquanto outro cliente muda seu conteúdo.
 PERFORM 1 FROM public.order_items WHERE id=u.order_item_id AND handoff_revision=u.revision
 AND status NOT IN('CANCELLED','DELIVERED') AND u.unit_no<=quantity AND production_sector::text=u.sector FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Item não elegível para repasse.'; END IF;
 SELECT * INTO cfg FROM public.production_handoff_config WHERE branch_id=u.branch_id AND sector=u.sector FOR SHARE;
 IF (NOT FOUND OR NOT cfg.enabled) AND p_action<>'REVOKE' THEN RAISE EXCEPTION 'Configure o repasse deste setor antes de confirmar.'; END IF;
 IF p_action='MANUAL' AND cfg.mode<>'MANUAL' THEN RAISE EXCEPTION 'Use recuperação manual explícita para este setor.'; END IF;
 IF p_action='MANUAL_RECOVERY' AND cfg.mode<>'PRINTER' THEN RAISE EXCEPTION 'Recuperação exige setor com impressora.'; END IF;
 related_job:=NULL; previous_event:=NULL;
 IF p_action='MANUAL_RECOVERY' THEN
 SELECT c.printer_job_id INTO related_job FROM public.production_print_coverage c JOIN public.printer_jobs j ON j.id=c.printer_job_id WHERE c.unit_id=u.id ORDER BY j.created_at DESC,j.id DESC LIMIT 1;
 END IF;
 IF p_action='REVOKE' THEN
 IF u.state<>'CONFIRMED' THEN RAISE EXCEPTION 'Somente confirmação manual pode ser corrigida; impressão é evidência do job.'; END IF;
 SELECT id INTO previous_event FROM public.production_handoff_events WHERE unit_id=u.id AND origin IN('MANUAL','MANUAL_RECOVERY') ORDER BY created_at DESC,id DESC LIMIT 1;
 UPDATE public.production_handoff_units SET state='PENDING',confirmed_by=NULL,confirmed_at=NULL,version=version+1 WHERE id=u.id;
 ELSE
 IF u.state='CONFIRMED' OR EXISTS(SELECT 1 FROM public.production_handoff_events e WHERE e.unit_id=u.id AND e.origin='PRINT') THEN CONTINUE; END IF;
 UPDATE public.production_handoff_units SET state='CONFIRMED',confirmed_by=auth.uid(),confirmed_at=now(),version=version+1 WHERE id=u.id;
 END IF;
 INSERT INTO public.production_handoff_events(branch_id,order_id,unit_id,command_id,origin,actor_id,actor_name,reason,reverses_event_id,printer_job_id)
 VALUES(o.branch_id,o.id,u.id,p_command,p_action,auth.uid(),actor_name,p_reason,CASE WHEN p_action='REVOKE' THEN previous_event END,related_job);
 done:=done+1;
 END LOOP;
 result:=jsonb_build_object('changed',done,'command_id',p_command);
 UPDATE public.production_handoff_commands SET result=jsonb_build_object('changed',done,'command_id',p_command) WHERE branch_id=o.branch_id AND command_id=p_command;
 RETURN result;
END $$;
CREATE FUNCTION public.confirm_production_handoff(p_command uuid,p_order uuid,p_targets jsonb,p_action text DEFAULT 'MANUAL',p_reason text DEFAULT NULL)
 RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT handoff_private.confirm(p_command,p_order,p_targets,p_action,p_reason) $$;
CREATE FUNCTION handoff_private.read_orders(p_orders uuid[]) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR coalesce(cardinality(p_orders),0)>1000 OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND active AND role IN('ADMIN','ATTENDANT'))
 THEN RAISE EXCEPTION 'Sem permissão ou seleção inválida.' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(row_data) ORDER BY row_data.order_item_id,row_data.unit_no),'[]') INTO result FROM (
 SELECT u.*,cfg.mode,cfg.enabled,public.can_manage_branch(u.branch_id) AS can_manage,
 coalesce(manual.actor_name,'') AS actor_name,manual.origin AS confirmation_origin,
 printed.printed_at,latest.status AS job_status,latest.id AS job_id,
 coalesce(printed.printed_at IS NOT NULL OR u.state='CONFIRMED',false) AS confirmed,
 (SELECT coalesce(jsonb_agg(e ORDER BY e.created_at DESC),'[]') FROM
   (SELECT origin,actor_name,reason,created_at FROM public.production_handoff_events WHERE unit_id=u.id ORDER BY created_at DESC,id DESC LIMIT 8) e) AS history
 FROM public.production_handoff_units u
 JOIN public.orders o ON o.id=u.order_id
 JOIN public.order_items i ON i.id=u.order_item_id AND i.handoff_revision=u.revision
 LEFT JOIN public.production_handoff_config cfg ON cfg.branch_id=u.branch_id AND cfg.sector=u.sector
 LEFT JOIN LATERAL(SELECT actor_name,origin FROM public.production_handoff_events WHERE unit_id=u.id AND origin IN('MANUAL','MANUAL_RECOVERY') ORDER BY created_at DESC,id DESC LIMIT 1) manual ON true
 LEFT JOIN LATERAL(SELECT max(e.created_at) AS printed_at FROM public.production_handoff_events e WHERE e.unit_id=u.id AND e.origin='PRINT') printed ON true
 LEFT JOIN LATERAL(SELECT j.id,j.status FROM public.production_print_coverage c JOIN public.printer_jobs j ON j.id=c.printer_job_id WHERE c.unit_id=u.id ORDER BY j.created_at DESC,j.id DESC LIMIT 1) latest ON true
 WHERE u.order_id=ANY(p_orders) AND u.state<>'SUPERSEDED' AND public.can_access_branch(u.branch_id)
 ) row_data;
 RETURN result;
END $$;
CREATE FUNCTION public.get_production_handoffs(p_orders uuid[]) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT handoff_private.read_orders(p_orders) $$;

-- Históricos não podem ser apagados/reescritos por clientes ou service_role.
CREATE FUNCTION handoff_private.immutable_event() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'Histórico de repasse é imutável.'; END $$;
CREATE TRIGGER handoff_events_immutable BEFORE UPDATE OR DELETE ON public.production_handoff_events FOR EACH ROW EXECUTE FUNCTION handoff_private.immutable_event();
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['production_handoff_config','production_handoff_units','production_handoff_events','production_print_coverage','production_handoff_commands'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',t);
 IF t<>'production_handoff_commands' THEN
 EXECUTE format('GRANT SELECT ON public.%I TO authenticated,service_role',t);
 EXECUTE format('CREATE POLICY handoff_operator_read ON public.%I FOR SELECT TO authenticated USING(public.can_access_branch(branch_id) AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.active AND p.role IN(''ADMIN'',''ATTENDANT'')))',t);
 END IF;
 END LOOP;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA handoff_private FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA handoff_private TO authenticated;
GRANT EXECUTE ON FUNCTION handoff_private.configure(uuid,text,text,boolean,bigint),handoff_private.confirm(uuid,uuid,jsonb,text,text),handoff_private.read_orders(uuid[]) TO authenticated;
REVOKE ALL ON FUNCTION public.configure_production_handoff(uuid,text,text,boolean,bigint),public.confirm_production_handoff(uuid,uuid,jsonb,text,text),public.get_production_handoffs(uuid[]) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.configure_production_handoff(uuid,text,text,boolean,bigint),public.confirm_production_handoff(uuid,uuid,jsonb,text,text),public.get_production_handoffs(uuid[]) TO authenticated;
DO $$ DECLARE t text; BEGIN
 IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
 FOREACH t IN ARRAY ARRAY['production_handoff_units','production_handoff_config','printer_jobs'] LOOP
 IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
 EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t);
 END IF;
 END LOOP;
 END IF;
END $$;
