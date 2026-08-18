// Test — Cahier "Vocabulaire & intégration du prix d'achat" (17/08/2026),
// §5/§6/§9. Fonctions pures du moteur de résolution des tarifs d'achat
// (nexus-carburant-moteur.js) — jamais réécrites ici, require() direct,
// même convention que test_carburant_economie_moteur.js.
//
// Chemin relatif à __dirname (convention établie depuis la sécurisation
// structurelle du 16/08/2026).

const assert = require('assert');

require(__dirname + '/nexus-carburant-moteur.js');
const M = global.NexusCarburantMoteur;

// ------------------------------------------------------------
// resoudreTarifActifParmi — §5 "Règle d'application à chaque livraison" :
// le plus récent date_effet <= date cible. Même règle que le trigger
// serveur carburant_resoudre_prix_achat_snapshot (Article 11 : une seule
// règle, deux implémentations nécessaires seulement parce que l'une
// tourne en SQL et l'autre en JS).
// ------------------------------------------------------------
(() => {
  // Critère de recette #6 (implicite) / §5.6 : aucun tarif -> aucune
  // résolution fabriquée, jamais un tarif "par défaut".
  assert.strictEqual(M.resoudreTarifActifParmi([], '2026-08-17'), null, 'Aucun tarif -> null, jamais un tarif fabriqué');
  assert.strictEqual(M.resoudreTarifActifParmi(null, '2026-08-17'), null, 'tarifs=null -> traité comme liste vide, jamais une exception');

  // Critère de recette #1 : un tarif saisi pour août (date_effet
  // 01/08/2026) est automatiquement proposé à une réception du 17/08.
  const tarifsAout = [{ id: 'aout', date_effet: '2026-08-01', prix_achat_par_litre: 1.42, source_type: 'saisie_manager' }];
  const actif17 = M.resoudreTarifActifParmi(tarifsAout, '2026-08-17');
  assert.strictEqual(actif17.id, 'aout', 'Critère #1 : tarif du 01/08 actif pour une réception du 17/08');

  // Critère de recette #2 : une réception du 31/08 conserve le tarif
  // d'août après création du tarif de septembre (la RÉSOLUTION seule ici
  // — le figement définitif est fait par le trigger serveur au moment de
  // l'insertion, jamais recalculé ensuite ; ce test vérifie que la
  // fonction de résolution elle-même choisit bien le tarif le plus
  // récent <= à la date cible, pas le plus récent tout court).
  const tarifsAoutSeptembre = [
    { id: 'aout', date_effet: '2026-08-01', prix_achat_par_litre: 1.42, source_type: 'saisie_manager' },
    { id: 'septembre', date_effet: '2026-09-01', prix_achat_par_litre: 1.48, source_type: 'saisie_manager' },
  ];
  const actif31Aout = M.resoudreTarifActifParmi(tarifsAoutSeptembre, '2026-08-31');
  assert.strictEqual(actif31Aout.id, 'aout', 'Critère #2 : résolution au 31/08 pointe encore sur le tarif d\'août, jamais septembre');
  const actif01Sept = M.resoudreTarifActifParmi(tarifsAoutSeptembre, '2026-09-01');
  assert.strictEqual(actif01Sept.id, 'septembre', 'À partir du 01/09, la résolution bascule sur le nouveau tarif');

  // Plusieurs tarifs avec date_effet <= cible -> le plus récent gagne,
  // jamais le premier trouvé dans le tableau (ordre d'entrée quelconque).
  const dansLeDesordre = [
    { id: 'juillet', date_effet: '2026-07-01', prix_achat_par_litre: 1.30 },
    { id: 'aout', date_effet: '2026-08-01', prix_achat_par_litre: 1.42 },
    { id: 'juin', date_effet: '2026-06-01', prix_achat_par_litre: 1.20 },
  ];
  assert.strictEqual(M.resoudreTarifActifParmi(dansLeDesordre, '2026-08-20').id, 'aout', 'Le tarif le plus récent avec date_effet <= cible gagne, peu importe l\'ordre du tableau');

  // Tarif futur (date_effet > cible) -> jamais résolu par anticipation.
  const avecFutur = [
    { id: 'aout', date_effet: '2026-08-01', prix_achat_par_litre: 1.42 },
    { id: 'octobre', date_effet: '2026-10-01', prix_achat_par_litre: 1.55 },
  ];
  assert.strictEqual(M.resoudreTarifActifParmi(avecFutur, '2026-08-17').id, 'aout', 'Un tarif futur n\'est jamais résolu par anticipation');

  console.log('OK — resoudreTarifActifParmi : critères de recette #1 et #2 (tarif du mois proposé, jamais recalculé après un nouveau tarif), plus récent date_effet <= cible, jamais de résolution anticipée.');
})();

// ------------------------------------------------------------
// libelleTarifActif — §8 "UX recommandée" : phrase exacte de l'exemple
// UI du cahier, jamais un montant fabriqué en l'absence de tarif.
// ------------------------------------------------------------
(() => {
  assert.ok(
    M.libelleTarifActif(null).includes('Aucun tarif'),
    'Aucun tarif actif -> phrase neutre, jamais un prix fabriqué (critère de recette #3/#7)'
  );
  const txt = M.libelleTarifActif({ prix_achat_par_litre: 1.42, date_effet: '2026-08-01', source_type: 'saisie_manager' });
  assert.ok(txt.includes('1.420') && txt.includes('01/08/2026') && txt.includes('saisie manager'), 'Tarif actif -> prix, date d\'effet et source, comme l\'exemple UI du cahier §8');

  console.log('OK — libelleTarifActif : phrase neutre sans tarif, phrase sourcée (prix/date/source) sinon.');
})();

// ------------------------------------------------------------
// libelleSourcePrixLigne — provenance du prix appliqué à UNE ligne de
// réception, formulation unique pour Économie ET la modale "Relevé de
// réception" (Article 11).
// ------------------------------------------------------------
(() => {
  assert.strictEqual(M.libelleSourcePrixLigne(null), null, 'Ligne absente -> null');
  assert.strictEqual(M.libelleSourcePrixLigne({ cout_achat_par_litre: null }), null, 'Aucun coût connu -> null, jamais une provenance fabriquée');

  // Snapshot automatique (trigger serveur) -> "Tarif d'achat actif du mois".
  const auto = M.libelleSourcePrixLigne({ cout_achat_par_litre: 1.42, prix_achat_source_id: 'abc', prix_achat_override: false, cout_saisi_par: 'Tarif actif (auto)' });
  assert.ok(auto.includes('Tarif d\'achat actif du mois'), 'Snapshot automatique -> "Tarif d\'achat actif du mois"');

  // Override manager -> critère de recette #4 : motif visible, jamais
  // confondu avec une résolution automatique.
  const override = M.libelleSourcePrixLigne({ cout_achat_par_litre: 1.55, prix_achat_override: true, prix_achat_override_motif: 'avoir_rectification', cout_saisi_par: 'Jean' });
  assert.ok(override.includes('Prix spécifique à cette livraison'), 'Override -> "Prix spécifique à cette livraison"');
  assert.ok(override.includes('Avoir / rectification fournisseur'), 'Override -> motif en clair (liste fermée MOTIFS_OVERRIDE_PRIX_ACHAT)');
  assert.ok(override.includes('Jean'), 'Override -> auteur visible (audit)');

  // Motif inconnu (ne devrait pas arriver mais jamais une exception) ->
  // repli sur le code brut plutôt qu'un texte fabriqué.
  const overrideMotifInconnu = M.libelleSourcePrixLigne({ cout_achat_par_litre: 1.55, prix_achat_override: true, prix_achat_override_motif: 'motif_x', cout_saisi_par: null });
  assert.ok(overrideMotifInconnu.includes('motif_x'), 'Motif hors liste fermée -> repli sur le code brut, jamais une exception');

  // Ligne posée avant l'existence des tarifs (Sprint C8, saisie manuelle
  // a posteriori) -> jamais confondue avec une résolution automatique.
  const manuelle = M.libelleSourcePrixLigne({ cout_achat_par_litre: 1.38, prix_achat_source_id: null, prix_achat_override: false, cout_saisi_par: 'Marie' });
  assert.ok(manuelle.includes('Saisie manuelle'), 'Ni tarif résolu ni override -> "Saisie manuelle" (ligne antérieure à l\'existence des tarifs)');

  console.log('OK — libelleSourcePrixLigne : une seule fonction de mise en phrase pour Économie ET la modale réception (Article 11), motif d\'override toujours visible (critère de recette #4).');
})();

// ------------------------------------------------------------
// MOTIFS_OVERRIDE_PRIX_ACHAT — §6 : liste fermée des 4 motifs, jamais un
// texte libre seul.
// ------------------------------------------------------------
(() => {
  assert.strictEqual(M.MOTIFS_OVERRIDE_PRIX_ACHAT.length, 4, 'Exactement 4 motifs, comme le cahier §6');
  const cles = M.MOTIFS_OVERRIDE_PRIX_ACHAT.map(m => m.cle);
  assert.deepStrictEqual(cles, ['facture_differente', 'avoir_rectification', 'changement_exceptionnel', 'autre'], 'Motifs exacts du cahier §6');

  console.log('OK — MOTIFS_OVERRIDE_PRIX_ACHAT : liste fermée des 4 motifs du cahier §6.');
})();

console.log('\nTous les tests "Carburants — Vocabulaire & intégration du prix d\'achat" (résolution tarif, libellés, motifs override) passent.');
