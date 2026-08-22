// Test — Fallback temporel "dernier état fiable" pour le secteur Carburants
// (22/08/2026, demande de Frédéric, voir NEXUS-Data-Dictionary-v2.md
// v2.214/v2.215). Capture de départ : le 21/08 au soir, "🔴 Carburants —
// 0/100 · À corriger" alors que le recul venait pour moitié d'un vrai recul
// de volume et pour l'autre moitié d'une absence de donnée FRAÎCHE (Q2 pas
// remonté, jaugeage d'ouverture du lendemain pas encore saisi), traitée
// avec la même pénalité maximale qu'un écart réellement constaté.
//
// Fonctions pures du moteur (nexus-carburant-moteur.js) + intégration dans
// le constructeur de secteur partagé (nexus-secteurs-moteur.js) — jamais
// réécrites ici, require() direct, même convention que tous les autres
// tests moteur du projet.

const assert = require('assert');

require(__dirname + '/nexus-boussole-moteur.js');
require(__dirname + '/nexus-carburant-moteur.js');
require(__dirname + '/nexus-secteurs-moteur.js');
const M = global.NexusCarburantMoteur;
const S = global.NexusSecteursMoteur;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

// ------------------------------------------------------------
// 1) jourCarburantEstComplet — un jour est complet dès que son contrôle
//    physique a produit un résultat interprétable, bon ou mauvais.
// ------------------------------------------------------------
(() => {
  assert.strictEqual(M.jourCarburantEstComplet(null, true), false, 'Aucun relevé -> jamais complet');
  assert.strictEqual(M.jourCarburantEstComplet({ go: { statut: 'Données insuffisantes' }, sp95: { statut: 'Données insuffisantes' }, gnr: { statut: 'Données insuffisantes' } }, false), false, 'Les 3 carburants en "Données insuffisantes" -> pas complet');
  assert.strictEqual(M.jourCarburantEstComplet({ go: { statut: 'Sous contrôle' }, sp95: { statut: 'Sous contrôle' }, gnr: { statut: 'Sous contrôle' } }, false), true, '3 carburants sous contrôle -> complet');
  assert.strictEqual(M.jourCarburantEstComplet({ go: { statut: 'À corriger' }, sp95: { statut: 'Sous contrôle' }, gnr: { statut: 'Sous contrôle' } }, false), true, 'Un vrai écart détecté reste un jour COMPLET (mesuré), pas "en construction"');
  assert.strictEqual(M.jourCarburantEstComplet({ go: { statut: 'Référence certifiée' }, sp95: { statut: 'Référence certifiée' }, gnr: { statut: 'Référence certifiée' } }, false), true, 'Référence certifiée -> complet (statut sain, jamais confondu avec une absence de donnée)');
  ok('jourCarburantEstComplet distingue "en construction" (Données insuffisantes) de tout résultat réellement mesuré');
})();

// ------------------------------------------------------------
// 2) trouverJourFiableAnterieur — remonte un historique déjà trié du plus
//    récent au plus ancien (forme exacte de chargerHistoriqueReleves).
// ------------------------------------------------------------
(() => {
  const sousControle = { go: { statut: 'Sous contrôle' }, sp95: { statut: 'Sous contrôle' }, gnr: { statut: 'Sous contrôle' } };
  const insuffisant = { go: { statut: 'Données insuffisantes' }, sp95: { statut: 'Données insuffisantes' }, gnr: { statut: 'Données insuffisantes' } };

  const r1 = M.trouverJourFiableAnterieur([{ date: '2026-08-21', parCarburant: sousControle }], '2026-08-22');
  assert.deepStrictEqual(r1, { trouve: true, date: '2026-08-21', joursEcoules: 1 }, 'J-1 fiable -> trouvé, 1 jour écoulé (scénario exact de Frédéric)');
  ok('trouverJourFiableAnterieur trouve J-1 quand il est fiable, joursEcoules=1');

  const r2 = M.trouverJourFiableAnterieur([{ date: '2026-08-21', parCarburant: insuffisant }, { date: '2026-08-20', parCarburant: sousControle }], '2026-08-22');
  assert.deepStrictEqual(r2, { trouve: true, date: '2026-08-20', joursEcoules: 2 }, 'J-1 lui-même insuffisant -> remonte à J-2');
  ok('trouverJourFiableAnterieur remonte au-delà de J-1 si J-1 est lui aussi incomplet');

  const r3 = M.trouverJourFiableAnterieur([{ date: '2026-08-21', parCarburant: insuffisant }], '2026-08-22');
  assert.deepStrictEqual(r3, { trouve: false }, 'Aucun jour fiable dans la fenêtre -> honnêtement "non trouvé", jamais un repli inventé');
  ok('trouverJourFiableAnterieur renvoie trouve:false si rien de fiable dans la fenêtre (Article 5)');

  assert.deepStrictEqual(M.trouverJourFiableAnterieur([], '2026-08-22'), { trouve: false }, 'Historique vide -> non trouvé');
  ok('trouverJourFiableAnterieur gère un historique vide sans planter');
})();

// ------------------------------------------------------------
// 3) fraicheurCarburant — décide 'jour' / 'fallback' / 'perime' /
//    'jour_incomplet_sans_repli', avec le seuil de péremption de Frédéric.
// ------------------------------------------------------------
(() => {
  assert.deepStrictEqual(M.fraicheurCarburant({ completAujourdhui: true, fallback: null }), { mode: 'jour' }, 'Aujourd\'hui complet -> mode jour, jamais de repli inutile');
  ok('fraicheurCarburant : aujourd\'hui complet -> mode "jour"');

  const f1 = M.fraicheurCarburant({ completAujourdhui: false, fallback: { trouve: true, date: '2026-08-21', joursEcoules: 1 } });
  assert.deepStrictEqual(f1, { mode: 'fallback', dateReference: '2026-08-21', joursEcoules: 1 }, '1 jour écoulé (24h) < 48h -> fallback affichable');
  ok('fraicheurCarburant : J-1 (24h) < seuil de péremption -> mode "fallback"');

  const f2 = M.fraicheurCarburant({ completAujourdhui: false, fallback: { trouve: true, date: '2026-08-19', joursEcoules: 3 } });
  assert.deepStrictEqual(f2, { mode: 'perime', dateReference: '2026-08-19', joursEcoules: 3 }, '3 jours (72h) > 48h -> périmé');
  ok('fraicheurCarburant : 3 jours (72h) > seuil de péremption (48h, borne haute de Frédéric) -> mode "perime"');

  // Borne exacte : 48h pile ne doit PAS être périmée ("au-delà de ce
  // seuil" -> strictement supérieur, jamais une borne ambiguë).
  const f3 = M.fraicheurCarburant({ completAujourdhui: false, fallback: { trouve: true, date: '2026-08-20', joursEcoules: 2 } });
  assert.strictEqual(f3.mode, 'fallback', '48h pile (2 jours) reste dans la fenêtre -> pas encore périmé');
  ok('fraicheurCarburant : la borne de péremption (48h) est exclusive, pas inclusive');

  assert.deepStrictEqual(M.fraicheurCarburant({ completAujourdhui: false, fallback: { trouve: false } }), { mode: 'jour_incomplet_sans_repli' }, 'Aucun repli trouvé -> reste honnête, jamais un repli fabriqué');
  ok('fraicheurCarburant : aucun jour fiable trouvé -> mode "jour_incomplet_sans_repli"');
})();

// ------------------------------------------------------------
// 4) libelleBadgeFraicheur — jamais de badge en mode normal, un texte
//    explicite et distinct dans les 3 autres cas.
// ------------------------------------------------------------
(() => {
  assert.strictEqual(M.libelleBadgeFraicheur({ mode: 'jour' }), null, 'Mode jour -> aucun badge (rien à signaler)');
  assert.strictEqual(M.libelleBadgeFraicheur(null), null, 'Fraîcheur absente -> aucun badge (non-régression pour un appelant non migré)');
  assert.strictEqual(M.libelleBadgeFraicheur({ mode: 'fallback', dateReference: '2026-08-21', joursEcoules: 1 }), 'Dernier état fiable J-1', 'Exactement la formulation demandée par Frédéric pour J-1');
  assert.strictEqual(M.libelleBadgeFraicheur({ mode: 'fallback', dateReference: '2026-08-19', joursEcoules: 3 }), 'Dernier état fiable — données complètes arrêtées au 19/08/2026');
  assert.ok(M.libelleBadgeFraicheur({ mode: 'perime', dateReference: '2026-08-18', joursEcoules: 4 }).startsWith('À actualiser'), 'Mode périmé -> badge "À actualiser" explicite');
  ok('libelleBadgeFraicheur produit un texte distinct et honnête pour chaque mode');
})();

// ------------------------------------------------------------
// 5) construireBlocEnCours — "Aujourd'hui — en cours", jamais fondu dans le
//    score figé.
// ------------------------------------------------------------
(() => {
  const lignes = M.construireBlocEnCours({ nbQuartsAvecLitrage: 1, nbQuartsTotal: 2, releveDuJourExiste: false });
  assert.deepStrictEqual(lignes, [
    'Ventes du jour : 1/2 quarts avec litrage renseigné.',
    'Jaugeage du jour en attente.',
    "Aucun nouvel écart physique calculé pour l'instant.",
  ]);
  ok('construireBlocEnCours décrit honnêtement ce qui est déjà connu du jour en construction');

  const lignesRien = M.construireBlocEnCours({ nbQuartsAvecLitrage: 0, nbQuartsTotal: 0, releveDuJourExiste: false });
  assert.strictEqual(lignesRien[0], "Aucun quart clôturé pour l'instant aujourd'hui.");
  ok('construireBlocEnCours : aucun quart clôturé -> phrase honnête plutôt que "0/0"');
})();

// ------------------------------------------------------------
// 6) Intégration — construireSecteurCarburants avec les 3 modes.
// ------------------------------------------------------------
(() => {
  const entree = { id: 'carburants', label: 'Carburants', icone: '⛽', cible: 'NEXUS-Carburants-Pilotage-v1.html' };

  // Mode 'jour' implicite (aucune fraîcheur transmise) — comportement
  // strictement inchangé pour tout appelant qui n'aurait pas encore migré
  // vers chargerCarburantsBriefAvecFallback (non-régression).
  const carburantsSansFraicheur = {
    controle: { aucunReleve: false, parCarburant: { go: { statut: 'Sous contrôle', ecart: 5 }, sp95: { statut: 'Sous contrôle', ecart: 2 }, gnr: { statut: 'Sous contrôle', ecart: 0 } } },
    evolution: 0.02,
  };
  const secteurSansFraicheur = S.construireSecteurs([entree], { carburants: carburantsSansFraicheur })[0];
  assert.strictEqual(secteurSansFraicheur.fraicheur.mode, 'jour', 'Sans champ fraicheur transmis -> mode "jour" par défaut (non-régression)');
  assert.strictEqual(secteurSansFraicheur.enCours, null, 'Mode jour -> jamais de bloc "en cours" affiché');
  ok('construireSecteurCarburants : rétrocompatible avec un appelant qui ne transmet pas fraicheur');

  // Mode 'fallback' — reproduit EXACTEMENT le scénario de Frédéric : le
  // score affiché est celui du jour de repli (recalculé avec les mêmes
  // fonctions), jamais un mélange avec les données du jour.
  const carburantsFallback = {
    controle: { aucunReleve: false, parCarburant: { go: { statut: 'Sous contrôle', ecart: 5 }, sp95: { statut: 'Sous contrôle', ecart: 2 }, gnr: { statut: 'Sous contrôle', ecart: 0 } } },
    evolution: 0.04, // performance neutre/légèrement positive ce jour-là
    fraicheur: { mode: 'fallback', dateReference: '2026-08-21', joursEcoules: 1 },
    enCours: ['Ventes du jour : 1/2 quarts avec litrage renseigné.', 'Jaugeage du jour en attente.', "Aucun nouvel écart physique calculé pour l'instant."],
  };
  const secteurFallback = S.construireSecteurs([entree], { carburants: carburantsFallback })[0];
  assert.strictEqual(secteurFallback.confiance, 'RÉEL', 'Un état figé mais fiable reste confiance RÉEL — il compte dans l\'Indice Boussole');
  assert.strictEqual(secteurFallback.statut, 'Sous contrôle', 'Le statut affiché est celui du jour de repli, jamais "À corriger" fabriqué par des données du jour incomplètes');
  assert.ok(secteurFallback.valeur >= 70, 'Score du jour de repli correctement recalculé (>= 70, seuil "Sous contrôle")');
  assert.strictEqual(secteurFallback.frein, null, 'Sous contrôle -> aucun frein affiché (plus de faux "Écart carburant à traiter")');
  assert.deepStrictEqual(secteurFallback.fraicheur, { mode: 'fallback', dateReference: '2026-08-21', joursEcoules: 1 });
  assert.strictEqual(secteurFallback.enCours.length, 3, 'Le bloc "Aujourd\'hui — en cours" est bien transmis à l\'écran en mode fallback');
  ok('construireSecteurCarburants : mode fallback -> affiche le score figé du dernier jour fiable, jamais un mélange J-1/J');

  // Mode 'perime' — le score ne doit plus être présenté comme courant.
  const carburantsPerime = {
    controle: { aucunReleve: false, parCarburant: { go: { statut: 'Données insuffisantes' }, sp95: { statut: 'Données insuffisantes' }, gnr: { statut: 'Données insuffisantes' } } },
    evolution: null,
    fraicheur: { mode: 'perime', dateReference: '2026-08-18', joursEcoules: 4 },
    enCours: ['Aucun quart clôturé pour l\'instant aujourd\'hui.', 'Jaugeage du jour en attente.', "Aucun nouvel écart physique calculé pour l'instant."],
  };
  const secteurPerime = S.construireSecteurs([entree], { carburants: carburantsPerime })[0];
  assert.strictEqual(secteurPerime.statut, 'À actualiser', 'Score trop vieux pour être présenté comme courant -> statut dédié "À actualiser"');
  assert.strictEqual(secteurPerime.valeur, null, 'Aucun score chiffré affiché en mode périmé (jamais un chiffre de 4 jours présenté comme frais)');
  assert.strictEqual(secteurPerime.confiance, 'INSUFFISANT', 'Exclu de l\'Indice Boussole (même invariant que secteurVide : confiance RÉEL <=> valeur non nulle)');
  assert.ok(secteurPerime.detail.includes('18/08/2026'), 'Le detail nomme explicitement la date du dernier état connu');
  ok('construireSecteurCarburants : mode perime -> statut "À actualiser", aucun score chiffré, exclu de la moyenne');

  // Aucune donnée du tout -> comportement historique inchangé (secteurVide).
  const secteurVideRes = S.construireSecteurs([entree], { carburants: null })[0];
  assert.strictEqual(secteurVideRes.statut, 'Données insuffisantes');
  ok('construireSecteurCarburants(entree, null) -> secteurVide inchangé (non-régression totale)');
})();

console.log(`\n${n}/${n} tests passés — fallback temporel "dernier état fiable" Carburants.`);
