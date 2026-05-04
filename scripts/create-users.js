// Dotenv removed, using --env-file
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  const users = [
    { email: 'admin@marcoskreps.com.br', password: 'Admin@MarcosKreps2026!', role: 'ADMIN', name: 'Administrador' },
    { email: 'atendente@marcoskreps.com.br', password: 'Atendente@MarcosKreps2026!', role: 'ATTENDANT', name: 'Atendente Teste' }
  ];

  for (const u of users) {
    console.log(`Creating user ${u.email}...`);
    const { data, error } = await supabase.auth.signUp({
      email: u.email,
      password: u.password
    });
    
    if (error) {
      console.error(`Error creating ${u.email}:`, error.message);
      continue;
    }
    
    console.log(`User created. ID: ${data.user.id}`);
    
    // Now insert into profiles
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: data.user.id,
        role: u.role,
        name: u.name,
        active: true
      });
      
    if (profileError) {
      console.error(`Error creating profile for ${u.email}:`, profileError.message);
    } else {
      console.log(`Profile created for ${u.email} (${u.role})`);
    }
  }
}

main();
