// LANG-003 — le tiret cadratin dans ce que NEXUS DIT.
//
// Portée arbitrée par Frédéric Bragance le 08/09/2026
// (`docs/handoff/lots/NEXUS-PHILOSOPHIE-LANGAGE-AUDIT-1-20260908/decision-1.md`,
// portée 1) : la règle vise le contenu produit par NEXUS et lu par
// l'utilisateur final, et lui seul. Les commentaires de développement, la
// doctrine, la gouvernance et le Handoff sont HORS PORTÉE — et c'est pour cela
// que cette garde ne regarde ni `docs/`, ni `outils/`, ni les commentaires.
//
// POURQUOI ELLE N'EXIGE PAS ZÉRO. Mesure réelle du 08/09/2026, commentaires
// HTML et JS retirés : 1 292 occurrences dans 119 fichiers d'écran et de
// moteur. QA-002 dit ce qui serait arrivé en câblant l'exigence « aucune » :
// un mur de signalements dès le premier run, une garde désactivée dans la
// semaine, et ses vraies trouvailles emportées avec elle.
//
// Elle pose donc un PLAFOND PAR FICHIER, mesuré aujourd'hui, et refuse qu'il
// monte. La règle est ainsi vraie tout de suite pour tout ce que NEXUS écrira
// désormais, sans exiger la réécriture préalable de 1 292 phrases — laquelle
// est un chantier de produit, pas une décision d'outillage.
//
// ET LE PLAFOND NE PEUT QUE DESCENDRE. Un plafond laissé au-dessus de la
// mesure autoriserait silencieusement à réintroduire des tirets jusqu'à
// l'ancien niveau : le compteur dirait « conforme » pendant que la situation
// se dégrade. C'est le silence rassurant que NEXUS combat partout ailleurs.
// Corriger des phrases fait donc échouer cette garde, avec l'instruction
// d'abaisser le plafond — un échec qui demande d'enregistrer un progrès.

'use strict';
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const PLAFONDS = path.join(RACINE, 'docs', 'gouvernance', 'LANGAGE-NEXUS-PLAFONDS.json');
const CADRATIN = '—';

// Ce que « lu par l'utilisateur final » désigne mécaniquement : les écrans et
// les moteurs dont les phrases sont affichées. Rien d'autre n'est deviné.
const EN_PORTEE = /^(NEXUS-.*\.html|nexus-.*\.js)$/;

function sansCommentairesHtml(src) {
  return src.replace(/<!--[\s\S]*?-->/g, ' ');
}

// Retire les commentaires JS SANS toucher aux chaînes : un `//` dans une URL ou
// un `/*` dans une phrase ne sont pas des commentaires. C'est la première
// version de cette mesure qui l'a appris — elle comptait 1 485 occurrences,
// dont deux cents vivaient dans des commentaires HTML qu'elle ne voyait pas.
function sansCommentairesJs(src) {
  let out = '', i = 0; const n = src.length; let ctx = null;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (ctx) {
      out += c;
      if (c === '\\') { out += d || ''; i += 2; continue; }
      if (c === ctx) ctx = null;
      i++; continue;
    }
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    if (c === "'" || c === '"' || c === '`') { ctx = c; out += c; i++; continue; }
    out += c; i++;
  }
  return out;
}

function chainesAffichees(src) {
  const t = [];
  const re = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
  let m;
  while ((m = re.exec(src))) {
    const s = m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3];
    if (s && s.includes(CADRATIN)) t.push(s.replace(/\s+/g, ' ').trim());
  }
  return t;
}

function mesurerFichier(source) {
  const net = sansCommentairesJs(sansCommentairesHtml(source));
  return chainesAffichees(net).length;
}

function mesurer(racine) {
  const base = racine || RACINE;
  const compte = {};
  for (const f of fs.readdirSync(base).sort()) {
    if (!EN_PORTEE.test(f)) continue;
    const n = mesurerFichier(fs.readFileSync(path.join(base, f), 'utf8'));
    if (n > 0) compte[f] = n;
  }
  return compte;
}

function lirePlafonds(chemin) {
  const c = chemin || PLAFONDS;
  if (!fs.existsSync(c)) return null; // absent : on ne conclut rien, on le DIT
  try { return JSON.parse(fs.readFileSync(c, 'utf8')); } catch (e) { return null; }
}

// Compare la mesure aux plafonds. Deux écarts, et ils ne disent pas la même
// chose : `AJOUT` est une régression, `PLAFOND_PERIME` est un progrès non
// enregistré. Les confondre laisserait croire qu'on a fait une faute en
// corrigeant une phrase.
function controler(options = {}) {
  const compte = options.compte || mesurer(options.racine);
  const ref = options.plafonds || lirePlafonds(options.cheminPlafonds);
  if (!ref || !ref.plafonds) {
    return { indisponible: 'Plafonds LANG-003 absents ou illisibles : aucune conclusion possible.' };
  }
  const plafonds = ref.plafonds;
  const ecarts = [];
  for (const [f, n] of Object.entries(compte)) {
    const max = Object.prototype.hasOwnProperty.call(plafonds, f) ? plafonds[f] : 0;
    if (n > max) ecarts.push({ type: 'AJOUT', fichier: f, mesure: n, plafond: max, delta: n - max });
  }
  for (const [f, max] of Object.entries(plafonds)) {
    const n = compte[f] || 0;
    if (n < max) ecarts.push({ type: 'PLAFOND_PERIME', fichier: f, mesure: n, plafond: max, delta: max - n });
  }
  const total = Object.values(compte).reduce((a, b) => a + b, 0);
  return { indisponible: null, ecarts, compte, total,
    totalPlafond: Object.values(plafonds).reduce((a, b) => a + b, 0) };
}

module.exports = { mesurer, mesurerFichier, controler, lirePlafonds,
  sansCommentairesJs, sansCommentairesHtml, chainesAffichees, EN_PORTEE, CADRATIN, PLAFONDS };

if (require.main === module) {
  const r = controler();
  if (r.indisponible) { console.log(r.indisponible); process.exit(0); }
  const ajouts = r.ecarts.filter(e => e.type === 'AJOUT');
  const perimes = r.ecarts.filter(e => e.type === 'PLAFOND_PERIME');
  if (!r.ecarts.length) {
    console.log(`LANG-003 : conforme — ${r.total} tiret(s) cadratin dans le contenu affiché, aucun ajout.`);
    process.exit(0);
  }
  if (ajouts.length) {
    console.log(`LANG-003 — ${ajouts.length} fichier(s) ont GAGNÉ des tirets cadratins dans du contenu affiché :`);
    for (const e of ajouts) console.log(`  + ${e.delta}  ${e.fichier} (${e.mesure} pour un plafond de ${e.plafond})`);
    console.log('\nLe tiret cadratin est proscrit de ce que NEXUS dit à l’utilisateur (LANG-003, portée 1).');
  }
  if (perimes.length) {
    console.log(`\nLANG-003 — ${perimes.length} plafond(s) à ABAISSER (des phrases ont été corrigées) :`);
    for (const e of perimes) console.log(`  − ${e.delta}  ${e.fichier} : ${e.plafond} → ${e.mesure}`);
    console.log('\nUn plafond laissé au-dessus de la mesure autorise à réintroduire en silence.');
  }
  process.exit(1);
}
