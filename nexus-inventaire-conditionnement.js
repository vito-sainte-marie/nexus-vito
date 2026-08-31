// NEXUS Inventaire — conditionnement produit
// Source métier générique : une désignation terminant par -10P, -8P, -5P, etc.
// indique le nombre d'unités de base contenu dans un conditionnement/cartouche.
// Exemple : "Cigarettes Camel filtre 20 -10P" => 1 cartouche = 10 paquets.
(function(global){
  'use strict';

  function facteurDepuisDesignation(designation, fallback=null){
    const texte=String(designation||'').trim();
    // Priorité au suffixe explicite -10P / 10P. Evite d'interpréter le "20"
    // d'une dénomination cigarette comme un conditionnement.
    const m=texte.match(/(?:^|[\s_-])(\d{1,3})\s*P\s*$/i) || texte.match(/-(\d{1,3})\s*P\b/i);
    if(!m) return fallback;
    const n=Number(m[1]);
    return Number.isInteger(n)&&n>0?n:fallback;
  }

  function convertir(conditionnements,unites,designation,fallback=10){
    const facteur=facteurDepuisDesignation(designation,fallback);
    const c=Math.max(0,Number(conditionnements)||0);
    const u=Math.max(0,Number(unites)||0);
    return {facteur,quantite_base:c*facteur+u,conditionnements:c,unites:u};
  }

  function decomposer(quantiteBase,designation,fallback=10){
    const facteur=facteurDepuisDesignation(designation,fallback);
    const q=Math.max(0,Number(quantiteBase)||0);
    return {facteur,conditionnements:Math.floor(q/facteur),unites:q%facteur,quantite_base:q};
  }

  global.NexusConditionnement=Object.freeze({facteurDepuisDesignation,convertir,decomposer});
})(window);
