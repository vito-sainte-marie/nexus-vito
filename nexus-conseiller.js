// ============================================================
// NEXUS Conseiller — moteur unique de génération ET de fusion des
// priorités NEXUS.
//
// Origine (26/07/2026, demande de Frédéric) : "et si le CIN récupérait
// toutes les décisions prises par les différents moteurs et faisait un
// tri et le remonterait au Conseiller NEXUS dans App, comme ça le
// Conseiller NEXUS paraîtrait plus vivant... j'aurais aimé qu'il donne
// trois déductions prioritaires sur l'ensemble des moteurs en fonction
// des priorités et de façon aléatoire." Avant ce fichier, le Conseiller
// de l'accueil ne regardait que le moteur Produits/CA (R2/R3/R4) — ce
// même moteur existait en plus en 3 copies quasi identiques (App-v1,
// Cockpit, Centre d'Intelligence), avec un risque de divergence des
// seuils/formules exactement comme celui déjà corrigé pour les périodes
// (nexus-periodes.js), l'Indice (nexus-indice.js) et la marge
// (nexus-marge.js). Ce fichier :
//   1) fournit calculerCandidatsProduits(), la source unique du moteur
//      R2/R3/R4, pour que App-v1 et Cockpit cessent de le recopier ;
//   2) fournit les normaliseurs et la fonction de fusion qui permettent
//      au Conseiller de l'accueil d'agréger plusieurs moteurs (Produits,
//      Marge+, Tempo, Qualité/Caisse via advisor_messages) et d'en
//      sélectionner 3, avec une rotation aléatoire mais reproductible
//      entre priorités de même rang (jamais un pur classement figé par
//      impact_eur, qui ferait toujours remonter le même article).
//
// Dépend de nexus-periodes.js — l'inclure AVANT ce fichier dans la page :
//   <script src="nexus-periodes.js"></script>
//   <script src="nexus-conseiller.js"></script>
// ============================================================

(function (global) {
  // ------------------------------------------------------------
  // 1) Moteur Produits/CA (R2-BAISSE / R3-HAUSSE / R4-RENFORT-A) — source
  //    unique, reprise à l'identique de NEXUS-Cockpit-v2.html (version la
  //    plus complète : situation/contexte/analyse/consequence/
  //    recommandation/impact + ca_reference/periode_reference pour le
  //    bouclage). Le geste concret proposé dépend du type de rayon
  //    (facing / stock / support / production / comptoir / présentoir) —
  //    un gaz stocké en cage ou une carte prépayée dématérialisée ne se
  //    gèrent pas comme une bière en linéaire.
  // ------------------------------------------------------------
  function typeActionPourCategorie(categorie) {
    const c = (categorie || '').toLowerCase();
    if (c.includes('gaz')) return 'stock';
    if (c.includes('carte') || c.includes('prépayé') || c.includes('prepaye') || c.includes('transcash') || c.includes('pcs')) return 'support';
    if (c.includes('pain') || c.includes('patisserie') || c.includes('pâtisserie') || c.includes('viennoiserie') || c.includes('sandwich') || c.includes('snack')) return 'production';
    if (c.includes('tabac') || c.includes('cigarette') || c.includes('paquet de')) return 'comptoir';
    if (c.includes('presse')) return 'presentoir';
    return 'facing';
  }

  const LANGAGE_ACTION = {
    facing: {
      analyseAgir: "Une référence à ce niveau de contribution mérite un facing à la hauteur de son poids réel.",
      recoAgir: a => `Je recommande de vérifier et renforcer le facing de ${a}.`,
      consAgir: m => `Un sous-dimensionnement de facing sur cette référence représente un risque estimé à ${m} €.`,
      recoHausse: a => `Il serait utile de renforcer le facing de ${a} avant le prochain réapprovisionnement.`,
      recoBaisse: a => `Vérifiez la présence en rayon de ${a} avant toute décision.`,
    },
    stock: {
      analyseAgir: "Une référence à ce niveau de contribution ne doit jamais être en rupture en dépôt — elle n'est pas exposée en rayon comme les autres.",
      recoAgir: a => `Je recommande de vérifier le stock disponible en dépôt/cage pour ${a}.`,
      consAgir: m => `Une rupture de stock sur cette référence représente un risque estimé à ${m} €.`,
      recoHausse: a => `Sécurisez davantage de stock de ${a} avant le prochain réapprovisionnement.`,
      recoBaisse: a => `Vérifiez le stock en dépôt/cage de ${a} avant toute décision.`,
    },
    support: {
      analyseAgir: "Une référence à ce niveau de contribution dépend surtout de la disponibilité du support et de son activation en caisse, pas d'un emplacement en rayon.",
      recoAgir: a => `Je recommande de vérifier le stock de cartes et la bonne activation en caisse pour ${a}.`,
      consAgir: m => `Une indisponibilité de ce support représente un risque estimé à ${m} €.`,
      recoHausse: a => `Prévoyez davantage de support et d'activation pour ${a} avant le prochain réapprovisionnement.`,
      recoBaisse: a => `Vérifiez la disponibilité du support et son activation en caisse pour ${a} avant toute décision.`,
    },
    production: {
      analyseAgir: "Une référence à ce niveau de contribution dépend surtout de la quantité produite ou commandée chaque jour — c'est un produit frais, pas un facing.",
      recoAgir: a => `Je recommande d'ajuster la quantité commandée ou produite de ${a} au niveau réel de la demande.`,
      consAgir: m => `Une quantité insuffisante sur cette référence fraîche représente un risque estimé à ${m} €.`,
      recoHausse: a => `Augmentez la quantité commandée ou produite de ${a} avant le prochain réapprovisionnement.`,
      recoBaisse: a => `Vérifiez si la quantité produite ou commandée de ${a} a été réduite avant toute décision.`,
    },
    comptoir: {
      analyseAgir: "Une référence à ce niveau de contribution doit rester visible et disponible au comptoir en priorité.",
      recoAgir: a => `Je recommande de vérifier la disponibilité au comptoir de ${a}.`,
      consAgir: m => `Une rupture au comptoir sur cette référence représente un risque estimé à ${m} €.`,
      recoHausse: a => `Garantissez la disponibilité au comptoir de ${a} avant le prochain réapprovisionnement.`,
      recoBaisse: a => `Vérifiez la disponibilité au comptoir de ${a} avant toute décision.`,
    },
    presentoir: {
      analyseAgir: "Une référence à ce niveau de contribution mérite une bonne visibilité sur le présentoir.",
      recoAgir: a => `Je recommande de vérifier l'emplacement de ${a} sur le présentoir.`,
      consAgir: m => `Un mauvais emplacement sur cette référence représente un risque estimé à ${m} €.`,
      recoHausse: a => `Améliorez l'emplacement de ${a} sur le présentoir avant le prochain réapprovisionnement.`,
      recoBaisse: a => `Vérifiez l'emplacement de ${a} sur le présentoir avant toute décision.`,
    },
  };

  // rowsBrut : lignes `products` déjà filtrées des produits d'appel (même
  // filtrage que partout ailleurs). Retourne le tableau de candidats — la
  // page appelante gère elle-même sa propre exclusion des candidate_id
  // déjà présents dans journal_decisions (VALIDEES_SITE), comme avant.
  function calculerCandidatsProduits(rowsBrut) {
    const { periodeAffichage, rowsAffichage, paire, rowsPaireActuelle, rowsPairePrecedente } = global.NexusPeriodes.analyserPeriodes(rowsBrut);
    if (!periodeAffichage) return [];

    const fmt = v => Math.round(v).toLocaleString('fr-FR');
    const caTotalParRayon = {};
    rowsAffichage.forEach(r => { caTotalParRayon[r.categorie] = (caTotalParRayon[r.categorie] || 0) + (r.ca || 0); });
    const precedentParArticle = {};
    rowsPairePrecedente.forEach(r => {
      const cle = r.categorie + '|' + r.article;
      precedentParArticle[cle] = (precedentParArticle[cle] || 0) + (r.ca || 0);
    });

    const candidats = [];
    // R4-RENFORT-A : contribution forte au CA de son rayon — évalué sur la
    // période affichée, sans besoin d'historique comparatif.
    rowsAffichage.forEach(p => {
      const caRayon = caTotalParRayon[p.categorie] || 0;
      const contribution = caRayon > 0 ? p.ca / caRayon : 0;
      const cle = p.categorie + '|' + p.article;
      if (contribution >= 0.15 && p.ca > 0) {
        const lang = LANGAGE_ACTION[typeActionPourCategorie(p.categorie)];
        candidats.push({
          etat: '🔥 À AGIR', rule_id: 'R4-RENFORT-A', article: p.article,
          situation: `${p.article} représente ${(contribution * 100).toFixed(1)} % du chiffre d'affaires du rayon ${p.categorie}.`,
          contexte: "Cette contribution est calculée sur l'ensemble des références du rayon.",
          analyse: lang.analyseAgir,
          consequence: lang.consAgir(fmt(p.ca)),
          recommandation: lang.recoAgir(p.article),
          impact: `Vous sécurisez environ ${fmt(p.ca)} € de chiffre d'affaires déjà généré par cette référence.`,
          candidate_id: `LIVE-R4-${cle}`, impact_eur: p.ca,
          categorie: p.categorie,
          ca_reference: p.ca, periode_reference_debut: periodeAffichage.debut, periode_reference_fin: periodeAffichage.fin,
        });
      }
    });
    // R3-HAUSSE / R2-BAISSE : évolution mesurée uniquement sur la paire de
    // périodes comparables (jamais sur la période affichée seule si elle
    // n'en fait pas partie).
    if (paire) {
      rowsPaireActuelle.forEach(p => {
        const cle = p.categorie + '|' + p.article;
        const caPrec = precedentParArticle[cle];
        const evolution = (caPrec && caPrec > 0) ? (p.ca - caPrec) / caPrec : null;
        if (evolution === null) return;
        if (evolution >= 0.20) {
          const gain = Math.max(p.ca - caPrec, 0);
          const lang = LANGAGE_ACTION[typeActionPourCategorie(p.categorie)];
          candidats.push({
            etat: '📈 OPPORTUNITÉ', rule_id: 'R3-HAUSSE', article: p.article,
            situation: `Les ventes de ${p.article} progressent de ${(evolution * 100).toFixed(1)} % sur la période.`,
            contexte: "Cette progression est mesurée entre deux périodes de durée comparable.",
            analyse: "Cette dynamique dépasse une croissance ordinaire.",
            consequence: "Cette croissance peut être amplifiée si l'offre suit la demande.",
            recommandation: lang.recoHausse(p.article),
            impact: `Vous avez gagné environ ${fmt(gain)} € sur cette référence depuis la période précédente.`,
            candidate_id: `LIVE-R3-${cle}`, impact_eur: gain,
            categorie: p.categorie,
            ca_reference: p.ca, periode_reference_debut: paire.actuelle.debut, periode_reference_fin: paire.actuelle.fin,
          });
        }
        if (evolution <= -0.30) {
          const perte = Math.max(caPrec - p.ca, 0);
          const lang = LANGAGE_ACTION[typeActionPourCategorie(p.categorie)];
          candidats.push({
            etat: '🟡 À SURVEILLER', rule_id: 'R2-BAISSE', article: p.article,
            situation: `Les ventes de ${p.article} chutent de ${(evolution * 100).toFixed(1)} % sur la période.`,
            contexte: "NEXUS ne dispose pas de la donnée de stock pour cette référence.",
            analyse: "Je ne peux pas encore conclure à une vraie tendance sans vérification terrain.",
            consequence: "Une rupture non détectée expliquerait aussi bien cette baisse qu'un désintérêt réel.",
            recommandation: lang.recoBaisse(p.article),
            impact: "Vérification demandée — aucune conclusion tant que le stock n'est pas confirmé.",
            candidate_id: `LIVE-R2-${cle}`, impact_eur: perte,
            categorie: p.categorie,
            ca_reference: p.ca, periode_reference_debut: paire.actuelle.debut, periode_reference_fin: paire.actuelle.fin,
          });
        }
      });
    }
    candidats.sort((a, b) => b.impact_eur - a.impact_eur);
    return candidats;
  }

  // ------------------------------------------------------------
  // 2) Fusion cross-moteurs pour le Conseiller de l'accueil (26/07/2026).
  //
  // Chaque moteur a un format natif différent (candidate_id/impact_eur
  // pour Produits/Marge+/Tempo, priority texte pour advisor_messages) et
  // surtout une notion d'urgence non comparable en euros (le meilleur jour
  // Tempo à renforcer n'a pas d'impact_eur réel, un écart de caisse non
  // justifié encore moins) — trier globalement par impact_eur avantagerait
  // toujours le même moteur. La fusion se fait donc par RANG (0 = le plus
  // urgent), un rang partagé entre tous les moteurs, jamais par montant.
  // ------------------------------------------------------------
  const RANG_ADVISOR = { critique: 0, haute: 1, a_surveiller: 2, normale: 3, information: 4 };
  const RANG_PRODUIT = { '🔥 À AGIR': 0, '📈 OPPORTUNITÉ': 2, '🟡 À SURVEILLER': 2 };

  // Convertit un candidat Produits (calculerCandidatsProduits) au format
  // d'affichage commun du Conseiller (constat/consequence/preuve) —
  // validable : ces candidats utilisent le même candidate_id LIVE-Rn que
  // journal_decisions, donc la case à cocher peut écrire directement dedans.
  function normaliserProduit(c) {
    return {
      candidate_id: c.candidate_id, ruleId: c.rule_id, rang: RANG_PRODUIT[c.etat] != null ? RANG_PRODUIT[c.etat] : 2,
      moteur: 'produits',
      etat: c.etat, impact_eur: c.impact_eur, article: c.article, categorie: c.categorie,
      constat: c.situation, consequence: c.analyse, recommandation: c.recommandation, preuve: c.impact,
      cible: `NEXUS-Produits-v1.html?article=${encodeURIComponent(c.article)}`,
      validable: true,
      ca_reference: c.ca_reference, periode_reference_debut: c.periode_reference_debut, periode_reference_fin: c.periode_reference_fin,
    };
  }

  // Convertit un candidat Marge+ (même schéma que NEXUS-Scanner-v1.html,
  // règle R5-MARGE-ECART) — également validable, même candidate_id que
  // Scanner (LIVE-R5-...), donc reste cohérent si validé depuis l'accueil
  // ou depuis Scanner.
  function normaliserMarge(c) {
    return {
      candidate_id: c.candidate_id, ruleId: 'R5-MARGE-ECART', rang: 2,
      moteur: 'marge',
      etat: c.etat, impact_eur: c.impact_eur, article: c.article, categorie: c.categorie,
      constat: c.situation, consequence: c.analyse || c.contexte, recommandation: c.recommandation, preuve: c.impact,
      cible: 'NEXUS-Scanner-v1.html',
      validable: true,
      ca_reference: c.ca_reference, periode_reference_debut: c.periode_reference_debut, periode_reference_fin: c.periode_reference_fin,
    };
  }

  // Convertit la décision Tempo (un seul jour à la fois, jamais une liste)
  // — non validable depuis l'accueil : NEXUS Tempo valide cette décision
  // via une mission dédiée (candidate_id = id de mission, format différent
  // de LIVE-Rn) — dupliquer cette écriture ici créerait deux identités
  // différentes pour la même décision. Le lien renvoie donc vers Tempo,
  // où la validation réelle a lieu.
  function normaliserTempo(jourARenforcer, message) {
    return {
      candidate_id: `TEMPO-${jourARenforcer.nom}`, ruleId: 'R6-TEMPO-JOUR', rang: 2,
      moteur: 'tempo',
      etat: '🗓️ TEMPO', impact_eur: 0, article: null, categorie: 'Rythme hebdomadaire',
      constat: message, consequence: '', recommandation: 'Ouvrir NEXUS Tempo pour le détail complet et créer la mission de contrôle.',
      preuve: null, cible: 'NEXUS-Tempo-v1.html', validable: false,
    };
  }

  // Convertit un message advisor_messages (Qualité/Caisse aujourd'hui) —
  // non validable depuis l'accueil : sa résolution suit son propre statut
  // (nouveau/résolu/expiré) dans advisor_messages, pas journal_decisions —
  // écrire dedans depuis ici créerait une mémoire parallèle incohérente.
  // `domaine` sert uniquement à choisir une destination plausible.
  const CIBLE_PAR_DOMAINE_ADVISOR = { caisse: 'NEXUS-Verify-v1.html', qualite: 'NEXUS-Missions-v1.html' };
  function normaliserAdvisor(message) {
    const domaine = message.domaine || '';
    return {
      candidate_id: `ADV-${message.id}`, ruleId: message.code || null, rang: RANG_ADVISOR[message.priority] != null ? RANG_ADVISOR[message.priority] : 3,
      moteur: 'advisor',
      etat: '📋 SIGNAL', impact_eur: 0, article: null, categorie: message.nomRegle || domaine,
      constat: message.message_text, consequence: '', recommandation: 'Vérifier ce point dans l’écran concerné.',
      preuve: `Confiance ${message.confidence_level || '—'} · détecté le ${new Date(message.generated_at).toLocaleDateString('fr-FR')}`,
      cible: CIBLE_PAR_DOMAINE_ADVISOR[domaine] || 'NEXUS-Cockpit-v2.html',
      validable: false,
    };
  }

  // Graine du jour : stable pour un même site à la même date (la rotation
  // ne bouge donc pas à chaque rechargement de page dans la même journée),
  // mais change chaque jour — c'est ce qui donne l'effet "vivant" demandé
  // par Frédéric sans jamais reclasser une urgence réelle derrière une
  // priorité plus faible (la rotation ne mélange qu'à rang égal).
  function genererGraineJour(site) {
    const cle = `${site || ''}|${new Date().toISOString().slice(0, 10)}`;
    let h = 0;
    for (let i = 0; i < cle.length; i++) { h = (Math.imul(31, h) + cle.charCodeAt(i)) | 0; }
    return h >>> 0;
  }
  function mulberry32(graine) {
    let a = graine;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function melangerAvecGraine(liste, graine) {
    const copie = liste.slice();
    const rng = mulberry32(graine);
    for (let i = copie.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [copie[i], copie[j]] = [copie[j], copie[i]];
    }
    return copie;
  }

  // Fusionne des listes déjà normalisées (candidat.rang et candidat.moteur
  // requis) en garantissant la diversité entre moteurs — correctif du
  // 27/07/2026 (Frédéric : "le conseiller me donne encore 3 décisions sur
  // les produits"). Constat vérifié sur les données réelles de Vito
  // Sainte-Marie : la règle R4-RENFORT-A (contribution ≥15 % du CA de sa
  // sous-catégorie) qualifie facilement plus de 100 articles le même jour
  // dès que les catégories sont étroites (ex : une sous-catégorie à 2
  // références où l'une pèse mécaniquement plus de 15 %) — un simple tri
  // par rang laissait donc le moteur Produits/CA saturer systématiquement
  // les 3 emplacements avant même de regarder Marge+/Tempo/advisor. La
  // sélection pioche maintenant au maximum 1 candidat par moteur à chaque
  // tour, en commençant par le moteur dont le meilleur candidat restant a
  // le rang le plus urgent — un même moteur ne prend un 2e emplacement que
  // s'il reste de la place après qu'aucun autre moteur n'ait plus rien à
  // proposer (jamais un cas aujourd'hui avec 3 moteurs ou plus actifs).
  function fusionnerEtSelectionner(listes, options) {
    const opts = options || {};
    const n = opts.n || 3;
    const graine = genererGraineJour(opts.site);

    const parMoteur = {};
    [].concat(...listes.filter(Boolean)).forEach(c => {
      const m = c.moteur || 'autre';
      (parMoteur[m] = parMoteur[m] || []).push(c);
    });

    // Une file par moteur, déjà triée par rang puis mélangée à rang égal
    // (même logique de rotation qu'avant, appliquée moteur par moteur).
    const files = Object.keys(parMoteur).map(m => {
      const parRang = {};
      parMoteur[m].forEach(c => { const r = c.rang != null ? c.rang : 5; (parRang[r] = parRang[r] || []).push(c); });
      const rangsTries = Object.keys(parRang).map(Number).sort((a, b) => a - b);
      const file = [];
      rangsTries.forEach(r => { melangerAvecGraine(parRang[r], graine + r).forEach(c => file.push(c)); });
      return file;
    });

    const resultat = [];
    while (resultat.length < n && files.some(f => f.length)) {
      // À chaque tour, on retente le moteur le plus urgent en premier —
      // mais un seul candidat par moteur et par tour, d'où la diversité.
      files.sort((a, b) => (a.length ? a[0].rang : 99) - (b.length ? b[0].rang : 99));
      for (let i = 0; i < files.length && resultat.length < n; i++) {
        if (files[i].length) resultat.push(files[i].shift());
      }
    }
    return resultat;
  }

  global.NexusConseiller = {
    typeActionPourCategorie, LANGAGE_ACTION, calculerCandidatsProduits,
    normaliserProduit, normaliserMarge, normaliserTempo, normaliserAdvisor,
    fusionnerEtSelectionner, genererGraineJour,
  };
})(window);
