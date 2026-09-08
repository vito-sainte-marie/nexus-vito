// Épreuves de CARB-007 — une seule vérité pour les capacités carburant.
//
// `NEXUS-Parametres-Rappels-v1.html` portait sa PROPRE vérité carburant :
// capacités de cuve écrites en dur (`{ sp: 28500, go: 27000 }`) et camion à
// 36 000 L. Les deux premières étaient FAUSSES pour la station réelle
// (28 761 et 28 553) : cet écran et NEXUS Carburants ne pouvaient donc pas
// donner la même réponse à la même question.
//
// Trouvé par le Guardian Bible le 07/09/2026, arbitré par decision-1 (Q74) :
// « L'écran consomme la vérité unique du moteur canonique, aucune
// réimplémentation locale du calcul. »
//
// Ces épreuves tiennent la première moitié : les CONSTANTES physiques ont
// désormais un propriétaire unique et sont lues dans `station_config`. La
// seconde moitié — la logique de recommandation elle-même, qui diverge encore
// (sécurité 3 jours contre 2, règle de fin de mois, arrondis, découpe du
// camion) — reste ouverte et documentée.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

require(path.join(__dirname, 'nexus-carburant-moteur.js'));
const M = globalThis.NexusCarburantMoteur;
const ECRAN = path.join(__dirname, 'NEXUS-Parametres-Rappels-v1.html');

let passes = 0;
function t(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

t('la limite de remplissage se calcule sur les tampons, pas sur les capacités brutes', () => {
  // La confusion qui a produit CARB-007 : « capacité » et « limite de
  // remplissage » ne sont pas la même chose. Sur la station Test, SP95 a
  // 25 000 L de capacité pour 23 750 L de limite — un camion ne peut jamais
  // viser la première.
  const cuves = [{ capacite: 25000, limite_remplissage: 23750 }];
  assert.strictEqual(M.capaciteTotale(cuves), 25000);
  assert.strictEqual(M.limiteRemplissageTotale(cuves), 23750);
});

t('plusieurs cuves d’un même carburant s’additionnent', () => {
  const go = [{ capacite: 15000, limite_remplissage: 14250 }, { capacite: 8000, limite_remplissage: 7600 }];
  assert.strictEqual(M.limiteRemplissageTotale(go), 21850);
});

t('une cuve sans limite déclarée ne fabrique pas de capacité', () => {
  // Compter une cuve non renseignée comme pleine capacité gonflerait la
  // recommandation d'un volume que la cuve ne peut pas recevoir.
  assert.strictEqual(M.limiteRemplissageTotale([{ capacite: 30000 }]), 0);
  assert.strictEqual(M.limiteRemplissageTotale([]), 0);
  assert.strictEqual(M.limiteRemplissageTotale(null), 0);
  assert.strictEqual(M.limiteRemplissageTotale([{ limite_remplissage: 'abc' }]), 0);
});

t('CONTRAT — l’écran Rappels n’écrit plus aucune capacité en dur', () => {
  const brut = fs.readFileSync(ECRAN, 'utf8');
  const code = brut
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
  for (const motif of [/CAPACITE_CUVE\s*=\s*\{\s*sp:\s*\d/, /CAMION_CAPACITE\s*=\s*\d/]) {
    assert.ok(!motif.test(code), 'capacité codée en dur retrouvée : ' + motif);
  }
  assert.ok(/chargerConfigEtCuves/.test(code), 'l’écran doit lire station_config par le chargeur canonique');
  assert.ok(/limiteRemplissageTotale/.test(code), 'et sommer les limites par le propriétaire unique du calcul');
});

t('CONTRAT — sans configuration lue, l’écran ne recommande RIEN', () => {
  // Fail closed. Retomber sur des nombres supposés serait exactement le
  // défaut qu'on corrige : une recommandation fausse coûte plus cher qu'une
  // absence de recommandation.
  const brut = fs.readFileSync(ECRAN, 'utf8');
  // Le motif `if (!CONFIG_CARBURANT_LUE)` apparaît DEUX fois dans le fichier :
  // ici pour le garde, et plus haut pour renseigner le motif d'absence. Un
  // premier jet visait le motif nu et validait donc la mauvaise ligne — une
  // mutation supprimant le vrai garde y survivait. On vise la forme exacte du
  // bloc, avec son accolade.
  const GARDE = 'if (!CONFIG_CARBURANT_LUE) {';
  assert.strictEqual(brut.split(GARDE).length - 1, 1, 'le garde doit exister, une seule fois');
  assert.ok(/Recommandation indisponible/.test(brut), 'et l’écran doit le DIRE');
  const i = brut.indexOf(GARDE);
  const j = brut.indexOf('calculerRecommandationCombinee(\n', i);
  assert.ok(j > i, 'le garde doit venir AVANT l’appel au calcul');
  const entre = brut.slice(i, j);
  assert.ok(/\n\s*return;/.test(entre),
    'et SORTIR, pas seulement afficher un avertissement avant de calculer quand même');
  assert.ok(entre.length < 1200, 'le garde doit être juste avant l’appel, pas perdu à l’autre bout du fichier');
});

t('CONTRAT — le calcul de la limite n’a qu’un propriétaire', () => {
  // Il vivait en double : en ligne dans le moteur de commande, et en dur dans
  // l'écran Rappels. Une troisième copie apparaîtrait un jour si rien ne
  // l'empêchait.
  const core = fs.readFileSync(path.join(__dirname, 'nexus-carburant-commande-donnees-core.js'), 'utf8');
  assert.ok(/limiteRemplissageTotale\(/.test(core),
    'le moteur de commande doit consommer le propriétaire unique');
  const codeCore = core.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
  assert.ok(!/reduce\(\(s, c\) => s \+ \(Number\(c\.limite_remplissage\)/.test(codeCore),
    'et ne pas garder sa propre somme en ligne');
});

console.log(`\n${passes}/${passes} vérifications passées — les capacités physiques ont un seul propriétaire.`);
