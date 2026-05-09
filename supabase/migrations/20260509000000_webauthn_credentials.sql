-- WebAuthn credentials table
-- Stores public keys registered via platform biometrics (Touch ID, Face ID, Windows Hello)
create table if not exists public.webauthn_credentials (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  credential_id text        not null unique,   -- base64url credential ID from authenticator
  public_key_jwk jsonb      not null,          -- EC P-256 public key in JWK format
  sign_count    bigint      not null default 0, -- anti-replay counter
  device_name   text,
  created_at    timestamptz not null default now()
);

alter table public.webauthn_credentials enable row level security;

create policy "users manage own webauthn credentials"
  on public.webauthn_credentials
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
