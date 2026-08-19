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

    const prepInitialeMvt = quartQ1 ? mvts.find(m => m.quart_id === quartQ1.id && m.type_mouvement === 'production_initiale') : null;
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

  global.NexusInventaireProductionDonnees = {
    obtenirOuCalculerRecommandation,
    enregistrerMouvement, enregistrerNouvelleFournee, enregistrerReceptionMarchandise, enregistrerPreparationInitiale,
    dernierComptageParType, chargerHistoriqueProductionProduit,
  };
})(typeof window !== 'undefined' ? window : globalThis);
