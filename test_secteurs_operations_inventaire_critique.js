// Test — Cockpit "enrichir Opérations" avec les alertes Inventaire
// critiques (29/08/2026, doctrine "NEXUS Inventaire V2"). Frédéric a
// explicitement choisi de garder Inventaire fondu dans le secteur
// transversal Opérations (décision architecturale antérieure de l'audit du
// 12/08/2026, confirmée) plutôt que de lui donner un secteur à part — ce
// lot enrichit uniquement la phrase de risque déjà existante, jamais le
// score/statut, avec une distinction critiques/total qui existait déjà
// pour la caisse (nbCritiquesCaisse) mais pas pour l'inventaire.

const path = require('path');
const assert = require('assert');

global.window = global;
require(path.join('/sessions/dazzling-compassionate-ride/mnt/image nexus project', 'nexus-boussole-moteur.js'));
require(path.join('/sessions/dazzling-compassionate-ride/mnt/image nexus project', 'nexus-secteurs-moteur.js'));
const S = global.NexusSecteursMoteur;

function testSync(nom, fn) {
  try { fn(); console.log(`OK — ${nom}`); }
  catch (e) { console.error(`FAIL — ${nom}\n  ${e.stack}`); process.exitCode = 1; }
}

function entreeOperations() { return { id: 'operations', label: 'Opérations', icone: '•', cible: null }; }
function donneesOperations(extra) {
  return {
    operations: null,
    constatTempo: { totalJours: 10, detailOperations: 5, dernierJourExploitableLe: '2026-08-28' },
    controlesVerifyRestants: 0, nbCritiquesCaisse: 0, alertesInvOuvertes: 0, risqueStockTotal: 0, phrasesRisqueCaisse: [],
    ...extra,
  };
}

testSync('construireSecteurOperations — SANS alertesInvCritiquesOuvertes (appelant non mis à jour) -> phrase IDENTIQUE à avant, zéro régression', () => {
  const [secteur] = S.construireSecteurs([entreeOperations()], donneesOperations({ alertesInvOuvertes: 5 }));
  assert.ok(secteur.risques.some(r => r === '5 alertes inventaire ouvertes.'), `phrase inattendue: ${JSON.stringify(secteur.risques)}`);
});

testSync('construireSecteurOperations — alertesInvCritiquesOuvertes = 0 -> phrase IDENTIQUE (aucune sur-précision quand rien n\'est critique)', () => {
  const [secteur] = S.construireSecteurs([entreeOperations()], donneesOperations({ alertesInvOuvertes: 3, alertesInvCritiquesOuvertes: 0 }));
  assert.ok(secteur.risques.some(r => r === '3 alertes inventaire ouvertes.'));
});

testSync('construireSecteurOperations — alertesInvCritiquesOuvertes > 0 -> phrase enrichie, distingue critiques du total', () => {
  const [secteur] = S.construireSecteurs([entreeOperations()], donneesOperations({ alertesInvOuvertes: 5, alertesInvCritiquesOuvertes: 2 }));
  assert.ok(secteur.risques.some(r => r === '5 alertes inventaire ouvertes dont 2 critiques.'), `phrase inattendue: ${JSON.stringify(secteur.risques)}`);
});

testSync('construireSecteurOperations — une seule alerte critique -> accord singulier correct', () => {
  const [secteur] = S.construireSecteurs([entreeOperations()], donneesOperations({ alertesInvOuvertes: 1, alertesInvCritiquesOuvertes: 1 }));
  assert.ok(secteur.risques.some(r => r === '1 alerte inventaire ouverte dont 1 critique.'), `phrase inattendue: ${JSON.stringify(secteur.risques)}`);
});

testSync('construireSecteurOperations — aucune alerte inventaire du tout -> aucune phrase inventaire, comme avant', () => {
  const [secteur] = S.construireSecteurs([entreeOperations()], donneesOperations({ alertesInvOuvertes: 0, alertesInvCritiquesOuvertes: 0 }));
  assert.ok(!secteur.risques.some(r => r.includes('alerte inventaire')));
});

testSync('construireSecteurOperations — le statut/score ne dépendent JAMAIS des alertes inventaire (Article 5 : jamais mélangé à la Maîtrise caisse)', () => {
  const [sansInventaire] = S.construireSecteurs([entreeOperations()], donneesOperations({ alertesInvOuvertes: 0, alertesInvCritiquesOuvertes: 0 }));
  const [avecInventaireCritique] = S.construireSecteurs([entreeOperations()], donneesOperations({ alertesInvOuvertes: 20, alertesInvCritiquesOuvertes: 20 }));
  assert.strictEqual(sansInventaire.statut, avecInventaireCritique.statut, 'le statut métier ne doit jamais bouger à cause des alertes inventaire');
  assert.strictEqual(sansInventaire.valeur, avecInventaireCritique.valeur, 'la valeur/score ne doit jamais bouger à cause des alertes inventaire');
});

if (process.exitCode) { console.log('\nDes tests ont échoué.'); }
else { console.log('\nTous les tests sont passés.'); }
