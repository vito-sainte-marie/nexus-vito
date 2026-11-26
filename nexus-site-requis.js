// ============================================================
// NEXUS — garde « site obligatoire » (lot A2, audit #393 §13.5 ordre 3)
//
// Un chargeur qui lit une table multi-stations reçoit le site EXPLICITEMENT.
// Sans site, il ÉCHOUE : jamais de repli silencieux vers « toutes les
// stations » (la RLS ne distingue pas les stations d'un compte créateur,
// Article 11 : une seule définition de cette règle, ici).
// ============================================================
(function (global) {
  'use strict';
  function exiger(siteId, contexte) {
    if (typeof siteId !== 'string' || siteId.trim() === '') {
      throw new Error('siteId obligatoire' + (contexte ? ' (' + contexte + ')' : '') + ' : lecture refusée sans station.');
    }
    return siteId;
  }
  const api = { exiger };
  global.NexusSiteRequis = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
