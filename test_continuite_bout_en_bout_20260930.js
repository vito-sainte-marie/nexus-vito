#!/usr/bin/env node
/**
 * PREUVE DE CONTINUITÉ DE BOUT EN BOUT — 30/09/2026
 *
 * Les bancs unitaires prouvent que chaque maillon répond correctement quand on
 * l'interroge. Ils ne prouvent PAS que la chaîne se tient : un maillon peut
 * être juste et n'être appelé par personne. C'est exactement le défaut qui a
 * coûté le plus cher ici — « prouver la fonction n'est pas prouver le câblage ».
 *
 * Cette épreuve monte donc un DÉPÔT COMPLET jetable, y copie les outils réels
 * du dépôt sous test, lui donne un `origin` bare local, et fait parcourir à une
 * demande le trajet entier :
 *
 *   demande déposée → réveil calculé → rail identifié → branche de travail →
 *   CI → qualification → rapatriement vers le rail de preuve → nouveau signal
 *
 * Ce qui est RÉEL ici : git, les fichiers, et les six modules de la chaîne,
 * exécutés sans être modifiés, en processus fils. Ce qui est simulé : les deux
 * seules choses que GitHub seul peut dire — les commentaires d'une issue et les
 * vérifications d'un commit — servies par un faux `gh` placé en tête de PATH.
 * On ne simule donc jamais une décision de la chaîne, seulement ses entrées.
 *
 * AUCUNE PRODUCTION. L'`origin` est un dépôt bare dans un répertoire temporaire ;
 * aucune commande ne sort de ce répertoire, et le rail de preuve porte un nom
 * qui n'existe nulle part ailleurs.
 *
 * Enfin — et c'est le point de §5 — casser volontairement N'IMPORTE QUEL maillon
 * doit rendre cette épreuve ROUGE. Chaque rupture ci-dessous est jouée, et la
 * destination est relue à chaque fois : un refus qui laisserait quand même le
 * rail avancer serait le pire des défauts, et il serait invisible sans cette
 * relecture.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const RACINE = __dirname;
const LOT = 'LOT-PREUVE-20260930';
const RAIL = 'handoff-preuve-20260930';
const ISSUE = 28;
const BRANCHE = `claude/issue-${ISSUE}-20260930-1500`;
// Le déclencheur précède la branche de 30 s : dans la tolérance (120 s), et du
// bon côté — une branche ne peut pas répondre à un commentaire postérieur.
const INSTANT_DECLENCHEUR = '2026-09-30T14:59:30Z';
const DEPOT_FICTIF = 'bac-a-sable/nexus-preuve';

let reussites = 0;
const echecs = [];
function epreuve(nom, f) {
  try { f(); reussites += 1; console.log(`  ✅ ${nom}`); }
  catch (e) { echecs.push({ nom, e }); console.log(`  ❌ ${nom}\n     ${e && e.message}`); }
}

// ── LE BAC À SABLE ──────────────────────────────────────────────────────────

const bacs = [];
function git(dir, ...args) {
  const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`git ${args.join(' ')} a échoué dans ${dir} :\n${r.stderr || r.stdout}`);
  }
  return String(r.stdout || '').trim();
}

function ecrire(f, contenu) {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, contenu);
}

/**
 * Monte un dépôt neuf. `mut` permet de casser UN maillon et un seul, pour que
 * le rouge obtenu soit attribuable.
 */
function bac(mut = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-continuite-'));
  bacs.push(dir);
  const origin = path.join(dir, 'origin.git');
  const depot = path.join(dir, 'depot');
  const bin = path.join(dir, 'bin');

  git(dir, 'init', '--quiet', '--bare', origin);
  git(dir, 'init', '--quiet', depot);
  git(depot, 'config', 'user.email', 'bac@local');
  git(depot, 'config', 'user.name', 'Bac');
  git(depot, 'config', 'commit.gpgsign', 'false');

  // Les outils RÉELS du dépôt sous test. C'est ce qui rend l'épreuve sensible
  // à une mutation de la source : casser un module ici casse la chaîne là-bas.
  fs.cpSync(path.join(RACINE, 'outils'), path.join(depot, 'outils'), { recursive: true });

  const registre = {
    protocol: 'nexus-handoff/2',
    lot_actif: LOT,
    lots: { [LOT]: { statut: 'DEMANDE_DEPOSEE', derniere_demande: 'request-1.md' } },
    artefacts_hors_registre: [],
    derogations: [],
  };
  ecrire(path.join(depot, 'docs/handoff/STATE.json'), `${JSON.stringify(registre, null, 2)}\n`);

  // M1 cassé : la demande n'est pas déposée. Le registre la promet, le disque
  // ne la porte pas.
  if (!mut.sansDemande) {
    ecrire(path.join(depot, `docs/handoff/lots/${LOT}/request-1.md`),
      ['---', 'protocol: nexus-handoff/2', 'kind: request', `lot_id: ${LOT}`, 'seq: 1',
        'author: Claude', `branch: ${RAIL}`, 'status: AWAITING_DECISION', 'token_mode: DEEP',
        '---', '', '# Demande 1 — preuve de continuite', '',
        'Question posee dans le bac a sable.', ''].join('\n'));
  }

  // Le faux GitHub. Il ne sert QUE ce que GitHub seul peut dire.
  ecrire(path.join(bin, 'gh'), ['#!/bin/bash', 'ARGS="$*"', 'case "$ARGS" in',
    '  *"/issues/"*"/comments"*) exec cat "$NEXUS_BAC_COMMENTAIRES" ;;',
    '  *"/check-runs"*)          exec cat "$NEXUS_BAC_VERIFICATIONS" ;;',
    '  *) echo "faux gh : appel non prevu : $ARGS" >&2; exit 1 ;;', 'esac', ''].join('\n'));
  fs.chmodSync(path.join(bin, 'gh'), 0o755);

  // M3 cassé : le déclencheur ne désigne aucun rail. M4 cassé : il vient de
  // quelqu'un d'autre. Sinon, le déclencheur nominal.
  const corps = mut.sansDesignation
    ? `@claude traite request-1 du lot ${LOT}.`
    : `@claude NEXUS_BASE_BRANCH=${RAIL} — traite request-1 du lot ${LOT}.`;
  const auteur = mut.auteurEtranger ? 'quelqu-un-dautre' : 'vito-sainte-marie';
  ecrire(path.join(dir, 'commentaires.json'),
    `${JSON.stringify({ date: INSTANT_DECLENCHEUR, auteur, corps })}\n`);

  // M6 cassé : la CI est rouge, ou elle n'a pas répondu du tout.
  const verifs = mut.ciRouge
    ? [{ nom: 'Tests', conclusion: 'failure', url: 'https://x/y/runs/999' }]
    : [{ nom: 'Tests', conclusion: 'success', url: 'https://x/y/runs/999' },
      { nom: 'Immuabilité', conclusion: 'success', url: 'https://x/y/runs/998' }];
  ecrire(path.join(dir, 'verifications.json'),
    `${verifs.map((v) => JSON.stringify(v)).join('\n')}\n`);
  if (mut.ciMuette) fs.rmSync(path.join(dir, 'verifications.json'));

  git(depot, 'add', '-A');
  git(depot, 'commit', '--quiet', '-m', 'Bac : rail de preuve');
  git(depot, 'branch', '-M', RAIL);
  git(depot, 'remote', 'add', 'origin', origin);
  git(depot, 'push', '--quiet', 'origin', RAIL);

  return { dir, origin, depot, bin,
    commentaires: path.join(dir, 'commentaires.json'),
    verifications: path.join(dir, 'verifications.json') };
}

function railDistant(b) {
  const s = git(b.depot, 'ls-remote', b.origin, `refs/heads/${RAIL}`);
  return s ? s.split(/\s+/)[0] : '';
}

/** Lance le rapatriement comme la CI le lance : en processus fils, faux gh en tête de PATH. */
function rapatrier(b, opts = {}) {
  const jeton = Math.random().toString(36).slice(2);
  const etatFichier = path.join(b.dir, `etat-${jeton}.json`);
  const resume = path.join(b.dir, `resume-${jeton}.md`);
  const sortieEtape = path.join(b.dir, `sortie-${jeton}.txt`);
  const args = ['outils/rapatrier-vers-rail.js', '--branche', opts.branche || BRANCHE,
    '--depot', DEPOT_FICTIF];
  if (opts.transporter) args.push('--transporter');
  const r = spawnSync('node', args, {
    cwd: b.depot,
    encoding: 'utf8',
    env: Object.assign({}, process.env, {
      PATH: `${b.bin}:${process.env.PATH}`,
      NEXUS_BAC_COMMENTAIRES: b.commentaires,
      NEXUS_BAC_VERIFICATIONS: b.verifications,
      NEXUS_ETAT_FICHIER: etatFichier,
      GITHUB_STEP_SUMMARY: resume,
      GITHUB_OUTPUT: sortieEtape,
      NEXUS_TRANSPORT_AUTORITES: '',
    }),
  });
  let etat = null;
  try { etat = JSON.parse(fs.readFileSync(etatFichier, 'utf8')); } catch (_) { /* non écrit */ }
  const lire = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch (_) { return ''; } };
  return { code: r.status, sortie: `${r.stdout || ''}${r.stderr || ''}`, etat,
    resume: lire(resume), sortieEtape: lire(sortieEtape) };
}

/** Le réveil, tel que la CI l'appelle : en processus fils, depuis le dépôt. */
function reveil(b) {
  const r = spawnSync('node', ['outils/reveil-orchestrateur.js'],
    { cwd: b.depot, encoding: 'utf8' });
  return { code: r.status, sortie: `${r.stdout || ''}${r.stderr || ''}` };
}

/** La branche de travail de Claude, avec son commit. */
function travailDeClaude(b, mut = {}) {
  const nom = mut.brancheInforme ? 'travaux-divers' : (mut.branche || BRANCHE);
  git(b.depot, 'checkout', '--quiet', '-b', nom, RAIL);
  const cible = path.join(b.depot, `docs/handoff/lots/${LOT}/reponse-1.md`);
  // M7 cassé : le travail introduit une cible Production sur une ligne NEUVE.
  const texte = mut.versProduction
    ? '# Reponse\n\nBase visee : uzhjpqpctpvxytxpxoqz.supabase.co\n'
    : '# Reponse\n\nTravail de Claude dans le bac a sable.\n';
  ecrire(cible, texte);
  git(b.depot, 'add', '-A');
  git(b.depot, 'commit', '--quiet', '-m', 'Claude : reponse a request-1');
  git(b.depot, 'push', '--quiet', 'origin', nom);
  git(b.depot, 'fetch', '--quiet', 'origin');
  return { nom, head: git(b.depot, 'rev-parse', 'HEAD') };
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\nContinuité de bout en bout — le trajet entier, dans un dépôt jetable\n');

// ── A. LE TRAJET NOMINAL ────────────────────────────────────────────────────
console.log('── A. Le trajet nominal : une demande revient sur le rail sans geste humain');

const nominal = (() => {
  const b = bac();
  const j = {};
  j.m1 = reveil(b);                                   // demande → réveil
  j.railAvant = railDistant(b);
  j.claude = travailDeClaude(b);                      // rail → branche de travail
  j.m7qualif = rapatrier(b);                          // CI verte → qualification
  j.railApresQualif = railDistant(b);
  j.m7transport = rapatrier(b, { transporter: true }); // qualification → transport
  j.railApres = railDistant(b);
  j.bac = b;
  return j;
})();

epreuve('M1 — la demande déposée produit un réveil qui nomme le lot', () => {
  assert.strictEqual(nominal.m1.code, 0);
  assert.ok(/Réveil Orchestrateur/.test(nominal.m1.sortie), nominal.m1.sortie);
  assert.ok(nominal.m1.sortie.includes(LOT), nominal.m1.sortie);
  assert.ok(nominal.m1.sortie.includes('request-1.md'), nominal.m1.sortie);
});

epreuve('M2/M3 — le rail est identifié depuis le déclencheur, pas deviné', () => {
  assert.strictEqual(nominal.m7qualif.etat.etat, 'EXECUTE', nominal.m7qualif.sortie);
  assert.ok(nominal.m7qualif.sortie.includes(RAIL), nominal.m7qualif.sortie);
});

epreuve('M5/M6 — la branche de travail est épinglée à son déclencheur et sa CI est verte', () => {
  assert.strictEqual(nominal.m7qualif.etat.code, 'QUALIFIE_NON_TRANSPORTE');
  assert.strictEqual(nominal.m7qualif.etat.branche, BRANCHE);
});

epreuve('une qualification ne touche PAS la destination', () => {
  assert.strictEqual(nominal.railApresQualif, nominal.railAvant,
    'le rail a bougé alors que le transport n’était pas armé');
});

epreuve('M7 — le transport armé fait réellement avancer le rail jusqu’au HEAD Claude', () => {
  assert.strictEqual(nominal.m7transport.etat.etat, 'EXECUTE', nominal.m7transport.sortie);
  assert.strictEqual(nominal.m7transport.etat.code, 'TRANSPORTE');
  assert.strictEqual(nominal.railApres, nominal.claude.head,
    `rail=${nominal.railApres} head=${nominal.claude.head}`);
  assert.notStrictEqual(nominal.railApres, nominal.railAvant);
});

epreuve('M7 — le dossier nomme le commit transporté ET la ref d’où il vient', () => {
  const d = nominal.m7transport.etat.details || {};
  assert.strictEqual(nominal.m7transport.etat.sha, nominal.claude.head);
  assert.ok(String(d.ref_head || '').includes(BRANCHE),
    `ref_head absent ou muet : ${JSON.stringify(d)}`);
});

epreuve('M8 — le rail ayant avancé, l’empreinte de progression change', () => {
  const { empreinte } = require(path.join(RACINE, 'outils/watchdog-stagnation.js'));
  const avant = empreinte({ position: 'RESULTAT_A_RAPATRIER', sha: nominal.railAvant });
  const apres = empreinte({ position: 'RESULTAT_A_RAPATRIER', sha: nominal.railApres });
  assert.notStrictEqual(avant, apres, 'deux SHA différents ont la même empreinte');
});

epreuve('M8 — sans avancée, la même empreinte deux fois est vue comme une stagnation', () => {
  const { examiner, CYCLES_SANS_PROGRES } = require(path.join(RACINE, 'outils/watchdog-stagnation.js'));
  const e = examiner({ lot: LOT, branche: RAIL, sha: nominal.railAvant,
    position: 'RESULTAT_A_RAPATRIER',
    empreintes: new Array(CYCLES_SANS_PROGRES + 1).fill(`RESULTAT_A_RAPATRIER|${nominal.railAvant}|(sans décision)`) });
  assert.ok(e.etat === 'BLOCKED' || e.etat === 'HUMAN_DECISION_REQUIRED',
    `état inattendu : ${JSON.stringify(e)}`);
});

epreuve('AUCUNE PRODUCTION — rien dans le bac ne désigne Production', () => {
  const sorties = [nominal.m1.sortie, nominal.m7qualif.sortie, nominal.m7transport.sortie].join('\n');
  assert.ok(!/uzhjpqpctpvxytxpxoqz/.test(sorties), 'le projet Supabase Production est nommé');
  assert.ok(!/app\.nexusconseil\.net/.test(sorties), 'l’hôte Production est nommé');
  assert.ok(nominal.bac.origin.startsWith(os.tmpdir()), 'l’origin du bac n’est pas temporaire');
});

// ── B. CHAQUE MAILLON CASSÉ REND L’ÉPREUVE ROUGE ────────────────────────────
console.log('\n── B. Casser un maillon, un seul, et relire la destination à chaque fois');

/**
 * Joue le trajet avec une rupture, transport ARMÉ, et rend l'état final plus
 * la position du rail. Armer le transport est délibéré : un refus qui ne
 * refuserait qu'en mode « à blanc » ne prouverait rien.
 */
function trajetCasse(mut) {
  const b = bac(mut);
  const avant = railDistant(b);
  const c = travailDeClaude(b, mut);
  const r = rapatrier(b, { transporter: true, branche: c.nom });
  return { etat: r.etat, sortie: r.sortie, code: r.code, avant, apres: railDistant(b) };
}

function refuse(nom, mut, codeAttendu) {
  epreuve(nom, () => {
    const t = trajetCasse(mut);
    assert.ok(t.etat, `aucun état machine publié — un refus muet :\n${t.sortie}`);
    assert.notStrictEqual(t.etat.etat, 'EXECUTE',
      `la chaîne a conclu EXECUTE malgré la rupture :\n${t.sortie}`);
    if (codeAttendu) {
      assert.strictEqual(t.etat.code, codeAttendu,
        `code attendu ${codeAttendu}, obtenu ${t.etat.code} :\n${t.sortie}`);
    }
    assert.strictEqual(t.apres, t.avant,
      `LE RAIL A AVANCÉ MALGRÉ LE REFUS — ${t.avant} → ${t.apres}`);
    // Un refus doit être exploitable : il nomme sa condition et la suite.
    assert.ok(String(t.etat.condition || '').trim(), 'refus sans condition nommée');
    assert.ok(String(t.etat.prochaine_action || '').trim(), 'refus sans prochaine action');
  });
}

refuse('M3 cassé — un déclencheur sans NEXUS_BASE_BRANCH ne fait rien passer',
  { sansDesignation: true }, 'DESIGNATION_ABSENTE');

// La nuance compte : une désignation ABSENTE est un déclencheur qu'on a lu et
// qui ne nomme pas de rail ; un déclencheur INTROUVABLE est l'absence de tout
// commentaire recevable. Confondre les deux enverrait l'humain corriger la
// mauvaise chose.
refuse('M4 cassé — un déclencheur venu d’un autre auteur n’épingle rien',
  { auteurEtranger: true }, 'DECLENCHEUR_INTROUVABLE');

refuse('M5 cassé — une branche hors forme de run n’est rattachable à aucun déclencheur',
  { brancheInforme: true }, 'BRANCHE_NON_EPINGLABLE');

refuse('M6 cassé — une CI rouge arrête le transport', { ciRouge: true }, 'CI_NON_VERTE');

refuse('M6 muet — une CI non mesurée n’est pas un feu vert', { ciMuette: true }, 'CI_NON_MESUREE');

refuse('M7 cassé — un travail qui introduit une cible Production est arrêté',
  { versProduction: true }, 'CHANGEMENT_PRODUCTION');

epreuve('M1 cassé — une demande promise mais absente ne produit pas de réveil', () => {
  const b = bac({ sansDemande: true });
  const r = reveil(b);
  assert.ok(!/Réveil Orchestrateur/.test(r.sortie),
    `un réveil a été produit sur une demande absente :\n${r.sortie}`);
});

epreuve('M7 — un rail qui a divergé sous le run n’est pas résolu automatiquement', () => {
  const b = bac();
  const avant = railDistant(b);
  const c = travailDeClaude(b);
  // Le rail avance PENDANT le run, sur un autre fichier : git fusionnerait
  // proprement. Ce n'est pas la question — l'arbre éprouvé par la CI n'est
  // plus celui qui arriverait à destination.
  git(b.depot, 'checkout', '--quiet', RAIL);
  ecrire(path.join(b.depot, 'docs/handoff/autre.md'), '# Un autre travail\n');
  git(b.depot, 'add', '-A');
  git(b.depot, 'commit', '--quiet', '-m', 'Le rail avance sous le run');
  git(b.depot, 'push', '--quiet', 'origin', RAIL);
  git(b.depot, 'fetch', '--quiet', 'origin');
  const bouge = railDistant(b);
  assert.notStrictEqual(bouge, avant, 'le bac n’a pas réussi à faire diverger le rail');

  const r = rapatrier(b, { transporter: true, branche: c.nom });
  assert.ok(r.etat, `refus muet :\n${r.sortie}`);
  assert.notStrictEqual(r.etat.etat, 'EXECUTE', `EXECUTE malgré la divergence :\n${r.sortie}`);
  assert.strictEqual(railDistant(b), bouge, 'le rail a été écrasé malgré la divergence');
});

// ── C. AUCUN REFUS SILENCIEUX, MÊME AU BOUT DE LA CHAÎNE ────────────────────
console.log('\n── C. Un refus se lit par une machine, jamais seulement par un humain');

epreuve('tout passage publie un état machine, refus compris', () => {
  for (const mut of [{}, { ciRouge: true }, { sansDesignation: true }, { versProduction: true }]) {
    const t = trajetCasse(mut);
    assert.ok(t.etat && t.etat.etat, `état machine absent pour ${JSON.stringify(mut)}`);
    assert.ok(['EXECUTE', 'NO_WORK', 'BLOCKED', 'HUMAN_DECISION_REQUIRED', 'FAILED']
      .includes(t.etat.etat), `état hors liste fermée : ${t.etat.etat}`);
    assert.ok(t.etat.sha !== undefined && t.etat.branche !== undefined,
      'un refus qui ne dit ni le SHA ni la branche n’est pas exploitable');
  }
});

// § 4 exige un SIGNAL EXPLOITABLE, pas une couleur. Faire rougir chaque arrêt
// légitime apprendrait à l'équipe à ignorer le rouge, et on retomberait sur le
// même aveuglement par l'autre bout. Ce qui doit être vrai, c'est qu'aucun canal
// ne soit le seul endroit où regarder : si un refus n'existait que dans le
// journal, c'est exactement là qu'on le retrouverait quatre jours plus tard.
epreuve('un refus sort par les quatre canaux à la fois, pas seulement le journal', () => {
  const b = bac({ ciRouge: true });
  travailDeClaude(b);
  const r = rapatrier(b, { transporter: true });
  assert.ok(/::warning::/.test(r.sortie), 'aucune annotation de run');
  assert.ok(/CI_NON_VERTE/.test(r.resume), `résumé de job muet : ${JSON.stringify(r.resume)}`);
  assert.ok(/^etat=BLOCKED$/m.test(r.sortieEtape),
    `sortie d’étape illisible par l’étape suivante : ${JSON.stringify(r.sortieEtape)}`);
  assert.ok(/^etat_code=CI_NON_VERTE$/m.test(r.sortieEtape), 'code absent de la sortie d’étape');
  assert.ok(r.etat && r.etat.etat === 'BLOCKED', 'JSON absent ou muet');
  // Et le résumé porte les six champs, pas seulement le verdict.
  for (const champ of ['condition', 'sha', 'branche', 'lot', 'maillon', 'prochaine_action']) {
    assert.ok(r.resume.includes(champ), `le résumé de job n’expose pas « ${champ} »`);
  }
});

epreuve('seul un maillon cassé rougit — un arrêt propre n’est pas une panne', () => {
  const b = bac({ ciRouge: true });
  travailDeClaude(b);
  const r = rapatrier(b, { transporter: true });
  assert.strictEqual(r.code, 0,
    'un BLOCKED rougit la CI : les arrêts légitimes vont apprendre à ignorer le rouge');
});
// ── MÉNAGE ──────────────────────────────────────────────────────────────────
for (const d of bacs) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* rien */ } }

console.log(`\nContinuité de bout en bout — ${reussites} épreuve(s) passée(s), ${echecs.length} échec(s).`);
if (echecs.length) process.exit(1);
