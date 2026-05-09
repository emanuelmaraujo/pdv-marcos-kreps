/**
 * WebAuthn (Passkey) client utilities.
 * Works in Chrome, Firefox, Safari — triggers Touch ID, Face ID, Windows Hello.
 * Supports up to 3 credentials per user.
 */

const LS_KEY = "pdv_webauthn_user";

interface StoredUser {
  userId: string;
  email: string;
}

export interface ServerCredential {
  id: string;           // UUID row id
  credential_id: string;
  device_name: string;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bufToB64u(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function b64uToBuf(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

function b64uToAB(s: string): ArrayBuffer {
  const u8 = b64uToBuf(s);
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

async function callFn(
  action: string,
  payload: Record<string, unknown>,
  accessToken?: string,
): Promise<Record<string, unknown>> {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "apikey": anonKey,
    "Authorization": `Bearer ${accessToken ?? anonKey}`,
  };
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/webauthn`,
    { method: "POST", headers, body: JSON.stringify({ action, ...payload }) },
  );
  const json = await res.json().catch(() => ({})) as {
    data?: Record<string, unknown>;
    error?: string;
    message?: string;
  };
  if (!res.ok || json.error || json.message) {
    throw new Error(json.error ?? json.message ?? `Erro ${res.status}`);
  }
  if (!json.data) throw new Error("Resposta inválida do servidor");
  return json.data;
}

function getDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return "iPhone/iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  return "Dispositivo";
}

// ─── Local storage ────────────────────────────────────────────────────────────

export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator.credentials?.create === "function"
  );
}

export function hasEnrolledPasskey(): boolean {
  if (typeof localStorage === "undefined") return false;
  return !!localStorage.getItem(LS_KEY);
}

export function getStoredUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    // Support legacy format that also had credentialId field
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

/** @deprecated use getStoredUser() */
export function getStoredCred() {
  return getStoredUser();
}

export function clearStoredPasskey(): void {
  localStorage.removeItem(LS_KEY);
}

// ─── Enrollment ───────────────────────────────────────────────────────────────

/**
 * Enroll a new biometric credential for the currently logged-in user.
 * Does NOT invalidate the current session.
 * Throws if the user already has 3 credentials (enforced server-side).
 */
export async function enrollPasskey(
  userId: string,
  email: string,
  accessToken: string,
): Promise<void> {
  if (!isWebAuthnSupported()) throw new Error("WebAuthn não suportado neste navegador");

  const opts = await callFn("register_begin", {}, accessToken);

  const rp = opts.rp as { id: string; name: string };
  const user = opts.user as { id: string; name: string; displayName: string };
  const pubKeyCredParams = opts.pubKeyCredParams as PublicKeyCredentialParameters[];
  const authenticatorSelection = opts.authenticatorSelection as AuthenticatorSelectionCriteria;

  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: new TextEncoder().encode(opts.challenge as string),
      rp,
      user: {
        id: b64uToAB(user.id),
        name: user.name,
        displayName: user.displayName,
      },
      pubKeyCredParams,
      timeout: opts.timeout as number,
      attestation: "none",
      authenticatorSelection,
    },
  })) as PublicKeyCredential | null;

  if (!cred) throw new Error("Cadastro cancelado pelo usuário");
  const response = cred.response as AuthenticatorAttestationResponse;

  await callFn(
    "register_complete",
    {
      challenge: opts.challenge,
      credential: {
        id: cred.id,
        response: {
          clientDataJSON: bufToB64u(response.clientDataJSON),
          attestationObject: bufToB64u(response.attestationObject),
        },
      },
      deviceName: getDeviceName(),
    },
    accessToken,
  );

  // Persist userId so the login page knows to show the biometric button.
  // We don't store the credentialId here — the server tracks all enrolled credentials.
  localStorage.setItem(LS_KEY, JSON.stringify({ userId, email } satisfies StoredUser));
}

// ─── Authentication ───────────────────────────────────────────────────────────

export async function authenticateWithPasskey(): Promise<{
  token_hash: string;
  email: string;
}> {
  if (!isWebAuthnSupported()) throw new Error("WebAuthn não suportado neste navegador");

  const stored = getStoredUser();
  if (!stored) throw new Error("Nenhuma digital registrada. Faça login e cadastre primeiro.");

  const opts = await callFn("auth_begin", { userId: stored.userId });
  if (!opts.allowCredentials) throw new Error("Sem credenciais registradas para este usuário");

  const allowCredentials = (
    opts.allowCredentials as Array<{ type: string; id: string }>
  ).map((c) => ({
    type: c.type as PublicKeyCredentialType,
    id: b64uToAB(c.id),
  }));

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: new TextEncoder().encode(opts.challenge as string),
      rpId: opts.rpId as string,
      timeout: opts.timeout as number,
      userVerification: opts.userVerification as UserVerificationRequirement,
      allowCredentials,
    },
  })) as PublicKeyCredential | null;

  if (!assertion) throw new Error("Autenticação cancelada pelo usuário");
  const response = assertion.response as AuthenticatorAssertionResponse;

  const result = await callFn("auth_complete", {
    userId: stored.userId,
    challenge: opts.challenge,
    credential: {
      id: assertion.id,
      response: {
        clientDataJSON: bufToB64u(response.clientDataJSON),
        authenticatorData: bufToB64u(response.authenticatorData),
        signature: bufToB64u(response.signature),
      },
    },
  });

  return result as { token_hash: string; email: string };
}

// ─── Management ───────────────────────────────────────────────────────────────

/** Lists all enrolled credentials from the server. Requires an active session token. */
export async function listServerCredentials(accessToken: string): Promise<ServerCredential[]> {
  const result = await callFn("list_credentials", {}, accessToken);
  return (result.credentials as ServerCredential[]) ?? [];
}

/** Deletes a specific credential by its DB row UUID. Requires an active session token. */
export async function deleteServerCredential(
  credentialRowId: string,
  accessToken: string,
): Promise<void> {
  await callFn("delete_credential", { credentialRowId }, accessToken);
}
