'use strict';
// Fil « Ma caisse » — lot INVENTAIRE-CAISSE-RENFORT-20261102, L1 (decision-4, APPROVED_WITH_CONDITIONS).
// Trois étapes au plus : 1 inscription au quart, 2 comptage d'ouverture ou de changement (cigarettes à l'aveugle, CBD, produits du jour),
// 3 comptage de fermeture. Même règle que le fil du pompiste : une étape faite ou sans objet ne figure pas dans le plan.
// REFUS PAR DÉFAUT : le fil n'existe que pour un pilote de la caisse (nexus-pilotes-inventaire.js) dont le rôle du jour est caissière.
// Pour tout autre cas, estActif / urlEtape / planPour répondent « pas de fil » et l'écran garde son comportement actuel.
// Ce contrôle est un mécanisme de déploiement côté page, pas une frontière d'autorisation : la RLS reste la frontière.
// Module pur : aucune écriture en base, aucune lecture de la liste de renfort (lecteur prévu en L3).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NexusFilCaisse = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const NOMBRE_ETAPES = 3;
  // Étape 3 (fermeture individuelle) ouverte : la validation écrit la seule ligne de l'employée (a_valide_cloture) ; la clôture du quart
  // est faite par le serveur (run_scheduled_inventory_reviews, PR #176). Repasser à false referme l'étape sans autre effet.
  const FERMETURE_OUVERTE = true;
  const PAGE = 'NEXUS-Inventaire-v1.html';
  const ACCUEIL = 'NEXUS-App-v1.html';
  const ROLE = 'caissiere';
  const PLAN_COMPLET = [1, 2, 3];
  // Périmètre du comptage d'entrée (decision-4, condition 2) : catégories du site existantes, sans catégorie ni produit nouveau.
  // Cigarettes (à l'aveugle), CBD, et les produits du jour (journaux, pains / sandwichs, viennoiserie).
  const CATEGORIES_CAISSE = ['cigarettes', 'cbd', 'journaux', 'pains / sandwichs', 'viennoiserie'];
  const LIBELLES_VERS = { 2: 'Continuer vers mon comptage', 3: 'Continuer vers ma fermeture' };
  const LIBELLE_TERMINER = 'Terminer ma caisse';
  const MESSAGE_AUCUN_PRODUIT = 'Aucun produit caisse à compter, prévenez votre responsable.';
  const LIBELLE_SORTIE = 'Quitter et revenir à l\'Accueil';

  const parametres = (search) => new URLSearchParams(search || '');
  const etapeValide = (n) => Number.isInteger(n) && n >= 1 && n <= NOMBRE_ETAPES;

  // Autorisation d'afficher le fil : pilote déclaré ET caissière du jour. Tout le reste : false.
  const autorise = (pilote, roleDuJour) => pilote === true && roleDuJour === ROLE;

  function estActif(search, pilote, roleDuJour) {
    return autorise(pilote, roleDuJour) && parametres(search).get('fil') === 'caisse';
  }
  function etapeDe(search, pilote, roleDuJour) {
    if (!estActif(search, pilote, roleDuJour)) return null;
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

  // Étapes restantes d'après les faits ; vide si l'on n'est pas pilote caissière (aucun fil).
  function planPour({ pilote, roleDuJour, inscrit, comptageFait, fermetureDue, fermetureFaite }) {
    if (!autorise(pilote, roleDuJour)) return [];
    return [!inscrit && 1, !comptageFait && 2, FERMETURE_OUVERTE && fermetureDue && !fermetureFaite && 3].filter(Boolean);
  }
  // Nature du comptage de l'étape 2 : à l'arrivée sur un quart déjà compté par une collègue, c'est un changement
  // (un seul comptage de la caissière entrante ferme Q1 et ouvre Q2, decision-2) ; sinon une ouverture.
  function natureComptage({ quartPrecedentCompte }) { return quartPrecedentCompte === true ? 'changement' : 'ouverture'; }

  const nomCategorie = (p) => String((p && (p.categorie || p.categorie_nom || (p.inventaire_categories && p.inventaire_categories.nom))) || '').trim().toLocaleLowerCase('fr-FR');
  const estProduitCaisse = (p) => CATEGORIES_CAISSE.includes(nomCategorie(p));
  // Restreint la liste au périmètre de la caissière ; hors fil autorisé, la liste est rendue telle quelle (même référence).
  function restreindre(liste, pilote, roleDuJour) {
    return autorise(pilote, roleDuJour) && Array.isArray(liste) ? liste.filter(estProduitCaisse) : liste;
  }

  function suivante(n, plan) { return planOuComplet(plan).find((x) => x > n) || null; }
  function libelleProgression(n, plan) {
    const p = planOuComplet(plan); const i = p.indexOf(n);
    return i < 0 ? '' : `Étape ${i + 1} sur ${p.length}`;
  }
  function libelleContinuer(n, plan) { const s = suivante(n, plan); return s ? LIBELLES_VERS[s] : LIBELLE_TERMINER; }

  // Adresse d'une étape ; null si le fil n'est pas autorisé (l'appelant garde alors son chemin actuel).
  function urlEtape(n, plan, pilote, roleDuJour) {
    if (!autorise(pilote, roleDuJour) || !etapeValide(n)) return null;
    return `${PAGE}?fil=caisse&etape=${n}${plan && plan.length ? `&plan=${plan.join('.')}` : ''}`;
  }
  function urlApres(n, plan, pilote, roleDuJour) {
    if (!autorise(pilote, roleDuJour)) return null;
    const s = suivante(n, plan);
    return s ? urlEtape(s, planOuComplet(plan), pilote, roleDuJour) : ACCUEIL;
  }

  return { NOMBRE_ETAPES, FERMETURE_OUVERTE, PAGE, ACCUEIL, ROLE, MESSAGE_AUCUN_PRODUIT, LIBELLE_SORTIE, LIBELLE_TERMINER, autorise, estActif, etapeDe, planDe, planPour, natureComptage, CATEGORIES_CAISSE, estProduitCaisse, restreindre, libelleProgression, libelleContinuer, urlEtape, urlApres };
});
