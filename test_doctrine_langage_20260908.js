// La doctrine du langage tient-elle ses propres promesses ?
//
// Un document de doctrine échoue de deux façons. Il échoue en recopiant une
// vérité qui vit ailleurs — il devient alors une seconde source, et les deux
// divergent sans que personne ne le voie. Et il échoue en affirmant un état du
// produit qui a cessé d'être vrai — il devient alors un texte rassurant, ce que
// NEXUS combat partout ailleurs.
//
// Ces épreuves ne jugent pas la prose. Elles vérifient que le document ne
// duplique rien, qu'il désigne des propriétaires qui existent, et qu'il
// s'applique à lui-même la règle qu'il pose.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const DOC = path.join(__dirname, 'docs', 'nexus', 'DOCTRINE-LANGAGE-VOCABULAIRE.md');
const texte = fs.readFileSync(DOC, 'utf8');

let n = 0;
function t(nom, fn) { fn(); n++; console.log('OK — ' + nom); }

t('le document ne recopie PAS le vocabulaire de signature', () => {
  // `NexusVocab.SIGNATURE` en est le propriétaire unique. Recopier ses termes
  // ici créerait une seconde liste, et c'est toujours la copie qu'on oublie de
  // mettre à jour. Le document doit NOMMER le propriétaire, pas le doubler.
  assert.ok(/NexusVocab\.SIGNATURE/.test(texte), 'le propriétaire doit être nommé');

  const src = fs.readFileSync(path.join(__dirname, 'nexus-vocabulaire.js'), 'utf8');
  const bloc = src.slice(src.indexOf('NexusVocab.SIGNATURE'), src.indexOf('NexusVocab.cycle'));
  const termes = [...bloc.matchAll(/: '([^']+)'/g)].map(m => m[1]);
  assert.ok(termes.length >= 15, 'la liste de référence doit être trouvée : ' + termes.length);

  const recopies = termes.filter(x => texte.includes(x));
  // Quelques termes servent d'ILLUSTRATION dans une phrase, ce qui est légitime.
  // Les recopier presque tous ne le serait plus : ce serait la liste.
  assert.ok(recopies.length <= 5,
    `${recopies.length} termes de signature recopiés : le document redevient une liste concurrente — ` + recopies.join(', '));
});

t('tout propriétaire désigné par le document existe vraiment', () => {
  // Une doctrine qui renvoie à un fichier absent donne l'apparence d'être
  // adossée à du code. C'est pour cette raison que le renvoi vers CE document
  // n'a pas été ajouté à la Bible avant qu'il existe.
  const cites = [...texte.matchAll(/`((?:outils\/)?[a-z0-9-]+\.js)`/g)].map(m => m[1]);
  assert.ok(cites.length >= 4, 'le document doit désigner des mécanismes : ' + cites.join(', '));
  for (const f of new Set(cites)) {
    assert.ok(fs.existsSync(path.join(__dirname, f)), `propriétaire désigné mais absent : ${f}`);
  }
});

t('les documents doctrinaux cités existent aussi', () => {
  const docs = [...texte.matchAll(/`(docs\/[A-Za-z0-9\/_.-]+\.(?:md|json))`/g)].map(m => m[1])
    .concat([...texte.matchAll(/`(NEXUS-Constitution-v1\.md)`/g)].map(m => m[1]));
  assert.ok(docs.length >= 3, 'au moins les sources doivent être citées');
  for (const d of new Set(docs)) {
    assert.ok(fs.existsSync(path.join(__dirname, d)), `document cité mais absent : ${d}`);
  }
});

t('le document s’applique à lui-même la règle qu’il pose', () => {
  // Il est hors portée de LANG-003 (portée 1 : le contenu lu par
  // l'utilisateur). S'en dispenser serait pourtant illisible : une doctrine du
  // langage qui ne se l'applique pas ne se défend pas.
  assert.strictEqual((texte.match(/—/g) || []).length, 0,
    'aucun tiret cadratin ne doit subsister dans la doctrine du langage');
});

t('la portée ARBITRÉE est celle qui est écrite, pas celle du cadrage', () => {
  // Le cadrage d'origine visait aussi « la documentation active ». Frédéric a
  // tranché plus étroit. Écrire la version large ici ferait dire à la doctrine
  // autre chose que la décision.
  assert.ok(/[Pp]ortée\s*:?\s*1/.test(texte), 'la portée 1 doit être nommée');
  assert.ok(/hors portée/.test(texte), 'et ce qui en est exclu doit être dit');
  assert.ok(/commentaires de développement/.test(texte));
  assert.ok(/plus étroite que la formulation du cadrage/.test(texte),
    'la restriction par rapport au cadrage doit être ASSUMÉE, pas silencieuse');
});

t('l’état du produit annoncé par le document est encore vrai', () => {
  // Le document affirme deux mesures. Une doctrine qui garde un chiffre périmé
  // se met à mentir doucement, et personne ne relit un document pour vérifier
  // un nombre.
  const m = texte.match(/(\d+) occurrences de « Conseiller NEXUS » dans (\d+) fichiers de produit/);
  assert.ok(m, 'la dette de renommage doit être chiffrée dans le document');

  const compte = {};
  const parcourir = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === '.git' || e.name === 'node_modules') continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { parcourir(p); continue; }
      if (!/\.(html|js)$/.test(e.name)) continue;
      const rel = path.relative(__dirname, p);
      if (rel.startsWith('test_') || rel.startsWith('outils/')) continue;
      const c = (fs.readFileSync(p, 'utf8').match(/Conseiller NEXUS/g) || []).length;
      if (c) compte[rel] = c;
    }
  };
  parcourir(__dirname);
  const total = Object.values(compte).reduce((a, b) => a + b, 0);
  assert.strictEqual(total, Number(m[1]),
    `le document annonce ${m[1]} occurrences, la mesure en trouve ${total}`);
  assert.strictEqual(Object.keys(compte).length, Number(m[2]),
    `le document annonce ${m[2]} fichiers, la mesure en trouve ${Object.keys(compte).length}`);
});

t('les termes prescrits mais NON employés sont annoncés comme tels', () => {
  // « Couverture jusqu'à » et « Présence réelle » n'existent nulle part dans le
  // code. Les poser sans le dire laisserait croire qu'ils sont en place.
  assert.ok(/prescrits mais pas encore employés/.test(texte),
    'le document doit distinguer la cible de l’état réel');
});

console.log(`\n${n}/${n} vérifications passées — une doctrine qui ne se vérifie pas est un texte rassurant.`);
