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

t('CONTRAT — l’écran Rappels ne contient PLUS de moteur carburant parallèle', () => {
  // Décision de Frédéric du 08/09/2026 : « le simulateur dans Rappels n'a
  // plus de sens ». Il tenait ses propres capacités, sa propre logique de
  // commande et son propre historique de jaugeage en localStorage — deux
  // écrans répondaient donc différemment à la même question.
  //
  // Ce contrat empêche sa réapparition, sous ce nom ou sous un autre : ce
  // n'est pas le nom des fonctions qui compte, c'est qu'aucune décision de
  // commande ne se recalcule ici.
  const brut = fs.readFileSync(ECRAN, 'utf8');
  const code = brut
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
  const interdits = [
    [/CAPACITE_CUVE/, 'capacité de cuve locale'],
    [/CAMION_CAPACITE|maximum_camion/, 'capacité camion locale'],
    [/calculerRecommandationCombinee|CAMION_COMPLET|COMPLEMENT/, 'logique de recommandation locale'],
    [/estJourOuvrable|prochainOuvrableApres|JOURS_FERIES/, 'calendrier de livraison local'],
    [/CONSO_MOYENNE|calculerConsoMoyenne/, 'moyenne de consommation locale'],
    [/nexus_jaugeage_historique/, 'historique de jaugeage local'],
  ];
  for (const [motif, quoi] of interdits) {
    assert.ok(!motif.test(code), `${quoi} retrouvée dans l’écran Rappels : ${motif}`);
  }
});

t('CONTRAT — l’écran renvoie vers le propriétaire de cette vérité', () => {
  // Retirer sans rediriger laisserait le manager sans réponse : le besoin
  // existe toujours, c'est l'endroit qui change.
  const brut = fs.readFileSync(ECRAN, 'utf8');
  assert.ok(/NEXUS-Carburants-Pilotage-v1\.html/.test(brut),
    'l’écran doit pointer vers NEXUS Carburants');
  assert.ok(fs.existsSync(path.join(__dirname, 'NEXUS-Carburants-Pilotage-v1.html')),
    'et cette page doit exister — un renvoi vers une page absente est une porte peinte sur un mur');
});

t('l’écran ne charge plus les moteurs dont il ne se sert pas', () => {
  const brut = fs.readFileSync(ECRAN, 'utf8');
  for (const moteur of ['nexus-carburant-moteur.js', 'nexus-carburant-commande-moteur.js',
    'nexus-carburant-commande-donnees-core.js']) {
    assert.ok(!new RegExp('<script src="' + moteur.replace('.', '\\.')).test(brut),
      `${moteur} chargé pour rien : chaque ouverture paierait le coût d’une chaîne inutilisée`);
  }
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
