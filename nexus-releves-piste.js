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
  // role : manager/gérant voient tous les moments (affichage ; la RLS reste l'autorité).
  function momentsHabilites(quartsReels, role) {
    if (role === 'manager' || role === 'gerant') return MOMENTS.slice();
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

  // Cause d'un échec d'envoi de la photo du jaugeage. Même principe que le pointage
  // (erreurDefinitive) : on ne devine pas, on regarde si le serveur a répondu.
  // Pas de réponse (hors ligne, coupure) = 'reseau' ; réponse de refus = 'refus'.
  // Storage ne pose pas de SQLSTATE : il renvoie statusCode (400/401/403) et un message.
  function causePhoto(erreur, enLigne) {
    if (enLigne === false) return { type: 'reseau', message: 'Photo non envoyée : pas de réseau. Réessayez, ou saisissez à la main.' };
    if (!erreur) return { type: 'reseau', message: 'Photo non envoyée. Réessayez, ou saisissez à la main.' };
    const code = String(erreur.statusCode || erreur.status || (erreur.originalError && erreur.originalError.status) || '');
    const texte = String(erreur.message || '').toLowerCase();
    if (/row-level security|violates|not allowed|unauthorized|forbidden/.test(texte) || code === '401' || code === '403') {
      return { type: 'refus', message: 'Photo refusée par NEXUS (ce n\'est pas un problème de réseau). Vous devez avoir un quart en cours aujourd\'hui sur ce site, avec le rôle pompiste. Si c\'est le cas, prévenez votre manager. Vous pouvez saisir les volumes à la main.' };
    }
    if (code === '413' || /too large|payload|exceeded/.test(texte)) {
      return { type: 'refus', message: 'Photo refusée : fichier trop lourd. Reprenez la photo de plus près ou saisissez à la main.' };
    }
    if (code === '415' || /mime|invalid.*type|unsupported/.test(texte)) {
      return { type: 'refus', message: 'Photo refusée : format non accepté (JPEG, PNG, WebP ou HEIC). Reprenez la photo ou saisissez à la main.' };
    }
    if (/^[45]\d\d$/.test(code)) {
      return { type: 'refus', message: 'Photo refusée par le serveur (code ' + code + '). Saisissez à la main et prévenez votre manager.' };
    }
    return { type: 'reseau', message: 'Photo non envoyée (pas de réseau). Saisissez à la main ou réessayez.' };
  }

  // Extension et type MIME d'une photo, d'après le type déclaré par l'appareil d'abord
  // (Android donne parfois un nom sans extension ou « image » / « 1699999.tmp »),
  // puis l'extension du nom. Seules les extensions admises par la politique Storage
  // (jpg, jpeg, png, webp, heic) sont rendues ; un format inconnu rend null.
  const TYPES_PHOTO = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/pjpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heic' };
  const MIME_PHOTO = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic' };
  function extensionPhoto(fichier) {
    const type = String((fichier && fichier.type) || '').toLowerCase().split(';')[0].trim();
    const nom = String((fichier && fichier.name) || '');
    const pointe = nom.lastIndexOf('.') >= 0 ? nom.slice(nom.lastIndexOf('.') + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : '';
    let ext = TYPES_PHOTO[type] || null;
    if (!ext && MIME_PHOTO[pointe]) ext = pointe === 'jpeg' ? 'jpg' : pointe;
    if (!ext && (type === '' || type === 'application/octet-stream' || type === 'image/*')) ext = 'jpg'; // photo d'appareil sans type : JPEG
    if (!ext) return null;
    return { ext, contentType: MIME_PHOTO[ext] };
  }

  // Pré-contrôle avant l'envoi : l'appel `est_pompiste_du_jour(site)` dit si l'utilisateur a un
  // quart en cours aujourd'hui avec le rôle pompiste. Seul un `false` franc bloque ; une erreur
  // d'appel ne bloque rien (la politique Storage reste l'autorité, ce contrôle ne fait que nommer la cause).
  function precontrolePompiste(reponse) {
    if (reponse && !reponse.error && reponse.data === false) {
      return { ok: false, message: 'Photo non envoyée : aucun quart en cours aujourd\'hui sur ce site avec le rôle pompiste pour votre compte. Ouvrez votre quart, ou prévenez votre manager. Vous pouvez saisir les volumes à la main.' };
    }
    return { ok: true };
  }

  // Historique manager (lecture seule) : une journée de relevés regroupée par moment.
  // releves : lignes `carburant_index_releves` avec `carburant_index_valeurs(...)` imbriquées.
  // Rien n'est tranché ici : chaque déclaration garde son auteur, ses valeurs et ses anomalies
  // enregistrées (écart de nuit) ; la comparaison fin Q1 / début Q2 compare la dernière
  // déclaration finale de chaque moment et signale quand les deux ont le même auteur
  // (alors ce ne sont pas deux déclarations indépendantes).
  function synthetiserJournee(releves) {
    const liste = [].concat(releves || []);
    const declarations = liste.map(r => {
      const valeurs = {}, anomalies = [];
      let recopiees = 0;
      [].concat(r.carburant_index_valeurs || []).forEach(v => {
        const k = `${v.pompe}-${v.produit}`;
        valeurs[k] = v.valeur_sept_chiffres;
        if (v.recopiee) recopiees++;
        if (v.anomalie_nuit && v.anomalie_nuit !== 'conforme') anomalies.push({ clef: k, code: v.anomalie_nuit, ecart: v.ecart_nuit == null ? null : Number(v.ecart_nuit) });
      });
      return { releveId: r.id, moment: r.moment, statut: r.statut, auteur: r.auteur, auteurNom: r.auteur_nom || null, creeLe: r.cree_le, finaliseLe: r.finalise_le || null, valeurs, nbValeurs: Object.keys(valeurs).length, recopiees, anomalies };
    });
    const parMoment = {};
    MOMENTS.forEach(m => { parMoment[m] = declarations.filter(d => d.moment === m).sort((a, b) => String(a.creeLe).localeCompare(String(b.creeLe))); });
    const derniereFinale = m => parMoment[m].filter(d => d.statut === 'final' && d.nbValeurs === 8).slice(-1)[0] || null;
    const f = derniereFinale('fin_q1'), d = derniereFinale('debut_q2');
    const lignes = comparerQ1Q2(f && f.valeurs, d && d.valeurs);
    const complete = !!(f && d);
    return {
      parMoment,
      anomaliesTotal: declarations.reduce((s, x) => s + x.anomalies.length, 0),
      q1q2: {
        complete, lignes,
        divergents: complete ? lignes.filter(l => l.etat === 'divergent').length : null,
        memeAuteur: complete ? f.auteur === d.auteur : null,
        auteurFinQ1: f ? f.auteur : null, auteurDebutQ2: d ? d.auteur : null,
      },
    };
  }

  // Journal Piste — contrôle d'une passation (fin Q1 -> début Q2) ou d'une nuit
  // (fin Q2 -> début Q1). Compteur par compteur, sans compensation. Fail-closed :
  // configuration différente, unité non confirmée ou valeur absente => jamais « conforme ».
  // Échelle confirmée par Frédéric le 17/10/2026 : +1 d'index = 1 L.
  const CONFIG_PISTE_DEFAUT = {
    litresParUnite: 1, toleranceL: 9, seuilL: 10, delaiReleveManquantMin: 30,
    pompes: { 1: { gauche: 'GO', droite: 'SP', enService: true }, 2: { gauche: 'SP', droite: 'GO', enService: true },
              3: { gauche: 'GO', droite: 'SP', enService: true }, 4: { gauche: 'SP', droite: 'GO', enService: true } },
    chiffres: { mecanique: 7, decenium: 6 },
  };
  const empreinteConfig = (c) => JSON.stringify([c && c.pompes, c && c.chiffres, c && c.litresParUnite]);
  function comparerPassation(cfgA, cfgB, valsA, valsB, type) {
    const nuit = type === 'nuit', niveau = nuit ? 'rouge' : 'orange';
    const res = (etat, raison, lignes) => ({ etat, raison: raison || null, niveau: etat === 'anomalie' ? niveau : null, lignes: lignes || [], certitude: etat === 'anomalie' || etat === 'tolere' || etat === 'conforme' ? 'fait_calcule' : 'aucune' });
    if (!cfgA || !cfgB || !valsA || !valsB) return res('non_controle', 'Donnée manquante : un des deux relevés n\'est pas enregistré dans NEXUS.');
    if (empreinteConfig(cfgA) !== empreinteConfig(cfgB)) return res('impossible', 'Comparaison impossible : la configuration des compteurs a changé entre les deux relevés.');
    const echelle = Number(cfgB.litresParUnite);
    if (!(echelle > 0)) return res('impossible', 'Comparaison impossible : unité de mesure non confirmée.');
    const tol = Number(cfgB.toleranceL), seuil = Number(cfgB.seuilL);
    const lignes = [];
    let manque = false;
    Object.keys(cfgB.pompes || {}).forEach(p => {
      const c = cfgB.pompes[p]; if (!c.enService) return;
      [c.gauche, c.droite].forEach(prod => {
        const clef = p + '-' + prod, a = valsA[clef], b = valsB[clef];
        if (a == null || b == null || !/^\d+$/.test(String(a)) || !/^\d+$/.test(String(b))) { manque = true; lignes.push({ clef, etat: 'non_controle' }); return; }
        const ecartL = (Number(b) - Number(a)) * echelle, abs = Math.abs(ecartL);
        lignes.push({ clef, ecartL, etat: abs === 0 ? 'conforme' : abs <= tol ? 'tolere' : abs >= seuil ? 'anomalie' : 'tolere' });
      });
    });
    if (manque) return res('non_controle', 'Donnée manquante : au moins un compteur n\'a pas de valeur dans l\'un des relevés.', lignes);
    const etat = lignes.some(l => l.etat === 'anomalie') ? 'anomalie' : lignes.some(l => l.etat === 'tolere') ? 'tolere' : 'conforme';
    return res(etat, null, lignes);
  }

  const api = {
    MOMENTS_DEBUT, MOMENTS_FIN, estDebut, estFin, QUART_DU_MOMENT, normaliserQuart, momentsHabilites,
    TOLERANCE_NUIT_MAX, SEUIL_ALERTE_PRIORITAIRE, classerEcartNuit, evaluerDebut,
    SEUIL_ECART_INDICATIF_L, GNR_INDEX_REFERENCE, MOMENTS, ORDRE_PHYSIQUE, POMPES,
    ordreRecopieDecenium, nettoyerSaisie, estSeptChiffres, convertirSeptVersSix,
    controlerIndex, confirmationExceptionnelleValide, comparerQ1Q2, revueAnomalies,
    appliquerCorrection, TEXTE_CONFIRMATION_RECOPIE, causePhoto, extensionPhoto, precontrolePompiste, synthetiserJournee,
    CONFIG_PISTE_DEFAUT, comparerPassation,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.NexusRelevesPiste = api;
})(typeof window !== 'undefined' ? window : globalThis);
