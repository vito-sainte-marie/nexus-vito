'use strict';
// Fil « Mon début de quart » — lot PARCOURS-POMPISTE-LOT2-FIL-DEBUT-DE-QUART-20261021.
// Jusqu'à trois étapes qui s'ouvrent l'une l'autre : 1 jaugeage d'ouverture, 2 relevé des index, 3 inventaire gaz / glaçons / écailles.
// Même règle que determinerProchaineActionEmploye : une étape déjà faite ou non applicable ne figure pas dans le fil (le jaugeage,
// fait une fois par jour, est absent si le matin l'a fait). Le plan (`plan=1.3`) est fixé à l'entrée dans le fil d'après les faits ;
// la progression compte les étapes réellement restantes (« Étape 1 sur 2 »), jamais un « sur 3 » figé. Pas de FDJ : boutique seule.
// Module pur : aucune écriture en base. Seule trace : l'étape atteinte, mémorisée sur l'appareil (par employé et par jour)
// pour reprendre le fil là où le pompiste s'est arrêté. Les brouillons de saisie restent ceux de chaque écran.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NexusFilDebutQuart = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const NOMBRE_ETAPES = 3;
  const ACCUEIL = 'NEXUS-App-v1.html';
  // La prise de poste n'a pas les faits du jour : elle envoie le pompiste à l'Accueil, qui calcule le plan et ouvre le fil.
  const ACCUEIL_DEMARRAGE = 'NEXUS-App-v1.html?fil=demarrer';
  const demarrageDemande = (search) => parametres(search).get('fil') === 'demarrer';
  const LIBELLE_SORTIE = 'Quitter et revenir à l\'Accueil';
  const LIBELLE_TERMINER = 'Terminer mon début de quart';
  const LIBELLES_VERS = { 2: 'Continuer vers le relevé des index', 3: 'Continuer vers l\'inventaire' };
  const PLAN_COMPLET = [1, 2, 3];
  const PAGES = { 1: 'NEXUS-Releves-Piste-v1.html', 2: 'NEXUS-Releves-Piste-v1.html', 3: 'NEXUS-Inventaire-v1.html' };
  // Mot entier : « Lave-glace » n'est pas « Glaçons ». Seules Gaz, Glaçons et Écailles entrent dans le fil.
  const CATEGORIES_FIL = /(?<![\p{L}\p{N}])(?:gaz|gla[cç]ons?|[ée]cailles?)(?![\p{L}\p{N}])/iu;

  const parametres = (search) => new URLSearchParams(search || '');
  const etapeValide = (n) => Number.isInteger(n) && n >= 1 && n <= NOMBRE_ETAPES;

  function estActif(search) { return parametres(search).get('fil') === 'debut-quart'; }
  function etapeDe(search) {
    if (!estActif(search)) return null;
    const n = Number(parametres(search).get('etape'));
    return etapeValide(n) ? n : null;
  }
  // Plan : les étapes restantes à l'entrée dans le fil, lues dans `plan=1.3` (absent ou illisible : les trois).
  function planDe(search) {
    const brut = parametres(search).get('plan');
    if (!brut) return PLAN_COMPLET.slice();
    const l = brut.split('.').map(Number);
    const ok = l.every(etapeValide) && l.every((n, i) => i === 0 || n > l[i - 1]);
    return ok ? l : PLAN_COMPLET.slice();
  }
  const planOuComplet = (plan) => (Array.isArray(plan) && plan.length ? plan : PLAN_COMPLET);
  // Étapes restantes d'après les faits : une étape faite ou sans objet n'y figure pas.
  function planSelonFaits({ resteJaugeage, resteIndex, resteInventaire }) {
    return [resteJaugeage && 1, resteIndex && 2, resteInventaire && 3].filter(Boolean);
  }
  function suivante(n, plan) { return planOuComplet(plan).find(x => x > n) || null; }
  function libelleProgression(n, plan) {
    const p = planOuComplet(plan); const i = p.indexOf(n);
    return i < 0 ? '' : `Étape ${i + 1} sur ${p.length}`;
  }
  function libelleContinuer(n, plan) { const s = suivante(n, plan); return s ? LIBELLES_VERS[s] : LIBELLE_TERMINER; }

  // Adresse d'une étape. momentDebut : le moment de début du quart choisi à la prise de poste (debut_q1 / debut_q2),
  // porté par `debut` à chaque étape ; l'étape 2 l'ouvre aussi directement par `moment`.
  function urlEtape(n, momentDebut, plan) {
    if (!etapeValide(n)) return ACCUEIL;
    const q = `fil=debut-quart&etape=${n}${momentDebut ? `&debut=${momentDebut}` : ''}${plan && plan.length ? `&plan=${plan.join('.')}` : ''}`;
    if (n === 1) return `${PAGES[1]}?${q}&ecran=jauge`;
    if (n === 2) return `${PAGES[2]}?${q}${momentDebut ? `&moment=${momentDebut}` : ''}`;
    return `${PAGES[3]}?${q}`;
  }
  function momentDebutDe(search) {
    const p = parametres(search);
    return p.get('debut') || p.get('moment') || null;
  }
  // Après l'étape n : l'étape suivante, ou l'Accueil à la fin.
  function urlApres(n, momentDebut, plan) { const s = suivante(n, plan); return s ? urlEtape(s, momentDebut, planOuComplet(plan)) : ACCUEIL; }

  // Seules les catégories du fil (gaz, glaçons, écailles) sont comptées à l'étape 3.
  function categorieDuFil(nom) { return CATEGORIES_FIL.test(String(nom || '')); }

  // Mémoire de l'étape : { etape: 1..3, fini: bool }. Stockage injecté (try/catch : navigation privée, accès refusé).
  const cle = (empId, date) => `nexus_fil_debut_quart_${empId}_${date}`;
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
  // Marque l'étape atteinte sans jamais revenir en arrière.
  function atteindre(stockage, empId, date, n) {
    const actuel = lire(stockage, empId, date);
    if (actuel.fini || !etapeValide(n) || n < actuel.etape) return actuel;
    const suivant = { etape: n, fini: false };
    ecrire(stockage, empId, date, suivant);
    return suivant;
  }
  function terminer(stockage, empId, date) { return ecrire(stockage, empId, date, { etape: NOMBRE_ETAPES, fini: true }); }
  // Reprise d'après les faits du serveur autant que la mémoire de l'appareil : un pompiste qui change d'appareil
  // ne repart pas de l'étape 1 si son jaugeage ou ses index sont déjà validés. null : plus rien à faire, ou fil terminé.
  // On reprend à la première étape restante au moins égale à l'étape mémorisée (sinon à la première restante).
  function urlRepriseSelonFaits(stockage, empId, date, momentDebut, faits) {
    const e = lire(stockage, empId, date);
    if (e.fini) return null;
    const plan = planSelonFaits(faits);
    if (!plan.length) return null;
    const etape = plan.find(x => x >= e.etape) || plan[0];
    return urlEtape(etape, momentDebut, plan);
  }

  return { NOMBRE_ETAPES, ACCUEIL, ACCUEIL_DEMARRAGE, demarrageDemande, LIBELLE_SORTIE, estActif, etapeDe, planDe, planSelonFaits, momentDebutDe, libelleProgression, libelleContinuer, urlEtape, urlApres, categorieDuFil, lire, ecrire, atteindre, terminer, urlRepriseSelonFaits };
});
