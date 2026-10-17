// NEXUS — Relevés piste : logique pure (aucun accès réseau, aucun DOM).
// Carnet d'aide au relevé et à la recopie ; Decenium reste la référence.
// Lot FAST-TRACK-POMPISTE-RELEVES-PISTE-20261016 — Test uniquement.
(function (root) {
  'use strict';

  const SEUIL_ECART_INDICATIF_L = 4000; // provisoire, non validé (arbitrage restant)
  const GNR_INDEX_REFERENCE = 1191213;
  const MOMENTS = ['debut_q1', 'fin_q1', 'debut_q2', 'fin_q2'];
  // Arbitrage du 17/10/2026 : début = référence validée + confirmation (aucune
  // recopie, Decenium renseigne le début) ; fin = saisie complète + recopie.
  const MOMENTS_DEBUT = ['debut_q1', 'debut_q2'];
  const MOMENTS_FIN = ['fin_q1', 'fin_q2'];
  const estDebut = m => MOMENTS_DEBUT.indexOf(m) >= 0;
  const estFin = m => MOMENTS_FIN.indexOf(m) >= 0;
  const QUART_DU_MOMENT = { debut_q1: 'Q1', fin_q1: 'Q1', debut_q2: 'Q2', fin_q2: 'Q2' };
  // Habilitation : le pompiste n'accède qu'aux deux moments de son quart réel.
  // quartReel : 'Q1' | 'Q2' | autre/null (aucune habilitation).
  // quartReel accepte les libellés de `shifts.quart` ('matin' = Q1, 'soir' = Q2).
  function normaliserQuart(q) {
    const v = String(q == null ? '' : q).toLowerCase();
    if (v === 'q1' || v === 'matin') return 'Q1';
    if (v === 'q2' || v === 'soir') return 'Q2';
    return null;
  }
  // quartsReels : liste (ou valeur) des quarts affectés ce jour ; vide = aucun accès.
  function momentsHabilites(quartsReels) {
    const qs = [].concat(quartsReels == null ? [] : quartsReels).map(normaliserQuart).filter(Boolean);
    return MOMENTS.filter(m => qs.indexOf(QUART_DU_MOMENT[m]) >= 0);
  }
  // Moment du quart auquel on est : début tant que rien n'est final, sinon fin.
  // Tolérance de nuit (0 conforme, +1 toléré, +2..+9 à justifier, >=+10
  // alerte prioritaire, <0 diminution) : unité d'index à confirmer (compteur).
  const TOLERANCE_NUIT_MAX = 1, SEUIL_ALERTE_PRIORITAIRE = 10;
  function classerEcartNuit(ecart) {
    if (ecart == null || !Number.isFinite(Number(ecart))) return { code: null, ecart: null };
    const e = Number(ecart);
    let code;
    if (e < 0) code = 'diminution';
    else if (e === 0) code = 'conforme';
    else if (e <= TOLERANCE_NUIT_MAX) code = 'toleree';
    else if (e < SEUIL_ALERTE_PRIORITAIRE) code = 'a_justifier';
    else code = 'alerte_prioritaire';
    return { code, ecart: e };
  }
  // Référence de début de quart. reference : sept chiffres validés ou null.
  // saisie : ce que le pompiste a tapé (2 chiffres, ou 7 si complet).
  // Retour : { statut, valeurSept, ecart, ok } ; jamais une preuve absolue
  // d'identité des 7 chiffres (le contrôle partiel ne contrôle que 2 chiffres).
  function evaluerDebut(reference, saisie) {
    const s = String(saisie == null ? '' : saisie).replace(/\D/g, '');
    if (!estSeptChiffres(reference)) {
      return estSeptChiffres(s)
        ? { statut: 'indisponible', valeurSept: s, ok: true }
        : { statut: 'indisponible', valeurSept: null, ok: false, raison: 'SEPT_CHIFFRES_REQUIS' };
    }
    if (s.length === 2) {
      return s === reference.slice(-2)
        ? { statut: 'confirmee_deux_chiffres', valeurSept: reference, ok: true }
        : { statut: 'saisie_complete', valeurSept: null, ok: false, raison: 'DEUX_CHIFFRES_DIFFERENTS' };
    }
    if (estSeptChiffres(s)) return { statut: 'saisie_complete', valeurSept: s, ok: true };
    return { statut: 'saisie_complete', valeurSept: null, ok: false, raison: 'SAISIE_INCOMPLETE' };
  }

  // Disposition physique des Tokheim : de gauche à droite.
  const ORDRE_PHYSIQUE = {
    1: ['GO', 'SP'], 2: ['SP', 'GO'], 3: ['GO', 'SP'], 4: ['SP', 'GO'],
  };
  const POMPES = [1, 2, 3, 4];

  // Ordre de recopie Decenium : par pompe, SP puis GO ; GNR en dernier.
  function ordreRecopieDecenium() {
    const l = [];
    POMPES.forEach(p => ['SP', 'GO'].forEach(produit => l.push({ pompe: p, produit })));
    l.push({ pompe: null, produit: 'GNR' });
    return l;
  }

  function nettoyerSaisie(s) {
    return String(s == null ? '' : s).replace(/\D/g, '').slice(0, 7);
  }
  function estSeptChiffres(s) { return /^[0-9]{7}$/.test(String(s)); }

  // Conversion contrôlée 7 → 6 chiffres : on retire le chiffre de gauche.
  // sansPerte = ce chiffre est 0 (sinon la valeur Decenium est tronquée et le
  // dit à l'écran).
  function convertirSeptVersSix(sept) {
    if (!estSeptChiffres(sept)) return null;
    return { valeurDecenium: sept.slice(1), troncatureSansPerte: sept[0] === '0', chiffreRetire: sept[0] };
  }

  // Contrôle d'un index saisi face au précédent connu (nombre ou null).
  // niveau : 'ok' | 'indicatif' (écart > seuil, non bloquant)
  //        | 'fort' (recul : confirmation justifiée et tracée exigée)
  function controlerIndex(sept, precedent) {
    if (!estSeptChiffres(sept)) return { niveau: 'invalide', ecart: null };
    if (precedent == null || !Number.isFinite(Number(precedent))) return { niveau: 'ok', ecart: null, sansReference: true };
    const ecart = Number(sept) - Number(precedent);
    if (ecart < 0) return { niveau: 'fort', ecart, code: 'INDEX_INFERIEUR' };
    if (ecart > SEUIL_ECART_INDICATIF_L) return { niveau: 'indicatif', ecart, code: 'ECART_ELEVE' };
    return { niveau: 'ok', ecart };
  }

  // Une confirmation d'index en recul exige un motif non vide.
  function confirmationExceptionnelleValide(motif) {
    return typeof motif === 'string' && motif.trim().length >= 3;
  }

  // Comparaison fin Q1 / début Q2, compteur par compteur.
  // a, b : { 'pompe-produit': 'septChiffres' }. Les deux valeurs et auteurs
  // sont conservés par l'appelant ; ici on ne tranche jamais.
  function comparerQ1Q2(finQ1, debutQ2) {
    const clefs = [];
    POMPES.forEach(p => ORDRE_PHYSIQUE[p].forEach(pr => clefs.push(`${p}-${pr}`)));
    return clefs.map(k => {
      const a = finQ1 && finQ1[k], b = debutQ2 && debutQ2[k];
      let etat;
      if (!a || !b) etat = 'incomplet';
      else etat = a === b ? 'concordant' : 'divergent';
      return { clef: k, finQ1: a || null, debutQ2: b || null, etat, ecart: (a && b) ? Number(b) - Number(a) : null };
    });
  }

  // Revue des anomalies avant validation finale : une seule liste.
  function revueAnomalies(saisies, precedents, motifs, moment) {
    const lignes = [];
    POMPES.forEach(p => ORDRE_PHYSIQUE[p].forEach(pr => {
      const k = `${p}-${pr}`;
      const v = saisies[k];
      if (!v) { lignes.push({ clef: k, code: 'MANQUANT', bloquant: true }); return; }
      if (!estSeptChiffres(v)) { lignes.push({ clef: k, code: 'INVALIDE', bloquant: true }); return; }
      if (moment === 'debut_q1') { // écart de nuit : jamais bloquant
        const n = classerEcartNuit(precedents && precedents[k] != null ? Number(v) - Number(precedents[k]) : null);
        if (n.code && n.code !== 'conforme') lignes.push({ clef: k, code: 'NUIT_' + n.code.toUpperCase(), ecart: n.ecart, nuit: n.code, bloquant: false });
        return;
      }
      const c = controlerIndex(v, precedents ? precedents[k] : null);
      if (c.niveau === 'fort') {
        lignes.push({ clef: k, code: c.code, ecart: c.ecart, bloquant: !confirmationExceptionnelleValide(motifs && motifs[k]) });
      } else if (c.niveau === 'indicatif') {
        lignes.push({ clef: k, code: c.code, ecart: c.ecart, bloquant: false });
      }
    }));
    return { lignes, peutValider: !lignes.some(l => l.bloquant) };
  }

  // Corriger une valeur déjà cochée « recopiée » annule la coche.
  function appliquerCorrection(ligne, nouvelleSept) {
    if (ligne.valeurSept === nouvelleSept) return ligne;
    return Object.assign({}, ligne, { valeurSept: nouvelleSept, recopiee: false });
  }

  const TEXTE_CONFIRMATION_RECOPIE = 'Je confirme avoir recopié les valeurs dans Decenium.';

  const api = {
    MOMENTS_DEBUT, MOMENTS_FIN, estDebut, estFin, QUART_DU_MOMENT, normaliserQuart, momentsHabilites,
    TOLERANCE_NUIT_MAX, SEUIL_ALERTE_PRIORITAIRE, classerEcartNuit, evaluerDebut,
    SEUIL_ECART_INDICATIF_L, GNR_INDEX_REFERENCE, MOMENTS, ORDRE_PHYSIQUE, POMPES,
    ordreRecopieDecenium, nettoyerSaisie, estSeptChiffres, convertirSeptVersSix,
    controlerIndex, confirmationExceptionnelleValide, comparerQ1Q2, revueAnomalies,
    appliquerCorrection, TEXTE_CONFIRMATION_RECOPIE,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.NexusRelevesPiste = api;
})(typeof window !== 'undefined' ? window : globalThis);
