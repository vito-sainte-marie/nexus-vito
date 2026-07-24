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
// Inclure dans une page : <script src="nexus-marge.js"></script>
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
  ];

  // Retourne la famille de marge d'un article : { id, exclue }.
  // Par défaut (aucune exception ne correspond), la famille est la
  // catégorie elle-même — comparaison la plus prudente possible tant
  // qu'aucune règle plus fine n'a été ajoutée et validée par un humain.
  function familleMarge(categorie, article) {
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
  // Retourne les écarts détectés, triés par gain potentiel décroissant.
  function detecterEcartsMarge(rows) {
    const parFamille = {};
    (rows || []).forEach(r => {
      if (!(r.ca > 0)) return; // marge % non calculable sans CA positif
      const famille = familleMarge(r.categorie, r.article);
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
