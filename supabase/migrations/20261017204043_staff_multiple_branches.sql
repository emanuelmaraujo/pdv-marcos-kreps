-- Multi-filial para todas as funcoes da equipe (ADMIN, ATTENDANT e COURIER).
-- Compativel com perfis existentes; nao remove nem reinsere vinculos atuais.
-- Cada usuario deve manter >= 1 filial e uma filial inicial autorizada.
-- Administradores locais continuam restritos as filiais a que pertencem.

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

  IF v_count < 1 THEN
    RAISE EXCEPTION 'Todos os funcionarios devem pertencer a pelo menos uma filial.';
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

  IF cardinality(v_branch_ids) < 1 THEN
    RAISE EXCEPTION 'Todos os funcionarios devem pertencer a pelo menos uma filial.';
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
    VALUES (p_home_branch_id, btrim(p_name), nullif(btrim(COALESCE(p_phone, '')), ''), p_active, p_profile_id)
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

-- Lookup eficiente das filiais associadas ao motoboy.
CREATE INDEX IF NOT EXISTS idx_profile_branches_branch_profile
  ON public.profile_branches (branch_id, profile_id);

-- API segura para listar motoboys autorizados em uma determinada filial.
CREATE OR REPLACE FUNCTION public.list_branch_couriers(p_branch_id UUID)
RETURNS TABLE (
  id UUID,
  branch_id UUID,
  name TEXT,
  phone TEXT,
  active BOOLEAN,
  profile_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- A funcao contorna RLS apenas para agregar os vinculos N:N.
  -- Nunca retorna dados de filiais nao autorizadas ou para usuarios desativados.
  IF (SELECT auth.uid()) IS NULL
     OR NOT public.can_access_branch(p_branch_id)
     OR NOT EXISTS (
       SELECT 1 FROM public.profiles AS p
       WHERE p.id = (SELECT auth.uid())
         AND p.active = TRUE
         AND p.role IN ('ADMIN', 'ATTENDANT')
     )
  THEN
    RAISE EXCEPTION 'Filial nao autorizada.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT c.id, c.branch_id, c.name, c.phone, c.active,
           c.profile_id, c.created_at, c.updated_at
    FROM public.couriers AS c
    WHERE
      (c.profile_id IS NULL AND c.branch_id = p_branch_id)
      OR (
        c.profile_id IS NOT NULL AND EXISTS (
          SELECT 1
          FROM public.profile_branches AS pb
          JOIN public.profiles AS p ON p.id = pb.profile_id
          WHERE pb.profile_id = c.profile_id
            AND pb.branch_id = p_branch_id
            AND p.role = 'COURIER'
        )
      )
    ORDER BY c.name;
END;
$$;

REVOKE ALL ON FUNCTION public.list_branch_couriers(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_branch_couriers(UUID) TO authenticated, service_role;
