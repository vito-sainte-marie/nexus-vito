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
// Inclure dans une page : <script src="nexus-marge.js?v=20260903-2159"></script>
// (même mécanisme que nexus-auth.js, nexus-vocabulaire.js, nexus-periodes.js)
// ============================================================

(function (global) {
  // Chaque règle : si `test(categorie, article)` est vrai, l'article
  // appartient à la famille `id`. `exclue: true` signifie que cette famille
  // est retirée de toute recommandation de marge (marge non ajustable par
  // le commerçant, la comparer serait trompeur).
  const EXCEPTIONS = [
    // Tabac réglementé (paquets de cigarettes, cigarillos, tabac à rouler
    // vendu en paquet standard) — prix et marge fixés par le fabricant sous
    // le monopole des tabacs. Les accessoires (papier, filtres, tubes,
    // briquets, e-liquides) restent comparables normalement.
    {
      id: 'tabac-reglemente', exclue: true,
      test: (categorie, article) => {
        const cat = (categorie || '').toLowerCase();
        const art = (article || '').toLowerCase();
        if (!/tabac|cigare/.test(cat)) return false;
        const estAccessoire = /papier|feuille|filtre|tube|brique|e-liquide|électronique|electronique/.test(art);
        if (estAccessoire) return false;
        return /paquet|cigarette|cigarillo|tabac à rouler|tabac a rouler/.test(art);
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
    return { id: categorie || 'sans-categorie', exclue: false };
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

  global.NexusMarge = { familleMarge, detecterEcartsMarge, median, SEUIL_ECART_POINTS, TAILLE_MIN_GROUPE };
})(window);
