// ============================================================
// NEXUS Marge — détection d'écarts de marge entre produits comparables.
//
// Demande de Frédéric le 24/07/2026 : repérer les produits dont la marge
// pourrait être réajustée, SANS jamais comparer des produits qui n'ont pas
// la même contrainte économique — l'exemple donné : un paquet de cigarettes
// (prix et marge fixés nationalement par le fabricant, le commerçant ne
// peut pas les changer) ne peut pas être comparé à une feuille à rouler
// (marge libre) juste parce que les deux sont dans la catégorie "Tabac".
//
// Ce fichier introduit une "famille de marge" — un regroupement distinct de
// la `categorie` d'affichage (qui sert au CA par rayon) et du type d'action
// (qui sert au facing) — utilisé UNIQUEMENT pour savoir quels produits sont
// économiquement comparables entre eux.
//
// AVERTISSEMENT — cette liste d'exceptions est volontairement un premier
// jet, pas une vérité établie : NEXUS ne connaît pas toutes les règles de
// fixation de prix (tabac, presse, jeux, gaz...). Elle doit être relue et
// corrigée par quelqu'un qui connaît le métier, exactement comme la
// classification manuel/auto_categorie des emplacements produit. Tant
// qu'une famille n'est pas listée en exception, elle est comparée à
// l'intérieur de sa `categorie` — par défaut, jamais entre catégories.
//
// Inclure dans une page : <script src="nexus-marge.js?v=20260904-0104"></script>
// (même mécanisme que nexus-auth.js, nexus-vocabulaire.js, nexus-periodes.js)
// ============================================================

(function (global) {
  // Chaque règle : si `test(categorie, article)` est vrai, l'article
  // appartient à la famille `id`. `exclue: true` signifie que cette famille
  // est retirée de toute recommandation de marge (marge non ajustable par
  // le commerçant, la comparer serait trompeur).
  // Le rayon « Tabac à rouler » est importé avec un défaut d'encodage (« Ã  »
  // au lieu de « à ») : on le recompose avant de comparer.
  function normaliser(categorie) {
    return (categorie || '').replace(/Ã\s/g, 'à ').replace(/\s+/g, ' ').trim().toLowerCase();
  }
  const RAYONS_TABAC_REGLEMENTE = [
    /^cigarettes?$/, /^cigares?\b/, /^pot tabac\b/, /^tabacs?$/, /^tabacs? à rouler\b/, /^tabacs? a rouler\b/,
  ];
  // Mots ENTIERS désignant un accessoire (jamais une sous-chaîne : « tuber » n'est pas « tube »).
  const ACCESSOIRE_TABAC = /(?<![\p{L}])(papiers?|feuilles?|filtres?|tubes?|briquets?|rizla|gizeh|ocb|smoking|clipper|e-liquides?|électroniques?|electroniques?)(?![\p{L}])/u;
  // Vocabulaire qui évoque un rayon de tabac, pour signaler « à classer ».
  const EVOQUE_TABAC = /tabac|cigar|chicha|narguil|\bpipe\b|snus|chiquer/;
  const VAPOTAGE_CBD = /vap|puff|e-?liquide|e-?cig|cbd/;

  const EXCEPTIONS = [
    // Tabac manufacturé — prix réglementé, jamais comparé pour une optimisation
    // tarifaire (décision de Frédéric du 15/11/2026 ; en outre-mer le prix des
    // tabacs est encadré par le droit de consommation, à confirmer auprès du
    // distributeur ou des douanes). La règle repose sur des RAYONS NOMMÉS
    // (cigarettes, cigares, pot tabac, tabac à rouler), plus sur un mot du
    // libellé. Les accessoires (papier, feuille, filtre, tube, Rizla, Gizeh,
    // OCB, briquet) et le vapotage/CBD restent à marge libre. Un rayon de
    // tabac inconnu n'est jamais classé d'office : voir tabacAClasser.
    {
      id: 'tabac-reglemente', exclue: true,
      test: (categorie, article) => {
        const cat = normaliser(categorie);
        const art = (article || '').toLowerCase();
        if (!RAYONS_TABAC_REGLEMENTE.some(re => re.test(cat))) return false;
        // Rayon Cigares : tout est réglementé (un cigarillo « filtre » reste un cigare).
        if (/^cigares?\b/.test(cat)) return true;
        return !ACCESSOIRE_TABAC.test(art);
      },
    },
    // MISE À JOUR 26/07/2026 (demande de Frédéric) : « produits d'appel »
    // supplémentaires à exclure de toute recommandation de marge — des
    // familles qui font venir le client mais dont la marge est
    // structurellement faible ou fixée par un tiers (fournisseur de gaz,
    // éditeur de presse, opérateur télécom, monopole des tabacs), jamais un
    // levier d'action pour le commerçant. Exclusion au niveau de la
    // `categorie` (pas de l'article) — plus simple et suffisant ici, ces
    // catégories ne mélangent pas des accessoires à marge libre comme le
    // fait le tabac (voir la règle précédente).
    {
      // Bonbonnes/recharges de gaz (butane, propane, camping) — categorie
      // commençant par "Gaz" uniquement, pour ne pas exclure au passage une
      // categorie comme "Accesoires - Briquets - Gaz" (briquets à marge
      // libre, qui contient aussi le mot "gaz").
      id: 'gaz', exclue: true,
      test: (categorie) => /^gaz\b/i.test((categorie || '').trim()),
    },
    {
      // Presse, téléphonie, cartes prépayées/digitales (Transcash, PCS,
      // codes promo dématérialisés) — même famille "produit d'appel" que le
      // gaz : le commerçant ne fixe ni le prix ni la marge.
      id: 'presse-telephonie-cartes', exclue: true,
      test: (categorie) => /presse|t[ée]l[ée]phon|cartes?\s*pr[ée]pay|codes?\s*promo|transcash|\bpcs\b/i.test(categorie || ''),
    },
    {
      // Tabac indexé par nombre de pièces plutôt que par le mot
      // "tabac"/"cigare" dans le libellé de categorie (ex. "Paquet de 20") —
      // la règle tabac-reglemente ci-dessus ne les détecte pas car elle
      // regarde d'abord la categorie, qui ne contient ici aucun des deux
      // mots déclencheurs.
      id: 'tabac-par-quantite', exclue: true,
      test: (categorie) => /^paquet de \d+$/i.test((categorie || '').trim()),
    },
  ];

  // Retourne la famille de marge d'un article : { id, exclue }.
  //
  // `exclusionsManuelles` (optionnel) : un Set de noms d'articles choisis
  // par un manager dans Paramétrage Station (table marge_exceptions,
  // migration-marge-exceptions-v1.sql) — vérifié EN PREMIER, avant les
  // règles codées en dur ci-dessus. Ça permet à quelqu'un qui connaît le
  // métier de corriger ou compléter la classification sans toucher au
  // code, exactement comme demandé par Frédéric le 24/07/2026.
  //
  // Par défaut (ni exclusion manuelle, ni exception codée ne correspond),
  // la famille est la catégorie elle-même — comparaison la plus prudente
  // possible tant qu'aucune règle plus fine n'a été ajoutée.
  function familleMarge(categorie, article, exclusionsManuelles) {
    if (exclusionsManuelles && exclusionsManuelles.has(article)) {
      return { id: 'exclusion-manuelle', exclue: true };
    }
    for (const regle of EXCEPTIONS) {
      if (regle.test(categorie, article)) return { id: regle.id, exclue: true };
    }
    const libre = { id: categorie || 'sans-categorie', exclue: false };
    if (tabacAClasser(categorie)) libre.aClasser = true;
    return libre;
  }

  // Un rayon qui évoque le tabac sans être l'un des rayons nommés ci-dessus
  // (ni vapotage/CBD) est « à classer » : il reste à marge libre tant qu'un
  // responsable ne l'a pas classé, mais l'écran peut le signaler.
  function tabacAClasser(categorie) {
    const cat = normaliser(categorie);
    if (!cat || !EVOQUE_TABAC.test(cat) || VAPOTAGE_CBD.test(cat)) return false;
    if (RAYONS_TABAC_REGLEMENTE.some(re => re.test(cat))) return false;
    if (/^paquet de \d+$/.test(cat)) return false;
    return !/accessoire|papier|feuille|filtre|tube|briquet/.test(cat);
  }

  function median(valeurs) {
    if (!valeurs || !valeurs.length) return null;
    const triees = [...valeurs].sort((a, b) => a - b);
    const milieu = Math.floor(triees.length / 2);
    return triees.length % 2 !== 0 ? triees[milieu] : (triees[milieu - 1] + triees[milieu]) / 2;
  }

  // Seuils volontairement prudents pour un premier jet — documentés ici
  // plutôt qu'enfouis dans le calcul, pour pouvoir les ajuster facilement.
  const SEUIL_ECART_POINTS = 10; // points de marge en dessous de la médiane du groupe
  const TAILLE_MIN_GROUPE = 4;   // nb minimum d'articles comparables pour qu'une médiane soit fiable

  // rows : lignes products de la période affichée, déjà nettoyées des
  // anomalies (marge/CA incohérents) et des produits d'appel — la même
  // exigence que pour tout autre calcul NEXUS : jamais comparer une ligne
  // qu'on sait déjà fausse.
  // exclusionsManuelles : Set optionnel de noms d'articles exclus par un
  // manager depuis Paramétrage Station (voir familleMarge ci-dessus).
  // Retourne les écarts détectés, triés par gain potentiel décroissant.
  function detecterEcartsMarge(rows, exclusionsManuelles) {
    const parFamille = {};
    (rows || []).forEach(r => {
      if (!(r.ca > 0)) return; // marge % non calculable sans CA positif
      const famille = familleMarge(r.categorie, r.article, exclusionsManuelles);
      if (famille.exclue) return;
      if (!parFamille[famille.id]) parFamille[famille.id] = [];
      parFamille[famille.id].push({ ...r, margePct: (r.marge || 0) / r.ca * 100 });
    });

    const ecarts = [];
    Object.values(parFamille).forEach(articles => {
      if (articles.length < TAILLE_MIN_GROUPE) return; // groupe trop petit, comparaison pas fiable
      const mediane = median(articles.map(a => a.margePct));
      articles.forEach(a => {
        const ecart = mediane - a.margePct;
        if (ecart >= SEUIL_ECART_POINTS) {
          ecarts.push({
            article: a.article, categorie: a.categorie, ca: a.ca,
            margePct: a.margePct, medianeGroupe: mediane, ecartPoints: ecart,
            gainPotentiel: (ecart / 100) * a.ca,
            tailleGroupe: articles.length,
          });
        }
      });
    });
    return ecarts.sort((a, b) => b.gainPotentiel - a.gainPotentiel);
  }

  global.NexusMarge = { familleMarge, tabacAClasser, detecterEcartsMarge, median, SEUIL_ECART_POINTS, TAILLE_MIN_GROUPE };
})(window);
