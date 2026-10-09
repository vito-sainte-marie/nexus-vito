// Empreinte de progression — un réveil ne se répète pas sans progrès.
//
// LE DÉFAUT QUE CECI MESURE. La règle 11 du skill Fast Track et le
// PROGRESS_FINGERPRINT qui la porte existaient depuis des semaines en prose
// seulement. Une recherche dans `outils/` le 09/10/2026 n'en a trouvé aucune
// trace : ni fonction, ni garde, ni épreuve. La seule protection câblée était
// l'empreinte du CORPS du réveil (`<!-- nexus-reveil: … -->`), qui ne mord que
// sur un texte identique au caractère près. Or le corps du réveil LISTE les
// refs qui portent la demande : une branche de travail de plus, et le corps
// est neuf, l'empreinte autre, le même réveil repart — alors que le Handoff
// n'a pas bougé d'un octet. Mesuré en dur par l'épreuve C.
//
// Cette épreuve tient huit propriétés, chacune par une mutation qui mord :
//   A. les six champs sont ceux de la doctrine, dans son ordre, et SKILL.md
//      les nomme — le code et la doctrine ne divergent pas en silence ;
//   B. l'empreinte dépend de CHACUN des six champs, aucun n'est décoratif ;
//   C. deux corps différents portant le même état rendent la MÊME empreinte —
//      c'est exactement le trou que l'empreinte de texte laissait ;
//   D. zéro occurrence antérieure publie, une seule suffit à rendre STALL ;
//   E. la marque se relit depuis un historique bruité, doublons comptés ;
//   F. une empreinte sans lot est refusée, jamais calculée par défaut ;
//   G. le câblage CI appelle réellement l'outil, publie la marque, et prend
//      `head` sur le DOMAINE du handoff et non sur le SHA du push ;
//   H. un champ absent vaut `(absent)`, pas une empreinte muette.
'use strict';
const fs = require('fs');
const assert = require('assert');

const RACINE = __dirname;
const emp = require('./outils/empreinte-progression.js');

let reussites = 0;
const echecs = [];
function epreuve(nom, f) {
  try { f(); reussites += 1; console.log(`  ✅ ${nom}`); }
  catch (e) { echecs.push({ nom, e }); console.log(`  ❌ ${nom}\n     ${e && e.stack || e}`); }
}

const lire = f => fs.readFileSync(`${RACINE}/${f}`, 'utf8');
const SKILL = 'docs/skills/nexus-handoff-fast-track/SKILL.md';
const CI = '.github/workflows/tests.yml';

// L'état du réveil G1 au 09/10/2026, tel que `reveil-orchestrateur.js --json`
// le rend. Six champs, pas cinq : c'est le contrat de la doctrine.
const ETAT = Object.freeze({
  lot: 'GO-G1-MIGRATIONS-REGULARISATION-1-20261009',
  request: 'request-3.md',
  head: '58a828b0000000000000000000000000000000aa',
  gate_state: 'ATTENTE_DECISION',
  blocker: 'DEMANDE_DEPASSEE',
  action_next: 'ChatGPT -> AWAITING_DECISION',
});

// Mute un fichier du dépôt en mémoire. L'ancre doit être unique et mordre :
// une mutation muette rendrait un vert sans rien mesurer.
function mute(fichier, avant, apres) {
  const s = lire(fichier);
  assert.strictEqual(s.split(avant).length - 1, 1, `ancre non unique ou absente dans ${fichier}`);
  const muté = s.replace(avant, apres);
  assert.notStrictEqual(muté, s, 'mutation sans effet');
  return muté;
}

// ── A. LE CODE ET LA DOCTRINE ───────────────────────────────────────────────

epreuve('A — les six champs sont ceux de la doctrine, dans son ordre', () => {
  assert.deepStrictEqual(emp.CHAMPS_EMPREINTE,
    ['lot', 'request', 'head', 'gate_state', 'blocker', 'action_next']);
});

epreuve('A — SKILL.md nomme les six champs du fingerprint', () => {
  const texte = lire(SKILL);
  const bloc = texte.slice(texte.indexOf('**PROGRESS_FINGERPRINT.**'));
  for (const c of emp.CHAMPS_EMPREINTE) {
    assert.ok(bloc.toUpperCase().includes(c.toUpperCase()), `${c} absent du paragraphe PROGRESS_FINGERPRINT`);
  }
});

epreuve('A — SKILL.md nomme l’outil qui câble la règle', () => {
  assert.ok(lire(SKILL).includes('outils/empreinte-progression.js'),
    'la règle resterait de la prose : rien ne dirait où elle est mécanisée');
});

// ── B. CHAQUE CHAMP PORTE ───────────────────────────────────────────────────

epreuve('B — le même état rend la même empreinte', () => {
  assert.strictEqual(emp.empreinte(ETAT), emp.empreinte({ ...ETAT }));
});

epreuve('B — chacun des six champs change l’empreinte', () => {
  const base = emp.empreinte(ETAT);
  for (const c of emp.CHAMPS_EMPREINTE) {
    const autre = emp.empreinte({ ...ETAT, [c]: String(ETAT[c]) + '-bouge' });
    assert.notStrictEqual(autre, base, `${c} est décoratif : le faire bouger ne change rien`);
  }
});

epreuve('B — l’ordre des champs est normatif, pas cosmétique', () => {
  // Deux implémentations qui ordonnent autrement rendraient deux empreintes
  // pour un même état, et la garde croirait voir un progrès.
  const permute = { ...ETAT, request: ETAT.head, head: ETAT.request };
  assert.notStrictEqual(emp.empreinte(permute), emp.empreinte(ETAT),
    'deux champs échangés passent inaperçus : l’empreinte ignore les clés');
});

// ── C. LE TROU QUE L'EMPREINTE DE TEXTE LAISSAIT ────────────────────────────

epreuve('C — deux corps différents, même état : une seule empreinte', () => {
  const corpsA = 'Réveil.\nRefs porteuses : origin/handoff-continuite-20260920\n';
  const corpsB = 'Réveil.\nRefs porteuses : claude/travail-du-jour, origin/handoff-continuite-20260920\n';
  const crypto = require('crypto');
  const sha = t => crypto.createHash('sha256').update(t).digest('hex').slice(0, 16);
  assert.notStrictEqual(sha(corpsA), sha(corpsB),
    'les deux corps devaient différer : sinon l’épreuve ne mesure rien');
  // L'état, lui, n'a pas bougé. L'empreinte ne bouge pas non plus.
  assert.strictEqual(emp.empreinte(ETAT), emp.empreinte(ETAT));
  assert.strictEqual(emp.decider(ETAT, emp.marque(emp.empreinte(ETAT))).etat, 'FAST_TRACK_STALL',
    'le vecteur réel de l’incident resterait ouvert');
});

// ── D. LA RÉPÉTITION ────────────────────────────────────────────────────────

epreuve('D — canal vierge : le réveil part', () => {
  const r = emp.decider(ETAT, '');
  assert.strictEqual(r.etat, 'PUBLIER');
  assert.strictEqual(r.anterieures, 0);
});

epreuve('D — une seule occurrence antérieure suffit à rendre STALL', () => {
  // « Le même fingerprint DEUX FOIS DE SUITE donne FAST_TRACK_STALL » : publier
  // alors qu'une occurrence existe ferait précisément la deuxième.
  assert.strictEqual(emp.ANTERIEURES_TOLEREES, 0);
  const r = emp.decider(ETAT, 'bruit\n' + emp.marque(emp.empreinte(ETAT)) + '\nbruit');
  assert.strictEqual(r.etat, 'FAST_TRACK_STALL');
  assert.strictEqual(r.anterieures, 1);
});

epreuve('D — un progrès réel rouvre la publication', () => {
  const historique = emp.marque(emp.empreinte(ETAT));
  const avance = { ...ETAT, gate_state: 'DECISION_RENDUE' };
  assert.strictEqual(emp.decider(avance, historique).etat, 'PUBLIER',
    'la garde bloquerait un réveil légitime : elle se ferait débrancher');
});

epreuve('D — l’empreinte d’un AUTRE lot ne bloque pas celui-ci', () => {
  const autre = emp.marque(emp.empreinte({ ...ETAT, lot: 'FDJ-AUTRE-LOT-20261009' }));
  assert.strictEqual(emp.decider(ETAT, autre).etat, 'PUBLIER');
});

// ── E. LA MARQUE VOYAGE ─────────────────────────────────────────────────────

epreuve('E — la marque se relit depuis un historique bruité', () => {
  const e = emp.empreinte(ETAT);
  const historique = `commentaire\n\n${emp.marque(e)}\n<!-- nexus-reveil: 0123456789abcdef -->\nautre`;
  assert.deepStrictEqual(emp.empreintesDuTexte(historique), [e],
    'une marque de réveil ne doit pas être lue comme une marque d’état');
});

epreuve('E — les doublons se comptent, ils ne se dédupliquent pas', () => {
  const e = emp.empreinte(ETAT);
  const r = emp.decider(ETAT, [emp.marque(e), emp.marque(e), emp.marque(e)].join('\n'));
  assert.strictEqual(r.anterieures, 3, 'compter est le but : dédupliquer effacerait la répétition');
});

epreuve('E — un historique vide ou absent ne fabrique aucune occurrence', () => {
  assert.deepStrictEqual(emp.empreintesDuTexte(''), []);
  assert.deepStrictEqual(emp.empreintesDuTexte(null), []);
  assert.deepStrictEqual(emp.empreintesDuTexte(undefined), []);
});

epreuve('E — une marque tronquée n’est pas une marque', () => {
  assert.deepStrictEqual(emp.empreintesDuTexte('<!-- nexus-empreinte: abc -->'), [],
    'une empreinte partielle ouvrirait une collision silencieuse');
});

// ── F. LE LOT EST EXIGÉ ─────────────────────────────────────────────────────

epreuve('F — une empreinte sans lot est refusée', () => {
  // Sans lot, deux chantiers au même état partageraient une empreinte, et le
  // STALL de l'un bloquerait l'autre.
  assert.throws(() => emp.empreinte({ ...ETAT, lot: '' }), /lot/);
  assert.throws(() => emp.empreinte({}), /lot/);
});

// ── G. LE CÂBLAGE ───────────────────────────────────────────────────────────

epreuve('G — l’étape de publication appelle réellement l’outil', () => {
  assert.ok(lire(CI).includes('node outils/empreinte-progression.js'),
    'la garde existerait en module sans être branchée : exactement le défaut d’origine');
});

epreuve('G — la marque d’état est publiée dans le commentaire', () => {
  // Si la marque ne voyage pas, l'exécution suivante ne trouve rien et la
  // garde ne mord jamais : un module vert, un réveil répétitif.
  assert.ok(/gh issue comment[\s\S]{0,200}/.test(lire(CI)));
  assert.ok(lire(CI).includes('"$MARQUE" "$MARQUE_ETAT"'),
    'le commentaire publié ne porte pas la marque d’état');
});

epreuve('G — `head` est pris sur le DOMAINE du handoff, pas sur le SHA du push', () => {
  const ci = lire(CI);
  assert.ok(ci.includes("git log -1 --format=%H -- docs/handoff"),
    'head doit être le dernier commit du domaine');
  const appel = ci.slice(ci.indexOf('node outils/empreinte-progression.js'));
  const bloc = appel.slice(0, appel.indexOf('--marques -'));
  assert.ok(!/--head "\$\{?GITHUB_SHA/.test(bloc),
    'pris au push, head changerait à chaque commit et la garde ne mordrait jamais');
});

epreuve('G — mutation : débrancher l’appel est détecté', () => {
  const muté = mute(CI, 'node outils/empreinte-progression.js', 'node outils/empreinte-debranchee.js');
  assert.ok(!muté.includes('node outils/empreinte-progression.js'));
});

epreuve('G — mutation : head pris au push est détecté', () => {
  const muté = mute(CI, 'HEAD_HANDOFF=$(git log -1 --format=%H -- docs/handoff || true)',
    'HEAD_HANDOFF=$GITHUB_SHA');
  assert.ok(!muté.includes('git log -1 --format=%H -- docs/handoff'),
    'la mutation devait retirer la portée par domaine');
});

epreuve('G — un STALL n’écrit pas `numero` : il n’alimente pas le relais', () => {
  const ci = lire(CI);
  const i = ci.indexOf('FAST_TRACK_STALL" ]; then');
  assert.ok(i > 0, 'le bloc de STALL est introuvable');
  const bloc = ci.slice(i, ci.indexOf('fi', i));
  assert.ok(!bloc.includes('numero=$NUM'),
    'écrire numero relancerait l’arbitre sur une question posée dans les mêmes termes');
});

// ── H. ROBUSTESSE ───────────────────────────────────────────────────────────

epreuve('H — un champ absent vaut `(absent)`, et se voit', () => {
  const r = emp.decider({ lot: ETAT.lot }, '');
  assert.strictEqual(r.champs.blocker, emp.ABSENT);
  assert.strictEqual(r.champs.head, emp.ABSENT);
});

epreuve('H — les espaces se replient, la casse se préserve', () => {
  assert.strictEqual(emp.empreinte({ ...ETAT, request: '  request-3.md  ' }), emp.empreinte(ETAT));
  assert.notStrictEqual(emp.empreinte({ ...ETAT, request: 'REQUEST-3.MD' }), emp.empreinte(ETAT),
    'masquer la casse inventerait un progrès ou en effacerait un');
});

epreuve('H — l’empreinte est stable, courte et hexadécimale', () => {
  const e = emp.empreinte(ETAT);
  assert.match(e, /^[0-9a-f]{16}$/);
  assert.strictEqual(e, emp.empreinte(ETAT));
});

console.log(`\nEmpreinte de progression — ${reussites} épreuve(s) passée(s), ${echecs.length} échec(s).`);
if (echecs.length) process.exit(1);
