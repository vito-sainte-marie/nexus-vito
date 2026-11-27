'use strict';
// B0-perf-6 : pdf-lib (~500 Ko) et nexus-pdf-moteur.js ne sont plus chargés avec la page.
// Ils le sont à la demande, au premier export PDF. Ordre garanti : pdf-lib d'abord (le moteur
// refuse de se charger sans PDFLib), puis le moteur. Un échec n'est pas mémorisé : un nouvel essai est possible.
(function (global) {
  const URL_PDF_LIB = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
  const URL_MOTEUR = 'nexus-pdf-moteur.js?v=20261125-2300';
  let promesse = null;
  function charger(src) {
    return new Promise(function (ok, ko) {
      const s = document.createElement('script');
      s.src = src;
      s.onload = function () { ok(); };
      s.onerror = function () { s.remove(); ko(new Error('Chargement impossible : ' + src)); };
      document.head.appendChild(s);
    });
  }
  function nexusChargerPdf() {
    if (global.NexusPdfMoteur) return Promise.resolve(global.NexusPdfMoteur);
    if (!promesse) {
      promesse = (global.PDFLib ? Promise.resolve() : charger(URL_PDF_LIB))
        .then(function () { return charger(URL_MOTEUR); })
        .then(function () {
          if (!global.NexusPdfMoteur) throw new Error('NexusPdfMoteur indéfini après chargement');
          return global.NexusPdfMoteur;
        })
        .catch(function (e) { promesse = null; throw e; });
    }
    return promesse;
  }
  global.nexusChargerPdf = nexusChargerPdf;
})(typeof window !== 'undefined' ? window : globalThis);
