// Bannissement des identités de recette (T2, puis T3) par l'API d'administration Supabase Auth (remplace le script SQL 46).
// Aucune suppression : seule la méthode PUT /auth/v1/admin/users/{id} avec ban_duration est employée.
// Usage : node bannir_identites_recette.mjs [--lot recette|chargement|recette_t3] [--verifier-seulement] --sortie preuves/bannissement.json
// Version T3 (17/11/2026) : ajout du lot « recette_t3 » (3 identités, mots de passe NEXUS_RECETTE_T3_MDP_*). Lots T2 inchangés.
// Lot « recette » (défaut) : les 4 identités de la recette des accès. Lot « chargement » : le compte de chargement de la recette fonctionnelle.
// Mode test (défaut) : NEXUS_TEST_URL (https://udljdqxerrbbbajxubfn.supabase.co exactement), NEXUS_TEST_SERVICE_ROLE_KEY,
//   NEXUS_TEST_ANON_KEY (contrôle de reconnexion), NEXUS_RECETTE_MDP_GSM / _GFA / _MSM / _DSM.
// Mode local_auth (répétition) : NEXUS_MODE=local_auth, NEXUS_LOCAL_URL=http://127.0.0.1:<port>, mêmes autres variables.
// Étapes : gardes ; appartenance effective de la clé au projet Test ; identification des 4 identités exactes ; vérification
// dans employees (rôle et site attendus, désactivées, comptes de test, non créatrices) ; bannissement ; vérification du
// bannissement et du refus de reconnexion. Arrêt au premier écart.
// Le rapport ne contient ni clé, ni mot de passe, ni jeton.
import fs from 'node:fs';
import path from 'node:path';

const TEST_REF = 'udljdqxerrbbbajxubfn', PROD_REF = 'uzhjpqpctpvxytxpxoqz';
const DUREE = '876000h';  // 100 ans : bannissement sans limite pratique
const LOTS = { recette: [
  { email: 'recette-t2-gerant-sm@vito-nexus.local', username: 'recette-t2-gerant-sm', role: 'gerant', site: 'vito-sainte-marie', env_mdp: 'NEXUS_RECETTE_MDP_GSM' },
  { email: 'recette-t2-gerant-fantome@vito-nexus.local', username: 'recette-t2-gerant-fantome', role: 'gerant', site: 'site-fantome-test', env_mdp: 'NEXUS_RECETTE_MDP_GFA' },
  { email: 'recette-t2-manager-sm@vito-nexus.local', username: 'recette-t2-manager-sm', role: 'manager', site: 'vito-sainte-marie', env_mdp: 'NEXUS_RECETTE_MDP_MSM' },
  { email: 'recette-t2-gerant2-sm@vito-nexus.local', username: 'recette-t2-gerant2-sm', role: 'gerant', site: 'vito-sainte-marie', env_mdp: 'NEXUS_RECETTE_MDP_DSM' },
],
  chargement: [
  { email: 'recette-t2-chargement-sm@vito-nexus.local', username: 'recette-t2-chargement-sm', role: 'gerant', site: 'vito-sainte-marie', env_mdp: 'NEXUS_RECETTE_MDP_CHG' },
],
  recette_t3: [
  { email: 'recette-t3-gerant-sm@vito-nexus.local', username: 'recette-t3-gerant-sm', role: 'gerant', site: 'vito-sainte-marie', env_mdp: 'NEXUS_RECETTE_T3_MDP_GSM' },
  { email: 'recette-t3-manager-sm@vito-nexus.local', username: 'recette-t3-manager-sm', role: 'manager', site: 'vito-sainte-marie', env_mdp: 'NEXUS_RECETTE_T3_MDP_MSM' },
  { email: 'recette-t3-gerant-fantome@vito-nexus.local', username: 'recette-t3-gerant-fantome', role: 'gerant', site: 'site-fantome-test', env_mdp: 'NEXUS_RECETTE_T3_MDP_GFA' },
] };
const CONNUES = Object.values(LOTS).flat().map(i => i.email);
const arg = n => process.argv.includes('--' + n);
const val = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const verifierSeulement = arg('verifier-seulement');
const LOT = val('lot', 'recette');
const IDENTITES = LOTS[LOT] || [];
const sortie = val('sortie', 'preuves/bannissement_identites_recette.json');
const MODE = process.env.NEXUS_MODE || 'test';
const rapport = { lot: LOT, mode: MODE, verifier_seulement: verifierSeulement, debut: new Date().toISOString(), etapes: [], identites: [] };
const fin = (code, motif) => {
  rapport.fin = new Date().toISOString(); rapport.resultat = code === 0 ? 'CONFORME' : 'ARRET'; if (motif) rapport.motif_arret = motif;
  fs.mkdirSync(path.dirname(sortie), { recursive: true }); fs.writeFileSync(sortie, JSON.stringify(rapport, null, 1));
  console.log(code === 0 ? `CONFORME (${verifierSeulement ? 'vérification seule' : IDENTITES.length + ' identité(s) bannie(s), reconnexion refusée'})` : `ARRET : ${motif}`);
  process.exit(code);
};
const etape = (nom, ok, detail) => { rapport.etapes.push({ etape: nom, ok, ...(detail ? { detail } : {}) }); if (!ok) fin(1, nom + (detail ? ' : ' + JSON.stringify(detail) : '')); };

// 1. Gardes : lot connu, cible, clé, mots de passe (présence seulement, jamais écrits).
etape('garde_lot', IDENTITES.length > 0, { lot: LOT });
let BASE;
if (MODE === 'test') {
  BASE = (process.env.NEXUS_TEST_URL || '').replace(/\/+$/, '');
  etape('garde_cible', !BASE.includes(PROD_REF) && BASE === `https://${TEST_REF}.supabase.co`, { cible: BASE.includes(PROD_REF) ? 'PRODUCTION REFUSÉE' : BASE });
} else if (MODE === 'local_auth') {
  BASE = (process.env.NEXUS_LOCAL_URL || '').replace(/\/+$/, '');
  etape('garde_cible', /^http:\/\/127\.0\.0\.1:\d+$/.test(BASE), { cible: BASE });
} else etape('garde_mode', false, { mode: MODE });
const CLE = process.env.NEXUS_TEST_SERVICE_ROLE_KEY || '', ANON = process.env.NEXUS_TEST_ANON_KEY || '';
let infoCle = { format: 'absente' };
if (/^[\w-]+\.[\w-]+\.[\w-]+$/.test(CLE)) {
  let p = {}; try { p = JSON.parse(Buffer.from(CLE.split('.')[1], 'base64url').toString()); } catch {}
  infoCle = { format: 'jwt', role: p.role || null, ref: p.ref || null };
  etape('garde_cle', p.role === 'service_role' && (MODE !== 'test' || p.ref === TEST_REF), infoCle);
} else if (CLE.startsWith('sb_secret_')) { infoCle = { format: 'sb_secret (projet non lisible dans la clé : appartenance vérifiée à l étape suivante par le projet lui-même)' }; etape('garde_cle', true, infoCle); }
else etape('garde_cle', false, infoCle);
etape('garde_cle_publique', ANON.length > 0, { presente: ANON.length > 0 });
const absents = IDENTITES.filter(i => !process.env[i.env_mdp]).map(i => i.env_mdp);
etape('garde_mots_de_passe', absents.length === 0, absents.length ? { absents } : null);

const admin = { apikey: CLE, Authorization: `Bearer ${CLE}`, 'Content-Type': 'application/json' };
async function http(methode, chemin, entetes, corps) {
  if (!['GET', 'PUT', 'POST'].includes(methode)) throw new Error('méthode interdite : ' + methode);   // aucune suppression possible
  let r;
  try { r = await fetch(BASE + chemin, { method: methode, headers: entetes, body: corps ? JSON.stringify(corps) : undefined }); }
  catch (e) { return { http: 0, corps: null, erreur_reseau: String(e.cause && e.cause.code || e.message) }; }
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
  return { http: r.status, corps: j };
}

// 2. Appartenance effective de la clé au projet visé, sans l'exposer : le service d'administration du projet doit l'accepter
//    (une clé d'un autre projet est refusée), puis la base qu'elle ouvre doit porter les deux sites propres à Test.
const sonde = await http('GET', '/auth/v1/admin/users?page=1&per_page=1', admin);
etape('appartenance_cle_auth', sonde.http === 200, { http: sonde.http, ...(sonde.erreur_reseau ? { erreur_reseau: sonde.erreur_reseau } : {}) });
const sitesTest = await http('GET', '/rest/v1/sites?site_id=in.(site-fantome-test,nexus-station-test)&select=site_id', admin);
etape('appartenance_cle_base', sitesTest.http === 200 && Array.isArray(sitesTest.corps) && sitesTest.corps.length === 2, { http: sitesTest.http, sites_test: Array.isArray(sitesTest.corps) ? sitesTest.corps.length : null });

// 3. Identification des 4 identités exactes.
const liste = await http('GET', '/auth/v1/admin/users?page=1&per_page=1000', admin);
etape('liste_identites', liste.http === 200 && liste.corps && Array.isArray(liste.corps.users), { http: liste.http });
const inconnues = liste.corps.users.filter(u => /^recette-t[23]-/.test(u.email || '') && !CONNUES.includes((u.email || '').toLowerCase()));
const trouvees = IDENTITES.map(i => ({ ...i, u: liste.corps.users.filter(u => (u.email || '').toLowerCase() === i.email) }));
etape('identites_exactes', trouvees.every(t => t.u.length === 1) && inconnues.length === 0,
  { attendues: IDENTITES.length, trouvees: trouvees.filter(t => t.u.length === 1).length, identites_recette_inconnues: inconnues.length });

// 4. Vérification préalable dans employees : rôle et site attendus, désactivées, comptes de test, non créatrices, liées aux bonnes identités.
const ids = trouvees.map(t => t.u[0].id);
const emp = await http('GET', `/rest/v1/employees?id=in.(${ids.join(',')})&select=id,username,actif,compte_test,est_createur,site_id,role`, admin);
etape('lecture_employees', emp.http === 200 && Array.isArray(emp.corps), { http: emp.http });
for (const t of trouvees) {
  const e = emp.corps.find(x => x.id === t.u[0].id);
  const ligne = { email: t.email, id: t.u[0].id, username: e ? e.username : null, role: e ? e.role : null, site: e ? e.site_id : null,
    role_attendu: t.role, site_attendu: t.site,
    actif: e ? e.actif : null, compte_test: e ? e.compte_test : null, createur: e ? e.est_createur : null, banni_avant: t.u[0].banned_until || null };
  rapport.identites.push(ligne);
  etape('employee_' + t.username, !!e && e.username === t.username && e.role === t.role && e.site_id === t.site
    && e.actif === false && e.compte_test === true && e.est_createur === false,
    { username: ligne.username, role: ligne.role, role_attendu: t.role, site: ligne.site, site_attendu: t.site, actif: ligne.actif, compte_test: ligne.compte_test, createur: ligne.createur });
}
if (verifierSeulement) fin(0);

// 5. Bannissement, une identité à la fois.
const dans50ans = Date.now() + 50 * 365 * 24 * 3600 * 1000;
for (const l of rapport.identites) {
  const r = await http('PUT', `/auth/v1/admin/users/${l.id}`, admin, { ban_duration: DUREE });
  l.banni_jusqu_au = r.corps && r.corps.banned_until || null;
  etape('bannissement_' + l.username, r.http === 200 && l.banni_jusqu_au && Date.parse(l.banni_jusqu_au) > dans50ans, { http: r.http, banni_jusqu_au: l.banni_jusqu_au });
}

// 6. Vérification : état relu par l'API, puis tentative de reconnexion refusée.
for (const l of rapport.identites) {
  const g = await http('GET', `/auth/v1/admin/users/${l.id}`, admin);
  const relu = g.corps && g.corps.banned_until;
  const mdp = process.env[IDENTITES.find(i => i.email === l.email).env_mdp];
  const c = await http('POST', '/auth/v1/token?grant_type=password', { apikey: ANON, 'Content-Type': 'application/json' }, { email: l.email, password: mdp });
  l.reconnexion = { http: c.http, code: c.corps && (c.corps.error_code || c.corps.error) || null, jeton_obtenu: !!(c.corps && c.corps.access_token) };
  etape('verification_' + l.username, g.http === 200 && relu && Date.parse(relu) > dans50ans && c.http >= 400 && !l.reconnexion.jeton_obtenu && l.reconnexion.code === 'user_banned',
    { banni_jusqu_au_relu: relu, reconnexion: l.reconnexion });
}
fin(0);
