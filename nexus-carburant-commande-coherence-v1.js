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
        // On exclut seulement le cas réellement hors décision : aucune
        // projection possible ET aucune rotation connue. Une anomalie sur
        // un carburant calculable reste dans la décision et dégrade sa
        // confiance normalement.
        if(ev.etat==='non_calculable'&&!aScenario&&!(consommation>0)) return;
        decision[c]=ev;
      });
      // Filet : ne jamais transformer une absence totale de données en
      // fausse recommandation.
      const utilise=Object.keys(decision).length?decision:toutes;
      const caps={};
      Object.keys(utilise).forEach(c=>{if(args.capacitesDisponiblesL&&Object.prototype.hasOwnProperty.call(args.capacitesDisponiblesL,c))caps[c]=args.capacitesDisponiblesL[c];});
      const r=original({...args,evaluationsParCarburant:utilise,capacitesDisponiblesL:caps});
      // L'écran doit continuer à montrer tous les carburants, y compris le
      // GNR suspendu. Seule la décision camion est filtrée.
      r.parCarburant=toutes;
      r.carburantsHorsDecision=Object.keys(toutes).filter(c=>!Object.prototype.hasOwnProperty.call(utilise,c));
      return r;
    }
    corrige.__nexusCoherenceV1=true;
    M.construireEvaluationGlobale=corrige;
  }
  installer();
})(typeof window!=='undefined'?window:globalThis);

// 01/09/2026 — couche isolée de cohérence post point-zéro et finition UI.
// Chargée ici parce que ce compagnon est déjà limité à Carburants Pilotage :
// aucune dépendance supplémentaire n'est ajoutée aux autres écrans NEXUS.
(function(){
  if((location.pathname.split('/').pop()||'').toLowerCase()!=='nexus-carburants-pilotage-v1.html') return;
  if(document.querySelector('script[data-nexus-carburants-p0-coherence-ui]')) return;
  const s=document.createElement('script');
  s.src='nexus-carburants-p0-coherence-ui.js?v=20260901-0639';
  s.defer=true;
  s.dataset.nexusCarburantsP0CoherenceUi='1';
  document.head.appendChild(s);
})();
