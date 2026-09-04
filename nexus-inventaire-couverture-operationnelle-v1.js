// NEXUS Inventaire — Couverture opérationnelle
// Présentation manager : transforme les durées abstraites (ex. 0,4 j)
// en horizon terrain (ex. Mardi · Quart 1). Le calcul de couverture reste inchangé.
(function(){
  'use strict';
  if(!NexusPage.est('NEXUS-Inventaire-Manager-v1.html')) return;

  let enCours=false;

  function horizon(jours){
    if(window.NexusHorizonOperationnel){
      const h=window.NexusHorizonOperationnel.horizonDepuisJours(jours);
      return h ? h.label : null;
    }
    return null;
  }

  function convertirTexte(node){
    if(node.nodeType!==Node.TEXT_NODE)return;
    const original=node.nodeValue||'';
    let txt=original;
    txt=txt.replace(/couverture\s+(\d+(?:[.,]\d+)?)\s*j\b/gi,(m,v)=>{
      const h=horizon(v);return h?`jusqu’à ${h}`:m;
    });
    txt=txt.replace(/Couverture suffisante\s*·\s*(\d+(?:[.,]\d+)?)\s*j\b/g,(m,v)=>{
      const h=horizon(v);return h?`Couverture suffisante · jusqu’à ${h}`:m;
    });
    if(txt!==original)node.nodeValue=txt;
  }

  function appliquer(){
    if(enCours)return;enCours=true;
    try{
      const root=document.getElementById('nexusManagerReassortCigarettesV3');
      if(!root)return;
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
      const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
      nodes.forEach(convertirTexte);
    }finally{enCours=false;}
  }

  function init(){
    appliquer();
    const o=new MutationObserver(appliquer);o.observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
