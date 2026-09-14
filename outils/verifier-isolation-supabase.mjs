#!/usr/bin/env node
// NEXUS — preuve d'isolation contre une vraie base (04/09/2026).
//
// Ce script REJOUE, telles quelles, les deux attaques qui ont réussi le
// 04/09/2026 sur la recette Cloudflare, avec pour seule arme la clé
// publiable — celle que tout visiteur lit dans `nexus-config.js` :
//
//   1. POST /rest/v1/rpc/nexus_stock_lire_etat_json {"p_site":"<autre site>"}
//      → 200 et 119 lignes de stock d'un site étranger, sans authentification.
//   2. GET  /rest/v1/employees_public?select=*
//      → 200 et l'annuaire complet des employés, tous sites confondus.
//
// Il ne vit pas dans `run-tests.js` : la suite de non-régression n'ouvre
// aucune connexion réseau, et c'est une propriété qu'on tient à garder. Ce
// script se lance à la main, avant et après une migration :
//
//   node outils/verifier-isolation-supabase.mjs \
//     --url https://<ref>.supabase.co --cle sb_publishable_… \
//     --site-etranger vito-sainte-marie --prenom "Manager Test"
//
// Sortie 0 : les portes sont fermées. Sortie 1 : au moins une reste ouverte.
// Avant migration il DOIT échouer — c'est ce qui prouve qu'il teste quelque
// chose. Un test de sécurité qui n'a jamais échoué ne garde rien.
//
// Aucune valeur par défaut : ni URL, ni clé, ni site. Un défaut serait
// forcément celui d'un environnement, et ferait croire à une vérification
// alors qu'on interrogerait l'autre base.

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
}

const URL_BASE = args.get('url');
const CLE = args.get('cle');
const SITE_ETRANGER = args.get('site-etranger');
const PRENOM = args.get('prenom');

if (!URL_BASE || !CLE || !SITE_ETRANGER) {
  console.error('\n  Usage : node outils/verifier-isolation-supabase.mjs \\');
  console.error('            --url https://<ref>.supabase.co --cle <clé publiable> \\');
  console.error('            --site-etranger <site_id que le visiteur ne doit PAS lire> \\');
  console.error('            [--prenom "<prénom d’un compte existant>"]\n');
  process.exit(2);
}

let echecs = 0;
function verifier(libelle, condition, detail) {
  console.log(`${condition ? 'FERMÉ  ' : 'OUVERT '} — ${libelle}${detail ? `\n           ${detail}` : ''}`);
  if (!condition) echecs++;
}

const entetes = { apikey: CLE, 'Content-Type': 'application/json' };

async function lire(chemin) {
  const r = await fetch(`${URL_BASE}/rest/v1/${chemin}`, { headers: entetes });
  let corps = null;
  try { corps = await r.json(); } catch { /* réponse vide */ }
  return { statut: r.status, corps };
}

async function appeler(fonction, parametres) {
  const r = await fetch(`${URL_BASE}/rest/v1/rpc/${fonction}`, {
    method: 'POST', headers: entetes, body: JSON.stringify(parametres)
  });
  let corps = null;
  try { corps = await r.json(); } catch { /* réponse vide */ }
  return { statut: r.status, corps };
}

const nbLignes = r => (Array.isArray(r.corps) ? r.corps.length : 0);

console.log(`\n  Base interrogée : ${URL_BASE}`);
console.log(`  Identité : ANONYME (clé publiable seule)`);
console.log(`  Site que l'anonyme ne doit pas atteindre : ${SITE_ETRANGER}\n`);

// ── Attaque 1 — lecture du stock d'un site étranger ─────────────────────
for (const fonction of ['nexus_stock_lire_etat_json', 'nexus_stock_lire_etat']) {
  const r = await appeler(fonction, { p_site: SITE_ETRANGER });
  verifier(
    `${fonction}({p_site:"${SITE_ETRANGER}"}) en anonyme`,
    r.statut !== 200,
    r.statut === 200
      ? `RÉGRESSION : ${nbLignes(r)} ligne(s) de stock rendues sans authentification.`
      : `refus ${r.statut} — ${(r.corps && (r.corps.message || r.corps.hint)) || 'sans message'}`
  );
}

// ── Attaque 2 — énumération de l'annuaire des employés ──────────────────
const annuaire = await lire('employees_public?select=*');
verifier(
  'GET employees_public en anonyme',
  annuaire.statut !== 200 || nbLignes(annuaire) === 0,
  annuaire.statut === 200 && nbLignes(annuaire) > 0
    ? `RÉGRESSION : ${nbLignes(annuaire)} employé(s) listés sans authentification.`
    : `refus ${annuaire.statut}`
);

// Énumération par joker : `ilike` interprétait % et _, un seul appel suffisait.
const joker = await appeler('nexus_identifiant_de_connexion', { p_prenom: '%' });
verifier(
  'nexus_identifiant_de_connexion({p_prenom:"%"}) — pas de joker',
  !(joker.statut === 200 && typeof joker.corps === 'string' && joker.corps.length > 0),
  joker.statut === 200 ? `réponse : ${JSON.stringify(joker.corps)}` : `refus ${joker.statut}`
);

// ── Portes déjà fermées le 04/09 : on vérifie qu'elles le restent ───────
for (const table of ['sites', 'employees', 'api_keys', 'raw_sales']) {
  const r = await lire(`${table}?select=*&limit=5`);
  verifier(`GET ${table} en anonyme`, r.statut !== 200 || nbLignes(r) === 0,
    r.statut === 200 ? `RÉGRESSION : ${nbLignes(r)} ligne(s).` : `refus ${r.statut}`);
}

// ── Et la connexion, elle, doit continuer de fonctionner ────────────────
// Une porte fermée qui empêche les employés d'entrer n'est pas une réussite.
if (PRENOM) {
  const r = await appeler('nexus_identifiant_de_connexion', { p_prenom: PRENOM });
  const trouve = r.statut === 200 && typeof r.corps === 'string' && r.corps.length > 0;
  console.log(`${trouve ? 'OK     ' : 'CASSÉ  '} — la connexion résout encore « ${PRENOM} »` +
    (trouve ? '' : `\n           statut ${r.statut} — ${JSON.stringify(r.corps)}`));
  if (!trouve) echecs++;
}

console.log(`\n  ${echecs === 0 ? 'Aucune porte ouverte.' : `${echecs} porte(s) encore ouverte(s).`}\n`);
process.exit(echecs ? 1 : 0);
