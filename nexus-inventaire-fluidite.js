// NEXUS Inventaire — Sprint Fluidité de saisie (31/08/2026)
// Assistance de conditionnement sans changer la vérité stock : le facteur
// déjà porté par inventaire_zone_produit.facteur_conditionnement sert
// uniquement à accélérer la saisie. La valeur finale reste une quantité
// d'unités et continue d'être évaluée/enregistrée par le parcours existant.
(function () {
  'use strict';

  if (!/NEXUS-Inventaire-v1\.html$/i.test(location.pathname)) return;

  const STYLE_ID = 'nexus-inventaire-fluidite-style';
  const ATTR = 'data-nexus-conditionnement';
  let raf = null;

  function produitsCourants() {
    try { return (typeof produitsZone !== 'undefined' && Array.isArray(produitsZone)) ? produitsZone : []; }
    catch (_) { return []; }
  }

  function produitPourInput(input) {
    const liste = produitsCourants();
    if (!liste.length || !input) return null;

    const id = input.dataset && input.dataset.produit;
    if (id) return liste.find(p => p.id === id) || null;

    // Le carrousel n'expose pas encore produit_id sur l'input. On réutilise
    // donc la désignation déjà affichée par le parcours (aucun second état).
    if (input.id === 'carrouselInput') {
      const nom = document.querySelector('.carrousel-nom');
      const texte = nom ? String(nom.textContent || '').trim() : '';
      return liste.find(p => texte === p.designation || texte.startsWith(p.designation)) || null;
    }
    return null;
  }

  function facteurProduit(produit) {
    const n = Number(produit && produit.facteur_conditionnement);
    return Number.isFinite(n) && n > 1 ? n : null;
  }

  function injecterStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .calc-conditionnement-btn{font-family:var(--mono);font-size:10px;font-weight:700;color:var(--cyan);background:rgba(79,195,217,.10);border:1px solid rgba(79,195,217,.35);border-radius:8px;padding:7px 9px;white-space:nowrap;cursor:pointer;}
      .calc-conditionnement-btn:active{background:rgba(79,195,217,.22);transform:scale(.98);}
      .conditionnement-hint{font-family:var(--mono);font-size:9.5px;color:var(--text-dim);margin-top:5px;line-height:1.35;}
      .conditionnement-hint b{color:var(--cyan);font-weight:700;}
    `;
    document.head.appendChild(style);
  }

  function expressionAvecConditionnement(valeur, facteur) {
    const brut = String(valeur == null ? '' : valeur).trim();
    if (!brut) return String(facteur);
    if (/[+\-*/]$/.test(brut)) return brut + String(facteur);
    return brut + '*' + String(facteur);
  }

  function brancherBouton(btn, input, facteur) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      input.focus();
      input.value = expressionAvecConditionnement(input.value, facteur);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      // Le clavier reste sur le champ : l'employé peut immédiatement faire
      // "+ unités libres" puis Entrée, sans sortir du flux de comptage.
      try { input.setSelectionRange(input.value.length, input.value.length); } catch (_) {}
    });
  }

  function enrichirChamp(input) {
    if (!input || input.hasAttribute(ATTR)) return;
    const produit = produitPourInput(input);
    const facteur = facteurProduit(produit);
    if (!facteur) return;

    const champ = input.closest('.champ-comptage');
    const barre = champ && champ.querySelector('.calc-barre');
    if (!champ || !barre) return;

    input.setAttribute(ATTR, String(facteur));

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'calc-conditionnement-btn';
    btn.textContent = `×${facteur}P`;
    btn.setAttribute('aria-label', `Multiplier par le conditionnement de ${facteur}`);
    btn.title = `1 conditionnement = ${facteur} unités`;
    brancherBouton(btn, input, facteur);
    barre.appendChild(btn);

    if (!champ.querySelector('.conditionnement-hint')) {
      const hint = document.createElement('div');
      hint.className = 'conditionnement-hint';
      hint.innerHTML = `<b>${facteur}P</b> · 1 conditionnement = ${facteur} unités`;
      champ.appendChild(hint);
    }
  }

  function enrichirEcran() {
    document.querySelectorAll('.champ-comptage input').forEach(enrichirChamp);
  }

  function programmerEnrichissement() {
    if (raf != null) return;
    raf = requestAnimationFrame(() => {
      raf = null;
      enrichirEcran();
    });
  }

  injecterStyles();
  const demarrer = () => {
    enrichirEcran();
    const cible = document.getElementById('content') || document.body;
    new MutationObserver(programmerEnrichissement).observe(cible, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer, { once: true });
  else demarrer();
})();
