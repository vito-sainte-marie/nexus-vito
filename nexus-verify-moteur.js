/*
 * nexus-verify-moteur.js — extraction pure de la classification d'écart de
 * caisse (classifierEcart/GRAVITE_ORDRE/STATUT_LABEL), jusque-là définie
 * uniquement à l'intérieur de NEXUS-Verify-v1.html. Extrait le 11/08/2026
 * pour que le nouveau chapitre "Opérations" du Rapport NEXUS de Direction
 * réutilise EXACTEMENT la même classification (Article 11, "une seule
 * vérité") au lieu d'un deuxième jeu de seuils.
 *
 * Ce fichier ne fait AUCUN accès Supabase.
 */
(function (global) {
  'use strict';

  // Seuils de gravité en euros d'écart absolu — identiques à ceux du cahier
  // des charges (section 11), un seul jeu de seuils pour toute l'app.
  function classifierEcart(montantAbs) {
    if (montantAbs <= 2) return 'conforme';
    if (montantAbs <= 5) return 'surveiller';
    if (montantAbs <= 20) return 'anomalie';
    return 'critique';
  }
  const GRAVITE_ORDRE = { conforme: 0, surveiller: 1, anomalie: 2, critique: 3 };
  const STATUT_LABEL = { conforme: 'Conforme', surveiller: 'À surveiller', anomalie: 'Anomalie', critique: 'Critique' };

  /**
   * agregerAudits(audits) — même calcul que assemblerDonneesRapportVerify()
   * de NEXUS-Verify-v1.html, extrait pour être réutilisable sans accès
   * réseau : reçoit des lignes déjà chargées
   * (date, quart, ecart_piste, ecart_boutique, statut, commentaire).
   * L'ampleur d'un audit est le MAX des deux composantes (piste, boutique),
   * jamais leur somme signée.
   */
  function agregerAudits(rows) {
    const audits = (rows || []).map(a => ({ ...a, ecartMax: Math.max(Math.abs(Number(a.ecart_piste || 0)), Math.abs(Number(a.ecart_boutique || 0))) }));
    const total = audits.length;
    const parStatut = { conforme: 0, surveiller: 0, anomalie: 0, critique: 0 };
    audits.forEach(a => { if (parStatut[a.statut] != null) parStatut[a.statut]++; });
    const tauxConforme = total > 0 ? parStatut.conforme / total : null;
    const ecartCumule = audits.reduce((s, a) => s + a.ecartMax, 0);
    const triesParEcart = [...audits].sort((a, b) => b.ecartMax - a.ecartMax);
    const pireEcart = triesParEcart[0] || null;
    const topEcarts = triesParEcart.slice(0, 5);
    let nbPisteDominant = 0, nbBoutiqueDominant = 0;
    audits.forEach(a => {
      if (Math.abs(a.ecart_piste || 0) > Math.abs(a.ecart_boutique || 0)) nbPisteDominant++;
      else if (Math.abs(a.ecart_boutique || 0) > Math.abs(a.ecart_piste || 0)) nbBoutiqueDominant++;
    });
    const composantePlusTouchee = nbPisteDominant === nbBoutiqueDominant ? 'Équilibré entre piste et boutique' : (nbPisteDominant > nbBoutiqueDominant ? 'Piste' : 'Boutique');
    return { total, parStatut, tauxConforme, ecartCumule, pireEcart, topEcarts, composantePlusTouchee, audits };
  }

  /**
   * statutValidationQuart(a) — v2.234, demande de Frédéric ("Amélioration
   * UX — NEXUS Verify / Historique") : statut global discret par quart,
   * synthétisant les validations Piste et Boutique SANS jamais mélanger ce
   * statut avec le résultat individuel d'une caisse (Conforme/À surveiller
   * viennent de classifierEcart, restent inchangés).
   *
   * "Caisses attendues" n'est JAMAIS codé en dur à 2 : c'est le nombre de
   * composantes (piste, boutique) qui ont réellement un écart calculé sur
   * cette ligne (ecart_piste/ecart_boutique non nuls). En pratique le
   * formulaire "Nouvel audit" écrit toujours les deux ensemble, donc c'est 2
   * aujourd'hui — mais le calcul reste correct si une ligne historique n'en
   * a jamais eu qu'une (legacy pré-boutique, saisie corrigée à la main...).
   *
   * Depuis le split de validation (migration
   * split_validation_piste_boutique_audits_caisse), chaque composante a sa
   * propre paire (valide_le_X = dernier évènement, premiere_validation_le_X
   * = tout premier évènement, immuable). Si les deux diffèrent pour au moins
   * une composante validée, la ligne a été corrigée après coup ("Validé
   * puis ajusté") — jamais deviné, seulement lu depuis ces deux colonnes
   * réelles.
   *
   * Retourne { etat, caissesAttendues, caissesValidees, dernierInstant,
   * dernierAuteurId, slots } où etat ∈ 'valide' | 'ajuste' | 'partiel' |
   * 'en_attente'. `slots` porte le détail par composante (type, valideLe,
   * premiereValidationLe, validePar) pour l'écran de détail au clic.
   */
  function statutValidationQuart(a) {
    if (!a) return null;
    const slots = [];
    if (a.ecart_piste != null) {
      slots.push({ type: 'piste', valideLe: a.valide_le_piste || null, premiereValidationLe: a.premiere_validation_le_piste || null, validePar: a.valide_par_piste || null });
    }
    if (a.ecart_boutique != null) {
      slots.push({ type: 'boutique', valideLe: a.valide_le_boutique || null, premiereValidationLe: a.premiere_validation_le_boutique || null, validePar: a.valide_par_boutique || null });
    }
    const caissesAttendues = slots.length;
    const validees = slots.filter(s => !!s.valideLe);
    const caissesValidees = validees.length;
    const aUnAjustement = validees.some(s => s.premiereValidationLe && s.valideLe && new Date(s.premiereValidationLe).getTime() !== new Date(s.valideLe).getTime());

    let dernierEvenement = null;
    validees.forEach(s => {
      if (!dernierEvenement || new Date(s.valideLe) > new Date(dernierEvenement.valideLe)) dernierEvenement = s;
    });

    let etat;
    if (caissesAttendues === 0 || caissesValidees === 0) etat = 'en_attente';
    else if (caissesValidees < caissesAttendues) etat = 'partiel';
    else etat = aUnAjustement ? 'ajuste' : 'valide';

    return {
      etat,
      caissesAttendues,
      caissesValidees,
      dernierInstant: dernierEvenement ? dernierEvenement.valideLe : null,
      dernierAuteurId: dernierEvenement ? dernierEvenement.validePar : null,
      slots,
    };
  }

  // ------------------------------------------------------------
  // "POURQUOI CET ÉCART ?" — v2.268, cadrage "Analyse des écarts" de
  // Frédéric : même structure que FDJ (nexus-fdj-moteur.js, v2.267 —
  // NexusEcartsMoteur.situationVerificationEcart en est la version
  // canonique désormais), mais un vocabulaire de causes propre à Verify
  // (piste/boutique), jamais les libellés FDJ ("rapport FDJ" n'a aucun
  // sens ici). "Vente ou article non enregistré" reprend l'exemple exact
  // du cadrage (§8) : l'écart positif qui révèle une vente oubliée.
  // ------------------------------------------------------------
  const MOTIFS_ECART_CORRIGE_VERIFY = [
    { value: 'erreur_comptage', label: 'Erreur de comptage' },
    { value: 'erreur_saisie', label: 'Erreur de saisie' },
    { value: 'erreur_montant_caisse', label: 'Erreur sur le montant caisse' },
    { value: 'vente_non_enregistree', label: 'Vente ou article non enregistré' },
  ];
  function motifsEcartCorrigeDisponiblesVerify(ecartInitial) {
    const base = [{ value: '', label: 'Choisir un motif…' }, ...MOTIFS_ECART_CORRIGE_VERIFY];
    return global.NexusEcartsMoteur
      ? global.NexusEcartsMoteur.ajouterRemboursementSiManque(base, ecartInitial)
      : (typeof ecartInitial === 'number' && ecartInitial < 0 ? [...base, { value: 'remboursement', label: 'Remboursement' }] : base);
  }
  function labelMotifEcartVerify(v) {
    if (v === 'remboursement') return 'Remboursement';
    if (v === 'non_explique') return 'Origine non identifiée';
    const m = MOTIFS_ECART_CORRIGE_VERIFY.find(x => x.value === v);
    return m ? m.label : (v || '—');
  }

  // ------------------------------------------------------------
  // VERSIONING / RESTAURATION — v2.272 (29/08/2026, retour de Frédéric
  // "CORRECTIF VERIFY — Sécurisation Date/Quart et restauration", points
  // 5/6/7/10). Même principe de chaîne "jamais supprimer, toujours une
  // nouvelle version" déjà appliqué à `fdj_stock_references`
  // (reference_precedente_id, v2.233) — pas un deuxième mécanisme, la même
  // idée transposée à `audits_caisse` (Article 11).
  //
  // Une ligne `audits_caisse_versions` porte un snapshot COMPLET de la
  // ligne `audits_caisse` telle qu'elle était juste AVANT une écriture
  // (modification via "Calculer et enregistrer", validation Piste/Boutique,
  // ou restauration). Jamais une sélection de champs devinée : Article 5,
  // mieux vaut tout capturer que d'oublier un champ qui compterait plus
  // tard.
  // ------------------------------------------------------------
  const LIBELLE_ACTION_VERSION = {
    modification: 'Modification',
    validation_piste: 'Validation Piste',
    validation_boutique: 'Validation Boutique',
    restauration: 'Restauration',
  };
  function libelleActionVersion(action) {
    return LIBELLE_ACTION_VERSION[action] || (action || '—');
  }

  /**
   * construireLigneVersion(version, ctx) — fonction pure de présentation
   * d'une ligne `audits_caisse_versions`. `ctx.employesParId` : map id →
   * {nom}, chargée séparément par l'appelant (une seule requête pour tous
   * les employés, jamais une requête par version — même principe que
   * ligneHistoriqueReconciliation dans nexus-fdj-moteur.js).
   */
  function construireLigneVersion(version, ctx) {
    const employe = version.acteur_id ? (ctx && ctx.employesParId ? ctx.employesParId[version.acteur_id] : null) : null;
    return {
      id: version.id,
      instant: version.created_at,
      action: version.action,
      libelleAction: libelleActionVersion(version.action),
      auteurNom: employe ? employe.nom : '—',
      motif: version.motif || null,
      versionPrecedenteId: version.version_precedente_id || null,
      valeurs: version.valeurs,
    };
  }

  /**
   * construireTimelineVersions(versions, ctx) — triée du plus récent au
   * plus ancien, jamais l'inverse (même convention que la timeline FDJ).
   */
  function construireTimelineVersions(versions, ctx) {
    return [...(versions || [])]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map(v => construireLigneVersion(v, ctx));
  }

  // Champs identité JAMAIS restaurés depuis un ancien snapshot — restaurer
  // un ancien constat de caisse ne doit jamais déplacer la ligne vers une
  // autre date/quart/site, ni fabriquer un nouvel id. Tout le reste (écarts,
  // drops, ventes, validations, litrage...) est restauré tel quel.
  const CHAMPS_IDENTITE_AUDIT = ['id', 'site', 'date', 'quart', 'created_at'];

  /**
   * construirePatchRestauration(valeursSnapshot) — fonction pure : à partir
   * d'un snapshot complet stocké dans `audits_caisse_versions.valeurs`,
   * construit le patch à appliquer à `audits_caisse` pour restaurer cet
   * état — sans jamais toucher aux champs d'identité de la ligne.
   */
  function construirePatchRestauration(valeursSnapshot) {
    const patch = { ...(valeursSnapshot || {}) };
    CHAMPS_IDENTITE_AUDIT.forEach(c => { delete patch[c]; });
    return patch;
  }

  // ------------------------------------------------------------
  // v2.274 (retour de Frédéric §2/§3 — "avant une synchronisation Google
  // Sheets, vérifier la cohérence date + quart + personnel entre les
  // données importées et l'audit ouvert. En cas d'incohérence, bloquer
  // l'application automatique et proposer directement 'Ouvrir le bon
  // quart'.") — fonction pure : ne connaît ni le DOM ni Supabase. Reçoit
  // des chaînes DÉJÀ normalisées (comparaison insensible à la
  // casse/accents faite par l'appelant, même convention que
  // trouverOuCreerEmploye côté écran) et renvoie un verdict exploitable
  // tel quel. Ne bloque QUE s'il y a effectivement quelque chose à
  // comparer — un audit tout juste commencé (aucun employé encore
  // sélectionné) n'a rien de "différent" à signaler, ce n'est pas une
  // incohérence (Article 5 : jamais une fausse alerte).
  //
  // v2.276 (retour de Frédéric, 29/08/2026 — test réel sur 28/08 Quart 2) :
  // le déclencheur de l'alerte de date n'est plus le simple booléen
  // `dateLiteraleSurLaLigne` brut, mais `estReportRisque(...)` ci-dessous,
  // qui prend aussi en compte `distanceDepuisDateLiterale` (nombre de
  // lignes entre la dernière date explicite vue dans le classeur et la
  // ligne trouvée). Motif : la plupart des classeurs de Frédéric partagent
  // une seule cellule Date fusionnée entre le Quart 1 et le Quart 2 d'un
  // même jour — la ligne du Quart 2 n'a donc JAMAIS sa propre date
  // explicite (distance = 1, la ligne juste au-dessus), sans que ce soit
  // un risque réel : NEXUS a déjà lu une date explicite pour ce jour juste
  // avant. Le vrai risque déjà vécu par Frédéric (01/06 demandé, données
  // du 02/06 utilisées, le 01/08/2026) venait d'un report sur PLUSIEURS
  // lignes (jour/quart manquant dans le classeur, distance > 1) — c'est ce
  // cas-là, et seulement celui-là, qui doit bloquer désormais. La règle
  // reste ici (une seule vérité, Article 11) plutôt que dupliquée/décidée
  // côté écran : l'appelant transmet les faits bruts déjà mesurés, jamais
  // un verdict pré-mâché.
  // ------------------------------------------------------------
  function estReportDateRisque(dateLiteraleSurLaLigne, distanceDepuisDateLiterale) {
    if (dateLiteraleSurLaLigne !== false) return false;
    return distanceDepuisDateLiterale == null || distanceDepuisDateLiterale > 1;
  }

  function verdictCoherenceImportSheets(ctx) {
    const c = ctx || {};
    const alertes = [];
    if (estReportDateRisque(c.dateLiteraleSurLaLigne, c.distanceDepuisDateLiterale)) {
      alertes.push({
        code: 'date_reportee',
        message: "La date de cette ligne est reportée depuis plusieurs lignes plus haut dans le classeur (pas de date explicite à proximité) — le quart importé pourrait appartenir à un autre jour que celui affiché.",
      });
    }
    (c.personnel || []).forEach(p => {
      if (p && p.attendu && p.importe && p.attendu !== p.importe) {
        alertes.push({
          code: 'personnel_different',
          caisse: p.caisse,
          message: `Caisse ${p.caisseLabel || p.caisse} : ${p.attenduLabel || p.attendu} déjà enregistré sur ce quart, mais le classeur propose ${p.importeLabel || p.importe} — vérifie qu'il s'agit bien du même quart avant d'appliquer.`,
        });
      }
    });
    return { bloquer: alertes.length > 0, alertes };
  }

  // ------------------------------------------------------------
  // Modification d'un audit déjà validé (08/10/2026, décision de Frédéric :
  // « Conserver les écarts d'origine et les validations manuelles »).
  //
  // Défaut corrigé : l'upsert de modification recalculait ecart_piste /
  // ecart_boutique mais jamais ecart_*_valide. Or tout NEXUS lit « validé,
  // sinon brut » : l'ancien écart validé masquait le nouveau calcul, et la
  // carte affichait « corrigé » alors que personne n'avait corrigé.
  //
  // Règle, caisse par caisse :
  //  - pas d'écart validé → rien à réaligner ;
  //  - écart validé égal (au centime) au brut AU MOMENT DE LA VALIDATION →
  //    le manager avait accepté le calcul : on suit le nouveau calcul ;
  //  - sinon c'est une validation manuelle (valeur saisie par le manager) :
  //    elle est conservée telle quelle, et l'écart avec le recalcul est
  //    signalé — jamais écrasé en silence.
  // La référence « brut au moment de la validation » vient de la dernière
  // version validation_* (audits_caisse_versions.valeurs = état AVANT
  // l'écriture, donc le brut sur lequel le manager a statué). À défaut
  // (validation antérieure au versionnement du 29/08, ou restauration
  // postérieure), le brut actuel de la ligne sert de référence.
  // ------------------------------------------------------------
  const CAISSES_AUDIT = ['piste', 'boutique'];

  function centimes(x) {
    if (x === null || x === undefined || x === '') return null;
    const n = Number(x);
    return Number.isFinite(n) ? Math.round(n * 100) : null;
  }

  /**
   * brutAuDerniereValidation(versions, type) — fonction pure. Écart brut
   * de la caisse `type` sur lequel la dernière validation a statué, ou
   * null s'il n'est pas déterminable. Une restauration plus récente que la
   * dernière validation rend la référence indéterminable (l'état restauré
   * n'est pas dans le snapshot de restauration).
   */
  function brutAuDerniereValidation(versions, type) {
    const tri = [...(versions || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    for (const v of tri) {
      if (v.action === 'restauration') return null;
      if (v.action === `validation_${type}` || (v.action && v.action.indexOf('validation_') === 0)) {
        const brut = v.valeurs ? v.valeurs[`ecart_${type}`] : null;
        // Validation de l'AUTRE caisse : elle n'a posé l'écart validé de
        // cette caisse que s'il n'existait pas encore (recopie du brut).
        if (v.action !== `validation_${type}` && v.valeurs && v.valeurs[`ecart_${type}_valide`] != null) continue;
        return centimes(brut) === null ? null : Number(brut);
      }
    }
    return null;
  }

  function auditEstValide(audit) {
    return !!(audit && (audit.valide_le || audit.valide_le_piste || audit.valide_le_boutique
      || audit.ecart_piste_valide != null || audit.ecart_boutique_valide != null));
  }

  /**
   * reconcilierValidationApresModification(auditExistant, nouveauxEcarts, ctx)
   * — fonction pure. `nouveauxEcarts` : { piste, boutique } recalculés.
   * `ctx.brutAuValidation` : { piste, boutique } (brutAuDerniereValidation).
   * Retourne { patch, caisses, signalements } : `patch` ne contient que les
   * ecart_*_valide à réécrire (jamais les champs _origine, jamais valide_le).
   * Etats : non_validee | inchangee | realignee | manuelle_conservee.
   */
  function reconcilierValidationApresModification(auditExistant, nouveauxEcarts, ctx) {
    const patch = {};
    const caisses = {};
    const signalements = [];
    const refs = (ctx && ctx.brutAuValidation) || {};
    CAISSES_AUDIT.forEach(type => {
      const brutApres = Number(nouveauxEcarts[type]);
      const valideAvant = auditExistant ? auditExistant[`ecart_${type}_valide`] : null;
      if (valideAvant === null || valideAvant === undefined) {
        caisses[type] = { etat: 'non_validee', valideAvant: null, valideApres: null, brutApres };
        return;
      }
      // La validation suit le calcul si elle vaut le brut sur lequel la
      // dernière validation a statué, OU le brut actuel : après un premier
      // réalignement, validé = brut courant, mais ≠ brut de la validation
      // d'origine — sans ce second critère, la 2e modification d'un audit
      // le prendrait pour une saisie manuelle et le figerait.
      const brutAvant = auditExistant[`ecart_${type}`];
      const ref = centimes(refs[type]) !== null ? refs[type] : brutAvant;
      const manuelle = centimes(valideAvant) !== centimes(ref) && centimes(valideAvant) !== centimes(brutAvant);
      if (manuelle) {
        caisses[type] = { etat: 'manuelle_conservee', valideAvant: Number(valideAvant), valideApres: Number(valideAvant), brutApres, reference: Number(ref) };
        if (centimes(valideAvant) !== centimes(brutApres)) {
          signalements.push({ caisse: type, code: 'validation_manuelle_conservee', valide: Number(valideAvant), recalcul: brutApres });
        }
        return;
      }
      patch[`ecart_${type}_valide`] = brutApres;
      const change = centimes(valideAvant) !== centimes(brutApres);
      caisses[type] = { etat: change ? 'realignee' : 'inchangee', valideAvant: Number(valideAvant), valideApres: brutApres, brutApres, reference: Number(ref) };
      if (change) signalements.push({ caisse: type, code: 'validation_realignee', avant: Number(valideAvant), apres: brutApres });
    });
    return { patch, caisses, signalements };
  }

  function echapperHtml(x) {
    return String(x == null ? '' : x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function formatEuroSigne(x) {
    const n = Number(x);
    return `${n >= 0 ? '+' : ''}${n.toFixed(2).replace('.', ',')} €`;
  }

  function libelleSignalementValidation(s) {
    const caisse = s.caisse === 'piste' ? 'Piste' : 'Boutique';
    if (s.code === 'validation_realignee') {
      return `${caisse} : écart validé recalculé ${formatEuroSigne(s.avant)} → ${formatEuroSigne(s.apres)}. La validation portait sur le calcul, elle suit donc la correction.`;
    }
    if (s.code === 'validation_manuelle_conservee') {
      return `${caisse} : validation manuelle conservée à ${formatEuroSigne(s.valide)} — le recalcul donne ${formatEuroSigne(s.recalcul)}. Si la correction doit s'appliquer, corrige la validation de cette caisse.`;
    }
    return `${caisse} : ${s.code}`;
  }

  /**
   * mentionsEcartCarte(audit, type) — fonction pure de présentation. Ne
   * déduit plus « corrigé » d'une simple différence validé/brut sans dire
   * laquelle : expose l'écart qui compte, l'écart calculé quand le manager
   * a retenu autre chose, et le constat initial (_origine) quand une
   * modification l'a fait évoluer.
   */
  function mentionsEcartCarte(audit, type) {
    const brut = audit[`ecart_${type}`];
    const valide = audit[`ecart_${type}_valide`];
    const origine = audit[`ecart_${type}_origine`];
    const effectif = valide != null ? Number(valide) : Number(brut);
    const retenuManuellement = valide != null && centimes(valide) !== centimes(brut);
    const origineDistincte = origine != null && centimes(origine) !== centimes(brut) && centimes(origine) !== centimes(effectif);
    return {
      effectif,
      retenuManuellement,
      ecartCalcule: retenuManuellement ? Number(brut) : null,
      constatInitial: origineDistincte ? Number(origine) : null,
    };
  }

  const CHAMPS_DIFF_VERSION = [
    ['ecart_piste', 'Écart piste calculé'],
    ['ecart_boutique', 'Écart boutique calculé'],
    ['ecart_piste_valide', 'Écart piste validé'],
    ['ecart_boutique_valide', 'Écart boutique validé'],
  ];

  /**
   * diffEcartsVersion(avant, apres) — fonction pure. Écarts qui ont changé
   * entre deux états d'un audit (l'état avant une action et l'état qui l'a
   * suivie), au centime près.
   */
  function diffEcartsVersion(avant, apres) {
    if (!avant || !apres) return [];
    return CHAMPS_DIFF_VERSION
      .filter(([c]) => centimes(avant[c]) !== centimes(apres[c]))
      .map(([c, libelle]) => ({ champ: c, libelle, avant: avant[c] == null ? null : Number(avant[c]), apres: apres[c] == null ? null : Number(apres[c]) }));
  }

  global.NexusVerifyMoteur = {
    classifierEcart, GRAVITE_ORDRE, STATUT_LABEL, agregerAudits, statutValidationQuart,
    MOTIFS_ECART_CORRIGE_VERIFY, motifsEcartCorrigeDisponiblesVerify, labelMotifEcartVerify,
    libelleActionVersion, construireLigneVersion, construireTimelineVersions, construirePatchRestauration,
    CHAMPS_IDENTITE_AUDIT, verdictCoherenceImportSheets, estReportDateRisque,
    brutAuDerniereValidation, auditEstValide, reconcilierValidationApresModification,
    libelleSignalementValidation, mentionsEcartCarte, diffEcartsVersion, formatEuroSigne, echapperHtml,
  };
})(typeof window !== 'undefined' ? window : globalThis);
