-- Migration: adiciona user_handle em webauthn_credentials para suportar
-- login com passkey discoverable (cross-device).
--
-- Por que: o fluxo atual exige userId no client antes de iniciar a
-- autenticação. Em um dispositivo novo (ou de terceiros) o userId não
-- está no localStorage e o login com biometria nem aparece. Com passkeys
-- discoverable, o navegador devolve credential.id + userHandle e o
-- servidor precisa mapear credential→user direto.
--
-- user_handle é o mesmo userId codificado em base64url (mesma derivação do
-- registerBegin no edge function), salvo aqui para indexação rápida.

alter table webauthn_credentials
  add column if not exists user_handle text;

-- Backfill: para credenciais antigas, derivar user_handle = base64url(user_id)
-- O encoding tem que casar com bufToB64u no client e b64uEncode no edge function.
-- Como user_id é uuid (texto), encoding é direto: base64url do texto utf-8.
update webauthn_credentials
set user_handle = rtrim(replace(replace(
  encode(convert_to(user_id::text, 'UTF8'), 'base64'),
  '+', '-'), '/', '_'), '=')
where user_handle is null;

alter table webauthn_credentials
  alter column user_handle set not null;

-- Índice por user_handle pra resolver discoverable login em O(1).
create index if not exists idx_webauthn_credentials_user_handle
  on webauthn_credentials(user_handle);

comment on column webauthn_credentials.user_handle is
  'user_id codificado em base64url. Identifica o user a partir do credential.id no fluxo de passkey discoverable (sem userId no client).';
