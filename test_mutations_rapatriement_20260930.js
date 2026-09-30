#!/usr/bin/env node
'use strict';
// Épreuves de MUTATION — les gardes du rapatriement mordent-elles vraiment ?
//
// POURQUOI CE FICHIER EXISTE. Le 08/09/2026, quatre gardes de ce dépôt étaient
// vertes et inutiles : elles passaient parce que rien ne les mettait à
// l'épreuve. La détection statique ne l'avait pas vu ; seule la mutation l'a
// montré. Une suite d'épreuves qui passe ne prouve donc rien sur ce qu'elle
// protège. Ce qui le prouve, c'est : je débranche la garde, et l'épreuve
// rougit. Si elle reste verte, la garde ne servait à rien.
//
// CE QU'ON MUTE. Le CONTRAT de la garde, pas son environnement. « Débrancher
// l'aide », pas « casser l'aide » : chaque mutation remplace un contrôle par sa
// version permissive — exactement ce qu'un auteur pressé écrirait — et laisse
// tout le reste intact. Une mutation qui casserait la syntaxe prouverait
// seulement que Node sait lire du JavaScript.
//
// UNE SEULE MUTATION À LA FOIS. « Deux mutations concurrentes ne mesurent
// rien » : la seconde restaure ce que la première avait cassé, et le vert
// ressemble alors au vrai défaut. On applique, on mesure, on restaure.
//
// ON NE MUTE PAS LE DÉPÔT. Première version de ce banc : il écrivait dans
// `outils/`, mesurait, restaurait. Ça marchait — tant que rien d'autre ne lisait
// ces fichiers au même instant. Or la suite NEXUS est parallèle, et elle ne sait
// sérialiser que les épreuves touchant `PREPROD-CYCLE` ; une autre épreuve
// pouvait donc lire un module muté et rougir pour une raison inventée. Le banc
// travaille désormais sur une COPIE jetable : le dépôt n'est jamais écrit, il
// n'y a rien à restaurer, et aucune exclusivité n'est nécessaire.

const assert = require('assert');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const QUALIF = 'outils/qualifier-rapatriement.js';
const ETAT = 'outils/etat-maillon.js';
const WATCH = 'outils/watchdog-stagnation.js';
const WORKFLOW = '.github/workflows/tests.yml';
const DESIG = 'outils/designation-rail.js';
const RAPAT = 'outils/rapatrier-vers-rail.js';
const EPREUVES = ['test_qualifier_rapatriement_20260930.js', 'test_etat_maillon_20260930.js',
  'test_watchdog_stagnation_20260930.js', 'test_cablage_maillons_20260930.js',
  'test_designation_rail_20260930.js', 'test_rapatriement_vers_rail_20260930.js'];

// Chaque mutation : le fichier, le texte exact remplacé, son remplacement
// permissif, et l'épreuve qui DOIT rougir.
const MUTATIONS = [
  { nom: 'mauvaise NEXUS_BASE_BRANCH acceptée', f: QUALIF,
    de: "if (String(a.baseBranch).trim() !== String(a.rail).trim()) {",
    a: "if (false) {" },
  { nom: 'NEXUS_BASE_BRANCH absente devinée', f: QUALIF,
    de: "  if (vide(a.baseBranch)) {",
    a: "  if (false) {" },
  { nom: 'branche sans lot identifiable acceptée', f: QUALIF,
    de: "  if (vide(a.lot)) {",
    a: "  if (false) {" },
  { nom: 'résultat d’un autre lot accepté', f: QUALIF,
    de: "  if (!porte(refs.memes)) {",
    a: "  if (false) {" },
  { nom: 'homonyme accepté comme rattachement', f: QUALIF,
    de: "  if (porte(refs.homonymes)) {",
    a: "  if (false) {" },
  { nom: 'CI rouge acceptée', f: QUALIF,
    de: "  const pasVertes = requis.filter(v => String(v.conclusion) !== 'success');",
    a: "  const pasVertes = [];" },
  { nom: 'CI non mesurée acceptée', f: QUALIF,
    de: "  if (!verifs) {",
    a: "  if (false && !verifs) {" },
  { nom: 'changement hors périmètre accepté', f: QUALIF,
    de: "    const dehors = touches.filter(c => !perimetre.some(p => c === p || c.startsWith(p.endsWith('/') ? p : `${p}/`)));",
    a: "    const dehors = [];" },
  { nom: 'divergence du rail acceptée', f: QUALIF,
    de: "  if (a.railEstAncetre !== true) {",
    a: "  if (false) {" },
  { nom: 'SHA de base périmé confondu avec une divergence', f: QUALIF,
    de: "    const perime = a.baseEstAncetreDuRail === true;",
    a: "    const perime = false;" },
  { nom: 'transport Production autorisé', f: QUALIF,
    de: "  if (!autorite.transport) {",
    a: "  if (false) {" },
  { nom: 'changement Production accepté', f: QUALIF,
    de: "  const sentinelles = touches.filter(c => SENTINELLES_PRODUCTION.includes(c));",
    a: "  const sentinelles = [];" },
  { nom: 'cible Supabase Production acceptée', f: QUALIF,
    de: "  if (versProduction.length) {",
    a: "  if (false) {" },
  { nom: 'affaiblissement de garde accepté', f: QUALIF,
    de: "  if (affaiblies.length) {",
    a: "  if (false) {" },
  { nom: 'secret accepté', f: QUALIF,
    de: "  if (secrets.length) {",
    a: "  if (false) {" },
  { nom: 'diff non inspectable accepté', f: QUALIF,
    de: "  if (opaques.length) {",
    a: "  if (false) {" },
  { nom: 'HEAD non résolu accepté', f: QUALIF,
    de: "  if (!SHA.test(String(a.head || ''))) {",
    a: "  if (false) {" },
  { nom: 'destination non résolue acceptée', f: QUALIF,
    de: "  if (!SHA.test(String(a.railSha || ''))) {",
    a: "  if (false) {" },
  { nom: 'le détecteur de secret publie ce qu’il dénonce', f: QUALIF,
    de: "        if (m.motif.test(String(ligne))) secrets.push({ chemin, ligne: i + 1, nature: m.nom });",
    a: "        if (m.motif.test(String(ligne))) secrets.push({ chemin, ligne: i + 1, nature: m.nom, valeur: String(ligne) });" },
  { nom: 'arrêt sans les six champs autorisé', f: ETAT,
    de: "    const manquants = CHAMPS_EXIGES.filter(k => vide(c[k]));",
    a: "    const manquants = [];" },
  { nom: 'état hors de la liste fermée toléré', f: ETAT,
    de: "  if (!ETATS.includes(e)) {",
    a: "  if (false) {" },
  { nom: 'refus muet — plus d’état machine en sortie d’étape', f: ETAT,
    de: "  ajouter('GITHUB_OUTPUT', `etat=${r.etat}\\netat_code=${r.code || ''}\\netat_json=${json}\\n`);",
    a: "  ajouter('GITHUB_OUTPUT', ``);" },
  { nom: 'NO_WORK transformé en rouge CI', f: ETAT,
    de: "function codeSortie(r) { return r.etat === 'FAILED' ? 1 : 0; }",
    a: "function codeSortie(r) { return r.etat === 'EXECUTE' ? 0 : 1; }" },
  { nom: 'annotation de run supprimée', f: ETAT,
    de: "  sortie.write(`::${ANNOTATION[r.etat]}::${ligne(r)}\\n`);",
    a: "  sortie.write('');" },
  { nom: "réveil dupliqué republié", f: WATCH,
    de: "  if (publies.includes(signature)) {",
    a: "  if (false) {" },
  { nom: "absence de progression ignorée", f: WATCH,
    de: "  if (derniers.length === CYCLES_SANS_PROGRES - 1 && derniers.every(x => x === courante)) {",
    a: "  if (false) {" },
  { nom: "branche verte jamais rapatriée confondue avec une stagnation quelconque", f: WATCH,
    de: "    const code = position === 'CI_VERTE' ? 'RESULTAT_NON_RAPATRIE' : 'STAGNATION';",
    a: "    const code = 'STAGNATION';" },
  { nom: "stagnation non détectée", f: WATCH,
    de: "  if (ecoulees >= attendu.minutes) {",
    a: "  if (false) {" },
  { nom: "borne de reprises supprimée", f: WATCH,
    de: "  if (reprises >= max) {",
    a: "  if (false) {" },
  { nom: "progression mesurée sur l’existence d’un run", f: WATCH,
    de: "  const c = e || {};",
    a: "  const c = e || {}; return JSON.stringify(c);" },
  { nom: "date d’activité manquante traitée comme zéro", f: WATCH,
    de: "  if (maintenant === null || activite === null) {",
    a: "  if (false) {" },
  { nom: "horloge incohérente tolérée", f: WATCH,
    de: "  if (activite - maintenant > TOLERANCE_HORLOGE_MS) {",
    a: "  if (false) {" },
  { nom: "position de chaîne devinée au lieu d’être déclarée", f: WATCH,
    de: "  if (!position) {",
    a: "  if (false) {" },
  { nom: 'la porte en ligne de commande requalifie l’état demandé', f: ETAT,
    de: "  const champs = { etat: e, code };",
    a:  "  const champs = { etat: 'NO_WORK', code };" },
  { nom: 'la porte avale le code de sortie d’un FAILED', f: ETAT,
    de: "    process.exitCode = principal(process.argv.slice(2));",
    a:  "    principal(process.argv.slice(2)); process.exitCode = 0;" },

  // ── LA DÉSIGNATION DU RAIL ─────────────────────────────────────────────────
  // Six gardes, et une leçon : « une désignation ne se recalcule pas ». Chacune
  // de ces mutations est exactement le raccourci qu'un auteur pressé écrirait.
  { nom: 'corpus non lu confondu avec un corpus vide', f: DESIG,
    de: "  if (!Array.isArray(commentaires)) {",
    a:  "  commentaires = Array.isArray(commentaires) ? commentaires : [];\n  if (false) {" },
  { nom: 'un repli remplace la désignation absente', f: DESIG,
    de: "  if (nommes.length === 0) {",
    a:  "  if (nommes.length === 0) { return { rail: 'handoff-continuite-20260920', origine: 'REPLI' }; }\n  if (false) {" },
  { nom: 'tolérance élargie : un déclencheur étranger s’épingle', f: DESIG,
    de: "  const tol = (typeof tolerance === 'number' ? tolerance : TOLERANCE_SECONDES) * 1000;",
    a:  "  const tol = 86400 * 1000;" },
  { nom: 'filtre d’auteur supprimé', f: DESIG,
    de: "    .filter((c) => !auteurAutorise || c.auteur === auteurAutorise)",
    a:  "    .filter(() => true)" },
  { nom: 'rails protégés rendus désignables', f: DESIG,
    de: "const RAILS_INTERDITS = Object.freeze(['main', 'production']);",
    a:  "const RAILS_INTERDITS = Object.freeze([]);" },
  { nom: 'la grammaire cesse de lire la forme « : »', f: DESIG,
    de: "  /NEXUS_BASE_BRANCH[ \\t]*[:=][ \\t]*[`\"']?([A-Za-z0-9._/-]+)/g;",
    a:  "  /NEXUS_BASE_BRANCH[ \\t]*[=][ \\t]*[`\"']?([A-Za-z0-9._/-]+)/g;" },

  // ── LE RAPATRIEMENT LUI-MÊME ───────────────────────────────────────────────
  { nom: 'le transport devient armé par défaut', f: RAPAT,
    de: "  if (!options.transporter) {",
    a:  "  if (false) {" },
  { nom: 'la destination n’est plus relue après le geste', f: RAPAT,
    de: "  const relu = texte(exec('git', ['ls-remote', 'origin', `refs/heads/${rail}`])).split(/\\s+/)[0] || '';",
    a:  "  const relu = head;" },
  { nom: 'toutes les vérifications sont écartées, pas seulement le run courant', f: RAPAT,
    de: "  const aEcarter = runCourant ? new RegExp(`/runs/${runCourant}(/|$)`) : null;",
    a:  "  const aEcarter = /.*/;" },
  { nom: 'le diff est réduit aux chemins : plus aucun contenu inspecté', f: RAPAT,
    de: "  for (const l of texte(exec('git', ['diff', '--unified=0', plage])).split('\\n')) {",
    a:  "  for (const l of []) {" },
  // Celle-ci ne se mesure QUE par l'exécuteur réel : avec un faux exécuteur,
  // aucune épreuve n'aurait rougi. C'est précisément le trou qui a laissé
  // passer le défaut du 30/09, et cette ligne est ce qui le referme.
  { nom: 'le tampon revient à sa taille par défaut, et le mur se retait', f: RAPAT,
    de: "const TAMPON = 64 * 1024 * 1024;",
    a:  "const TAMPON = 1024 * 1024;" },
  { nom: 'un débordement cesse de se nommer', f: RAPAT,
    de: "      const tronque = err && (err.code === 'ENOBUFS' || /ENOBUFS/.test(String(err.message || '')));",
    a:  "      const tronque = false;" },

  // ── LE CÂBLAGE, PAS SEULEMENT LES MODULES ──────────────────────────────────
  // Les quatre mutations qui suivent ne touchent aucun module : elles rebranchent
  // le workflow tel qu'il était pendant les quatre jours d'arrêt. C'est là que le
  // défaut vivait réellement — les modules, eux, ont toujours été corrects.
  { nom: 'le capteur des branches en rade est rebâillonné par « || true »', f: WORKFLOW,
    de: "RAPPORT=$(node outils/garde-branches-en-rade.js 2>&1); CODE=$?",
    a:  "RAPPORT=$(node outils/garde-branches-en-rade.js 2>&1 || true); CODE=$?" },
  { nom: 'un refus du réveil redevient un echo sans état', f: WORKFLOW,
    de: 'refus() { node outils/etat-maillon.js NO_WORK "$1" --maillon "$M" --motif "$2"; exit 0; }',
    a:  'refus() { echo "rien à faire : $1 — $2"; exit 0; }' },
  { nom: 'la boucle de réveil est rétrogradée en simple information', f: WORKFLOW,
    de: 'node outils/etat-maillon.js FAILED MENTION_REDECLENCHANTE --maillon "$M" \\',
    a:  'node outils/etat-maillon.js NO_WORK MENTION_REDECLENCHANTE --maillon "$M" \\' },
  { nom: 'un arrêt est publié sans prochaine action', f: WORKFLOW,
    de: '--prochaine-action "qualifier puis rapatrier (outils/qualifier-rapatriement.js), ou inscrire le sort dans docs/handoff/BRANCHES-CLASSEES.json" \\',
    a:  '\\' },
];

// Les modules dont dépendent les épreuves recopiées. `transport-autorise.js`
// n'est pas muté, mais le qualifieur l'exige : un bac incomplet rougirait
// partout, et ce rouge-là ne mesurerait rien.
const COPIES = [QUALIF, ETAT, WATCH, DESIG, RAPAT, 'outils/transport-autorise.js', WORKFLOW, ...EPREUVES];
const MUTABLES = [QUALIF, ETAT, WATCH, DESIG, RAPAT, WORKFLOW];

const BAC = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-mutation-'));
fs.mkdirSync(path.join(BAC, 'outils'), { recursive: true });
fs.mkdirSync(path.join(BAC, '.github/workflows'), { recursive: true });
for (const c of COPIES) fs.copyFileSync(c, path.join(BAC, c));

const empreinte = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
function epreuvesVertes() {
  for (const e of EPREUVES) {
    const r = spawnSync(process.execPath, [e], { cwd: BAC, encoding: 'utf8' });
    if (r.status !== 0) return { vert: false, epreuve: e, sortie: (r.stdout || '') + (r.stderr || '') };
  }
  return { vert: true };
}

const original = {}; for (const f of MUTABLES) original[f] = fs.readFileSync(f, 'utf8');
const avant = {}; for (const f of MUTABLES) avant[f] = empreinte(f);

let passees = 0; const echecs = [];
try {
  // ── LE TÉMOIN ──────────────────────────────────────────────────────────────
  // Sans lui, 24 rouges prouveraient seulement que le banc est cassé.
  const temoin = epreuvesVertes();
  if (!temoin.vert) {
    console.error(`\nTÉMOIN ROUGE — les épreuves ne passent pas AVANT mutation (${temoin.epreuve}).`);
    console.error(temoin.sortie);
    process.exit(1);
  }
  passees++;
  console.log('TÉMOIN — les épreuves passent sur le code intact.\n');

  for (const m of MUTATIONS) {
    const src = original[m.f];
    if (!src.includes(m.de)) {
      echecs.push(`${m.nom} — ancre introuvable dans ${m.f} : la mutation ne vise rien. `
        + 'Une mutation mal visée rend une garde muette pour de mauvaises raisons.');
      continue;
    }
    if (src.split(m.de).length - 1 !== 1) {
      echecs.push(`${m.nom} — ancre non unique dans ${m.f} : la mutation en toucherait plusieurs.`);
      continue;
    }
    try {
      fs.writeFileSync(path.join(BAC, m.f), src.replace(m.de, m.a));
      const r = epreuvesVertes();
      if (r.vert) {
        echecs.push(`${m.nom} — LA GARDE NE MORD PAS : mutation appliquée, épreuves toujours vertes.`);
      } else {
        passees++;
        console.log(`  ✓ ${m.nom} → rouge (${r.epreuve})`);
      }
    } finally {
      fs.writeFileSync(path.join(BAC, m.f), src);   // une seule mutation à la fois, toujours
    }
  }
} finally {
  fs.rmSync(BAC, { recursive: true, force: true });
}

// ── LE DÉPÔT N'A PAS ÉTÉ TOUCHÉ ──────────────────────────────────────────────
// Ce n'est pas une restauration qu'on vérifie, c'est une abstention.
for (const f of MUTABLES) {
  try {
    assert.strictEqual(empreinte(f), avant[f], `${f} a été modifié dans le dépôt`);
    passees++;
  } catch (e) { echecs.push(`abstention — ${e.message}`); }
}
try {
  assert.ok(!fs.existsSync(BAC), 'le bac jetable doit être effacé');
  passees++;
} catch (e) { echecs.push(e.message); }

console.log(`\nMutations du rapatriement — ${passees} contrôle(s) passé(s), ${echecs.length} échec(s).`);
for (const e of echecs) console.error(`  ✗ ${e}`);
process.exit(echecs.length ? 1 : 0);
