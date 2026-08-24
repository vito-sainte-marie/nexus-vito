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

  // verdictAgir/Hausse/Baisse + impactAgir/Hausse/Baisse ajoutés le
  // 27/07/2026 (demande de Frédéric, sur maquette fournie) — le verdict
  // est le diagnostic en une phrase qui ouvre la carte du Conseiller
  // ("Chanflor Thé Pêche est sous-exposé."), l'impact est le bénéfice
  // attendu de l'action (pas un risque en euros — celui-ci reste dans
  // "Voir les preuves"), formulés selon le geste concret propre à chaque
  // type de rayon comme le reste de LANGAGE_ACTION.
  //
  // decisionAgir/Hausse/Baisse ajoutés le 27/07/2026 (demande de Frédéric,
  // deuxième passe) : "le Conseiller ne décrit jamais l'entreprise, il
  // décrit uniquement ce qu'il faut faire, pourquoi, ce que cela va
  // apporter" — la carte doit désormais s'ouvrir sur cette phrase à
  // l'impératif (la décision), jamais sur le diagnostic. verdictAgir et
  // recoAgir restent utilisés (fondus dans "pourquoi" par les
  // normaliseurs), mais decisionAgir en est la reformulation directe à
  // l'impératif, sans "je recommande de/d'".
  const LANGAGE_ACTION = {
    facing: {
      analyseAgir: "Une référence à ce niveau de contribution mérite un facing à la hauteur de son poids réel.",
      recoAgir: a => `Je recommande de vérifier et renforcer le facing de ${a}.`,
      consAgir: m => `Un sous-dimensionnement de facing sur cette référence représente un risque estimé à ${m} €.`,
      recoHausse: a => `Il serait utile de renforcer le facing de ${a} avant le prochain réapprovisionnement.`,
      recoBaisse: a => `Vérifiez la présence en rayon de ${a} avant toute décision.`,
      verdictAgir: a => `${a} est sous-exposé.`,
      verdictHausse: a => `${a} est en forte progression.`,
      verdictBaisse: a => `${a} est en repli à vérifier.`,
      impactAgir: "Disponibilité renforcée et potentiel de ventes accru.",
      impactHausse: "Dynamique commerciale prolongée sans rupture.",
      impactBaisse: "Cause de la baisse identifiée avant qu'elle ne s'aggrave.",
      decisionAgir: a => `Renforcez le facing de ${a} dès le prochain réassort.`,
      decisionHausse: a => `Renforcez le facing de ${a} avant le prochain réapprovisionnement.`,
      decisionBaisse: a => `Vérifiez la présence en rayon de ${a}.`,
    },
    stock: {
      analyseAgir: "Une référence à ce niveau de contribution ne doit jamais être en rupture en dépôt — elle n'est pas exposée en rayon comme les autres.",
      recoAgir: a => `Je recommande de vérifier le stock disponible en dépôt/cage pour ${a}.`,
      consAgir: m => `Une rupture de stock sur cette référence représente un risque estimé à ${m} €.`,
      recoHausse: a => `Sécurisez davantage de stock de ${a} avant le prochain réapprovisionnement.`,
      recoBaisse: a => `Vérifiez le stock en dépôt/cage de ${a} avant toute décision.`,
      verdictAgir: a => `${a} est à risque de rupture de stock.`,
      verdictHausse: a => `${a} est en forte progression.`,
      verdictBaisse: a => `${a} est en repli à vérifier.`,
      impactAgir: "Rupture évitée et continuité des ventes en dépôt.",
      impactHausse: "Approvisionnement sécurisé pour prolonger la dynamique.",
      impactBaisse: "Cause de la baisse identifiée avant qu'elle ne s'aggrave.",
      decisionAgir: a => `Vérifiez le stock disponible en dépôt/cage pour ${a}.`,
      decisionHausse: a => `Sécurisez davantage de stock de ${a} avant le prochain réapprovisionnement.`,
      decisionBaisse: a => `Vérifiez le stock en dépôt/cage de ${a}.`,
    },
    support: {
      analyseAgir: "Une référence à ce niveau de contribution dépend surtout de la disponibilité du support et de son activation en caisse, pas d'un emplacement en rayon.",
      recoAgir: a => `Je recommande de vérifier le stock de cartes et la bonne activation en caisse pour ${a}.`,
      consAgir: m => `Une indisponibilité de ce support représente un risque estimé à ${m} €.`,
      recoHausse: a => `Prévoyez davantage de support et d'activation pour ${a} avant le prochain réapprovisionnement.`,
      recoBaisse: a => `Vérifiez la disponibilité du support et son activation en caisse pour ${a} avant toute décision.`,
      verdictAgir: a => `${a} dépend d'un support fragile.`,
      verdictHausse: a => `${a} est en forte progression.`,
      verdictBaisse: a => `${a} est en repli à vérifier.`,
      impactAgir: "Continuité du service et vente non interrompue.",
      impactHausse: "Support et activation prolongés pour ne pas casser la dynamique.",
      impactBaisse: "Cause de la baisse identifiée avant qu'elle ne s'aggrave.",
      decisionAgir: a => `Vérifiez le stock de cartes et la bonne activation en caisse pour ${a}.`,
      decisionHausse: a => `Prévoyez davantage de support et d'activation pour ${a} avant le prochain réapprovisionnement.`,
      decisionBaisse: a => `Vérifiez la disponibilité du support et son activation en caisse pour ${a}.`,
    },
    production: {
      analyseAgir: "Une référence à ce niveau de contribution dépend surtout de la quantité produite ou commandée chaque jour — c'est un produit frais, pas un facing.",
      recoAgir: a => `Je recommande d'ajuster la quantité commandée ou produite de ${a} au niveau réel de la demande.`,
      consAgir: m => `Une quantité insuffisante sur cette référence fraîche représente un risque estimé à ${m} €.`,
      recoHausse: a => `Augmentez la quantité commandée ou produite de ${a} avant le prochain réapprovisionnement.`,
      recoBaisse: a => `Vérifiez si la quantité produite ou commandée de ${a} a été réduite avant toute décision.`,
      verdictAgir: a => `${a} est sous-approvisionné.`,
      verdictHausse: a => `${a} est en forte progression.`,
      verdictBaisse: a => `${a} est en repli à vérifier.`,
      impactAgir: "Quantité ajustée à la demande réelle, moins de perte ou de rupture.",
      impactHausse: "Production maintenue au niveau de la demande réelle.",
      impactBaisse: "Cause de la baisse identifiée avant qu'elle ne s'aggrave.",
      decisionAgir: a => `Ajustez la quantité commandée ou produite de ${a} au niveau réel de la demande.`,
      decisionHausse: a => `Augmentez la quantité commandée ou produite de ${a} avant le prochain réapprovisionnement.`,
      decisionBaisse: a => `Vérifiez si la quantité produite ou commandée de ${a} a été réduite.`,
    },
    comptoir: {
      analyseAgir: "Une référence à ce niveau de contribution doit rester visible et disponible au comptoir en priorité.",
      recoAgir: a => `Je recommande de vérifier la disponibilité au comptoir de ${a}.`,
      consAgir: m => `Une rupture au comptoir sur cette référence représente un risque estimé à ${m} €.`,
      recoHausse: a => `Garantissez la disponibilité au comptoir de ${a} avant le prochain réapprovisionnement.`,
      recoBaisse: a => `Vérifiez la disponibilité au comptoir de ${a} avant toute décision.`,
      verdictAgir: a => `${a} est sous-exposé au comptoir.`,
      verdictHausse: a => `${a} est en forte progression.`,
      verdictBaisse: a => `${a} est en repli à vérifier.`,
      impactAgir: "Disponibilité maintenue au comptoir, vente non interrompue.",
      impactHausse: "Dynamique commerciale prolongée sans rupture.",
      impactBaisse: "Cause de la baisse identifiée avant qu'elle ne s'aggrave.",
      decisionAgir: a => `Vérifiez la disponibilité au comptoir de ${a}.`,
      decisionHausse: a => `Garantissez la disponibilité au comptoir de ${a} avant le prochain réapprovisionnement.`,
      decisionBaisse: a => `Vérifiez la disponibilité au comptoir de ${a}.`,
    },
    presentoir: {
      analyseAgir: "Une référence à ce niveau de contribution mérite une bonne visibilité sur le présentoir.",
      recoAgir: a => `Je recommande de vérifier l'emplacement de ${a} sur le présentoir.`,
      consAgir: m => `Un mauvais emplacement sur cette référence représente un risque estimé à ${m} €.`,
      recoHausse: a => `Améliorez l'emplacement de ${a} sur le présentoir avant le prochain réapprovisionnement.`,
      recoBaisse: a => `Vérifiez l'emplacement de ${a} sur le présentoir avant toute décision.`,
      verdictAgir: a => `${a} est mal mis en avant.`,
      verdictHausse: a => `${a} est en forte progression.`,
      verdictBaisse: a => `${a} est en repli à vérifier.`,
      impactAgir: "Meilleure visibilité et vente facilitée.",
      impactHausse: "Dynamique commerciale prolongée sans rupture.",
      impactBaisse: "Cause de la baisse identifiée avant qu'elle ne s'aggrave.",
      decisionAgir: a => `Vérifiez et améliorez l'emplacement de ${a} sur le présentoir.`,
      decisionHausse: a => `Améliorez l'emplacement de ${a} sur le présentoir avant le prochain réapprovisionnement.`,
      decisionBaisse: a => `Vérifiez l'emplacement de ${a} sur le présentoir.`,
    },
  };

  // Seuils R2/R3/R4 exposés (11/08/2026, audit "philosophie/architecture",
  // Article 11) : NEXUS-Produits-v1.html a besoin d'annoter CHAQUE ligne
  // produit affichée (pas seulement les candidats qualifiés) avec le même
  // statut "🔥 À AGIR / 📈 OPPORTUNITÉ / 🟡 À SURVEILLER" — il ne peut donc
  // pas se contenter d'appeler calculerCandidatsProduits() (qui ne renvoie
  // que les candidats retenus, pas une annotation par ligne). Plutôt que de
  // laisser ce fichier recopier 0.15/0.20/-0.30 en dur une deuxième fois,
  // les seuils sont exportés ici comme source unique ; calculerCandidatsProduits
  // les utilise elle-même ci-dessous.
  const SEUIL_CONTRIBUTION_FORTE = 0.15;
  const SEUIL_HAUSSE = 0.20;
  const SEUIL_BAISSE = -0.30;

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
      if (contribution >= SEUIL_CONTRIBUTION_FORTE && p.ca > 0) {
        const lang = LANGAGE_ACTION[typeActionPourCategorie(p.categorie)];
        candidats.push({
          etat: '🔥 À AGIR', rule_id: 'R4-RENFORT-A', article: p.article,
          verdict: lang.verdictAgir(p.article),
          situation: `Cette référence génère ${(contribution * 100).toFixed(1)} % des ventes du rayon ${p.categorie}.`,
          contexte: "Cette contribution est calculée sur l'ensemble des références du rayon.",
          analyse: lang.analyseAgir,
          consequence: lang.consAgir(fmt(p.ca)),
          recommandation: lang.recoAgir(p.article),
          impactAttendu: lang.impactAgir,
          impact: `Vous sécurisez environ ${fmt(p.ca)} € de chiffre d'affaires déjà généré par cette référence.`,
          candidate_id: `LIVE-R4-${cle}`, impact_eur: p.ca,
          categorie: p.categorie,
          // contribution/evolution exposés sur le candidat depuis le
          // 08/08/2026 (retour de Frédéric, Article 11) : le CIN en a
          // besoin pour sa mise en forme (projection, texte de
          // confirmation) et ne doit plus les recalculer lui-même.
          contribution, evolution: null,
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
        if (evolution >= SEUIL_HAUSSE) {
          const gain = Math.max(p.ca - caPrec, 0);
          const lang = LANGAGE_ACTION[typeActionPourCategorie(p.categorie)];
          candidats.push({
            etat: '📈 OPPORTUNITÉ', rule_id: 'R3-HAUSSE', article: p.article,
            verdict: lang.verdictHausse(p.article),
            situation: `Les ventes progressent de ${(evolution * 100).toFixed(1)} % sur la période.`,
            contexte: "Cette progression est mesurée entre deux périodes de durée comparable.",
            analyse: "Cette dynamique dépasse une croissance ordinaire.",
            consequence: "Cette croissance peut être amplifiée si l'offre suit la demande.",
            recommandation: lang.recoHausse(p.article),
            impactAttendu: lang.impactHausse,
            impact: `Vous avez gagné environ ${fmt(gain)} € sur cette référence depuis la période précédente.`,
            candidate_id: `LIVE-R3-${cle}`, impact_eur: gain,
            categorie: p.categorie,
            contribution: null, evolution,
            ca_reference: p.ca, periode_reference_debut: paire.actuelle.debut, periode_reference_fin: paire.actuelle.fin,
          });
        }
        if (evolution <= SEUIL_BAISSE) {
          const perte = Math.max(caPrec - p.ca, 0);
          const lang = LANGAGE_ACTION[typeActionPourCategorie(p.categorie)];
          candidats.push({
            etat: '🟡 À SURVEILLER', rule_id: 'R2-BAISSE', article: p.article,
            verdict: lang.verdictBaisse(p.article),
            situation: `Les ventes chutent de ${(evolution * 100).toFixed(1)} % sur la période.`,
            contexte: "NEXUS ne dispose pas de la donnée de stock pour cette référence.",
            analyse: "Je ne peux pas encore conclure à une vraie tendance sans vérification terrain.",
            consequence: "Une rupture non détectée expliquerait aussi bien cette baisse qu'un désintérêt réel.",
            recommandation: lang.recoBaisse(p.article),
            impactAttendu: lang.impactBaisse,
            impact: "Vérification demandée — aucune conclusion tant que le stock n'est pas confirmé.",
            candidate_id: `LIVE-R2-${cle}`, impact_eur: perte,
            categorie: p.categorie,
            contribution: null, evolution,
            ca_reference: p.ca, periode_reference_debut: paire.actuelle.debut, periode_reference_fin: paire.actuelle.fin,
          });
        }
      });
    }
    candidats.sort((a, b) => b.impact_eur - a.impact_eur);
    return candidats;
  }

  // "Succès à féliciter" + vue d'ensemble des produits en baisse — extrait
  // le 11/08/2026 (audit "philosophie/architecture", Article 11) : Cockpit
  // et Brief calculaient chacun, dans une boucle locale identique, le
  // produit à la plus forte progression sur la paire de périodes
  // comparables (base ≥ 50 € pour ne pas célébrer un pourcentage gonflé
  // par un tout petit chiffre de départ) — Brief se contentait du
  // commentaire "même détection que MEILLEUR_SUCCES du Cockpit" plutôt que
  // d'appeler un moteur commun. `produitsEnBaisse` (toute évolution
  // négative, pas seulement le seuil -30 % qui déclenche R2-BAISSE) n'est
  // utilisé que par Cockpit aujourd'hui, mais reste calculé ici pour ne
  // garder qu'UNE boucle sur rowsPaireActuelle.
  function analyserEvolutionsPaire(rowsPaireActuelle, rowsPairePrecedente, options) {
    const seuilBase = (options && options.seuilBase != null) ? options.seuilBase : 50;
    let meilleurSucces = null;
    const produitsEnBaisse = [];
    const precedentParArticle = {};
    (rowsPairePrecedente || []).forEach(r => {
      const cle = r.categorie + '|' + r.article;
      precedentParArticle[cle] = (precedentParArticle[cle] || 0) + (r.ca || 0);
    });
    (rowsPaireActuelle || []).forEach(p => {
      const cle = p.categorie + '|' + p.article;
      const caPrec = precedentParArticle[cle];
      const evolution = (caPrec && caPrec > 0) ? (p.ca - caPrec) / caPrec : null;
      if (evolution === null) return;
      if (evolution > 0 && caPrec >= seuilBase) {
        if (!meilleurSucces || evolution > meilleurSucces.evolution) {
          meilleurSucces = { article: p.article, evolution, gain: Math.max(p.ca - caPrec, 0) };
        }
      }
      if (evolution < 0) {
        produitsEnBaisse.push({ article: p.article, categorie: p.categorie, evolution, perte: Math.max(caPrec - p.ca, 0) });
      }
    });
    produitsEnBaisse.sort((a, b) => a.evolution - b.evolution);
    return { meilleurSucces, produitsEnBaisse };
  }

  // Déduplication signal → action (22/08/2026, v2.227, audit "Cockpit
  // Améliorations Développeur" §6 : "Le même sujet apparaît parfois dans
  // « Signaux de risque » puis à nouveau dans « Plan d'exploitation »...
  // Un signal a un seul destin visible principal... S'il devient une
  // action, il ne doit plus occuper une seconde carte pleine taille
  // ailleurs.") Duplication réelle vérifiée dans le code avant ce lot (pas
  // une simple lecture de l'audit) : tout article R2-BAISSE (évolution
  // ≤ -30 %, `calculerCandidatsProduits`) satisfait mécaniquement le seuil
  // plus large "évolution < 0" de `produitsEnBaisse` ci-dessus — un
  // article déjà affiché comme carte d'action pleine taille dans "Plan
  // d'exploitation" pouvait donc réapparaître dans le détail de la carte
  // "📉 EN BAISSE" (Cockpit), sans lien entre les deux. Ne retire QUE les
  // articles réellement visibles à l'écran comme action MAINTENANT
  // (`actionsVisibles`, les cartes réellement affichées — pas toute la
  // file d'attente PLANS_ACTION, qui contiendrait des articles pas encore
  // montrés) — cohérent avec "Plan d'exploitation - 5 actions maximum" de
  // l'audit (§3/§15).
  function filtrerBaisseDejaEnAction(produitsEnBaisse, actionsVisibles) {
    const articlesEnAction = new Set(
      (actionsVisibles || []).filter(p => p && p.moteur === 'produits' && p.article).map(p => p.article)
    );
    const liste = (produitsEnBaisse || []).filter(p => !articlesEnAction.has(p.article));
    return { liste, nbExclus: (produitsEnBaisse || []).length - liste.length };
  }

  // Réduire le bruit des grandes listes (24/08/2026, v2.228, audit "Cockpit
  // Améliorations Développeur" §8) : "Le message « 307 produits en baisse »
  // est psychologiquement trop alarmant s'il mélange des baisses normales
  // et des baisses réellement problématiques... afficher par exemple :
  // 18 baisses significatives / 5 à vérifier / 2 nécessitent une action."
  // Répartition construite EXCLUSIVEMENT à partir de seuils/états déjà
  // définis ailleurs dans ce fichier (Article 5 — jamais un seuil inventé
  // pour l'occasion) :
  //   - "nécessite une action"  : l'article est déjà une carte d'action
  //     visible dans Plan d'exploitation (même détection que
  //     filtrerBaisseDejaEnAction ci-dessus, réutilisée ici).
  //   - "significative"         : évolution ≤ SEUIL_BAISSE (-30 %, le même
  //     seuil qui déclenche R2-BAISSE dans calculerCandidatsProduits) mais
  //     pas encore une carte visible (pourrait le devenir à une prochaine
  //     rotation de fusionnerEtSelectionner).
  //   - "à vérifier"            : toute autre baisse (< -30 %... 0 %),
  //     réelle mais pas encore assez marquée pour déclencher une alerte.
  function repartirBaisseParSeverite(produitsEnBaisse, actionsVisibles) {
    const articlesEnAction = new Set(
      (actionsVisibles || []).filter(p => p && p.moteur === 'produits' && p.article).map(p => p.article)
    );
    let necessitentAction = 0, significatives = 0, aVerifier = 0;
    (produitsEnBaisse || []).forEach(p => {
      if (articlesEnAction.has(p.article)) necessitentAction++;
      else if (p.evolution <= SEUIL_BAISSE) significatives++;
      else aVerifier++;
    });
    return { necessitentAction, significatives, aVerifier };
  }

  // Replier "Regard du Conseiller" derrière son badge (24/08/2026, v2.228,
  // audit §9) : "Le badge « 832 analysés · 9 retenus » est excellent et
  // doit devenir le point d'entrée de la section." L'audit propose aussi
  // une ligne de répartition avant ouverture ("3 opportunités · 4
  // anomalies à surveiller · 2 phénomènes saisonniers") — ce lot reprend
  // l'ESPRIT (une répartition par catégorie, visible sans ouvrir) avec le
  // VOCABULAIRE réel de NEXUS (les 5 groupes déjà calculés par
  // analyserProduitsStrategiques, jamais les 3 catégories génériques de
  // l'audit qui ne correspondent à aucun champ réellement mesuré ici —
  // même discipline qu'en v2.224/v2.227 : ne jamais forcer un vocabulaire
  // d'audit sur une donnée qu'il ne décrit pas fidèlement). Ne montre que
  // les groupes non vides (c'est précisément ce qui réduit le bruit).
  const LABELS_GROUPES_STRATEGIQUES = [
    { cle: 'tarifaire', singulier: 'alerte tarifaire', pluriel: 'alertes tarifaires' },
    { cle: 'progressionVolume', singulier: 'progression', pluriel: 'progressions' },
    { cle: 'regressionVolume', singulier: 'régression', pluriel: 'régressions' },
    { cle: 'regressionSaisonniere', singulier: 'saisonnière', pluriel: 'saisonnières' },
    { cle: 'margeEnProgression', singulier: 'marge en progression', pluriel: 'marges en progression' },
  ];
  function resumerGroupesStrategiques(ps) {
    if (!ps || !ps.disponible) return null;
    const groupes = LABELS_GROUPES_STRATEGIQUES
      .map(g => ({ n: (ps[g.cle] || []).length, label: g.singulier, labelPluriel: g.pluriel }))
      .filter(g => g.n > 0);
    if (!groupes.length) return null;
    return groupes.map(g => `${g.n} ${g.n > 1 ? g.labelPluriel : g.label}`).join(' · ');
  }

  // ------------------------------------------------------------
  // 1bis) Analyse multi-indicateurs des produits stratégiques (28/07/2026,
  // demande de Frédéric) : "je pense que NEXUS devrait suivre plusieurs
  // indicateurs simultanément [...] les ventes en volume diminuent malgré
  // la hausse du chiffre d'affaires. À surveiller." Un classement brut par
  // CA (l'ancien "Top ventes") peut cacher qu'une hausse de chiffre
  // d'affaires ne vient que d'une hausse tarifaire, pendant que les
  // quantités réellement vendues reculent — un vrai piège de lecture pour
  // un manager pressé. Cette fonction croise, par article, l'évolution du
  // CA, de la quantité, du prix moyen réalisé (ca/quantité, plus fiable
  // qu'un prix catalogue pour "ce qui a réellement été payé en moyenne")
  // et de la marge, entre les deux périodes comparables déjà identifiées
  // par NexusPeriodes (jamais recalculées différemment ici).
  //
  // Article 5 de la Constitution ("jamais un chiffre inventé") : une
  // évolution n'est calculée que si la période précédente a une base
  // réelle (CA et quantité > 0) — sinon l'article est simplement ignoré
  // plutôt que de fabriquer un pourcentage à partir de rien.
  // Mots-clés évoquant un évènement ou une saison commerciale (28/07/2026,
  // retour de Frédéric) — sert à distinguer une vraie régression d'une fin
  // de campagne normale (ex : un gobelet "Carnaval" qui ne se vend presque
  // plus une fois le Carnaval terminé). Premier jet documenté plutôt qu'une
  // vérité établie, même esprit que MOTCLE_RAYON_TRAFIC (NEXUS-Rayon-v1.html)
  // ou les EXCEPTIONS de nexus-marge.js : une hypothèse de lecture à corriger
  // par quelqu'un qui connaît le métier, jamais présentée comme une
  // certitude — le texte affiché au manager reste conditionnel ("si la
  // période est terminée"), jamais catégorique sur une donnée que NEXUS ne
  // peut pas vérifier (Article 5).
  const MOTSCLES_SAISONNIERS = /carnaval|mardi[- ]gras|no[eë]l|p[aâ]ques|halloween|toussaint|saint[- ]valentin|f[eê]te des m[eè]res|f[eê]te des p[eè]res|rentr[eé]e|chandeleur|beaujolais/i;
  function detecterMotCleSaisonnier(article) {
    const m = (article || '').match(MOTSCLES_SAISONNIERS);
    return m ? m[0] : null;
  }

  function analyserProduitsStrategiques(rowsPaireActuelle, rowsPairePrecedente) {
    function sommerParArticle(rows) {
      const parCle = {};
      (rows || []).forEach(r => {
        const cle = r.categorie + '|' + r.article;
        if (!parCle[cle]) parCle[cle] = { article: r.article, categorie: r.categorie, ca: 0, quantite: 0, marge: 0 };
        parCle[cle].ca += r.ca || 0;
        parCle[cle].quantite += r.quantite || 0;
        parCle[cle].marge += r.marge || 0;
      });
      return parCle;
    }
    const actuel = sommerParArticle(rowsPaireActuelle);
    const precedent = sommerParArticle(rowsPairePrecedente);

    const analyses = [];
    Object.keys(actuel).forEach(cle => {
      const a = actuel[cle];
      const p = precedent[cle];
      if (!p || !(p.ca > 0) || !(p.quantite > 0) || !(a.quantite > 0)) return;
      const evolutionCA = (a.ca - p.ca) / p.ca;
      const evolutionQuantite = (a.quantite - p.quantite) / p.quantite;
      const prixMoyenActuel = a.ca / a.quantite;
      const prixMoyenPrecedent = p.ca / p.quantite;
      const evolutionPrixMoyen = prixMoyenPrecedent > 0 ? (prixMoyenActuel - prixMoyenPrecedent) / prixMoyenPrecedent : null;
      // Une marge précédente nulle ou absente ne permet pas un pourcentage
      // honnête (division par zéro) — on ignore alors l'évolution de marge
      // pour cet article plutôt que d'afficher un chiffre absurde.
      const evolutionMarge = (p.marge != null && p.marge !== 0) ? (a.marge - p.marge) / Math.abs(p.marge) : null;
      analyses.push({
        article: a.article, categorie: a.categorie,
        ca: a.ca, quantite: a.quantite, marge: a.marge,
        // Volumes en clair (28/07/2026, retour de Frédéric : "+2300 % sur
        // une base de 1 unité n'informe pas") — le manager doit pouvoir lire
        // le nombre d'unités réel à côté du pourcentage, pas seulement lui.
        quantitePrecedente: p.quantite, caPrecedente: p.ca,
        evolutionCA, evolutionQuantite, evolutionPrixMoyen, evolutionMarge,
        // Le signal le plus utile : le CA progresse alors que le volume
        // recule — la croissance ne vient que du prix, pas de la demande.
        croissanceTarifaire: evolutionCA > 0 && evolutionQuantite < 0,
        motCleSaisonnier: detecterMotCleSaisonnier(a.article),
      });
    });

    const tarifaire = analyses.filter(a => a.croissanceTarifaire)
      .sort((x, y) => y.evolutionCA - x.evolutionCA).slice(0, 2);
    const progressionVolume = analyses.filter(a => !a.croissanceTarifaire && a.evolutionQuantite > 0)
      .sort((x, y) => y.evolutionQuantite - x.evolutionQuantite).slice(0, 2);
    // Une forte baisse dont le nom évoque un évènement/une saison est
    // routée à part (regressionSaisonniere) plutôt que mêlée aux vraies
    // alertes — sinon un produit de Carnaval en fin de campagne se lirait
    // comme un problème à corriger (retour de Frédéric, 28/07/2026).
    const regressionCandidats = analyses.filter(a => !a.croissanceTarifaire && a.evolutionQuantite < 0);
    const regressionSaisonniere = regressionCandidats.filter(a => a.motCleSaisonnier)
      .sort((x, y) => x.evolutionQuantite - y.evolutionQuantite).slice(0, 2);
    const regressionVolume = regressionCandidats.filter(a => !a.motCleSaisonnier)
      .sort((x, y) => x.evolutionQuantite - y.evolutionQuantite).slice(0, 2);
    // Exclut aussi les articles déjà en croissance tarifaire (ci-dessus) —
    // sinon un même article apparaîtrait deux fois : une fois comme alerte,
    // une fois comme "bonne nouvelle" marge, ce qui serait incohérent.
    const margeEnProgression = analyses.filter(a => !a.croissanceTarifaire && a.evolutionMarge != null && a.evolutionMarge > 0)
      .sort((x, y) => y.evolutionMarge - x.evolutionMarge).slice(0, 2);

    // Compte de sélectivité (28/07/2026, retour de Frédéric : "le Conseiller
    // ne devrait jamais commenter tous les produits, seulement ceux qui
    // méritent l'attention") — permet d'afficher "NEXUS a analysé N
    // produits, M nécessitent votre attention" plutôt qu'une longue liste.
    const totalRetenus = tarifaire.length + progressionVolume.length + regressionVolume.length
      + regressionSaisonniere.length + margeEnProgression.length;

    return {
      disponible: analyses.length > 0,
      totalAnalyses: analyses.length, totalRetenus,
      tarifaire, progressionVolume, regressionVolume, regressionSaisonniere, margeEnProgression,
    };
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

  // Schéma commun de sortie des 4 normaliseurs (réécrit le 27/07/2026,
  // demande de Frédéric — deuxième passe) : "le Conseiller ne décrit
  // jamais l'entreprise, il décrit uniquement ce qu'il faut faire,
  // pourquoi, ce que cela va apporter... Décision ↓ Pourquoi ↓ Impact ↓
  // Preuves ↓ Limites. On commence toujours par la conclusion." L'ancien
  // schéma (verdict/constat/consequence/recommandation) menait par le
  // diagnostic ; il est remplacé par :
  //   decision        — phrase à l'impératif, TOUJOURS affichée en premier
  //   pourquoi        — explication (fond verdict + situation)
  //   pourquoiBullets — optionnel, liste de preuves courtes (Tempo)
  //   pourquoiPasAutre— optionnel, {titre, texte} contre-argument (Tempo)
  //   opportunites    — optionnel, liste de {icone, label, detail} (Tempo)
  //   impactAttendu   — bénéfice attendu de la décision
  //   preuve          — chiffre/preuve complémentaire (repliée)
  //   limites         — optionnel, réserve/incertitude sur l'analyse
  // Réservé à R2/R3 : contrairement à R4 (évaluée sur la seule période
  // affichée, voir calculerCandidatsProduits), R2 et R3 comparent deux
  // périodes — la limite réelle de la méthode est de ne pas encore avoir
  // plusieurs périodes consécutives pour confirmer une tendance.
  const LIMITE_PERIODE_UNIQUE = "Comparaison sur une seule période d'import — pas encore une tendance confirmée sur plusieurs périodes.";
  // urgence/nature (22/08/2026, v2.227, audit "Cockpit Améliorations
  // Développeur" §5 — "Unifier la grammaire des priorités") : les libellés
  // actuels ("🔥 À AGIR", "🔴 CRITIQUE", "📦 À COMPTER"...) mélangent
  // urgence et type d'action dans un seul texte. Ce lot sépare les deux
  // dimensions demandées par l'audit — urgence (Maintenant/Aujourd'hui/
  // Cette semaine) et nature (verbe d'action) — SANS toucher `etat`, qui
  // reste la clé de couleur du bord de carte (`ETAT_CLASS`, Cockpit) :
  // aucun risque de régression visuelle, seul le texte du badge change.
  // NATURE_PAR_TYPE_RAYON réutilise `typeActionPourCategorie` déjà
  // existant (Article 11 — même classification, jamais une deuxième).
  const NATURE_PAR_TYPE_RAYON = {
    facing: 'Réassortir', presentoir: 'Réassortir',
    stock: 'Vérifier', support: 'Vérifier', comptoir: 'Vérifier',
    production: 'Commander',
  };
  function normaliserProduit(c) {
    const typeRayon = typeActionPourCategorie(c.categorie);
    const lang = LANGAGE_ACTION[typeRayon];
    let decision, limites = null, urgence;
    if (c.rule_id === 'R3-HAUSSE') {
      decision = lang.decisionHausse(c.article);
      limites = LIMITE_PERIODE_UNIQUE;
      urgence = 'Cette semaine';
    } else if (c.rule_id === 'R2-BAISSE') {
      decision = lang.decisionBaisse(c.article);
      limites = `${c.analyse} ${c.consequence} ${LIMITE_PERIODE_UNIQUE}`;
      urgence = 'Aujourd\'hui';
    } else {
      decision = lang.decisionAgir(c.article);
      urgence = 'Maintenant';
    }
    return {
      candidate_id: c.candidate_id, ruleId: c.rule_id, rang: RANG_PRODUIT[c.etat] != null ? RANG_PRODUIT[c.etat] : 2,
      moteur: 'produits',
      etat: c.etat, impact_eur: c.impact_eur, article: c.article, categorie: c.categorie,
      decision, pourquoi: `${c.verdict} ${c.situation}`,
      impactAttendu: c.impactAttendu, preuve: c.impact, limites,
      cible: `NEXUS-Produits-v1.html?article=${encodeURIComponent(c.article)}`,
      validable: true,
      urgence, nature: NATURE_PAR_TYPE_RAYON[typeRayon] || 'Vérifier',
      // libelleActionSecondaire (22/08/2026, audit "Cockpit Améliorations
      // Développeur" §4, chantier "Boutons d'action précis") : `cible`
      // existait déjà (avec l'article précisé en query param) mais n'était
      // jamais affiché pour les candidats validables — seul le bouton
      // Valider apparaissait, sans moyen d'aller inspecter le produit
      // avant de valider. Réutilise `cible` tel quel, aucun nouveau champ
      // de navigation.
      libelleActionSecondaire: 'Voir le produit',
      ca_reference: c.ca_reference, periode_reference_debut: c.periode_reference_debut, periode_reference_fin: c.periode_reference_fin,
    };
  }

  // Convertit un candidat Marge+ (même schéma que NEXUS-Scanner-v1.html,
  // règle R5-MARGE-ECART) — également validable, même candidate_id que
  // Scanner (LIVE-R5-...), donc reste cohérent si validé depuis l'accueil
  // ou depuis Scanner. `recommandation` est déjà à l'impératif ("Vérifiez
  // si le prix d'achat ou de vente de X peut se rapprocher de..."), donc
  // sert de decision directement, sans reformulation.
  function normaliserMarge(c) {
    return {
      candidate_id: c.candidate_id, ruleId: 'R5-MARGE-ECART', rang: 2,
      moteur: 'marge',
      etat: c.etat, impact_eur: c.impact_eur, article: c.article, categorie: c.categorie,
      decision: c.recommandation, pourquoi: c.situation,
      impactAttendu: "Marge alignée sur le groupe, sans perdre en compétitivité.",
      preuve: c.impact, limites: c.analyse || null,
      cible: 'NEXUS-Scanner-v1.html',
      validable: true,
      // libelleActionSecondaire (22/08/2026, v2.226) — libellé repris tel
      // quel du tableau de l'audit ("Prix/marge → Vérifier le produit →
      // Ouvrir Scanner NEXUS"), `cible` déjà présent et déjà correct.
      libelleActionSecondaire: 'Ouvrir Scanner NEXUS',
      ca_reference: c.ca_reference, periode_reference_debut: c.periode_reference_debut, periode_reference_fin: c.periode_reference_fin,
    };
  }

  // Convertit le candidat Tempo enrichi (27/07/2026, demande de Frédéric —
  // "jeudi crée le plus de valeur, vendredi fait plus de CA brut mais
  // avec des produits d'appel") — construit en amont dans App-v1 par
  // construireCandidatTempoHome() à partir du jour le plus rentable
  // (valorisé, produits d'appel exclus) plutôt que du seul jour à
  // renforcer. Non validable depuis l'accueil : NEXUS Tempo valide sa
  // propre décision via une mission dédiée (candidate_id = id de mission,
  // format différent de LIVE-Rn) — dupliquer cette écriture ici créerait
  // deux identités différentes pour la même décision. `c` attend
  // {jourCible, decision, pourquoi, pourquoiBullets, pourquoiPasAutre,
  // opportunites, impactAttendu, limites}.
  function normaliserTempo(c) {
    return {
      candidate_id: `TEMPO-${c.jourCible.nom}`, ruleId: 'R6-TEMPO-JOUR', rang: 2,
      moteur: 'tempo',
      etat: '🗓️ TEMPO', impact_eur: 0, article: null, categorie: 'Rythme hebdomadaire',
      decision: c.decision, pourquoi: c.pourquoi,
      pourquoiBullets: c.pourquoiBullets || null,
      pourquoiPasAutre: c.pourquoiPasAutre || null,
      opportunites: c.opportunites || null,
      impactAttendu: c.impactAttendu,
      preuve: null, limites: c.limites || null,
      cible: 'NEXUS-Tempo-v1.html', validable: false,
      // libelleAction (22/08/2026, v2.226) — remplace le lien générique
      // "→ Aller vérifier dans Tempo" par un libellé propre au signal.
      libelleAction: "Voir l'analyse Tempo",
    };
  }

  // Convertit un message advisor_messages (Qualité/Caisse aujourd'hui) —
  // non validable depuis l'accueil : sa résolution suit son propre statut
  // (nouveau/résolu/expiré) dans advisor_messages, pas journal_decisions —
  // écrire dedans depuis ici créerait une mémoire parallèle incohérente.
  // `domaine` sert uniquement à choisir une destination plausible.
  const CIBLE_PAR_DOMAINE_ADVISOR = { caisse: 'NEXUS-Verify-v1.html', qualite: 'NEXUS-Missions-v1.html' };
  // libelleAction (22/08/2026, v2.226) — même logique de destination que
  // CIBLE_PAR_DOMAINE_ADVISOR (par domaine), pour ne jamais dire "Contrôler
  // ce point" sur un signal qui renvoie en réalité vers une mission qualité.
  const LIBELLE_ACTION_PAR_DOMAINE_ADVISOR = { caisse: 'Contrôler ce point', qualite: 'Voir la mission' };
  function normaliserAdvisor(message) {
    const domaine = message.domaine || '';
    return {
      candidate_id: `ADV-${message.id}`, ruleId: message.code || null, rang: RANG_ADVISOR[message.priority] != null ? RANG_ADVISOR[message.priority] : 3,
      moteur: 'advisor',
      etat: '📋 SIGNAL', impact_eur: 0, article: null, categorie: message.nomRegle || domaine,
      decision: 'Vérifiez ce point dans l’écran concerné.',
      pourquoi: message.message_text,
      impactAttendu: "Situation clarifiée et suivie dans la durée.",
      preuve: `Confiance ${message.confidence_level || '—'} · détecté le ${new Date(message.generated_at).toLocaleDateString('fr-FR')}`,
      limites: null,
      cible: CIBLE_PAR_DOMAINE_ADVISOR[domaine] || 'NEXUS-Cockpit-v2.html',
      validable: false,
      libelleAction: LIBELLE_ACTION_PAR_DOMAINE_ADVISOR[domaine] || 'Voir le détail',
    };
  }

  // Convertit une ligne de v_caisse_ecart_a_traiter (écart de caisse non
  // justifié, anomalie ou critique, sur les 14 derniers jours) — ajouté le
  // 28/07/2026, demande de Frédéric : "le Cockpit doit distribuer du
  // travail... Fred, avant tout, va voir Dylan. Un écart de caisse de 40 €
  // coûte plus cher qu'un mauvais facing." NEXUS a explicitement
  // l'autorisation de nommer l'employé concerné dans ce cas précis (un
  // incident daté, pas une comparaison entre employés — confirmé par
  // Frédéric le 28/07/2026), grâce à l'attribution par quart disponible
  // dans employes_piste/employes_boutique. Si l'employé n'a pas pu être
  // identifié avec certitude (quart à plusieurs personnes), la décision
  // reste anonymisée plutôt que de risquer un nom faux. Non validable
  // depuis l'accueil : ce n'est pas une décision à impact de marge
  // mesurable dans le temps (comme R2/R3/R4/R5), c'est un signal à aller
  // vérifier — sa résolution se fait en commentant l'audit (soit dans
  // NEXUS-Verify-v1.html, soit via la case à cocher "Justifié" du Cockpit,
  // ajoutée le 28/07/2026, qui écrit le même commentaire) plutôt que via
  // journal_decisions. `auditId` est exposé pour que le Cockpit sache quel
  // audits_caisse.id mettre à jour sans reparser candidate_id.
  const RANG_CAISSE = { critique: 0, anomalie: 1 };
  function normaliserCaissePersonne(c) {
    // 'T00:00:00' évite le décalage d'un jour que produirait new Date('YYYY-MM-DD')
    // seul (interprété en UTC, puis reconverti en heure locale Martinique
    // UTC-4) — même correctif déjà appliqué dans NEXUS-Verify-v1.html.
    const jour = new Date(c.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    const cote = c.cote_dominant === 'piste' ? 'côté piste' : c.cote_dominant === 'boutique' ? 'côté boutique' : null;
    const montant = Math.round((c.montant_dominant != null ? c.montant_dominant : c.ecart_total) * 100) / 100;
    const decision = c.employee_nom
      ? `Allez voir ${c.employee_nom} : un écart de ${montant} € reste non justifié sur son quart du ${jour}${cote ? ' (' + cote + ')' : ''}.`
      : `Un écart de ${montant} € reste non justifié sur le quart du ${jour}${cote ? ' (' + cote + ')' : ''} — la personne n'a pas pu être identifiée avec certitude (plusieurs employés sur ce quart).`;
    return {
      candidate_id: `CAISSE-${c.audit_id}`, ruleId: 'R-CAISSE-ECART', rang: RANG_CAISSE[c.statut] != null ? RANG_CAISSE[c.statut] : 1,
      moteur: 'caisse',
      etat: c.statut === 'critique' ? '🔴 CRITIQUE' : '🟡 À VÉRIFIER', impact_eur: montant, article: null, categorie: 'Caisse',
      decision,
      pourquoi: `Écart classé « ${c.statut} » lors de l'audit de caisse du ${jour} (écart total constaté : ${Math.round(c.ecart_total * 100) / 100} €).`,
      impactAttendu: "Écart clarifié avant qu'il ne se reproduise ou ne s'accumule.",
      preuve: `Audit de caisse du ${jour} · quart ${c.quart}${cote ? ' · ' + cote : ''}.`,
      limites: "Attribution par quart (employé seul sur le quart) — ne remplace pas une vérification directe avec la personne.",
      cible: 'NEXUS-Verify-v1.html',
      validable: false,
      // libelleAction (22/08/2026, v2.226, audit §4 — libellé repris tel
      // quel : "Écart caisse employé → Contrôler cet écart"). Pas de
      // libelleActionSecondaire "Voir les preuves" : `preuve` est déjà
      // affiché directement dans la carte une fois dépliée — un second
      // bouton pointant vers la même information déjà visible serait un
      // faux-semblant (Article 5), pas une vraie action supplémentaire.
      libelleAction: 'Contrôler cet écart',
      // urgence/nature (22/08/2026, v2.227, audit §5) — "MAINTENANT -
      // Contrôler : Écart de caisse de 36,65 € non justifié" est
      // littéralement l'exemple donné par l'audit lui-même.
      urgence: c.statut === 'critique' ? 'Maintenant' : 'Aujourd\'hui',
      nature: 'Contrôler',
      auditId: c.audit_id,
    };
  }

  // Convertit une entrée de NexusStock.calculerRisqueParRayon() (agrégation
  // par rayon des écarts de stock non expliqués) — ajouté le 28/07/2026,
  // demande de Frédéric : "fais un inventaire tournant des boissons
  // énergétiques... parce que c'est le rayon avec la plus forte démarque
  // potentielle." Formulé honnêtement comme un signal à vérifier, jamais
  // une perte confirmée : NEXUS n'a aujourd'hui aucun comptage physique
  // (quantite_reelle) en base pour l'affirmer (article 5 de la
  // Constitution). Non validable : un comptage réel, pas une décision à
  // impact de marge mesurable dans le temps.
  function normaliserStockRayon(c) {
    return {
      candidate_id: `STOCK-RAYON-${c.categorie}`, ruleId: 'R-STOCK-RAYON', rang: 2,
      moteur: 'stock',
      etat: '📦 À COMPTER', impact_eur: c.risqueEur, article: null, categorie: c.categorie,
      decision: `Faites un comptage du rayon ${c.categorie} : ${c.nbAVerifier} référence${c.nbAVerifier > 1 ? 's' : ''} montre${c.nbAVerifier > 1 ? 'nt' : ''} un écart de stock non expliqué.`,
      pourquoi: `Sur ${c.nbReferences} référence${c.nbReferences > 1 ? 's' : ''} suivie${c.nbReferences > 1 ? 's' : ''} dans ce rayon, ${c.nbAVerifier} à vérifier${c.nbASurveiller > 0 ? ` et ${c.nbASurveiller} à surveiller` : ''}.`,
      impactAttendu: c.risqueEur > 0
        ? `Confirme ou écarte un risque estimé à ${Math.round(c.risqueEur).toLocaleString('fr-FR')} € avant qu'il ne s'aggrave.`
        : "Confirme ou écarte un écart de stock avant qu'il ne s'aggrave.",
      preuve: `${Math.round(c.risqueEur).toLocaleString('fr-FR')} € de risque estimé (Scanner Stock) sur ${c.nbAVerifier} référence${c.nbAVerifier > 1 ? 's' : ''}.`,
      limites: "Écart de mouvement de stock non expliqué par les ventes connues, pas une démarque confirmée — NEXUS n'a aujourd'hui aucun comptage physique en base pour l'affirmer.",
      cible: 'NEXUS-Scanner-Stock-v1.html',
      validable: false,
      // libelleAction (22/08/2026, v2.226, audit §4 — "Comptage ciblé
      // stock → Lancer ce comptage").
      libelleAction: 'Lancer ce comptage',
      // urgence/nature (22/08/2026, v2.227, audit §5) — "AUJOURD'HUI -
      // Compter : 1 référence du rayon Produits Capillaires présente un
      // écart inexpliqué" est littéralement l'exemple donné par l'audit.
      urgence: 'Aujourd\'hui', nature: 'Compter',
    };
  }

  // Convertit un rappel manuel (table `rappels`) en candidat du même
  // schéma que les autres moteurs — ajouté le 28/07/2026 sur retour de
  // Frédéric : "tu aurais dû juste brancher rappels dans produits au
  // cockpit" — un rappel manuel EST un travail à distribuer comme les
  // autres, pas une liste séparée. `decision` est le texte du rappel
  // lui-même, tel qu'écrit par le manager, jamais reformulé. rang 1 si en
  // retard (juste derrière le vraiment critique), rang 3 sinon (moins
  // urgent que les signaux mesurés, mais toujours dans la rotation — sinon
  // un rappel sans date ne remonterait jamais). Se clôture directement
  // dans sa carte (marquerRappelFait), jamais via journal_decisions : un
  // rappel n'a pas d'impact de marge à mesurer dans le temps.
  function normaliserRappel(r) {
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const enRetard = r.date_echeance && r.date_echeance < aujourdhui;
    // 'T00:00:00' évite le décalage d'un jour en heure locale Martinique.
    const dateTexte = r.date_echeance
      ? new Date(r.date_echeance + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
      : null;
    return {
      candidate_id: `RAPPEL-${r.id}`, ruleId: 'RAPPEL-MANUEL', rang: enRetard ? 1 : 3,
      moteur: 'rappel',
      etat: enRetard ? '⚠️ RAPPEL EN RETARD' : '📌 RAPPEL', impact_eur: 0, article: null, categorie: null,
      decision: r.texte,
      pourquoi: dateTexte ? `Rappel ajouté manuellement, échéance le ${dateTexte}.` : 'Rappel ajouté manuellement, sans échéance.',
      impactAttendu: null, preuve: null, limites: null,
      cible: null, validable: false,
      // urgence/nature (22/08/2026, v2.227, audit §5) — nature "Traiter"
      // choisie plutôt qu'un verbe métier inventé : un rappel est un texte
      // libre écrit par le manager (`r.texte`), NEXUS ne connaît pas sa
      // vraie nature (contrôler/compter/commander/...) — "Traiter" reste
      // honnête sur ce que NEXUS sait réellement (Article 5), et reprend
      // le vocabulaire déjà utilisé par le bouton "Marquer comme fait"
      // (proche de "Marquer comme traité", §4 de l'audit).
      urgence: enRetard ? 'Maintenant' : 'Cette semaine', nature: 'Traiter',
      rappelId: r.id,
    };
  }

  // Convertit un candidat NexusFdjMoteur.calculerCandidatsFdj() (Phase D
  // FDJ, 09/08/2026, audit "Moteur de clairvoyance manager" §46 items
  // 13-16) — même schéma commun que les autres moteurs. `c.niveau`
  // (critique/attention/positif) réutilise le vocabulaire etat déjà connu
  // de ETAT_CLASS (NEXUS-Brief-v1.html) plutôt que d'en inventer un
  // nouveau : critique → même code visuel que Caisse/Produits en alerte,
  // positif → même code que Produits en opportunité. `confiance` (Élevée/
  // Moyenne/Faible, audit §24) est fournie par le moteur FDJ lui-même,
  // liée à la nature de la règle (un comptage direct est "Élevée", une
  // comparaison sur une seule période est "Moyenne") — jamais une
  // impression de l'IA. Non validable comme caisse/stock/rappel : ce n'est
  // pas une décision à impact de marge mesurable dans le temps comme
  // R2/R3/R4/R5, c'est un signal opérationnel dont la résolution se
  // constate directement dans l'écran FDJ concerné (le stock remonte,
  // l'écart disparaît, le CA repart) — pas via journal_decisions.
  const RANG_FDJ = { critique: 0, attention: 1, positif: 2 };
  const ETAT_FDJ = { critique: '🔴 CRITIQUE', attention: '🟡 À VÉRIFIER', positif: '📈 OPPORTUNITÉ' };
  function normaliserFdj(c) {
    return {
      candidate_id: c.id, ruleId: c.type, rang: RANG_FDJ[c.niveau] != null ? RANG_FDJ[c.niveau] : 2,
      moteur: 'fdj',
      etat: ETAT_FDJ[c.niveau] || '📋 SIGNAL', impact_eur: c.impactEur || 0, article: c.titre, categorie: 'FDJ',
      decision: c.decision, pourquoi: c.constat,
      impactAttendu: c.impactAttendu, preuve: c.preuve, limites: c.limites || null,
      cible: c.cible || 'NEXUS-FDJ-Analyse-v1.html',
      validable: false,
      // libelleAction (22/08/2026, v2.226) — l'audit suggère "Ouvrir le
      // quart FDJ", mais `cible` ne pointe aujourd'hui jamais vers un
      // quart précis (toujours l'écran d'analyse global) : reprendre ce
      // libellé serait une fausse précision (Article 5). "Voir l'analyse
      // FDJ" reste exact sur ce que le lien ouvre réellement.
      libelleAction: "Voir l'analyse FDJ",
      confiance: c.confiance || null,
    };
  }

  // Convertit un candidat NexusCoachFdj.calculerCandidatsCoachEquipe()
  // (Coach x FDJ Pilotage, étape "remontée Brief", 09/08/2026, audit §13) —
  // même schéma commun, moteur distinct ('coach') de 'fdj' (Conseiller FDJ,
  // Phase D) : deux sources différentes (candidats FDJ Pilotage bruts vs
  // synthèses déjà décidées par Coach), jamais mélangées sous le même nom
  // de moteur. Non validable pour la même raison que normaliserFdj — la
  // résolution se constate dans NEXUS-FDJ-Analyse-v1.html (section
  // Coaching équipe), pas via journal_decisions.
  const RANG_COACH = { critique: 0, attention: 1, positif: 2 };
  const ETAT_COACH = { critique: '🔴 CRITIQUE', attention: '🟡 À VÉRIFIER', positif: '📈 OPPORTUNITÉ' };
  function normaliserCoach(c) {
    return {
      candidate_id: c.id, ruleId: c.type, rang: RANG_COACH[c.niveau] != null ? RANG_COACH[c.niveau] : 2,
      moteur: 'coach',
      etat: ETAT_COACH[c.niveau] || '📋 SIGNAL', impact_eur: c.impactEur || 0, article: c.titre, categorie: 'Coach FDJ',
      decision: c.decision, pourquoi: c.constat,
      impactAttendu: c.impactAttendu, preuve: c.preuve, limites: c.limites || null,
      cible: c.cible || 'NEXUS-FDJ-Analyse-v1.html',
      validable: false,
      // libelleAction (22/08/2026, v2.226) — même raisonnement que fdj :
      // `cible` pointe vers l'écran d'analyse, pas vers un employé précis.
      libelleAction: "Voir le coaching équipe",
      confiance: c.confiance || null,
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
    SEUIL_CONTRIBUTION_FORTE, SEUIL_HAUSSE, SEUIL_BAISSE,
    analyserProduitsStrategiques, analyserEvolutionsPaire,
    normaliserProduit, normaliserMarge, normaliserTempo, normaliserAdvisor,
    normaliserCaissePersonne, normaliserStockRayon, normaliserRappel,
    normaliserFdj, normaliserCoach,
    filtrerBaisseDejaEnAction, repartirBaisseParSeverite, resumerGroupesStrategiques,
    fusionnerEtSelectionner, genererGraineJour,
  };
})(window);
