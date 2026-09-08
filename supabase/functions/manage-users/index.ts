import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { publicCorsHeaders } from "../_shared/public-cors.ts";

type StaffRole = "ADMIN" | "ATTENDANT" | "COURIER";

type ActorProfile = {
  role: StaffRole;
  active: boolean;
  is_global_admin: boolean;
};

type TargetAccess = {
  id: string;
  name: string;
  role: StaffRole;
  active: boolean;
  is_global_admin: boolean;
  home_branch_id: string | null;
  branch_ids: string[];
  phone: string | null;
};

function getCorsHeaders(req: Request) {
  return publicCorsHeaders(req);
}

function cleanText(value: unknown, maxLength = 255) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanEmail(value: unknown) {
  const email = cleanText(value, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function cleanRole(value: unknown): StaffRole | "" {
  return value === "ADMIN" || value === "ATTENDANT" || value === "COURIER" ? value : "";
}

function uniqueStrings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value.filter((item): item is string => typeof item === "string" && /^[0-9a-f-]{36}$/i.test(item)),
  ));
}

function validateCardinality(role: StaffRole, branchIds: string[]) {
  if ((role === "ADMIN" || role === "COURIER") && branchIds.length !== 1) {
    throw new Error(`${role === "ADMIN" ? "Administrador" : "Entregador"} deve pertencer a exatamente uma filial.`);
  }
  if (role === "ATTENDANT" && branchIds.length < 1) {
    throw new Error("Atendente deve pertencer a pelo menos uma filial.");
  }
}

function isSubset(values: string[], allowed: Set<string>) {
  return values.every((value) => allowed.has(value));
}

async function loadActorBranches(supabaseAdmin: any, actorId: string): Promise<Set<string>> {
  const { data, error } = await supabaseAdmin
    .from("profile_branches")
    .select("branch_id")
    .eq("profile_id", actorId);
  if (error) throw error;
  return new Set((data ?? []).map((row: { branch_id: string }) => row.branch_id));
}

async function loadTargetAccess(supabaseAdmin: any, id: string): Promise<TargetAccess> {
  const [{ data: target, error: targetError }, { data: links, error: linksError }, { data: courier }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, name, role, active, is_global_admin, home_branch_id")
      .eq("id", id)
      .single(),
    supabaseAdmin.from("profile_branches").select("branch_id").eq("profile_id", id),
    supabaseAdmin.from("couriers").select("phone").eq("profile_id", id).maybeSingle(),
  ]);
  if (targetError || !target) throw new Error("Usuário não encontrado.");
  if (linksError) throw linksError;
  return {
    ...target,
    branch_ids: (links ?? []).map((row: { branch_id: string }) => row.branch_id),
    phone: courier?.phone ?? null,
  } as TargetAccess;
}

function assertCanManageTarget(actor: ActorProfile, actorBranches: Set<string>, target: TargetAccess) {
  if (actor.is_global_admin) return;
  if (target.is_global_admin || target.role === "ADMIN") {
    throw new Error("Administrador local não pode alterar outro administrador.");
  }
  if (!isSubset(target.branch_ids, actorBranches)) {
    throw new Error("Usuário fora do escopo da sua filial.");
  }
}

async function assertRequestedBranches(
  supabaseAdmin: any,
  actor: ActorProfile,
  actorBranches: Set<string>,
  role: StaffRole,
  branchIds: string[],
) {
  validateCardinality(role, branchIds);
  if (!actor.is_global_admin && role === "ADMIN") {
    throw new Error("Somente o administrador global pode criar administradores.");
  }
  if (!actor.is_global_admin && !isSubset(branchIds, actorBranches)) {
    throw new Error("Administrador local só pode usar a própria filial.");
  }

  const { data: branches, error } = await supabaseAdmin
    .from("branches")
    .select("id")
    .in("id", branchIds)
    .eq("active", true);
  if (error) throw error;
  if ((branches ?? []).length !== branchIds.length) {
    throw new Error("Uma ou mais filiais não existem ou estão inativas.");
  }
}

async function saveUserAccess(
  supabaseAdmin: any,
  actorId: string,
  input: {
    id: string;
    name: string;
    role: StaffRole;
    active: boolean;
    branchIds: string[];
    homeBranchId: string;
    phone?: string | null;
  },
) {
  const { error } = await supabaseAdmin.rpc("admin_upsert_user_access", {
    p_actor_id: actorId,
    p_profile_id: input.id,
    p_name: input.name,
    p_role: input.role,
    p_active: input.active,
    p_branch_ids: input.branchIds,
    p_home_branch_id: input.homeBranchId,
    p_phone: input.phone ?? null,
  });
  if (error) throw error;
}

async function listAllAuthUsers(supabaseAdmin: any) {
  const users: any[] = [];
  const perPage = 1000;
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    users.push(...(data.users ?? []));
    if ((data.users?.length ?? 0) < perPage) break;
  }
  return users;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: getCorsHeaders(req) });

  let action = "unknown";

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authorization header missing");

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) throw new Error("Token inválido ou expirado.");

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role, active, is_global_admin")
      .eq("id", user.id)
      .single();
    if (profileError) throw new Error(`Erro ao validar permissões: ${profileError.message}`);
    if (!profile || profile.role !== "ADMIN" || !profile.active) {
      throw new Error("Acesso negado: apenas administradores ativos.");
    }

    const actor = profile as ActorProfile;
    const actorBranches = await loadActorBranches(supabaseAdmin, user.id);
    const body = await req.json();
    action = cleanText(body?.action, 40);
    const data = body?.data ?? {};
    let responseData: unknown = {};

    switch (action) {
      case "list_users": {
        const [
          authUsers,
          { data: profiles, error: profilesError },
          { data: links, error: linksError },
          { data: couriers, error: couriersError },
        ] = await Promise.all([
          listAllAuthUsers(supabaseAdmin),
          supabaseAdmin
            .from("profiles")
            .select("id, name, role, active, is_global_admin, home_branch_id, created_at")
            .order("created_at", { ascending: false }),
          supabaseAdmin.from("profile_branches").select("profile_id, branch_id"),
          supabaseAdmin.from("couriers").select("profile_id, phone").not("profile_id", "is", null),
        ]);
        if (profilesError) throw profilesError;
        if (linksError) throw linksError;
        if (couriersError) throw couriersError;

        const branchIdsByProfile = new Map<string, string[]>();
        for (const row of links ?? []) {
          const values = branchIdsByProfile.get(row.profile_id) ?? [];
          values.push(row.branch_id);
          branchIdsByProfile.set(row.profile_id, values);
        }

        const profileById = new Map<string, any>((profiles ?? []).map((item: any) => [item.id, item]));
        const phoneByProfile = new Map<string, string | null>(
          (couriers ?? []).map((item: { profile_id: string; phone: string | null }) => [item.profile_id, item.phone]),
        );
        responseData = authUsers.flatMap((authUser: any) => {
          const target = profileById.get(authUser.id);
          if (!target) return [];
          const branchIds = branchIdsByProfile.get(authUser.id) ?? [];
          const visible = actor.is_global_admin
            || (!target.is_global_admin && branchIds.some((id) => actorBranches.has(id)));
          if (!visible) return [];

          const canManage = actor.is_global_admin
            ? !target.is_global_admin
            : target.role !== "ADMIN" && !target.is_global_admin && isSubset(branchIds, actorBranches);

          return [{
            id: authUser.id,
            email: authUser.email,
            last_sign_in_at: authUser.last_sign_in_at,
            created_at: authUser.created_at,
            name: target.name || "Sem nome",
            role: target.role || "ATTENDANT",
            active: target.active ?? true,
            is_global_admin: target.is_global_admin ?? false,
            home_branch_id: target.home_branch_id ?? null,
            branch_ids: branchIds,
            phone: phoneByProfile.get(authUser.id) ?? null,
            can_manage: canManage,
          }];
        }).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      }

      case "create_user": {
        const email = cleanEmail(data.email);
        const password = typeof data.password === "string" ? data.password : "";
        const name = cleanText(data.name, 120);
        const role = cleanRole(data.role);
        const active = typeof data.active === "boolean" ? data.active : true;
        const branchIds = uniqueStrings(data.branch_ids);
        const requestedHome = typeof data.home_branch_id === "string" ? data.home_branch_id : "";
        const phone = cleanText(data.phone, 20);

        if (!email || !name || !role) throw new Error("E-mail, nome e papel são obrigatórios.");
        if (password.length < 8) throw new Error("A senha deve ter pelo menos 8 caracteres.");
        await assertRequestedBranches(supabaseAdmin, actor, actorBranches, role, branchIds);
        const homeBranchId = requestedHome && branchIds.includes(requestedHome) ? requestedHome : branchIds[0];

        const allowedDomain = (Deno.env.get("ALLOWED_USER_EMAIL_DOMAIN") || "").trim().toLowerCase();
        const isLocal = /localhost|127\.0\.0\.1/.test(supabaseUrl);
        if (allowedDomain && !isLocal && !email.endsWith(`@${allowedDomain}`)) {
          throw new Error(`Apenas e-mails @${allowedDomain} podem ser cadastrados.`);
        }

        const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { name },
        });
        if (createError) throw createError;

        try {
          await saveUserAccess(supabaseAdmin, user.id, {
            id: created.user.id,
            name,
            role,
            active,
            branchIds,
            homeBranchId,
            phone,
          });
        } catch (error) {
          await supabaseAdmin.auth.admin.deleteUser(created.user.id);
          throw error;
        }
        responseData = { id: created.user.id };
        break;
      }

      case "update_user": {
        const id = cleanText(data.id, 36);
        const name = cleanText(data.name, 120);
        const role = cleanRole(data.role);
        const branchIds = uniqueStrings(data.branch_ids);
        const requestedHome = typeof data.home_branch_id === "string" ? data.home_branch_id : "";
        const phone = data.phone === undefined ? undefined : cleanText(data.phone, 20);
        if (!id || !name || !role) throw new Error("ID, nome e papel são obrigatórios.");

        const target = await loadTargetAccess(supabaseAdmin, id);
        assertCanManageTarget(actor, actorBranches, target);
        await assertRequestedBranches(supabaseAdmin, actor, actorBranches, role, branchIds);
        const homeBranchId = requestedHome && branchIds.includes(requestedHome) ? requestedHome : branchIds[0];

        await saveUserAccess(supabaseAdmin, user.id, {
          id,
          name,
          role,
          active: target.active,
          branchIds,
          homeBranchId,
          phone: phone ?? target.phone,
        });
        break;
      }

      case "reset_password": {
        const id = cleanText(data.id, 36);
        const password = typeof data.password === "string" ? data.password : "";
        if (!id || password.length < 8) throw new Error("Informe uma senha com pelo menos 8 caracteres.");
        const target = await loadTargetAccess(supabaseAdmin, id);
        assertCanManageTarget(actor, actorBranches, target);
        const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { password });
        if (error) throw error;
        await supabaseAdmin.from("audit_logs").insert({
          user_id: user.id,
          action: "USER_PASSWORD_RESET",
          table_name: "profiles",
          record_id: id,
          branch_id: target.branch_ids.length === 1 ? target.branch_ids[0] : null,
        });
        break;
      }

      case "toggle_user_status": {
        const id = cleanText(data.id, 36);
        if (!id || typeof data.active !== "boolean") throw new Error("ID e status são obrigatórios.");
        if (id === user.id && !data.active) throw new Error("Você não pode desativar a própria conta.");
        const target = await loadTargetAccess(supabaseAdmin, id);
        assertCanManageTarget(actor, actorBranches, target);
        await saveUserAccess(supabaseAdmin, user.id, {
          id,
          name: target.name,
          role: target.role,
          active: data.active,
          branchIds: target.branch_ids,
          homeBranchId: target.home_branch_id ?? target.branch_ids[0],
          phone: target.phone,
        });
        break;
      }

      case "delete_user": {
        const id = cleanText(data.id, 36);
        if (!id) throw new Error("ID do usuário é obrigatório.");
        if (id === user.id) throw new Error("Você não pode excluir a própria conta.");
        const target = await loadTargetAccess(supabaseAdmin, id);
        assertCanManageTarget(actor, actorBranches, target);
        if (target.is_global_admin) throw new Error("Administrador global não pode ser excluído por este fluxo.");

        await supabaseAdmin.from("audit_logs").insert({
          user_id: user.id,
          action: "USER_DELETED",
          table_name: "profiles",
          record_id: id,
          old_data: { name: target.name, role: target.role, branch_ids: target.branch_ids },
          branch_id: target.branch_ids.length === 1 ? target.branch_ids[0] : null,
        });
        const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
        if (error) throw error;
        break;
      }

      default:
        throw new Error("Ação inválida.");
    }

    return new Response(JSON.stringify({ success: true, data: responseData }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error(`[manage-users] Erro na ação ${action}:`, error?.message);
    return new Response(JSON.stringify({
      success: false,
      error: error?.message ?? "Erro desconhecido.",
      details: error?.details || error?.hint || null,
    }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      status: /negado|autorizado|escopo/i.test(error?.message ?? "") ? 403 : 400,
    });
  }
});
