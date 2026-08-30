(function (global) {
  'use strict';
  if (!global.location || !/NEXUS-Parametres-Inventaire-v1\.html$/i.test(global.location.pathname)) return;

  // V2 : « exception » est remplacé uniquement dans les textes visibles de l'UX.
  // IMPORTANT : ne jamais toucher au contenu des balises SCRIPT/STYLE/TEMPLATE
  // ni aux attributs/data-* : des clés techniques comme `exception_only` doivent
  // rester strictement inchangées.
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

  const BALISES_TECHNIQUES = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'CODE', 'PRE']);

  function texteVisibleSeulement(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return false;
    const parent = node.parentElement;
    if (!parent) return false;
    if (BALISES_TECHNIQUES.has(parent.tagName)) return false;
    if (parent.closest('script,style,template,noscript,code,pre')) return false;
    return true;
  }

  function corrigerTexte(root) {
    if (!root) return;
    // Ne jamais parcourir directement une racine technique ajoutée au DOM.
    if (root.nodeType === Node.ELEMENT_NODE && BALISES_TECHNIQUES.has(root.tagName)) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return texteVisibleSeulement(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
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
    if (enCours || !document.body) return;
    enCours = true;
    try {
      corrigerTexte(document.body);
      ajouterNoteHeritage();
    } finally {
      enCours = false;
    }
  }

  // Observer uniquement les ajouts visuels. Les scripts sont explicitement exclus
  // par corrigerTexte/texteVisibleSeulement, y compris pendant le parsing Safari.
  new MutationObserver(appliquer).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', appliquer, { once: true });
  else appliquer();
})(typeof window !== 'undefined' ? window : globalThis);
