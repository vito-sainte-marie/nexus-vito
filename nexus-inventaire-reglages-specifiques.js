(function (global) {
  'use strict';
  if (!global.location || !/NEXUS-Parametres-Inventaire-v1\.html$/i.test(global.location.pathname)) return;

  // V2 : « exception » est remplacé dans l'UX par « réglage spécifique ».
  // Une caractéristique physique (zone, dépôt+boutique, sensible...) n'est
  // jamais un réglage spécifique et ne coupe jamais l'héritage catégorie.
  const remplacements = [
    [/Créer une exception pour ce produit/gi, 'Créer un réglage spécifique pour ce produit'],
    [/Modifier cette exception/gi, 'Modifier ce réglage spécifique'],
    [/Exception active pour ce produit/gi, 'Réglage spécifique actif pour ce produit'],
    [/exception actuelle/gi, 'réglage spécifique actuel'],
    [/exceptions produit/gi, 'réglages spécifiques produit'],
    [/exception propre/gi, 'réglage spécifique propre'],
    [/en exception/gi, 'avec un réglage spécifique'],
    [/une exception/gi, 'un réglage spécifique'],
    [/des exceptions/gi, 'des réglages spécifiques'],
    [/exception/gi, 'réglage spécifique'],
    [/Paramétrage hérité\s*:/gi, 'Règle catégorie appliquée :'],
  ];

  function traduire(texte) {
    let sortie = String(texte || '');
    remplacements.forEach(([re, valeur]) => { sortie = sortie.replace(re, valeur); });
    return sortie;
  }

  const confirmOriginal = global.confirm.bind(global);
  global.confirm = function (message) { return confirmOriginal(traduire(message)); };

  function corrigerTexte(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const aModifier = [];
    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (/exception|Paramétrage hérité/i.test(n.nodeValue || '')) aModifier.push(n);
    }
    aModifier.forEach(n => { n.nodeValue = traduire(n.nodeValue); });
  }

  function ajouterNoteHeritage() {
    document.querySelectorAll('[data-categorie-regle]').forEach(head => {
      const card = head.closest('.card');
      if (!card || card.querySelector('[data-note-heritage-v2]')) return;
      const note = document.createElement('div');
      note.dataset.noteHeritageV2 = '1';
      note.style.cssText = 'font-size:10.8px;color:var(--text-dim);line-height:1.45;margin:7px 0 2px';
      note.textContent = 'Les caractéristiques propres aux produits (emplacement, dépôt + boutique…) sont conservées et n’empêchent jamais l’application de la règle de catégorie.';
      head.insertAdjacentElement('afterend', note);
    });
  }

  let enCours = false;
  function appliquer() {
    if (enCours) return;
    enCours = true;
    corrigerTexte(document.body);
    ajouterNoteHeritage();
    enCours = false;
  }

  new MutationObserver(appliquer).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', appliquer, { once: true });
  else appliquer();
})(typeof window !== 'undefined' ? window : globalThis);
