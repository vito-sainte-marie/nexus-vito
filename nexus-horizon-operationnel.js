// NEXUS Core — Horizon opérationnel
// Standard d'affichage : le moteur peut raisonner en jours décimaux,
// l'interface manager restitue un horizon concret "Mardi · Quart 1".
// Ce helper ne modifie jamais les calculs de couverture.
(function(global){
  'use strict';

  const JOURS=['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];

  function horizonDepuisJours(jours, options={}){
    const n=Number(String(jours ?? '').replace(',','.'));
    if(!Number.isFinite(n) || n<0) return null;
    const reference=options.reference instanceof Date ? new Date(options.reference) : new Date();
    const date=new Date(reference.getTime()+n*86400000);
    const heureSeparation=Number.isFinite(Number(options.heureSeparationQuart)) ? Number(options.heureSeparationQuart) : 12;
    const quart=date.getHours()<heureSeparation?'Quart 1':'Quart 2';
    return {
      date,
      jour:JOURS[date.getDay()],
      quart,
      label:`${JOURS[date.getDay()]} · ${quart}`
    };
  }

  function libelleJusqua(jours, options={}){
    const h=horizonDepuisJours(jours,options);
    return h ? `jusqu’à ${h.label}` : null;
  }

  global.NexusHorizonOperationnel=Object.freeze({horizonDepuisJours,libelleJusqua});
})(window);
