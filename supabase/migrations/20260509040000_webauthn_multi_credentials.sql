-- Supports up to 3 biometric credentials per user.
-- device_name already exists; we enforce the limit via a trigger.

-- Trigger function: reject insert when user already has 3 credentials
create or replace function public.check_webauthn_credential_limit()
returns trigger language plpgsql security definer as $$
declare
  existing_count integer;
begin
  select count(*) into existing_count
  from public.webauthn_credentials
  where user_id = NEW.user_id;

  if existing_count >= 3 then
    raise exception 'Limite de 3 digitais por usuário atingido. Remova uma digital antes de adicionar outra.';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_webauthn_credential_limit on public.webauthn_credentials;
create trigger trg_webauthn_credential_limit
  before insert on public.webauthn_credentials
  for each row execute function public.check_webauthn_credential_limit();
