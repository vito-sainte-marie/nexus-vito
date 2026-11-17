// Recette authentifiée T3 de la fonction décision-journal : vraie connexion Supabase Auth, vrais appels REST et RPC (PostgREST),
// RLS réelle. Usage, une phase à la fois :  node recette_t3_decision_journal.mjs --phase 1 --sortie preuves/t3_phase1.json
// Mode test (défaut) : NEXUS_TEST_URL (https://udljdqxerrbbbajxubfn.supabase.co exactement), NEXUS_TEST_ANON_KEY (clé publique),
//   NEXUS_RECETTE_T3_MDP_GSM / _MSM / _GFA. La référence Production est refusée avant tout appel.
// Mode local_auth (répétition) : NEXUS_MODE=local_auth, NEXUS_LOCAL_URL=http://127.0.0.1:<port>, mêmes autres variables.
// Aucun mot de passe ni jeton dans le rapport. Arrêt au premier écart : les cas suivants sont marqués « NON_JOUE ».
// Données de recette : articles fictifs préfixés « RECETTE T3 », jamais une référence réelle du site.
import fs from 'node:fs';
import path from 'node:path';

const TEST_REF = 'udljdqxerrbbbajxubfn', PROD_REF = 'uzhjpqpctpvxytxpxoqz';
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const phase = Number(arg('phase'));
const sortie = arg('sortie', `preuves/test/t3_phase${phase}.json`);
const cas = JSON.parse(fs.readFileSync(new URL('./cas_recette_t3.json', import.meta.url)));
const MODE = process.env.NEXUS_MODE || 'test';
if (![1, 2, 3].includes(phase)) { console.error('--phase 1, 2 ou 3'); process.exit(2); }

let BASE; const APIKEY = process.env.NEXUS_TEST_ANON_KEY || '';
if (MODE === 'test') {
  BASE = (process.env.NEXUS_TEST_URL || '').replace(/\/+$/, '');
  if (BASE.includes(PROD_REF)) { console.error('REFUS : référence Supabase Production'); process.exit(3); }
  if (BASE !== `https://${TEST_REF}.supabase.co`) { console.error('REFUS : seul https://' + TEST_REF + '.supabase.co est accepté'); process.exit(3); }
} else if (MODE === 'local_auth') {
  BASE = (process.env.NEXUS_LOCAL_URL || '').replace(/\/+$/, '');
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(BASE)) { console.error('REFUS : mode local_auth réservé à 127.0.0.1'); process.exit(3); }
} else { console.error('NEXUS_MODE inconnu'); process.exit(3); }
if (!APIKEY) { console.error('NEXUS_TEST_ANON_KEY absente'); process.exit(3); }

async function connexion(code) {
  const p = cas.personas[code];
  if (p.anonyme) return { jeton: null, id: null };
  const mdp = process.env[p.env_mdp];
  if (!mdp) throw new Error(`mot de passe absent pour ${code} (${p.env_mdp})`);
  const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: APIKEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: p.email, password: mdp }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`connexion refusée pour ${code} : HTTP ${r.status} ${j.error_code || j.error || ''}`);
  return { jeton: j.access_token, id: j.user && j.user.id };
}
const entetes = s => ({ apikey: APIKEY, 'Content-Type': 'application/json', Prefer: 'return=representation', Authorization: `Bearer ${s.jeton || APIKEY}` });
async function requete(s, methode, chemin, corps) {
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(methode)) throw new Error('méthode interdite');
  const r = await fetch(`${BASE}/rest/v1/${chemin}`, { method: methode, headers: entetes(s), body: corps ? JSON.stringify(corps) : undefined });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
  return { http: r.status, corps: j };
}

// Ligne de décision : photo et version du moteur T2 par défaut ; variantes pour les cas de refus.
const PHOTO = { cout: 1.14, pv_ht: 2.06, quantite: 39, taux: 0.447, fiabilite: 'fiable' };
function ligne(l) {
  const o = { article: cas.prefixe + l.article, decision: l.decision, periode_debut: '2026-10-05', periode_fin: '2026-11-09',
              moteur_version: 'politique-tarifaire-t2-v2', photo: PHOTO };
  if (l.prix !== undefined) o.prix_ttc_retenu = l.prix;
  if (l.motif) o.motif = l.motif;
  if (l.photo_incomplete) o.photo = { cout: 1 };
  if (l.moteur) o.moteur_version = l.moteur;
  if (l.site_injecte) o.site = cas.sites[l.site_injecte];
  return o;
}
const remplacer = (t, s) => t.replace(/@SM/g, cas.sites.SM).replace(/@FA/g, cas.sites.FA).replace(/@PREFIXE/g, encodeURIComponent(cas.prefixe)).replace(/@MOI/g, s.id || '');

const sessions = {}, rapport = { mode: MODE, phase, cible: MODE === 'test' ? TEST_REF : 'local', debut: new Date().toISOString(), cas: [] };
let arret = false;
for (const c of cas.cas.filter(x => x.phase === phase)) {
  if (arret) { rapport.cas.push({ id: c.id, verdict: 'NON_JOUE' }); continue; }
  const L = { id: c.id, persona: c.persona, libelle: c.libelle, attendu: c.attendu };
  try {
    sessions[c.persona] = sessions[c.persona] || await connexion(c.persona);
    const s = sessions[c.persona];
    let r;
    if (c.action === 'rpc') r = await requete(s, 'POST', 'rpc/tarif_enregistrer_decisions', { p_lignes: c.lignes.map(ligne) });
    else if (c.action === 'select') r = await requete(s, 'GET', remplacer(c.chemin, s));
    else if (c.action === 'insert') {
      const corps = JSON.parse(remplacer(JSON.stringify(c.corps), s));
      if (corps.article) corps.article = cas.prefixe + corps.article;
      r = await requete(s, 'POST', c.chemin, corps);
    }
    else if (c.action === 'annuler') r = await requete(s, 'PATCH', remplacer(c.chemin, s), { annule_le: new Date().toISOString(), annule_par: s.id, motif_annulation: 'fin de recette T3' });
    else if (c.action === 'patch') r = await requete(s, 'PATCH', remplacer(c.chemin, s), c.corps);
    else if (c.action === 'delete') r = await requete(s, 'DELETE', remplacer(c.chemin, s));
    else throw new Error('action inconnue ' + c.action);
    const ok = r.http >= 200 && r.http < 300, lignes = Array.isArray(r.corps) ? r.corps.length : null;
    const msg = !ok && r.corps ? String(r.corps.message || r.corps.msg || '') : null;
    L.obtenu = { http: r.http, statut: ok ? 'ok' : 'refus', lignes, code: !ok && r.corps ? r.corps.code || null : null, message: msg ? msg.slice(0, 140) : null,
      sites: Array.isArray(r.corps) ? [...new Set(r.corps.map(x => x.site).filter(Boolean))].map(v => Object.keys(cas.sites).find(k => cas.sites[k] === v) || v).sort() : null };
    if (ok && Array.isArray(r.corps) && c.attendu.valeurs && r.corps[0]) L.obtenu.valeurs = Object.fromEntries(Object.keys(c.attendu.valeurs).map(k => [k, r.corps[0][k]]));
    const a = c.attendu;
    let conforme = L.obtenu.statut === a.statut;
    if (conforme && a.statut === 'ok' && a.lignes !== undefined) conforme = lignes === a.lignes;
    if (conforme && a.statut === 'refus' && a.message) conforme = (msg || '').includes(a.message) || L.obtenu.code === a.message;
    if (conforme && a.sites) conforme = JSON.stringify(L.obtenu.sites) === JSON.stringify([...a.sites].sort());
    if (conforme && a.valeurs) conforme = Object.entries(a.valeurs).every(([k, v]) => L.obtenu.valeurs && String(L.obtenu.valeurs[k]) === String(v));
    if (conforme && a.lien_par_ligne) conforme = Array.isArray(r.corps) && r.corps.length === a.lien_par_ligne.length && r.corps.every((x, i) => (x.o_prix_decide_id !== null) === (a.lien_par_ligne[i] === 'lien'));
    L.verdict = conforme ? 'OK' : 'ECHEC';
  } catch (e) { L.verdict = 'ECHEC'; L.erreur = String(e.message || e); }
  rapport.cas.push(L);
  if (L.verdict !== 'OK') arret = true;
}
rapport.fin = new Date().toISOString();
rapport.resume = { ok: rapport.cas.filter(x => x.verdict === 'OK').length, echec: rapport.cas.filter(x => x.verdict === 'ECHEC').length, non_joue: rapport.cas.filter(x => x.verdict === 'NON_JOUE').length };
fs.mkdirSync(path.dirname(sortie), { recursive: true });
fs.writeFileSync(sortie, JSON.stringify(rapport, null, 1));
console.log(`phase ${phase} : OK ${rapport.resume.ok} / ECHEC ${rapport.resume.echec} / non joués ${rapport.resume.non_joue}`);
process.exit(rapport.resume.echec ? 1 : 0);
