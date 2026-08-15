// Test — FDJ, refonte lecture managériale de "État du stock" (14/08/2026)
//
// Vérifie les nouvelles fonctions pures ajoutées à nexus-fdj-moteur.js :
// filtrage du rapprochement par point zéro, rotation/autonomie, tickets
// restants du carnet en cours, classification etatLigneStockV2 (les 3
// exemples donnés par Frédéric : CASH 5€ / X10 2€ / BANCO 1€), phrase de
// synthèse par palier, synthèse globale + recommandation.
//
// Fonctions pures (aucune dépendance Supabase/DOM) — require() direct du
// fichier réel, qui s'attache à globalThis (voir la dernière ligne du
// fichier : `(typeof window !== 'undefined' ? window : globalThis)`), pas
// besoin de vm ni de mock DOM ici.

const path = require('path');
require(path.join('/sessions/dazzling-compassionate-ride/mnt/image nexus project', 'nexus-fdj-moteur.js'));
const M = global.NexusFdjMoteur;
const assert = require('assert');

if (!M) throw new Error('NexusFdjMoteur ne s\'est pas attaché à global — vérifier le require.');

// ------------------------------------------------------------
// 1) lignesApproNonTracees / approNonTraceParJeu — filtrage point zéro
// ------------------------------------------------------------
{
  const shiftCounts = [
    { shift_id: 's1', game_id: 'cash5', appro: 2, created_at: '2026-08-01T10:00:00Z' }, // avant le point zéro
    { shift_id: 's2', game_id: 'cash5', appro: 1, created_at: '2026-08-14T10:00:00Z' }, // après
  ];
  const mouvements = []; // aucune activation ne couvre ni l'une ni l'autre
  const referenceCreeLe = '2026-08-13T00:00:00Z';

  const sansFiltre = M.approNonTraceParJeu(shiftCounts, mouvements);
  assert.strictEqual(sansFiltre.cash5, 3, 'Sans référence : les 2 lignes comptent (comportement inchangé)');

  const avecFiltre = M.approNonTraceParJeu(shiftCounts, mouvements, referenceCreeLe);
  assert.strictEqual(avecFiltre.cash5, 1, 'Avec référence : seule la ligne postérieure au point zéro compte');

  const lignes = M.lignesApproNonTracees(shiftCounts, mouvements, referenceCreeLe);
  assert.strictEqual(lignes.length, 1);
  assert.strictEqual(lignes[0].shift_id, 's2');
}
console.log('✓ 1. lignesApproNonTracees/approNonTraceParJeu — filtrage point zéro');

// ------------------------------------------------------------
// 2) rotationCarnetsJeu — moyenne bornée par le point zéro, jamais diluée
// ------------------------------------------------------------
{
  const maintenant = new Date('2026-08-14T20:00:00Z');
  const mouvements = [
    { type_mouvement: 'activation', game_id: 'x10', quantite: 1, created_at: '2026-08-12T09:00:00Z' }, // avant le point zéro : exclu
    { type_mouvement: 'activation', game_id: 'x10', quantite: 1, created_at: '2026-08-13T09:00:00Z' },
    { type_mouvement: 'activation', game_id: 'x10', quantite: 1, created_at: '2026-08-14T09:00:00Z' },
  ];
  const referenceCreeLe = '2026-08-13T00:00:00Z'; // point zéro il y a ~1,83 jour
  const rotation = M.rotationCarnetsJeu(mouvements, 'x10', maintenant, 30, referenceCreeLe);
  // 2 activations postérieures au point zéro, sur (14/08 20h - 13/08 0h) = 1,833 j
  const joursAttendus = (maintenant.getTime() - new Date(referenceCreeLe).getTime()) / 86400000;
  assert.ok(Math.abs(rotation - 2 / joursAttendus) < 1e-9, `Rotation attendue ~${2 / joursAttendus}, obtenue ${rotation}`);

  const rotationSansActivite = M.rotationCarnetsJeu([], 'inconnu', maintenant, 30, referenceCreeLe);
  assert.strictEqual(rotationSansActivite, 0, 'Aucune activation : rotation = 0 (un fait, pas une absence de donnée)');
}
console.log('✓ 2. rotationCarnetsJeu — fenêtre bornée par le point zéro');

// ------------------------------------------------------------
// 3) ticketsRestantsCarnetEnCours
// ------------------------------------------------------------
{
  const mouvements = [
    { type_mouvement: 'activation', game_id: 'cash5', created_at: '2026-08-13T08:00:00Z' },
    { type_mouvement: 'activation', game_id: 'cash5', created_at: '2026-08-14T08:00:00Z' }, // la plus récente
  ];
  const shiftCounts = [
    { game_id: 'cash5', ventes_qte: 5, created_at: '2026-08-13T20:00:00Z' }, // avant la dernière activation : ignoré
    { game_id: 'cash5', ventes_qte: 12, created_at: '2026-08-14T12:00:00Z' }, // après : compté
  ];
  const restants = M.ticketsRestantsCarnetEnCours(mouvements, shiftCounts, 'cash5', 50);
  assert.strictEqual(restants, 38, `Attendu 50-12=38, obtenu ${restants}`);

  assert.strictEqual(M.ticketsRestantsCarnetEnCours([], [], 'jamais-active', 50), null, 'Aucune activation : non calculable (null), jamais 0');
  assert.strictEqual(M.ticketsRestantsCarnetEnCours(mouvements, shiftCounts, 'cash5', null), null, 'tickets_par_carnet inconnu : non calculable');

  // Carnet déjà épuisé (vendu > tickets_par_carnet) : plancher à 0, jamais négatif.
  const shiftCountsExcedent = [{ game_id: 'cash5', ventes_qte: 999, created_at: '2026-08-14T12:00:00Z' }];
  assert.strictEqual(M.ticketsRestantsCarnetEnCours(mouvements, shiftCountsExcedent, 'cash5', 50), 0);
}
console.log('✓ 3. ticketsRestantsCarnetEnCours');

// ------------------------------------------------------------
// 4) calculerAutonomieJeu
// ------------------------------------------------------------
{
  const auto1 = M.calculerAutonomieJeu({ solde: { nonActives: 2 }, ticketsRestants: 25, ticketsParCarnet: 50, rotationCarnetsJour: 0.7 });
  // stock dispo = 2 + 25/50 = 2.5 carnets ; autonomie = 2.5/0.7 = 3.571... -> arrondi 3.6
  assert.strictEqual(auto1.motif, null);
  assert.strictEqual(auto1.stockDisponibleCarnets, 2.5);
  assert.strictEqual(auto1.jours, Math.round((2.5 / 0.7) * 10) / 10);

  const auto2 = M.calculerAutonomieJeu({ solde: { nonActives: 3 }, ticketsRestants: null, ticketsParCarnet: 50, rotationCarnetsJour: 0 });
  assert.strictEqual(auto2.jours, null, 'Rotation nulle : autonomie non calculable');
  assert.strictEqual(auto2.motif, 'rotation_inconnue');
}
console.log('✓ 4. calculerAutonomieJeu');

// ------------------------------------------------------------
// 5) etatLigneStockV2 — les 3 exemples exacts donnés par Frédéric
// ------------------------------------------------------------
{
  // CASH 5€ : bureau 22, caisse non activés 2, en cours 1 -> 🟢 OK
  const cash = M.etatLigneStockV2({ bureau: 22, nonActives: 2, actives: 1 }, 0, 50, 25, { jours: 10, motif: null });
  assert.strictEqual(cash.statut, 'ok', `CASH attendu OK, obtenu ${cash.statut}`);

  // X10 2€ : bureau 9, caisse non activés 1, en cours 0 -> 🟠 Vigilance
  const x10 = M.etatLigneStockV2({ bureau: 9, nonActives: 1, actives: 0 }, 0, 50, null, { jours: 10, motif: null });
  assert.strictEqual(x10.statut, 'vigilance', `X10 attendu vigilance, obtenu ${x10.statut}`);

  // BANCO 1€ : bureau 3, caisse non activés 0, en cours 0 (aucun carnet en
  // cours identifiable) -> 🔴 Réapprovisionner, la règle "pas encore à
  // moitié" ne s'applique pas sans carnet en cours.
  const banco = M.etatLigneStockV2({ bureau: 3, nonActives: 0, actives: 0 }, 0, 50, null, { jours: null, motif: 'rotation_inconnue' });
  assert.strictEqual(banco.statut, 'reapprovisionner', `BANCO attendu reapprovisionner, obtenu ${banco.statut}`);
  assert.strictEqual(banco.badge, '🔴 Réapprovisionner');

  // Rupture totale : rien nulle part.
  const rupture = M.etatLigneStockV2({ bureau: 0, nonActives: 0, actives: 0 }, 0, 50, null, null);
  assert.strictEqual(rupture.statut, 'reapprovisionner');
  assert.strictEqual(rupture.badge, '🔴 Rupture totale');

  // Rapprochement : prime sur tout, même avec un stock par ailleurs sain.
  const rapprocher = M.etatLigneStockV2({ bureau: 22, nonActives: 2, actives: 1 }, 120, 50, 25, { jours: 10, motif: null });
  assert.strictEqual(rapprocher.statut, 'rapprocher');
  assert.strictEqual(rapprocher.carnetsEstimes, 2);

  // Autonomie courte : bascule en vigilance même avec du stock caisse.
  const autonomieCourte = M.etatLigneStockV2({ bureau: 5, nonActives: 4, actives: 1 }, 0, 50, 25, { jours: 2, motif: null });
  assert.strictEqual(autonomieCourte.statut, 'vigilance', 'Autonomie <= seuil : vigilance même si nonActives>0 et actives>0');

  // ------------------------------------------------------------
  // Règle "pas encore à la moitié du carnet" (14/08/2026, demande de
  // Frédéric) : nonActives=0 (rien en caisse), MAIS un carnet est en cours
  // (actives=1) et il en reste plus de la moitié -> pas de réapprovisionner,
  // juste une vigilance.
  // ------------------------------------------------------------
  // 30/50 tickets restants = 60% > 50% : pas encore à moitié -> vigilance, pas rouge.
  const pasEncoreMoitie = M.etatLigneStockV2({ bureau: 5, nonActives: 0, actives: 1 }, 0, 50, 30, { jours: 5, motif: null });
  assert.strictEqual(pasEncoreMoitie.statut, 'vigilance', `Attendu vigilance (carnet pas encore à moitié), obtenu ${pasEncoreMoitie.statut}`);
  assert.strictEqual(pasEncoreMoitie.badge, '🟠 Vigilance');

  // 24/50 = 48% <= 50% : déjà passé la moitié -> réapprovisionner, comme avant.
  const dejaPasseeMoitie = M.etatLigneStockV2({ bureau: 5, nonActives: 0, actives: 1 }, 0, 50, 24, { jours: 5, motif: null });
  assert.strictEqual(dejaPasseeMoitie.statut, 'reapprovisionner', `Attendu reapprovisionner (déjà à plus de moitié), obtenu ${dejaPasseeMoitie.statut}`);

  // Exactement la moitié (25/50) : la règle dit "pas ENCORE arrivé à la
  // moitié" -> à la moitié pile, ce n'est plus "pas encore", donc rouge.
  const piegeMoitiePile = M.etatLigneStockV2({ bureau: 5, nonActives: 0, actives: 1 }, 0, 50, 25, { jours: 5, motif: null });
  assert.strictEqual(piegeMoitiePile.statut, 'reapprovisionner', `À exactement la moitié : plus "pas encore", attendu reapprovisionner, obtenu ${piegeMoitiePile.statut}`);

  // Sans carnet en cours (actives=0), la règle ne s'applique jamais, même
  // si ticketsRestants était connu par ailleurs (cas normalement impossible
  // en pratique, mais la garde doit rester stricte sur `actives > 0`).
  const sansCarnetEnCours = M.etatLigneStockV2({ bureau: 5, nonActives: 0, actives: 0 }, 0, 50, 40, { jours: 5, motif: null });
  assert.strictEqual(sansCarnetEnCours.statut, 'reapprovisionner', 'Sans carnet en cours, la règle "pas encore à moitié" ne doit jamais s\'appliquer');

  // ticketsParCarnet inconnu : impossible de juger "à moitié", reste rouge.
  const sansTaille = M.etatLigneStockV2({ bureau: 5, nonActives: 0, actives: 1 }, 0, null, 30, { jours: 5, motif: null });
  assert.strictEqual(sansTaille.statut, 'reapprovisionner', 'tickets_par_carnet inconnu : jamais d\'exception (rien à évaluer)');
}
console.log('✓ 5. etatLigneStockV2 — 3 exemples de Frédéric (CASH/X10/BANCO) + rupture totale + rapprochement + autonomie courte + règle "pas encore à moitié"');

// ------------------------------------------------------------
// 6) phraseFamillePalier
// ------------------------------------------------------------
{
  const tousOk = [
    { jeu: { nom: 'CASH 5€' }, etat: { statut: 'ok' } },
    { jeu: { nom: 'MAXI MOTS CROISÉS 5€' }, etat: { statut: 'ok' } },
  ];
  assert.strictEqual(M.phraseFamillePalier(tousOk), 'Tous les jeux de ce palier sont couverts.');

  const mixte = [
    { jeu: { nom: 'CASH 5€' }, etat: { statut: 'ok' } },
    { jeu: { nom: 'Ticket d\'Or' }, etat: { statut: 'reapprovisionner' } },
  ];
  const phraseMixte = M.phraseFamillePalier(mixte);
  assert.ok(phraseMixte.includes("Ticket d'Or n'a aucun carnet en caisse."), phraseMixte);
  assert.ok(phraseMixte.includes('Le reste est couvert.'), phraseMixte);

  const avecRapprocher = [
    { jeu: { nom: 'CASH 5€' }, etat: { statut: 'rapprocher' } },
  ];
  // Le rapprochement ne doit JAMAIS apparaître dans la phrase (axe distinct).
  assert.strictEqual(M.phraseFamillePalier(avecRapprocher), 'Tous les jeux de ce palier sont couverts.');
}
console.log('✓ 6. phraseFamillePalier — ne mélange jamais rapprochement et stock');

// ------------------------------------------------------------
// 7) syntheseGlobaleFdjStock
// ------------------------------------------------------------
{
  const jeux = [
    { id: 'banco', nom: 'BANCO 1€' },
    { id: 'goal', nom: 'GOAL 1€' },
    { id: 'cash5', nom: 'CASH 5€' },
  ];
  const etats = {
    banco: { statut: 'reapprovisionner' },
    goal: { statut: 'reapprovisionner' },
    cash5: { statut: 'ok' },
  };
  const soldes = {
    banco: { bureau: 3, nonActives: 0 },
    goal: { bureau: 5, nonActives: 0 },
    cash5: { bureau: 22, nonActives: 2 },
  };
  const synthese = M.syntheseGlobaleFdjStock(jeux, etats, soldes);
  assert.strictEqual(synthese.compte.tous, 3);
  assert.strictEqual(synthese.compte.reapprovisionner, 2);
  assert.strictEqual(synthese.compte.ok, 1);
  assert.strictEqual(synthese.carnetsDisponiblesCaisse, 2);
  assert.strictEqual(synthese.recommandation, 'Descendre 2 carnets du bureau : BANCO 1€, GOAL 1€.');

  // Rupture totale (bureau=0) : jamais recommandé de "descendre" quelque chose qui n'existe pas.
  const soldesRuptureTotale = { ...soldes, banco: { bureau: 0, nonActives: 0 } };
  const synthese2 = M.syntheseGlobaleFdjStock(jeux, etats, soldesRuptureTotale);
  assert.strictEqual(synthese2.recommandation, 'Descendre 1 carnet du bureau : GOAL 1€.');
}
console.log('✓ 7. syntheseGlobaleFdjStock — totaux + recommandation basée sur des faits');

console.log('\nTous les tests fdj_stock_lecture_manageriale passent.');
