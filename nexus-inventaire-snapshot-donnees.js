// NEXUS Inventaire V2 — Snapshot Decenium, Étape 1 "fondation" (30/08/2026).
// Couche données pour inventaire_decenium_snapshots — Article 11 : ne
// recalcule rien (voir nexus-inventaire-snapshot-moteur.js), ne fait que
// persister/charger. `inventaire_rapprochements` reste la seule source du
// RÉSULTAT du rapprochement, inchangée — ce fichier ne s'occupe que de la
// SOURCE temporelle.

(function (global) {
  'use strict';

  // Crée un nouveau Snapshot. `champs` est exactement ce que
  // NexusInventaireSnapshotMoteur.qualifierSnapshotDecenium a calculé, plus
  // les métadonnées des deux fichiers (filename, export_at, export_time_
  // source, imported_at côté employé/manager) et le contexte de création
  // facultatif (quart_id_source — jamais une clé métier, voir doctrine
  // verrouillée par Frédéric).
  async function creerSnapshot(client, site, {
    salesFilename, salesExportAt, salesExportTimeSource, salesImportedAt,
    stockFilename, stockExportAt, stockExportTimeSource, stockImportedAt,
    exportOrder, deltaSeconds, snapshotReferenceAt,
    confidenceLevel, validatedWithReserve,
    quartIdSource, createdBy,
  }) {
    const { data, error } = await client.from('inventaire_decenium_snapshots').insert({
      site,
      sales_filename: salesFilename || null, sales_export_at: salesExportAt || null,
      sales_export_time_source: salesExportTimeSource || 'import_time_estimated',
      sales_imported_at: salesImportedAt || new Date().toISOString(),
      stock_filename: stockFilename || null, stock_export_at: stockExportAt || null,
      stock_export_time_source: stockExportTimeSource || 'import_time_estimated',
      stock_imported_at: stockImportedAt || new Date().toISOString(),
      export_order: exportOrder, delta_seconds: deltaSeconds, snapshot_reference_at: snapshotReferenceAt,
      confidence_level: confidenceLevel, validated_with_reserve: !!validatedWithReserve,
      quart_id_source: quartIdSource || null, created_by: createdBy || null,
    }).select().maybeSingle();
    if (error) { console.error('Création Snapshot Decenium:', error); return null; }
    return data;
  }

  // Le Snapshot le plus récent encore "actif" pour ce site — c'est celui
  // que l'écran "Photo Decenium" affiche par défaut et que le rapprochement
  // réutilise tant qu'aucune photo plus récente n'a été créée. Jamais
  // filtré par quart (doctrine verrouillée : le Snapshot appartient au
  // site, pas à un quart).
  async function chargerDernierSnapshotActif(client, site) {
    const { data, error } = await client.from('inventaire_decenium_snapshots')
      .select('*').eq('site', site).eq('status', 'actif')
      .order('snapshot_reference_at', { ascending: false }).limit(1).maybeSingle();
    if (error) { console.error('Chargement dernier Snapshot Decenium:', error); return null; }
    return data;
  }

  async function chargerSnapshotParId(client, id) {
    const { data, error } = await client.from('inventaire_decenium_snapshots').select('*').eq('id', id).maybeSingle();
    if (error) { console.error('Chargement Snapshot Decenium par id:', error); return null; }
    return data;
  }

  // Historique des Snapshots d'un site (les N plus récents), pour un futur
  // écran "voir le détail" / sélection d'un Snapshot antérieur (Étape 5,
  // rétroactivité) — pas encore consommé côté écran dans cette étape,
  // fourni par anticipation pour éviter une deuxième requête équivalente
  // plus tard (Article 11).
  async function chargerHistoriqueSnapshots(client, site, limite) {
    const { data, error } = await client.from('inventaire_decenium_snapshots')
      .select('*').eq('site', site)
      .order('snapshot_reference_at', { ascending: false }).limit(limite || 10);
    if (error) { console.error('Chargement historique Snapshots Decenium:', error); return []; }
    return data || [];
  }

  // Marque les Snapshots antérieurs "remplace" quand un nouveau devient la
  // référence — jamais une suppression (Article 5 : l'ancien Snapshot
  // reste consultable, seul son statut de cycle de vie change). Appelé
  // après creerSnapshot, uniquement sur les AUTRES snapshots encore actifs
  // du même site.
  async function remplacerAnciensSnapshotsActifs(client, site, nouveauSnapshotId) {
    const { error } = await client.from('inventaire_decenium_snapshots')
      .update({ status: 'remplace' }).eq('site', site).eq('status', 'actif').neq('id', nouveauSnapshotId);
    if (error) console.error('Remplacement anciens Snapshots Decenium:', error);
  }

  // ------------------------------------------------------------
  // Étape 2 "UX Photo Decenium" (30/08/2026) — lignes de STOCK ACTUEL
  // rattachées à un Snapshot (table inventaire_decenium_snapshot_lignes,
  // additive, RLS identique aux autres tables Snapshot). Une ligne par
  // produit rapproché depuis l'export Stock actuel — jamais fusionnée avec
  // inventaire_ventes_import (Article 11 : ce n'est pas la même source, ni
  // la même sémantique — quantité en stock, pas quantité vendue).
  // ------------------------------------------------------------

  // `lignes` déjà rapprochées côté appelant (produit_id résolu ou null,
  // jamais deviné ici) — insertion en lot, une seule fois par création de
  // Snapshot (Article 5 : jamais une suppression d'un ancien snapshot, ses
  // lignes restent consultables pour l'historique).
  async function creerLignesSnapshot(client, snapshotId, site, lignes) {
    if (!lignes || !lignes.length) return true;
    const { error } = await client.from('inventaire_decenium_snapshot_lignes').insert(
      lignes.map(l => ({
        snapshot_id: snapshotId, site,
        produit_id: l.produit_id || null,
        designation_brute: l.designation_brute,
        code_barres_brut: l.code_barres_brut || null,
        quantite_stock: l.quantite_stock,
        prix_achat_ht: l.prix_achat_ht != null ? l.prix_achat_ht : null,
        importe_par: l.importe_par || null,
      }))
    );
    if (error) { console.error('Insertion lignes Snapshot Decenium (stock actuel):', error); return false; }
    return true;
  }

  // Fourni par anticipation de l'Étape 3 (reconstruction temporelle T1→T0,
  // qui doit relire le stock actuel produit par produit d'un Snapshot
  // donné) — même précédent que chargerHistoriqueSnapshots à l'Étape 1,
  // pas encore consommé par un écran dans ce lot.
  async function chargerLignesSnapshot(client, snapshotId) {
    const { data, error } = await client.from('inventaire_decenium_snapshot_lignes')
      .select('*').eq('snapshot_id', snapshotId);
    if (error) { console.error('Chargement lignes Snapshot Decenium:', error); return []; }
    return data || [];
  }

  // ------------------------------------------------------------
  // Étape 3 "reconstruction temporelle" (30/08/2026) — charge tout ce dont
  // NexusInventaireSnapshotMoteur a besoin pour reconstituer le stock
  // théorique à T0 à partir d'un Snapshot à T1 (voir doctrine et formule
  // verrouillées en tête de nexus-inventaire-snapshot-moteur.js). Cette
  // couche ne CALCULE rien elle-même (Article 11) — elle charge, le moteur
  // qualifie et agrège.
  // ------------------------------------------------------------

  // Quarts candidats pour la fenêtre (T0,T1] : tout quart encore ouvert
  // (cloture_le null) ouvert avant T1 (sera exclu par le moteur avec le
  // motif 'quart_non_cloture', jamais silencieusement ignoré ici), ou tout
  // quart clôturé dont la clôture tombe à T0 ou après — le moteur tranche
  // ensuite lui-même s'il est entièrement contenu dans (T0,T1] ou non
  // (classerQuartDansFenetre). Jamais un filtre plus étroit qui masquerait
  // un quart chevauchant à l'appelant (Article 5).
  async function chargerQuartsFenetre(client, site, instantT0, instantT1) {
    const { data, error } = await client.from('inventaire_quarts')
      .select('id, site, date, quart, ouvert_le, cloture_le')
      .eq('site', site)
      .lte('ouvert_le', instantT1)
      .or(`cloture_le.is.null,cloture_le.gte.${instantT0}`)
      .order('ouvert_le', { ascending: true });
    if (error) { console.error('Chargement quarts fenêtre reconstruction:', error); return []; }
    return data || [];
  }

  // Lignes de ventes des quarts jugés utilisables par le moteur
  // (classerQuartDansFenetre) — jamais rechargé pour tous les quarts de la
  // fenêtre (Article 5 : un quart chevauchant n'apporte aucune vente
  // exploitable, inutile de la charger).
  async function chargerVentesQuarts(client, quartIds) {
    if (!quartIds || !quartIds.length) return [];
    const { data, error } = await client.from('inventaire_ventes_import')
      .select('quart_id, produit_id, quantite_vendue').in('quart_id', quartIds);
    if (error) { console.error('Chargement ventes des quarts (reconstruction):', error); return []; }
    return data || [];
  }

  // `inventaire_mouvements.cree_le` est un vrai horodatage précis (vérifié
  // dans le schéma réel avant ce lot) — fenêtre exclusive à gauche,
  // inclusive à droite : (T0,T1], jamais T0 lui-même (déjà "dans" le stock
  // théorique qu'on cherche à reconstituer).
  async function chargerMouvementsFenetre(client, site, instantT0, instantT1) {
    const { data, error } = await client.from('inventaire_mouvements')
      .select('produit_id, quantite, cree_le')
      .eq('site', site).gt('cree_le', instantT0).lte('cree_le', instantT1);
    if (error) { console.error('Chargement mouvements fenêtre reconstruction:', error); return []; }
    return data || [];
  }

  // `inventaire_corrections.created_at` est le vrai horodatage de saisie
  // (jamais `operational_date`/`quart`, choisis librement par le manager et
  // décorrélés de l'instant réel — voir doctrine en tête du moteur).
  async function chargerCorrectionsFenetre(client, site, instantT0, instantT1) {
    const { data, error } = await client.from('inventaire_corrections')
      .select('produit_id, old_value, new_value, created_at')
      .eq('site', site).gt('created_at', instantT0).lte('created_at', instantT1);
    if (error) { console.error('Chargement corrections fenêtre reconstruction:', error); return []; }
    return data || [];
  }

  // Orchestration — assemble les chargements ci-dessus et les fonctions
  // pures du moteur (Étape 3) pour produire, ligne de Snapshot par ligne de
  // Snapshot, le stock théorique à `instantT0`. Ne recalcule jamais elle-
  // même une agrégation ou une qualification (Article 11 : tout le calcul
  // vit dans NexusInventaireSnapshotMoteur, testable indépendamment).
  //
  // Cas particulier assumé (Article 5, pas une fabrication de précision) :
  // une ligne de Snapshot dont `produit_id` n'a pas pu être résolu au
  // rapprochement (Étape 2) ne peut pas être reliée aux ventes/mouvements/
  // corrections (elles aussi indexées par produit_id) — on ne fabrique
  // JAMAIS un résultat en supposant zéro mouvement pour ce produit :
  // qualité 'impossible', motif 'produit_non_resolu', explicite.
  async function reconstituerStockTheoriqueSite(client, site, snapshot, instantT0) {
    const Moteur = global.NexusInventaireSnapshotMoteur;
    const instantT1 = snapshot ? snapshot.snapshot_reference_at : null;
    const qualification = Moteur.qualifierReconstructionT0T1(instantT0, instantT1);
    if (!qualification.possible) {
      return { qualification, resultats: [], quartsExclus: [], correctionsIgnorees: [] };
    }

    const quarts = await chargerQuartsFenetre(client, site, instantT0, instantT1);
    const quartsInclus = [];
    const quartsExclus = [];
    quarts.forEach(q => {
      const c = Moteur.classerQuartDansFenetre({ ouvertLe: q.ouvert_le, clotureLe: q.cloture_le }, instantT0, instantT1);
      if (c.utilisable) quartsInclus.push(q.id);
      else quartsExclus.push({ quart_id: q.id, date: q.date, quart: q.quart, motif: c.motif });
    });

    const [ventesLignes, mouvements, corrections, lignesSnapshot] = await Promise.all([
      chargerVentesQuarts(client, quartsInclus),
      chargerMouvementsFenetre(client, site, instantT0, instantT1),
      chargerCorrectionsFenetre(client, site, instantT0, instantT1),
      chargerLignesSnapshot(client, snapshot.id),
    ]);

    const ventesParProduit = Moteur.agregerVentesParProduit(ventesLignes);
    const mouvementsParProduit = Moteur.agregerMouvementsParProduit(mouvements);
    const { parProduit: correctionsParProduit, ignorees: correctionsIgnorees } = Moteur.agregerCorrectionsParProduit(corrections);

    const resultats = lignesSnapshot.map(ligne => {
      if (!ligne.produit_id) {
        return {
          produit_id: null, designation_brute: ligne.designation_brute,
          stock_theorique: null, qualite: 'impossible', motif: 'produit_non_resolu',
        };
      }
      return Moteur.reconstituerStockTheorique({
        produitId: ligne.produit_id,
        quantiteSnapshotT1: ligne.quantite_stock,
        sommeVentesFenetre: ventesParProduit[ligne.produit_id] || 0,
        sommeMouvementsFenetre: mouvementsParProduit[ligne.produit_id] || 0,
        sommeCorrectionsFenetre: correctionsParProduit[ligne.produit_id] || 0,
        quartsExclusCount: quartsExclus.length,
      });
    });

    return { qualification, resultats, quartsExclus, correctionsIgnorees };
  }

  global.NexusInventaireSnapshotDonnees = {
    creerSnapshot, chargerDernierSnapshotActif, chargerSnapshotParId,
    chargerHistoriqueSnapshots, remplacerAnciensSnapshotsActifs,
    creerLignesSnapshot, chargerLignesSnapshot,
    chargerQuartsFenetre, chargerVentesQuarts, chargerMouvementsFenetre,
    chargerCorrectionsFenetre, reconstituerStockTheoriqueSite,
  };
})(typeof window !== 'undefined' ? window : globalThis);
