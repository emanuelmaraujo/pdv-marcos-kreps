export function validateSupabaseTarget({ projectRef, expectedProjectRef, databaseUrl, accessToken }) {
  if (!/^[a-z0-9]{20}$/.test(projectRef ?? '') || projectRef !== expectedProjectRef) {
    throw new Error('SUPABASE_PROJECT_ID não corresponde ao projeto esperado para este repositório.');
  }
  if (!accessToken) throw new Error('Configure SUPABASE_ACCESS_TOKEN nos secrets do GitHub.');
  if (!databaseUrl) throw new Error('Configure SUPABASE_DB_URL nos secrets do GitHub.');
  let url;
  try { url = new URL(databaseUrl); } catch { throw new Error('SUPABASE_DB_URL inválida.'); }
  const directHost = `db.${projectRef}.supabase.co`;
  const pooler = url.hostname.endsWith('.pooler.supabase.com') && decodeURIComponent(url.username) === `postgres.${projectRef}`;
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || (url.hostname !== directHost && !pooler)) {
    throw new Error('SUPABASE_DB_URL não aponta para o mesmo projeto das Edge Functions.');
  }
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/validate-supabase-target.mjs')) {
  try {
    validateSupabaseTarget({
      projectRef: process.env.PROJECT_REF,
      expectedProjectRef: process.env.EXPECTED_PROJECT_REF,
      databaseUrl: process.env.SUPABASE_DB_URL,
      accessToken: process.env.SUPABASE_ACCESS_TOKEN,
    });
    console.log('Destino e credenciais de deploy configurados.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
