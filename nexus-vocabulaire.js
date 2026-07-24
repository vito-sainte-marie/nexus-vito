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
// Inclure dans une page : <script src="nexus-vocabulaire.js"></script>
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
    excellent: ['Situation excellente.', 'Performance remarquable.', 'Les indicateurs sont au vert.', 'La tendance est solide.', 'Les résultats dépassent les attentes.'],
    bon: ['La situation est saine.', 'Les résultats sont satisfaisants.', 'Les fondamentaux sont solides.', 'La dynamique reste positive.', 'Les performances restent stables.'],
    moyen: ['La situation reste sous contrôle.', 'Quelques signaux méritent une attention.', 'Le potentiel n\'est pas pleinement exploité.', 'Une amélioration est possible.'],
    faible: ['Les performances ralentissent.', 'Plusieurs indicateurs se dégradent.', 'Le potentiel est insuffisamment exploité.', 'Une intervention est recommandée.'],
    critique: ['Une action rapide est nécessaire.', 'Les résultats deviennent préoccupants.', 'Le niveau de risque augmente.', 'Une vérification terrain est prioritaire.'],
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
    eleve: ['Potentiel élevé.', 'Fort potentiel.', 'Levier de croissance.'],
    modere: ['Possibilité d\'amélioration.', 'Gisement de marge.'],
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
    attention: ['Prioriser ce rayon.', 'Sensibilisez les collaborateurs concernés.'],
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
    'L\'impression du terrain diffère des chiffres.',
    'Les chiffres racontent une autre histoire.',
    'Ce produit paraît important, mais les chiffres nuancent.',
    'Ce rayon est souvent sous-estimé.',
    'Attention aux biais de perception.',
    'Les apparences sont trompeuses ici.',
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
  // Cycle de construction — Constat → Explication → Décision.
  // Aide à assembler les trois lignes dans le bon ordre et avec la bonne
  // séparation visuelle ; ne génère pas le contenu (fourni par l'appelant),
  // impose juste la structure pour que toutes les pages NEXUS parlent pareil.
  // ------------------------------------------------------------
  NexusVocab.cycle = function (constat, explication, decision) {
    return { constat, explication, decision };
  };

  global.NexusVocab = NexusVocab;
})(window);
