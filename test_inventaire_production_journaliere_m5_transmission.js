// Test — Production journalière, M5 "Calcul pâtisserie + transmission
// Q1→Q2" (18/08/2026, cahier "Audit Inventaire - Production, mouvements &
// réceptions" §10/§11). M5 n'a nécessité aucun nouveau code : le calcul
// (nexus-inventaire-moteur.js::syntheseProductionJournee, déjà testé en
// v2.153) et la transmission Q1→Q2 (produitsZoneOuverturePourQuart, M2 —
// aucun écran Q2, le reste Q1 est simplement le dernier comptage 'cloture'
// lu par chargerDerniersStocks, mécanisme déjà existant) suffisaient. Ce
// test vérifie la partie qui n'était PAS encore couverte : que
// nexus-inventaire-production-donnees.js::chargerHistoriqueProductionProduit
// assemble correctement des lignes DB réalistes (quarts + mouvements +
// comptages) et produit exactement la même synthèse que l'exemple exact du
// cahier §10 déjà validé au niveau moteur pur.

const path = require('path');
const assert = require('assert');

global.window = global;
require(path.join(__dirname, 'nexus-inventaire-moteur.js'));
require(path.join(__dirname, 'nexus-inventaire-production-donnees.js'));
const D = global.NexusInventaireProductionDonnees;

// ------------------------------------------------------------
// Mock Supabase — chaînable et thenable, retourne les lignes pré-semées
// pour la table demandée quelle que soit la chaîne .eq/.in/.order (un seul
// produit/site/date dans ce test, pas besoin de vraiment filtrer).
// ------------------------------------------------------------
function creerClientMock(tables) {
  return {
    from(table) {
      const builder = {
        select() { return builder; },
        eq() { return builder; },
        in() { return builder; },
        order() { return builder; },
        then(resolve, reject) {
          Promise.resolve({ data: tables[table] || [], error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
}

async function main() {
  const site = 'vito-sainte-marie';
  const produitId = 'croissant1';
  const dateISO = '2026-08-19';

  const quartQ1 = { id: 'quartQ1', quart: 'matin', statut: 'cloture', cloture_le: '2026-08-19T13:00:00Z' };
  const quartQ2 = { id: 'quartQ2', quart: 'soir', statut: 'cloture', cloture_le: '2026-08-19T21:00:00Z' };

  // Reproduit exactement l'exemple du cahier §10 : prepInitiale=12,
  // fourneesQ1=[6], resteFinQ1=5, fourneesQ2=[4], resteFinal=2.
  const mouvements = [
    { id: 'm1', quart_id: 'quartQ1', produit_id: produitId, type_mouvement: 'production_initiale', quantite: 12, cree_le: '2026-08-19T06:00:00Z' },
    { id: 'm2', quart_id: 'quartQ1', produit_id: produitId, type_mouvement: 'production_additionnelle', quantite: 6, cree_le: '2026-08-19T10:00:00Z' },
    { id: 'm3', quart_id: 'quartQ2', produit_id: produitId, type_mouvement: 'production_additionnelle', quantite: 4, cree_le: '2026-08-19T18:00:00Z' },
  ];
  const comptages = [
    { id: 'c1', quart_id: 'quartQ1', produit_id: produitId, type_comptage: 'cloture', quantite: 5, statut: 'valide', created_at: '2026-08-19T13:00:00Z' },
    { id: 'c2', quart_id: 'quartQ2', produit_id: produitId, type_comptage: 'cloture', quantite: 2, statut: 'valide', created_at: '2026-08-19T21:00:00Z' },
  ];

  const client = creerClientMock({
    inventaire_quarts: [quartQ1, quartQ2],
    inventaire_mouvements: mouvements,
    inventaire_comptages: comptages,
  });

  const historique = await D.chargerHistoriqueProductionProduit(client, site, produitId, dateISO);

  assert.ok(historique, 'chargerHistoriqueProductionProduit doit renvoyer un résultat (pas null) avec des données mockées valides');
  assert.strictEqual(historique.prepInitialeMvt.quantite, 12, 'prepInitialeMvt doit être le mouvement production_initiale de Q1 (12)');
  assert.strictEqual(historique.fourneesQ1.length, 1, 'Une seule fournée en Q1 dans ce scénario');
  assert.strictEqual(historique.fourneesQ1[0].quantite, 6, 'Fournée Q1 = 6 (celle ajoutée via M3/M4 pendant le quart matin)');
  assert.strictEqual(historique.fourneesQ2.length, 1, 'Une seule fournée en Q2');
  assert.strictEqual(historique.fourneesQ2[0].quantite, 4, 'Fournée Q2 = 4');
  assert.strictEqual(historique.clotureQ1.quantite, 5, 'Reste physique compté à la clôture Q1 = 5 (écran clôture générique, inchangé)');
  assert.strictEqual(historique.clotureQ2.quantite, 2, 'Reste physique compté à la clôture Q2 = 2');
  console.log('OK — chargerHistoriqueProductionProduit assemble correctement prepInitiale/fourneesQ1/fourneesQ2/clotureQ1/clotureQ2 depuis des lignes DB réalistes.');

  // La synthèse doit être EXACTEMENT celle déjà validée au niveau moteur pur
  // (test_inventaire_production_journaliere_fondations.js, §10) — même
  // entrées, même sortie, aucune divergence entre le calcul testé isolément
  // et le calcul assemblé depuis de vraies lignes DB.
  const s = historique.synthese;
  assert.ok(s, 'La synthèse doit être calculée (moteur chargé)');
  assert.strictEqual(s.disponibleQ1, 18, '§10 — disponibleQ1 = 18 (12 + 6)');
  assert.strictEqual(s.ecoulementQ1, 13, '§10 — ecoulementQ1 = 13 (18 - 5)');
  assert.strictEqual(s.disponibleQ2, 9, '§10 — disponibleQ2 = 9 (reste Q1 transmis = 5, + fournée Q2 = 4)');
  assert.strictEqual(s.ecoulementQ2, 7, '§10 — ecoulementQ2 = 7 (9 - 2)');
  assert.strictEqual(s.productionTotale, 22, '§10 — productionTotale = 22 (12 + 6 + 4)');
  assert.strictEqual(s.ecoulementJournee, 20, '§10 — ecoulementJournee = 20 (22 - 2 - 0 retraits)');
  assert.strictEqual(s.nbFourneesSupplementaires, 2, '§10 — 2 fournées supplémentaires (1 en Q1, 1 en Q2)');
  console.log('OK — la synthèse assemblée depuis de vraies lignes DB reproduit EXACTEMENT l\'exemple du cahier §10 (transmission Q1→Q2 via le reste physique de clôture, sans écran Q2 dédié).');

  // ------------------------------------------------------------
  // Correction manager (M6 à venir, mais déjà couvert par construction) :
  // dernierComptageParType doit retenir la ligne la PLUS RÉCENTE en cas de
  // plusieurs comptages 'cloture' pour le même quart+produit (une
  // correction manager insère une nouvelle ligne sans jamais supprimer
  // l'originale — voir NEXUS-Inventaire-Manager-v1.html::appliquerCorrectionRetroactive).
  // ------------------------------------------------------------
  const comptagesAvecCorrection = [
    { id: 'c1', quart_id: 'quartQ1', produit_id: produitId, type_comptage: 'cloture', quantite: 5, statut: 'valide', created_at: '2026-08-19T13:00:00Z' },
    { id: 'c1b', quart_id: 'quartQ1', produit_id: produitId, type_comptage: 'cloture', quantite: 6, statut: 'valide', created_at: '2026-08-19T15:00:00Z' }, // correction manager plus tardive
    { id: 'c2', quart_id: 'quartQ2', produit_id: produitId, type_comptage: 'cloture', quantite: 2, statut: 'valide', created_at: '2026-08-19T21:00:00Z' },
  ];
  const clientCorrection = creerClientMock({
    inventaire_quarts: [quartQ1, quartQ2],
    inventaire_mouvements: mouvements,
    inventaire_comptages: comptagesAvecCorrection,
  });
  const historiqueCorrige = await D.chargerHistoriqueProductionProduit(clientCorrection, site, produitId, dateISO);
  assert.strictEqual(historiqueCorrige.clotureQ1.quantite, 6, 'Après correction manager, le reste Q1 retenu doit être la ligne la plus récente (6), jamais l\'originale (5)');
  assert.strictEqual(historiqueCorrige.synthese.disponibleQ2, 10, 'La synthèse doit se recalculer sur le reste Q1 corrigé (6 + fournée Q2 4 = 10), jamais sur une valeur périmée');
  console.log('OK — une correction manager (nouvelle ligne cloture plus récente) est bien reprise dans le calcul de transmission, jamais une valeur périmée.');

  console.log('\nTous les tests "Production journalière — M5 calcul + transmission" passent.');
}

main().catch(e => { console.error(e); process.exit(1); });
