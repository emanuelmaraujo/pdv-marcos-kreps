import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// RP_ID must match the effective domain of the app (no port, no scheme)
const RP_ID = Deno.env.get("WEBAUTHN_RP_ID") ?? "pdv-marcos-kreps.vercel.app";
const RP_NAME = "Marcos Krep's PDV";
const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ─── Base64url helpers ───────────────────────────────────────────────────────

function b64uEncode(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function b64uDecode(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

// ─── Minimal CBOR decoder (uint, negint, bytestr, textstr, map) ──────────────

function parseCBOR(data: Uint8Array, off = 0): [unknown, number] {
  const byte = data[off];
  const maj = byte >> 5;
  const inf = byte & 0x1f;
  off++;

  // Unsigned int
  if (maj === 0) {
    if (inf < 24) return [inf, off];
    if (inf === 24) return [data[off], off + 1];
    if (inf === 25) return [(data[off] << 8) | data[off + 1], off + 2];
    throw new Error(`CBOR: unsupported uint additional ${inf}`);
  }
  // Negative int
  if (maj === 1) {
    if (inf < 24) return [-1 - inf, off];
    if (inf === 24) return [-1 - data[off], off + 1];
    throw new Error(`CBOR: unsupported negint additional ${inf}`);
  }
  // Byte string
  if (maj === 2) {
    let len: number;
    if (inf < 24) len = inf;
    else if (inf === 24) { len = data[off++]; }
    else if (inf === 25) { len = (data[off] << 8) | data[off + 1]; off += 2; }
    else throw new Error(`CBOR: unsupported bytestr additional ${inf}`);
    return [data.slice(off, off + len), off + len];
  }
  // Text string
  if (maj === 3) {
    let len: number;
    if (inf < 24) len = inf;
    else if (inf === 24) { len = data[off++]; }
    else if (inf === 25) { len = (data[off] << 8) | data[off + 1]; off += 2; }
    else throw new Error(`CBOR: unsupported textstr additional ${inf}`);
    return [new TextDecoder().decode(data.slice(off, off + len)), off + len];
  }
  // Map
  if (maj === 5) {
    let count: number;
    if (inf < 24) count = inf;
    else if (inf === 24) { count = data[off++]; }
    else throw new Error(`CBOR: unsupported map additional ${inf}`);
    const map = new Map<unknown, unknown>();
    for (let i = 0; i < count; i++) {
      const [k, o1] = parseCBOR(data, off);
      const [v, o2] = parseCBOR(data, o1);
      map.set(k, v); off = o2;
    }
    return [map, off];
  }
  // Array (skip entries, used in some attestation formats)
  if (maj === 4) {
    let count: number;
    if (inf < 24) count = inf;
    else if (inf === 24) { count = data[off++]; }
    else throw new Error(`CBOR: unsupported array additional ${inf}`);
    const arr: unknown[] = [];
    for (let i = 0; i < count; i++) {
      const [v, o] = parseCBOR(data, off); arr.push(v); off = o;
    }
    return [arr, off];
  }
  throw new Error(`CBOR: unsupported major type ${maj}`);
}

// ─── COSE EC2 (ES256) public key → JWK ──────────────────────────────────────

function coseToJwk(m: Map<unknown, unknown>): JsonWebKey {
  if (m.get(1) !== 2 || m.get(3) !== -7) throw new Error("Only ES256 (P-256) is supported");
  const x = m.get(-2) as Uint8Array;
  const y = m.get(-3) as Uint8Array;
  if (!x || !y || x.length !== 32 || y.length !== 32) throw new Error("Invalid EC2 coordinates");
  return { kty: "EC", crv: "P-256", x: b64uEncode(x), y: b64uEncode(y) };
}

// ─── Parse WebAuthn authenticatorData ───────────────────────────────────────

interface AuthData {
  rpIdHash: Uint8Array;
  flags: number;
  signCount: number;
  credentialId?: Uint8Array;
  publicKeyJwk?: JsonWebKey;
}

function parseAuthData(buf: Uint8Array): AuthData {
  const view = new DataView(buf.buffer, buf.byteOffset);
  const rpIdHash = buf.slice(0, 32);
  const flags = buf[32];
  const signCount = view.getUint32(33, false);
  const result: AuthData = { rpIdHash, flags, signCount };

  if (flags & 0x40) { // Attested credential data present
    const credIdLen = (buf[53] << 8) | buf[54];
    result.credentialId = buf.slice(55, 55 + credIdLen);
    const [coseKey] = parseCBOR(buf.slice(55 + credIdLen)) as [Map<unknown, unknown>, number];
    result.publicKeyJwk = coseToJwk(coseKey);
  }
  return result;
}

// ─── Verify ECDSA assertion signature ────────────────────────────────────────

async function verifyAssertion(
  jwk: JsonWebKey,
  signature: Uint8Array,
  authData: Uint8Array,
  clientDataJSON: Uint8Array,
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"],
  );
  const hash = await crypto.subtle.digest("SHA-256", clientDataJSON);
  const signed = new Uint8Array(authData.length + 32);
  signed.set(authData); signed.set(new Uint8Array(hash), authData.length);
  return crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, signature, signed);
}

// ─── HMAC challenge (no DB needed) ───────────────────────────────────────────
// Format: base64url( utf8("timestamp:userId") ) + "." + base64url( HMAC )

async function generateChallenge(userId: string): Promise<string> {
  const payload = `${Date.now()}:${userId}`;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(SUPABASE_SERVICE_ROLE_KEY),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${b64uEncode(new TextEncoder().encode(payload))}.${b64uEncode(new Uint8Array(sig))}`;
}

async function verifyChallenge(challenge: string, userId: string): Promise<boolean> {
  try {
    const dot = challenge.lastIndexOf(".");
    if (dot < 0) return false;
    const payloadB64 = challenge.slice(0, dot);
    const sigB64 = challenge.slice(dot + 1);
    const payloadBytes = b64uDecode(payloadB64);
    const payload = new TextDecoder().decode(payloadBytes);
    const [ts, uid] = payload.split(":");
    if (uid !== userId) return false;
    if (Date.now() - parseInt(ts) > CHALLENGE_TTL_MS) return false;
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(SUPABASE_SERVICE_ROLE_KEY),
      { name: "HMAC", hash: "SHA-256" }, false, ["verify"],
    );
    return crypto.subtle.verify("HMAC", key, b64uDecode(sigB64), payloadBytes);
  } catch { return false; }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function arrayEq(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

function isAllowedOrigin(origin: string): boolean {
  if (origin === `https://${RP_ID}`) return true;
  if (origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1")) return true;
  // Allow Vercel preview URLs for the same project
  if (origin.endsWith(".vercel.app")) return true;
  return false;
}

// ─── Action handlers ─────────────────────────────────────────────────────────

async function registerBegin(userId: string) {
  const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !user) throw new Error("Usuário não encontrado");

  const challenge = await generateChallenge(userId);
  return {
    challenge,
    rp: { id: RP_ID, name: RP_NAME },
    user: {
      id: b64uEncode(new TextEncoder().encode(userId)),
      name: user.email!,
      displayName: user.email!,
    },
    pubKeyCredParams: [{ type: "public-key", alg: -7 }], // ES256 only
    timeout: 60000,
    attestation: "none",
    authenticatorSelection: {
      authenticatorAttachment: "platform", // built-in biometric only
      userVerification: "required",
      residentKey: "preferred",
    },
  };
}

async function registerComplete(
  userId: string,
  challenge: string,
  credential: {
    id: string;
    response: { clientDataJSON: string; attestationObject: string };
  },
  deviceName?: string,
) {
  if (!await verifyChallenge(challenge, userId)) throw new Error("Challenge inválido ou expirado");

  const clientDataJSON = b64uDecode(credential.response.clientDataJSON);
  const clientData = JSON.parse(new TextDecoder().decode(clientDataJSON));

  if (clientData.type !== "webauthn.create") throw new Error("Tipo de credencial inválido");
  if (!isAllowedOrigin(clientData.origin)) throw new Error(`Origem inválida: ${clientData.origin}`);

  // Verify challenge embedded in clientData
  const clientChallenge = new TextDecoder().decode(b64uDecode(clientData.challenge));
  if (clientChallenge !== challenge) throw new Error("Challenge não corresponde");

  // Parse attestation object (CBOR)
  const attObjBytes = b64uDecode(credential.response.attestationObject);
  const [attMap] = parseCBOR(attObjBytes) as [Map<unknown, unknown>, number];
  const authDataBytes = attMap.get("authData") as Uint8Array;
  const authData = parseAuthData(authDataBytes);

  if (!authData.credentialId || !authData.publicKeyJwk) {
    throw new Error("Dados de credencial ausentes no authData");
  }
  if (!(authData.flags & 0x01)) throw new Error("Usuário não presente (UP=0)");
  if (!(authData.flags & 0x04)) throw new Error("Usuário não verificado (UV=0) — biometria obrigatória");

  // Verify RP ID hash
  const rpIdHash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(RP_ID)));
  if (!arrayEq(authData.rpIdHash, rpIdHash)) throw new Error("RP ID hash não corresponde");

  const credentialId = b64uEncode(authData.credentialId);

  const { error } = await supabaseAdmin.from("webauthn_credentials").insert({
    user_id: userId,
    credential_id: credentialId,
    public_key_jwk: authData.publicKeyJwk,
    sign_count: authData.signCount,
    device_name: deviceName ?? "Dispositivo",
  });
  if (error) throw new Error(`Erro ao salvar credencial: ${error.message}`);

  return { credentialId };
}

async function authBegin(userId: string) {
  const { data: creds, error } = await supabaseAdmin
    .from("webauthn_credentials")
    .select("credential_id")
    .eq("user_id", userId);
  if (error) throw error;
  if (!creds?.length) throw new Error("Nenhuma credencial registrada para este usuário");

  const challenge = await generateChallenge(userId);
  return {
    challenge,
    rpId: RP_ID,
    timeout: 60000,
    userVerification: "required",
    allowCredentials: creds.map((c) => ({ type: "public-key", id: c.credential_id })),
    userId,
  };
}

async function authComplete(
  userId: string,
  challenge: string,
  credential: {
    id: string;
    response: {
      clientDataJSON: string;
      authenticatorData: string;
      signature: string;
    };
  },
) {
  if (!await verifyChallenge(challenge, userId)) throw new Error("Challenge inválido ou expirado");

  const clientDataJSON = b64uDecode(credential.response.clientDataJSON);
  const clientData = JSON.parse(new TextDecoder().decode(clientDataJSON));

  if (clientData.type !== "webauthn.get") throw new Error("Tipo inválido");
  if (!isAllowedOrigin(clientData.origin)) throw new Error(`Origem inválida: ${clientData.origin}`);

  const clientChallenge = new TextDecoder().decode(b64uDecode(clientData.challenge));
  if (clientChallenge !== challenge) throw new Error("Challenge não corresponde");

  // Load stored credential
  const { data: stored, error: credErr } = await supabaseAdmin
    .from("webauthn_credentials")
    .select("*")
    .eq("credential_id", credential.id)
    .eq("user_id", userId)
    .single();
  if (credErr || !stored) throw new Error("Credencial não encontrada");

  const authDataBytes = b64uDecode(credential.response.authenticatorData);
  const signature = b64uDecode(credential.response.signature);

  // Verify RP ID hash
  const rpIdHash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(RP_ID)));
  if (!arrayEq(authDataBytes.slice(0, 32), rpIdHash)) throw new Error("RP ID hash não corresponde");

  // Verify UP + UV flags
  const flags = authDataBytes[32];
  if (!(flags & 0x01)) throw new Error("Usuário não presente");
  if (!(flags & 0x04)) throw new Error("Usuário não verificado — biometria obrigatória");

  // Verify signature
  const valid = await verifyAssertion(stored.public_key_jwk, signature, authDataBytes, clientDataJSON);
  if (!valid) throw new Error("Assinatura inválida");

  // Anti-replay: sign count
  const view = new DataView(authDataBytes.buffer, authDataBytes.byteOffset);
  const newCount = view.getUint32(33, false);
  if (newCount > 0 && newCount <= stored.sign_count) throw new Error("Possível replay detectado");
  await supabaseAdmin.from("webauthn_credentials").update({ sign_count: newCount }).eq("id", stored.id);

  // Create a Supabase session without sending email (admin generateLink)
  const { data: { user }, error: userErr } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (userErr || !user) throw new Error("Usuário não encontrado");

  const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: user.email!,
  });
  if (linkErr || !linkData) throw new Error(`Erro ao criar sessão: ${linkErr?.message}`);

  return {
    token_hash: linkData.properties.hashed_token,
    email: user.email,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, ...data } = body;

    let result: unknown;

    if (action === "register_begin" || action === "register_complete") {
      // Requires authenticated user — validate the Bearer JWT using the admin client
      const authHeader = req.headers.get("authorization") ?? "";
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !user) throw new Error("Não autorizado");

      if (action === "register_begin") {
        result = await registerBegin(user.id);
      } else {
        result = await registerComplete(user.id, data.challenge, data.credential, data.deviceName);
      }
    } else if (action === "auth_begin") {
      result = await authBegin(data.userId);
    } else if (action === "auth_complete") {
      result = await authComplete(data.userId, data.challenge, data.credential);
    } else {
      throw new Error(`Ação desconhecida: ${action}`);
    }

    return new Response(JSON.stringify({ data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
