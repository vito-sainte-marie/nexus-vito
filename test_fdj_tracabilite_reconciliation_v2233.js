// Test — Traçabilité des mouvements + réconciliation physique FDJ
// (24/08/2026, v2.233, demande de Frédéric : "Ajoute au module Stock FDJ
// une chaîne de traçabilité complète des mouvements et une fonction de
// réconciliation physique [...] pour comprendre en moins d'une minute ce
// qui s'est passé depuis ton dernier inventaire.")
//
// Constat établi avant d'écrire une ligne de code (voir l'en-tête de la
// nouvelle section de nexus-fdj-moteur.js, Article 11) : la chaîne de
// mouvements (fdj_stock_movements, type_mouvement parmi reception/
// transfert/activation/retour/blocage/correction) et le point de
// référence (fdj_stock_references + fdj_stock_reference_lignes,
// "Inventaire de référence FDJ" depuis le 09/08/2026) existaient déjà et
// satisfaisaient déjà la règle centrale de la demande ("ne jamais inventer
// rétroactivement un mouvement" — validerInventaireRef n'écrit jamais dans
// fdj_stock_movements). Ce test couvre donc STRICTEMENT ce qui a été
// ajouté par ce lot : `ecartsReferenceLignes` (avant/après/écarts,
// détermine si un motif est obligatoire), et la timeline unifiée
// `construireHistoriqueFdj` qui alimente le nouvel écran "Historique des
// mouvements".

const path = require('path');
require(path.join(__dirname, 'nexus-fdj-moteur.js'));
const M = global.NexusFdjMoteur;
const assert = require('assert');

if (!M) throw new Error('NexusFdjMoteur ne s\'est pas attaché à global — vérifier le require.');

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

// ------------------------------------------------------------
// 1) ecartsReferenceLignes — aucun écart (recomptage de routine confirme
//    exactement le théorique) -> aUnEcart false, motif non obligatoire.
// ------------------------------------------------------------
{
  const lignes = [
    { game_id: 'g1', bureau_reel: 5, caisse_reel: 2, stock_theorique_bureau_avant: 5, stock_theorique_caisse_avant: 2 },
    { game_id: 'g2', bureau_reel: 0, caisse_reel: 0, stock_theorique_bureau_avant: 0, stock_theorique_caisse_avant: 0 },
  ];
  const r = M.ecartsReferenceLignes(lignes);
  assert.strictEqual(r.aUnEcart, false, 'comptage conforme au théorique sur tous les jeux -> aucun écart');
  assert.deepStrictEqual(r.parJeu.g1, { ecartBureau: 0, ecartCaisse: 0, theoBureau: 5, theoCaisse: 2, bureauReel: 5, caisseReel: 2 });
  ok('ecartsReferenceLignes — recomptage conforme, aUnEcart=false (motif non exigé)');
}

// ------------------------------------------------------------
// 2) ecartsReferenceLignes — un écart réel détecté (stock physique ne
//    correspond plus au stock calculé) -> aUnEcart true, écarts signés
//    correctement (positif = surplus, négatif = manque).
// ------------------------------------------------------------
{
  const lignes = [
    { game_id: 'g1', bureau_reel: 3, caisse_reel: 1, stock_theorique_bureau_avant: 5, stock_theorique_caisse_avant: 2 }, // manque 2 au bureau, 1 en caisse
    { game_id: 'g2', bureau_reel: 6, caisse_reel: 0, stock_theorique_bureau_avant: 4, stock_theorique_caisse_avant: 0 }, // surplus de 2 au bureau
  ];
  const r = M.ecartsReferenceLignes(lignes);
  assert.strictEqual(r.aUnEcart, true, 'au moins un jeu diverge du théorique -> écart détecté, motif exigé côté écran');
  assert.strictEqual(r.parJeu.g1.ecartBureau, -2);
  assert.strictEqual(r.parJeu.g1.ecartCaisse, -1);
  assert.strictEqual(r.parJeu.g2.ecartBureau, 2);
  assert.strictEqual(r.parJeu.g2.ecartCaisse, 0);
  ok('ecartsReferenceLignes — écart réel détecté, signé correctement (manque négatif, surplus positif)');
}

// ------------------------------------------------------------
// 3) ecartsReferenceLignes — valeurs théoriques absentes (null/undefined,
//    ex. tout premier contrôle du site, "initialisation") -> traitées comme
//    0, jamais une exception.
// ------------------------------------------------------------
{
  const lignes = [{ game_id: 'g1', bureau_reel: 10, caisse_reel: 0, stock_theorique_bureau_avant: null, stock_theorique_caisse_avant: undefined }];
  const r = M.ecartsReferenceLignes(lignes);
  assert.strictEqual(r.aUnEcart, true, 'le tout premier contrôle (aucun théorique connu) génère mécaniquement un "écart" contre 0 -- attendu, ce sont les 10 premiers carnets jamais comptés');
  assert.strictEqual(r.parJeu.g1.theoBureau, 0);
  ok('ecartsReferenceLignes — théorique manquant traité comme 0, jamais une exception (cas "initialisation")');
}

// ------------------------------------------------------------
// 4) construireHistoriqueFdj — timeline unifiée mouvements + réconciliation,
//    triée du plus récent au plus ancien, labels/trajets humains.
// ------------------------------------------------------------
{
  const ctx = {
    jeuxParId: { g1: { nom: 'BANCO 1€' } },
    locationsParId: { l1: { nom: 'Bureau', type: 'bureau' }, l2: { nom: 'Caisse', type: 'caisse' } },
    employesParId: { e1: { nom: 'Loanne' } },
  };
  const mouvements = [
    { type_mouvement: 'reception', quantite: 10, game_id: 'g1', location_destination_id: 'l1', created_at: '2026-08-20T09:00:00Z', employee_id: null, justification: 'BL 123' },
    { type_mouvement: 'transfert', quantite: 3, game_id: 'g1', location_source_id: 'l1', location_destination_id: 'l2', created_at: '2026-08-21T10:00:00Z', employee_id: null, justification: null },
    { type_mouvement: 'activation', quantite: 1, game_id: 'g1', location_source_id: 'l2', created_at: '2026-08-22T08:00:00Z', employee_id: 'e1', justification: null },
  ];
  const references = [{ id: 'r1', created_at: '2026-08-23T18:00:00Z', type: 'reconciliation', controle_par: 'e1', motif: 'Écart constaté au comptage', reference_precedente_id: null }];
  const lignesParReference = { r1: [{ game_id: 'g1', bureau_reel: 5, caisse_reel: 1, stock_theorique_bureau_avant: 7, stock_theorique_caisse_avant: 2 }] };

  const timeline = M.construireHistoriqueFdj(mouvements, references, lignesParReference, ctx);
  assert.strictEqual(timeline.length, 4, '3 mouvements + 1 réconciliation = 4 entrées');
  assert.strictEqual(timeline[0].categorie, 'reconciliation', 'tri du plus récent au plus ancien -> la réconciliation (23/08) en tête');
  assert.strictEqual(timeline[0].motif, 'Écart constaté au comptage');
  assert.strictEqual(timeline[0].aUnEcart, true);
  assert.strictEqual(timeline[0].ecarts[0].jeuNom, 'BANCO 1€');
  assert.strictEqual(timeline[1].categorie, 'mouvement');
  assert.strictEqual(timeline[1].typeMouvement, 'activation');
  assert.strictEqual(timeline[1].typeLabel, 'Activation');
  assert.strictEqual(timeline[1].auteurNom, 'Loanne', 'employee_id résolu via employesParId');
  assert.strictEqual(timeline[2].trajet, 'Bureau → Caisse', 'trajet lisible construit depuis locationsParId, jamais des ids bruts');
  assert.strictEqual(timeline[3].typeLabel, 'Réception');
  assert.strictEqual(timeline[3].justification, 'BL 123');
  assert.strictEqual(timeline[3].auteurNom, 'Manager', 'aucun employee_id -> mouvement posé côté manager');
  ok('construireHistoriqueFdj — timeline unifiée, triée, labels et trajets humains, auteur résolu ou "Manager" par défaut');
}

// ------------------------------------------------------------
// 5) construireHistoriqueFdj — réconciliation SANS écart (recomptage
//    conforme) apparaît quand même dans la timeline, avec aUnEcart=false
//    et aucune ligne d'écart — la traçabilité couvre aussi les contrôles
//    qui ne révèlent rien d'anormal, pas seulement les écarts.
// ------------------------------------------------------------
{
  const ctx = { jeuxParId: { g1: { nom: 'X10 2€' } }, locationsParId: {}, employesParId: {} };
  const references = [{ id: 'r2', created_at: '2026-08-24T08:00:00Z', type: 'recomptage', controle_par: null, motif: null, reference_precedente_id: 'r1' }];
  const lignesParReference = { r2: [{ game_id: 'g1', bureau_reel: 4, caisse_reel: 0, stock_theorique_bureau_avant: 4, stock_theorique_caisse_avant: 0 }] };
  const timeline = M.construireHistoriqueFdj([], references, lignesParReference, ctx);
  assert.strictEqual(timeline.length, 1);
  assert.strictEqual(timeline[0].aUnEcart, false);
  assert.strictEqual(timeline[0].nbEcarts, 0);
  assert.strictEqual(timeline[0].nbJeuxControles, 1);
  assert.strictEqual(timeline[0].referencePrecedenteId, 'r1', 'référence précédente explicitement portée, jamais déduite du tri par date');
  assert.strictEqual(timeline[0].auteurNom, '—', 'controle_par absent -> jamais un nom inventé');
  ok('construireHistoriqueFdj — recomptage conforme visible dans la timeline (pas seulement les écarts), référence précédente explicite');
}

// ------------------------------------------------------------
// 6) trajetMouvement — cas limites (localisation inconnue, retour depuis
//    un blocage) jamais un "undefined" affiché.
// ------------------------------------------------------------
{
  const locations = { l1: { nom: 'Bloqué', type: 'bloque' }, l2: { nom: 'Bureau', type: 'bureau' } };
  assert.strictEqual(M.trajetMouvement({ type_mouvement: 'retour', location_source_id: 'l1', location_destination_id: 'l2' }, locations), 'Bloqué → Bureau');
  assert.strictEqual(M.trajetMouvement({ type_mouvement: 'transfert', location_source_id: 'inconnu', location_destination_id: 'l2' }, locations), '→ Bureau', 'source inconnue -> jamais "undefined", juste omise proprement');
  assert.strictEqual(M.trajetMouvement({ type_mouvement: 'transfert' }, {}), '—', 'aucune localisation résolvable -> tiret explicite, jamais une chaîne cassée');
  ok('trajetMouvement — cas limites gérés proprement, jamais de valeur "undefined" affichée à l\'écran');
}

console.log(`\n${n}/${n} tests passés — Traçabilité des mouvements + réconciliation physique FDJ (v2.233).`);
