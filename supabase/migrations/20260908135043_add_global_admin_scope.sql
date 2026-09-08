-- Administracao multi-filial profissional.
--
-- `role = ADMIN` passa a representar administracao de uma filial. O alcance
-- global e um atributo organizacional separado e deliberadamente raro. Essa
-- separacao evita multiplicar papeis operacionais e mantem compatibilidade com
-- os fluxos existentes que tratam ADMIN como um operador privilegiado.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_global_admin BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_global_admin_requires_admin_role;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_global_admin_requires_admin_role
  CHECK (NOT is_global_admin OR role = 'ADMIN');

COMMENT ON COLUMN public.profiles.is_global_admin IS
  'Administrador da rede. ADMIN sem esta marca administra somente a filial vinculada.';

CREATE INDEX IF NOT EXISTS idx_profiles_global_admin_active
  ON public.profiles (is_global_admin)
  WHERE is_global_admin = TRUE AND active = TRUE;

-- Bootstrap solicitado pelo proprietario. O UPDATE e idempotente e nao quebra
-- ambientes locais onde a conta ainda nao foi criada.
UPDATE public.profiles AS p
SET is_global_admin = TRUE,
    role = 'ADMIN'
FROM auth.users AS u
WHERE u.id = p.id
  AND lower(u.email) = 'emanuel-morais@outlook.com';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM auth.users AS u
    JOIN public.profiles AS p ON p.id = u.id
    WHERE lower(u.email) = 'emanuel-morais@outlook.com'
      AND p.is_global_admin = TRUE
  ) THEN
    RAISE NOTICE 'Conta global ainda nao existe neste ambiente: emanuel-morais@outlook.com';
  END IF;
END;
$$;

-- Mantem o bootstrap deterministico também quando o usuário é criado depois
-- da aplicação da migration (por exemplo, em um ambiente local restaurado).
CREATE OR REPLACE FUNCTION public.apply_bootstrap_global_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM auth.users AS u
    WHERE u.id = NEW.id
      AND lower(u.email) = 'emanuel-morais@outlook.com'
  ) THEN
    NEW.role := 'ADMIN';
    NEW.is_global_admin := TRUE;
    NEW.active := TRUE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_bootstrap_global_admin ON public.profiles;
CREATE TRIGGER profiles_bootstrap_global_admin
BEFORE INSERT OR UPDATE OF role, active, is_global_admin
ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.apply_bootstrap_global_admin();

REVOKE ALL ON FUNCTION public.apply_bootstrap_global_admin() FROM PUBLIC, anon, authenticated;

-- Normaliza os ADMINs locais existentes para uma unica filial. A filial
-- principal e preservada quando valida; caso contrario, mantem-se o primeiro
-- vinculo existente e, por ultimo, a primeira filial ativa.
WITH chosen AS (
  SELECT
    p.id AS profile_id,
    COALESCE(
      (
        SELECT pb.branch_id
        FROM public.profile_branches AS pb
        WHERE pb.profile_id = p.id
          AND pb.branch_id = p.home_branch_id
        LIMIT 1
      ),
      (
        SELECT pb.branch_id
        FROM public.profile_branches AS pb
        WHERE pb.profile_id = p.id
        ORDER BY pb.branch_id
        LIMIT 1
      ),
      (
        SELECT b.id
        FROM public.branches AS b
        WHERE b.active = TRUE
        ORDER BY b.created_at, b.id
        LIMIT 1
      )
    ) AS branch_id
  FROM public.profiles AS p
  WHERE p.role IN ('ADMIN', 'COURIER')
    AND p.is_global_admin = FALSE
)
DELETE FROM public.profile_branches AS pb
USING chosen AS c
WHERE pb.profile_id = c.profile_id
  AND pb.branch_id IS DISTINCT FROM c.branch_id;

WITH chosen AS (
  SELECT
    p.id AS profile_id,
    COALESCE(
      p.home_branch_id,
      (
        SELECT pb.branch_id
        FROM public.profile_branches AS pb
        WHERE pb.profile_id = p.id
        ORDER BY pb.branch_id
        LIMIT 1
      ),
      (
        SELECT b.id
        FROM public.branches AS b
        WHERE b.active = TRUE
        ORDER BY b.created_at, b.id
        LIMIT 1
      )
    ) AS branch_id
  FROM public.profiles AS p
  WHERE p.is_global_admin = FALSE
)
INSERT INTO public.profile_branches (profile_id, branch_id)
SELECT c.profile_id, c.branch_id
FROM chosen AS c
WHERE c.branch_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.profile_branches AS pb
    WHERE pb.profile_id = c.profile_id
  )
ON CONFLICT DO NOTHING;

UPDATE public.profiles AS p
SET home_branch_id = picked.branch_id
FROM (
  SELECT pb.profile_id, min(pb.branch_id::text)::uuid AS branch_id
  FROM public.profile_branches AS pb
  GROUP BY pb.profile_id
) AS picked
WHERE p.id = picked.profile_id
  AND p.is_global_admin = FALSE
  AND NOT EXISTS (
    SELECT 1
    FROM public.profile_branches AS own
    WHERE own.profile_id = p.id
      AND own.branch_id = p.home_branch_id
  );

-- Helpers pequenos e estaveis para uso em RLS. SECURITY DEFINER e necessario
-- para consultar profiles/profile_branches sem recursao de policy. A superficie
-- publica e fechada por REVOKE/GRANT explicitos.
CREATE OR REPLACE FUNCTION public.is_global_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT p.active AND p.role = 'ADMIN' AND p.is_global_admin
    FROM public.profiles AS p
    WHERE p.id = p_user_id
  ), FALSE);
$$;

REVOKE ALL ON FUNCTION public.is_global_admin(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_global_admin(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_my_branches()
RETURNS TABLE(branch_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT b.id
  FROM public.branches AS b
  JOIN public.profiles AS p
    ON p.id = (SELECT auth.uid())
   AND p.active = TRUE
  WHERE b.active = TRUE
    AND (
      p.is_global_admin = TRUE
      OR EXISTS (
        SELECT 1
        FROM public.profile_branches AS pb
        WHERE pb.profile_id = p.id
          AND pb.branch_id = b.id
      )
    );
$$;

REVOKE ALL ON FUNCTION public.get_my_branches() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_branches() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_access_branch(p_branch_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.get_my_branches() AS allowed
    WHERE allowed.branch_id = p_branch_id
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_branch(p_branch_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = (SELECT auth.uid())
      AND p.active = TRUE
      AND p.role = 'ADMIN'
      AND (
        p.is_global_admin = TRUE
        OR EXISTS (
          SELECT 1
          FROM public.profile_branches AS pb
          WHERE pb.profile_id = p.id
            AND pb.branch_id = p_branch_id
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_branch(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage_branch(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_branch(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_branch(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_public_branch(p_branch_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.branches AS b
    WHERE b.id = p_branch_id
      AND b.active = TRUE
  );
$$;

REVOKE ALL ON FUNCTION public.is_public_branch(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_public_branch(UUID) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_view_profile(p_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    p_profile_id = (SELECT auth.uid())
    OR public.is_global_admin()
    OR EXISTS (
      SELECT 1
      FROM public.profile_branches AS target_branch
      JOIN public.profile_branches AS actor_branch
        ON actor_branch.branch_id = target_branch.branch_id
      JOIN public.profiles AS actor
        ON actor.id = actor_branch.profile_id
      WHERE target_branch.profile_id = p_profile_id
        AND actor_branch.profile_id = (SELECT auth.uid())
        AND actor.active = TRUE
        AND actor.role = 'ADMIN'
    );
$$;

REVOKE ALL ON FUNCTION public.can_view_profile(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_profile(UUID) TO authenticated, service_role;

-- Alteracao da filial inicial sem conceder UPDATE direto na linha de profiles.
CREATE OR REPLACE FUNCTION public.set_my_home_branch(p_branch_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT public.can_access_branch(p_branch_id) THEN
    RAISE EXCEPTION 'Filial nao autorizada.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET home_branch_id = p_branch_id
  WHERE id = (SELECT auth.uid())
    AND active = TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_home_branch(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_home_branch(UUID) TO authenticated;

-- Invariantes de cardinalidade. O trigger e adiado para o COMMIT, permitindo
-- atualizar perfil e vinculos dentro do mesmo comando transacional.
CREATE OR REPLACE FUNCTION public.assert_profile_branch_cardinality()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile_id UUID;
  v_profile public.profiles%ROWTYPE;
  v_count INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'profiles' THEN
    v_profile_id := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    v_profile_id := OLD.profile_id;
  ELSE
    v_profile_id := NEW.profile_id;
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_profile_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_profile.is_global_admin THEN
    IF v_profile.role <> 'ADMIN' THEN
      RAISE EXCEPTION 'Administrador global deve manter o papel ADMIN.';
    END IF;
    RETURN NULL;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.profile_branches
  WHERE profile_id = v_profile.id;

  IF v_profile.role IN ('ADMIN', 'COURIER') AND v_count <> 1 THEN
    RAISE EXCEPTION '% deve pertencer a exatamente uma filial.', v_profile.role;
  END IF;

  IF v_profile.role = 'ATTENDANT' AND v_count < 1 THEN
    RAISE EXCEPTION 'ATTENDANT deve pertencer a pelo menos uma filial.';
  END IF;

  IF v_profile.home_branch_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profile_branches AS pb
    WHERE pb.profile_id = v_profile.id
      AND pb.branch_id = v_profile.home_branch_id
  ) THEN
    RAISE EXCEPTION 'A filial inicial deve fazer parte das filiais autorizadas.';
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS profiles_branch_cardinality ON public.profiles;
CREATE CONSTRAINT TRIGGER profiles_branch_cardinality
AFTER INSERT OR UPDATE OF role, active, home_branch_id, is_global_admin
ON public.profiles
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.assert_profile_branch_cardinality();

DROP TRIGGER IF EXISTS profile_branches_cardinality ON public.profile_branches;
CREATE CONSTRAINT TRIGGER profile_branches_cardinality
AFTER INSERT OR UPDATE OR DELETE
ON public.profile_branches
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.assert_profile_branch_cardinality();

-- Constraint triggers nao retroagem sobre linhas antigas. A migration deve
-- falhar de forma segura se a normalizacao acima nao conseguiu produzir um
-- estado valido (por exemplo, ambiente com usuarios e nenhuma filial ativa).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.profiles AS p
    LEFT JOIN public.profile_branches AS pb ON pb.profile_id = p.id
    WHERE p.is_global_admin = FALSE
    GROUP BY p.id, p.role, p.home_branch_id
    HAVING
      (p.role IN ('ADMIN', 'COURIER') AND count(pb.branch_id) <> 1)
      OR (p.role = 'ATTENDANT' AND count(pb.branch_id) < 1)
      OR p.home_branch_id IS NULL
      OR NOT bool_or(pb.branch_id = p.home_branch_id)
  ) THEN
    RAISE EXCEPTION 'Nao foi possivel normalizar todos os usuarios para uma filial valida.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_profile_branch_cardinality() FROM PUBLIC, anon, authenticated;

-- Comando atomico usado pela Edge Function manage-users. Ele e SECURITY
-- INVOKER e executavel apenas por service_role; alem disso, revalida o ator,
-- alvo, papel e filiais para que service_role nao seja confundida com
-- autorizacao de negocio.
CREATE OR REPLACE FUNCTION public.admin_upsert_user_access(
  p_actor_id UUID,
  p_profile_id UUID,
  p_name TEXT,
  p_role public.user_role,
  p_active BOOLEAN,
  p_branch_ids UUID[],
  p_home_branch_id UUID,
  p_phone TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_actor public.profiles%ROWTYPE;
  v_target public.profiles%ROWTYPE;
  v_target_exists BOOLEAN := FALSE;
  v_branch_ids UUID[] := ARRAY(
    SELECT DISTINCT requested.branch_id
    FROM unnest(COALESCE(p_branch_ids, ARRAY[]::UUID[])) AS requested(branch_id)
    ORDER BY requested.branch_id
  );
  v_expected_count INTEGER;
BEGIN
  SELECT * INTO v_actor
  FROM public.profiles
  WHERE id = p_actor_id
    AND active = TRUE;

  IF NOT FOUND OR v_actor.role <> 'ADMIN' THEN
    RAISE EXCEPTION 'Ator nao autorizado.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_target
  FROM public.profiles
  WHERE id = p_profile_id;
  v_target_exists := FOUND;

  IF btrim(COALESCE(p_name, '')) = '' OR length(btrim(p_name)) > 120 THEN
    RAISE EXCEPTION 'Nome invalido.';
  END IF;

  IF p_role IN ('ADMIN', 'COURIER') AND cardinality(v_branch_ids) <> 1 THEN
    RAISE EXCEPTION '% deve pertencer a exatamente uma filial.', p_role;
  END IF;

  IF p_role = 'ATTENDANT' AND cardinality(v_branch_ids) < 1 THEN
    RAISE EXCEPTION 'Atendente deve pertencer a pelo menos uma filial.';
  END IF;

  IF p_home_branch_id IS NULL OR NOT (p_home_branch_id = ANY(v_branch_ids)) THEN
    RAISE EXCEPTION 'Filial inicial invalida.';
  END IF;

  SELECT count(*) INTO v_expected_count
  FROM public.branches AS b
  WHERE b.id = ANY(v_branch_ids)
    AND b.active = TRUE;

  IF v_expected_count <> cardinality(v_branch_ids) THEN
    RAISE EXCEPTION 'Uma ou mais filiais nao existem ou estao inativas.';
  END IF;

  IF NOT v_actor.is_global_admin THEN
    IF p_role = 'ADMIN' THEN
      RAISE EXCEPTION 'Somente o administrador global pode criar outro administrador.' USING ERRCODE = '42501';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM unnest(v_branch_ids) AS requested(branch_id)
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.profile_branches AS own
        WHERE own.profile_id = v_actor.id
          AND own.branch_id = requested.branch_id
      )
    ) THEN
      RAISE EXCEPTION 'Administrador local so pode gerenciar a propria filial.' USING ERRCODE = '42501';
    END IF;

    IF v_target_exists AND (v_target.role = 'ADMIN' OR v_target.is_global_admin) THEN
      RAISE EXCEPTION 'Administrador local nao pode alterar administradores.' USING ERRCODE = '42501';
    END IF;

    IF v_target_exists AND EXISTS (
      SELECT 1
      FROM public.profile_branches AS target_branch
      WHERE target_branch.profile_id = p_profile_id
        AND NOT EXISTS (
          SELECT 1
          FROM public.profile_branches AS own
          WHERE own.profile_id = v_actor.id
            AND own.branch_id = target_branch.branch_id
        )
    ) THEN
      RAISE EXCEPTION 'Usuario fora do escopo do administrador local.' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_target_exists AND v_target.is_global_admin THEN
    IF p_role <> 'ADMIN' OR p_active = FALSE THEN
      RAISE EXCEPTION 'Administrador global nao pode ser rebaixado ou desativado por este fluxo.';
    END IF;
  END IF;

  INSERT INTO public.profiles (id, name, role, active, home_branch_id)
  VALUES (p_profile_id, btrim(p_name), p_role, p_active, p_home_branch_id)
  ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      role = EXCLUDED.role,
      active = EXCLUDED.active,
      home_branch_id = EXCLUDED.home_branch_id;

  DELETE FROM public.profile_branches
  WHERE profile_id = p_profile_id;

  INSERT INTO public.profile_branches (profile_id, branch_id)
  SELECT p_profile_id, requested.branch_id
  FROM unnest(v_branch_ids) AS requested(branch_id);

  IF p_role = 'COURIER' THEN
    INSERT INTO public.couriers (branch_id, name, phone, active, profile_id)
    VALUES (v_branch_ids[1], btrim(p_name), nullif(btrim(COALESCE(p_phone, '')), ''), p_active, p_profile_id)
    ON CONFLICT (profile_id) WHERE profile_id IS NOT NULL DO UPDATE
    SET branch_id = EXCLUDED.branch_id,
        name = EXCLUDED.name,
        phone = EXCLUDED.phone,
        active = EXCLUDED.active;
  ELSE
    UPDATE public.couriers
    SET active = FALSE,
        profile_id = NULL
    WHERE profile_id = p_profile_id;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_data, branch_id)
  VALUES (
    p_actor_id,
    CASE WHEN v_target_exists THEN 'USER_UPDATED' ELSE 'USER_CREATED' END,
    'profiles',
    p_profile_id,
    jsonb_build_object(
      'name', btrim(p_name),
      'role', p_role,
      'active', p_active,
      'branch_ids', to_jsonb(v_branch_ids),
      'home_branch_id', p_home_branch_id
    ),
    CASE WHEN cardinality(v_branch_ids) = 1 THEN v_branch_ids[1] ELSE NULL END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_user_access(
  UUID, UUID, TEXT, public.user_role, BOOLEAN, UUID[], UUID, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_user_access(
  UUID, UUID, TEXT, public.user_role, BOOLEAN, UUID[], UUID, TEXT
) TO service_role;

-- --------------------------------------------------------------------------
-- RLS e privilegios do nucleo administrativo
-- --------------------------------------------------------------------------

DROP POLICY IF EXISTS "Public read settings" ON public.settings;
DROP POLICY IF EXISTS "Admin control settings" ON public.settings;
REVOKE ALL ON TABLE public.settings FROM anon, authenticated;
GRANT SELECT ON TABLE public.settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.settings TO authenticated;

CREATE POLICY "Administradores leem settings"
  ON public.settings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = (SELECT auth.uid())
        AND p.active = TRUE
        AND p.role = 'ADMIN'
    )
  );

CREATE POLICY "Administrador global gerencia settings"
  ON public.settings FOR ALL TO authenticated
  USING (public.is_global_admin())
  WITH CHECK (public.is_global_admin());

DROP POLICY IF EXISTS "Public read active branches" ON public.branches;
DROP POLICY IF EXISTS "Equipe le filiais autorizadas" ON public.branches;
DROP POLICY IF EXISTS "Admin controla branches" ON public.branches;
REVOKE ALL ON TABLE public.branches FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.branches TO authenticated;

CREATE POLICY "Equipe le filiais autorizadas"
  ON public.branches FOR SELECT TO authenticated
  USING (public.can_access_branch(id) OR public.can_manage_branch(id));

CREATE POLICY "Administrador global cria filiais"
  ON public.branches FOR INSERT TO authenticated
  WITH CHECK (public.is_global_admin());

CREATE POLICY "Administrador gerencia filial autorizada"
  ON public.branches FOR UPDATE TO authenticated
  USING (public.can_manage_branch(id))
  WITH CHECK (public.can_manage_branch(id));

-- Filiais com historico financeiro e operacional sao arquivadas por `active`;
-- exclusao fisica nao faz parte da API autenticada.
DROP POLICY IF EXISTS "Administrador global remove filiais" ON public.branches;

DROP POLICY IF EXISTS "Equipe le profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin controla profiles" ON public.profiles;
REVOKE ALL ON TABLE public.profiles FROM anon, authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;

CREATE POLICY "Usuario le perfil permitido"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.can_view_profile(id));

DROP POLICY IF EXISTS "Admin controla profile_branches" ON public.profile_branches;
DROP POLICY IF EXISTS "Profile le seus vinculos" ON public.profile_branches;
REVOKE ALL ON TABLE public.profile_branches FROM anon, authenticated;
GRANT SELECT ON TABLE public.profile_branches TO authenticated;

CREATE POLICY "Usuario le vinculos permitidos"
  ON public.profile_branches FOR SELECT TO authenticated
  USING (
    profile_id = (SELECT auth.uid())
    OR public.is_global_admin()
    OR (
      public.can_manage_branch(branch_id)
      AND EXISTS (
        SELECT 1 FROM public.profiles AS target
        WHERE target.id = profile_id
          AND target.is_global_admin = FALSE
      )
    )
  );

DROP POLICY IF EXISTS "Apenas Admin ve logs de auditoria" ON public.audit_logs;
REVOKE ALL ON TABLE public.audit_logs FROM anon, authenticated;
GRANT SELECT ON TABLE public.audit_logs TO authenticated;

CREATE POLICY "Administradores leem auditoria do escopo"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (
    public.is_global_admin()
    OR (branch_id IS NOT NULL AND public.can_manage_branch(branch_id))
  );

CREATE INDEX IF NOT EXISTS idx_audit_logs_branch_created
  ON public.audit_logs (branch_id, created_at DESC);

DROP POLICY IF EXISTS "Admin controla delivery_zones" ON public.delivery_zones;
CREATE POLICY "Administrador gerencia zonas da filial"
  ON public.delivery_zones FOR ALL TO authenticated
  USING (public.can_manage_branch(branch_id))
  WITH CHECK (public.can_manage_branch(branch_id));

DROP POLICY IF EXISTS "Equipe le couriers" ON public.couriers;
DROP POLICY IF EXISTS "Admin gerencia couriers" ON public.couriers;
CREATE POLICY "Equipe le entregadores da filial"
  ON public.couriers FOR SELECT TO authenticated
  USING (public.can_access_branch(branch_id) OR profile_id = (SELECT auth.uid()));

CREATE POLICY "Administrador gerencia entregadores da filial"
  ON public.couriers FOR ALL TO authenticated
  USING (public.can_manage_branch(branch_id))
  WITH CHECK (public.can_manage_branch(branch_id));

-- A auditoria de filial precisa carregar o proprio escopo; sem branch_id o
-- administrador local nao conseguiria consultar as mudancas da sua unidade.
CREATE OR REPLACE FUNCTION public.log_branch_audit_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.branches%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row := OLD;
  ELSE
    v_row := NEW;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data, branch_id)
  VALUES (
    (SELECT auth.uid()),
    CASE TG_OP WHEN 'INSERT' THEN 'BRANCH_CREATED' WHEN 'UPDATE' THEN 'BRANCH_UPDATED' ELSE 'BRANCH_DELETED' END,
    'branches',
    v_row.id,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE v_row.id END
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- Funcoes de trigger nao sao endpoints.
REVOKE ALL ON FUNCTION public.log_branch_audit_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_settings_audit_change() FROM PUBLIC, anon, authenticated;
