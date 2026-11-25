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
// Configuration obligatoire : une variable absente ou vide empêche tout traitement (jamais de valeur par défaut). Seuls les NOMS sont journalisés.
const MANQUANTES = [["AUTH_MASTER_SECRET", MASTER], ["PEPPER", PEPPER], ["IP_FP_SECRET", IP_FP], ["ORIGINES_AUTORISEES", ORIGINES.join("")]].filter(([, v]) => !v).map(([n]) => n);
if (MANQUANTES.length) console.error("configuration incomplète : " + MANQUANTES.join(", "));
const RECETTE_PANNES = Deno.env.get("RECETTE_PANNES") === "1"; // Test seulement ; sans elle, panne_injectee n'est jamais lue
const PLANCHER_MS = Number(Deno.env.get("PLANCHER_MS") ?? "1500");
const COST = 10; // mesuré sur Test : coût 12 ≈ 346 ms CPU (médiane), coût 10 ≈ 86 ms ; les hachages coût 12 existants restent valides
// Hachage bcrypt factice (coût 10, non secret) : sert au travail identique quand le compte est inconnu ou refusé.
const FACTICE = "$2a$10$z0Kt9LHS7dw1h60sgsxeweAf/rzVnKNUUF0HqDu8yx1paZ3QLtL1e";

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
  try { r = await p; } catch (e) {
    if (e instanceof LimiteAuth) { r = new Response(JSON.stringify({ ok: false, erreur: "indisponible" }), { status: 503, headers: { "content-type": "application/json", "cache-control": "no-store" } }); }
    else { console.log("erreur interne", (e as Error)?.name ?? "?"); r = new Response(JSON.stringify(REFUS), { status: 401, headers: { "content-type": "application/json", "cache-control": "no-store" } }); } }
  const reste = PLANCHER_MS - (performance.now() - debut);
  if (reste > 0) await attendre(reste);
  return r;
}

type Ctx = { origin: string | null; fp: string };

class LimiteAuth extends Error {}

async function session(email: string, mdp: string) {
  const { data, error } = await anon().auth.signInWithPassword({ email, password: mdp });
  if (error && (error as any).status === 429) throw new LimiteAuth();
  if (error || !data.session) return null;
  const s = data.session;
  return { access_token: s.access_token, refresh_token: s.refresh_token, expires_in: s.expires_in, token_type: s.token_type };
}

// Écriture double Auth + base : Auth d'abord, base ensuite ; si la base échoue, Auth est remis dans l'état précédent.
// Si la compensation échoue aussi, on journalise 'incoherence_auth' (contrôle : nexus_connexion.comptes_incoherents()).
// Les pannes injectées (table panne_injectee, vide en temps normal) ne servent qu'à la recette sur Test.
async function panne(uid: string, etape: string): Promise<boolean> {
  if (!RECETTE_PANNES) return false;
  return (await sql`select nexus_connexion.panne_pour(${uid}, ${etape}) as r`)[0].r === true;
}
async function ecrireAtomique(uid: string, chemin: string, nouveauMdp: string, ancienMdp: string, ecrireBase: () => Promise<boolean>): Promise<boolean> {
  const compenser = async (etape: string) => {
    let ok = false;
    try {
      if (!(await panne(uid, "compensation"))) {
        const { error } = await admin.auth.admin.updateUserById(uid, { password: ancienMdp });
        ok = !error;
      }
    } catch { ok = false; }
    if (!ok) { try { await sql`select nexus_connexion.journaliser_incoherence(${uid}, ${chemin}, ${etape})`; } catch { console.error("incoherence_auth non journalisée"); } console.error("incoherence_auth", chemin, etape); }
  };
  let errAuth = await panne(uid, "auth");
  if (!errAuth) { const { error } = await admin.auth.admin.updateUserById(uid, { password: nouveauMdp }); errAuth = !!error; }
  if (errAuth) { await compenser("auth"); return false; }
  let okBase = false;
  try { okBase = !(await panne(uid, "base")) && await ecrireBase(); } catch { okBase = false; }
  if (!okBase) { await compenser("base"); return false; }
  return true;
}

async function connexion(body: any, c: Ctx): Promise<Response> {
  const prenom = body?.prenom, code = body?.code;
  const valide = typeof prenom === "string" && prenom.length > 0 && prenom.length <= 60 && typeof code === "string" && code.length > 0 && code.length <= 32;
  if (!valide) { await bcrypt.compare("x", FACTICE); return rep(401, REFUS, c.origin); }

  // Surveillance seule : journalise 'egress_proche' à 60 succès en 5 min. Ne bloque jamais ; seul un 429 d'Auth donne « indisponible ».
  await sql`select nexus_connexion.compter_succes()`;

  const av = (await sql`select nexus_connexion.avant_essai(${prenom}, ${c.fp}) as r`)[0].r;
  const uid: string | null = av.user_id ?? null;
  const alias: string = av.alias;
  if (av.decision !== "ok" || !uid || !av.etat) { await bcrypt.compare("x", FACTICE); return rep(401, REFUS, c.origin); }

  const email = `${alias}@vito-nexus.local`;
  const version: number = av.version ?? 1;

  if (av.etat === "a_migrer") {
    // Ancien mot de passe Auth = le code lui-même ; on le vérifie une dernière fois puis on passe au schéma dérivé.
    // Budget global d'appels à Auth (IP de sortie partagée) : au-delà, 503 sans appeler Auth ni toucher aucun compteur.
    if ((await sql`select nexus_connexion.budget_auth() as r`)[0].r?.ok !== true) throw new LimiteAuth();
    const ancien = await session(email, code);
    if (!ancien) { await sql`select nexus_connexion.apres_echec(${uid}, ${c.fp})`; return rep(401, REFUS, c.origin); }
    const h = await hasher(alias, code);
    const ecrit = await ecrireAtomique(uid, "a_migrer", await motDePasseDerive(uid, version), code,
      async () => { await sql`select nexus_connexion.poser_code(${uid}, ${h}, 'migre', ${version})`; return true; });
    if (!ecrit) throw new Error("migration atomique");
    const s = await session(email, await motDePasseDerive(uid, version));
    if (!s) throw new Error("session migre");
    await sql`select nexus_connexion.apres_succes(${uid}, ${c.fp})`;
    return rep(200, { ok: true, session: s }, c.origin);
  }

  if (av.etat === "migre" || av.etat === "code_temporaire_requis") {
    const bon = typeof av.code_hash === "string" ? await comparer(alias, code, av.code_hash) : (await bcrypt.compare("x", FACTICE), false);
    if (!bon) { await sql`select nexus_connexion.apres_echec(${uid}, ${c.fp})`; return rep(401, REFUS, c.origin); }
    // Code temporaire correct : aucune session. Le client doit d'abord appeler changer_code (mêmes verrous, même plancher).
    if (av.etat === "code_temporaire_requis") return rep(200, { ok: true, changer_code: true }, c.origin);
    const s = await session(email, await motDePasseDerive(uid, version));
    if (!s) throw new Error("session derive");
    await sql`select nexus_connexion.apres_succes(${uid}, ${c.fp})`;
    // Re-hachage au coût courant (décision Guardian 7151083028) : une écriture, sans toucher Auth ni la version.
    if (!av.code_hash.startsWith(`$2a$${COST}$`)) {
      try { const h2 = await hasher(alias, code); await sql`select nexus_connexion.poser_code(${uid}, ${h2}, 'migre', ${version})`; } catch { console.log("rehash ignoré"); }
    }
    return rep(200, { ok: true, session: s }, c.origin);
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
  // Auteur non autorisé : la fonction SQL journalise le refus et n'écrit rien ; Auth n'est alors jamais touché.
  const permis = (await sql`select nexus_connexion.auteur_autorise(${par}, ${body.cible}) as r`)[0].r === true;
  if (!permis) { await sql`select nexus_connexion.reinitialiser_code(${body.cible}, ${h}, ${version}, ${par})`; return rep(403, REFUS, c.origin); }
  const ecrit = await ecrireAtomique(body.cible, "reinitialiser_code", await motDePasseDerive(body.cible, version), await motDePasseDerive(body.cible, Number(cpt.version)),
    async () => (await sql`select nexus_connexion.reinitialiser_code(${body.cible}, ${h}, ${version}, ${par}) as r`)[0].r?.ok === true);
  if (!ecrit) throw new Error("reinit atomique");
  return rep(200, { ok: true, code_temporaire: tmp }, c.origin);
}

// Code trop faible : six chiffres identiques, ou suite croissante / décroissante (123456, 654321, 012345…).
function codeFaible(n: string): boolean {
  if (/^(\d)\1{5}$/.test(n)) return true;
  const d = n.split("").map(Number);
  return d.every((x, i) => i === 0 || x === d[i - 1] + 1) || d.every((x, i) => i === 0 || x === d[i - 1] - 1);
}

// Premier login avec code temporaire : sans JWT, mêmes verrous que la connexion. La session n'est rendue qu'après l'écriture atomique.
async function changerCodeTemporaire(body: any, c: Ctx): Promise<Response> {
  const prenom = body?.prenom, actuel = body?.code_actuel, nouveau = body?.nouveau_code;
  if (typeof prenom !== "string" || !prenom || prenom.length > 60 || typeof actuel !== "string" || !actuel || actuel.length > 32
    || typeof nouveau !== "string" || !/^[0-9]{6}$/.test(nouveau) || nouveau === actuel || codeFaible(nouveau)) {
    await bcrypt.compare("x", FACTICE); return rep(401, REFUS, c.origin);
  }
  const av = (await sql`select nexus_connexion.avant_essai(${prenom}, ${c.fp}) as r`)[0].r;
  const uid: string | null = av.user_id ?? null;
  if (av.decision !== "ok" || !uid || av.etat !== "code_temporaire_requis") { await bcrypt.compare("x", FACTICE); return rep(401, REFUS, c.origin); }
  const bon = typeof av.code_hash === "string" ? await comparer(av.alias, actuel, av.code_hash) : (await bcrypt.compare("x", FACTICE), false);
  if (!bon) { await sql`select nexus_connexion.apres_echec(${uid}, ${c.fp})`; return rep(401, REFUS, c.origin); }
  const version = Number(av.version ?? 1) + 1;
  const h = await hasher(av.alias, nouveau);
  const ecrit = await ecrireAtomique(uid, "changer_code", await motDePasseDerive(uid, version), await motDePasseDerive(uid, Number(av.version ?? 1)),
    async () => { await sql`select nexus_connexion.poser_code(${uid}, ${h}, 'migre', ${version})`; return true; });
  if (!ecrit) throw new Error("changer atomique");
  const s = await session(`${av.alias}@vito-nexus.local`, await motDePasseDerive(uid, version));
  if (!s) throw new Error("session changer");
  await sql`select nexus_connexion.apres_succes(${uid}, ${c.fp})`;
  return rep(200, { ok: true, session: s }, c.origin);
}

async function changerCode(req: Request, body: any, c: Ctx): Promise<Response> {
  if (body?.prenom !== undefined) return await changerCodeTemporaire(body, c);
  const uid = await appelant(req);
  const actuel = body?.code_actuel, nouveau = body?.nouveau_code;
  if (!uid || typeof actuel !== "string" || typeof nouveau !== "string" || !/^[0-9]{6}$/.test(nouveau) || nouveau === actuel || codeFaible(nouveau)) {
    await bcrypt.compare("x", FACTICE); return rep(401, REFUS, c.origin);
  }
  const cpt = (await sql`select nexus_connexion.lire_compte(${uid}) as r`)[0].r;
  const bon = cpt?.etat && typeof cpt.code_hash === "string" ? await comparer(cpt.alias, actuel, cpt.code_hash) : (await bcrypt.compare("x", FACTICE), false);
  if (!bon) { await sql`select nexus_connexion.apres_echec(${uid}, ${c.fp})`; return rep(401, REFUS, c.origin); }
  const version = Number(cpt.version) + 1;
  const h = await hasher(cpt.alias, nouveau);
  const ecrit = await ecrireAtomique(uid, "changer_code", await motDePasseDerive(uid, version), await motDePasseDerive(uid, Number(cpt.version)),
    async () => { await sql`select nexus_connexion.poser_code(${uid}, ${h}, 'migre', ${version})`; return true; });
  if (!ecrit) throw new Error("changer atomique");
  const s = await session(`${cpt.alias}@vito-nexus.local`, await motDePasseDerive(uid, version));
  if (!s) throw new Error("session changer");
  return rep(200, { ok: true, session: s }, c.origin);
}

// Lit le corps sans jamais dépasser max octets : refus sur content-length annoncé trop grand, sinon arrêt de la lecture au (max+1)e octet.
async function lireCorpsBorne(req: Request, max: number): Promise<string | null> {
  const cl = req.headers.get("content-length");
  if (cl !== null && Number(cl) > max) { try { await req.body?.cancel(); } catch { /* ignoré */ } return null; }
  if (!req.body) return "";
  const lecteur = req.body.getReader();
  const morceaux: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    total += value.length;
    if (total > max) { try { await lecteur.cancel(); } catch { /* ignoré */ } return null; }
    morceaux.push(value);
  }
  const tout = new Uint8Array(total);
  let o = 0;
  for (const m of morceaux) { tout.set(m, o); o += m.length; }
  return new TextDecoder().decode(tout);
}

Deno.serve(async (req) => {
  const debut = performance.now();
  const origin = req.headers.get("origin");
  const permise = !!origin && ORIGINES.includes(origin);
  if (req.method === "OPTIONS") return new Response(null, { status: permise ? 204 : 403, headers: entetes(origin) });
  if (req.method !== "POST") return new Response(JSON.stringify(REFUS), { status: 405, headers: { ...entetes(origin), allow: "POST, OPTIONS" } });
  return await avecPlancher(debut, (async () => {
    if (MANQUANTES.length) { console.error("configuration incomplète : " + MANQUANTES.join(", ")); return rep(401, REFUS, origin); }
    if (!permise) return rep(401, REFUS, origin);
    const brut = await lireCorpsBorne(req, 2048);
    if (brut === null) return rep(401, REFUS, origin);
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
