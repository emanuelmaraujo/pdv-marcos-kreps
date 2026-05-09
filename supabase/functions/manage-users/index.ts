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
        const { email, password, name, role, active } = data;

        if (!email || !password || !name || !role) {
          throw new Error('Campos obrigatórios ausentes (email, senha, nome, perfil).');
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
          .upsert({ id: newUser.user.id, name, role, active: active ?? true });

        if (insErr) throw insErr;

        await supabaseAdmin.from('audit_logs').insert({
          user_id: user.id,
          action: 'USER_CREATED',
          table_name: 'profiles',
          record_id: newUser.user.id,
          new_data: { email, name, role, active: active ?? true }
        });

        responseData = { id: newUser.user.id };
        break;
      }

      case 'update_user': {
        const { id, name, role } = data;
        if (!id || !name || !role) throw new Error('ID, nome e perfil são obrigatórios.');

        const { error: updErr } = await supabaseAdmin
          .from('profiles')
          .update({ name, role })
          .eq('id', id);

        if (updErr) throw updErr;

        await supabaseAdmin.from('audit_logs').insert({
          user_id: user.id,
          action: 'USER_UPDATED',
          table_name: 'profiles',
          record_id: id,
          new_data: { name, role }
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
