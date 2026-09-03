// NEXUS — google-sheets-sync (v6)
// Lit, en lecture seule, un Google Sheet configuré pour le site de
// l'appelant. Deux sources, deux classeurs distincts :
//   • source=recettes (défaut) → station_config.google_sheet_id
//     Recettes journalières, pour éviter la ressaisie dans NEXUS Verify
//     (demande de Frédéric, 01/08/2026).
//   • source=planning            → station_config.planning_google_sheet_id
//     Planning mensuel de l'équipe (03/09/2026). Onglet par site et par
//     mois : <planning_onglet_prefixe><mois sur 2 chiffres>, ex. SMU09.
//
// Authentification : session NEXUS (JWT Supabase) réservée aux managers et
// gérants — pas de clé API externe ici, contrairement à api-v1/admin-api.
// L'identifiant du Google Sheet vient TOUJOURS de la base (par site), jamais
// du client : impossible de faire lire à cette fonction un autre classeur
// que celui configuré pour le site de l'appelant.
//
// Accès Google via compte de service (JWT RS256 signé ici, échangé contre un
// jeton OAuth2 auprès de Google) — scope 'spreadsheets.readonly' strict,
// jamais d'écriture vers Google. La clé privée du compte de service vit
// uniquement dans le secret GOOGLE_SERVICE_ACCOUNT_KEY (jamais dans ce
// fichier, jamais dans le dépôt Git).
//
// Historique des correctifs :
//   31/08/2026 — lecture bornée (A1:AZ300) + délais réseau bornés et retry,
//     afin qu'une lenteur Google ne laisse jamais l'interface attendre
//     indéfiniment.
//   03/09/2026 — paramètre `source`. Sans lui, comportement Verify
//     strictement inchangé.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_SERVICE_ACCOUNT_KEY = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// CORS — indispensable ici : NEXUS-Parametres-Station-v1.html et
// NEXUS-Verify-v1.html appellent cette fonction via fetch() direct (pas
// nexusClient.functions.invoke) avec un en-tête Authorization personnalisé,
// ce qui déclenche systématiquement une requête de pré-vérification OPTIONS
// côté navigateur. Sans ces en-têtes sur CHAQUE réponse (y compris OPTIONS),
// le navigateur bloque l'appel avant même qu'il n'atteigne cette fonction.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function errorResponse(code: string, message: string, status: number) {
  return jsonResponse({ error: { code, message, timestamp: new Date().toISOString() } }, status);
}

// ---------------------------------------------------------------
// Compte de service Google — JWT RS256 signé ici, échangé contre un
// access_token via l'endpoint OAuth2 standard de Google (flux
// "JWT Bearer" pour compte de service, sans écran de connexion humain).
// ---------------------------------------------------------------
function base64url(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let str = "";
  bytes.forEach((b) => { str += String.fromCharCode(b); });
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemBody = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binaryDer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

// Tout appel sortant vers Google est borné dans le temps et retenté une
// fois : sans cela, une lenteur Google laissait l'interface tourner sans
// fin, sans message ni possibilité d'abandon (correctif 31/08/2026).
async function fetchGoogle(url: string, init: RequestInit = {}, timeoutMs = 12000, retries = 1): Promise<Response> {
  let lastError: unknown = null;
  for (let tentative = 0; tentative <= retries; tentative++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if (resp.status >= 500 && tentative < retries) continue;
      return resp;
    } catch (e) {
      clearTimeout(timer);
      lastError = e;
      if (tentative >= retries) throw e;
    }
  }
  throw lastError || new Error("Google Sheets indisponible.");
}

function messageDelai(e: unknown, defaut: string): string {
  return e instanceof DOMException && e.name === "AbortError"
    ? defaut
    : String(e instanceof Error ? e.message : e);
}

let accessTokenCache: { token: string; expireLe: number } | null = null;

async function obtenirTokenGoogle(): Promise<string> {
  if (!GOOGLE_SERVICE_ACCOUNT_KEY) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY absent — secret non configuré côté Supabase.");
  }
  // Petit cache en mémoire (durée de vie de l'instance) pour éviter de
  // resigner un JWT à chaque appel — un token Google dure 1h.
  if (accessTokenCache && accessTokenCache.expireLe > Date.now() + 30_000) {
    return accessTokenCache.token;
  }
  const creds = JSON.parse(GOOGLE_SERVICE_ACCOUNT_KEY);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: creds.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const key = await importPrivateKey(creds.private_key);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  const assertion = `${signingInput}.${base64url(new Uint8Array(signature))}`;

  const resp = await fetchGoogle("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  }, 10000, 1);
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`Échec d'authentification Google : ${JSON.stringify(data)}`);
  }
  accessTokenCache = { token: data.access_token, expireLe: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

Deno.serve(async (req: Request) => {
  // Requête de pré-vérification CORS — le navigateur l'envoie avant tout
  // GET avec en-tête Authorization personnalisé. Doit être répondue avant
  // toute autre logique, sans authentification.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    if (req.method !== "GET") {
      return errorResponse("METHOD_NOT_ALLOWED", "Seul GET est supporté.", 405);
    }

    // ---- Identification de l'appelant (session NEXUS) ----
    const authHeader = req.headers.get("Authorization") || "";
    if (!/^Bearer\s+.+/i.test(authHeader)) {
      return errorResponse("UNAUTHORIZED", "Session NEXUS manquante.", 401);
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return errorResponse("UNAUTHORIZED", "Session NEXUS invalide ou expirée.", 401);
    }

    const { data: employee, error: empErr } = await sb
      .from("employees")
      .select("id, role, site_id, actif")
      .eq("id", userData.user.id)
      .single();
    if (empErr || !employee || !employee.actif) {
      return errorResponse("UNAUTHORIZED", "Employé introuvable ou inactif.", 401);
    }
    if (employee.role !== "manager" && employee.role !== "gerant") {
      return errorResponse("FORBIDDEN", "Réservé aux managers et gérants.", 403);
    }

    const url = new URL(req.url);
    const source = (url.searchParams.get("source") || "recettes").toLowerCase();
    if (source !== "recettes" && source !== "planning") {
      return errorResponse("BAD_REQUEST", "Paramètre 'source' invalide : attendu 'recettes' ou 'planning'.", 400);
    }

    // ---- Classeur configuré pour CE site (jamais fourni par le client) ----
    const { data: config, error: cfgErr } = await sb
      .from("station_config")
      .select("google_sheet_id, planning_google_sheet_id, planning_onglet_prefixe")
      .eq("site", employee.site_id)
      .maybeSingle();
    if (cfgErr) return errorResponse("INTERNAL_ERROR", cfgErr.message, 500);

    const sheetId = source === "planning" ? config?.planning_google_sheet_id : config?.google_sheet_id;
    if (!sheetId) {
      return errorResponse(
        "NOT_CONFIGURED",
        source === "planning"
          ? "Aucun classeur de planning configuré pour ce site — à renseigner dans Paramètres Station."
          : "Aucun Google Sheet configuré pour ce site — à renseigner dans Paramètres Station.",
        400,
      );
    }

    const sheetParam = url.searchParams.get("sheet");
    if (!sheetParam) {
      return errorResponse("MISSING_FIELD", "Paramètre 'sheet' manquant (nom de la feuille, ou '__list__').", 400);
    }

    let accessToken: string;
    try {
      accessToken = await obtenirTokenGoogle();
    } catch (e) {
      return errorResponse("GOOGLE_AUTH_ERROR", messageDelai(e, "Google met trop de temps à répondre. Réessayez dans quelques secondes."), 502);
    }

    // ---- Mode liste : renvoie les noms des feuilles du classeur ----
    // Le préfixe d'onglet de planning est renvoyé tel qu'il est enregistré,
    // pour que l'écran de paramétrage puisse cocher lui-même l'onglet du
    // mois — NEXUS ne devine jamais ce préfixe (article 5).
    if (sheetParam === "__list__") {
      try {
        const metaResp = await fetchGoogle(
          `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}?fields=properties.title,sheets.properties.title`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
          12000,
          1,
        );
        const metaData = await metaResp.json();
        if (!metaResp.ok) {
          return errorResponse(
            "GOOGLE_API_ERROR",
            metaData?.error?.message || "Erreur Google Sheets API — vérifiez que le classeur est bien partagé avec le compte de service.",
            502,
          );
        }
        return jsonResponse({
          classeur: metaData.properties?.title || null,
          sheets: (metaData.sheets || []).map((s: { properties: { title: string } }) => s.properties.title),
          prefixePlanning: config?.planning_onglet_prefixe || null,
        });
      } catch (e) {
        return errorResponse("GOOGLE_TIMEOUT", messageDelai(e, "Google Sheets met trop de temps à répondre. Réessayez dans quelques secondes."), 504);
      }
    }

    // ---- Mode lecture d'une feuille ----
    // Lecture bornée : un onglet mal formé ou très large ne doit jamais
    // faire exploser le temps de réponse (correctif 31/08/2026).
    const escapedSheet = sheetParam.replace(/'/g, "''");
    const boundedRange = `'${escapedSheet}'!A1:AZ300`;
    // Recettes : valeurs BRUTES. Les dates reviennent en numéro de série
    // (jours depuis le 30/12/1899) ; c'est NEXUS Verify, côté client, qui
    // sait quelle colonne est la date grâce à l'en-tête et qui convertit.
    // Planning : valeurs FORMATÉES. Les dates y sont écrites à la main
    // ("1/9/2026") et doivent rester lisibles telles quelles — le lecteur
    // de planning ne saurait pas réinterpréter un numéro de série.
    const renderOption = source === "planning" ? "FORMATTED_VALUE" : "UNFORMATTED_VALUE";
    try {
      const valuesResp = await fetchGoogle(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(boundedRange)}?valueRenderOption=${renderOption}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
        12000,
        1,
      );
      const valuesData = await valuesResp.json();
      if (!valuesResp.ok) {
        return errorResponse("GOOGLE_API_ERROR", valuesData?.error?.message || "Erreur Google Sheets API.", 502);
      }
      return jsonResponse({ values: valuesData.values || [], range: boundedRange, source });
    } catch (e) {
      return errorResponse("GOOGLE_TIMEOUT", messageDelai(e, "Google Sheets met trop de temps à répondre. Réessayez dans quelques secondes."), 504);
    }
  } catch (e) {
    return errorResponse("INTERNAL_ERROR", String(e instanceof Error ? e.message : e), 500);
  }
});
