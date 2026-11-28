// ============================================================
// NEXUS A4-1 : cible de marge, lecture unique (module pur + un chargeur).
// Aucune cible n'est écrite en dur : elle vient de tarif_seuils (vue v_tarif_seuils_actifs),
// avec le statut « valide ». Un seul résolveur (seuilDe, nexus-politique-tarifaire.js).
// Trois états distincts :
//   NON_LISIBLE : la table n'a pas pu être lue (RLS, erreur, rôle sans droit). Rien n'est dit de l'objectif.
//   NON_DEFINI  : lecture réussie, aucune cible exploitable. Message réservé à manager et gérant.
//   DEFINI      : une cible existe. `valide` la rend décisionnelle (elle note) ; `indicatif` s'affiche seulement.
// Adaptateur futur du référentiel d'objectifs (#394, MAR-TAUX) : les lecteurs n'ont qu'à appeler resoudre().
// ============================================================
(function (global) {
  'use strict';
  const ETATS = { NON_LISIBLE: 'non_lisible', NON_DEFINI: 'non_defini', DEFINI: 'defini' };
  const ROLES_LECTEURS = ['manager', 'gerant', 'gérant'];
  const MENTION_SANS_CIBLE = 'calculé sans la Marge, objectif non défini';

  const dep = nom => {
    const d = global[nom]; if (!d) throw new Error(nom + ' non chargé');
    return d;
  };

  // Cible résolue pour un périmètre. `source` = {etat, lignes}. Pure, sans réseau.
  function creer(source) {
    const s = source || {};
    const etat0 = s.etat === ETATS.NON_LISIBLE ? ETATS.NON_LISIBLE : ETATS.DEFINI;
    let ctx = null;
    if (etat0 === ETATS.DEFINI) {
      ctx = dep('NexusPolitiqueTarifaireRegistres').contexteDepuisRegistres({ seuils: s.lignes || [] });
    }
    function resoudre(rayon, famille) {
      if (etat0 === ETATS.NON_LISIBLE) return { etat: ETATS.NON_LISIBLE, cible: null, minimum: null, statut: null, niveau: null, notante: false };
      // Aucune cible « station » : sans rayon ni famille, il n'y a rien à résoudre (A4-1, Guardian 7240692918).
      if (!rayon && !famille) throw new Error('resoudre(rayon, famille) exige un rayon ou une famille : pas de cible de station, voir objectifStation');
      const r = dep('NexusPolitiqueTarifaire').seuilDe(famille || null, rayon || null, ctx);
      if (!r || (!r.cibleValide && !r.cibleIndicative)) {
        return { etat: ETATS.NON_DEFINI, cible: null, minimum: null, statut: null, niveau: r ? r.niveau : null, notante: false };
      }
      return {
        etat: ETATS.DEFINI, cible: r.cible, niveau: r.niveau,
        statut: r.cibleValide ? 'valide' : 'indicatif',
        minimum: (r.minimumValide || r.minimumIndicatif) ? r.minimum : null,
        notante: !!r.cibleValide,
      };
    }
    return { resoudre };
  }

  // Indice : la Marge n'est notée que si objectifStation rend « evalue ». Sans lignes tarifaires (rayon, famille, CA),
  // le lecteur n'a rien à évaluer : état non_evalue, cibleNotante() rend null, l'Indice est non évalué.
  const nonEvalue = () => ({ etat: 'non_evalue', cible: null, minimum: null, statut: null, niveau: null, notante: false });

  const pct = v => Math.round(v * 1000) / 10 + ' %';

  // Texte d'objectif. Un employé ne lit pas tarif_seuils : rien n'est dit de l'objectif (null).
  function libelle(res, role) {
    if (!res || res.etat === ETATS.NON_LISIBLE) return null;
    if (res.etat === ETATS.NON_DEFINI) return ROLES_LECTEURS.indexOf(role) >= 0 ? 'objectif non défini' : null;
    return 'objectif ' + pct(res.cible) + (res.statut === 'valide' ? '' : ' (indicatif, non décisionnel)');
  }
  // Mention à afficher quand un score est calculé sans la Marge.
  function mentionSansCible(res, role) {
    if (res && res.etat === ETATS.NON_DEFINI && ROLES_LECTEURS.indexOf(role) >= 0) return MENTION_SANS_CIBLE;
    return null;
  }
  // Seule une cible valide note. Sinon null : le lecteur sort la Marge de son calcul.
  const cibleNotante = res => (res && res.etat === ETATS.DEFINI && res.notante) ? res.cible : null;

  // Palier d'affichage du Conseiller : « correct » = cible, « faible » = minimum. Sans seuil, aucun palier.
  function palier(res, margePct) {
    if (!res || res.etat !== ETATS.DEFINI || margePct == null) return null;
    if (margePct >= res.cible) return 'a_l_objectif';
    if (res.minimum != null && margePct < res.minimum) return 'faible';
    return 'correcte';
  }

  // Une seule lecture par chargement d'écran et par site (résultat partagé entre lecteurs).
  const cache = new Map();
  function charger(client, site, role) {
    if (!site || ROLES_LECTEURS.indexOf(role) < 0) return Promise.resolve(creer({ etat: ETATS.NON_LISIBLE }));
    if (!cache.has(site)) {
      cache.set(site, Promise.resolve().then(() => client.from('v_tarif_seuils_actifs').select('*').eq('site', site))
        .then(r => (r && !r.error && Array.isArray(r.data)) ? creer({ etat: ETATS.DEFINI, lignes: r.data }) : creer({ etat: ETATS.NON_LISIBLE }),
          () => creer({ etat: ETATS.NON_LISIBLE })));
    }
    return cache.get(site);
  }
  function oublier() { cache.clear(); }

  // ---- A4-1d : objectif de la station, calculé sur le périmètre comparable ----
  var SEUIL_COUVERTURE = 0.5;
  var num = function (v) { if (v === null || v === undefined || v === '') return null; var n = Number(v); return isFinite(n) ? n : null; };

  // Comparaison de rayons : répare « Ã » + espace(s) (mojibake), NFC, sans diacritiques, minuscules, espaces réduits.
  // Deux libellés réellement différents ne fusionnent pas.
  function normaliserRayon(c) {
    var s = String(c == null ? '' : c).replace(/Ã\s+/g, 'à ');
    try { s = s.normalize('NFC'); } catch (e) { /* environnement sans normalize */ }
    try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) { /* idem */ }
    return s.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  // lignes : lignes analysées {rayon, famille, ca_ht, margeEstimee:{margeHt}}.
  // contexte : { exclus: [rayons exclus], cibles: { famille: cible validée } }.
  // Périmètre comparable : lignes pilotables avec une cible validée ET une marge connue. La cible, la marge et la
  // couverture sont toutes mesurées sur ce même périmètre. Les lignes cibles mais sans marge sont comptées à part.
  function objectifStation(lignes, contexte) {
    var ctx = contexte || {}, exclus = {}, cibles = ctx.cibles || {};
    (ctx.exclus || []).forEach(function (r) { exclus[normaliserRayon(r && r.rayon_cle !== undefined ? r.rayon_cle : r)] = true; });
    var pil = 0, caC = 0, marge = 0, cible = 0, famC = {}, famPil = {}, famCiblees = {};
    var sm = { lignes: 0, ca: 0 }, caT = 0, cibleT = 0;
    (lignes || []).forEach(function (l) {
      if (!l || exclus[normaliserRayon(l.rayon)]) return;
      var ca = num(l.ca_ht); if (ca === null) return;
      pil += ca; if (l.famille) famPil[l.famille] = true;
      var c = l.famille ? num(cibles[l.famille]) : null;
      if (c === null) return;
      famCiblees[l.famille] = true; caT += ca; cibleT += ca * c;
      var m = l.margeEstimee ? num(l.margeEstimee.margeHt) : num(l.margeHt);
      if (m === null) { sm.lignes++; sm.ca += ca; return; }
      caC += ca; cible += ca * c; marge += m; famC[l.famille] = true;
    });
    var nbPil = Object.keys(famPil).length, nbCib = Object.keys(famCiblees).length, nb = Object.keys(famC).length;
    var covCa = pil > 0 ? caC / pil : 0;
    var res = {
      etat: 'non_evalue', cible: null, marge: null, familles: nb,
      couvertureCa: covCa, couverture: covCa,
      couvertureFamilles: nbPil > 0 ? nbCib / nbPil : 0, famillesCiblees: nbCib, famillesPilotables: nbPil,
      cibleMoyenne: caT > 0 ? cibleT / caT : null, sansMarge: sm
    };
    if (!nb || caC <= 0) return res;
    if (covCa < SEUIL_COUVERTURE) return res;
    res.etat = 'evalue'; res.cible = cible / caC; res.marge = marge / caC;
    return res;
  }

  const API = { normaliserRayon: normaliserRayon, objectifStation: objectifStation, SEUIL_COUVERTURE: SEUIL_COUVERTURE, ETATS, ROLES_LECTEURS, MENTION_SANS_CIBLE, creer, charger, oublier, libelle, mentionSansCible, cibleNotante, palier, nonEvalue };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.NexusCibleMarge = API;
})(typeof window !== 'undefined' ? window : globalThis);
