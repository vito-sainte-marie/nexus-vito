// NEXUS — Relevés piste : logique pure (aucun accès réseau, aucun DOM).
// Carnet d'aide au relevé et à la recopie ; Decenium reste la référence.
// Lot FAST-TRACK-POMPISTE-RELEVES-PISTE-20261016 — Test uniquement.
(function (root) {
  'use strict';

  const SEUIL_ECART_INDICATIF_L = 4000; // provisoire, non validé (arbitrage restant)
  const GNR_INDEX_REFERENCE = 1191213;
  const MOMENTS = ['fin_q1', 'debut_q2', 'fin_q2'];

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
  function revueAnomalies(saisies, precedents, motifs) {
    const lignes = [];
    POMPES.forEach(p => ORDRE_PHYSIQUE[p].forEach(pr => {
      const k = `${p}-${pr}`;
      const v = saisies[k];
      if (!v) { lignes.push({ clef: k, code: 'MANQUANT', bloquant: true }); return; }
      if (!estSeptChiffres(v)) { lignes.push({ clef: k, code: 'INVALIDE', bloquant: true }); return; }
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
    SEUIL_ECART_INDICATIF_L, GNR_INDEX_REFERENCE, MOMENTS, ORDRE_PHYSIQUE, POMPES,
    ordreRecopieDecenium, nettoyerSaisie, estSeptChiffres, convertirSeptVersSix,
    controlerIndex, confirmationExceptionnelleValide, comparerQ1Q2, revueAnomalies,
    appliquerCorrection, TEXTE_CONFIRMATION_RECOPIE,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.NexusRelevesPiste = api;
})(typeof window !== 'undefined' ? window : globalThis);
