// NEXUS Inventaire — colle Supabase pour "Production journalière" et le
// composant commun "+ Ajouter un mouvement" (cahier "Audit Inventaire -
// Production, mouvements & réceptions", 18/08/2026, M1-M8). Partagé par
// l'écran employé (NEXUS-Inventaire-v1.html : recommandation Q1, nouvelle
// fournée, réception rapide) et l'écran manager (NEXUS-Inventaire-Manager-v1.html :
// chronologie produit, mouvement rétroactif). Toute la logique de
// calcul/décision reste dans nexus-inventaire-moteur.js (Article 11) ; ce
// fichier ne fait que charger ce qu'il faut au moteur puis persister son
// résultat.

(function (global) {
  'use strict';

  // ------------------------------------------------------------
  // M2 — Recommandation de préparation (§4). "Jamais recalculée après coup"
  // (§4.3) : si une recommandation a déjà été affichée/enregistrée pour ce
  // (site, produit, date, quart), on la relit telle quelle plutôt que de la
  // recalculer avec la config actuelle — sinon une règle modifiée en cours
  // de journée réécrirait silencieusement ce qui a déjà été montré à
  // l'employé ce matin.
  // ------------------------------------------------------------
  async function obtenirOuCalculerRecommandation(client, site, produitId, dateISO, quart, quartId) {
    const { data: existante, error: eSel } = await client.from('inventaire_production_recommendations')
      .select('*').eq('site', site).eq('produit_id', produitId).eq('date', dateISO).eq('quart', quart).maybeSingle();
    if (eSel) console.error('Lecture recommandation existante:', eSel);
    if (existante) {
      return {
        contexte: existante.contexte, quantiteConseillee: existante.quantite_conseillee,
        regleId: existante.regle_id, dejaEnregistree: true,
      };
    }

    const M = global.NexusInventaireMoteur;
    if (!M) { console.error('NexusInventaireMoteur non chargé — impossible de calculer la recommandation.'); return null; }

    const [{ data: regle, error: e1 }, { data: valeurSpeciale, error: e2 }, { data: jourCalendrier, error: e3 }] = await Promise.all([
      client.from('inventaire_production_regles').select('*').eq('site', site).eq('produit_id', produitId).maybeSingle(),
      client.from('inventaire_production_valeurs_speciales').select('*').eq('site', site).eq('produit_id', produitId).eq('date', dateISO).maybeSingle(),
      client.from('inventaire_calendrier_site').select('*').eq('site', site).eq('date', dateISO).maybeSingle(),
    ]);
    if (e1) console.error('Chargement règle production:', e1);
    if (e2) console.error('Chargement valeur spéciale:', e2);
    if (e3) console.error('Chargement calendrier site:', e3);

    const resultat = M.calculerRecommandationPreparation({
      dateISO, regle: regle || null, valeurSpeciale: valeurSpeciale || null, jourCalendrierSite: jourCalendrier || null,
    });

    // Non bloquant : si l'écriture de la photo échoue (réseau), l'employé
    // voit quand même sa recommandation -- seule la stabilité "jamais
    // recalculée" est perdue pour cette fois (Article 5 : ne jamais bloquer
    // le parcours pour une donnée secondaire).
    const { error: eIns } = await client.from('inventaire_production_recommendations').insert({
      site, produit_id: produitId, quart_id: quartId || null, date: dateISO, quart,
      contexte: resultat.contexte, quantite_conseillee: resultat.quantiteConseillee, regle_id: resultat.regleId,
    });
    if (eIns) console.error('Enregistrement recommandation:', eIns);

    return Object.assign({ dejaEnregistree: false, regle: regle || null }, resultat);
  }

  // ------------------------------------------------------------
  // M3/M4/M6 — Mouvement générique, idempotent (MOV-11). idempotencyKey doit
  // être généré côté appelant AVANT le premier essai réseau (pas régénéré à
  // chaque retry) pour qu'un double tap ou un retry réutilise la même clé.
  // ------------------------------------------------------------
  async function enregistrerMouvement(client, { site, quartId, produitId, typeMouvement, quantite, employeeId, justification, idempotencyKey }) {
    const { data, error } = await client.from('inventaire_mouvements').insert({
      site, quart_id: quartId, produit_id: produitId, type_mouvement: typeMouvement,
      quantite, employee_id: employeeId || null, justification: justification || null,
      reason_code: typeMouvement, idempotency_key: idempotencyKey || null, statut_validation: 'valide',
    }).select().maybeSingle();

    if (error) {
      // Contrainte unique idempotency_key déjà utilisée = double tap ou
      // retry réseau sur un geste déjà enregistré -- ce n'est pas un échec
      // pour l'employé, on relit le mouvement existant (MOV-11).
      if (idempotencyKey && (error.code === '23505' || /duplicate key/i.test(error.message || ''))) {
        const { data: existant, error: eSel } = await client.from('inventaire_mouvements')
          .select('*').eq('idempotency_key', idempotencyKey).maybeSingle();
        if (eSel) console.error('Relecture mouvement après doublon idempotence:', eSel);
        return { data: existant || null, error: null, dejaEnregistre: true };
      }
      console.error('Enregistrement mouvement:', error);
      return { data: null, error, dejaEnregistre: false };
    }
    return { data, error: null, dejaEnregistre: false };
  }

  // Raccourcis sémantiques (§6/§7) au-dessus de enregistrerMouvement --
  // jamais une seconde implémentation de l'écriture, uniquement des noms
  // clairs pour les deux gestes les plus fréquents du bouton + Mouvement.
  function enregistrerNouvelleFournee(client, params) {
    return enregistrerMouvement(client, Object.assign({}, params, { typeMouvement: 'production_additionnelle', quantite: Math.abs(params.quantite) }));
  }
  function enregistrerReceptionMarchandise(client, params) {
    return enregistrerMouvement(client, Object.assign({}, params, { typeMouvement: 'livraison', quantite: Math.abs(params.quantite) }));
  }
  function enregistrerPreparationInitiale(client, params) {
    return enregistrerMouvement(client, Object.assign({}, params, { typeMouvement: 'production_initiale', quantite: Math.abs(params.quantite) }));
  }

  // ------------------------------------------------------------
  // M7 — Chronologie produit + synthèse journée (§10, §11 modèle de
  // données). Assemble ce qui a déjà été écrit (mouvements de production,
  // comptages de clôture/transmis) sans jamais recalculer un fait déjà
  // persisté (Article 11 : la vérité reste dans les tables sources).
  // ------------------------------------------------------------

  // Comptage le plus récent d'un type donné pour ce produit+quart (une
  // correction manager insère une NOUVELLE ligne sans jamais supprimer
  // l'originale, voir NEXUS-Inventaire-Manager-v1.html::appliquerCorrectionRetroactive
  // -- donc "la valeur retenue" = la plus récente, jamais un second calcul
  // de correction ici).
  function dernierComptageParType(comptages, typeComptage) {
    const lignes = (comptages || [])
      .filter(c => c.type_comptage === typeComptage && c.statut === 'valide')
      .sort((a, b) => new Date(b.created_at || b.compte_le) - new Date(a.created_at || a.compte_le));
    return lignes.length ? lignes[0] : null;
  }

  // Équivalent pour les mouvements (18/08/2026, M6 — cahier "Robustesse :
  // corrections versionnées") : production_initiale est un SINGLETON par
  // (quart, produit) -- "la" quantité préparée ce matin-là -- exactement
  // comme un comptage de clôture. Une correction manager (voir
  // NEXUS-Inventaire-Manager-v1.html, correctionType='corriger_preparation_q1')
  // insère donc une NOUVELLE ligne production_initiale plutôt que de
  // modifier l'existante -- même philosophie "append-only, le plus récent
  // gagne" que dernierComptageParType ci-dessus, jamais une deuxième règle.
  // production_additionnelle (les fournées), lui, reste volontairement
  // hors de cette fonction : plusieurs fournées légitimes coexistent le
  // même quart et se SOMMENT (sommeMouvementsProduction), elles ne se
  // remplacent jamais l'une l'autre.
  function dernierMouvementParType(mouvements, typeMouvement) {
    const lignes = (mouvements || [])
      .filter(m => m.type_mouvement === typeMouvement && (m.statut_validation === 'valide' || !m.statut_validation))
      .sort((a, b) => new Date(b.cree_le || 0) - new Date(a.cree_le || 0));
    return lignes.length ? lignes[0] : null;
  }

  // Lecture pour le formulaire de correction manager (M6) : le mouvement
  // production_initiale actuellement retenu pour ce (produit, quart), tel
  // qu'affiché à l'employé le matin même -- jamais recalculé, une simple
  // relecture de ce qui a déjà été écrit (Article 11).
  async function chargerMouvementProductionInitialeActuel(client, produitId, quartId) {
    const { data, error } = await client.from('inventaire_mouvements')
      .select('*').eq('produit_id', produitId).eq('quart_id', quartId).eq('type_mouvement', 'production_initiale')
      .order('cree_le', { ascending: false }).limit(1).maybeSingle();
    if (error) { console.error('Chargement mouvement production_initiale (correction):', error); return null; }
    return data;
  }

  async function chargerHistoriqueProductionProduit(client, site, produitId, dateISO) {
    const { data: quarts, error: eq } = await client.from('inventaire_quarts')
      .select('id, quart, statut, cloture_le').eq('site', site).eq('date', dateISO).order('quart', { ascending: true });
    if (eq) { console.error('Chargement quarts journée (historique production):', eq); return null; }

    const quartQ1 = (quarts || []).find(q => q.quart === 'matin') || null;
    const quartQ2 = (quarts || []).find(q => q.quart === 'soir') || null;
    const quartIds = (quarts || []).map(q => q.id);
    if (!quartIds.length) {
      return { quarts: [], mouvements: [], comptages: [], synthese: null };
    }

    const [{ data: mouvements, error: em }, { data: comptages, error: ec }] = await Promise.all([
      client.from('inventaire_mouvements').select('*').eq('site', site).eq('produit_id', produitId).in('quart_id', quartIds).order('cree_le', { ascending: true }),
      client.from('inventaire_comptages').select('*').eq('site', site).eq('produit_id', produitId).in('quart_id', quartIds),
    ]);
    if (em) console.error('Chargement mouvements (historique production):', em);
    if (ec) console.error('Chargement comptages (historique production):', ec);

    const mvts = mouvements || [];
    const cpts = comptages || [];

    const prepInitialeMvt = quartQ1 ? dernierMouvementParType(mvts.filter(m => m.quart_id === quartQ1.id), 'production_initiale') : null;
    const fourneesQ1 = quartQ1 ? mvts.filter(m => m.quart_id === quartQ1.id && m.type_mouvement === 'production_additionnelle') : [];
    const fourneesQ2 = quartQ2 ? mvts.filter(m => m.quart_id === quartQ2.id && m.type_mouvement === 'production_additionnelle') : [];

    const clotureQ1 = quartQ1 ? dernierComptageParType(cpts.filter(c => c.quart_id === quartQ1.id), 'cloture') : null;
    const clotureQ2 = quartQ2 ? dernierComptageParType(cpts.filter(c => c.quart_id === quartQ2.id), 'cloture') : null;

    const M = global.NexusInventaireMoteur;
    const synthese = M ? M.syntheseProductionJournee({
      prepInitiale: prepInitialeMvt ? prepInitialeMvt.quantite : null,
      fourneesQ1, resteFinQ1: clotureQ1 ? clotureQ1.quantite : null,
      fourneesQ2, resteFinal: clotureQ2 ? clotureQ2.quantite : null,
      retraitsTraces: 0,
    }) : null;

    return {
      quarts: quarts || [], mouvements: mvts, comptages: cpts,
      prepInitialeMvt, fourneesQ1, fourneesQ2, clotureQ1, clotureQ2, synthese,
    };
  }

  // M7 (19/08/2026) — liste des produits éligibles à la chronologie
  // production journalière (vue manager). Filtre en 2 requêtes plutôt
  // qu'une jointure PostgREST complexe : inventaire_regles_produit.profil
  // décide QUI est concerné (même colonne que profilParProduit côté
  // employé, Article 11 — jamais un deuxième critère inventé ici),
  // inventaire_zone_produit fournit le libellé/catégorie pour le select.
  async function chargerProduitsProfilProductionJournaliere(client, site) {
    const { data: regles, error: eR } = await client.from('inventaire_regles_produit')
      .select('produit_id').eq('site', site).eq('profil', 'production_journaliere');
    if (eR) { console.error('Chargement produits profil production_journaliere (règles):', eR); return []; }
    const ids = (regles || []).map(r => r.produit_id);
    if (!ids.length) return [];
    const { data: produits, error: eP } = await client.from('inventaire_zone_produit')
      .select('id, designation, categorie_id, inventaire_categories(nom)')
      .eq('site', site).eq('actif', true).in('id', ids).order('designation');
    if (eP) { console.error('Chargement produits profil production_journaliere (fiches):', eP); return []; }
    return produits || [];
  }

  // ------------------------------------------------------------
  // M8 — Analyse : conseillé vs préparé vs écoulé (fondations, 19/08/2026).
  // Assemble, pour chaque jour d'une période, le conseillé (M2, relu tel
  // quel dans inventaire_production_recommendations — jamais recalculé
  // après coup, §4.3) et le préparé/écoulé (M5/M7, chargerHistorique
  // ProductionProduit) puis fait qualifier l'écart par le moteur partagé
  // (analyserJourneeProduction, Article 11 — aucune classification ici).
  // Une requête par jour (chargerHistoriqueProductionProduit) : acceptable
  // pour ces fondations, pas encore optimisé en une seule requête groupée
  // — à revoir si Frédéric demande un écran plein sur de longues périodes.
  // ------------------------------------------------------------
  function* datesEntre(dateDebutISO, dateFinISO) {
    let d = new Date(dateDebutISO + 'T00:00:00Z');
    const fin = new Date(dateFinISO + 'T00:00:00Z');
    while (d.getTime() <= fin.getTime()) {
      yield d.toISOString().slice(0, 10);
      d = new Date(d.getTime() + 86400000);
    }
  }

  async function chargerAnalyseConseillePrepareEcoule(client, site, produitId, dateDebutISO, dateFinISO) {
    const M = global.NexusInventaireMoteur;
    if (!M) { console.error('NexusInventaireMoteur non chargé — analyse conseillé/préparé/écoulé impossible.'); return null; }

    const { data: recommandations, error: eRec } = await client.from('inventaire_production_recommendations')
      .select('date, quantite_conseillee').eq('site', site).eq('produit_id', produitId).eq('quart', 'matin')
      .gte('date', dateDebutISO).lte('date', dateFinISO);
    if (eRec) console.error('Chargement recommandations (analyse M8):', eRec);
    const conseilleParDate = {};
    (recommandations || []).forEach(r => { conseilleParDate[r.date] = r.quantite_conseillee; });

    const lignes = [];
    for (const date of datesEntre(dateDebutISO, dateFinISO)) {
      const histo = await chargerHistoriqueProductionProduit(client, site, produitId, date);
      const conseille = conseilleParDate[date] != null ? conseilleParDate[date] : null;
      const prepare = (histo && histo.synthese) ? histo.synthese.productionTotale : null;
      const ecoule = (histo && histo.synthese) ? histo.synthese.ecoulementJournee : null;
      const analyse = M.analyserJourneeProduction({ conseille, prepare, ecoule });
      lignes.push({ date, conseille, prepare, ecoule, preparation: analyse.preparation, ecoulement: analyse.ecoulement });
    }

    return { lignes, synthese: M.syntheseAnalysePeriode(lignes) };
  }

  global.NexusInventaireProductionDonnees = {
    obtenirOuCalculerRecommandation,
    enregistrerMouvement, enregistrerNouvelleFournee, enregistrerReceptionMarchandise, enregistrerPreparationInitiale,
    dernierComptageParType, dernierMouvementParType, chargerMouvementProductionInitialeActuel, chargerHistoriqueProductionProduit,
    chargerProduitsProfilProductionJournaliere, chargerAnalyseConseillePrepareEcoule,
  };
})(typeof window !== 'undefined' ? window : globalThis);
