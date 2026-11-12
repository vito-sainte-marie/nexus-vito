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
      titreLecture: 'Lecture Tempo',
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

  global.NexusVocab = NexusVocab;
})(window);
