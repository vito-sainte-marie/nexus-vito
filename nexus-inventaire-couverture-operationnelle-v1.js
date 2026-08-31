// NEXUS Inventaire — Couverture opérationnelle
// Présentation manager : transforme les durées abstraites (ex. 0,4 j)
// en horizon terrain (ex. Mardi · Quart 1). Le calcul de couverture reste inchangé.
(function(){
  'use strict';
  if((location.pathname.split('/').pop()||'')!=='NEXUS-Inventaire-Manager-v1.html') return;

  const JOURS=['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  let enCours=false;

  function horizon(jours){
    const n=Number(String(jours).replace(',','.'));
    if(!Number.isFinite(n)||n<0)return null;
    const d=new Date(Date.now()+n*86400000);
    // L'affichage est volontairement opérationnel : une journée est découpée
    // en deux quarts. Cette règle ne modifie aucun calcul de stock/réassort.
    const quart=d.getHours()<12?'Quart 1':'Quart 2';
    return `${JOURS[d.getDay()]} · ${quart}`;
  }

  function convertirTexte(node){
    if(node.nodeType!==Node.TEXT_NODE)return;
    const original=node.nodeValue||'';
    let txt=original;
    // « couverture 0.4 j » / « Couverture suffisante · 0.4 j »
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
