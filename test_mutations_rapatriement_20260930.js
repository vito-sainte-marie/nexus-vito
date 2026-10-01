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
// L'ÉPREUVE QUI DOIT ROUGIR EST NOMMÉE, PAS CHERCHÉE.
//
// Première version : on lançait les bancs l'un après l'autre jusqu'au premier
// rouge. C'était juste, et ça coûtait 54 s à vide — donc plus de 90 s sous le
// parallélisme de `run-tests.js`, qui coupe à 90 s. Ce banc rougissait alors la
// suite pour une raison qui n'était pas la sienne, et personne n'aurait su le
// lire. Le prix n'était pas celui d'un banc : c'était celui de rejouer six
// bancs dont on savait déjà qu'ils n'allaient pas mordre.
//
// Épingler est AUSSI plus fort que chercher. « Un banc quelconque rougit »
// tolère qu'une garde change de gardien en silence ; « CE banc-là rougit » ne
// le tolère pas. Et quand l'épingle est fausse, ce banc le DIT au lieu de
// l'absoudre : un rouge trouvé chez un autre n'est pas une réussite.
//
// CE BANC NE FAIT PLUS TOURNER L'ÉPREUVE DE CONTINUITÉ, et c'est un revirement
// du même jour. Elle y était, placée en dernier, au cas où elle verrait ce que
// les bancs unitaires laissent passer. La mesure du 30/09 dit qu'aucune des 49
// mutations ne l'atteint : elle coûtait 17 s au témoin pour ne rien démontrer
// ICI. Elle reste dans la suite, lancée pour elle-même par `run-tests.js`, et
// elle porte déjà ses propres maillons cassés (§5 de la mission). Le jour où
// une mutation l'épingle, elle revient toute seule — la liste est déduite.
const X_QUALIF = 'test_qualifier_rapatriement_20260930.js';
const X_ETAT = 'test_etat_maillon_20260930.js';
const X_WATCH = 'test_watchdog_stagnation_20260930.js';
const X_CABLAGE = 'test_cablage_maillons_20260930.js';
const X_DESIG = 'test_designation_rail_20260930.js';
const X_RAPAT = 'test_rapatriement_vers_rail_20260930.js';
const X_PERM = 'test_permissions_workflow_20260908.js';
const X_CIBLE = 'test_cible_production_vs_mention_20261001.js';

// Chaque mutation : le fichier, le texte exact remplacé, son remplacement
// permissif, et l'épreuve qui DOIT rougir.
const MUTATIONS = [
  { nom: 'mauvaise NEXUS_BASE_BRANCH acceptée', f: QUALIF, rouge: X_QUALIF,
    de: "if (String(a.baseBranch).trim() !== String(a.rail).trim()) {",
    a: "if (false) {" },
  { nom: 'NEXUS_BASE_BRANCH absente devinée', f: QUALIF, rouge: X_QUALIF,
    de: "  if (vide(a.baseBranch)) {",
    a: "  if (false) {" },
  { nom: 'branche sans lot identifiable acceptée', f: QUALIF, rouge: X_QUALIF,
    de: "  if (vide(a.lot)) {",
    a: "  if (false) {" },
  { nom: 'résultat d’un autre lot accepté', f: QUALIF, rouge: X_QUALIF,
    de: "  if (!porte(refs.memes)) {",
    a: "  if (false) {" },
  { nom: 'homonyme accepté comme rattachement', f: QUALIF, rouge: X_QUALIF,
    de: "  if (porte(refs.homonymes)) {",
    a: "  if (false) {" },
  { nom: 'CI rouge acceptée', f: QUALIF, rouge: X_QUALIF,
    de: "  const pasVertes = requis.filter(v => String(v.conclusion) !== 'success');",
    a: "  const pasVertes = [];" },
  { nom: 'CI non mesurée acceptée', f: QUALIF, rouge: X_QUALIF,
    de: "  if (!verifs) {",
    a: "  if (false && !verifs) {" },
  { nom: 'changement hors périmètre accepté', f: QUALIF, rouge: X_QUALIF,
    de: "    const dehors = touches.filter(c => !perimetre.some(p => c === p || c.startsWith(p.endsWith('/') ? p : `${p}/`)));",
    a: "    const dehors = [];" },
  { nom: 'divergence du rail acceptée', f: QUALIF, rouge: X_QUALIF,
    de: "  if (a.railEstAncetre !== true) {",
    a: "  if (false) {" },
  { nom: 'SHA de base périmé confondu avec une divergence', f: QUALIF, rouge: X_QUALIF,
    de: "    const perime = a.baseEstAncetreDuRail === true;",
    a: "    const perime = false;" },
  { nom: 'transport Production autorisé', f: QUALIF, rouge: X_QUALIF,
    de: "  if (!autorite.transport) {",
    a: "  if (false) {" },
  { nom: 'changement Production accepté', f: QUALIF, rouge: X_QUALIF,
    de: "  const sentinelles = touches.filter(c => SENTINELLES_PRODUCTION.includes(c));",
    a: "  const sentinelles = [];" },
  { nom: 'cible Supabase Production acceptée', f: QUALIF, rouge: X_QUALIF,
    de: "  if (versProduction.length) {",
    a: "  if (false) {" },
  { nom: 'affaiblissement de garde accepté', f: QUALIF, rouge: X_QUALIF,
    de: "  if (affaiblies.length) {",
    a: "  if (false) {" },
  { nom: 'secret accepté', f: QUALIF, rouge: X_QUALIF,
    de: "  if (secrets.length) {",
    a: "  if (false) {" },
  { nom: 'diff non inspectable accepté', f: QUALIF, rouge: X_QUALIF,
    de: "  if (opaques.length) {",
    a: "  if (false) {" },
  { nom: 'HEAD non résolu accepté', f: QUALIF, rouge: X_QUALIF,
    de: "  if (!SHA.test(String(a.head || ''))) {",
    a: "  if (false) {" },
  { nom: 'destination non résolue acceptée', f: QUALIF, rouge: X_QUALIF,
    de: "  if (!SHA.test(String(a.railSha || ''))) {",
    a: "  if (false) {" },
  { nom: 'le détecteur de secret publie ce qu’il dénonce', f: QUALIF, rouge: X_QUALIF,
    de: "        if (m.motif.test(String(ligne))) secrets.push({ chemin, ligne: i + 1, nature: m.nom });",
    a: "        if (m.motif.test(String(ligne))) secrets.push({ chemin, ligne: i + 1, nature: m.nom, valeur: String(ligne) });" },
  { nom: 'arrêt sans les six champs autorisé', f: ETAT, rouge: X_ETAT,
    de: "    const manquants = CHAMPS_EXIGES.filter(k => vide(c[k]));",
    a: "    const manquants = [];" },
  { nom: 'état hors de la liste fermée toléré', f: ETAT, rouge: X_ETAT,
    de: "  if (!ETATS.includes(e)) {",
    a: "  if (false) {" },
  { nom: 'refus muet — plus d’état machine en sortie d’étape', f: ETAT, rouge: X_ETAT,
    de: "  ajouter('GITHUB_OUTPUT', `etat=${r.etat}\\netat_code=${r.code || ''}\\netat_json=${json}\\n`);",
    a: "  ajouter('GITHUB_OUTPUT', ``);" },
  { nom: 'NO_WORK transformé en rouge CI', f: ETAT, rouge: X_ETAT,
    de: "function codeSortie(r) { return r.etat === 'FAILED' ? 1 : 0; }",
    a: "function codeSortie(r) { return r.etat === 'EXECUTE' ? 0 : 1; }" },
  { nom: 'annotation de run supprimée', f: ETAT, rouge: X_ETAT,
    de: "  sortie.write(`::${ANNOTATION[r.etat]}::${ligne(r)}\\n`);",
    a: "  sortie.write('');" },
  { nom: "réveil dupliqué republié", f: WATCH, rouge: X_WATCH,
    de: "  if (publies.includes(signature)) {",
    a: "  if (false) {" },
  { nom: "absence de progression ignorée", f: WATCH, rouge: X_WATCH,
    de: "  if (derniers.length === CYCLES_SANS_PROGRES - 1 && derniers.every(x => x === courante)) {",
    a: "  if (false) {" },
  { nom: "branche verte jamais rapatriée confondue avec une stagnation quelconque", f: WATCH, rouge: X_WATCH,
    de: "    const code = position === 'CI_VERTE' ? 'RESULTAT_NON_RAPATRIE' : 'STAGNATION';",
    a: "    const code = 'STAGNATION';" },
  { nom: "stagnation non détectée", f: WATCH, rouge: X_WATCH,
    de: "  if (ecoulees >= attendu.minutes) {",
    a: "  if (false) {" },
  { nom: "borne de reprises supprimée", f: WATCH, rouge: X_WATCH,
    de: "  if (reprises >= max) {",
    a: "  if (false) {" },
  { nom: "progression mesurée sur l’existence d’un run", f: WATCH, rouge: X_WATCH,
    de: "  const c = e || {};",
    a: "  const c = e || {}; return JSON.stringify(c);" },
  { nom: "date d’activité manquante traitée comme zéro", f: WATCH, rouge: X_WATCH,
    de: "  if (maintenant === null || activite === null) {",
    a: "  if (false) {" },
  { nom: "horloge incohérente tolérée", f: WATCH, rouge: X_WATCH,
    de: "  if (activite - maintenant > TOLERANCE_HORLOGE_MS) {",
    a: "  if (false) {" },
  { nom: "position de chaîne devinée au lieu d’être déclarée", f: WATCH, rouge: X_WATCH,
    de: "  if (!position) {",
    a: "  if (false) {" },
  { nom: 'la porte en ligne de commande requalifie l’état demandé', f: ETAT, rouge: X_ETAT,
    de: "  const champs = { etat: e, code };",
    a:  "  const champs = { etat: 'NO_WORK', code };" },
  { nom: 'la porte avale le code de sortie d’un FAILED', f: ETAT, rouge: X_ETAT,
    de: "    process.exitCode = principal(process.argv.slice(2));",
    a:  "    principal(process.argv.slice(2)); process.exitCode = 0;" },

  // ── LA DÉSIGNATION DU RAIL ─────────────────────────────────────────────────
  // Six gardes, et une leçon : « une désignation ne se recalcule pas ». Chacune
  // de ces mutations est exactement le raccourci qu'un auteur pressé écrirait.
  { nom: 'corpus non lu confondu avec un corpus vide', f: DESIG, rouge: X_DESIG,
    de: "  if (!Array.isArray(commentaires)) {",
    a:  "  commentaires = Array.isArray(commentaires) ? commentaires : [];\n  if (false) {" },
  { nom: 'un repli remplace la désignation absente', f: DESIG, rouge: X_DESIG,
    de: "  if (nommes.length === 0) {",
    a:  "  if (nommes.length === 0) { return { rail: 'handoff-continuite-20260920', origine: 'REPLI' }; }\n  if (false) {" },
  { nom: 'tolérance élargie : un déclencheur étranger s’épingle', f: DESIG, rouge: X_DESIG,
    de: "  const tol = (typeof tolerance === 'number' ? tolerance : TOLERANCE_SECONDES) * 1000;",
    a:  "  const tol = 86400 * 1000;" },
  { nom: 'filtre d’auteur supprimé', f: DESIG, rouge: X_DESIG,
    de: "    .filter((c) => !auteurAutorise || c.auteur === auteurAutorise)",
    a:  "    .filter(() => true)" },
  { nom: 'rails protégés rendus désignables', f: DESIG, rouge: X_DESIG,
    de: "const RAILS_INTERDITS = Object.freeze(['main', 'production']);",
    a:  "const RAILS_INTERDITS = Object.freeze([]);" },
  { nom: 'la grammaire cesse de lire la forme « : »', f: DESIG, rouge: X_DESIG,
    de: "  /NEXUS_BASE_BRANCH[ \\t]*[:=][ \\t]*[`\"']?([A-Za-z0-9._/-]+)/g;",
    a:  "  /NEXUS_BASE_BRANCH[ \\t]*[=][ \\t]*[`\"']?([A-Za-z0-9._/-]+)/g;" },

  // ── LE RAPATRIEMENT LUI-MÊME ───────────────────────────────────────────────
  { nom: 'le transport devient armé par défaut', f: RAPAT, rouge: X_RAPAT,
    de: "  if (!options.transporter) {",
    a:  "  if (false) {" },
  { nom: 'la destination n’est plus relue après le geste', f: RAPAT, rouge: X_RAPAT,
    de: "  const relu = texte(exec('git', ['ls-remote', 'origin', `refs/heads/${rail}`])).split(/\\s+/)[0] || '';",
    a:  "  const relu = head;" },
  { nom: 'toutes les vérifications sont écartées, pas seulement le run courant', f: RAPAT, rouge: X_RAPAT,
    de: "  const aEcarter = runCourant ? new RegExp(`/runs/${runCourant}(/|$)`) : null;",
    a:  "  const aEcarter = /.*/;" },
  { nom: 'le diff est réduit aux chemins : plus aucun contenu inspecté', f: RAPAT, rouge: X_RAPAT,
    de: "  for (const l of texte(exec('git', ['diff', '--unified=0', plage])).split('\\n')) {",
    a:  "  for (const l of []) {" },
  // Celle-ci ne se mesure QUE par l'exécuteur réel : avec un faux exécuteur,
  // aucune épreuve n'aurait rougi. C'est précisément le trou qui a laissé
  // passer le défaut du 30/09, et cette ligne est ce qui le referme.
  { nom: 'le tampon revient à sa taille par défaut, et le mur se retait', f: RAPAT, rouge: X_RAPAT,
    de: "const TAMPON = 64 * 1024 * 1024;",
    a:  "const TAMPON = 1024 * 1024;" },
  { nom: 'la cible Production est cherchée dans tout le fichier, pas dans l’ajout', f: QUALIF, rouge: X_QUALIF,
    de: "    const lignes = surAjouts ? d.lignes_ajoutees : String(lire(c) || '').split('\\n');",
    a:  "    const lignes = String(lire(c) || '').split('\\n');" },

  // ── NOMMER PRODUCTION N'EST PAS LA VISER (01/10/2026) ──────────────────────
  // Les quatre mutations qui gardent la correction du refus de `119b2f8f`.
  // Chacune rend la garde soit aveugle, soit inutilisable — les deux façons
  // dont elle a déjà échoué.
  //
  // Celle-ci EST le défaut du 30/09, à la ligne près : la mention nue redevient
  // une cible partout, y compris dans un commentaire et dans la documentation.
  { nom: 'la mention nue de Production redevient une cible partout', f: QUALIF, rouge: X_CIBLE,
    de: "        if (!parole && !LIGNE_COMMENTAIRE.test(texte)) {",
    a:  "        if (true) {" },
  // L'inverse : la garde cesse de voir les formes actionnables et ne juge plus
  // que des mentions. Une adresse `…​.supabase.co` passerait alors en prose.
  { nom: 'les formes actionnables ne sont plus cherchées', f: QUALIF, rouge: X_CIBLE,
    de: "      for (const f of FORMES_CIBLE_PRODUCTION) {",
    a:  "      for (const f of []) {" },
  // Le motif de commentaire reconnaît toute ligne. C'est l'erreur réellement
  // commise en écrivant la correction : l'alternative `\\*` du motif signifiait
  // « zéro backslash ou plus ». La garde était désarmée sans rien en dire.
  { nom: 'toute ligne est tenue pour un commentaire inerte', f: QUALIF, rouge: X_CIBLE,
    de: "const LIGNE_COMMENTAIRE = /^\\s*(\\/\\/|\\/\\*|\\*|#|--|<!--)/;",
    a:  "const LIGNE_COMMENTAIRE = /^/;" },
  // Le refus cesse de désigner. Il reste publié, et redevient inactionnable :
  // c'est ce qui a obligé à rejouer la qualification en local le 01/10 pour
  // savoir quels fichiers corriger.
  { nom: 'le refus compte les fichiers au lieu de les nommer', f: QUALIF, rouge: X_CIBLE,
    de: "dans ${versProduction.length} fichier(s) : ${nommes}.",
    a:  "dans ${versProduction.length} fichier(s)." },
  { nom: 'le repli conservateur devient un silence quand les lignes manquent', f: QUALIF, rouge: X_QUALIF,
    de: "    const surAjouts = d && Array.isArray(d.lignes_ajoutees);",
    a:  "    const surAjouts = true; if (!d || !Array.isArray(d.lignes_ajoutees)) continue;" },
  { nom: 'un nom désignant deux commits est arbitré en silence', f: RAPAT, rouge: X_RAPAT,
    de: "  if (shaLocal && shaDistant && shaLocal !== shaDistant) {",
    a:  "  if (false) {" },
  { nom: 'la ref d’où vient le commit n’est plus nommée', f: RAPAT, rouge: X_RAPAT,
    de: "  const refHead = shaLocal ? `refs/heads/${branche}` : (shaDistant ? `refs/remotes/origin/${branche}` : null);",
    a:  "  const refHead = null;" },
  { nom: 'un débordement cesse de se nommer', f: RAPAT, rouge: X_RAPAT,
    de: "      const tronque = err && (err.code === 'ENOBUFS' || /ENOBUFS/.test(String(err.message || '')));",
    a:  "      const tronque = false;" },
  // ── QUI EXIGE QUOI — la réparation du 30/09/2026 ────────────────────────────
  //
  // Mesuré ce jour-là : tout check accroché au commit était tenu pour requis, donc
  // `Supabase Preview` — structurellement `skipped`, braqué sur le projet
  // Supabase de PRODUCTION, exigé par aucun ruleset — arrêtait chaque transport
  // vers le rail. Les six mutations qui suivent attaquent la réparation par ses
  // deux faces : la désignation doit être LUE sur la destination, et à défaut
  // retomber sur une constante qui SERRE. Une réparation dont on peut supprimer
  // un morceau sans rien rougir n'est pas une réparation.
  { nom: 'tout check accroché au commit redevient requis — le défaut du 30/09', f: RAPAT, rouge: X_RAPAT,
    de: "    { nom, conclusion, requis: contextes.includes(nom), autorite }, extra || {});",
    a:  "    { nom, conclusion, requis: true, autorite }, extra || {});" },
  { nom: 'la déclaration de repli se vide : zéro contrôle obligatoire', f: RAPAT, rouge: X_RAPAT,
    de: "const REQUIS_A_DEFAUT_20260930 = ['non-regression'];",
    a:  "const REQUIS_A_DEFAUT_20260930 = [];" },
  { nom: 'l’autorité lue est ignorée : on retombe toujours sur le repli', f: RAPAT, rouge: X_RAPAT,
    de: "  const mesure = Array.isArray(declares) && declares.length > 0;",
    a:  "  const mesure = false;" },
  { nom: 'le dossier prétend avoir lu une autorité qui n’a pas répondu', f: RAPAT, rouge: X_RAPAT,
    de: "    : (Array.isArray(declares) ? 'DEFAUT_DECLARE_20260930'",
    a:  "    : (true ? 'DEFAUT_DECLARE_20260930'" },
  { nom: 'le verdict du run courant n’est plus réinjecté : écarté sans remplaçant', f: RAPAT, rouge: X_RAPAT,
    de: "  if (mienne && verdict) liste.push(marquer(mienne.nom, verdict, { provenance: 'ETAT_DU_JOB' }));",
    a:  "  if (false) liste.push(marquer(mienne.nom, verdict, { provenance: 'ETAT_DU_JOB' }));" },
  { nom: 'le check démoti est effacé du dossier au lieu d’être rapporté', f: QUALIF, rouge: X_QUALIF,
    de: "  const nonRequises = verifs.filter((v) => v.requis === false);",
    a:  "  const nonRequises = [];" },

  // ── LE CÂBLAGE, PAS SEULEMENT LES MODULES ──────────────────────────────────
  // Les quatre mutations qui suivent ne touchent aucun module : elles rebranchent
  // le workflow tel qu'il était pendant les quatre jours d'arrêt. C'est là que le
  // défaut vivait réellement — les modules, eux, ont toujours été corrects.
  { nom: 'le capteur des branches en rade est rebâillonné par « || true »', f: WORKFLOW, rouge: X_CABLAGE,
    de: "RAPPORT=$(node outils/garde-branches-en-rade.js 2>&1); CODE=$?",
    a:  "RAPPORT=$(node outils/garde-branches-en-rade.js 2>&1 || true); CODE=$?" },
  // Le `-e` de GitHub, désarmé — mesuré en vol le 30/09, pas déduit.
  //
  // `shell: bash` est lancé `/usr/bin/bash -e {0}`. Sous `-e`, l'affectation dont
  // la commande échoue tue le step AVANT la ligne qui lit `$?` : rien ne s'imprime,
  // aucun état de maillon n'est publié, le run montre un rouge nu. `set -uo pipefail`
  // ne désarme PAS `-e` — c'est la confusion qui a coûté le coup.
  //
  // Le prix exact : l'étape des branches en rade est morte le jour où la garde avait
  // enfin quelque chose à dire. Une étape écrite pour supprimer les refus silencieux
  // en produisait un. Cette mutation remet ce défaut précis.
  { nom: 'le `-e` de GitHub est réarmé sous une lecture de `$?`', f: WORKFLOW, rouge: X_CABLAGE,
    de: "          set +e\n          RAPPORT=$(node outils/garde-branches-en-rade.js 2>&1); CODE=$?",
    a:  "          RAPPORT=$(node outils/garde-branches-en-rade.js 2>&1); CODE=$?" },
  { nom: 'un refus du réveil redevient un echo sans état', f: WORKFLOW, rouge: X_CABLAGE,
    de: 'refus() { node outils/etat-maillon.js NO_WORK "$1" --maillon "$M" --motif "$2"; exit 0; }',
    a:  'refus() { echo "rien à faire : $1 — $2"; exit 0; }' },
  { nom: 'la boucle de réveil est rétrogradée en simple information', f: WORKFLOW, rouge: X_CABLAGE,
    de: 'node outils/etat-maillon.js FAILED MENTION_REDECLENCHANTE --maillon "$M" \\',
    a:  'node outils/etat-maillon.js NO_WORK MENTION_REDECLENCHANTE --maillon "$M" \\' },
  // ── Mutations de CÂBLAGE ─────────────────────────────────────────
  // Celles-ci ne cassent pas un contrôle isolé : elles cassent le LIEN entre deux
  // maillons. On les a ajoutées en pariant que seule l'épreuve de bout en bout les
  // verrait ; MESURE DU 30/09 : les trois sont mordues par un banc unitaire, et la
  // colonne « → rouge (…) » le dit. Le pari était faux, on le laisse écrit plutôt
  // que de réécrire l'histoire : à ce jour AUCUNE mutation de ce banc n'exige
  // l'épreuve de continuité pour être vue. Ce qui la justifie est ailleurs, et c'est
  // un fait et non une intention : elle a trouvé un défaut réel que les six bancs
  // unitaires laissaient passer — un dossier de transport qui ne nommait pas la ref
  // d'où venait le commit, alors que le commentaire du code affirmait le contraire.
  { nom: 'un refus qualifié n’arrête plus le transport', f: RAPAT, rouge: X_RAPAT,
    de: "  if (resultat.etat !== 'EXECUTE') return resultat;",
    a: '  if (false) return resultat;' },
  { nom: 'la progression cesse de regarder le SHA', f: WATCH, rouge: X_WATCH,
    de: "    String(c.sha || '(sans sha)').trim(),",
    a: "    '(sans sha)'," },
  { nom: 'le dossier annonce une destination qui n’a pas bougé', f: QUALIF, rouge: X_QUALIF,
    de: 'destination_sha_attendu: a.head,',
    a: 'destination_sha_attendu: a.railSha,' },
  { nom: 'un arrêt est publié sans prochaine action', f: WORKFLOW, rouge: X_CABLAGE,
    de: '--prochaine-action "qualifier puis rapatrier (outils/qualifier-rapatriement.js), ou inscrire le sort dans docs/handoff/BRANCHES-CLASSEES.json" \\',
    a:  '\\' },
  // Le jeton de CI est confié à l'étape de rapatriement depuis le 30/09. Ce
  // qui rend ce prêt acceptable n'est pas l'intention écrite au-dessus de la
  // liste : c'est que le module n'appelle `gh` que pour lire. Cette mutation
  // lui donne une plume, et exige que quelqu'un le dise.
  { nom: 'le jeton du rapatriement se met à écrire sur l’issue', f: RAPAT, rouge: X_PERM,
    de: "'--jq', '.[] | {date: .created_at, auteur: .user.login, corps: .body} | tostring']);",
    a:  "'--method', 'POST', '-f', 'body=rapatrié']);" },
];

// UNE MUTATION SANS ÉPINGLE EST UN REFUS, PAS UN PLANTAGE. Le 30/09, neuf
// mutations sont restées sans `rouge` parce que le script qui a posé les
// épingles lisait `nom: '…'` et pas `nom: "…"`. Rien ne l'a dit : la liste
// déduite a simplement porté un `undefined`, et le banc est mort dans
// `path.join` sur un message qui ne nommait ni la mutation ni le manque. Une
// omission doit se dénoncer là où elle se produit, avec le nom de ce qui
// manque.
const BANCS_CONNUS = [X_QUALIF, X_ETAT, X_WATCH, X_CABLAGE, X_DESIG, X_RAPAT, X_PERM, X_CIBLE];
const orphelines = MUTATIONS.filter(m => !BANCS_CONNUS.includes(m.rouge));
if (orphelines.length) {
  console.error(`ÉPINGLE MANQUANTE — ${orphelines.length} mutation(s) ne désignent aucun banc connu :`);
  for (const m of orphelines) console.error(`  ${m.nom} → ${m.rouge === undefined ? 'aucune épingle' : m.rouge}`);
  process.exit(1);
}

// La liste des bancs n'est PAS écrite à la main : elle est déduite des épingles.
// Une liste écrite se périme dans les deux sens — elle garde un banc que plus
// aucune mutation ne vise, et elle oublie celui qu'une mutation neuve épingle.
const EPREUVES = [...new Set(MUTATIONS.map(m => m.rouge))];

// Les modules dont dépendent les épreuves recopiées. On copie `outils/` EN
// ENTIER plutôt qu'une liste nominative : chaque banc charge le module qu'il
// éprouve, qui en charge d'autres, et une liste aurait fini par en oublier un.
// Le témoin serait alors rouge, et ce rouge-là ne mesurerait rien d'autre qu'un
// bac incomplet.
const COPIES = [WORKFLOW, ...EPREUVES];
const MUTABLES = [QUALIF, ETAT, WATCH, DESIG, RAPAT, WORKFLOW];

const BAC = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-mutation-'));
fs.cpSync('outils', path.join(BAC, 'outils'), { recursive: true });
fs.mkdirSync(path.join(BAC, '.github/workflows'), { recursive: true });
for (const c of COPIES) fs.copyFileSync(c, path.join(BAC, c));

const empreinte = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
function lancer(e) {
  const r = spawnSync(process.execPath, [e], { cwd: BAC, encoding: 'utf8' });
  return { vert: r.status === 0, sortie: (r.stdout || '') + (r.stderr || '') };
}
function epreuvesVertes() {
  for (const e of EPREUVES) {
    const r = lancer(e);
    if (!r.vert) return { vert: false, epreuve: e, sortie: r.sortie };
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
      if (!lancer(m.rouge).vert) {
        passees++;
        console.log(`  ✓ ${m.nom} → rouge (${m.rouge})`);
      } else {
        // L'épingle n'a pas mordu. DEUX causes opposées, et les confondre
        // ferait passer la plus grave pour l'autre : ou bien la garde ne mord
        // nulle part, ou bien elle mord ailleurs et l'épingle désigne le
        // mauvais gardien. On cherche donc, une seule fois, et on le nomme.
        const ailleurs = EPREUVES.filter(e => e !== m.rouge).find(e => !lancer(e).vert);
        echecs.push(ailleurs
          ? `${m.nom} — ÉPINGLE FAUSSE : ${m.rouge} reste vert sous mutation, c’est ${ailleurs} qui mord. `
            + 'La garde tient, mais pas là où ce banc l’affirme.'
          : `${m.nom} — LA GARDE NE MORD PAS : mutation appliquée, épreuves toujours vertes.`);
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
