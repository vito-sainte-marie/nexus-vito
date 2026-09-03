// ============================================================
// Campagne NEXUS — moteur de suivi du cycle de vie des promotions.
//
// Demande de Frédéric le 25/07/2026 : ne pas se contenter d'une page de
// saisie de promotions, mais suivre tout leur cycle de vie — déclaration
// en 30 secondes par le manager, puis mesure automatique de l'impact,
// jusqu'à terme une bibliothèque comparative ("quelle promotion marche
// le mieux CHEZ MOI").
//
// Phase 1 (25/07/2026) — ce que ce fichier fait réellement :
//   - la déclaration est complète (voir migration campagnes_nexus :
//     nom, dates, type, produits concernés, nature, objectif) ;
//   - la mesure d'impact reste volontairement limitée au CA GLOBAL
//     (piste et/ou boutique selon le type de la promotion), jamais par
//     produit.
//
// Pourquoi cette limite (Article 5 — "jamais un chiffre inventé") :
//   - audits_caisse ne connaît que le CA total piste/boutique par jour,
//     jamais le détail par article ;
//   - products (qui contient bien un CA et une marge par article)
//     n'est importé que par TRIMESTRE — bien trop grossier pour isoler
//     l'effet d'une promotion de quelques jours.
// Tant que NEXUS n'a pas une source de vente par article au jour le
// jour (ou au minimum hebdomadaire), afficher un "+42 % volume
// Heineken" serait une estimation déguisée en fait mesuré. Le Score
// Promotion, l'attribution par produit et la bibliothèque comparative
// arriveront dès que cette donnée existera (voir NEXUS-Campagne-v1.html
// pour le message affiché à l'utilisateur à ce sujet).
//
// Inclure dans une page : <script src="nexus-campagnes.js?v=20260903-2159"></script>
// (même mécanisme que nexus-auth.js, nexus-vocabulaire.js, nexus-tempo.js)
// ============================================================

(function (global) {
  // Un seuil unique, cohérent avec SEUILS.MIN_OCCURRENCES_TENDANCE dans
  // nexus-tempo.js : il faut au moins ce nombre de jours de chaque côté
  // (avant / pendant) pour qu'une comparaison soit affichée.
  const MIN_JOURS_COMPARABLES = 2;

  const TYPE_CAMPAGNE_LABELS = { boutique: 'Boutique', carburant: 'Carburant', mixte: 'Mixte' };

  const NATURE_CAMPAGNE_LABELS = {
    prix_reduit: 'Prix réduit', deux_plus_un: '2+1', pack: 'Pack',
    bon_achat: "Bon d'achat", cadeau: 'Cadeau', remise_carburant: 'Remise carburant',
  };

  const OBJECTIF_CAMPAGNE_LABELS = {
    augmenter_ca: 'Augmenter le CA', augmenter_marge: 'Augmenter la marge',
    ecouler_stock: 'Écouler un stock', attirer_clients: 'Attirer des clients',
    faire_connaitre: 'Faire connaître un produit', fideliser: 'Fidéliser', autre: 'Autre',
  };

  function moyenne(arr) {
    if (!arr.length) return 0;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
  }

  function evolution(valeur, reference) {
    if (reference === null || reference === undefined || reference === 0) return null;
    return (valeur - reference) / reference;
  }

  // CA à comparer selon le type de promotion — jamais un chiffre par
  // produit, seulement le total piste et/ou boutique du jour (mêmes
  // champs que nexus-tempo.js : agregerParJour → ventePiste/venteBoutique).
  function valeurCampagne(type, jour) {
    if (type === 'boutique') return jour.venteBoutique;
    if (type === 'carburant') return jour.ventePiste;
    return jour.ventePiste + jour.venteBoutique; // mixte
  }

  // Compare le CA moyen avant / pendant / après une campagne. "Pendant"
  // inclut les deux bornes (date_debut et date_fin). Se déclare
  // honnêtement "non disponible" tant qu'il n'y a pas assez de jours
  // des deux côtés — jamais de résultat sur un seul jour observé.
  function analyserImpactCampagne(campagne, joursAgreges) {
    const valeur = j => valeurCampagne(campagne.type, j);
    const avant = (joursAgreges || []).filter(j => j.date < campagne.date_debut);
    const pendant = (joursAgreges || []).filter(j => j.date >= campagne.date_debut && j.date <= campagne.date_fin);
    const apres = (joursAgreges || []).filter(j => j.date > campagne.date_fin);

    const base = {
      campagneId: campagne.id, nom: campagne.nom, type: campagne.type, nature: campagne.nature,
      objectif: campagne.objectif, objectifLibre: campagne.objectif_libre || null,
      produitsConcernes: campagne.produits_concernes || [],
      dateDebut: campagne.date_debut, dateFin: campagne.date_fin,
      nbAvant: avant.length, nbPendant: pendant.length, nbApres: apres.length,
    };

    if (avant.length < MIN_JOURS_COMPARABLES || pendant.length < MIN_JOURS_COMPARABLES) {
      return {
        ...base, disponible: false,
        message: `Impact non encore mesurable — il faut au moins ${MIN_JOURS_COMPARABLES} jours avant et ${MIN_JOURS_COMPARABLES} jours pendant la période (actuellement ${avant.length} avant, ${pendant.length} pendant).`,
      };
    }

    const moyAvant = moyenne(avant.map(valeur));
    const moyPendant = moyenne(pendant.map(valeur));
    const moyApres = apres.length >= MIN_JOURS_COMPARABLES ? moyenne(apres.map(valeur)) : null;

    return {
      ...base, disponible: true,
      moyAvant, moyPendant, moyApres,
      evolutionPendant: evolution(moyPendant, moyAvant),
      evolutionApres: moyApres !== null ? evolution(moyApres, moyAvant) : null,
    };
  }

  // ------------------------------------------------------------
  // Phase 2 (25/07/2026) — impact PAR PRODUIT, débloqué par les imports
  // "avant"/"pendant" liés à la promotion via campagnes_nexus_imports
  // (voir NEXUS-Import-v1.html, type "Campagne NEXUS"). Reste gated :
  // s'affiche seulement si les DEUX imports existent, et seulement pour
  // les articles réellement retrouvés dans chacun d'eux — jamais une
  // estimation si l'un des deux manque ou si l'orthographe ne matche pas.
  // ------------------------------------------------------------
  function analyserImpactProduits(campagne, importsCampagne, produitsRows) {
    // Accepte aussi bien une ligne brute campagnes_nexus (produits_concernes)
    // qu'un objet déjà transformé par analyserImpactCampagne (produitsConcernes).
    const produits = campagne.produitsConcernes || campagne.produits_concernes || [];
    if (!produits.length) {
      return { disponible: false, message: "Aucun produit précis associé à cette promotion — l'impact par produit ne peut pas être calculé." };
    }
    const importAvant = (importsCampagne || []).find(i => i.phase === 'avant');
    const importPendant = (importsCampagne || []).find(i => i.phase === 'pendant');
    if (!importAvant || !importPendant) {
      const manquants = [!importAvant && 'avant', !importPendant && 'pendant'].filter(Boolean).join(' et ');
      return { disponible: false, message: `Import ${manquants} manquant — importez les ventes du produit via Import > Campagne NEXUS pour mesurer l'impact par produit.` };
    }

    const trouverLigne = (article, imp) => {
      const lignes = (produitsRows || []).filter(p => p.article === article && p.periode_debut === imp.periode_debut && p.periode_fin === imp.periode_fin);
      if (!lignes.length) return null;
      return {
        quantite: lignes.reduce((s, l) => s + (Number(l.quantite) || 0), 0),
        ca: lignes.reduce((s, l) => s + (Number(l.ca) || 0), 0),
        marge: lignes.reduce((s, l) => s + (Number(l.marge) || 0), 0),
      };
    };

    const resultats = produits.map(article => {
      const avant = trouverLigne(article, importAvant);
      const pendant = trouverLigne(article, importPendant);
      if (!avant || !pendant) {
        return { article, disponible: false, message: `« ${article} » introuvable dans l'import ${!avant ? 'avant' : 'pendant'} — vérifiez que l'article importé porte exactement ce nom.` };
      }
      return {
        article, disponible: true,
        quantiteAvant: avant.quantite, quantitePendant: pendant.quantite,
        caAvant: avant.ca, caPendant: pendant.ca,
        margeAvant: avant.marge, margePendant: pendant.marge,
        evolutionVolume: evolution(pendant.quantite, avant.quantite),
        evolutionMarge: evolution(pendant.marge, avant.marge),
      };
    });

    return { disponible: resultats.some(r => r.disponible), resultats };
  }

  // ------------------------------------------------------------
  // Panier moyen boutique (25/07/2026) — même logique avant/pendant/après
  // que analyserImpactCampagne, mais lue depuis la série séparée
  // panier_moyen_quotidien (import dédié via Import > Panier moyen,
  // export Decenium Compta > Panier Moyen). Précision importante :
  // cette série est BOUTIQUE UNIQUEMENT (confirmé par Frédéric le
  // 25/07/2026) — jamais mélangée avec le CA piste. Gated comme le
  // reste : pas de résultat sans assez de jours des deux côtés.
  // ------------------------------------------------------------
  function analyserImpactPanierMoyen(campagne, panierMoyenRows) {
    // Accepte aussi bien une ligne brute campagnes_nexus (date_debut/date_fin)
    // qu'un objet déjà transformé par analyserImpactCampagne (dateDebut/dateFin).
    const dateDebut = campagne.dateDebut || campagne.date_debut;
    const dateFin = campagne.dateFin || campagne.date_fin;
    const rows = (panierMoyenRows || []).filter(r => r.nb_tickets !== null && r.nb_tickets !== undefined);
    const avant = rows.filter(r => r.date < dateDebut);
    const pendant = rows.filter(r => r.date >= dateDebut && r.date <= dateFin);
    const apres = rows.filter(r => r.date > dateFin);

    if (!rows.length) {
      return { disponible: false, message: "Aucune donnée de panier moyen importée — importez l'export Decenium (Compta > Panier Moyen) via Import > Panier moyen." };
    }

    if (avant.length < MIN_JOURS_COMPARABLES || pendant.length < MIN_JOURS_COMPARABLES) {
      return {
        disponible: false,
        nbAvant: avant.length, nbPendant: pendant.length, nbApres: apres.length,
        message: `Panier moyen non encore mesurable — il faut au moins ${MIN_JOURS_COMPARABLES} jours avant et ${MIN_JOURS_COMPARABLES} jours pendant la période (actuellement ${avant.length} avant, ${pendant.length} pendant).`,
      };
    }

    const nbTickets = r => r.nb_tickets;
    const panierTtc = r => r.panier_moyen_ttc;
    const avecTtcAvant = avant.filter(r => r.panier_moyen_ttc !== null && r.panier_moyen_ttc !== undefined);
    const avecTtcPendant = pendant.filter(r => r.panier_moyen_ttc !== null && r.panier_moyen_ttc !== undefined);
    const avecTtcApres = apres.filter(r => r.panier_moyen_ttc !== null && r.panier_moyen_ttc !== undefined);

    const moyTicketsAvant = moyenne(avant.map(nbTickets));
    const moyTicketsPendant = moyenne(pendant.map(nbTickets));
    const moyTicketsApres = apres.length >= MIN_JOURS_COMPARABLES ? moyenne(apres.map(nbTickets)) : null;

    const moyPanierAvant = avecTtcAvant.length ? moyenne(avecTtcAvant.map(panierTtc)) : null;
    const moyPanierPendant = avecTtcPendant.length ? moyenne(avecTtcPendant.map(panierTtc)) : null;
    const moyPanierApres = avecTtcApres.length >= MIN_JOURS_COMPARABLES ? moyenne(avecTtcApres.map(panierTtc)) : null;

    return {
      disponible: true,
      nbAvant: avant.length, nbPendant: pendant.length, nbApres: apres.length,
      moyTicketsAvant, moyTicketsPendant, moyTicketsApres,
      evolutionTicketsPendant: evolution(moyTicketsPendant, moyTicketsAvant),
      evolutionTicketsApres: moyTicketsApres !== null ? evolution(moyTicketsApres, moyTicketsAvant) : null,
      moyPanierAvant, moyPanierPendant, moyPanierApres,
      evolutionPanierPendant: (moyPanierAvant !== null && moyPanierPendant !== null) ? evolution(moyPanierPendant, moyPanierAvant) : null,
      evolutionPanierApres: (moyPanierAvant !== null && moyPanierApres !== null) ? evolution(moyPanierApres, moyPanierAvant) : null,
    };
  }

  // Analyse toutes les campagnes connues, la plus récente en premier.
  function analyserCampagnes(campagnesRows, joursAgreges) {
    return (campagnesRows || [])
      .slice()
      .sort((a, b) => (a.date_debut > b.date_debut ? -1 : (a.date_debut < b.date_debut ? 1 : 0)))
      .map(c => analyserImpactCampagne(c, joursAgreges));
  }

  // Texte du Conseiller pour une campagne analysée — ne dit jamais plus
  // que ce que la mesure permet. Ne se prononce sur l'objectif visé que
  // lorsque l'objectif est "augmenter_ca" (le seul mesurable avec le CA
  // global) ; pour tout autre objectif, le dit explicitement non mesurable.
  function texteConseillerCampagne(impact) {
    const nom = impact.nom;
    if (!impact.disponible) {
      return `La promotion « ${nom} » vient d'être déclarée. ${impact.message}`;
    }
    const pct = (v) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1).replace('.', ',')} %`;
    let texte = `La promotion « ${nom} » a fait évoluer le CA ${TYPE_CAMPAGNE_LABELS[impact.type].toLowerCase()} de ${pct(impact.evolutionPendant)} pendant la période, comparé aux jours qui l'ont précédée. `;
    if (impact.evolutionApres !== null) {
      if (impact.evolutionApres < 0 && impact.evolutionPendant > 0) {
        texte += `Après la fin de la promotion, le CA est revenu ${pct(impact.evolutionApres)} sous le niveau d'avant — un signe possible d'achats avancés plutôt que d'un vrai surplus de fréquentation. `;
      } else {
        texte += `Après la promotion, le CA se situe à ${pct(impact.evolutionApres)} du niveau d'avant. `;
      }
    }
    if (impact.objectif === 'augmenter_ca') {
      texte += impact.evolutionPendant > 0
        ? "L'objectif « augmenter le CA » va dans le bon sens sur cette mesure."
        : "L'objectif « augmenter le CA » n'est pas confirmé par cette mesure.";
    } else {
      const libelle = impact.objectif === 'autre' ? (impact.objectifLibre || 'objectif personnalisé') : OBJECTIF_CAMPAGNE_LABELS[impact.objectif];
      texte += `L'objectif visé (${libelle}) n'est pas encore mesurable automatiquement — seul le CA global l'est à ce jour.`;
    }
    return texte;
  }

  global.NexusCampagnes = {
    TYPE_CAMPAGNE_LABELS, NATURE_CAMPAGNE_LABELS, OBJECTIF_CAMPAGNE_LABELS, MIN_JOURS_COMPARABLES,
    valeurCampagne, analyserImpactCampagne, analyserCampagnes, analyserImpactProduits, analyserImpactPanierMoyen,
    texteConseillerCampagne, moyenne, evolution,
  };
})(typeof window !== 'undefined' ? window : globalThis);
