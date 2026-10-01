#!/usr/bin/env node
'use strict';
// Épreuves du moteur de qualification du rapatriement Claude → rail.
//
// CE QUE CES ÉPREUVES DOIVENT PROUVER. Pas que le moteur « fonctionne » : qu'il
// REFUSE. Un moteur de qualification qui dit oui est banal ; sa valeur entière
// tient dans les douze manières de dire non. Chaque épreuve part donc du même
// scénario entièrement vert et casse UN maillon — c'est la seule construction
// qui montre que le refus vient bien de la chose cassée, et pas d'un défaut
// ambiant du scénario. « Deux mutations concurrentes ne mesurent rien. »
//
// LE TÉMOIN EST OBLIGATOIRE. La première épreuve vérifie que le scénario intact
// passe. Sans elle, douze refus prouveraient seulement que le moteur refuse
// tout, ce qu'une ligne `return BLOCKED` ferait aussi bien. « Un banc qui ne
// sert pas la table neuve. »

const assert = require('assert');
const { qualifier, MAILLON } = require('./outils/qualifier-rapatriement.js');

let passees = 0; const echecs = [];
const ep = (titre, f) => { try { f(); passees++; } catch (e) { echecs.push(`${titre} — ${e.message}`); } };

const h = (p) => (p + '0'.repeat(40)).slice(0, 40);
const RAIL = 'handoff-continuite-20260920';
const BRANCHE = 'claude/issue-28-20260930-1349';
const LOT = 'NEXUS-CONTINUITE-TERRAIN-2-20260922';
const SHA_RAIL = h('2ff41f72');
const SHA_HEAD = h('61562d88');

// Le témoin : tout est prouvé, rien n'est cassé.
function scenario(sur) {
  return Object.assign({
    rail: RAIL, railSha: SHA_RAIL,
    baseBranch: RAIL, baseSha: SHA_RAIL,
    branche: BRANCHE, head: SHA_HEAD, lot: LOT,
    refs: { memes: [RAIL, `origin/${BRANCHE}`], homonymes: [] },
    railEstAncetre: true, baseEstAncetreDuRail: true,
    ci: { verifications: [{ nom: 'Tests', conclusion: 'success', requis: true }] },
    diff: [{ chemin: 'outils/etat-maillon.js', statut: 'A', lignes_ajoutees: ['const ETATS = [];'] }],
    contenus: () => 'const ETATS = [];',
    mission: { autorites: [RAIL] },
    perimetre: ['outils', 'docs/handoff'],
  }, sur || {});
}

// ── LE TÉMOIN ─────────────────────────────────────────────────────────────────
ep('TÉMOIN — un travail entièrement prouvé est qualifié en fast-forward', () => {
  const r = qualifier(scenario());
  assert.strictEqual(r.etat, 'EXECUTE', `attendu EXECUTE, obtenu ${r.etat} (${r.code}) : ${r.motif}`);
  assert.strictEqual(r.code, 'FAST_FORWARD');
  assert.strictEqual(r.details.mode, 'FAST_FORWARD');
  assert.strictEqual(r.details.destination, RAIL);
  assert.strictEqual(r.details.destination_sha_attendu, SHA_HEAD, 'le SHA que la destination DOIT porter après transport est nommé à l’avance');
  assert.strictEqual(r.maillon, MAILLON);
});

// ── MUTATION 1 — mauvaise NEXUS_BASE_BRANCH ──────────────────────────────────
ep('MUTATION — une `NEXUS_BASE_BRANCH` qui ne désigne pas le rail est refusée', () => {
  const r = qualifier(scenario({ baseBranch: 'config-par-environnement' }));
  assert.strictEqual(r.etat, 'BLOCKED');
  assert.strictEqual(r.code, 'BASE_BRANCH_DISCORDANTE');
});
ep('MUTATION — une `NEXUS_BASE_BRANCH` absente est refusée, jamais devinée', () => {
  const r = qualifier(scenario({ baseBranch: '' }));
  assert.strictEqual(r.etat, 'BLOCKED');
  assert.strictEqual(r.code, 'BASE_BRANCH_ABSENTE');
  assert.ok(!/config-par-environnement/.test(r.prochaine_action + r.motif),
    'le refus ne doit proposer aucune valeur de repli : c’est exactement le défaut qu’il corrige');
});

// ── MUTATION 2 — branche Claude sans lot identifiable ────────────────────────
ep('MUTATION — une branche sans lot déclaré est refusée', () => {
  const r = qualifier(scenario({ lot: '' }));
  assert.strictEqual(r.etat, 'BLOCKED');
  assert.strictEqual(r.code, 'LOT_NON_RATTACHABLE');
});

// ── MUTATION 3 — résultat provenant d'un autre lot ───────────────────────────
ep('MUTATION — une branche qui ne porte pas les octets de la demande est refusée', () => {
  const r = qualifier(scenario({ refs: { memes: [RAIL], homonymes: [] } }));
  assert.strictEqual(r.etat, 'BLOCKED');
  assert.strictEqual(r.code, 'LOT_NON_RATTACHABLE');
});
ep('MUTATION — un HOMONYME de la demande est une ambiguïté, pas un rattachement', () => {
  const r = qualifier(scenario({ refs: { memes: [RAIL], homonymes: [`origin/${BRANCHE}`] } }));
  assert.strictEqual(r.etat, 'BLOCKED');
  assert.strictEqual(r.code, 'LOT_AMBIGU', 'même nom + contenu différent = l’homonyme parlerait pour le lot');
});

// ── MUTATION 4 — CI rouge ────────────────────────────────────────────────────
ep('MUTATION — une vérification requise en échec est refusée', () => {
  const r = qualifier(scenario({ ci: { verifications: [{ nom: 'Tests', conclusion: 'failure', requis: true }] } }));
  assert.strictEqual(r.etat, 'BLOCKED');
  assert.strictEqual(r.code, 'CI_NON_VERTE');
});
ep('MUTATION — `skipped` n’est pas `success` sur une vérification requise', () => {
  const r = qualifier(scenario({ ci: { verifications: [{ nom: 'Tests', conclusion: 'skipped', requis: true }] } }));
  assert.strictEqual(r.etat, 'BLOCKED');
  assert.strictEqual(r.code, 'CI_NON_VERTE');
  assert.ok(/skipped/.test(r.motif), 'le refus doit nommer le `skipped` : c’est le déguisement, pas le défaut');
});
ep('MUTATION — l’absence de tout relevé de CI n’est pas un vert', () => {
  const r = qualifier(scenario({ ci: null }));
  assert.strictEqual(r.etat, 'BLOCKED');
  assert.strictEqual(r.code, 'CI_NON_MESUREE');
});
ep('MUTATION — zéro vérification REQUISE n’est pas « tout est vert »', () => {
  const r = qualifier(scenario({ ci: { verifications: [{ nom: 'Indicatif', conclusion: 'success', requis: false }] } }));
  assert.strictEqual(r.etat, 'BLOCKED');
  assert.strictEqual(r.code, 'CI_NON_MESUREE');
});

// ── CE QUI N'EST PAS EXIGÉ DOIT QUAND MÊME SE VOIR ───────────────────────────
//
// Le 30/09/2026, `Supabase Preview` — `skipped`, braqué sur Production, exigé par
// aucun ruleset — bloquait tout transport vers le rail. Le démoter était juste.
// L'effacer du dossier aurait remplacé un faux refus par un silence : plus
// personne n'aurait pu distinguer « tout ce qui était exigé était vert » de
// « rien n'était exigé ». Le dossier doit donc porter les DEUX listes.
ep('un EXECUTE dit qui exigeait quoi, et sous quelle autorité', () => {
  const r = qualifier(scenario({ ci: { verifications: [
    { nom: 'non-regression', conclusion: 'success', requis: true, autorite: `RULESET:${RAIL}` },
    { nom: 'Supabase Preview', conclusion: 'skipped', requis: false, autorite: `RULESET:${RAIL}` },
  ] } }));
  assert.strictEqual(r.etat, 'EXECUTE', `attendu EXECUTE : ${r.code} — ${r.motif}`);
  assert.deepStrictEqual(r.details.ci_requises,
    [{ nom: 'non-regression', conclusion: 'success', autorite: `RULESET:${RAIL}` }],
    'un succès muet sur ce qui a fait foi ne vaut pas mieux qu’un refus sans motif');
  assert.deepStrictEqual(r.details.ci_non_requises,
    [{ nom: 'Supabase Preview', conclusion: 'skipped', autorite: `RULESET:${RAIL}` }],
    'ne pas bloquer n’autorise pas à effacer : le check démoti reste nommé dans le dossier');
});
ep('un check non requis qui ROUGIT est rapporté sans bloquer', () => {
  const r = qualifier(scenario({ ci: { verifications: [
    { nom: 'Tests', conclusion: 'success', requis: true },
    { nom: 'Cloudflare Pages', conclusion: 'failure', requis: false },
  ] } }));
  assert.strictEqual(r.etat, 'EXECUTE', 'un tiers que personne n’exige ne décide pas du transport');
  assert.deepStrictEqual(r.details.ci_non_requises,
    [{ nom: 'Cloudflare Pages', conclusion: 'failure', autorite: null }],
    'son rouge est une information : elle voyage, avec son autorité inconnue dite telle quelle');
});

// ── MUTATION 5 — changement hors périmètre ───────────────────────────────────
ep('MUTATION — un chemin hors du périmètre déclaré est refusé', () => {
  const r = qualifier(scenario({
    diff: [{ chemin: 'NEXUS-Cockpit-v2.html', statut: 'M', lignes_ajoutees: ['<div>'] }],
  }));
  assert.strictEqual(r.etat, 'BLOCKED');
  assert.strictEqual(r.code, 'HORS_PERIMETRE');
  assert.deepStrictEqual(r.details.hors_perimetre, ['NEXUS-Cockpit-v2.html']);
});
ep('le périmètre se compare par SEGMENT, jamais par préfixe de chaîne', () => {
  const r = qualifier(scenario({
    perimetre: ['outils'],
    diff: [{ chemin: 'outils-bis/tricher.js', statut: 'A', lignes_ajoutees: ['x'] }],
  }));
  assert.strictEqual(r.code, 'HORS_PERIMETRE', '`outils-bis/` ne doit pas passer pour `outils/`');
});

// ── MUTATION 6 — divergence du rail ──────────────────────────────────────────
ep('MUTATION — une divergence est refusée, jamais résolue automatiquement', () => {
  const r = qualifier(scenario({ railEstAncetre: false, baseEstAncetreDuRail: false }));
  assert.strictEqual(r.etat, 'BLOCKED');
  assert.strictEqual(r.code, 'DIVERGENCE');
  assert.ok(/aucune résolution automatique/i.test(r.motif));
});

// ── MUTATION 7 — SHA de base périmé ──────────────────────────────────────────
ep('MUTATION — un rail qui a avancé depuis le départ du run est refusé', () => {
  const r = qualifier(scenario({ railEstAncetre: false, baseEstAncetreDuRail: true, baseSha: h('aaaaaaa1') }));
  assert.strictEqual(r.etat, 'BLOCKED');
  assert.strictEqual(r.code, 'SHA_BASE_PERIME');
  assert.ok(/personne n’a testé/.test(r.motif), 'le motif doit dire POURQUOI on ne rebase pas tout seul');
});
ep('un rail avancé mais DÉJÀ CONTENU par le HEAD reste un fast-forward', () => {
  const r = qualifier(scenario({ baseSha: h('aaaaaaa1'), railEstAncetre: true }));
  assert.strictEqual(r.etat, 'EXECUTE', 'si le HEAD contient le rail, la base périmée est sans effet');
});

// ── MUTATION 8 — tentative de transport Production ───────────────────────────
ep('MUTATION — un transport vers `production` est une décision de Frédéric', () => {
  const r = qualifier(scenario({ rail: 'production', baseBranch: 'production', mission: { autorites: ['production'] } }));
  assert.strictEqual(r.etat, 'HUMAN_DECISION_REQUIRED');
  assert.strictEqual(r.code, 'GATE_HUMAINE');
});
ep('MUTATION — `main` aussi, et la mission ne peut pas s’en autoriser', () => {
  const r = qualifier(scenario({ rail: 'main', baseBranch: 'main', mission: { autorites: ['main'] } }));
  assert.strictEqual(r.etat, 'HUMAN_DECISION_REQUIRED');
  assert.strictEqual(r.code, 'GATE_HUMAINE');
});
ep('MUTATION — une destination que la mission ne nomme pas est refusée', () => {
  const r = qualifier(scenario({ mission: { autorites: ['un-autre-rail'] } }));
  assert.strictEqual(r.etat, 'BLOCKED');
  assert.strictEqual(r.code, 'DESTINATION_NON_AUTORISEE');
});
ep('LA CAPACITÉ N’EST PAS L’AUTORISATION — aucune permission n’entre dans la décision', () => {
  const sans = qualifier(scenario());
  const avec = qualifier(scenario({ permissions: { contents: 'write', 'pull-requests': 'write' }, capable: true }));
  assert.deepStrictEqual(avec, sans, 'déclarer des capacités ne doit rien changer à la décision');
});
ep('MUTATION — un diff qui touche Production est une décision réservée', () => {
  const r = qualifier(scenario({
    diff: [{ chemin: '.github/workflows/deploiement-production.yml', statut: 'M', lignes_ajoutees: ['x'] }],
    perimetre: null,
  }));
  assert.strictEqual(r.etat, 'HUMAN_DECISION_REQUIRED');
  assert.strictEqual(r.code, 'CHANGEMENT_PRODUCTION');
});
ep('MUTATION — introduire la cible Supabase Production est une décision réservée', () => {
  const r = qualifier(scenario({
    diff: [{ chemin: 'outils/x.js', statut: 'M', lignes_ajoutees: ['const p = "uzhjpqpctpvxytxpxoqz";'] }],
    contenus: () => 'const p = "uzhjpqpctpvxytxpxoqz";',
  }));
  assert.strictEqual(r.etat, 'HUMAN_DECISION_REQUIRED');
  assert.strictEqual(r.code, 'CHANGEMENT_PRODUCTION');
});

// Les trois bords de « INTRODUITE ». Aucun ne tient sans les deux autres :
// le premier seul rendrait la garde muette, le deuxième seul la rendrait
// inutilisable, le troisième interdit de devenir muet quand on ne sait pas.
ep('une cible Production déjà présente n’est pas introduite par la branche', () => {
  const r = qualifier(scenario({
    // SUR DU CODE VIVANT, et non sur de la documentation. Ce bord mesure l'axe
    // « ajoutée vs déjà présente ». Depuis le 01/10/2026, une documentation qui
    // nomme Production n'est plus une cible du tout : posé sur un `.md`, ce
    // bord serait resté vert même en lisant le fichier entier, c'est-à-dire
    // qu'il aurait cessé de mesurer son axe. Sur `outils/sonde.js`, seule la
    // distinction ajouté/présent le tient encore.
    diff: [{ chemin: 'outils/sonde.js', statut: 'M',
      lignes_ajoutees: ['const a = 1;'],
      lignes_supprimees: [] }],
    // Le fichier NOMME la Production, et la nommait déjà sur le rail.
    contenus: () => 'const PROJET = "uzhjpqpctpvxytxpxoqz";\nconst a = 1;',
  }));
  assert.notStrictEqual(r.code, 'CHANGEMENT_PRODUCTION',
    'accuser une branche de ce que le rail porte déjà refuserait toute la documentation');
});

// CETTE ÉPREUVE ENCODAIT LE DÉFAUT. Écrite le 30/09/2026, elle affirmait qu'une
// phrase de documentation nommant le projet Supabase de Production suffisait à
// refuser le transport. Le 01/10/2026, c'est précisément cette règle qui a
// retenu `119b2f8f` entre Claude et le rail, pour cinq lignes de vocabulaire
// dont un commentaire de `outils/garde-ordre-migration-code.js`. Son INTENTION
// restait juste — une cible AJOUTÉE se refuse là où la même cible déjà présente
// ne se refuse pas — et c'est elle qu'on conserve, en la visant sur une vraie
// cible. Le cas documentaire devient le bord de non-régression juste en dessous.
// Voir `test_cible_production_vs_mention_20261001.js` pour le cas complet.
ep('MUTATION — la même cible, cette fois AJOUTÉE, est bien refusée', () => {
  const r = qualifier(scenario({
    diff: [{ chemin: 'outils/sonde.js', statut: 'M',
      lignes_ajoutees: ['const PROJET = "uzhjpqpctpvxytxpxoqz";'],
      lignes_supprimees: [] }],
    contenus: () => 'const PROJET = "uzhjpqpctpvxytxpxoqz";',
  }));
  assert.strictEqual(r.etat, 'HUMAN_DECISION_REQUIRED');
  assert.strictEqual(r.code, 'CHANGEMENT_PRODUCTION');
  assert.strictEqual(r.details.cibles[0].mesure, 'lignes ajoutées',
    'le dossier doit dire sur quoi la garde a conclu');
});

ep('NON-RÉGRESSION — nommer Production dans une phrase de documentation n’est pas la viser', () => {
  const r = qualifier(scenario({
    diff: [{ chemin: 'docs/handoff/CURRENT.md', statut: 'M',
      lignes_ajoutees: ['Projet Supabase Production : uzhjpqpctpvxytxpxoqz'],
      lignes_supprimees: [] }],
    contenus: () => 'Projet Supabase Production : uzhjpqpctpvxytxpxoqz',
  }));
  assert.strictEqual(r.etat, 'EXECUTE', `obtenu ${r.etat} (${r.code}) : ${r.motif}`);
  assert.strictEqual((r.details.mentions_production || []).length, 1,
    'une mention laissée passer doit rester visible dans le dossier');
});

ep('un relevé sans lignes retombe sur le fichier entier, jamais sur le silence', () => {
  const r = qualifier(scenario({
    diff: [{ chemin: 'outils/x.js', statut: 'M' }],
    contenus: () => 'const p = "uzhjpqpctpvxytxpxoqz";',
  }));
  assert.strictEqual(r.code, 'CHANGEMENT_PRODUCTION',
    'une garde qui ne sait pas doit trop refuser, jamais trop peu');
  assert.strictEqual(r.details.cibles[0].mesure, 'fichier entier');
});

// ── AFFAIBLISSEMENT DE GARDE ─────────────────────────────────────────────────
ep('MUTATION — un `|| true` ajouté sur une garde est un affaiblissement', () => {
  const r = qualifier(scenario({
    diff: [{ chemin: '.github/workflows/tests.yml', statut: 'M', lignes_ajoutees: ['          node outils/garde-x.js || true'] }],
    perimetre: null,
  }));
  assert.strictEqual(r.etat, 'HUMAN_DECISION_REQUIRED');
  assert.strictEqual(r.code, 'GARDE_AFFAIBLIE');
});
ep('MUTATION — `continue-on-error: true` est un affaiblissement', () => {
  const r = qualifier(scenario({
    diff: [{ chemin: '.github/workflows/tests.yml', statut: 'M', lignes_ajoutees: ['        continue-on-error: true'] }],
    perimetre: null,
  }));
  assert.strictEqual(r.code, 'GARDE_AFFAIBLIE');
});
ep('MUTATION — supprimer une garde ou une épreuve est un affaiblissement', () => {
  const r = qualifier(scenario({ diff: [{ chemin: 'outils/garde-branches-en-rade.js', statut: 'D' }] }));
  assert.strictEqual(r.code, 'GARDE_AFFAIBLIE');
});
ep('MUTATION — retirer l’APPEL d’une garde est un affaiblissement', () => {
  const r = qualifier(scenario({
    diff: [{ chemin: '.github/workflows/tests.yml', statut: 'M', lignes_supprimees: ['          node outils/garde-env-001.js'] }],
    perimetre: null,
  }));
  assert.strictEqual(r.code, 'GARDE_AFFAIBLIE');
});

// ── SECRETS ──────────────────────────────────────────────────────────────────
ep('MUTATION — un jeton dans le diff est refusé', () => {
  const r = qualifier(scenario({
    diff: [{ chemin: 'outils/x.js', statut: 'M', lignes_ajoutees: ['const t = "ghp_' + 'A1b2C3d4E5f6G7h8I9j0K1' + '";'] }],
  }));
  assert.strictEqual(r.etat, 'BLOCKED');
  assert.strictEqual(r.code, 'SECRET_DETECTE');
});
ep('LE DÉTECTEUR NE PUBLIE PAS CE QU’IL DÉNONCE', () => {
  const valeur = 'ghp_' + 'A1b2C3d4E5f6G7h8I9j0K1';
  const r = qualifier(scenario({
    diff: [{ chemin: 'outils/x.js', statut: 'M', lignes_ajoutees: [`const t = "${valeur}";`] }],
  }));
  const tout = JSON.stringify(r);
  assert.ok(!tout.includes(valeur), 'un détecteur qui cite ce qu’il a trouvé publie le secret qu’il dénonce');
  assert.ok(tout.includes('outils/x.js') && /"ligne":1/.test(tout), 'il doit en revanche dire OÙ regarder');
});
ep('MUTATION — une URL de base avec mot de passe est refusée', () => {
  const r = qualifier(scenario({
    diff: [{ chemin: 'outils/x.js', statut: 'M', lignes_ajoutees: ['postgresql://postgres:motdepasse@db.example.supabase.co:5432/postgres'] }],
  }));
  assert.strictEqual(r.code, 'SECRET_DETECTE');
});
ep('MUTATION — un PIN littéral est refusé', () => {
  const r = qualifier(scenario({
    diff: [{ chemin: 'outils/x.js', statut: 'M', lignes_ajoutees: ['const NEXUS_TEST_PIN = "1234";'] }],
  }));
  assert.strictEqual(r.code, 'SECRET_DETECTE');
});

ep('le détecteur de PIN ne mord pas sur un mot qui contient « pin »', () => {
  // Frontière déjà fausse une fois : `\\bPIN` ne mord pas dans `NEXUS_TEST_PIN`
  // (`_` est un caractère de mot), et retirer la frontière ferait mordre « spinner ».
  const r = qualifier(scenario({
    diff: [{ chemin: 'outils/x.js', statut: 'M', lignes_ajoutees: ['const spinner = 1234;', 'let mapping = 9999;'] }],
  }));
  assert.strictEqual(r.etat, 'EXECUTE', `faux positif : ${r.code}`);
});

// ── IDENTIFICATION ───────────────────────────────────────────────────────────
ep('un HEAD abrégé n’est pas un HEAD — on transporte un commit, pas « la dernière version »', () => {
  const r = qualifier(scenario({ head: '61562d8' }));
  assert.strictEqual(r.code, 'HEAD_INCONNU');
});
ep('un rail nommé mais non résolu n’est pas une destination', () => {
  const r = qualifier(scenario({ railSha: '' }));
  assert.strictEqual(r.code, 'DESTINATION_INCONNUE');
});
ep('une base SHA inconnue rend « ce que ce travail ajoute » indéfini', () => {
  const r = qualifier(scenario({ baseSha: '' }));
  assert.strictEqual(r.code, 'SHA_BASE_INCONNU');
});

// ── REPOS LÉGITIME ───────────────────────────────────────────────────────────
ep('une branche identique au rail est un NO_WORK, pas une panne', () => {
  const r = qualifier(scenario({ head: SHA_RAIL }));
  assert.strictEqual(r.etat, 'NO_WORK');
  assert.strictEqual(r.code, 'RIEN_A_RAPATRIER');
});
ep('un NO_WORK n’exige pas les six champs d’un arrêt', () => {
  const r = qualifier(scenario({ diff: [] }));
  assert.strictEqual(r.etat, 'NO_WORK');
});

// ── INSPECTABILITÉ ───────────────────────────────────────────────────────────
ep('ce qui ne se lit pas ne se qualifie pas', () => {
  const r = qualifier(scenario({ diff: [{ chemin: 'docs/handoff/capture.png', statut: 'A', binaire: true }] }));
  assert.strictEqual(r.etat, 'BLOCKED');
  assert.strictEqual(r.code, 'DIFF_NON_INSPECTABLE');
});

// ── L'ORDRE DES CONTRÔLES EST UNE DÉCISION ───────────────────────────────────
ep('une décision réservée est nommée AVANT l’état de préparation', () => {
  // Tout est cassé en même temps. Le rapport doit dire « ceci appartient à
  // Frédéric », pas « la CI est rouge » : sinon on corrige la CI et on revient
  // buter sur la vraie frontière, un tour plus tard.
  const r = qualifier(scenario({
    rail: 'production', baseBranch: 'production', mission: { autorites: ['production'] },
    ci: { verifications: [{ nom: 'Tests', conclusion: 'failure', requis: true }] },
    railEstAncetre: false,
  }));
  assert.strictEqual(r.etat, 'HUMAN_DECISION_REQUIRED');
  assert.strictEqual(r.code, 'GATE_HUMAINE');
});

// ── LA PROCÉDURE, PAS LA POLITESSE ───────────────────────────────────────────
ep('TOUT arrêt rend les six champs exploitables', () => {
  const casses = [
    { baseBranch: '' }, { lot: '' }, { refs: { memes: [], homonymes: [] } },
    { ci: null }, { railEstAncetre: false }, { rail: 'production', baseBranch: 'production', mission: { autorites: ['production'] } },
    { diff: [{ chemin: 'NEXUS-Cockpit-v2.html', statut: 'M', lignes_ajoutees: ['x'] }] },
    { diff: [{ chemin: 'outils/x.js', statut: 'M', lignes_ajoutees: ['const t="ghp_A1b2C3d4E5f6G7h8I9j0K1";'] }] },
  ];
  for (const c of casses) {
    const r = qualifier(scenario(c));
    assert.ok(['BLOCKED', 'HUMAN_DECISION_REQUIRED'].includes(r.etat), `${JSON.stringify(c)} devait arrêter la chaîne`);
    for (const champ of ['condition', 'sha', 'branche', 'lot', 'maillon', 'prochaine_action']) {
      assert.ok(r[champ], `${r.code} : champ « ${champ} » manquant — un arrêt qu’il faut instruire est un arrêt silencieux de plus`);
    }
  }
});

ep('le moteur DÉCIDE et n’agit pas', () => {
  const src = require('fs').readFileSync('./outils/qualifier-rapatriement.js', 'utf8');
  for (const interdit of ['execSync', 'spawnSync', 'gh pr create', 'gh pr merge', 'git push', 'git merge', 'git rebase', 'child_process']) {
    assert.ok(!src.includes(interdit), `ce moteur qualifie, il ne transporte pas : « ${interdit} » n’a rien à y faire`);
  }
});

console.log(`\nQualification du rapatriement — ${passees} épreuve(s) passée(s), ${echecs.length} échec(s).`);
for (const e of echecs) console.error(`  ✗ ${e}`);
process.exit(echecs.length ? 1 : 0);
