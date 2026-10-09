// Un PREPROD survit-il à sa release ?
//
// Arbitrage de Frédéric Bragance du 09/09/2026 : « il doit être détruit après
// chaque release ». Cette garde existe parce qu'une décision que rien ne
// mécanise tient tant que quelqu'un y pense, et cesse de tenir le jour où
// personne n'y pense.
//
// Un PREPROD contient les noms, pointages, évaluations et éléments de paie
// d'une vraie équipe. Oublié, il devient l'endroit où une fuite se loge — celle
// du 04/09/2026 était de cette famille.
'use strict';
const path = require('path');
const assert = require('assert');
const G = require(path.join(__dirname, 'outils', 'garde-preprod-ephemere.js'));

const MAINTENANT = '2026-09-09T18:00:00.000Z';
const registre = (cycles, fenetre = 48) => ({ fenetre_heures: fenetre, cycles });

let n = 0;
function t(nom, fn) { fn(); n++; console.log('OK — ' + nom); }

t('aucun PREPROD ouvert : rien à dire', () => {
  const r = G.controler({ registre: registre([]), maintenantISO: MAINTENANT });
  assert.strictEqual(r.indisponible, null);
  assert.deepStrictEqual(r.perimes, []);
  assert.deepStrictEqual(r.ouverts, []);
});

t('un PREPROD DÉTRUIT ne compte plus', () => {
  const r = G.controler({ registre: registre([
    { projet_ref: 'abc', release: 'R1', cree_le: '2026-09-01T10:00:00Z', detruit_le: '2026-09-01T18:00:00Z' },
  ]), maintenantISO: MAINTENANT });
  assert.deepStrictEqual(r.ouverts, [], 'une entrée fermée est close, même très ancienne');
});

t('un PREPROD ouvert DANS la fenêtre est signalé sans bloquer', () => {
  // Le travail en cours n'est pas une faute. On le montre, on ne l'arrête pas.
  const r = G.controler({ registre: registre([
    { projet_ref: 'abc', release: 'R2', cree_le: '2026-09-09T06:00:00Z', detruit_le: null },
  ]), maintenantISO: MAINTENANT });
  assert.strictEqual(r.ouverts.length, 1);
  assert.strictEqual(r.ouverts[0].heures, 12);
  assert.deepStrictEqual(r.perimes, [], '12 h sur 48 : rien à reprocher');
});

t('un PREPROD ouvert AU-DELÀ de la fenêtre est périmé, et NOMMÉ', () => {
  const r = G.controler({ registre: registre([
    { projet_ref: 'preprod-xyz', release: 'R3', cree_le: '2026-09-06T10:00:00Z', detruit_le: null },
  ]), maintenantISO: MAINTENANT });
  assert.strictEqual(r.perimes.length, 1);
  assert.strictEqual(r.perimes[0].ref, 'preprod-xyz');
  assert.strictEqual(r.perimes[0].release, 'R3', 'la release concernée doit être dite');
  assert.ok(r.perimes[0].heures > 48);
});

t('la limite est stricte, pas approximative', () => {
  const a48 = G.controler({ registre: registre([
    { projet_ref: 'a', cree_le: '2026-09-07T18:00:00Z', detruit_le: null }]), maintenantISO: MAINTENANT });
  assert.deepStrictEqual(a48.perimes, [], 'exactement 48 h : encore dans la fenêtre');
  const a49 = G.controler({ registre: registre([
    { projet_ref: 'a', cree_le: '2026-09-07T17:00:00Z', detruit_le: null }]), maintenantISO: MAINTENANT });
  assert.strictEqual(a49.perimes.length, 1, '49 h : dehors');
});

t('une entrée SANS DATE ne passe pas pour saine', () => {
  // La taire reviendrait à laisser un environnement hors de toute surveillance.
  const r = G.controler({ registre: registre([
    { projet_ref: 'sans-date', detruit_le: null },
  ]), maintenantISO: MAINTENANT });
  assert.strictEqual(r.illisibles.length, 1);
  assert.strictEqual(r.illisibles[0].ref, 'sans-date');
  assert.deepStrictEqual(r.perimes, [], 'elle n’est pas « périmée » : elle est INJUGEABLE, et c’est différent');
});

t('FAIL CLOSED — registre illisible, aucune conclusion', () => {
  assert.ok(G.controler({ registre: null, maintenantISO: MAINTENANT }).indisponible);
  assert.ok(G.controler({ registre: registre([]), maintenantISO: 'pas une date' }).indisponible);
});

t('SANS SEUIL déclaré, « trop vieux » n’a pas de sens', () => {
  // Une fenêtre absente ne doit pas être remplacée par une valeur choisie ici :
  // ce serait décider à la place de l'arbitrage.
  // L'objet est construit À LA MAIN ici : mon aide `registre()` applique une
  // valeur par défaut de 48, si bien qu'une fenêtre `undefined` n'atteignait
  // jamais le code testé. L'épreuve mesurait sa propre commodité.
  for (const f of [undefined, null, 0, -1, 'quarante-huit']) {
    const r = G.controler({ registre: { fenetre_heures: f, cycles: [] }, maintenantISO: MAINTENANT });
    assert.ok(r.indisponible, `fenêtre « ${f} » devrait rendre le verdict impossible`);
  }
});

t('le registre réel du dépôt est lisible et cohérent', () => {
  const reel = G.lireRegistre();
  assert.ok(reel, 'docs/handoff/PREPROD-CYCLE.json doit être lisible');
  assert.strictEqual(reel.fenetre_heures, 48);
  assert.ok(reel.pourquoi_48, 'un seuil sans justification se déplace au premier agacement');
  const r = G.controler({ registre: reel, maintenantISO: new Date().toISOString() });
  assert.strictEqual(r.indisponible, null);
  assert.deepStrictEqual(r.perimes, [], 'aucun PREPROD périmé aujourd’hui');
});

console.log(`\n${n}/${n} vérifications passées — un PREPROD ne survit pas à sa release.`);
