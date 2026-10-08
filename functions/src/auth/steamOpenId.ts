import { randomUUID } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { db } from "../config/firebase.js";
import { callableOptions } from "../config/runtime.js";
import { collections } from "../domain/collections.js";

const STEAM_OPENID_ENDPOINT = "https://steamcommunity.com/openid/login";
const OPENID_NS = "http://specs.openid.net/auth/2.0";
const IDENTIFIER_SELECT = `${OPENID_NS}/identifier_select`;
const STATE_TTL_MS = 5 * 60 * 1000;

type SteamAuthState = {
  origin: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
};

function projectId(): string {
  return process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT ?? "league-of-friends-cc274";
}

function isEmulator(): boolean {
  return process.env.FUNCTIONS_EMULATOR === "true" || Boolean(process.env.FIRESTORE_EMULATOR_HOST);
}

function callbackUrl(state: string): string {
  const project = projectId();
  const base = isEmulator()
    ? `http://127.0.0.1:5001/${project}/europe-west1/steamAuthCallback`
    : `https://europe-west1-${project}.cloudfunctions.net/steamAuthCallback`;
  const url = new URL(base);
  url.searchParams.set("state", state);
  return url.toString();
}

function allowedOrigins(): Set<string> {
  const project = projectId();
  const configured = (process.env.STEAM_AUTH_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set([
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    `https://${project}.web.app`,
    `https://${project}.firebaseapp.com`,
    ...configured,
  ]);
}

function requireAllowedOrigin(value: string | undefined): string {
  if (!value || !allowedOrigins().has(value)) {
    throw new HttpsError(
      "permission-denied",
      "Steam sign-in is not enabled for this website origin.",
    );
  }
  return value;
}

function steamSignInUrl(returnTo: string, realm: string): string {
  const url = new URL(STEAM_OPENID_ENDPOINT);
  url.searchParams.set("openid.ns", OPENID_NS);
  url.searchParams.set("openid.mode", "checkid_setup");
  url.searchParams.set("openid.return_to", returnTo);
  url.searchParams.set("openid.realm", realm);
  url.searchParams.set("openid.identity", IDENTIFIER_SELECT);
  url.searchParams.set("openid.claimed_id", IDENTIFIER_SELECT);
  return url.toString();
}

function callbackOrigin(): string {
  const url = new URL(callbackUrl("placeholder"));
  return url.origin;
}

export const beginSteamSignIn = onCall(callableOptions, async (request) => {
  const origin = requireAllowedOrigin(request.rawRequest.get("origin") ?? undefined);
  const state = randomUUID();
  const now = Timestamp.now();
  await db.collection(collections.steamAuthStates).doc(state).create({
    origin,
    createdAt: now,
    expiresAt: Timestamp.fromMillis(now.toMillis() + STATE_TTL_MS),
  } satisfies SteamAuthState);

  return {
    authUrl: steamSignInUrl(callbackUrl(state), callbackOrigin()),
    callbackOrigin: callbackOrigin(),
  };
});

function openIdParams(requestUrl: string): URLSearchParams {
  const url = new URL(requestUrl, "http://localhost");
  const params = new URLSearchParams();
  for (const [key, value] of url.searchParams.entries()) {
    if (key.startsWith("openid.")) params.append(key, value);
  }
  params.set("openid.mode", "check_authentication");
  return params;
}

async function verifySteamAssertion(requestUrl: string, expectedReturnTo: string): Promise<string> {
  const url = new URL(requestUrl, "http://localhost");
  if (url.searchParams.get("openid.mode") !== "id_res") {
    throw new Error("Steam did not return an identity assertion.");
  }
  if (url.searchParams.get("openid.return_to") !== expectedReturnTo) {
    throw new Error("Steam returned an unexpected callback address.");
  }
  if (url.searchParams.get("openid.op_endpoint") !== STEAM_OPENID_ENDPOINT) {
    throw new Error("Steam returned an unexpected OpenID endpoint.");
  }

  const claimedId = url.searchParams.get("openid.claimed_id") ?? "";
  const match = claimedId.match(/^https?:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/);
  if (!match) throw new Error("Steam did not return a valid SteamID64.");

  const verification = await fetch(STEAM_OPENID_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: openIdParams(requestUrl).toString(),
    signal: AbortSignal.timeout(10000),
  });
  if (!verification.ok) {
    throw new Error("Steam could not verify this sign-in.");
  }
  const body = await verification.text();
  if (!/(?:^|\n)is_valid:true(?:\n|$)/.test(body)) {
    throw new Error("Steam rejected this sign-in assertion.");
  }
  return match[1];
}

async function ensureFirebaseSteamUser(steamId64: string): Promise<string> {
  const uid = `steam:${steamId64}`;
  const auth = getAuth();
  try {
    await auth.getUser(uid);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "auth/user-not-found") throw error;
    try {
      await auth.createUser({ uid, displayName: `Steam ${steamId64}` });
    } catch (createError) {
      if ((createError as { code?: string }).code !== "auth/uid-already-exists") throw createError;
    }
  }
  return auth.createCustomToken(uid, {
    provider: "steam",
    steamId64,
  });
}

function safeJson(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function popupPage(origin: string | null, payload: Record<string, unknown>): string {
  const target = origin ?? "*";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Age of Friends · Steam sign-in</title></head><body><p>Returning to Age of Friends…</p><script>
    const payload=${safeJson(payload)};
    if(window.opener){window.opener.postMessage(payload,${safeJson(target)});window.close();}
    else{document.body.textContent=payload.type==='aof-steam-auth'?'Steam sign-in complete. Return to Age of Friends.':'Steam sign-in failed. Return to Age of Friends and try again.';}
  </script></body></html>`;
}

export const steamAuthCallback = onRequest(
  { region: "europe-west1" },
  async (request, response) => {
    response.set("Cache-Control", "no-store");
    response.set(
      "Content-Security-Policy",
      "default-src 'none'; script-src 'unsafe-inline'; style-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    );

    const state = typeof request.query.state === "string" ? request.query.state : "";
    if (!state) {
      response.status(400).send(popupPage(null, { type: "aof-steam-auth-error", message: "Missing sign-in state." }));
      return;
    }

    const stateRef = db.collection(collections.steamAuthStates).doc(state);
    // Claim once before external verification; concurrent callbacks cannot reuse it.
    const authState = await db.runTransaction(async transaction => {
      const stateDoc = await transaction.get(stateRef);
      if (!stateDoc.exists) return null;
      transaction.delete(stateRef);
      return stateDoc.data() as SteamAuthState;
    });
    if (!authState) {
      response.status(400).send(popupPage(null, { type: "aof-steam-auth-error", message: "This sign-in has expired." }));
      return;
    }

    if (!(authState.expiresAt instanceof Timestamp) || authState.expiresAt.toMillis() < Date.now()) {
      response.status(400).send(popupPage(authState.origin ?? null, { type: "aof-steam-auth-error", message: "This sign-in has expired." }));
      return;
    }

    try {
      const expectedReturnTo = callbackUrl(state);
      const steamId64 = await verifySteamAssertion(request.originalUrl, expectedReturnTo);
      const token = await ensureFirebaseSteamUser(steamId64);
      response.status(200).send(popupPage(authState.origin, {
        type: "aof-steam-auth",
        token,
        steamId64,
      }));
    } catch (error) {
      response.status(401).send(popupPage(authState.origin, {
        type: "aof-steam-auth-error",
        message: error instanceof Error ? error.message : "Steam sign-in failed.",
      }));
    }
  },
);
