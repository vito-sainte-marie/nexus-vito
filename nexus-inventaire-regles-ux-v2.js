// NEXUS Inventaire V2 — UX allégée de Paramètres Inventaire > Règles
// Non destructif : ne change aucune règle métier ni donnée. Réorganise uniquement la lecture.
(function () {
  'use strict';
  if (!/NEXUS-Parametres-Inventaire-v1\.html$/i.test(location.pathname)) return;

  const style = document.createElement('style');
  style.textContent = `
    body.nexus-regles-compactes .nrv2-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:12px 0 16px;padding:10px 12px;border:1px solid rgba(148,163,184,.16);border-radius:12px;background:rgba(15,23,42,.42)}
    body.nexus-regles-compactes .nrv2-toolbar strong{font-size:12px;color:#e2e8f0}.nrv2-toolbar span{font-size:11px;color:#7f8da3}.nrv2-toolbar button{border:1px solid rgba(34,211,238,.25);background:rgba(34,211,238,.08);color:#bff7ff;border-radius:9px;padding:7px 10px;cursor:pointer}
    body.nexus-regles-compactes .nrv2-section-title{margin:16px 0 8px!important;font-size:11px!important;letter-spacing:.12em!important;color:#7890a7!important;text-transform:uppercase}
    body.nexus-regles-compactes .nrv2-product-summary{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-top:3px;color:#748399;font-size:10.5px}
    body.nexus-regles-compactes .nrv2-pill{padding:2px 7px;border-radius:999px;background:rgba(148,163,184,.08);border:1px solid rgba(148,163,184,.12)}
    body.nexus-regles-compactes [data-nrv2-product-card]{padding-top:9px!important;padding-bottom:9px!important;min-height:0!important}
    body.nexus-regles-compactes [data-nrv2-product-card] .nrv2-hide-detail{display:none!important}
    body.nexus-regles-compactes.nrv2-details [data-nrv2-product-card] .nrv2-hide-detail{display:initial!important}
    body.nexus-regles-compactes .nrv2-category-note{display:none!important}
    @media(max-width:760px){body.nexus-regles-compactes .nrv2-toolbar{align-items:flex-start;flex-direction:column}}
  `;
  document.head.appendChild(style);
  document.body.classList.add('nexus-regles-compactes');

  let showDetails = false;
  let busy = false;

  function text(el){ return (el?.textContent || '').replace(/\s+/g,' ').trim(); }
  function visible(el){ return !!(el && el.offsetParent !== null); }

  function installerToolbar(){
    if (document.getElementById('nrv2Toolbar')) return;
    const titre = [...document.querySelectorAll('h1,h2,h3')].find(el => /Comment souhaitez-vous les compter/i.test(text(el)));
    if (!titre) return;
    const bar = document.createElement('div');
    bar.id='nrv2Toolbar'; bar.className='nrv2-toolbar';
    bar.innerHTML='<div><strong>Lecture simplifiée</strong><br><span>Les règles communes restent prioritaires. Les détails produit sont masqués tant que vous n’en avez pas besoin.</span></div><button type="button" id="nrv2ToggleDetails">Afficher les détails</button>';
    titre.insertAdjacentElement('beforebegin', bar);
    bar.querySelector('button').addEventListener('click',()=>{
      showDetails=!showDetails;
      document.body.classList.toggle('nrv2-details',showDetails);
      bar.querySelector('button').textContent=showDetails?'Masquer les détails':'Afficher les détails';
    });
  }

  function simplifierTitres(){
    document.querySelectorAll('h1,h2,h3,h4,.section-title,.eyebrow').forEach(el=>{
      const t=text(el);
      if (/RÉGLAGES SPÉCIFIQUES PRODUIT/i.test(t)) { el.textContent='Produits à personnaliser'; el.classList.add('nrv2-section-title'); }
      if (/Règles par catégorie/i.test(t)) { el.textContent='Règles par catégorie'; }
    });
    document.querySelectorAll('p,small,.muted,.hint').forEach(el=>{
      const t=text(el);
      if (/Modifiez uniquement les produits qui ne suivent pas la règle/i.test(t)) el.textContent='Ouvrez un produit uniquement s’il doit fonctionner différemment de sa catégorie.';
    });
  }

  function simplifierCartesProduits(){
    const candidats=[...document.querySelectorAll('div,article,li')].filter(el=>{
      if (!visible(el) || el.children.length>12) return false;
      const t=text(el);
      return /\(hérité de .+\)/i.test(t) && (/(Dépôt|Boutique|Bureau|Piste)/i.test(t) || /Stock continu|Remis à zéro|production journalière/i.test(t));
    });
    candidats.forEach(card=>{
      if(card.dataset.nrv2ProductCard) return;
      // Choisit le conteneur le plus petit qui contient le résumé d'un seul produit.
      if(card.parentElement && /\(hérité de .+\)/i.test(text(card.parentElement)) && card.parentElement.children.length<=3) return;
      card.dataset.nrv2ProductCard='1';
      const nodes=[...card.querySelectorAll('*')];
      nodes.forEach(n=>{
        const t=text(n);
        if (/Stock continu \(par défaut\)|\(hérité de .+\)/i.test(t) && n.children.length===0) n.classList.add('nrv2-hide-detail');
      });
      const lieu=nodes.find(n=>n.children.length===0 && /Dépôt \+ Boutique|Bureau \+ Boutique|Boutique|Piste/i.test(text(n)));
      if(lieu && !card.querySelector('.nrv2-product-summary')){
        const s=document.createElement('div'); s.className='nrv2-product-summary';
        s.innerHTML='<span class="nrv2-pill">Règle catégorie</span><span>'+text(lieu)+'</span>';
        const first=card.firstElementChild; if(first) first.insertAdjacentElement('afterend',s); else card.appendChild(s);
        lieu.classList.add('nrv2-hide-detail');
      }
    });
  }

  function masquerNotesRepetitives(){
    document.querySelectorAll('[data-note-heritage-v2]').forEach(el=>el.classList.add('nrv2-category-note'));
  }

  function appliquer(){
    if(busy) return; busy=true;
    try{ installerToolbar(); simplifierTitres(); simplifierCartesProduits(); masquerNotesRepetitives(); }
    finally{ busy=false; }
  }
  new MutationObserver(()=>requestAnimationFrame(appliquer)).observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',appliquer,{once:true}); else appliquer();
})();
