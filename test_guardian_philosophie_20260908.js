// Épreuves du Guardian Philosophie NEXUS (outils/guardian-philosophie.js).
//
// Ce guardian juge si NEXUS reste NEXUS, indépendamment de savoir si le code
// est correct. Arbitré CONSULTATIF (Q75) : jamais bloquant tant qu'il dépend
// d'un jugement de modèle.
//
// Ce qu'il mécanise n'est PAS un jugement : une section titrée qui disparaît
// entièrement laisse le lecteur incapable de distinguer « vérifié, rien à
// signaler » de « pas vérifié ». Critères 4 (explicabilité) et 8
// (fail-closed) de la doctrine.
//
// LE RISQUE PRINCIPAL DE CETTE GARDE EST DE TROP CRIER. Son premier jet
// signalait toute expression conditionnelle rendant du vide : 435
// signalements sur 47 fichiers. Une garde qui crie autant se fait désactiver,
// et emporte avec elle ses vraies trouvailles. Les épreuves ci-dessous
// défendent donc autant ce qu'elle NE doit PAS signaler que ce qu'elle doit
// trouver.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');

const OUTIL = path.join(__dirname, 'outils', 'guardian-philosophie.js');
const G = require(OUTIL);

let passes = 0;
function t(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

t('une SECTION TITRÉE qui disparaît est signalée, avec sa condition et son titre', () => {
  const src = "html = `${gate ? `<div class=\"card\"><div class=\"section-label\">Intervention</div>x</div>` : ''}`;";
  const r = G.analyserSource(src, 'ecran.html');
  assert.strictEqual(r.length, 1, JSON.stringify(r));
  assert.strictEqual(r[0].code, 'SECTION_QUI_DISPARAIT');
  assert.strictEqual(r[0].titre, 'Intervention');
  assert.strictEqual(r[0].condition, 'gate');
  assert.strictEqual(r[0].critere, 4);
  assert.ok(/pas vérifié/.test(r[0].texte), r[0].texte);
});

t('un badge ou un fragment INLINE qui disparaît n’est PAS signalé', () => {
  // La calibration qui décide de la survie de cette garde. Un commentaire
  // optionnel, une pastille, un suffixe : leur absence ne se lit pas
  // « non contrôlé ». Les signaler ferait 435 findings et tuerait la garde.
  const cas = [
    "`${c ? `<span class=\"badge\">3</span>` : ''}`",
    "`${x ? ` · ${x}` : ''}`",
    "`${commentaire ? `<div class=\"note\">${commentaire}</div>` : ''}`",
    "`${n ? `<b>${n}</b>` : ''}`",
  ];
  for (const src of cas) {
    assert.deepStrictEqual(G.analyserSource(src, 'f.html'), [], src);
  }
});

t('une section qui rend un ÉTAT EXPLICITE quand elle est vide n’est pas signalée', () => {
  // C'est la forme correcte, et la garde doit la reconnaître — sinon elle
  // punirait le correctif qu'elle réclame.
  const src = "`${liste.length ? `<div class=\"card\"><div class=\"section-label\">Retards</div>…</div>`"
    + " : `<div class=\"card\"><div class=\"section-label\">Retards</div>Aucun retard.</div>`}`";
  assert.deepStrictEqual(G.analyserSource(src, 'f.html'), []);
});

t('plusieurs sections fautives dans un même écran sont toutes rendues', () => {
  const src = "`${a ? `<div class=\"card\"><div class=\"section-label\">A</div>x</div>` : ''}`"
    + "`${b ? `<div class=\"card\"><div class=\"section-titre\">B</div>y</div>` : ''}`";
  const r = G.analyserSource(src, 'f.html');
  assert.strictEqual(r.length, 2);
  assert.deepStrictEqual(r.map(x => x.titre).sort(), ['A', 'B']);
});

t('une source vide ou illisible ne fabrique aucun verdict', () => {
  for (const src of [null, undefined, '', '   ', 42]) {
    assert.deepStrictEqual(G.analyserSource(src, 'f.html'), [], JSON.stringify(src));
  }
});

t('CALIBRATION — le dépôt réel reste dans un ordre de grandeur exploitable', () => {
  // Mesuré le 08/09/2026 : 8 signalements sur 62 écrans, tous relus. Ce
  // plafond n'est pas décoratif : si un élargissement du détecteur faisait
  // exploser le compte, la garde deviendrait du bruit et personne ne la
  // lirait plus. Le jour où le chiffre monte, c'est le détecteur qu'on
  // regarde, pas le dépôt.
  const findings = G.analyserDepot();
  assert.ok(findings.length >= 1, 'la garde doit trouver quelque chose sur le dépôt réel');
  assert.ok(findings.length <= 20,
    `${findings.length} signalements : au-delà de 20, la garde n’est plus lisible et se fera désactiver`);
  assert.ok(findings.every(f => f.fichier && f.condition && f.texte),
    'chaque signalement doit nommer son fichier, sa condition et sa raison');
});

t('FAIL CLOSED — sans doctrine lisible, aucun verdict n’est rendu', () => {
  // Une garde qui juge sans référence écrite juge selon elle-même. Le
  // document a d'ailleurs passé deux jours sur une branche non rapatriée : le
  // cas n'est pas théorique.
  const d = G.doctrineLisible(path.join(__dirname, 'fichier-inexistant.md'));
  assert.strictEqual(d.lisible, false);
  assert.ok(/introuvable/.test(d.motif), d.motif);

  const tronquee = path.join(require('os').tmpdir(), 'doctrine-tronquee-' + Date.now() + '.md');
  fs.writeFileSync(tronquee, '# Guardian Philosophie NEXUS\n\n1. **Simplicité** — x\n');
  try {
    const r = G.doctrineLisible(tronquee);
    assert.strictEqual(r.lisible, false, 'une doctrine amputée ne vaut pas une doctrine');
    assert.ok(/question obligatoire/.test(r.motif) && /critère 9/.test(r.motif), r.motif);
  } finally { fs.unlinkSync(tronquee); }

  assert.strictEqual(G.doctrineLisible().lisible, true, 'la doctrine réelle doit être complète');
});

t('FAIL CLOSED de bout en bout — doctrine absente, la CLI le DIT et sort en erreur', () => {
  // Survivante de mutation : transformer ce refus en « rien à signaler »
  // passait inaperçu, faute d'un cas où la doctrine manque. Or c'est le seul
  // moment où cette garde peut mentir gravement — en donnant un vert de
  // complaisance sur un dépôt dont elle n'a lu aucune règle.
  const r = spawnSync('node', [OUTIL], {
    encoding: 'utf8', cwd: __dirname,
    env: { ...process.env, NEXUS_DOCTRINE_PHILOSOPHIE: path.join(__dirname, 'doctrine-absente.md') },
  });
  assert.notStrictEqual(r.status, 0, 'sans doctrine, la garde doit échouer, pas rassurer');
  assert.ok(/INDISPONIBLE/.test(r.stderr), r.stderr);
  assert.ok(/jugerait selon elle-même/.test(r.stderr), r.stderr);
  assert.ok(!/Aucune section/.test(r.stdout), 'et surtout ne rendre aucun verdict : ' + r.stdout);
});

t('la garde REFUSE d’évaluer les neuf critères, et le dit', () => {
  // Une garde qui déclarerait « simplicité : conforme » fabriquerait une
  // conformité que personne n'a jugée — exactement ce que le critère 4
  // interdit. Elle les rappelle, elle ne les note pas.
  assert.strictEqual(G.CRITERES.length, 9);
  const r = spawnSync('node', [OUTIL], { encoding: 'utf8', cwd: __dirname });
  assert.strictEqual(r.status, 0, 'consultatif : ne bloque jamais la CI');
  assert.ok(/ne sont PAS évalués/.test(r.stdout), r.stdout);
  assert.ok(/consultatif/.test(r.stdout), 'le rapport doit dire son propre statut');
  assert.ok(/Pourquoi un humain doit-il intervenir ici/.test(r.stdout),
    'la question obligatoire doit être rappelée à chaque passage');
  for (const mot of ['conforme :', 'note :', 'score']) {
    assert.ok(!new RegExp(mot, 'i').test(r.stdout), `la garde ne doit pas noter : « ${mot} »`);
  }
});

console.log(`\n${passes}/${passes} vérifications passées — la garde nomme le silence ambigu, et ne note personne.`);
