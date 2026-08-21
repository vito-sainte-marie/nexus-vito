// ============================================================
// NEXUS Import — couche données (Supabase). Aucune règle métier ici :
// tout calcul (mapping, classification anti-doublon, score qualité)
// vient de nexus-import-moteur.js — cette couche ne fait que
// charger/écrire, jamais recalculer (Article 11).
// ============================================================

(function (global) {
  'use strict';

  async function calculerHashFichier(arrayBuffer) {
    if (typeof crypto === 'undefined' || !crypto.subtle) return null;
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ------------------------------------------------------------
  // Batch
  // ------------------------------------------------------------
  async function creerBatch(client, champs) {
    const { data, error } = await client.from('import_batches').insert({
      site: champs.site,
      intention: champs.intention,
      fichier_nom: champs.fichierNom || null,
      fichier_taille_octets: champs.fichierTailleOctets || null,
      fichier_hash: champs.fichierHash || null,
      fichier_feuille: champs.fichierFeuille || null,
      periode_debut: champs.periodeDebut || null,
      periode_fin: champs.periodeFin || null,
      date_releve: champs.dateReleve || null,
      campagne_id: champs.campagneId || null,
      phase: champs.phase || null,
      remplace_batch_id: champs.remplaceBatchId || null,
      auteur_id: champs.auteurId || null,
      statut: 'draft',
    }).select().single();
    if (error) { console.error('creerBatch:', error); return null; }
    return data;
  }

  async function marquerBatchStatut(client, batchId, statut, champsSupplementaires) {
    const patch = Object.assign({ statut }, champsSupplementaires || {});
    const { error } = await client.from('import_batches').update(patch).eq('id', batchId);
    if (error) { console.error('marquerBatchStatut:', error); return false; }
    return true;
  }

  async function verifierFichierDejaPublie(client, site, intention, fichierHash) {
    if (!fichierHash) return null;
    const { data, error } = await client.from('import_batches')
      .select('id, cree_le, publie_le')
      .eq('site', site).eq('intention', intention).eq('fichier_hash', fichierHash).eq('statut', 'published')
      .order('publie_le', { ascending: false }).limit(1);
    if (error) { console.error('verifierFichierDejaPublie:', error); return null; }
    return data && data[0] ? data[0] : null;
  }

  // ------------------------------------------------------------
  // Staging brut + mapping
  // ------------------------------------------------------------
  async function enregistrerLignesBrutes(client, batchId, rows) {
    const TAILLE_LOT = 500;
    for (let i = 0; i < rows.length; i += TAILLE_LOT) {
      const lot = rows.slice(i, i + TAILLE_LOT).map((r, j) => ({
        batch_id: batchId, numero_ligne: i + j, donnees: r,
      }));
      const { error } = await client.from('import_rows_raw').insert(lot);
      if (error) { console.error('enregistrerLignesBrutes:', error); return false; }
    }
    return true;
  }

  async function chargerMappingMemoire(client, site, intention) {
    const { data, error } = await client.from('import_mappings')
      .select('champ_canonique, colonne_source, cree_le')
      .eq('site', site).eq('intention', intention)
      .order('cree_le', { ascending: false });
    if (error) { console.error('chargerMappingMemoire:', error); return []; }
    const parChamp = new Map();
    (data || []).forEach(r => { if (!parChamp.has(r.champ_canonique)) parChamp.set(r.champ_canonique, r); });
    return Array.from(parChamp.values());
  }

  async function enregistrerMapping(client, batchId, site, intention, mapping, auto, employeId) {
    const lignes = Object.entries(mapping)
      .filter(([, colonne]) => !!colonne)
      .map(([champ, colonne]) => ({
        batch_id: batchId, site, intention, champ_canonique: champ, colonne_source: colonne,
        auto_detecte: !!(auto && auto[champ]), confirme_par: employeId || null,
      }));
    if (!lignes.length) return true;
    const { error } = await client.from('import_mappings').insert(lignes);
    if (error) { console.error('enregistrerMapping:', error); return false; }
    return true;
  }

  // ------------------------------------------------------------
  // Alias produit
  // ------------------------------------------------------------
  async function chargerAliasProduits(client, site, intention) {
    const { data, error } = await client.from('import_product_aliases')
      .select('designation_brute_normalisee, designation_canonique')
      .eq('site', site).eq('intention', intention);
    if (error) { console.error('chargerAliasProduits:', error); return []; }
    return data || [];
  }

  async function creerAliasProduit(client, moteur, { site, intention, designationBrute, designationCanonique, creePar }) {
    const cle = moteur.normaliserArticleImport(designationBrute);
    const { error } = await client.from('import_product_aliases')
      .upsert({ site, intention, designation_brute_normalisee: cle, designation_canonique: designationCanonique, cree_par: creePar || null },
        { onConflict: 'site,intention,designation_brute_normalisee' });
    if (error) { console.error('creerAliasProduit:', error); return false; }
    return true;
  }

  // ------------------------------------------------------------
  // Données déjà connues (pour classifier nouvelle/connue_identique/
  // connue_modifiee) — une requête ciblée par intention, jamais un
  // second passage sur tout l'historique.
  // ------------------------------------------------------------
  async function chargerConnuesPourVentes(client, moteur, site, periodeDebut, periodeFin) {
    const { data, error } = await client.from('products')
      .select('categorie, article, code_barres, quantite, prix_achat, prix_vente, tva')
      .eq('site', site).eq('periode_debut', periodeDebut).eq('periode_fin', periodeFin);
    if (error) { console.error('chargerConnuesPourVentes:', error); return new Map(); }
    const map = new Map();
    (data || []).forEach(p => {
      const cle = moteur.cleMetierVentes({ periodeDebut, periodeFin, categorie: p.categorie, article: p.article, codeBarres: p.code_barres });
      map.set(cle, { categorie: p.categorie, article: p.article, code_barres: p.code_barres, quantite: p.quantite, prix_achat: p.prix_achat, prix_vente: p.prix_vente, tva: p.tva });
    });
    return map;
  }

  async function chargerConnuesPourStock(client, moteur, site, dateReleve) {
    const debutJour = `${dateReleve}T00:00:00.000Z`;
    const finJour = `${dateReleve}T23:59:59.999Z`;
    const { data, error } = await client.from('stock_releves')
      .select('categorie, article, code_barres, quantite_theorique, releve_le')
      .eq('site', site).gte('releve_le', debutJour).lte('releve_le', finJour)
      .order('releve_le', { ascending: false });
    if (error) { console.error('chargerConnuesPourStock:', error); return new Map(); }
    const map = new Map();
    (data || []).forEach(p => {
      const cle = moteur.cleMetierStock({ dateReleve, article: p.article, codeBarres: p.code_barres });
      if (!map.has(cle)) map.set(cle, { categorie: p.categorie, article: p.article, code_barres: p.code_barres, quantite_theorique: p.quantite_theorique });
    });
    return map;
  }

  async function chargerConnuesPourPanier(client, moteur, site, dates) {
    if (!dates.length) return new Map();
    const { data, error } = await client.from('panier_moyen_quotidien')
      .select('date, nb_tickets, panier_moyen_ht, panier_moyen_ttc')
      .eq('site', site).in('date', dates);
    if (error) { console.error('chargerConnuesPourPanier:', error); return new Map(); }
    const map = new Map();
    (data || []).forEach(p => {
      const cle = moteur.cleMetierPanier({ date: p.date });
      map.set(cle, { date: p.date, nb_tickets: p.nb_tickets, panier_moyen_ht: p.panier_moyen_ht, panier_moyen_ttc: p.panier_moyen_ttc });
    });
    return map;
  }

  async function chargerPeriodesExistantesVentes(client, site) {
    const { data, error } = await client.from('products')
      .select('periode_debut, periode_fin').eq('site', site);
    if (error) { console.error('chargerPeriodesExistantesVentes:', error); return []; }
    const vues = new Set();
    const periodes = [];
    (data || []).forEach(p => {
      const cle = `${p.periode_debut}|${p.periode_fin}`;
      if (vues.has(cle)) return;
      vues.add(cle);
      periodes.push({ debut: p.periode_debut, fin: p.periode_fin });
    });
    return periodes;
  }

  // ------------------------------------------------------------
  // Résultats + rapport qualité
  // ------------------------------------------------------------
  async function enregistrerResultats(client, batchId, resultats) {
    const TAILLE_LOT = 500;
    for (let i = 0; i < resultats.length; i += TAILLE_LOT) {
      const lot = resultats.slice(i, i + TAILLE_LOT).map((r, j) => ({
        batch_id: batchId, numero_ligne: i + j, statut: r.statut,
        cle_metier: r.cle_metier, raison: r.raison, valeurs: r.valeurs,
      }));
      const { error } = await client.from('import_row_results').insert(lot);
      if (error) { console.error('enregistrerResultats:', error); return false; }
    }
    return true;
  }

  async function enregistrerQualityReport(client, batchId, rapport) {
    const { error } = await client.from('import_quality_reports').insert({
      batch_id: batchId,
      lignes_total: rapport.lignes_total,
      lignes_nouvelles: rapport.lignes_nouvelles,
      lignes_connues: rapport.lignes_connues,
      lignes_modifiees: rapport.lignes_modifiees,
      lignes_doublons_fichier: rapport.lignes_doublons_fichier,
      lignes_rejetees: rapport.lignes_rejetees,
      references_inconnues: rapport.references_inconnues,
      jours_manquants: rapport.jours_manquants,
      score_qualite: rapport.score_qualite,
      decision_recommandee: rapport.decision_recommandee,
      causes: rapport.causes,
    });
    if (error) { console.error('enregistrerQualityReport:', error); return false; }
    return true;
  }

  async function chargerQualityReport(client, batchId) {
    const { data, error } = await client.from('import_quality_reports').select('*').eq('batch_id', batchId).maybeSingle();
    if (error) { console.error('chargerQualityReport:', error); return null; }
    return data;
  }

  // ------------------------------------------------------------
  // Publication — délègue la partie atomique aux fonctions Postgres
  // import_publier_ventes/stock/panier (une seule transaction, voir
  // migration import_pipeline_publication_atomique). Refuse ici même
  // si la décision qualité est "bloque" (jamais publier un fichier que
  // NEXUS a lui-même jugé inexploitable — section 18 de l'audit).
  // ------------------------------------------------------------
  async function publierBatch(client, batchId, intention) {
    const rapport = await chargerQualityReport(client, batchId);
    if (rapport && rapport.decision_recommandee === 'bloque') {
      return { erreur: 'Ce fichier a été jugé inexploitable par NEXUS (trop de lignes rejetées) — publication refusée.' };
    }
    const okReady = await marquerBatchStatut(client, batchId, 'ready');
    if (!okReady) return { erreur: 'Impossible de préparer la publication — réessayez.' };

    const fn = intention === 'stock_theorique' ? 'import_publier_stock'
      : intention === 'panier_moyen' ? 'import_publier_panier'
      : 'import_publier_ventes';
    const { data, error } = await client.rpc(fn, { p_batch_id: batchId });
    if (error) {
      console.error('publierBatch:', error);
      await marquerBatchStatut(client, batchId, 'failed', { echoue_le: new Date().toISOString(), motif: error.message });
      return { erreur: error.message || 'Échec de la publication — aucune donnée canonique modifiée.' };
    }
    const lignesPubliees = Array.isArray(data) && data[0] ? data[0].lignes_publiees : null;
    return { lignesPubliees };
  }

  async function annulerBatch(client, batchId, motif, employeId, site) {
    const ok = await marquerBatchStatut(client, batchId, 'cancelled', { motif: motif || null });
    if (ok) await journaliser(client, { batchId, site, action: 'annulation', employeId, details: { motif } });
    return ok;
  }

  async function journaliser(client, { batchId, site, action, employeId, details }) {
    const { error } = await client.from('import_audit_log').insert({
      batch_id: batchId || null, site, action, employe_id: employeId || null, details: details || null,
    });
    if (error) console.error('journaliser (import_audit_log):', error);
  }

  async function chargerHistoriqueImports(client, site, limite) {
    const { data, error } = await client.from('import_batches')
      .select('id, intention, statut, fichier_nom, periode_debut, periode_fin, date_releve, cree_le, publie_le')
      .eq('site', site).order('cree_le', { ascending: false }).limit(limite || 20);
    if (error) { console.error('chargerHistoriqueImports:', error); return []; }
    return data || [];
  }

  const NexusImportDonnees = {
    calculerHashFichier,
    creerBatch,
    marquerBatchStatut,
    verifierFichierDejaPublie,
    enregistrerLignesBrutes,
    chargerMappingMemoire,
    enregistrerMapping,
    chargerAliasProduits,
    creerAliasProduit,
    chargerConnuesPourVentes,
    chargerConnuesPourStock,
    chargerConnuesPourPanier,
    chargerPeriodesExistantesVentes,
    enregistrerResultats,
    enregistrerQualityReport,
    chargerQualityReport,
    publierBatch,
    annulerBatch,
    journaliser,
    chargerHistoriqueImports,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = NexusImportDonnees;
  } else {
    global.NexusImportDonnees = NexusImportDonnees;
  }
})(typeof window !== 'undefined' ? window : this);
