// NEXUS — identification d'une page, indépendamment de l'hébergeur (04/09/2026).
//
// POURQUOI CE FICHIER EXISTE. Le code identifiait la page courante en
// comparant le dernier segment de l'URL à des noms de fichiers écrits en dur,
// extension comprise :
//
//   const page = window.location.pathname.split('/').pop();
//   if (page === 'NEXUS-Inventaire-v1.html') { … }
//
// GitHub Pages sert `/NEXUS-Inventaire-v1.html` : la comparaison tombe juste.
// Cloudflare Pages RETIRE l'extension — `/NEXUS-Inventaire-v1.html` répond 308
// vers `/NEXUS-Inventaire-v1` — et toutes ces comparaisons deviennent fausses,
// silencieusement.
//
// Ce que ça a coûté, constaté en recette le 04/09 : l'écran de prise de poste
// ne se reconnaissait plus lui-même dans la liste des pages de séquence
// obligatoire, concluait que la prise de poste manquait, et redirigeait vers
// lui-même. Boucle infinie, URL de plusieurs milliers de caractères, aucune
// erreur en console. Aucun compte non-manager ne pouvait entrer dans
// l'application. Et une quinzaine de chargements de scripts conditionnels
// échouaient de la même façon, sans rien afficher : des fonctionnalités
// entières absentes sans que rien ne le dise.
//
// LA RÈGLE : on ne compare jamais deux URL, on compare deux IDENTIFIANTS DE
// PAGE normalisés. Une seule fonction pour cela, des deux côtés de la
// comparaison — plutôt que d'ajouter partout une deuxième chaîne sans `.html`,
// ce qui aurait doublé la surface d'erreur au lieu de la supprimer.
//
// Chargé au build sur les mêmes écrans que `nexus-config.js`, avant
// `nexus-auth.js` et avant les scripts qu'il injecte.
(function (global) {
  'use strict';

  // Accepte aussi bien une URL complète qu'un chemin, un nom de fichier ou un
  // identifiant déjà normalisé. Query et fragment sont retirés d'abord : une
  // page reste la même page avec `?retour=…` ou `#section`.
  function identifiant(source) {
    var brut = (source === undefined || source === null)
      ? (global.location ? global.location.pathname : '')
      : String(source);
    var sansFragment = brut.split('#')[0].split('?')[0];
    var dernier = sansFragment.split('/').pop() || '';
    return dernier.replace(/\.html$/i, '');
  }

  // `est('NEXUS-Inventaire-v1.html')`, `est(uneListe)`, `est(a, b, c)` — les
  // noms restent écrits comme des fichiers, lisibles, et sont normalisés ici.
  function est() {
    var courante = identifiant();
    if (!courante) return false;
    var noms = Array.prototype.concat.apply([], Array.prototype.slice.call(arguments));
    for (var i = 0; i < noms.length; i++) {
      if (identifiant(noms[i]) === courante) return true;
    }
    return false;
  }

  global.NexusPage = { identifiant: identifiant, est: est };
})(typeof window !== 'undefined' ? window : globalThis);
