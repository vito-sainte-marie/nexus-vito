// NEXUS Inventaire — conditionnement produit
// Source métier générique : une désignation terminant par -10P, -8P, -5P
// ou -P10, -P8, -P5 indique le nombre d'unités de base contenu dans un
// conditionnement/cartouche.
// Exemples : "Cigarettes Camel filtre 20 -10P" et
// "Cigarette Signature convertible Menthol -P10" => 1 cartouche = 10 paquets.
(function(global){
  'use strict';

  function facteurDepuisDesignation(designation, fallback=null){
    const texte=String(designation||'').trim();
    // Priorité aux suffixes explicites. On évite volontairement d'interpréter
    // le "20", "25", "30" ou "40" de la référence cigarette elle-même.
    const m=
      texte.match(/(?:^|[\s_-])(\d{1,3})\s*P\s*$/i) ||
      texte.match(/-(\d{1,3})\s*P\b/i) ||
      texte.match(/(?:^|[\s_-])P\s*(\d{1,3})\s*$/i) ||
      texte.match(/-P\s*(\d{1,3})\b/i);
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
