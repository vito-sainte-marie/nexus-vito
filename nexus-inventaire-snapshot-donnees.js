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

  global.NexusInventaireSnapshotDonnees = {
    creerSnapshot, chargerDernierSnapshotActif, chargerSnapshotParId,
    chargerHistoriqueSnapshots, remplacerAnciensSnapshotsActifs,
    creerLignesSnapshot, chargerLignesSnapshot,
  };
})(typeof window !== 'undefined' ? window : globalThis);
