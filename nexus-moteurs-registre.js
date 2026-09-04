// ============================================================
// NEXUS Moteurs — registre central (13/08/2026)
//
// Née du cadrage transmis par Frédéric ("NEXUS_Brief_Moteurs_Dynamiques.pdf")
// : *"Aucun nom de moteur métier ne doit être écrit en dur dans Brief, APP
// ou Rapport. Ces écrans doivent demander au registre NEXUS quels moteurs
// sont actifs pour le site, lesquels sont exploitables, et lesquels ont
// réellement contribué à la synthèse courante."*
//
// Constat exact du cadrage, vérifié dans le code avant ce lot : le pied de
// page de NEXUS-Brief-v1.html affichait en dur "agrège Produits, Marge+,
// Tempo, Verify, Stock, Inventaire, Missions, Équipe" — une liste FIXE,
// identique quel que soit le site, son métier, ou les données réellement
// disponibles aujourd'hui. Une boulangerie (sans Carburants ni FDJ) aurait
// vu exactement le même texte qu'une station-service. La mention de
// fiabilité ("confianceGlobale") divisait elle aussi par un dénominateur
// fixe (`/7`) sans rapport avec le nombre réel de moteurs pertinents pour
// ce site.
//
// Article 11 ("une seule vérité") : ce fichier ne RECALCULE jamais la
// donnée elle-même — il ne fait que NOMMER et FILTRER des moteurs déjà
// identifiés ailleurs (candidats de nexus-conseiller.js, secteurs de
// nexus-secteurs-moteur.js) selon les 4 niveaux du cadrage :
//   1. Moteurs POSSIBLES  — déterminés par le type de commerce
//      (réutilise NexusSecteursCatalogue.SECTEURS_PRESET_METIER, jamais un
//      deuxième catalogue métier qui pourrait diverger).
//   2. Moteurs ACTIFS     — déterminés par la configuration du site
//      (réutilise NexusSecteursCatalogue.secteursActifsSite(), même
//      principe).
//   3. Moteurs EXPLOITABLES — installés, mais leurs données peuvent être
//      partielles (voir `couverture` du contrat secteur, v2.56).
//   4. Moteurs CONTRIBUTEURS — ont réellement produit un résultat exploité
//      dans le calcul en cours (candidat de décision non vide, OU secteur
//      dont `confiance === 'RÉEL'`).
//
// Granularité honnête (Article 5) : Opérations agrège déjà, au niveau du
// contrat secteur (nexus-secteurs-moteur.js), Verify + Stock + Inventaire
// en UNE seule mesure ("le secteur transversal qui agrège caisse/
// inventaire/stock, sans dupliquer les moteurs détaillés" — voir
// construireSecteurOperations). Ce registre ne prétend donc PAS pouvoir
// distinguer "Verify a contribué" de "Inventaire a contribué" séparément
// — ce serait une précision que le code ne mesure pas réellement. Un seul
// moteur public "Contrôles" représente cette contribution agrégée.
//
// Inclure : <script src="nexus-moteurs-registre.js?v=20260904-0104"></script>
// (après nexus-secteurs-catalogue.js)
// ------------------------------------------------------------

(function (global) {
  function catalogueSecteurs() { return global.NexusSecteursCatalogue; }

  // Catalogue des moteurs connus de NEXUS aujourd'hui. `id` = identifiant
  // technique (ne doit JAMAIS être affiché à l'écran — voir `nomPublic`).
  // `decisionKey`, quand renseigné, correspond à la clé `p.moteur` déjà
  // utilisée par NEXUS-Brief-v1.html/enrichirDecision() pour tagger une
  // décision (candidat) — reprise ici à l'identique, jamais un deuxième
  // vocabulaire. `secteurLie`, quand renseigné, correspond à un id de
  // NexusSecteursCatalogue.SECTEURS_CATALOGUE — sert à la fois à filtrer
  // "possible"/"actif" (le moteur suit son secteur) ET, pour les moteurs
  // sans `decisionKey` propre, à détecter la contribution via
  // `secteur.confiance === 'RÉEL'`.
  const MOTEURS_CATALOGUE = [
    { id: 'produits', nomPublic: 'Produits', decisionKey: 'produits', secteurLie: 'commerce' },
    { id: 'marge', nomPublic: 'Marge+', decisionKey: 'marge', secteurLie: 'marge' },
    { id: 'fdj', nomPublic: 'FDJ', decisionKey: 'fdj', secteurLie: 'fdj' },
    { id: 'coach', nomPublic: 'Coach FDJ', decisionKey: 'coach', secteurLie: 'fdj' },
    // Tempo/Signal/Caisse/Stock/Rappel : moteurs transversaux, sans secteur
    // dédié dans le contrat commun (nexus-secteurs-moteur.js) — rattachés
    // ici à 'operations' uniquement pour savoir dans QUELS métiers ils
    // restent pertinents (un métier sans secteur 'operations' n'a pas non
    // plus de rythme caisse/stock à surveiller) ; leur CONTRIBUTION reste
    // exclusivement pilotée par `decisionKey` (candidat non vide), jamais
    // par le secteur Opérations lui-même (qui reste sous "Contrôles").
    { id: 'tempo', nomPublic: 'Tempo', decisionKey: 'tempo', secteurLie: 'operations' },
    { id: 'advisor', nomPublic: 'Signal', decisionKey: 'advisor', secteurLie: 'operations' },
    { id: 'caisse', nomPublic: 'Caisse', decisionKey: 'caisse', secteurLie: 'operations' },
    { id: 'stock', nomPublic: 'Stock', decisionKey: 'stock', secteurLie: 'operations' },
    { id: 'rappel', nomPublic: 'Rappel', decisionKey: 'rappel', secteurLie: 'operations' },
    // Commande Carburant (24/08/2026, cahier §24-25) — notification
    // distincte du secteur 'carburants' (Performance/Maîtrise, contrat
    // commun) : `decisionKey` propre car ce moteur produit un candidat de
    // décision (au plus 1, voir NexusCarburantCommandeMoteur.
    // calculerCandidatCommande), pas une dimension de score du secteur.
    { id: 'commande_carburant', nomPublic: 'Commande carburant', decisionKey: 'commande_carburant', secteurLie: 'carburants' },
    // Moteurs sans candidat de décision propre — contribution détectée via
    // le secteur du contrat commun (`confiance === 'RÉEL'`).
    { id: 'operations', nomPublic: 'Contrôles', decisionKey: null, secteurLie: 'operations' },
    { id: 'equipe', nomPublic: 'Équipe', decisionKey: null, secteurLie: 'equipe' },
    { id: 'carburants', nomPublic: 'Carburants', decisionKey: null, secteurLie: 'carburants' },
  ];

  // Phrases réutilisées par NEXUS-Brief-v1.html pour "Ce qui semble
  // l'expliquer" (déplacées ici depuis MOTEUR_LABEL/MOTEUR_SOURCE, qui
  // vivaient auparavant en dur dans NEXUS-Brief-v1.html — Article 11, une
  // seule vérité sur "à quoi correspond ce moteur").
  const MOTEUR_SOURCE = {
    produits: 'des ventes réelles importées (Produits)',
    marge: 'la comparaison de marge entre produits comparables (Marge+)',
    tempo: 'l’historique de caisse par jour de semaine (Tempo)',
    advisor: 'la détection Qualité/Caisse automatique',
    caisse: 'un audit de caisse réel (Verify)',
    stock: 'les relevés de stock (Scanner Stock)',
    rappel: 'un rappel ajouté manuellement',
    fdj: 'le stock et les comptages de quart FDJ réels (FDJ Performance)',
    coach: 'les recommandations Coach FDJ déjà générées pour chaque employé (Coach FDJ)',
    commande_carburant: 'le moteur de commande carburant (stock, consommation prévue, calendrier de livraison)',
  };

  function moteurParId(id) { return MOTEURS_CATALOGUE.find(m => m.id === id) || null; }
  function nomPublic(id) { const m = moteurParId(id); return m ? m.nomPublic : id; }

  // Niveau 1 — moteurs POSSIBLES pour un type de commerce (réutilise le
  // preset métier déjà défini dans NexusSecteursCatalogue, aucune
  // deuxième liste métier).
  function moteursPossiblesPourMetier(typeCommerce) {
    const C = catalogueSecteurs();
    const secteursMetier = (C && C.SECTEURS_PRESET_METIER[typeCommerce]) || [];
    return MOTEURS_CATALOGUE.filter(m => !m.secteurLie || secteursMetier.includes(m.secteurLie));
  }

  // Niveau 2 — moteurs ACTIFS pour un site donné : `secteursActifsIds` est
  // la liste des ids de secteurs réellement actifs sur CE site (déjà
  // résolue par `NexusSecteursCatalogue.secteursActifsSite(site).secteurs`,
  // jamais recalculée ici).
  function moteursActifsPourSite(secteursActifsIds) {
    const ids = secteursActifsIds || [];
    return MOTEURS_CATALOGUE.filter(m => !m.secteurLie || ids.includes(m.secteurLie));
  }

  // Niveau 4 — moteurs CONTRIBUTEURS au calcul en cours. `signaux` est
  // fourni par l'appelant (Brief), qui a déjà les deux informations
  // nécessaires sous la main, sans nouveau calcul :
  //   - `decisions` : { [decisionKey]: bool } — un candidat non vide pour
  //     cette clé (ex. `candidatMargeListe.length > 0`).
  //   - `axes` : { [secteurId]: bool } — `confiance === 'RÉEL'` pour ce
  //     secteur du contrat commun (AXES dans NEXUS-Brief-v1.html).
  // Un moteur À decisionKey utilise EXCLUSIVEMENT ce signal (jamais le
  // secteur lié, qui ne mesure pas la même chose — voir Tempo/Signal/
  // Caisse/Stock/Rappel ci-dessus) ; un moteur SANS decisionKey (Contrôles/
  // Équipe/Carburants) utilise exclusivement le signal `axes`.
  function moteursContributeurs(signaux, moteursDisponibles) {
    const decisions = (signaux && signaux.decisions) || {};
    const axes = (signaux && signaux.axes) || {};
    const base = moteursDisponibles || MOTEURS_CATALOGUE;
    return base.filter(m => m.decisionKey ? !!decisions[m.decisionKey] : (m.secteurLie ? !!axes[m.secteurLie] : false));
  }

  // Mention de fiabilité — remplace le dénominateur fixe "/7" par le
  // nombre réel de moteurs ACTIFS pour ce site (pas le nombre total de
  // moteurs connus de NEXUS, qui inclurait des moteurs sans rapport avec
  // ce métier).
  function construireMentionFiabilite(moteursContributeursListe, moteursActifsListe) {
    const nbContrib = moteursContributeursListe.length;
    const nbActifs = moteursActifsListe.length;
    return `${nbContrib}/${nbActifs} moteur${nbActifs > 1 ? 's' : ''} NEXUS ${nbActifs > 1 ? 'ont' : 'a'} contribué à cette synthèse aujourd'hui.`;
  }

  // Texte d'agrégation (pied de page) — remplace la liste figée "agrège
  // Produits, Marge+, Tempo, Verify, Stock, Inventaire, Missions, Équipe"
  // par la liste RÉELLE des moteurs contributeurs de ce Brief précis. Repli
  // honnête si rien n'a encore contribué (site tout juste configuré,
  // aucune donnée encore chargée) plutôt qu'une liste vide muette.
  function construireTexteAgregation(moteursContributeursListe) {
    if (!moteursContributeursListe.length) return 'NEXUS Brief · synthèse dirigeant · aucun moteur n\'a encore de données exploitables pour ce site.';
    const noms = moteursContributeursListe.map(m => m.nomPublic).join(', ');
    return `NEXUS Brief · synthèse dirigeant · agrège ${noms}`;
  }

  global.NexusMoteursRegistre = {
    MOTEURS_CATALOGUE, MOTEUR_SOURCE,
    moteurParId, nomPublic,
    moteursPossiblesPourMetier, moteursActifsPourSite, moteursContributeurs,
    construireMentionFiabilite, construireTexteAgregation,
  };
})(typeof window !== 'undefined' ? window : globalThis);
