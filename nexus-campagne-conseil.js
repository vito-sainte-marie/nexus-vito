// Campagne V2, lot C6 : phrases du Conseiller tirées des résultats des moteurs existants.
// Module pur : aucun accès base, aucun recalcul. Une phrase n'existe que si sa donnée existe.
(function (global) {
  'use strict';
  // suivi : résultat de NexusCampagneVentes.suivre ; achats : résultat de NexusCampagneAchats.etatAchats ;
  // bilan : résultat de NexusCampagneBilan.bilanCampagne ; V : NexusVocab.campagne ; fmt : { eur, date }.
  function phrasesConseiller({ suivi, achats, bilan, V, fmt }) {
    const out = [];
    const f = fmt || {};
    if (suivi && !suivi.vide && Array.isArray(suivi.lignes) && suivi.lignes.length) {
      const m = suivi.lignes.filter(l => l.statut === 'moteur').length;
      const r = suivi.lignes.filter(l => l.statut === 'a_revoir').length;
      if (m) out.push(V.conseillerSuivi.moteurs(m));
      if (r) out.push(V.conseillerSuivi.aRevoir(r));
      if (!m && !r) out.push(V.conseillerSuivi.aucun);
      if (suivi.lignes.some(l => l.marge_estimee)) out.push(V.conseillerSuivi.estime);
    }
    if (achats && achats.ctx && Array.isArray(achats.ctx.reco)) {
      const n = achats.ctx.reco.filter(x => x.b && x.b.hors_delai).length;
      if (n) out.push(V.conseillerAchats.horsDelai(n, achats.ctx.lim && f.date ? f.date(achats.ctx.lim.date) : null));
    }
    if (bilan && Array.isArray(bilan.articles) && bilan.articles.length && bilan.totaux) {
      const e = bilan.totaux.economie_achat_stock_restant;
      if (e != null && Number.isFinite(Number(e)) && Number(e) > 0) {
        out.push(V.conseillerBilan.economie(f.eur ? f.eur(e) : String(e)));
        out.push(bilan.articles.some(a => a.estimee) ? V.conseillerBilan.estime : V.conseillerBilan.reel);
      }
    }
    return out;
  }
  global.NexusCampagneConseil = { phrasesConseiller };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.NexusCampagneConseil;
})(typeof window !== 'undefined' ? window : globalThis);
