// NEXUS Carburants — cohérence de décision multi-carburant
// Un carburant sans stock exploitable ET sans consommation connue (ex. GNR)
// reste visible comme "calcul suspendu", mais ne doit pas empêcher une
// recommandation calculable sur SP95/GO.
(function(global){
  'use strict';
  let tente=0;
  function installer(){
    const M=global.NexusCarburantCommandeMoteur;
    if(!M||typeof M.construireEvaluationGlobale!=='function'){
      if(tente++<100) setTimeout(installer,20);
      return;
    }
    if(M.construireEvaluationGlobale.__nexusCoherenceV1) return;
    const original=M.construireEvaluationGlobale;
    function corrige(args){
      const toutes=(args&&args.evaluationsParCarburant)||{};
      const decision={};
      Object.entries(toutes).forEach(([c,ev])=>{
        if(!ev) return;
        const consommation=Number(ev.consommationMoyenneJour||0);
        const aScenario=!!ev.scenarioMaintenant;
        if(ev.etat==='non_calculable'&&!aScenario&&!(consommation>0)) return;
        decision[c]=ev;
      });
      const utilise=Object.keys(decision).length?decision:toutes;
      const caps={};
      Object.keys(utilise).forEach(c=>{if(args.capacitesDisponiblesL&&Object.prototype.hasOwnProperty.call(args.capacitesDisponiblesL,c))caps[c]=args.capacitesDisponiblesL[c];});
      const r=original({...args,evaluationsParCarburant:utilise,capacitesDisponiblesL:caps});
      r.parCarburant=toutes;
      r.carburantsHorsDecision=Object.keys(toutes).filter(c=>!Object.prototype.hasOwnProperty.call(utilise,c));
      return r;
    }
    corrige.__nexusCoherenceV1=true;
    M.construireEvaluationGlobale=corrige;
  }
  installer();
})(typeof window!=='undefined'?window:globalThis);

// 01/09/2026 — couches isolées de cohérence post point-zéro et finition UI.
(function(){
  if((location.pathname.split('/').pop()||'').toLowerCase()!=='nexus-carburants-pilotage-v1.html') return;
  function injecter(src,cle){
    if(document.querySelector('script[data-nexus-carburants-polish="'+cle+'"]')) return;
    const s=document.createElement('script');
    s.src=src;
    s.defer=true;
    s.dataset.nexusCarburantsPolish=cle;
    document.head.appendChild(s);
  }
  injecter('nexus-carburants-p0-coherence-ui.js?v=20260903-1148','p0');
  injecter('nexus-carburants-mobile-polish-v2.js?v=20260903-1148','mobile-v2');
})();
