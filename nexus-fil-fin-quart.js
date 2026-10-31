'use strict';
// Fil « Fermeture de la piste » — lot FERMETURE-PISTE-20261031. Jumeau de nexus-fil-debut-quart.js, deux étapes :
// 1 index de fin de quart (fin_q1 / fin_q2), 2 inventaire de clôture de la zone piste. Les trois accès (heure, lien, menu)
// ouvrent le même fil, à la même étape : l'Accueil ne calcule le lien qu'ici (urlRepriseSelonFaits), jamais ailleurs.
// Module pur : aucune écriture en base. Seule trace : l'étape atteinte, mémorisée sur l'appareil (par employé et par jour),
// sous une clé distincte de celle du début de quart pour que les deux fils ne se croisent jamais.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NexusFilFinQuart = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const NOMBRE_ETAPES = 2;
  const ACCUEIL = 'NEXUS-App-v1.html';
  const LIBELLE_SORTIE = 'Quitter et revenir à l\'Accueil';
  const LIBELLE_TERMINER = 'Terminer la fermeture';
  const LIBELLES_VERS = { 2: 'Continuer vers l\'inventaire de clôture' };
  const PLAN_COMPLET = [1, 2];
  const PAGES = { 1: 'NEXUS-Releves-Piste-v1.html', 2: 'NEXUS-Inventaire-v1.html' };

  const parametres = (search) => new URLSearchParams(search || '');
  const etapeValide = (n) => Number.isInteger(n) && n >= 1 && n <= NOMBRE_ETAPES;

  function estActif(search) { return parametres(search).get('fil') === 'fin-quart'; }
  function etapeDe(search) {
    if (!estActif(search)) return null;
    const n = Number(parametres(search).get('etape'));
    return etapeValide(n) ? n : null;
  }
  function planDe(search) {
    const brut = parametres(search).get('plan');
    if (!brut) return PLAN_COMPLET.slice();
    const l = brut.split('.').map(Number);
    const ok = l.every(etapeValide) && l.every((n, i) => i === 0 || n > l[i - 1]);
    return ok ? l : PLAN_COMPLET.slice();
  }
  const planOuComplet = (plan) => (Array.isArray(plan) && plan.length ? plan : PLAN_COMPLET);
  // Étapes restantes d'après les faits : une étape faite ou sans objet n'y figure pas.
  function planSelonFaits({ resteIndex, resteInventaire }) {
    return [resteIndex && 1, resteInventaire && 2].filter(Boolean);
  }
  function suivante(n, plan) { return planOuComplet(plan).find(x => x > n) || null; }
  function libelleProgression(n, plan) {
    const p = planOuComplet(plan); const i = p.indexOf(n);
    return i < 0 ? '' : `Étape ${i + 1} sur ${p.length}`;
  }
  function libelleContinuer(n, plan) { const s = suivante(n, plan); return s ? LIBELLES_VERS[s] : LIBELLE_TERMINER; }

  // momentFin : fin_q1 / fin_q2, porté par `moment` à chaque étape.
  function urlEtape(n, momentFin, plan) {
    if (!etapeValide(n)) return ACCUEIL;
    const q = `fil=fin-quart&etape=${n}${momentFin ? `&moment=${momentFin}` : ''}${plan && plan.length ? `&plan=${plan.join('.')}` : ''}`;
    return `${PAGES[n]}?${q}`;
  }
  function momentDebutDe(search) {
    const p = parametres(search);
    return p.get('moment') || null;
  }
  function urlApres(n, momentFin, plan) { const s = suivante(n, plan); return s ? urlEtape(s, momentFin, planOuComplet(plan)) : ACCUEIL; }

  const cle = (empId, date) => `nexus_fil_fin_quart_${empId}_${date}`;
  function lire(stockage, empId, date) {
    try {
      const s = stockage.getItem(cle(empId, date));
      const o = s ? JSON.parse(s) : null;
      if (o && etapeValide(o.etape)) return { etape: o.etape, fini: !!o.fini };
    } catch (e) { /* illisible : on repart de l'étape 1 */ }
    return { etape: 1, fini: false };
  }
  function ecrire(stockage, empId, date, etat) {
    try { stockage.setItem(cle(empId, date), JSON.stringify({ etape: etat.etape, fini: !!etat.fini, t: Date.now() })); return true; }
    catch (e) { return false; }
  }
  function atteindre(stockage, empId, date, n) {
    const actuel = lire(stockage, empId, date);
    if (actuel.fini || !etapeValide(n) || n < actuel.etape) return actuel;
    const suivant = { etape: n, fini: false };
    ecrire(stockage, empId, date, suivant);
    return suivant;
  }
  function terminer(stockage, empId, date) { return ecrire(stockage, empId, date, { etape: NOMBRE_ETAPES, fini: true }); }
  // null : plus rien à faire, ou fil terminé. Sinon la première étape restante au moins égale à l'étape mémorisée.
  function urlRepriseSelonFaits(stockage, empId, date, momentFin, faits) {
    const e = lire(stockage, empId, date);
    if (e.fini) return null;
    const plan = planSelonFaits(faits);
    if (!plan.length) return null;
    const etape = plan.find(x => x >= e.etape) || plan[0];
    return urlEtape(etape, momentFin, plan);
  }

  return { NOMBRE_ETAPES, ACCUEIL, LIBELLE_SORTIE, estActif, etapeDe, planDe, planSelonFaits, momentDebutDe, libelleProgression, libelleContinuer, urlEtape, urlApres, lire, ecrire, atteindre, terminer, urlRepriseSelonFaits };
});
