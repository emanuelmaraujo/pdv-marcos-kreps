import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let action = 'unknown';

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Authorization header missing');

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      throw new Error(`Não autorizado: ${authError?.message || 'Token inválido ou expirado'}`);
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, active')
      .eq('id', user.id)
      .single();

    if (profileError) throw new Error(`Erro ao validar permissões: ${profileError.message}`);

    if (!profile || profile.role !== 'ADMIN' || !profile.active) {
      throw new Error('Acesso negado: Apenas administradores ativos podem realizar esta ação.');
    }

    const body = await req.json();
    action = body.action;
    const data = body.data;

    let responseData: any = {};

    switch (action) {
      case 'list_users': {
        const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
        if (listErr) throw listErr;

        const { data: profiles, error: pErr } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (pErr) throw pErr;

        responseData = users.map(u => {
          const profile = profiles.find(p => p.id === u.id);
          return {
            id: u.id,
            email: u.email,
            last_sign_in_at: u.last_sign_in_at,
            created_at: u.created_at,
            name: profile?.name || 'Sem nome',
            role: profile?.role || 'ATTENDANT',
            active: profile?.active ?? true
          };
        }).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      }

      case 'create_user': {
        const { email, password, name, role, active, branch_ids, home_branch_id } = data;

        if (!email || !password || !name || !role) {
          throw new Error('Campos obrigatórios ausentes (email, senha, nome, perfil).');
        }

        const ALLOWED_EMAIL_DOMAIN = 'marcoskreps.com.br';
        const isLocalSupabase = /localhost|127\.0\.0\.1/.test(supabaseUrl);
        const emailOk = String(email).trim().toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
        if (!isLocalSupabase && !emailOk) {
          throw new Error(`Apenas e-mails @${ALLOWED_EMAIL_DOMAIN} podem ser cadastrados.`);
        }

        const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { name }
        });

        if (createErr) throw createErr;

        const { error: insErr } = await supabaseAdmin
          .from('profiles')
          .upsert({
            id: newUser.user.id,
            name,
            role,
            active: active ?? true,
            home_branch_id: home_branch_id ?? (Array.isArray(branch_ids) && branch_ids.length > 0 ? branch_ids[0] : null),
          });

        if (insErr) throw insErr;

        if (Array.isArray(branch_ids) && branch_ids.length > 0) {
          const rows = branch_ids.map((bid: string) => ({ profile_id: newUser.user.id, branch_id: bid }));
          await supabaseAdmin.from('profile_branches').insert(rows);
        }

        await supabaseAdmin.from('audit_logs').insert({
          user_id: user.id,
          action: 'USER_CREATED',
          table_name: 'profiles',
          record_id: newUser.user.id,
          new_data: { email, name, role, active: active ?? true, branch_ids }
        });

        responseData = { id: newUser.user.id };
        break;
      }

      case 'update_user': {
        const { id, name, role, branch_ids, home_branch_id } = data;
        if (!id || !name || !role) throw new Error('ID, nome e perfil são obrigatórios.');

        const profileUpdate: Record<string, unknown> = { name, role };
        if (home_branch_id !== undefined) profileUpdate.home_branch_id = home_branch_id;

        const { error: updErr } = await supabaseAdmin
          .from('profiles')
          .update(profileUpdate)
          .eq('id', id);

        if (updErr) throw updErr;

        // Se branch_ids foi enviado, sincroniza profile_branches (delete + insert).
        if (Array.isArray(branch_ids)) {
          const { error: delErr } = await supabaseAdmin
            .from('profile_branches').delete().eq('profile_id', id);
          if (delErr) throw delErr;
          if (branch_ids.length > 0) {
            const rows = branch_ids.map((bid: string) => ({ profile_id: id, branch_id: bid }));
            const { error: insErr } = await supabaseAdmin.from('profile_branches').insert(rows);
            if (insErr) throw insErr;
          }
        }

        await supabaseAdmin.from('audit_logs').insert({
          user_id: user.id,
          action: 'USER_UPDATED',
          table_name: 'profiles',
          record_id: id,
          new_data: { name, role, branch_ids }
        });
        break;
      }

      case 'reset_password': {
        const { id, password } = data;
        if (!id || !password) throw new Error('ID e nova senha são obrigatórios.');
        if (password.length < 6) throw new Error('A senha deve ter pelo menos 6 caracteres.');

        const { error: resetErr } = await supabaseAdmin.auth.admin.updateUserById(id, { password });
        if (resetErr) throw resetErr;

        await supabaseAdmin.from('audit_logs').insert({
          user_id: user.id,
          action: 'USER_PASSWORD_RESET',
          table_name: 'profiles',
          record_id: id
        });
        break;
      }

      case 'toggle_user_status': {
        const { id, active } = data;
        if (!id || active === undefined) throw new Error('ID e status são obrigatórios.');

        if (id === user.id && !active) {
          const { count, error: countErr } = await supabaseAdmin
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'ADMIN')
            .eq('active', true);

          if (countErr) throw countErr;
          if (count && count <= 1) {
            throw new Error('Você é o único administrador ativo. Não pode desativar seu próprio acesso.');
          }
        }

        const { error: tglErr } = await supabaseAdmin
          .from('profiles')
          .update({ active })
          .eq('id', id);

        if (tglErr) throw tglErr;

        await supabaseAdmin.from('audit_logs').insert({
          user_id: user.id,
          action: active ? 'USER_ENABLED' : 'USER_DISABLED',
          table_name: 'profiles',
          record_id: id
        });
        break;
      }

      case 'delete_user': {
        const { id } = data;
        if (!id) throw new Error('ID do usuário é obrigatório.');

        if (id === user.id) throw new Error('Você não pode excluir sua própria conta.');

        const { count, error: countErr } = await supabaseAdmin
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'ADMIN')
          .eq('active', true);

        if (countErr) throw countErr;

        const { data: targetProfile } = await supabaseAdmin
          .from('profiles')
          .select('role, active')
          .eq('id', id)
          .single();

        if (targetProfile?.role === 'ADMIN' && targetProfile?.active && count && count <= 1) {
          throw new Error('Não é possível excluir o único administrador ativo.');
        }

        const { error: delProfileErr } = await supabaseAdmin
          .from('profiles')
          .delete()
          .eq('id', id);

        if (delProfileErr) throw delProfileErr;

        const { error: delAuthErr } = await supabaseAdmin.auth.admin.deleteUser(id);
        if (delAuthErr) throw delAuthErr;

        await supabaseAdmin.from('audit_logs').insert({
          user_id: user.id,
          action: 'USER_DELETED',
          table_name: 'profiles',
          record_id: id,
        });
        break;
      }

      default:
        throw new Error('Ação inválida.');
    }

    return new Response(JSON.stringify({ success: true, data: responseData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error(`[manage-users] Erro na ação ${action}:`, error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      details: error.details || error.hint || null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
});
