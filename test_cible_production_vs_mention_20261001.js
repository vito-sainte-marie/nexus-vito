#!/usr/bin/env node
'use strict';
// LE CAS `62c577c0… → 119b2f8f…`, REJOUÉ À LA LIGNE PRÈS.
//
// Le 30/09/2026, le travail `119b2f8f5cc952add481020f3570dc5ab86d8863` était
// terminé, sa CI verte (run 36811936545, `success`), le transport armé
// (`NEXUS_RAPATRIEMENT_ARME: oui`), et il était fast-forwardable depuis le rail
// `handoff-continuite-20260920` à `62c577c0a92704567cffd6a992fffddf59031c26`.
// Il n'est jamais parti. L'étape 56 a publié, DANS UN RUN VERT :
//
//   [HUMAN_DECISION_REQUIRED] rapatriement-claude-vers-rail
//     (CHANGEMENT_PRODUCTION) — Le diff introduit une cible Production dans
//     5 fichier(s). Une branche de run n'écrit pas vers Production.
//
// Les cinq lignes ajoutées reproduites ici sont les VRAIES, relevées par
// `relever()` sur la vraie plage. Aucune ne porte d'adresse, de chaîne de
// connexion ni de drapeau d'outil : ce sont une cellule de tableau Markdown,
// une phrase de prose, un champ `prochaine_action` adressé à un humain, un
// commentaire `//`, et une fixture de test.
//
// Le fichier le plus abusivement accusé est `outils/garde-ordre-migration-code.js` :
// la garde qui protège la migration Production, refusée au transport pour avoir
// nommé Production dans un commentaire. D'où la portée du défaut — il n'est pas
// incident, il rend NON TRANSPORTABLE tout travail portant sur la procédure
// Production, puisqu'un tel travail doit nommer Production pour exister.
//
// CE QUE CES ÉPREUVES DOIVENT PROUVER, dans cet ordre :
//   1. le cas réel passe désormais, et passe en EXECUTE — pas « ne bloque plus » ;
//   2. ce qu'il a laissé passer reste PUBLIÉ, jamais silencieux ;
//   3. la garde mord toujours sur une vraie cible — sept contre-témoins.
// Sans (3), (1) serait un désarmement déguisé en précision.

const assert = require('assert');
const { qualifier, CORPUS_DE_RECONNAISSANCE } = require('./outils/qualifier-rapatriement.js');

let passees = 0; const echecs = [];
const ep = (titre, f) => { try { f(); passees++; console.log(`  ✅ ${titre}`); }
  catch (e) { echecs.push(`${titre} — ${e.message}`); console.log(`  ❌ ${titre}`); } };

const h = (p) => (p + '0'.repeat(40)).slice(0, 40);
const RAIL = 'handoff-continuite-20260920';
const BRANCHE = 'claude/issue-28-20260930-1350';
const LOT = 'NEXUS-CONTINUITE-TERRAIN-2-20260922';
const SHA_RAIL = h('62c577c0a92704567cffd6a992fffddf59031c26');
const SHA_HEAD = h('119b2f8f5cc952add481020f3570dc5ab86d8863');

function scenario(sur) {
  return Object.assign({
    rail: RAIL, railSha: SHA_RAIL,
    baseBranch: RAIL, baseSha: SHA_RAIL,
    branche: BRANCHE, head: SHA_HEAD, lot: LOT,
    refs: { memes: [RAIL, `origin/${BRANCHE}`], homonymes: [] },
    railEstAncetre: true, baseEstAncetreDuRail: true,
    ci: { verifications: [{ nom: 'Tests', conclusion: 'success', requis: true }] },
    diff: [{ chemin: 'outils/etat-maillon.js', statut: 'A', lignes_ajoutees: ['const ETATS = [];'] }],
    contenus: () => '',
    mission: { autorites: [RAIL] },
    perimetre: null,
  }, sur || {});
}

const P = 'uzhjpqpctpvxytxpxoqz';

// Les cinq fichiers de `62c577c0..119b2f8f`, avec leur ligne ajoutée réelle.
const CAS_REEL = [
  { chemin: 'docs/deploiement/README.md', statut: 'A',
    lignes_ajoutees: [`  "cible": "${P}", "par": "frederic" },`] },
  { chemin: 'docs/deploiement/preflight-20260919103000-production.md', statut: 'A',
    lignes_ajoutees: [`| Cible | Production \`${P}\` |`,
      `Exécuter la **lecture AVANT du §10** sur Production \`${P}\`,`] },
  { chemin: 'docs/deploiement/qualification-ordre-migration-code.json', statut: 'A',
    lignes_ajoutees: [`  "prochaine_action": "Mesure catalogue en lecture seule sur Production (${P}) : colonnes + defauts",`] },
  { chemin: 'outils/garde-ordre-migration-code.js', statut: 'A',
    lignes_ajoutees: [`//           "cible": "${P}",`] },
  { chemin: 'test_garde_ordre_migration_code_20260930.js', statut: 'A',
    lignes_ajoutees: [`const MESURE_BONNE = { source: 'catalogue', cible: '${P}', par: 'frederic' };`] },
];

console.log('\nLa cible Production et sa simple mention — le cas 62c577c0… → 119b2f8f…\n');

// ── 1. LE CAS RÉEL ───────────────────────────────────────────────────────────
console.log('── Le cas réel, à la ligne près');

ep('le travail 119b2f8f est qualifié EXECUTE, et non refusé', () => {
  const r = qualifier(scenario({ diff: CAS_REEL }));
  assert.strictEqual(r.etat, 'EXECUTE',
    `attendu EXECUTE, obtenu ${r.etat} (${r.code}) : ${r.motif}`);
  assert.strictEqual(r.code, 'FAST_FORWARD');
  assert.strictEqual(r.details.destination, RAIL);
  assert.strictEqual(r.details.destination_sha_attendu, SHA_HEAD);
});

ep('chacun des cinq fichiers, pris seul, passe — aucun ne tient par les autres', () => {
  for (const d of CAS_REEL) {
    const r = qualifier(scenario({ diff: [d] }));
    assert.notStrictEqual(r.code, 'CHANGEMENT_PRODUCTION',
      `« ${d.chemin} » reste accusé : ${r.motif}`);
  }
});

ep('ce qui a été laissé passer est PUBLIÉ, jamais silencieux', () => {
  const r = qualifier(scenario({ diff: CAS_REEL }));
  const m = r.details.mentions_production || [];
  assert.strictEqual(m.length, 5, `attendu 5 mentions publiées, obtenu ${m.length}`);
  for (const d of CAS_REEL) {
    assert.ok(m.some((x) => x.chemin === d.chemin),
      `« ${d.chemin} » n'apparaît nulle part dans le dossier`);
  }
});

// ── 2. LES CONTRE-TÉMOINS ────────────────────────────────────────────────────
// Sans eux, l'épreuve ci-dessus prouverait seulement que la garde a été retirée.
console.log('\n── Les contre-témoins : la garde mord toujours');

// CES CONTRE-TÉMOINS ONT DÉJÀ SERVI. Au premier essai, la correction classait
// « le nom nu, dans une ligne de code exécutée » comme un commentaire inerte :
// le motif de commentaire contenait l'alternative `\\*`, qui signifie « zéro
// backslash ou plus » et reconnaît donc n'importe quelle ligne. La garde était
// désarmée sans que rien ne le dise. Trois contre-témoins sur sept ont rougi.


const CIBLES = [
  ['une adresse Supabase Production, même en pleine prose',
    { chemin: 'docs/handoff/CURRENT.md', statut: 'M', lignes_ajoutees: [`Base visée : ${P}.supabase.co`] }],
  ['une chaîne de connexion à la base Production',
    { chemin: 'docs/notes.md', statut: 'M', lignes_ajoutees: [`postgresql://postgres@db.${P}.supabase.co:5432/postgres`] }],
  ['une URL de l’hôte Production dans du code vivant',
    { chemin: 'outils/x.js', statut: 'M', lignes_ajoutees: ['const url = "https://app.nexusconseil.net/";'] }],
  ['un drapeau d’outil pointé vers Production, même commenté',
    { chemin: 'outils/x.sh', statut: 'M', lignes_ajoutees: [`# supabase db push --project-ref ${P}`] }],
  ['un réglage de workflow pointé vers Production',
    { chemin: '.github/workflows/tests.yml', statut: 'M', lignes_ajoutees: [`          project_id: ${P}`] }],
  ['le nom nu, dans une ligne de code exécutée',
    { chemin: 'outils/x.js', statut: 'M', lignes_ajoutees: [`const p = "${P}";`] }],
  ['le nom nu, dans un gabarit servi à l’utilisateur',
    { chemin: 'nexus-config.js', statut: 'M', lignes_ajoutees: [`window.PROJET = '${P}';`] }],
];
for (const [nom, d] of CIBLES) {
  ep(`MUTATION — ${nom} est refusée`, () => {
    const r = qualifier(scenario({ diff: [d] }));
    assert.strictEqual(r.etat, 'HUMAN_DECISION_REQUIRED', `obtenu ${r.etat} (${r.code})`);
    assert.strictEqual(r.code, 'CHANGEMENT_PRODUCTION');
  });
}

ep('la sentinelle de chemin reste intacte — le fichier de déploiement ne voyage pas', () => {
  const r = qualifier(scenario({
    diff: [{ chemin: '.github/workflows/deploiement-production.yml', statut: 'M', lignes_ajoutees: ['  on: push'] }] }));
  assert.strictEqual(r.code, 'CHANGEMENT_PRODUCTION');
});

ep('un relevé sans lignes retombe sur le fichier entier, jamais sur le silence', () => {
  const r = qualifier(scenario({
    diff: [{ chemin: 'outils/x.js', statut: 'M' }],
    contenus: () => `const p = "${P}";` }));
  assert.strictEqual(r.code, 'CHANGEMENT_PRODUCTION',
    'une garde qui ne sait pas doit trop refuser, jamais trop peu');
  assert.strictEqual(r.details.cibles[0].mesure, 'fichier entier');
});

// ── 3. LE REFUS DOIT ÊTRE ACTIONNABLE ────────────────────────────────────────
console.log('\n── Un refus qui ne désigne pas n’est pas actionnable');

ep('le motif du refus NOMME les fichiers, il ne les compte pas', () => {
  const r = qualifier(scenario({
    diff: [{ chemin: 'outils/x.js', statut: 'M', lignes_ajoutees: [`const p = "${P}";`] }] }));
  assert.ok(/outils\/x\.js/.test(r.motif),
    `le motif ne nomme pas le fichier accusé : ${r.motif}`);
  assert.ok(/projet Supabase Production/.test(r.motif),
    `le motif ne nomme pas le marqueur qui a mordu : ${r.motif}`);
});

// ── 4. LE CORPUS DE RECONNAISSANCE, ET SON CLIQUET ───────────────────────────
// Mesurée sur elle-même, la correction du 01/10/2026 s'est refusé son propre
// transport : la garde porte les cinq motifs d'adresse, l'épreuve porte quatre
// contre-témoins qui sont de vraies adresses. La même panne, d'un étage plus
// haut — et sans issue, puisqu'on ne reconnaît pas une adresse sans l'écrire.
// Le corpus est l'issue. Ces quatre épreuves tiennent le prix à payer : il est
// CLOS, il est NOMMÉ, il ne couvre que le spécimen, et ce qu'il tolère se dit.
console.log('\n── Le corpus de reconnaissance : écrire l’adresse pour savoir la refuser');

ep('CLIQUET — le corpus est exactement ces deux fichiers, et rien d’autre', () => {
  // Épingle volontairement rigide. Allonger le corpus est le seul moyen de
  // transformer cette exception en passe-droit : que ce soit un geste qui
  // rougit, jamais un geste qui passe.
  assert.deepStrictEqual([...CORPUS_DE_RECONNAISSANCE].sort(), [
    'outils/qualifier-rapatriement.js',
    'test_cible_production_vs_mention_20261001.js',
  ], 'toute entrée ajoutée au corpus doit être arbitrée par un humain, pas héritée d’un motif');
});

ep('le vrai diff de la correction passe : la garde peut se maintenir elle-même', () => {
  const r = qualifier(scenario({ diff: [
    { chemin: 'outils/qualifier-rapatriement.js', statut: 'M', lignes_ajoutees: [
      `  { nom: 'adresse Supabase Production', motif: /\\b${P}\\.supabase\\./ },`,
      "  { nom: 'URL de l’hôte Production', motif: /(https?:)?\\/\\/app\\.nexusconseil\\.net/ },"] },
    { chemin: 'test_cible_production_vs_mention_20261001.js', statut: 'A', lignes_ajoutees: [
      `    lignes_ajoutees: ['postgresql://postgres@db.${P}.supabase.co:5432/postgres'] }],`] },
  ] }));
  assert.strictEqual(r.etat, 'EXECUTE', `obtenu ${r.etat} (${r.code}) : ${r.motif}`);
});

ep('ce que le corpus tolère est PUBLIÉ, jamais tu', () => {
  // Les deux fichiers du corpus ne sont pas tolérés de la même façon, et le
  // dossier doit le dire. Dans la garde, l'adresse vit à l'intérieur de motifs
  // échappés (`\\.supabase\\.`) : aucune forme actionnable n'y est écrite, il ne
  // reste que le nom nu — une MENTION. Dans l'épreuve, les contre-témoins sont
  // de vraies adresses, qu'il faut bien écrire pour vérifier qu'elles mordent —
  // des SPÉCIMENS. Deux listes séparées parce que ce sont deux risques séparés.
  const r = qualifier(scenario({ diff: [
    { chemin: 'outils/qualifier-rapatriement.js', statut: 'M',
      lignes_ajoutees: [`  motif: /\\b${P}\\.supabase\\./,`] },
    { chemin: 'test_cible_production_vs_mention_20261001.js', statut: 'A',
      lignes_ajoutees: [`    lignes_ajoutees: ['postgresql://postgres@db.${P}.supabase.co:5432/postgres'] }],`] },
  ] }));
  assert.strictEqual(r.etat, 'EXECUTE', `obtenu ${r.etat} (${r.code}) : ${r.motif}`);

  const sp = r.details.specimens_reconnaissance || [];
  assert.strictEqual(sp.length, 1, 'un spécimen toléré doit figurer au dossier');
  assert.strictEqual(sp[0].chemin, 'test_cible_production_vs_mention_20261001.js');
  assert.ok(/adresse Supabase Production/.test(sp[0].marqueur), sp[0].marqueur);

  const me = r.details.mentions_production || [];
  assert.ok(me.some((m) => m.chemin === 'outils/qualifier-rapatriement.js'),
    'le nom nu toléré dans la garde doit rester visible lui aussi');
});

ep('CONTRE-TÉMOIN — le corpus ne déteint pas sur le fichier d’à côté', () => {
  // La même ligne, à un chemin près. Si celle-ci passait, le corpus ne serait
  // plus une liste close mais une tolérance générale aux fichiers d’outillage.
  const r = qualifier(scenario({ diff: [
    { chemin: 'outils/qualifier-rapatriement-v2.js', statut: 'A',
      lignes_ajoutees: [`  motif: /\\b${P}\\.supabase\\./,`] },
  ] }));
  assert.strictEqual(r.code, 'CHANGEMENT_PRODUCTION', `obtenu ${r.etat} (${r.code})`);
});

// Mesurée à son tour sur son propre diff, la version précédente de cette épreuve
// a été refusée — `BLOCKED (SECRET_DETECTE)` — parce qu'elle écrivait la chaîne
// de connexion en toutes lettres. La garde avait raison : c'est une forme de
// secret, et le corpus de reconnaissance ne l'excuse pas, par construction (voir
// le contre-témoin ci-dessous, qui l'exige). L'issue n'est donc PAS d'élargir
// `MOTIFS_SECRET` — ce serait affaiblir la garde pour faire passer son propre
// test. Elle est de ne jamais écrire la forme : le contre-témoin la COMPOSE à
// l'exécution. La garde reçoit exactement la chaîne qu'elle doit refuser, et le
// fichier, lui, n'en porte aucune.
const CHAINE_AVEC_MOT_DE_PASSE = ['postgre' + 'sql://postgres', 'motdepasse@localhost:5432/db'].join(':');

ep('CLIQUET — cette épreuve ne porte elle-même aucune forme de secret', () => {
  // Composer la chaîne plutôt que l'écrire n'est une discipline que si quelque
  // chose la tient. Cette épreuve lit sa propre source : réécrire le littéral la
  // fait rougir immédiatement, sans attendre qu'un transport soit refusé.
  const { MOTIFS_SECRET } = require('./outils/qualifier-rapatriement.js');
  const src = require('fs').readFileSync(__filename, 'utf8').split('\n');
  const fautives = [];
  src.forEach((ligne, i) => {
    for (const m of MOTIFS_SECRET) {
      // La valeur n'est jamais reproduite : on ne nomme que la ligne et la forme.
      if (m.motif.test(ligne)) fautives.push(`ligne ${i + 1} — ${m.nom}`);
    }
  });
  assert.deepStrictEqual(fautives, [],
    'un contre-témoin se compose à l’exécution ; la forme ne s’écrit pas dans le fichier');
});

ep('CONTRE-TÉMOIN — un secret reste un secret, même dans le corpus', () => {
  // Le corpus excuse l'ADRESSE, qui est publique dans ce dépôt. Il n'excuse
  // rien de ce qui permet d'y entrer.
  const r = qualifier(scenario({ diff: [
    { chemin: 'test_cible_production_vs_mention_20261001.js', statut: 'M',
      lignes_ajoutees: [`const u = "${CHAINE_AVEC_MOT_DE_PASSE}";`] },
  ] }));
  assert.notStrictEqual(r.etat, 'EXECUTE',
    'une chaîne de connexion avec mot de passe ne devient pas un spécimen');
});

const total = passees + echecs.length;
console.log(`\nLa cible Production et sa simple mention — ${passees} épreuve(s) passée(s), ${echecs.length} échec(s).`);
if (echecs.length) { for (const e of echecs) console.log(`  · ${e}`); process.exit(1); }
console.log(`(${total} contrôles)`);
