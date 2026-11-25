// Edge Function `connexion` — connexion par prénom + code court, avec verrouillage par compte et par IP.
// Test uniquement. verify_jwt=false (l'appelant n'a pas encore de session) : POST seul, origines déclarées seules,
// corps mal formé ou refus = même réponse neutre. Secrets (jamais journalisés, jamais passés à Postgres) :
//   AUTH_MASTER_SECRET, PEPPER, IP_FP_SECRET ; ORIGINES_AUTORISEES (liste séparée par des virgules) ; PLANCHER_MS (durée minimale d'une réponse).
// IP : seul l'en-tête `cf-connecting-ip` est lu. Absent => seau unique « inconnue ». Forwarded, X-Real-IP et x-forwarded-for ne sont jamais lus.
import { createClient } from "npm:@supabase/supabase-js@2";
import postgres from "npm:postgres@3";
import bcrypt from "npm:bcryptjs@2";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MASTER = Deno.env.get("AUTH_MASTER_SECRET") ?? "";
const PEPPER = Deno.env.get("PEPPER") ?? "";
const IP_FP = Deno.env.get("IP_FP_SECRET") ?? "";
const ORIGINES = (Deno.env.get("ORIGINES_AUTORISEES") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const PLANCHER_MS = Number(Deno.env.get("PLANCHER_MS") ?? "2000");
const COST = 12;
// Hachage bcrypt factice (coût 12, non secret) : sert au travail identique quand le compte est inconnu ou refusé.
const FACTICE = "$2a$12$muBEER0PLRNyF6EUFgOmh.UT62dSczRUIq/QqJc7N8dn18Cd649Iy";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 1, idle_timeout: 20 });
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = () => createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
const enc = new TextEncoder();

async function hmac(secret: string, msg: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(msg)));
}
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const hex = (u: Uint8Array) => Array.from(u).map((x) => x.toString(16).padStart(2, "0")).join("");

const empreinteIp = async (ip: string | null) => (ip ? hex(await hmac(IP_FP, "ip:" + ip)).slice(0, 32) : "inconnue");
const motDePasseDerive = async (uid: string, version: number) => b64(await hmac(MASTER, `${uid}:${version}`));
const entreeCode = async (alias: string, code: string) => b64(await hmac(PEPPER, `${alias}:${code}`));
const hasher = async (alias: string, code: string) => await bcrypt.hash(await entreeCode(alias, code), COST);
const comparer = async (alias: string, code: string, h: string) => await bcrypt.compare(await entreeCode(alias, code), h);

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

function entetes(origin: string | null): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json", "cache-control": "no-store", vary: "Origin" };
  if (origin && ORIGINES.includes(origin)) {
    h["access-control-allow-origin"] = origin;
    h["access-control-allow-headers"] = "content-type, authorization, apikey, x-client-info";
    h["access-control-allow-methods"] = "POST, OPTIONS";
  }
  return h;
}
const rep = (status: number, body: unknown, origin: string | null) => new Response(JSON.stringify(body), { status, headers: entetes(origin) });
const REFUS = { ok: false, erreur: "refus" };

// Toute réponse, succès comme refus, dure au moins PLANCHER_MS : la durée ne distingue ni compte inconnu, ni compte verrouillé, ni mauvais code.
async function avecPlancher(debut: number, p: Promise<Response>): Promise<Response> {
  let r: Response;
  try { r = await p; } catch (e) { console.log("erreur interne", (e as Error)?.name ?? "?"); r = new Response(JSON.stringify(REFUS), { status: 401, headers: { "content-type": "application/json", "cache-control": "no-store" } }); }
  const reste = PLANCHER_MS - (performance.now() - debut);
  if (reste > 0) await attendre(reste);
  return r;
}

type Ctx = { origin: string | null; fp: string };

async function session(email: string, mdp: string) {
  const { data, error } = await anon().auth.signInWithPassword({ email, password: mdp });
  if (error || !data.session) return null;
  const s = data.session;
  return { access_token: s.access_token, refresh_token: s.refresh_token, expires_in: s.expires_in, token_type: s.token_type };
}

async function connexion(body: any, c: Ctx): Promise<Response> {
  const prenom = body?.prenom, code = body?.code;
  const valide = typeof prenom === "string" && prenom.length > 0 && prenom.length <= 60 && typeof code === "string" && code.length > 0 && code.length <= 32;
  if (!valide) { await bcrypt.compare("x", FACTICE); return rep(401, REFUS, c.origin); }

  // Plafond de connexions réussies depuis l'IP de sortie : pour tout le monde, avant tout calcul propre au compte.
  const cs = (await sql`select nexus_connexion.compter_succes() as r`)[0].r;
  if (cs.sature) return rep(503, { ok: false, erreur: "indisponible" }, c.origin);

  const av = (await sql`select nexus_connexion.avant_essai(${prenom}, ${c.fp}) as r`)[0].r;
  const uid: string | null = av.user_id ?? null;
  const alias: string = av.alias;
  if (av.decision !== "ok" || !uid || !av.etat) { await bcrypt.compare("x", FACTICE); return rep(401, REFUS, c.origin); }

  const email = `${alias}@vito-nexus.local`;
  const version: number = av.version ?? 1;

  if (av.etat === "a_migrer") {
    // Ancien mot de passe Auth = le code lui-même ; on le vérifie une dernière fois puis on passe au schéma dérivé.
    const ancien = await session(email, code);
    if (!ancien) { await sql`select nexus_connexion.apres_echec(${uid}, ${c.fp})`; return rep(401, REFUS, c.origin); }
    const h = await hasher(alias, code);
    await sql`select nexus_connexion.poser_code(${uid}, ${h}, 'migre', ${version})`;
    const { error } = await admin.auth.admin.updateUserById(uid, { password: await motDePasseDerive(uid, version) });
    if (error) throw new Error("migration auth");
    const s = await session(email, await motDePasseDerive(uid, version));
    if (!s) throw new Error("session migre");
    await sql`select nexus_connexion.apres_succes(${uid}, ${c.fp})`;
    return rep(200, { ok: true, session: s }, c.origin);
  }

  if (av.etat === "migre" || av.etat === "code_temporaire_requis") {
    const bon = typeof av.code_hash === "string" ? await comparer(alias, code, av.code_hash) : (await bcrypt.compare("x", FACTICE), false);
    if (!bon) { await sql`select nexus_connexion.apres_echec(${uid}, ${c.fp})`; return rep(401, REFUS, c.origin); }
    const s = await session(email, await motDePasseDerive(uid, version));
    if (!s) throw new Error("session derive");
    await sql`select nexus_connexion.apres_succes(${uid}, ${c.fp})`;
    return rep(200, { ok: true, session: s, ...(av.etat === "code_temporaire_requis" ? { changer_code: true } : {}) }, c.origin);
  }
  await bcrypt.compare("x", FACTICE);
  return rep(401, REFUS, c.origin);
}

// Les actions ci-dessous n'ont pas d'écran : elles servent à la recette et au futur écran de gestion.
async function appelant(req: Request): Promise<string | null> {
  const m = /^Bearer (.+)$/.exec(req.headers.get("authorization") ?? "");
  if (!m) return null;
  const { data, error } = await admin.auth.getUser(m[1]);
  return error || !data.user ? null : data.user.id;
}
const estUuid = (s: unknown) => typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

async function leverVerrou(req: Request, body: any, c: Ctx): Promise<Response> {
  const par = await appelant(req);
  if (!par || !estUuid(body?.cible)) return rep(403, REFUS, c.origin);
  const r = (await sql`select nexus_connexion.lever_verrou(${body.cible}, ${par}) as r`)[0].r;
  return r?.ok ? rep(200, { ok: true }, c.origin) : rep(403, REFUS, c.origin);
}

async function reinitialiserCode(req: Request, body: any, c: Ctx): Promise<Response> {
  const par = await appelant(req);
  if (!par || !estUuid(body?.cible)) return rep(403, REFUS, c.origin);
  const cpt = (await sql`select nexus_connexion.lire_compte(${body.cible}) as r`)[0].r;
  if (!cpt?.etat) return rep(403, REFUS, c.origin);
  const version = Number(cpt.version) + 1;
  const tmp = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
  const h = await hasher(cpt.alias, tmp);
  const r = (await sql`select nexus_connexion.reinitialiser_code(${body.cible}, ${h}, ${version}, ${par}) as r`)[0].r;
  if (!r?.ok) return rep(403, REFUS, c.origin);
  const { error } = await admin.auth.admin.updateUserById(body.cible, { password: await motDePasseDerive(body.cible, version) });
  if (error) throw new Error("reinit auth");
  return rep(200, { ok: true, code_temporaire: tmp }, c.origin);
}

async function changerCode(req: Request, body: any, c: Ctx): Promise<Response> {
  const uid = await appelant(req);
  const actuel = body?.code_actuel, nouveau = body?.nouveau_code;
  if (!uid || typeof actuel !== "string" || typeof nouveau !== "string" || !/^[0-9]{6}$/.test(nouveau) || nouveau === actuel) {
    await bcrypt.compare("x", FACTICE); return rep(401, REFUS, c.origin);
  }
  const cpt = (await sql`select nexus_connexion.lire_compte(${uid}) as r`)[0].r;
  const bon = cpt?.etat && typeof cpt.code_hash === "string" ? await comparer(cpt.alias, actuel, cpt.code_hash) : (await bcrypt.compare("x", FACTICE), false);
  if (!bon) { await sql`select nexus_connexion.apres_echec(${uid}, ${c.fp})`; return rep(401, REFUS, c.origin); }
  const version = Number(cpt.version) + 1;
  const h = await hasher(cpt.alias, nouveau);
  await sql`select nexus_connexion.poser_code(${uid}, ${h}, 'migre', ${version})`;
  const { error } = await admin.auth.admin.updateUserById(uid, { password: await motDePasseDerive(uid, version) });
  if (error) throw new Error("changer auth");
  const s = await session(`${cpt.alias}@vito-nexus.local`, await motDePasseDerive(uid, version));
  if (!s) throw new Error("session changer");
  return rep(200, { ok: true, session: s }, c.origin);
}

Deno.serve(async (req) => {
  const debut = performance.now();
  const origin = req.headers.get("origin");
  const permise = !!origin && ORIGINES.includes(origin);
  if (req.method === "OPTIONS") return new Response(null, { status: permise ? 204 : 403, headers: entetes(origin) });
  if (req.method !== "POST") return new Response(JSON.stringify(REFUS), { status: 405, headers: { ...entetes(origin), allow: "POST, OPTIONS" } });
  return await avecPlancher(debut, (async () => {
    if (!permise || !MASTER || !PEPPER || !IP_FP) return rep(401, REFUS, origin);
    const brut = await req.text();
    if (brut.length > 2048) return rep(401, REFUS, origin);
    let body: any = null;
    try { body = JSON.parse(brut); } catch { /* corps mal formé : refus neutre plus bas */ }
    if (!body || typeof body !== "object" || Array.isArray(body)) { await bcrypt.compare("x", FACTICE); return rep(401, REFUS, origin); }
    const fp = await empreinteIp(req.headers.get("cf-connecting-ip"));
    const c: Ctx = { origin, fp };
    switch (body.action ?? "connexion") {
      case "connexion": return await connexion(body, c);
      case "lever_verrou": return await leverVerrou(req, body, c);
      case "reinitialiser_code": return await reinitialiserCode(req, body, c);
      case "changer_code": return await changerCode(req, body, c);
      default: await bcrypt.compare("x", FACTICE); return rep(401, REFUS, origin);
    }
  })());
});
