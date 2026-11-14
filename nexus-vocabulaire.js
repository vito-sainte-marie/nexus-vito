// ============================================================
// NEXUS Vocabulaire — le lexique commun du Conseiller NEXUS.
//
// Demande de Frédéric le 23/07/2026 : donner au Conseiller un vocabulaire
// reconnaissable ("l'identité NEXUS"), et une règle de construction fixe —
// Constat → Explication → Décision — plutôt que des phrases inventées au
// coup par coup dans chaque page.
//
// Principe : ce fichier ne calcule RIEN. Il transforme un chiffre ou un
// niveau déjà calculé par la page appelante en une phrase du lexique
// contrôlé ci-dessous. Aucune fonction n'invente une donnée — si l'appelant
// ne fournit pas de quoi choisir un niveau, la fonction retourne null et
// c'est à la page d'afficher honnêtement "donnée insuffisante" plutôt que
// de forcer une phrase.
//
// Sélection déterministe (pas aléatoire) : un même "seed" (ex: le nom du
// rayon/produit) retombe toujours sur la même phrase du pool — on veut de
// la variété entre rayons différents, pas un texte qui change à chaque
// rechargement pour le même rayon.
//
// Inclure dans une page : <script src="nexus-vocabulaire.js?v=20260904-0104"></script>
// (même mécanisme que nexus-auth.js, chargé une fois par page).
// ============================================================

(function (global) {
  function hashSeed(seed) {
    const s = String(seed || '');
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  }
  function pick(pool, seed) {
    if (!pool || !pool.length) return null;
    return pool[hashSeed(seed) % pool.length];
  }

  const NexusVocab = {};

  // ------------------------------------------------------------
  // 1. État général — le niveau global d'un rayon/produit, 5 paliers.
  // niveau attendu : 'excellent' | 'bon' | 'moyen' | 'faible' | 'critique'
  // ------------------------------------------------------------
  const POOL_ETAT = {
    excellent: ['Très bon niveau.', 'Les indicateurs sont au vert.'],
    bon: ['Bon niveau.', 'Les résultats sont satisfaisants.'],
    moyen: ['Résultat moyen.', 'Quelques points à reprendre.'],
    faible: ['Niveau faible.', 'Une intervention est recommandée.'],
    critique: ['À traiter rapidement.', 'Une vérification sur place est prioritaire.'],
  };
  NexusVocab.etatGeneral = function (niveau, seed) { return pick(POOL_ETAT[niveau], seed); };

  // ------------------------------------------------------------
  // 2. Création de valeur
  // type : 'cree' | 'contribue_fort' | 'contribue_modere' | 'contribue_peu' | 'detruit' | 'immobilise'
  // ------------------------------------------------------------
  const POOL_VALEUR = {
    cree: ['crée de la valeur', 'améliore la rentabilité'],
    contribue_fort: ['contribue fortement'],
    contribue_modere: ['contribue modérément'],
    contribue_peu: ['contribue peu', 'génère peu de valeur'],
    detruit: ['détruit de la valeur', 'réduit la rentabilité'],
    immobilise: ['immobilise inutilement du capital'],
  };
  NexusVocab.creationValeur = function (type, seed) { return pick(POOL_VALEUR[type], seed); };

  // ------------------------------------------------------------
  // 3. Rentabilité — estCommission=true bascule sur le vocabulaire
  // "commission" (rayons de trafic/service : cartes prépayées...).
  // niveau : 'exceptionnelle' | 'tres_rentable' | 'rentable' | 'correcte' | 'faible' | 'insuffisante' | 'negative'
  // ------------------------------------------------------------
  const POOL_RENTA = {
    exceptionnelle: ['Rentabilité exceptionnelle.'],
    tres_rentable: ['Très rentable.'],
    rentable: ['Rentable.'],
    correcte: ['Correctement rentable.'],
    faible: ['Faiblement rentable.'],
    insuffisante: ['Rentabilité insuffisante.'],
    negative: ['Rentabilité négative.'],
  };
  const POOL_COMMISSION = {
    exceptionnelle: ['Commission élevée.'], tres_rentable: ['Commission élevée.'],
    rentable: ['Commission conforme.'], correcte: ['Commission conforme.'],
    faible: ['Commission faible.'], insuffisante: ['Commission faible.'], negative: ['Commission faible.'],
  };
  NexusVocab.rentabilite = function (niveau, estCommission, seed) {
    return pick(estCommission ? POOL_COMMISSION[niveau] : POOL_RENTA[niveau], seed);
  };

  // ------------------------------------------------------------
  // 4. Chiffre d'affaires — rôle du rayon/produit dans le CA.
  // role : 'moteur' | 'locomotive' | 'strategique' | 'poids_important' | 'soutien' | 'faible_contribution' | 'volume_important' | 'volume_limite'
  // ------------------------------------------------------------
  const POOL_CA = {
    moteur: ['moteur du rayon', 'locomotive commerciale'],
    locomotive: ['locomotive commerciale'],
    strategique: ['produit stratégique'],
    poids_important: ['poids important'],
    soutien: ['soutient l\'activité'],
    faible_contribution: ['faible contribution'],
    volume_important: ['volume important'],
    volume_limite: ['volume limité'],
  };
  NexusVocab.chiffreAffaires = function (role, seed) { return pick(POOL_CA[role], seed); };
  NexusVocab.partCA = function (pct) { return `représente ${(pct * 100).toFixed(1)} % du CA`; };

  // ------------------------------------------------------------
  // 5. Rotation — PAS ENCORE BRANCHÉ sur des données réelles au niveau
  // rayon (nécessite stock_releves croisé par catégorie, non disponible
  // dans NEXUS-Rayon-v1.html à ce jour — seule la fiche Produit calcule une
  // estimation de rotation individuelle). Le lexique existe pour que la
  // page qui aura la donnée un jour n'ait qu'à l'appeler, mais tant
  // qu'aucun niveau fiable n'est fourni, la fonction retourne null.
  // niveau : 'tres_rapide' | 'rapide' | 'normale' | 'lente' | 'tres_lente' | 'dormant' | 'irreguliere' | 'saisonniere'
  // ------------------------------------------------------------
  const POOL_ROTATION = {
    tres_rapide: ['Rotation très rapide.'], rapide: ['Rotation rapide.'], normale: ['Rotation normale.'],
    lente: ['Rotation lente.'], tres_lente: ['Rotation très lente.'], dormant: ['Produit dormant.'],
    irreguliere: ['Rotation irrégulière.'], saisonniere: ['Rotation saisonnière.'],
  };
  NexusVocab.rotation = function (niveau, seed) { return niveau ? pick(POOL_ROTATION[niveau], seed) : null; };

  // ------------------------------------------------------------
  // 6. Stock — PAS ENCORE BRANCHÉ au niveau rayon, même limite que
  // Rotation ci-dessus (stock_releves non agrégé par catégorie ici).
  // niveau : 'confortable' | 'maitrise' | 'tendu' | 'risque_rupture' | 'rupture_imminente' | 'surstock' | 'incoherent'
  // ------------------------------------------------------------
  const POOL_STOCK = {
    confortable: ['Stock confortable.'], maitrise: ['Stock maîtrisé.'], tendu: ['Stock tendu.'],
    risque_rupture: ['Risque de rupture.'], rupture_imminente: ['Rupture imminente.'],
    surstock: ['Surstock.'], incoherent: ['Stock incohérent — à contrôler.'],
  };
  NexusVocab.stock = function (niveau, seed) { return niveau ? pick(POOL_STOCK[niveau], seed) : null; };

  // ------------------------------------------------------------
  // 7. Comparaison — position relative (rang / total).
  // ------------------------------------------------------------
  NexusVocab.comparaison = function (rang, total, seed) {
    if (!rang || !total) return null;
    if (rang === 1) return pick(['Premier du rayon.', 'Premier sur l\'ensemble.'], seed);
    if (rang <= Math.max(3, Math.round(total * 0.1))) return pick(['Top 10.', 'Supérieur à la moyenne.'], seed);
    if (rang > total * 0.75) return pick(['Dernier quart.', 'Inférieur à la moyenne.'], seed);
    return pick(['Comparable à la moyenne.'], seed);
  };

  // ------------------------------------------------------------
  // 8. Tendance — à partir d'une évolution en fraction (0.20 = +20 %).
  // Gradation volontairement limitée à ce qu'une seule mesure d'évolution
  // permet d'affirmer honnêtement : "rebondit"/"retrouve sa dynamique"
  // impliqueraient de connaître la tendance précédente, non disponible.
  // ------------------------------------------------------------
  NexusVocab.tendance = function (evolution) {
    if (evolution == null) return null;
    if (evolution >= 0.30) return 'Accélère.';
    if (evolution >= 0.05) return 'Progresse.';
    if (evolution > -0.05) return 'Se stabilise.';
    if (evolution > -0.15) return 'Ralentit.';
    if (evolution > -0.30) return 'Recule.';
    return 'Décroche.';
  };

  // ------------------------------------------------------------
  // 9. Fiabilité
  // niveau : 'confirmees' | 'comparables' | 'fiable' | 'estimation' | 'provisoire' | 'incomplete' | 'a_confirmer' | 'import_incomplet' | 'insuffisantes'
  // ------------------------------------------------------------
  const POOL_FIAB = {
    confirmees: ['Données confirmées.'], comparables: ['Périodes comparables.'], fiable: ['Comparaison fiable.'],
    estimation: ['Estimation.'], provisoire: ['Calcul provisoire.'], incomplete: ['Information incomplète.'],
    a_confirmer: ['À confirmer.'], import_incomplet: ['Import incomplet.'], insuffisantes: ['Données insuffisantes.'],
  };
  NexusVocab.fiabilite = function (niveau, seed) { return pick(POOL_FIAB[niveau], seed); };

  // ------------------------------------------------------------
  // 10. Risques
  // niveau : 'faible' | 'modere' | 'eleve'
  // ------------------------------------------------------------
  const POOL_RISQUE = {
    faible: ['Risque faible.', 'Aucune anomalie.'], modere: ['Risque modéré.', 'Signal faible.', 'Surveillance recommandée.'],
    eleve: ['Risque élevé.', 'Signal fort.', 'Anomalie détectée.'],
  };
  NexusVocab.risque = function (niveau, seed) { return pick(POOL_RISQUE[niveau], seed); };

  // ------------------------------------------------------------
  // 11. Opportunités
  // niveau : 'eleve' | 'modere' | 'faible'
  // ------------------------------------------------------------
  const POOL_OPPORTUNITE = {
    eleve: ['Potentiel élevé.'],
    modere: ['Marge à aller chercher.'],
    faible: ['Opportunité commerciale limitée.'],
  };
  NexusVocab.opportunite = function (niveau, seed) { return pick(POOL_OPPORTUNITE[niveau], seed); };

  // ------------------------------------------------------------
  // 12. Décisions — le verbe d'action qui clôt le cycle Constat→Décision.
  // action : 'continuer' | 'maintenir' | 'renforcer' | 'developper' | 'commander' | 'reapprovisionner' | 'controler' | 'deplacer' | 'tester' | 'observer' | 'comparer' | 'reduire' | 'supprimer' | 'dereferencer'
  // ------------------------------------------------------------
  const POOL_DECISION = {
    continuer: ['Continuez sur cette voie.'], maintenir: ['Maintenez ce rayon en l\'état.'],
    renforcer: ['Renforcez ce levier.'], developper: ['Développez cette référence.'],
    commander: ['Passez commande.'], reapprovisionner: ['Réapprovisionnez.'],
    controler: ['Contrôlez ce point avant de conclure.'], deplacer: ['Testez un autre emplacement.'],
    tester: ['Testez un repositionnement.'], observer: ['Observez sur la prochaine période avant d\'agir.'],
    comparer: ['Comparez-le aux rayons voisins.'], reduire: ['Réduisez l\'exposition sur cette référence.'],
    supprimer: ['Envisagez de la retirer.'], dereferencer: ['Envisagez un déréférencement, après vérification terrain.'],
  };
  NexusVocab.decision = function (action, seed) { return pick(POOL_DECISION[action], seed); };

  // ------------------------------------------------------------
  // 13. Terrain
  // ------------------------------------------------------------
  const POOL_TERRAIN = {
    facing: ['Vérifiez le facing.'], prix: ['Contrôlez le prix.'], stock: ['Contrôlez le stock.'],
    rotation: ['Observez la rotation.'], photo: ['Prenez une photo.'], planogramme: ['Comparez au planogramme.'],
    etiquetage: ['Vérifiez l\'étiquetage.'], emplacement: ['Confirmez l\'emplacement.'],
  };
  NexusVocab.terrain = function (action, seed) { return pick(POOL_TERRAIN[action], seed); };

  // ------------------------------------------------------------
  // 14. Management — pool générique de ton, indexé sur la sévérité globale
  // plutôt que sur une donnée précise (pas de mesure du temps de gestion
  // par rayon dans NEXUS aujourd'hui).
  // ------------------------------------------------------------
  const POOL_MANAGEMENT = {
    critique: ['Informez le responsable.', 'Priorisez ce rayon.'],
    attention: ['Traitez ce rayon en premier.', 'Parlez-en aux employés concernés.'],
    normal: ['Aucune intervention nécessaire.'],
  };
  NexusVocab.management = function (niveau, seed) { return pick(POOL_MANAGEMENT[niveau], seed); };

  // ------------------------------------------------------------
  // 15. Prévision — toujours conditionnelle ("si la tendance se
  // poursuit"), jamais un chiffre présenté comme acquis. N'accepte que
  // des évolutions déjà calculées à partir de périodes comparables.
  // ------------------------------------------------------------
  NexusVocab.prevision = function (evolutionPct) {
    if (evolutionPct == null) return null;
    return `Si la tendance se poursuit au même rythme, ce serait une évolution de l'ordre de ${evolutionPct >= 0 ? '+' : ''}${(evolutionPct * 100).toFixed(1)} % sur la prochaine période comparable — une hypothèse, pas un engagement chiffré.`;
  };

  // ------------------------------------------------------------
  // 16. Réalité vs instinct — spécifique à NEXUS.
  // ------------------------------------------------------------
  const POOL_REALITE = [
    'Les chiffres ne confirment pas l\'impression du terrain.',
    'Ce produit paraît important, mais les chiffres disent autre chose.',
  ];
  NexusVocab.realiteVsInstinct = function (seed) { return pick(POOL_REALITE, seed); };

  // ------------------------------------------------------------
  // 17. Vocabulaire signature NEXUS — les termes qui doivent devenir
  // reconnaissables. Utilisés comme labels de statut/verdict, pas comme
  // phrases complètes.
  // ------------------------------------------------------------
  NexusVocab.SIGNATURE = {
    LEVIER_DE_VALEUR: 'Levier de valeur',
    CREATEUR_DE_VALEUR: 'Créateur de valeur',
    DESTRUCTEUR_DE_VALEUR: 'Destructeur de valeur',
    PRODUIT_LOCOMOTIVE: 'Produit locomotive',
    PRODUIT_DORMANT: 'Produit dormant',
    PRODUIT_DE_TRAFIC: 'Produit de trafic',
    RAYON_DE_DESTINATION: 'Rayon de destination',
    CAPITAL_IMMOBILISE: 'Capital immobilisé',
    POTENTIEL_INEXPLOITE: 'Potentiel inexploité',
    DECISION_PRIORITAIRE: 'Décision prioritaire',
    ACTION_A_FORT_IMPACT: 'Action à fort impact',
    SIGNAL_FAIBLE: 'Signal faible',
    SIGNAL_CRITIQUE: 'Signal critique',
    INDICE_DE_CONFIANCE: 'Indice de confiance',
    SITUATION_MAITRISEE: 'Situation maîtrisée',
    ECART_SILENCIEUX: 'Écart silencieux',
    CREATION_DE_CAPITAL_NEXUS: 'Création de Capital NEXUS',
    DECISION_VALIDEE: 'Décision validée',
    OPPORTUNITE_DETECTEE: 'Opportunité détectée',
    RISQUE_IDENTIFIE: 'Risque identifié',
  };

  // ------------------------------------------------------------
  // 18. Tempo V2 — l'encadré « En bref ».
  // Rien n'est décidé ici : l'appelant fournit le libellé déjà posé par la page
  // (la tendance vient de G5), le lexique ne donne que les mots. Aucun seuil.
  // Retourne null quand il ne peut pas choisir.
  // ------------------------------------------------------------
  const EN_BREF_SUJETS = {
    Piste: { neutre: 'les volumes de carburant', possessif: 'ses volumes de carburant' },
    Boutique: { neutre: 'la marge boutique', possessif: 'sa marge boutique' },
    FDJ: { neutre: 'le chiffre d’affaires FDJ', possessif: 'le chiffre d’affaires FDJ' },
  };
  const EN_BREF_MOUVEMENT = {
    hausse: { singulier: 'progresse', pluriel: 'progressent' },
    baisse: { singulier: 'recule', pluriel: 'reculent' },
  };
  NexusVocab.enBref = {
    // Libellé de tendance déjà posé sur la carte -> 'stable' | 'hausse' | 'baisse' | 'inconnu'.
    classe: function (libelle) {
      const t = String(libelle || '').trim();
      if (!t || t === 'Tendance non déterminée') return 'inconnu';
      if (/Variation habituelle|stable/i.test(t)) return 'stable';
      if (/hausse/i.test(t)) return 'hausse';
      if (/baisse/i.test(t)) return 'baisse';
      return 'inconnu';
    },
    sujet: function (activite, possessif) {
      const s = EN_BREF_SUJETS[activite];
      return s ? (possessif ? s.possessif : s.neutre) : null;
    },
    maintient: 'La station maintient',
    // « progresse de 20,9 % », « reculent » : le pourcentage n'est donné que par l'appelant, jamais pour un état stable.
    mouvement: function (classe, pluriel, pct) {
      const m = EN_BREF_MOUVEMENT[classe];
      if (!m) return null;
      return (pluriel ? m.pluriel : m.singulier) + (pct ? ' de ' + pct : '');
    },
    contraste: 'tandis que',
    absente: 'aucune comparaison n’est disponible pour',
    attention: 'Un changement mérite toutefois votre attention : ',
    aNoter: 'À noter aussi : ',
    // Seule la Piste a un total qui peut masquer un carburant : le sens vient de la découverte.
    masquee: function (activite, sens) {
      if (activite !== 'Piste') return null;
      // Le nom diffère volontairement du mot du titre de la découverte (« en baisse » ... « un recul »).
      const nom = sens === 'baisse' ? 'un recul' : sens === 'hausse' ? 'une progression' : null;
      return nom ? nom + ' que le volume total de la piste masque en partie' : null;
    },
    prudence: 'La comparaison avec la période précédente reste fragile. Ces évolutions sont à interpréter avec prudence.',
  };

  // ------------------------------------------------------------
  // Cycle de construction — Constat → Explication → Décision.
  // Aide à assembler les trois lignes dans le bon ordre et avec la bonne
  // séparation visuelle ; ne génère pas le contenu (fourni par l'appelant),
  // impose juste la structure pour que toutes les pages NEXUS parlent pareil.
  // ------------------------------------------------------------
  NexusVocab.cycle = function (constat, explication, decision) {
    return { constat, explication, decision };
  };

  // ------------------------------------------------------------
  // Tempo V2 : jours fériés et ponts. Le moteur ne rend que des chiffres
  // et des états ; toute la phrase affichée vit ici.
  // ------------------------------------------------------------
  const FERIES_JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const feriesJour = iso => FERIES_JOURS[new Date(iso + 'T12:00:00Z').getUTCDay()];
  const feriesCourte = iso => iso.split('-').reverse().slice(0, 2).join('/');
  const feriesPct = p => (p >= 0 ? '+' : '\u2212') + Math.abs(p).toFixed(1).replace('.', ',') + ' %';
  const feriesNb = n => Math.round(n).toLocaleString('fr-FR');
  const feriesCap = t => t.charAt(0).toUpperCase() + t.slice(1);
  // « Pont, lendemain de X » (nom du moteur) -> « pont après le férié X » ; le moteur garde son nom, l'écran garde ce texte.
  function feriesQualif(type, nom, sens) {
    if (type === 'ferie') return nom || 'férié';
    const s = sens || (/lendemain/i.test(nom || '') ? 'lendemain' : /veille/i.test(nom || '') ? 'veille' : '');
    const f = String(nom || '').replace(/^.*?(?:lendemain|veille) de\s+/i, '');
    if (s === 'lendemain') return 'pont après le férié ' + f;
    if (s === 'veille') return 'pont avant le férié ' + f;
    return 'pont';
  }
  NexusVocab.feries = {
    titre: 'Jours fériés et ponts',
    // Une ligne par jour spécial travaillé : jour du moteur, unité (« L », « € »).
    ligneJour: function (j, unite) {
      const tete = feriesCap(feriesJour(j.date)) + ' ' + feriesCourte(j.date) + ' (' + feriesQualif(j.type, j.nom, j.sens) + ') : ';
      if (j.etat !== 'comparable') {
        const motif = j.raison === 'jour_incomplet'
          ? 'journée incomplète, non comparable'
          : 'pas assez de ' + feriesJour(j.date) + 's habituels pour comparer';
        return tete + motif;
      }
      const ex = (j.reference && j.reference.exclus) || [];
      const hors = !ex.length ? '' : ex.length === 1
        ? ', hors journée exceptionnelle du ' + feriesCourte(ex[0])
        : ', hors journées exceptionnelles du ' + ex.map(feriesCourte).join(' et du ');
      return tete + feriesNb(j.valeur) + ' ' + unite + ', soit ' + feriesPct(j.ecartPct) + ' par rapport à un ' + feriesJour(j.date) + ' habituel' + hors;
    },
    aucun: 'Aucun jour férié ni pont dans la période étudiée.',
    // Effet moyen par type ; en dessous du minimum, le compteur « n sur 4 » remplace le pourcentage.
    effet: function (e) {
      const nom = e.type === 'pont' ? 'ponts' : 'jours fériés';
      if (e.etat !== 'ok') return 'Pas encore assez de ' + nom + ' observés pour dégager un effet : ' + e.n + ' sur ' + e.min + '.';
      return 'Effet moyen des ' + nom + ' (' + e.n + ' observés) : ' + feriesPct(e.ecartPct) + ' par rapport à un jour habituel.';
    },
    prochains: function (liste) {
      if (!liste || !liste.length) return 'Aucun pont à venir dans les deux prochaines années.';
      return 'Prochains ponts : ' + liste.map(function (p) {
        return feriesJour(p.date) + ' ' + p.date.split('-').reverse().join('/') + ' (' + feriesQualif('pont', p.nom, null) + ')';
      }).join(', ') + '.';
    },
    boutique: 'Les jours fériés et les ponts ne sont pas comparés pour la boutique : la marge vient d\u2019imports qui couvrent des périodes, pas des journées.',
  };

  // ------------------------------------------------------------
  // Campagne NEXUS V2 (13/11/2026) : refonte visuelle, presentation seule.
  // Aucun chiffre ni qualification de rentabilite n'est defini ici.
  // ------------------------------------------------------------
  NexusVocab.campagne = {
    titre: 'Campagne NEXUS',
    sousTitre: 'Vos promotions, en clair',
    menu: '☰ Menu',
    conseillerTitre: 'Conseiller NEXUS',
    conseillerSousTitre: 'Votre point commercial',
    conseillerEnCours: function (nom, nbProduits, mesure) {
      var p = nbProduits === 0 ? 'sans produit précisé' : (nbProduits === 1 ? 'avec 1 produit en promotion' : 'avec ' + nbProduits + ' produits en promotion');
      return nom + ' est en cours ' + p + '. ' + (mesure
        ? 'Sa compensation des remises est mesurée : vous la retrouvez dans le suivi.'
        : 'Pour suivre sa rentabilité, il reste à compléter les données de compensation.');
    },
    conseillerDernierBilan: function (nom) { return 'Dernier bilan : ' + nom + '.'; },
    conseillerSansEnCours: 'Aucune promotion n’est en cours aujourd’hui.',
    conseillerAucune: 'Aucune promotion n’est déclarée pour l’instant.',
    conseillerCompte: function (total, enCours, terminees, aVenir) {
      var s = total + (total > 1 ? ' promotions déclarées' : ' promotion déclarée');
      var p = [];
      if (enCours) p.push(enCours + ' en cours');
      if (terminees) p.push(terminees + (terminees > 1 ? ' terminées' : ' terminée'));
      if (aVenir) p.push(aVenir + ' à venir');
      return s + (p.length ? ' : ' + p.join(', ') : '') + '.';
    },
    conseillerDerniere: function (nom, debut, fin) {
      return 'Promotion analysée : « ' + nom + ' », du ' + debut + ' au ' + fin + '.';
    },
    conseillerNonMesurable: 'Sa rentabilité n’est pas mesurable : les ventes par produit avant et pendant la promotion n’ont pas été importées.',
    conseillerSansProduit: 'Sa rentabilité n’est pas mesurable : aucun produit précis n’est associé à cette promotion.',
    conseillerProduitsImportes: 'Les ventes par produit sont importées. Aucune qualification de rentabilité n’est encore définie.',
    bilan: {
      blocTitre: 'Dernier bilan',
      objectif: 'Objectif',
      produits: function (n) { return n === 0 ? 'Aucun produit précisé' : (n === 1 ? '1 produit' : n + ' produits'); },
      jours: function (n) { return n + (n > 1 ? ' jours' : ' jour'); },
      parJour: ' par jour',
      tuiles: { ca: 'CA Boutique', frequentation: 'Fréquentation', panier: 'Panier moyen TTC', marge: 'Rentabilité' },
      ticketsParJour: 'tickets par jour',
      g5: {
        hausse_nette: 'en hausse nette',
        baisse_nette: 'en baisse nette',
        variation_habituelle: 'dans la variation habituelle',
        non_mesurable: 'pas assez de jours pour comparer'
      },
      vsAvant: function (evolution, moyenneAvant) { return evolution + ' par rapport à avant (' + moyenneAvant + ')'; },
      fenetre: function (n) { return 'Comparé aux ' + n + (n > 1 ? ' jours' : ' jour') + ' précédant la campagne'; },
      graphTitre: 'Évolution du CA Boutique',
      graphJours: function (n) { return n + (n > 1 ? ' jours' : ' jour'); },
      rentaTitre: 'Rentabilité de la campagne',
      rentaManqueCourt: 'Données de marge à compléter',
      rentaManque: 'Pour la mesurer, il faut saisir produit par produit le stock, les prix et les livraisons.',
      rentaGain: 'Gain après coûts',
      retenirTitre: 'À retenir',
      retenirCa: function (g5, ventes) { return (ventes || 'Les ventes de la Boutique') + ' sont ' + g5 + '.'; },
      retenirTickets: function (g5) { return 'La fréquentation est ' + g5 + '.'; },
      retenirPanier: function (g5) { return 'Le panier moyen est ' + g5 + '.'; },
      retenirPasAssez: 'Pas assez de jours pour comparer cet indicateur.',
      bilanComplet: 'Voir le bilan complet →',
      modifierCampagne: 'Modifier la campagne',
      graphSousTitre: function (n) { return 'CA moyen par jour · comparaison avec les ' + n + ' jours de référence retenus'; },
      bilanReduire: 'Masquer le bilan complet',
      mesurerLien: 'Mesurer la compensation',
      terminees: 'Campagnes passées',
      ouvrir: 'Ouvrir le bilan',
      secondaires: 'Chiffres secondaires',
      periodes: 'Périodes comparées',
      produitsListe: 'Produits en promotion',
      aucunProduit: 'Aucun produit précis n’est associé à cette campagne.',
      apresLigne: 'Après la campagne',
      aucuneTerminee: 'Aucune campagne terminée à analyser pour l’instant.',
      // Phrases validées par Frédéric (arbitrage du 13/11/2026). Le nom et le sens viennent des données.
      types: {
        boutique: { tuile: 'CA Boutique', graphTitre: 'Évolution du CA Boutique', ventes: 'Les ventes de la Boutique' },
        carburant: { tuile: 'CA Piste', graphTitre: 'Évolution du CA Piste', ventes: 'Les ventes de la Piste' },
        mixte: { tuile: 'CA Piste et Boutique', graphTitre: 'Évolution du CA Piste et Boutique', ventes: 'Les ventes de la Piste et de la Boutique' }
      },
      jourEcarteTitre: 'Jours écartés de la comparaison',
      jourEcarteRaison: 'un seul quart saisi',
      joursEcartesIntro: 'Ces jours ne comptent pas dans la comparaison, car les deux quarts ne sont pas saisis :',
      periodeNom: { avant: 'avant', pendant: 'pendant', apres: 'après' },
      // Phrase de rentabilité, tirée de l’état mesuré par le moteur de compensation.
      rentaPhrase: function (etat, gainTexte) {
        var apres = gainTexte ? ', ' + gainTexte + ' après coûts' : '';
        if (etat === 'encourageante' || etat === 'a_renouveler') return 'La remise a été compensée : rentabilité ' + (etat === 'a_renouveler' ? 'à renouveler' : 'encourageante') + apres + '.';
        if (etat === 'a_ameliorer') return 'La remise a été presque compensée : rentabilité à améliorer' + apres + '.';
        if (etat === 'insuffisante') return 'La remise n’a pas été compensée : rentabilité insuffisante' + apres + '.';
        return '';
      },
      // Phrases validées par Frédéric (arbitrage du 13/11/2026). Le nom et le sens viennent des données.
      conclusion: function (nom, ca, tickets, panier, renta) {
        var nette = function (x) { return x && x.label !== 'non_mesurable' && x.label !== 'variation_habituelle'; };
        if (!ca || !tickets || ca.label === 'non_mesurable' || tickets.label === 'non_mesurable') {
          return 'Pendant ' + nom + ', il n’y a pas assez de jours pour comparer les ventes et le nombre de tickets à la période d’avant.';
        }
        var fin = (renta && renta.mesurable && renta.etat) ? NexusVocab.campagne.bilan.rentaPhrase(renta.etat, renta.gainTexte) : '';
        var reste = fin || 'Reste à vérifier si le volume vendu a compensé les remises accordées.';
        var memeSens = ca.sens && ca.sens === tickets.sens;
        if (ca.label === 'hausse_nette' && tickets.label === 'hausse_nette') {
          var clause = '';
          if (panier && panier.label === 'baisse_nette') clause = ', malgré un panier moyen légèrement inférieur';
          else if (panier && panier.label === 'hausse_nette') clause = ', avec un panier moyen plus élevé';
          return 'Pendant ' + nom + ', les ventes et le nombre de tickets ont augmenté' + clause + '. ' + (fin || 'Reste à vérifier si le volume supplémentaire a compensé les remises accordées.');
        }
        if (!nette(ca) && !nette(tickets) && memeSens) {
          var plus = ca.sens === 'hausse' ? 'plus élevés' : 'plus bas';
          return 'Pendant ' + nom + ', les ventes et le nombre de tickets ont été un peu ' + plus + ' qu’avant, sans sortir de la variation habituelle. ' + reste;
        }
        var g = function (x, sing) {
          if (x.label === 'variation_habituelle') return sing ? 'reste dans la variation habituelle' : 'restent dans la variation habituelle';
          return (sing ? 'est en ' : 'sont en ') + (x.label === 'hausse_nette' ? 'hausse nette' : 'baisse nette');
        };
        return 'Pendant ' + nom + ', les ventes ' + g(ca, false) + ' et le nombre de tickets ' + g(tickets, true) + '. ' + reste;
      }
    },
    boutonNouvelle: '➕ Nouvelle promotion',
    boutonAnnuler: '✕ Annuler',
    enCoursTitre: 'En cours',
    enCoursAucune: 'Aucune promotion en cours aujourd’hui.',
    derniereTitre: 'Dernière promotion terminée',
    derniereAucune: 'Aucune promotion terminée pour l’instant.',
    outilsTitre: 'Mes outils commerciaux',
    enCoursSurtitre: 'Votre promotion en cours',
    enCours: {
      periode: function (debut, fin, jours) { return 'Du ' + debut + ' au ' + fin + ' · ' + jours; },
      avancement: 'Avancement de la promotion',
      jourSur: function (n, m) { return 'Jour ' + n + ' sur ' + m; },
      calendrier: 'Avancement dans le calendrier, pas un résultat commercial.',
      produits: 'Produits en promotion',
      compensation: 'Compensation des remises',
      aMesurer: 'À mesurer',
      bilan: 'Bilan commercial',
      enAttente: 'En attente',
      suivre: 'Suivre ma promotion',
      modifier: 'Modifier',
      actualiser: 'Actualiser mes ventes',
      livraison: 'Nouvelle livraison',
      derniereActu: function (d) { return 'Dernière actualisation des ventes : ' + d; },
      aucuneActu: 'Aucune actualisation des ventes pour l’instant.',
      prochaine: function (txt) { return 'Prochaine action : ' + txt; },
      prochaineActualiser: 'Actualiser mes ventes',
      labelDerniere: 'Dernière actualisation des ventes', labelProchaine: 'Prochaine action', aucune: 'Aucune',
      rienAFaire: 'Aucune pour l’instant',
      echeances: { actualiser_j14: 'Actualiser mes ventes', actualiser_j7: 'Actualiser mes ventes', actualiser_fin: 'Actualiser mes ventes', achats: 'Préparer les achats' }
    },
    historiqueAucune: 'Aucune autre campagne terminée pour l’instant.',
    enPreparation: 'En préparation',
    cartes: [
      { cle: 'promotions', titre: 'Mes promotions', texte: 'Préparer et suivre mes campagnes.' },
      { cle: 'compensation', dispo: true, titre: 'Le volume compense-t-il la remise ?', texte: 'Mesurer la marge préservée.' },
      { cle: 'objectifs', dispo: true, picto: 'objectif-commercial', titre: 'Mes objectifs de vente', texte: 'Fixer le volume à vendre par produit.' },
      { cle: 'opportunites-achat', picto: 'a-retenir', titre: 'Mes opportunités d’achat', texte: 'Repérer les achats à saisir.' },
      { cle: 'produits-moteurs', titre: 'Mes produits moteurs', texte: 'Identifier les gains de marge.' },
      { cle: 'produits-a-revoir', titre: 'Mes produits à revoir', texte: 'Repérer les pertes de marge.' },
      { cle: 'simulateur', dispo: true, titre: 'Simuler une promotion', texte: 'Tester mes prix et mes volumes.' },
      { cle: 'renouveler', titre: 'Quelles promotions renouveler ?', texte: 'Retrouver les campagnes rentables.' },
    ],
    objectifsPage: {
      eyebrow: 'Campagne', titre: 'Mes objectifs de vente', sous: 'Un volume à tenir par produit, calculé sur vos prix.',
      retour: '‹ Campagne', choisir: 'Promotion', aucuneCampagne: 'Aucune promotion déclarée pour l’instant.',
      comparaison: 'Voir les détails du calcul',
      methode: 'Le volume proposé est le plus petit nombre d’unités par jour qui préserve la marge habituelle sur toute la durée de la promotion, arrondi à l’unité supérieure.',
    },
    ventesPage: {
      eyebrow: 'Campagne', titre: 'Actualiser mes ventes', sous: 'Un fichier de ventes, une date de fin, et le suivi se met à jour.',
      retour: '‹ Campagne', choisir: 'Promotion', aucuneCampagne: 'Aucune promotion déclarée pour l’instant.',
      etape1: '1. Le fichier de ventes', etape2: '2. Date de fin des ventes', etape3: '3. Contrôle du fichier',
      dateAide: 'Dernier jour couvert par le fichier. Au plus tard la veille, et au plus tard la fin de la promotion.',
      analyser: 'Contrôler le fichier', publier: 'Enregistrer ce point de ventes',
      fichierLu: function (n) { return n + ' ligne' + (n > 1 ? 's' : '') + ' lue' + (n > 1 ? 's' : '') + '.'; },
      colonnesManquantes: function (l) { return 'Colonne(s) non détectée(s) : ' + l + '.'; },
      ignores: function (n) { return n + ' article' + (n > 1 ? 's' : '') + ' du fichier ne fait' + (n > 1 ? 'font' : '') + ' pas partie de la promotion : ignoré' + (n > 1 ? 's' : '') + '.'; },
      absents: function (n) { return n + ' article' + (n > 1 ? 's' : '') + ' de la promotion absent' + (n > 1 ? 's' : '') + ' du fichier : compté' + (n > 1 ? 's' : '') + ' à 0.'; },
      toutPresent: 'Tous les articles de la promotion sont dans le fichier.',
      erreur: 'L’enregistrement a échoué. Rien n’a été modifié, réessayez.',
      fait: function (n) { return 'Point de ventes enregistré (' + n + ' article' + (n > 1 ? 's' : '') + ').'; },
      vide: 'Aucun import depuis le début de la promotion.',
      pointDu: function (d) { return 'Ventes arrêtées au ' + d + '.'; },
      colArticle: 'Article', colVendu: 'Vendu', colSeuil: 'Seuil', colEffort: 'À vendre par jour', colMarge: 'Marge HT', colStatut: 'Situation',
      moteur: 'Moteur', aRevoir: 'À revoir', nonMesurable: 'Sans objectif',
      atteint: 'Seuil atteint', termine: 'Promotion terminée', absentMarque: 'absent du fichier',
      parJour: function (n) { return n + ' / jour'; },
      margeInconnue: 'PA promo inconnu', margeEstimee: 'estimée', detail: 'Détail', labelEffort: 'À vendre par jour', labelMarge: 'Marge HT',
      historique: 'Historique des imports', annule: 'Annulé', motif: 'Motif',
      lienActualiser: 'Actualiser mes ventes',
      echecPublication: function (r) { return 'L’enregistrement a échoué : ' + r + ' Le dépôt est marqué en échec, rien n’est compté.'; },
      caEstime: 'CA estimé (quantité x prix HT)', caFichier: 'CA du fichier',
      annulerImport: 'Annuler cet import', motifDemande: 'Motif de l’annulation (obligatoire)',
      motifRequis: 'Le motif est obligatoire pour annuler un import.',
      annulationFaite: 'Import annulé. Le point précédent fait de nouveau foi.',
      annulationEchec: 'L’annulation a échoué. Rien n’a été modifié, réessayez.',
      annuler: 'Annuler', confirmerAnnulation: 'Confirmer l’annulation',
      ligneHisto: function (vente, importe) { return 'Ventes au ' + vente + ' · importé le ' + importe; },
      voirObjectifs: 'Voir mes objectifs',
      csvVirgule: 'Ce fichier CSV est lu tel quel : les nombres avec une virgule décimale sont acceptés.',
      choisirColonne: function (champ) { return 'Colonne « ' + champ + ' »'; },
      colonneAChoisir: 'Choisir la colonne',
      colonnesAChoisir: 'Certaines colonnes ne sont pas reconnues. Indiquez laquelle correspond à chaque champ.',
    },
    historiqueTitre: 'Historique des promotions',
    historiqueIntro: 'Comparaison brute, non testée',
    historiqueNote: 'Les chiffres ci-dessous comparent des moyennes. Ils ne disent pas si la promotion est rentable.',
    historiqueVide: 'Aucune promotion déclarée pour l’instant. Utilisez « Nouvelle promotion » pour commencer.',
    produitsLigne: 'Produits',
    avant: 'Avant',
    pendant: 'Pendant',
    apres: 'Après',
    tickets: 'Tickets par jour',
    panier: 'Panier moyen',
    nonCalculable: function (nbAvant, nbPendant, min) {
      return 'Comparaison impossible : il faut au moins ' + min + ' jours avant et ' + min + ' jours pendant (' + nbAvant + ' avant, ' + nbPendant + ' pendant).';
    },
    panierAucun: 'Aucun panier moyen importé.',
    panierInsuffisant: 'Panier moyen non comparable : il manque des jours avant ou pendant la période.',
    nonDisponible: 'non disponible',
    parJour: '/j',
    formNom: 'Nom',
    formNomExemple: 'Weekend Heineken',
    formDebut: 'Date début',
    formFin: 'Date fin',
    formType: 'Type',
    formProduits: 'Produits concernés',
    formProduitsSaisie: 'Tapez les premières lettres…',
    formAjouter: 'Ajouter',
    formAucunProduit: 'Aucun produit ajouté pour l’instant (facultatif).',
    suggAjouterSelection: 'Ajouter la sélection ({n})',
    suggTotal: '{n} articles',
    brouillonQuestion: 'Une saisie non enregistrée du {date} à {heure} existe{nom}. Voulez-vous la reprendre ?',
    brouillonNom: ' (« {nom} »)',
    brouillonReprendre: 'Reprendre la saisie',
    brouillonVierge: 'Nouvelle saisie vierge',
    formNature: 'Nature de la promotion',
    formObjectif: 'Objectif',
    formObjectifLibre: 'Ex : Animation Coupe du Monde',
    formValider: 'Valider',
    formEnregistrement: 'Enregistrement…',
    formManque: 'Merci de remplir le nom, les deux dates, le type, la nature et l’objectif.',
    formDates: 'La date de fin doit être après (ou égale à) la date de début.',
    formAutre: 'Précisez l’objectif dans le champ « Autre ».',
    formErreur: 'Erreur à l’enregistrement. Réessayez.',
    formOk: 'Promotion enregistrée ✓',
    consulter: 'Consulter',
    modifier: 'Modifier',
    modifierTitre: 'Modifier la promotion',
    modifierValider: 'Enregistrer les modifications',
    modifierOk: 'Modifications enregistrées ✓',
    modifierErreur: 'Les modifications n’ont pas pu être enregistrées. Réessayez.',
    modifierMesureGardee: 'Ce produit a une mesure enregistrée. Elle reste dans Mesurer la compensation.',
    ficheDates: 'Dates',
    ficheDuree: 'Durée',
    ficheType: 'Type',
    ficheNature: 'Nature',
    ficheObjectif: 'Objectif',
    ficheProduits: 'Produits concernés',
    ficheModifiee: 'Modifiée le {date} à {heure}',
    ficheFermer: 'Fermer',
    reserve: 'Cet écran est réservé aux managers.',
    erreurChargement: 'Chargement impossible. Réessayez dans un instant.',
    badgeEnCours: 'En cours',
    badgeTerminee: 'Terminée',
    badgeAVenir: 'À venir',
    etatsTitre: 'Planche de démonstration des cinq états',
    etatsIntro: 'Composant visuel seul. Ces états ne qualifient aucune promotion réelle et aucun seuil n’est défini.',
    mesure: {
      obj: {
        titre: 'Objectifs de vente par produit',
        note: 'Entrez seulement le prix d’achat HT et le prix de vente TTC pendant la promotion. Le reste est proposé et modifiable.',
        paHab: 'Prix d’achat HT habituel', pvHab: 'Prix de vente TTC habituel', paPromo: 'Prix d’achat HT promo', pvPromo: 'Prix de vente TTC promo', tva: 'TVA (%)',
        reference: (v, d, f) => 'Ventes de référence : ' + v + ' par jour, période du ' + d + ' au ' + f + '.',
        sansReference: 'Aucune période de référence trouvée pour ce produit.',
        statuts: {
          'prix-manquant': 'Renseignez les quatre prix pour calculer l’objectif.',
          'tva-manquante': 'TVA à compléter : le calcul est suspendu.',
          'marge-habituelle-nulle': 'La marge habituelle est nulle ou négative : aucun objectif ne peut la compenser.',
          'marge-promo-nulle': 'La marge en promotion est nulle ou négative : vendre davantage ne compense pas.',
          'sans-reference': 'Pas de ventes de référence : objectif impossible à calculer.',
          'aucune-hausse': 'La promotion améliore la marge : aucune hausse de ventes nécessaire.'
        },
        seuil: (s, s10) => 'Seuil : ' + s + ' unités pour garder la marge (' + s10 + ' pour gagner 10 % de plus).',
        rythme: r => 'Rythme minimum : ' + r + ' par jour.',
        objectif: o => 'Objectif proposé : ' + o + ' par jour.',
        faisabilite: { 'depasse-observe': 'L’objectif dépasse les performances observées.', 'dans-observe': 'L’objectif reste dans les performances observées.', 'a-confirmer': 'Objectif calculé, faisabilité à confirmer.' },
        valider: 'Valider les objectifs',
        valide: n => n === 1 ? 'Objectif validé (1 produit).' : 'Objectifs validés (' + n + ' produits).',
        erreur: 'Validation impossible. Réessayez dans un instant.',
        aucunProduit: 'Aucun produit dans cette promotion.',
        habituels: 'Prix habituels proposés',
        champPaPromo: 'Achat HT promo', champPvPromo: 'Vente TTC promo',
        statutCourt: { 'ok': 'À valider', 'prix-manquant': 'Prix à compléter', 'tva-manquante': 'TVA à compléter', 'marge-habituelle-nulle': 'Marge habituelle nulle', 'marge-promo-nulle': 'Marge promo nulle', 'sans-reference': 'Sans référence', 'aucune-hausse': 'Aucune hausse requise' },
        faisabiliteCourte: { 'depasse-observe': 'Au-dessus de l’observé', 'dans-observe': 'Dans l’observé', 'a-confirmer': 'À confirmer' },
        objectifCourt: o => o + ' par jour',
        versionCourte: (v, o) => 'Version ' + v + ' : ' + o + ' par jour',
        sansVersion: 'Pas encore validé',
        valideCourt: 'Validé',
        versionLigne: (v, o) => 'Version ' + v + ' validée : ' + o + ' par jour.',
        objectifInitial: o => 'Objectif initial : ' + o + ' par jour.'
      },
      titre: 'Mesurer la compensation',
      intro: 'Pour chaque produit, comparez ce que la remise a coûté à ce que les ventes en plus ont rapporté.',
      choisir: 'Promotion à mesurer',
      choisirVide: 'Choisissez une promotion',
      aucuneCampagne: 'Aucune promotion à mesurer pour l’instant.',
      fermer: 'Fermer',
      ajouterProduit: 'Ajouter un produit',
      retirer: 'Retirer',
      produit: 'Produit',
      nouveauProduit: 'Produit nouveau (lancement)',
      ventesMois: 'Ventes du mois précédent (unités)',
      joursRef: 'Jours de référence',
      joursDefaut: '30 jours par défaut',
      achatAvant: 'Prix d’achat HT avant',
      achatPendant: 'Prix d’achat HT pendant la promotion',
      venteAvant: 'Prix de vente HT avant',
      ventePendant: 'Prix de vente HT pendant la promotion',
      stockDebut: 'Stock au début',
      stockFin: 'Stock à la fin',
      livraisons: 'Livraisons reçues pendant la promotion',
      pertes: 'Pertes (information)',
      pertesNote: 'Les pertes sont comptées comme des ventes. Elles sont affichées pour information.',
      prefillNote: 'Valeurs proposées, modifiables. La source est indiquée sous chaque stock.',
      achatNetNote: 'Prix d’achat calculé avec la remise habituelle de la fiche fournisseur.',
      achatDecenium: 'Coût Decenium : la remise fournisseur habituelle n’est peut-être pas incluse.',
      sources: { comptage: 'Source : comptage NEXUS', decenium: 'Source : relevé Decenium', saisie: 'Source : saisie' },
      sourceAucune: 'Source : à saisir',
      enregistrer: 'Enregistrer cette mesure',
      enregistre: 'Mesure enregistrée.',
      erreurEnregistrement: 'Enregistrement impossible. Réessayez dans un instant.',
      coutsTitre: 'Coûts de l’opération',
      coutsNote: 'Affiche, publicité, animation : tout ce qui a coûté en plus de la remise (HT).',
      coutLibelle: 'Libellé du coût',
      coutMontant: 'Montant HT',
      coutAjouter: 'Ajouter un coût',
      fournisseurTitre: 'Fiche fournisseur',
      fournisseurNote: 'Remise habituelle seulement. Elle sert à estimer le prix d’achat net.',
      fournisseurNom: 'Fournisseur',
      fournisseurRemise: 'Remise habituelle (%)',
      fournisseurEnregistrer: 'Enregistrer la fiche',
      fournisseurEnregistre: 'Fiche enregistrée.',
      resultatTitre: 'Résultat',
      parProduit: 'Par produit',
      campagne: 'Toute la promotion',
      taux: 'Compensation',
      tauxNote: 'Marge par jour pendant la promotion, divisée par la marge par jour avant.',
      seuil: 'Ventes par jour pour compenser',
      ventesJourPendant: 'Ventes par jour pendant',
      gain: 'Gain de marge',
      gainApresCouts: 'Gain après coûts',
      couts: 'Coûts',
      impossible: 'Impossible à compenser : la marge unitaire pendant la promotion est nulle ou négative.',
      lancement: 'Lancement : pas de comparaison avec un avant. Marge réalisée pendant la promotion :',
      prixSousNormal: 'Le prix de vente est plus bas que le prix normal : vérifiez que la promotion est bien déclarée.',
      manquants: 'Valeurs manquantes :',
      partMesurable: (p) => 'Produits mesurables : ' + p + ' % de la marge d’avant.',
      pasAssez: 'Pas assez de produits mesurés pour conclure sur la promotion.',
      champs: {
        jours: 'durée', stockDebut: 'stock au début', stockFin: 'stock à la fin', achatPendant: 'prix d’achat pendant',
        ventePendant: 'prix de vente pendant', ventesMoisPrecedent: 'ventes du mois précédent', achatAvant: 'prix d’achat avant',
        venteAvant: 'prix de vente avant'
      },
      etats: {
        non_mesurable: 'Non mesurable',
        insuffisante: 'Compensation insuffisante',
        a_ameliorer: 'À améliorer',
        encourageante: 'Encourageante',
        a_renouveler: 'À renouveler',
        lancement: 'Lancement'
      },
      etatsNote: {
        non_mesurable: 'Il manque des valeurs pour conclure.',
        insuffisante: 'Les ventes en plus ne couvrent pas la remise : moins de 90 % de la marge d’avant.',
        a_ameliorer: 'La marge reste un peu en dessous de celle d’avant : entre 90 et 100 %.',
        encourageante: 'La marge est au niveau d’avant ou au-dessus, mais le gain après coûts reste modeste.',
        a_renouveler: 'La marge dépasse de 10 % celle d’avant et le gain après coûts atteint 100 €.',
        lancement: 'Produit nouveau : seule la marge réalisée est affichée.'
      }
    },
    sim: {
      titre: 'Simuler une promotion',
      banniere: 'Simulation : ce n’est pas un résultat',
      banniereTexte: 'Rien n’est enregistré. Les chiffres ci-dessous viennent des valeurs saisies.',
      fermer: 'Fermer',
      article: 'Article (facultatif)',
      articleSaisie: 'Tapez les premières lettres…',
      ajouterProduit: 'Ajouter un produit',
      retirer: 'Retirer',
      produit: 'Produit',
      ventesMois: 'Ventes du mois précédent (unités)',
      achatAvant: 'Prix d’achat HT avant',
      achatPendant: 'Prix d’achat HT pendant la promotion',
      venteAvant: 'Prix de vente TTC avant',
      ventePendant: 'Prix de vente TTC pendant la promotion',
      tva: 'TVA (%)',
      tvaAComplete: 'TVA à compléter : le calcul est suspendu.',
      duree: 'Durée de la promotion (jours)',
      aideAchat: 'Aide au prix d’achat',
      prixCatalogue: 'Prix catalogue HT',
      remise: 'Remise (%)',
      prixNet: 'Prix d’achat net',
      appliquer: 'Utiliser ce prix',
      source: (d, f) => 'Import du ' + d + ' au ' + f,
      coutDecenium: 'Coût Decenium : la remise fournisseur habituelle n’est peut-être pas incluse.',
      prixBas: (recente, reference) => 'La période la plus récente (' + recente + ') a un prix moyen bas : promotion possible. La référence est prise sur le ' + reference + '.',
      prixNormal: 'Prix normal (TTC)',
      prixNormalNote: 'Le plus haut prix moyen des 12 derniers mois. Corrigez-le si besoin, sans enregistrement.',
      rappelTitre: 'Promotions passées de cet article',
      rappelLigne: (periode, prix, parJour) => periode + ' : ' + prix + ' HT, ' + parJour + ' par jour',
      resultat: 'Résultat de la simulation',
      margeAvant: 'Marge unitaire avant',
      margePendant: 'Marge unitaire pendant',
      ratio: 'Rapport des marges',
      ventesEquilibre: 'Ventes pour compenser',
      ventesRenouveler: 'Ventes pour une marge supérieure de 10 %',
      hausseEquilibre: 'Hausse nécessaire',
      hausseRenouveler: 'Hausse nécessaire pour la marge supérieure de 10 %',
      impossible: 'Impossible à compenser : une des deux marges est nulle ou négative.',
      hypotheses: 'Hypothèses de volume',
      colHypothese: 'Hypothèse',
      colVolume: 'Ventes',
      colMarge: 'Marge totale',
      colEcart: 'Écart avec le volume habituel',
      hyp: {
        'habituel': 'Volume habituel',
        'hausse-25': 'Hausse de 25 %',
        'hausse-50': 'Hausse de 50 %',
        'hausse-100': 'Hausse de 100 %',
        'equilibre': 'Volume de compensation',
        'renouveler': 'Volume de compensation plus 10 %',
      },
      total: 'Total des produits',
      totalNote: 'Les marges sont additionnées en euros.',
      lancement: 'Lancement',
      lancementTexte: 'Aucune vente le mois précédent : calcul du coût de lancement.',
      venteNormale: 'Prix de vente HT normal',
      coutLancement: 'Coût de lancement',
      margePromo: 'Marge pendant la promotion',
      venteAPerte: 'Vente à perte',
      irrecuperable: 'Coût irrécupérable',
      colMensuel: (n) => 'Ventes par mois pour récupérer en ' + n + ' mois',
      lancementVolumes: 'Volumes hypothétiques pendant la promotion',
      colCout: 'Coût',
      vide: 'Saisissez au moins un produit.',
    },
    etats: [
      { cle: 'insuffisante', libelle: 'Insuffisante' },
      { cle: 'a-ameliorer', libelle: 'À améliorer' },
      { cle: 'encourageante', libelle: 'Encourageante' },
      { cle: 'a-renouveler', libelle: 'À renouveler' },
      { cle: 'non-mesurable', libelle: 'Non mesurable' },
    ],
  };

  // Carte « Mois » de Tempo V2 (12/11/2026) : tous les mots de la page et des infobulles.
  const moisNb = v => Math.round(v).toLocaleString('fr-FR');
  NexusVocab.mois = {
    titreOnglet: 'NEXUS — Tempo · Mois',
    titre: 'Mois par mois',
    sousTitre: 'Une barre par mois écoulé, en moyenne par jour complet.',
    courts: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
    piste: { titre: 'Piste', unite: 'litres par jour complet', depuis: 'Depuis août 2026.', suffixe: ' L' },
    fdj: { titre: 'FDJ', unite: 'chiffre d’affaires par jour complet', depuis: 'Depuis janvier 2026.', suffixe: ' €' },
    nonRetenu: 'non retenu',
    nonRetenuLong: 'Ce mois n’a pas assez de jours complets pour être comparé.',
    moyenne: (v, a) => 'Moyenne : ' + moisNb(v) + a.suffixe + ' par jour',
    jours: n => n + ' jour' + (n > 1 ? 's' : '') + ' complet' + (n > 1 ? 's' : ''),
    evolution: (label, pct) => 'Par rapport au mois précédent : ' + label.toLowerCase() + (pct == null ? '' : ' (' + (Math.round(pct * 10) > 0 ? '+' : Math.round(pct * 10) < 0 ? '−' : '') + Math.abs(pct).toFixed(1).replace('.', ',') + ' %)'),
    sansEvolution: 'Aucune comparaison avec le mois précédent.',
    fiabilite: 'Comparaison fragile',
    mentionManquants: m => 'Jour manquant : ' + m,
    aucuneDonnee: 'Aucun mois écoulé n’est encore mesuré.',
    tableau: 'Voir les valeurs en tableau',
    entetes: { mois: 'Mois', moyenne: 'Moyenne par jour', jours: 'Jours complets', evolution: 'Évolution', remarque: 'Remarque' },
    boutique: { titre: 'Boutique', phrase: 'Pas de chiffre mois par mois pour la boutique : la marge vient d’imports qui couvrent des périodes, pas des dates.', periodes: (liste) => liste.length ? 'Périodes importées : ' + liste.join(', ') + '.' : 'Aucun import n’est disponible.' },
    anneePrecedente: 'Comparaison avec l’année précédente : pas encore possible, il faudra un an de recul (juillet 2027 au plus tôt pour la piste, janvier 2027 pour la FDJ).',
    legendeManquant: 'Point : un jour manquant dans ce mois.',
    legendeNonRetenu: 'Hachuré : mois non retenu.',
  };

  // Carte « Quels sont mes jours forts et faibles ? » : tous les mots viennent d'ici, le moteur n'en porte aucun.
  const MOIS_LONGS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const dateLongue = iso => { const [, m, j] = String(iso).split('-').map(Number); return (j === 1 ? '1er' : j) + ' ' + MOIS_LONGS[m - 1]; };
  const pctSigne = p => { const r = Math.round(Math.abs(p) * 100); return (p > 0 && r > 0 ? '+' : p < 0 && r > 0 ? '−' : '') + r + ' %'; };
  NexusVocab.jours = {
    titreOnglet: 'NEXUS Tempo, Jours',
    titre: 'Jours forts et faibles',
    sousTitre: 'Par activité, sur les mêmes semaines.',
    noms: { 1: 'Lundi', 2: 'Mardi', 3: 'Mercredi', 4: 'Jeudi', 5: 'Vendredi', 6: 'Samedi', 0: 'Dimanche' },
    piste: { titre: 'Piste', unite: 'litres par jour complet', suffixe: ' L', lecture: { verbe: 'enregistre', plus: 'le volume moyen le plus élevé', moins: 'le volume moyen le plus faible' } },
    fdj: { titre: 'FDJ', unite: 'chiffre d’affaires par jour complet', suffixe: ' €', lecture: { verbe: 'réalise', plus: 'le chiffre d’affaires moyen le plus élevé', moins: 'le chiffre d’affaires moyen le plus faible' } },
    ca: { titre: 'CA Boutique, source Verify', unite: 'chiffre d’affaires par jour complet', suffixe: ' €', lecture: { verbe: 'réalise', plus: 'le chiffre d’affaires moyen le plus élevé', moins: 'le chiffre d’affaires moyen le plus faible' }, precision: 'Chiffre d’affaires de la source Verify, pas la marge et pas le chiffre d’affaires du périmètre Produits utilisé pour la marge.', rythme: 'Un jour fort en chiffre d’affaires n’est pas forcément un jour fort en marge.', appel: 'Comprend les produits d’appel (cartes prépayées, tabac, etc.), exclus du calcul de marge Boutique.' },
    boutique: { titre: 'CA Boutique, source Verify', unite: 'chiffre d’affaires par jour complet', suffixe: ' €', lecture: { verbe: 'réalise', plus: 'le chiffre d’affaires moyen le plus élevé', moins: 'le chiffre d’affaires moyen le plus faible' }, precision: 'Chiffre d’affaires de la source Verify, pas la marge et pas le chiffre d’affaires du périmètre Produits utilisé pour la marge.', rythme: 'Un jour fort en chiffre d’affaires n’est pas forcément un jour fort en marge.', appel: 'Comprend les produits d’appel (cartes prépayées, tabac, etc.), exclus du calcul de marge Boutique.' },
    marge: { titre: 'Marge par jour', indisponible: 'Marge par jour : pas encore disponible. Elle demande les ventes de la caisse jour par jour.' },
    verdicts: { 'au-dessus': 'Nettement au-dessus', 'en-dessous': 'Nettement en dessous', habituel: 'Variation habituelle', grise: 'Pas assez de jours' },
    constat: { designe: '', ressemblent: 'Aucun jour ne ressort nettement des autres.', insuffisant: 'Pas encore assez de semaines mesurées pour comparer les sept jours.', absent: 'Aucun jour complet n’est encore mesuré.' },
    moyenne: (v, a) => 'Moyenne : ' + moisNb(v) + a.suffixe + ' par jour',
    occurrences: n => n + ' jour' + (n > 1 ? 's' : '') + ' complet' + (n > 1 ? 's' : ''),
    ecartAutres: (pct, afficher) => (afficher && pct != null) ? 'Par rapport aux six autres jours : ' + pctSigne(pct) : '',
    pasAssez: (n, seuil) => n + ' jour' + (n > 1 ? 's' : '') + ' complet' + (n > 1 ? 's' : '') + ' seulement, la moyenne en demande ' + seuil + '.',
    ecartes: (liste, a) => {
      const de = nom => (/^[aeiouhàâéèêîôû]/i.test(nom) ? 'l’' : '') + nom;
      const noms = liste.map(e => {
        if (e.motif === 'ferie') return (e.nom || 'jour férié') + ' (' + dateLongue(e.date) + ')';
        if (e.motif === 'pont') return (e.nom ? 'pont de ' + de(e.nom) : 'pont') + ' (' + dateLongue(e.date) + ')';
        return 'journée hors norme du ' + dateLongue(e.date) + (a && e.valeur != null ? ' (' + moisNb(e.valeur) + a.suffixe + ')' : '');
      });
      return liste.length + ' jour' + (liste.length > 1 ? 's' : '') + ' écarté' + (liste.length > 1 ? 's' : '') + ' : ' + noms.join(', ') + '.';
    },
    avecSans: {
      titre: 'Avec les journées hors norme',
      ligne: (nom, p, a, sans, change) => nom + ' : ' + (p.suffisant
        ? moisNb(p.moyenne) + a.suffixe + ' par jour sur ' + p.effectif + ' jours complets, ' + (p.ecartPct != null ? pctSigne(p.ecartPct) + ' par rapport aux six autres jours, ' : '') + NexusVocab.jours.verdicts[p.verdict].toLowerCase()
        : p.effectif + ' jours complets seulement') + (change ? '. La lecture change.' : '.'),
      resume: (noms, etat) => noms.length
        ? 'Avec ces journées, la lecture change pour : ' + noms.join(', ') + '.'
        : (etat === 'insuffisant' ? 'Avec ces journées, la comparaison reste impossible.' : 'Avec ces journées, la lecture ne change pour aucun jour.'),
      echantillon: (sans, avec) => 'Jours complets comparés : ' + sans + ' sans les journées hors norme, ' + avec + ' avec.',
    },
    // Garde des rythmes hebdomadaires : langage prudent, jamais une régularité présentée comme acquise, ni de consigne.
    rythmes: {
      titre: 'Rythme potentiel',
      texte: liste => 'Rythme potentiel : ' + liste.map(r => r.nom + ' (' + r.nb + ' jours complets sur ' + r.occurrences + ' hors norme, ' + (r.sens === 'au-dessus' ? 'au-dessus' : 'en dessous') + ' de la médiane)').join(', ') + '. Ces journées restent dans la lecture, car une récurrence observée ressemble à un rythme plutôt qu’à une exception.',
      avantApres: (noms, etatAvant, etatApres) => noms.length
        ? 'Avant cette règle, la lecture était différente pour : ' + noms.join(', ') + '.'
        : (etatAvant === 'insuffisant' && etatApres !== 'insuffisant' ? 'Avant cette règle, la comparaison était impossible.' : 'Cette règle ne change la lecture d’aucun jour.'),
    },
    // Tuiles et lecture Tempo. « Récurrent » = qualification G5 ; « plus forte / plus faible moyenne » = classement descriptif.
    tuiles: {
      titres: { recurrent: { haut: 'Jour fort récurrent', bas: 'Jour faible récurrent' }, moyenne: { haut: 'Plus forte moyenne', bas: 'Plus faible moyenne' } },
      titreLecture: 'Conseiller NEXUS',
      irregulier: 'Activité irrégulière',
      rythme: 'Concerné par un rythme potentiel, détaillé en dessous.',
      contre: 'par rapport aux six autres jours',
      moyenne: (v, a) => moisNb(v) + a.suffixe + ' par jour',
      ecart: (e, a) => (Math.round(e) > 0 ? '+' : Math.round(e) < 0 ? '−' : '') + moisNb(Math.abs(e)) + a.suffixe + '/jour',
      // cote = { recurrent, moyenne } (tuiles du moteur) ; nom(js) rend le nom du jour. Une phrase par jour, jamais de consigne.
      lecture: (cote, sens, a, nom, suite) => {
        const haut = sens === 'haut';
        const jour = t => nom(t.jourSemaine).toLowerCase();
        const r = cote.recurrent, m = cote.moyenne;
        if (haut) {
          const tete = t => 'Le ' + jour(t) + ' ' + (a.lecture ? a.lecture.verbe : 'réalise') + ' ' + (a.lecture ? a.lecture.plus : 'le total moyen le plus élevé');
          if (r && !m) return tete(r) + ' et se détache nettement des autres jours.';
          if (!r && m) return tete(m) + ', sans se détacher nettement des autres jours.';
          if (r && m) return tete(m) + (m.irregulier ? ', mais ses résultats varient fortement d’une semaine à l’autre. ' : ', sans s’écarter nettement des autres jours. ') + 'Le ' + jour(r) + (m.irregulier ? ' se distingue par une activité supérieure plus régulière.' : ', lui, s’en détache.');
          return '';
        }
        // Côté bas : jamais la mesure ni « nettement » déjà dits côté haut ; « À l’inverse » seulement s’il y a un côté haut.
        const lie = suite ? 'À l’inverse, le ' : 'Le ';
        if (r && !m) return lie + jour(r) + ' reste le jour le plus bas, clairement sous les autres.';
        if (!r && m) return lie + jour(m) + ' reste le jour le plus bas, sans s’écarter clairement des autres.';
        if (r && m) return lie + jour(m) + ' reste le jour le plus bas, sans s’écarter clairement des autres. Le ' + jour(r) + (m.irregulier ? ' ressort par une activité inférieure plus régulière.' : ', lui, passe en dessous.');
        return '';
      },
      preuve: liste => {
        const n = liste.map(x => x.effectif + ' ' + x.nom.toLowerCase() + 's');
        return (n.length > 1 ? n.slice(0, -1).join(', ') + ' et ' + n[n.length - 1] : n.join('')) + ' observés · Qualification selon G5';
      },
    },
    aucunEcart: 'Aucun jour écarté.',
    aucuneDonnee: 'Aucun jour complet n’est encore mesuré.',
    tableau: 'Voir les valeurs en tableau',
    entetes: { jour: 'Jour', moyenne: 'Moyenne par jour', jours: 'Jours complets', ecart: 'Écart aux six autres', verdict: 'Lecture' },
  };

  // Carte « Les vacances changent-elles mon activité ? » : tous les mots viennent d'ici, le moteur n'en porte aucun.
  NexusVocab.vacances = {
    titreOnglet: 'NEXUS Tempo, Vacances',
    titre: 'Les vacances changent-elles mon activité ?',
    sousTitre: 'À jour de semaine égal',
    noms: { 1: 'Lundi', 2: 'Mardi', 3: 'Mercredi', 4: 'Jeudi', 5: 'Vendredi', 6: 'Samedi', 0: 'Dimanche' },
    piste: { titre: 'Piste', unite: 'litres par jour complet', suffixe: ' L' },
    fdj: { titre: 'FDJ', unite: 'chiffre d’affaires par jour complet', suffixe: ' €' },
    boutique: { titre: 'CA Boutique, source Verify', unite: 'chiffre d’affaires par jour complet', suffixe: ' €' },
    groupes: { petites: 'Petites vacances', ete: 'Vacances d’été' },
    groupesDetail: { petites: 'Toussaint, Noël, Carnaval, Pâques', ete: 'Grandes vacances' },
    comparaison: 'Chaque jour de vacances est comparé aux jours hors vacances de même jour de semaine.',
    verdicts: {
      net: { hausse: 'Écart net : plus d’activité pendant ces vacances', baisse: 'Écart net : moins d’activité pendant ces vacances' },
      partage: 'Effet partagé selon les jours',
      'pas-ecart': 'Pas d’écart net',
    },
    grise: 'Pas assez de jours pour conclure',
    jourGrise: 'Insuffisant',
    habituel: 'Variation habituelle',
    entetes: { jour: 'Jour', vacances: 'Moyenne en vacances', hors: 'Moyenne hors vacances', jours: 'Jours (vacances / hors)', ecart: 'Écart' },
    entetesCourts: { jour: 'Jour', vacances: 'En vacances', hors: 'Hors vacances', jours: 'Jours', ecart: 'Écart' },
    effectifs: (v, h) => v + ' / ' + h,
    ecart: pct => pctSigne(pct),
    moyenne: (v, a) => moisNb(v) + a.suffixe,
    observees: (periodes) => periodes.length
      ? 'Vacances observées : ' + periodes.map(p => p.libelle + ' (' + dateLongue(p.debut) + (p.fin !== p.debut ? ' au ' + dateLongue(p.fin) : '') + ', ' + p.nbJours + ' jour' + (p.nbJours > 1 ? 's' : '') + ')').join(', ') + '.'
      : 'Vacances observées : aucune période complète dans la fenêtre.',
    fenetre: (semaines, debut, fin, bornee) => bornee
      ? 'Fenêtre : du ' + dateLongue(debut) + ' au ' + dateLongue(fin) + ' (' + semaines + ' semaines closes au plus, limitée au début des données de cette source).'
      : 'Fenêtre : ' + semaines + ' semaines closes, du ' + dateLongue(debut) + ' au ' + dateLongue(fin) + '.',
    // Ligne sous un verdict qui n'est pas « net » : écarts nets isolés, cités par sens. Dénominateur = jours lisibles.
    ecartsIsoles: (parJour, lisibles) => {
      const nets = parJour.filter(p => p.suffisant && p.net);
      if (!nets.length) return '';
      const liste = (sens) => {
        const n = nets.filter(p => p.sens === sens).map(p => NexusVocab.vacances.noms[p.jourSemaine].toLowerCase());
        return n.length ? 'en ' + sens + ' ' + n.map(x => 'le ' + x).join(', ').replace(/, ([^,]*)$/, ' et $1') : '';
      };
      const morceaux = [liste('hausse'), liste('baisse')].filter(Boolean);
      return 'Écart net sur ' + nets.length + ' jour' + (nets.length > 1 ? 's' : '') + ' sur ' + lisibles + ' : ' + morceaux.join(', ') + '.';
    },
    exclus: (e) => {
      const n = e.feries + e.ponts + e.ascension;
      if (!n) return 'Aucun jour férié ni pont dans la fenêtre.';
      const parts = [];
      if (e.feries) parts.push(e.feries + ' jour' + (e.feries > 1 ? 's' : '') + ' férié' + (e.feries > 1 ? 's' : ''));
      if (e.ponts) parts.push(e.ponts + ' pont' + (e.ponts > 1 ? 's' : ''));
      if (e.ascension) parts.push(e.ascension + ' jour' + (e.ascension > 1 ? 's' : '') + ' du pont de l’Ascension');
      return 'Écartés des deux côtés : ' + parts.join(', ') + '.';
    },
    horsNorme: {
      titre: 'Avec et sans les journées hors norme',
      aucune: 'Aucune journée hors norme dans la fenêtre.',
      sans: 'Sans ces journées',
      avec: 'Avec ces journées',
      change: 'La lecture change quand on les garde.',
      memeLecture: 'La lecture reste la même avec ou sans elles.',
      nombre: n => n + ' journée' + (n > 1 ? 's' : '') + ' hors norme.',
    },
    saison: (parMois) => {
      const tot = parMois.reduce((a, b) => a + b, 0);
      if (!tot) return '';
      const haut = parMois.map((n, i) => ({ n, i })).filter(x => x.n > 0).sort((a, b) => b.n - a.n || a.i - b.i).slice(0, 2).map(x => x.i);
      const noms = haut.sort((a, b) => a - b).map(i => 'en ' + MOIS_LONGS[i]);
      return 'Les jours de vacances observés tombent surtout ' + noms.join(' et ') + ' : l’écart peut aussi venir de la saison.';
    },
    aucuneDonnee: 'Aucun jour complet n’est encore mesuré.',
    tableau: 'Voir les valeurs en tableau',
  };

  // Carte « Quand la piste tourne, la boutique suit-elle ? » : tous les mots viennent d'ici, le moteur n'en porte aucun.
  NexusVocab.pisteBoutique = {
    titreOnglet: 'NEXUS Tempo, Piste et boutique',
    titre: 'Quand la piste tourne, la boutique suit-elle ?',
    sousTitre: 'Jour par jour, par rapport aux habitudes locales',
    noms: { 1: 'Lundi', 2: 'Mardi', 3: 'Mercredi', 4: 'Jeudi', 5: 'Vendredi', 6: 'Samedi', 0: 'Dimanche' },
    piste: { titre: 'Piste', unite: 'litres par jour complet' },
    boutique: { titre: 'CA Boutique, source Verify', unite: 'chiffre d’affaires par jour complet' },
    comparaison: 'Chaque jour est comparé à son habitude : la moyenne des mêmes jours de semaine, deux semaines avant et deux semaines après. On regarde si la piste et la boutique s’écartent du même côté.',
    verdicts: {
      suit: 'La boutique suit la piste',
      oppose: 'Sens opposés',
      'pas-de-lien': 'Pas de lien net',
    },
    grise: 'Pas assez de jours pour conclure',
    resultat: (k, n) => k + ' jour' + (k > 1 ? 's' : '') + ' sur ' + n + ' dans le même sens',
    entetes: { jour: 'Jour', jours: 'Jours comparés', memeSens: 'Dans le même sens' },
    entetesCourts: { jour: 'Jour', jours: 'Jours', memeSens: 'Même sens' },
    informatif: 'Tableau donné à titre indicatif : aucun verdict par jour de semaine.',
    fenetre: (semaines, debut, fin, bornee) => bornee
      ? 'Fenêtre : du ' + dateLongue(debut) + ' au ' + dateLongue(fin) + ' (' + semaines + ' semaines closes au plus, limitée au début des données de ces sources).'
      : 'Fenêtre : ' + semaines + ' semaines closes, du ' + dateLongue(debut) + ' au ' + dateLongue(fin) + '.',
    exclus: (e) => {
      const s = (n, un, plus) => n + ' ' + (n > 1 ? plus : un);
      const parts = [];
      if (e.feries) parts.push(s(e.feries, 'jour férié', 'jours fériés'));
      if (e.ponts) parts.push(s(e.ponts, 'pont', 'ponts'));
      if (e.incomplets) parts.push(s(e.incomplets, 'jour incomplet', 'jours incomplets'));
      if (e.sansHabitude) parts.push(s(e.sansHabitude, 'jour sans habitude locale', 'jours sans habitude locale'));
      if (e.egaux) parts.push(s(e.egaux, 'jour égal à son habitude', 'jours égaux à leur habitude'));
      return parts.length ? 'Écartés : ' + parts.join(', ') + '.' : 'Aucun jour écarté dans la fenêtre.';
    },
    horsNorme: {
      titre: 'Avec et sans les journées hors norme',
      aucune: 'Aucune journée hors norme dans la fenêtre.',
      sans: 'Sans ces journées',
      avec: 'Avec ces journées',
      change: 'La lecture change quand on les garde.',
      memeLecture: 'La lecture reste la même avec ou sans elles.',
      nombre: n => n + ' journée' + (n > 1 ? 's' : '') + ' hors norme.',
    },
    aucuneDonnee: 'Aucun jour complet n’est encore mesuré.',
    tableau: 'Voir les valeurs en tableau',
  };

  // Carte « Comment se situent les pompistes ? » : tous les mots viennent d'ici, le moteur n'en porte aucun.
  // Aucune cause, aucune piste d'action, et le mot réservé à la Boutique n'apparaît jamais ici. Prénoms d'affichage seulement, effectifs toujours visibles.
  NexusVocab.pompistes = {
    titreOnglet: 'NEXUS Tempo, Pompistes',
    titre: 'Comment se situent les pompistes ?',
    sousTitre: 'Litres du quart, par rapport aux habitudes du même quart',
    mesure: 'Litres piste du quart',
    comparaison: 'Chaque quart est comparé à son habitude : la moyenne du même quart, le même jour de semaine, une et deux semaines avant et après. Un quart n’est attribué à un pompiste que s’il était seul à la piste.',
    classement: {
      titre: 'Classement',
      chaine: 'Aucun écart entre ces pompistes n’est assez net pour les départager.',
      entetes: { rang: 'Rang', pompiste: 'Pompiste', quarts: 'Quarts', ecart: 'Écart moyen par quart', lecture: 'Lecture' },
      egalite: 'À égalité avec le voisin',
      nonClasse: n => 'Non classé : ' + n + ' quart' + (n > 1 ? 's' : '') + ' comparé' + (n > 1 ? 's' : '') + ', 10 nécessaires',
      nonClassesTitre: 'Pompistes non classés',
    },
    lecture: { net: 'Écart net', habituelle: 'Variation habituelle' },
    sens: { hausse: 'au-dessus de l’habitude', baisse: 'en dessous de l’habitude' },
    effectif: n => n + ' quart' + (n > 1 ? 's' : ''),
    litres: v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(Math.round(v)).toLocaleString('fr-FR') + ' L',
    fenetre: (semaines, debut, fin, bornee) => bornee
      ? 'Fenêtre : du ' + dateLongue(debut) + ' au ' + dateLongue(fin) + ' (' + semaines + ' semaines closes au plus, limitée au début des données).'
      : 'Fenêtre : ' + semaines + ' semaines closes, du ' + dateLongue(debut) + ' au ' + dateLongue(fin) + '.',
    exclus: (e) => {
      const s = (n, un, plus) => n + ' ' + (n > 1 ? plus : un);
      const parts = [];
      if (e.aucunPompiste) parts.push(s(e.aucunPompiste, 'quart sans pompiste identifié', 'quarts sans pompiste identifié'));
      if (e.plusieursPompistes) parts.push(s(e.plusieursPompistes, 'quart à attribution impossible (plusieurs pompistes ou remplacement)', 'quarts à attribution impossible (plusieurs pompistes ou remplacement)'));
      if (e.rupture) parts.push(s(e.rupture, 'quart en rupture de carburant', 'quarts en rupture de carburant'));
      if (e.litresIncomplets) parts.push(s(e.litresIncomplets, 'quart aux litres incomplets', 'quarts aux litres incomplets'));
      if (e.feries) parts.push(s(e.feries, 'quart un jour férié', 'quarts un jour férié'));
      if (e.ponts) parts.push(s(e.ponts, 'quart un jour de pont', 'quarts un jour de pont'));
      if (e.sansHabitude) parts.push(s(e.sansHabitude, 'quart sans habitude locale', 'quarts sans habitude locale'));
      return parts.length ? 'Quarts écartés : ' + parts.join(', ') + '.' : 'Aucun quart écarté dans la fenêtre.';
    },
    horsNorme: {
      titre: 'Avec et sans les quarts hors norme',
      aucune: 'Aucun quart hors norme dans la fenêtre.',
      sans: 'Sans ces quarts',
      avec: 'Avec ces quarts',
      change: 'Le classement change quand on les garde.',
      memeLecture: 'Le classement reste le même avec ou sans eux.',
      nombre: n => n + ' quart' + (n > 1 ? 's' : '') + ' hors norme.',
    },
    transmettre: 'Transmettre au Cockpit',
    transmettreInactif: 'Pas encore disponible',
    aucuneDonnee: 'Aucun quart attribuable à un pompiste n’est encore mesuré.',
  };

  global.NexusVocab = NexusVocab;
})(window);
