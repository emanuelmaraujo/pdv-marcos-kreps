/**
 * WebAuthn (Passkey) client utilities.
 * Works in Chrome, Firefox, Safari — triggers Touch ID, Face ID, Windows Hello.
 */

const LS_KEY = "pdv_webauthn_cred";

interface StoredCred {
  userId: string;
  email: string;
  credentialId: string;
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

/** Returns a guaranteed ArrayBuffer (not ArrayBufferLike) for use in WebAuthn APIs. */
function b64uToAB(s: string): ArrayBuffer {
  const u8 = b64uToBuf(s);
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

async function callFn(
  action: string,
  payload: Record<string, unknown>,
  accessToken?: string,
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/webauthn`,
    { method: "POST", headers, body: JSON.stringify({ action, ...payload }) },
  );
  const json: { data?: Record<string, unknown>; error?: string } = await res.json();
  if (json.error) throw new Error(json.error);
  return json.data!;
}

function getDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return "iPhone/iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  return "Dispositivo";
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** True if this browser supports platform biometrics (WebAuthn PublicKeyCredential). */
export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator.credentials?.create === "function"
  );
}

/** True if this device has a previously enrolled passkey stored in localStorage. */
export function hasEnrolledPasskey(): boolean {
  if (typeof localStorage === "undefined") return false;
  return !!localStorage.getItem(LS_KEY);
}

/** Read the stored credential info. */
export function getStoredCred(): StoredCred | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as StoredCred) : null;
  } catch {
    return null;
  }
}

/** Remove the stored passkey from localStorage (does not revoke from server). */
export function clearStoredPasskey(): void {
  localStorage.removeItem(LS_KEY);
}

/**
 * Enroll the current user's device biometric as a passkey.
 * Must be called while the user is logged in.
 * Triggers the OS biometric prompt (Touch ID / Face ID / Windows Hello).
 */
export async function enrollPasskey(
  userId: string,
  email: string,
  accessToken: string,
): Promise<void> {
  if (!isWebAuthnSupported()) throw new Error("WebAuthn não suportado neste navegador");

  // 1. Get registration options from server
  const opts = await callFn("register_begin", {}, accessToken);

  const rp = opts.rp as { id: string; name: string };
  const user = opts.user as { id: string; name: string; displayName: string };
  const pubKeyCredParams = opts.pubKeyCredParams as PublicKeyCredentialParameters[];
  const authenticatorSelection = opts.authenticatorSelection as AuthenticatorSelectionCriteria;

  // 2. Ask OS to create a credential (triggers biometric prompt)
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: new TextEncoder().encode(opts.challenge as string),
      rp,
      user: {
        id: b64uToAB(user.id), // ArrayBuffer required by WebAuthn API
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

  // 3. Send to server for verification & storage
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

  // 4. Persist locally so login page knows to show biometric button
  localStorage.setItem(
    LS_KEY,
    JSON.stringify({ userId, email, credentialId: cred.id } satisfies StoredCred),
  );
}

/**
 * Authenticate using a previously enrolled passkey.
 * Returns { token_hash, email } — use with supabase.auth.verifyOtp() to create a session.
 */
export async function authenticateWithPasskey(): Promise<{
  token_hash: string;
  email: string;
}> {
  if (!isWebAuthnSupported()) throw new Error("WebAuthn não suportado neste navegador");

  const stored = getStoredCred();
  if (!stored) throw new Error("Nenhuma digital registrada. Faça login e cadastre primeiro.");

  // 1. Get auth options (challenge + allowed credential IDs)
  const opts = await callFn("auth_begin", { userId: stored.userId });

  const allowCredentials = (
    opts.allowCredentials as Array<{ type: string; id: string }>
  ).map((c) => ({
    type: c.type as PublicKeyCredentialType,
    id: b64uToAB(c.id),
  }));

  // 2. Ask OS to sign the challenge (triggers biometric prompt)
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

  // 3. Verify assertion on server and get session token
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
