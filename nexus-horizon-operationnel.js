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
    // A3 / C2-3 (05/09/2026) : plus de seuil par défaut à 12 — une quatrième
    // valeur, qui ne venait ni de station_config (12:40) ni d'ailleurs. Et
    // plus de `date.getHours()` : l'heure de la machine ne détermine pas un
    // quart. Sans seuil fourni par l'appelant, le quart reste `null` —
    // l'horizon garde sa date et son jour, il n'invente pas le quart.
    const heureSeparation=Number.isFinite(Number(options.heureSeparationQuart)) ? Number(options.heureSeparationQuart) : null;
    const minutesLocales=(typeof options.timezone==='string' && options.timezone.trim() && global.NexusStation)
      ? global.NexusStation.minutesLocalesStation(options.timezone, date)
      : null;
    const quart=(heureSeparation===null || minutesLocales===null)
      ? null
      : (minutesLocales < heureSeparation*60 ? 'Quart 1' : 'Quart 2');
    return {
      date,
      jour:JOURS[date.getDay()],
      quart,
      // Quart inconnu : le libellé s'arrête au jour. « mardi » est vrai ;
      // « mardi · Quart 2 » serait une invention.
      label: quart ? `${JOURS[date.getDay()]} · ${quart}` : JOURS[date.getDay()]
    };
  }

  function libelleJusqua(jours, options={}){
    const h=horizonDepuisJours(jours,options);
    return h ? `jusqu’à ${h.label}` : null;
  }

  global.NexusHorizonOperationnel=Object.freeze({horizonDepuisJours,libelleJusqua});
})(window);
