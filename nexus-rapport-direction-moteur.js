// ============================================================
// NEXUS Rapport de Direction — moteur pur (11/08/2026).
//
// Refonte demandée par Frédéric : "Brief NEXUS à l'écran doit rester
// synthétique [...] mais le rapport PDF généré depuis Brief NEXUS ne doit
// surtout pas être limité à une page A4 [...] Le PDF doit devenir un
// véritable rapport de direction [...] 8 à 20 pages selon la période et
// les données disponibles, sans jamais remplir artificiellement."
//
// Réponse retenue (AskUserQuestion, 11/08/2026) : architecture complète des
// 18 sections dès maintenant ; toute section qui manque de profondeur
// (Trajectoire 12 mois, comparaison N-1, panier moyen, projections au-delà
// du rythme actuel, effets mesurés des décisions) affiche honnêtement
// "Donnée insuffisante" plutôt que d'être inventée ou omise — le rapport
// s'étoffera de lui-même avec l'usage réel de NEXUS (Article 5, "vérité
// avant certitude").
//
// Comme tous les moteurs NEXUS (Article 11), ce fichier ne fait AUCUN accès
// Supabase : il reçoit des données déjà chargées par
// nexus-rapport-donnees.js / nexus-rapport-direction-donnees.js (et les
// objets CHAPITRE1/CHAPITRE2 déjà construits par nexus-rapport-moteur.js —
// jamais recalculés ici, seulement recomposés) et retourne des valeurs +
// du texte brut, jamais de HTML ni de mise en page PDF.
//
// Dépendance : NexusRayonMoteur (nexus-rayon-moteur.js), NexusCarburantMoteur
// (nexus-carburant-moteur.js) — pour les fonctions déjà pures qu'il recompose
// (classerRayons, decomposerEvolution...), jamais dupliquées ici.
// ------------------------------------------------------------

(function (global) {
  function fmtEuros(n) {
    if (n == null) return '—';
    return n.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €';
  }
  function fmtPct(n, dec) {
    if (n == null) return '—';
    return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(dec == null ? 1 : dec)} %`;
  }
  function fmtPts(n, dec) {
    if (n == null) return '—';
    return `${n >= 0 ? '+' : ''}${n.toFixed(dec == null ? 1 : dec)} pt`;
  }
  function fmtL(n) {
    if (n == null) return '—';
    return `${Math.round(n).toLocaleString('fr-FR')} L`;
  }
  function fmtDateFr(iso) {
    if (!iso) return '—';
    const [a, m, j] = iso.split('-');
    return `${j}/${m}/${a}`;
  }

  // ------------------------------------------------------------
  // 1. Page de couverture
  // ------------------------------------------------------------
  function construireCouverture({ nomEntreprise, periode, dateGeneration }) {
    return {
      nomEntreprise: nomEntreprise || 'Site NEXUS',
      periodeLabel: periode.label,
      periodeBornes: `${fmtDateFr(periode.debut)} → ${fmtDateFr(periode.fin)}`,
      genereLe: dateGeneration || new Date(),
    };
  }

  // ------------------------------------------------------------
  // 2. Synthèse exécutive
  // ------------------------------------------------------------
  function construireSyntheseExecutive({ chapitre1, chapitre2, decisionsStrategiques, chapitreMarge, signauxQualifies }) {
    const axesMesures = chapitre2.axes.filter(a => a.statut !== 'Données insuffisantes');
    const nbHausse = chapitre2.axes.filter(a => a.statut === 'En hausse').length;
    const nbBaisse = chapitre2.axes.filter(a => a.statut === 'En baisse').length;
    const nbStable = chapitre2.axes.filter(a => a.statut === 'Stable').length;

    let etatGeneral;
    if (axesMesures.length === 0) etatGeneral = 'Données insuffisantes pour dresser un état général sur cette période.';
    else if (nbBaisse === 0 && nbHausse > 0) etatGeneral = 'En progression sur la période.';
    else if (nbBaisse > 0 && nbHausse === 0) etatGeneral = 'En retrait sur la période.';
    else if (nbHausse === 0 && nbBaisse === 0) etatGeneral = 'Stable sur la période.';
    else etatGeneral = 'Situation contrastée sur la période — certains secteurs progressent, d\'autres reculent.';

    // Phrase de directeur d'exploitation : compose le texte déjà validé du
    // Chapitre 1 (CA/marge/décisions) avec un rappel des axes en hausse/
    // baisse du Chapitre 2 — jamais un second calcul, uniquement une
    // recomposition textuelle.
    const nomsHausse = chapitre2.axes.filter(a => a.statut === 'En hausse').map(a => a.nom);
    const nomsBaisse = chapitre2.axes.filter(a => a.statut === 'En baisse').map(a => a.nom);
    let phraseAxes = '';
    if (nomsHausse.length) phraseAxes += ` Porté principalement par ${nomsHausse.join(' et ')}.`;
    if (nomsBaisse.length) phraseAxes += ` ${nomsBaisse.join(' et ')} ${nomsBaisse.length > 1 ? 'nécessitent' : 'nécessite'} une attention particulière.`;
    const phraseDirecteur = `${chapitre1.syntheseTexte}${phraseAxes}`.trim();

    // Les 3 choses à retenir — 1 point fort mesuré, 1 point de vigilance
    // mesuré, 1 point sur la marge (toujours pertinent pour un dirigeant),
    // en ne retenant que ce qui est réellement mesurable.
    const troisChoses = [];
    const meilleurAxe = chapitre2.axes.filter(a => a.statut === 'En hausse')[0];
    if (meilleurAxe) troisChoses.push({ titre: `${meilleurAxe.nom} en progression`, detail: meilleurAxe.detail });
    // Cadrage risques Phase 2 (18/08/2026, tâche #231) : "Rentabilité sous
    // pression" ne se déclenche plus sur `chapitreMarge.classement.
    // destructeurs` (comparaison instantanée à la moyenne pondérée du
    // magasin — Phase 1/v2.51 a déjà retiré ce vocabulaire de risque du
    // chapitre 12 pour la même raison : "Une catégorie sous la moyenne de
    // marge du magasin ne signifie pas nécessairement qu'elle est en
    // difficulté"), mais sur les signaux `marge` déjà QUALIFIÉS par
    // NexusRisques (comparaison à la référence historique PROPRE de la
    // catégorie, récurrence confirmée — même source que le chapitre 12).
    // Si aucun signal n'est confirmé, on ne prétend plus qu'il y a une
    // pression sur la rentabilité — silence plutôt que fausse alerte
    // (Article 5). `chapitreMarge.classement.moteurs` (catégories AU-DESSUS
    // de la moyenne) reste en revanche une lecture purement positive, sans
    // vocabulaire de risque à corriger — NexusRisques ne qualifie
    // aujourd'hui que des dégradations (aucun signal "favorable" n'existe
    // pour la marge), donc rien à reclasser de ce côté.
    const signauxMargeSynthese = (signauxQualifies || []).filter(s => s.domaine === 'marge');
    if (signauxMargeSynthese.length) {
      const noms = signauxMargeSynthese.map(s => s.sujet).filter(Boolean);
      troisChoses.push({
        titre: 'Rentabilité sous pression',
        detail: `${signauxMargeSynthese.length} catégorie${signauxMargeSynthese.length > 1 ? 's confirmées' : ' confirmée'} en recul de marge par rapport à sa propre référence historique${noms.length ? ' : ' + noms.slice(0, 3).join(', ') : ''}.`,
      });
    } else if (chapitreMarge && chapitreMarge.disponible && chapitreMarge.classement && chapitreMarge.classement.moteurs && chapitreMarge.classement.moteurs.length) {
      troisChoses.push({ titre: 'Marge tenue par quelques catégories moteurs', detail: `${chapitreMarge.classement.moteurs.slice(0, 3).map(m => m.nom).join(', ')} portent la rentabilité au-dessus de la moyenne du magasin.` });
    }
    const pireAxe = chapitre2.axes.filter(a => a.statut === 'En baisse')[0];
    if (pireAxe) troisChoses.push({ titre: `${pireAxe.nom} en retrait`, detail: pireAxe.detail });
    if (troisChoses.length < 3 && chapitre1.nbDecisions != null) {
      troisChoses.push({
        titre: chapitre1.nbDecisions > 0 ? 'Suivi de direction actif' : 'Aucune décision enregistrée',
        detail: chapitre1.nbDecisions > 0 ? `${chapitre1.nbDecisions} décision(s) enregistrée(s) sur la période.` : "Aucune décision n'a été enregistrée dans le journal sur cette période.",
      });
    }

    const troisDecisions = (decisionsStrategiques || []).slice(0, 3).map(d => ({
      texte: d.recommandation || `${d.article || d.categorie || 'Décision'} — impact estimé ${fmtEuros(d.impact_eur)}`,
      impact_eur: d.impact_eur,
    }));

    return { etatGeneral, phraseDirecteur, troisChoses: troisChoses.slice(0, 3), troisDecisions };
  }

  // ------------------------------------------------------------
  // 3. Tableau de bord économique
  // ------------------------------------------------------------
  function construireTableauDeBord({ chapitre1, carburantsDetail, fdjDetail, operations, equipe }) {
    const commerce = {
      ca: chapitre1.ca && chapitre1.ca.disponible ? chapitre1.ca.valeur : null,
      evolution: chapitre1.evolutionCa,
      marge_pct: chapitre1.marge && chapitre1.marge.disponible ? chapitre1.marge.tauxPct : null,
      evolutionMarge: chapitre1.evolutionMargeTaux,
    };
    const fdj = fdjDetail && fdjDetail.disponible
      ? { ca: fdjDetail.caActuel, evolution: fdjDetail.evolution, ecarts: (operations.verify && operations.verify.disponible) ? null : null }
      : { disponible: false };
    const carburants = carburantsDetail && carburantsDetail.disponible
      ? { mix: carburantsDetail.mix, total: carburantsDetail.mix ? carburantsDetail.mix.total : null, evolution: carburantsDetail.evolution }
      : { disponible: false };
    const ops = operations.verify && operations.verify.disponible
      ? { nbControles: operations.verify.total, tauxConforme: operations.verify.tauxConforme, nbAnomalies: (operations.verify.parStatut.anomalie || 0) + (operations.verify.parStatut.critique || 0) }
      : { disponible: false };
    const opsInventaire = operations.inventaire && operations.inventaire.disponible
      ? { totalCounts: operations.inventaire.totalCounts, totalDiscrepancies: operations.inventaire.totalDiscrepancies, openDiscrepancies: operations.inventaire.openDiscrepancies }
      : { disponible: false };
    const eq = equipe && equipe.disponible
      ? { collaborateursActifs: equipe.collaborateursActifs, tauxPonctualite: equipe.tauxPonctualite, nbMissions: equipe.nbMissions, tauxMissions: equipe.tauxMissions }
      : { disponible: false };

    return { commerce, fdj, carburants, operations: ops, operationsInventaire: opsInventaire, equipe: eq };
  }

  // ------------------------------------------------------------
  // 4. Trajectoire
  // ------------------------------------------------------------
  function construireTrajectoire(trajectoire) {
    if (!trajectoire || !trajectoire.disponible) {
      return { disponible: false, raison: (trajectoire && trajectoire.raison) || "Historique produits insuffisant pour tracer une trajectoire." };
    }
    const mois = trajectoire.mois;
    const dernier = mois[mois.length - 1];
    const precedent = mois.length >= 2 ? mois[mois.length - 2] : null;
    const evolutionMoisPrecedent = precedent && precedent.ca > 0 ? (dernier.ca - precedent.ca) / precedent.ca : null;

    const fenetre3Mois = mois.slice(-4, -1); // les 3 mois avant le dernier
    const moyenne3Mois = fenetre3Mois.length ? fenetre3Mois.reduce((s, m) => s + m.ca, 0) / fenetre3Mois.length : null;
    const evolutionVsMoyenne3Mois = moyenne3Mois && moyenne3Mois > 0 ? (dernier.ca - moyenne3Mois) / moyenne3Mois : null;

    // N-1 : recherché dynamiquement (12 mois avant le dernier mois connu) —
    // jamais supposé absent par principe, seulement tant qu'il n'existe
    // vraiment pas dans les données.
    const [an, mo] = dernier.moisCle.split('-').map(Number);
    const cleN1 = `${an - 1}-${String(mo).padStart(2, '0')}`;
    const moisN1 = mois.find(m => m.moisCle === cleN1);
    const evolutionN1 = moisN1 && moisN1.ca > 0 ? (dernier.ca - moisN1.ca) / moisN1.ca : null;

    const cumulAnneeActuelle = mois.filter(m => m.moisCle.startsWith(`${an}-`)).reduce((s, m) => s + m.ca, 0);
    const moisAnneePrec = mois.filter(m => m.moisCle.startsWith(`${an - 1}-`));
    const cumulAnneePrecedente = moisAnneePrec.length ? moisAnneePrec.reduce((s, m) => s + m.ca, 0) : null;

    let commentaire;
    if (evolutionMoisPrecedent == null) {
      commentaire = "Profondeur d'historique encore trop limitée pour commenter la tendance.";
    } else if (evolutionMoisPrecedent >= 0.02 && (evolutionVsMoyenne3Mois == null || evolutionVsMoyenne3Mois >= 0)) {
      commentaire = `La hausse observée en ${dernier.label} se confirme par rapport aux mois précédents.`;
    } else if (evolutionMoisPrecedent <= -0.02 && (evolutionVsMoyenne3Mois != null && evolutionVsMoyenne3Mois >= -0.02)) {
      commentaire = `Le recul du mois ne constitue pas encore une tendance installée : le niveau reste proche de la moyenne récente.`;
    } else if (evolutionMoisPrecedent <= -0.02) {
      commentaire = `Le recul de ${dernier.label} s'inscrit dans une baisse plus large sur les derniers mois.`;
    } else {
      commentaire = `Activité stable en ${dernier.label} par rapport aux mois précédents.`;
    }

    return {
      disponible: true, mois, blocsPartiels: trajectoire.blocsPartiels,
      evolutionMoisPrecedent, moyenne3Mois, evolutionVsMoyenne3Mois,
      evolutionN1, disponibleN1: !!moisN1,
      cumulAnneeActuelle, cumulAnneePrecedente,
      commentaire,
      methodeNote: "Chaque bloc d'import products est rattaché au mois calendaire de sa date de début — un bloc à cheval sur deux mois n'est pas réparti au prorata.",
    };
  }

  // ------------------------------------------------------------
  // 5-6. Commerce + Produits moteurs/à potentiel
  // ------------------------------------------------------------
  function construireChapitreCommerce(commerceCategories) {
    if (!commerceCategories || !commerceCategories.disponible) {
      return { disponible: false, raison: (commerceCategories && commerceCategories.raison) || 'Aucune donnée catégorie disponible.' };
    }
    const { rayons, magasin } = commerceCategories;
    const liste = Object.values(rayons)
      .map(r => ({ ...r, part_du_ca: magasin.ca_total > 0 ? r.ca_total / magasin.ca_total : null }))
      .sort((a, b) => b.ca_total - a.ca_total);

    let phraseContribution = null;
    if (magasin.paire) {
      const contributeurs = liste
        .filter(r => r.evolution_ca != null && r.evolution_ca > 0)
        .map(r => ({ nom: r.nom, deltaCa: r.evolution_ca / (1 + r.evolution_ca) * r.ca_total }))
        .sort((a, b) => b.deltaCa - a.deltaCa);
      const deltaTotalPositif = contributeurs.reduce((s, c) => s + c.deltaCa, 0);
      if (contributeurs.length && deltaTotalPositif > 0) {
        const top3 = contributeurs.slice(0, 3);
        const partTop3 = top3.reduce((s, c) => s + c.deltaCa, 0) / deltaTotalPositif;
        phraseContribution = `${Math.round(partTop3 * 100)} % de la croissance commerciale provient de ${top3.length === 1 ? 'la catégorie' : `${top3.length} catégories`} : ${top3.map(c => c.nom).join(', ')}.`;
      }
    }

    return {
      disponible: true, periodeAffichage: magasin.periodeAffichage, periodeEnCours: magasin.periodeEnCours,
      paireDisponible: !!magasin.paire, ca_total: magasin.ca_total, marge_total: magasin.marge_total,
      categories: liste, phraseContribution,
    };
  }

  function construireProduitsMoteurs(commerceCategories) {
    if (!commerceCategories || !commerceCategories.disponible) return { disponible: false };
    const { rayons, magasin } = commerceCategories;
    const tousProduits = [];
    Object.values(rayons).forEach(r => (r.top_ventes || []).forEach(p => tousProduits.push({ ...p, categorie: r.nom })));
    const produitsMoteurs = tousProduits.sort((a, b) => b.ca - a.ca).slice(0, 5);
    const partMoteurs = magasin.ca_total > 0 ? produitsMoteurs.reduce((s, p) => s + p.ca, 0) / magasin.ca_total : null;

    // "Produits à potentiel" — heuristique documentée : parmi les produits
    // à forte marge (top_marge) de chaque rayon non-trafic, ceux qui ne
    // figurent PAS déjà parmi les meilleures ventes du même rayon (donc une
    // bonne marge encore peu poussée en volume). Ce n'est pas un moteur de
    // détection de croissance (celui-ci — R2/R3/R4 de nexus-conseiller.js —
    // est scopé "aujourd'hui", pas une période arbitraire de Rapport) :
    // c'est une lecture plus modeste, mais réelle, de la marge non encore
    // exploitée.
    const potentiels = [];
    Object.values(rayons).filter(r => !r.trafic).forEach(r => {
      const nomsTopVentes = new Set((r.top_ventes || []).map(p => p.article));
      (r.top_marge || []).forEach(p => {
        if (!nomsTopVentes.has(p.article) && p.marge_pct != null && p.marge_pct > 0) {
          potentiels.push({ ...p, categorie: r.nom });
        }
      });
    });
    potentiels.sort((a, b) => b.marge_pct - a.marge_pct);

    return {
      disponible: true, produitsMoteurs, partMoteurs,
      produitsPotentiel: potentiels.slice(0, 5),
      heuristiquePotentielNote: "Sélection : produits à marge élevée d'un rayon qui ne figurent pas encore parmi ses meilleures ventes — pas un moteur de détection de croissance dédié à une période arbitraire (indisponible dans cette version).",
    };
  }

  // ------------------------------------------------------------
  // 7. Marge
  // ------------------------------------------------------------
  function construireChapitreMarge(commerceCategories) {
    if (!commerceCategories || !commerceCategories.disponible) return { disponible: false };
    const classement = global.NexusRayonMoteur.classerRayons(commerceCategories.rayons);
    return {
      disponible: true, classement,
      decompositionDisponible: false,
      decompositionNote: "NEXUS ne dispose pas aujourd'hui d'une décomposition effet CA / effet mix / effet prix d'achat / effet prix de vente au niveau article — cette analyse se limite à la contribution de chaque catégorie à la marge totale du magasin.",
    };
  }

  // ------------------------------------------------------------
  // 8. Carburants
  // ------------------------------------------------------------
  function construireChapitreCarburants(carburantsDetail) {
    if (!carburantsDetail || !carburantsDetail.disponible) {
      return { disponible: false, raison: (carburantsDetail && carburantsDetail.raison) || 'Aucune vente carburant sur cette période.' };
    }
    // Task #480 (18/08/2026) : "Économie carburant" branchée sur le résumé
    // effet-prix-stock-hérité déjà calculé par l'appelant (Sprint C8) —
    // reste "non disponible" tant qu'aucun coût d'achat n'a été saisi nulle
    // part (Article 5 : jamais un chiffre fabriqué). L'autonomie de
    // stock/livraisons (stockDisponible) reste un chantier séparé, non
    // couvert par cette tâche.
    const effetPrixResume = carburantsDetail.effetPrixResume || null;
    return {
      disponible: true,
      mix: carburantsDetail.mix, evolution: carburantsDetail.evolution,
      produitMoteur: carburantsDetail.produitMoteur, moteurEvolution: carburantsDetail.moteurEvolution,
      couvertureIncertaine: carburantsDetail.couvertureIncertaine,
      stockDisponible: false,
      stockNote: "Autonomie de stock et livraisons : chantier non construit dans cette version (Carburants Phase 2).",
      economieDisponible: !!effetPrixResume,
      economieCle: effetPrixResume ? effetPrixResume.cle : null,
      economieEffet: effetPrixResume ? effetPrixResume.effet : null,
      economieNote: effetPrixResume ? null : "Aucun coût d'achat saisi pour l'instant — impossible de valoriser l'effet du stock sur la marge.",
    };
  }

  // ------------------------------------------------------------
  // 9. FDJ
  // ------------------------------------------------------------
  function construireChapitreFdj(fdjDetail) {
    if (!fdjDetail || !fdjDetail.disponible) {
      return { disponible: false, raison: (fdjDetail && fdjDetail.raison) || 'Aucun quart FDJ contrôlé sur cette période.' };
    }
    // Couverture quarts finalisés (23/08/2026, audit "Anti-dégradation
    // temporelle" §6, v2.225 — "rapport hebdomadaire FDJ") : "Le rapport
    // hebdomadaire ne doit inclure dans les totaux définitifs que les
    // quarts finalisés. Les quarts en brouillon ou non validés doivent être
    // visibles comme 'non inclus — en attente de validation'." Le total
    // (`caActuel`) était déjà correct (filtré côté SQL, jamais un quart en
    // brouillon inclus) — ce qui manquait, c'est cette phrase de
    // transparence sur la couverture, ajoutée UNIQUEMENT quand la période
    // contient réellement des quarts exclus (Article 5 — ne rien signaler
    // quand tout est déjà complet).
    const quartsNonInclus = (fdjDetail.nbQuartsTotal != null && fdjDetail.nbQuartsControles != null)
      ? Math.max(0, fdjDetail.nbQuartsTotal - fdjDetail.nbQuartsControles) : 0;
    const couvertureIncertaine = quartsNonInclus > 0;
    const phraseCouverture = couvertureIncertaine
      ? ` ${fdjDetail.nbQuartsControles}/${fdjDetail.nbQuartsTotal} quart${fdjDetail.nbQuartsTotal > 1 ? 's' : ''} finalisé${fdjDetail.nbQuartsControles > 1 ? 's' : ''} sur la période — ${quartsNonInclus} quart${quartsNonInclus > 1 ? 's' : ''} non inclus dans ce total (en attente de validation manager).`
      : '';
    return {
      disponible: true, caActuel: fdjDetail.caActuel, evolution: fdjDetail.evolution,
      jeuxTop: fdjDetail.jeuxTop5 || (fdjDetail.jeuMoteur ? [fdjDetail.jeuMoteur] : []),
      mixPalierDisponible: false,
      couvertureIncertaine,
      nbQuartsControles: fdjDetail.nbQuartsControles, nbQuartsTotal: fdjDetail.nbQuartsTotal,
      lectureNexus: (fdjDetail.jeuMoteur
        ? `L'activité FDJ ${fdjDetail.evolution == null ? 'est mesurée' : fdjDetail.evolution >= 0 ? 'progresse' : 'recule'} sur la période, portée par ${fdjDetail.jeuMoteur.nom}. Voir FDJ Performance pour le détail par jeu et par quart.`
        : "Détail insuffisant pour une lecture croisée sur cette période.") + phraseCouverture,
    };
  }

  // ------------------------------------------------------------
  // 10. Opérations
  // ------------------------------------------------------------
  function construireChapitreOperations(operations) {
    const verify = operations && operations.verify && operations.verify.disponible ? operations.verify : null;
    const inventaire = operations && operations.inventaire && operations.inventaire.disponible ? operations.inventaire : null;

    let syntheseTexte;
    if (!verify && !inventaire) {
      syntheseTexte = "Données insuffisantes pour évaluer la maîtrise opérationnelle sur cette période.";
    } else if (verify && verify.tauxConforme != null && verify.tauxConforme >= 0.9 && (!inventaire || inventaire.openDiscrepancies === 0)) {
      syntheseTexte = "Niveau de maîtrise opérationnelle : stable.";
    } else if (verify && verify.composantePlusTouchee && verify.composantePlusTouchee !== 'Équilibré entre piste et boutique') {
      syntheseTexte = `Les anomalies sont concentrées sur la composante ${verify.composantePlusTouchee.toLowerCase()}.`;
    } else {
      syntheseTexte = "Niveau de maîtrise opérationnelle à surveiller sur cette période.";
    }

    return {
      disponible: !!(verify || inventaire),
      piste: verify ? { total: verify.total, tauxConforme: verify.tauxConforme, ecartCumule: verify.ecartCumule, pireEcart: verify.pireEcart, composantePlusTouchee: verify.composantePlusTouchee } : { disponible: false },
      boutique: inventaire ? {
        totalCounts: inventaire.totalCounts, completedCategories: inventaire.completedCategories, missingCounts: inventaire.missingCounts,
        totalDiscrepancies: inventaire.totalDiscrepancies, openDiscrepancies: inventaire.openDiscrepancies,
        resolvedDiscrepancies: inventaire.resolvedDiscrepancies, estimatedValue: inventaire.estimatedValue,
      } : { disponible: false },
      syntheseTexte,
    };
  }

  // ------------------------------------------------------------
  // 11. Équipe
  // ------------------------------------------------------------
  function construireChapitreEquipe(equipe, operationsVerify) {
    if (!equipe || !equipe.disponible) {
      return { disponible: false, raison: (equipe && equipe.raison) || 'Aucun pointage ni mission sur cette période.' };
    }
    const tauxConformeCaisse = operationsVerify && operationsVerify.disponible ? operationsVerify.tauxConforme : null;

    let axeFormation = null;
    if (operationsVerify && operationsVerify.disponible && operationsVerify.tauxConforme != null && operationsVerify.tauxConforme < 0.85 && operationsVerify.composantePlusTouchee) {
      axeFormation = operationsVerify.composantePlusTouchee === 'Équilibré entre piste et boutique'
        ? "La précision des clôtures de caisse (piste et boutique) constitue le principal besoin de renforcement collectif."
        : `La précision des clôtures ${operationsVerify.composantePlusTouchee.toLowerCase()} constitue le principal besoin de renforcement collectif.`;
    } else if (equipe.tauxPonctualite != null && equipe.tauxPonctualite < 0.85) {
      axeFormation = "La ponctualité aux prises de poste constitue le principal axe d'amélioration collectif sur cette période.";
    }

    const recommandationManageriale = axeFormation
      ? "Un rappel collectif de procédure est recommandé plutôt qu'une intervention individuelle — le signal concerne l'équipe dans son ensemble, pas un collaborateur isolé."
      : null;

    return {
      disponible: true,
      collaborateursActifs: equipe.collaborateursActifs,
      tauxPonctualite: equipe.tauxPonctualite, nbRetards: equipe.nbRetards, nbPointages: equipe.nbPointages,
      nbMissions: equipe.nbMissions, nbMissionsTerminees: equipe.nbMissionsTerminees, tauxMissions: equipe.tauxMissions,
      tauxConformeCaisse,
      progressionDisponible: false,
      progressionNote: "Comparaison de la fiabilité collective à la période précédente : chantier non construit dans cette version.",
      axeFormation, recommandationManageriale,
    };
  }

  // ------------------------------------------------------------
  // 12. Risques et contrôle interne
  // ------------------------------------------------------------
  // Restructuré le 12/08/2026 (cadrage développeur de Frédéric, Phase 1 —
  // "le Rapport ne doit plus classifier lui-même les risques") : ce chapitre
  // ne contient plus qu'UNE source de vérité pour le mot "risque" —
  // `signauxQualifies`, produit exclusivement par `NexusRisques` (passthrough
  // pur, aucune 2e classification écrite ici, inchangé depuis v2.49). Ce qui
  // s'appelait `risques` (seuils instantanés/comparaison de pairs sur la
  // période choisie, sans mémoire dans le temps) est renommé
  // `constatsSectoriels` et volontairement dépouillé de tout vocabulaire de
  // risque (`categorie`→`secteur`, disparition de `impact`/`urgence` — ces
  // deux notions sont désormais réservées aux signaux réellement qualifiés
  // par le moteur de risques, cadrage §9-10) : ce sont des observations
  // descriptives ("Boissons recule de 7,2 %"), jamais un verdict. Principe
  // du cadrage §1 : "Une catégorie sous la moyenne de marge du magasin ne
  // signifie pas nécessairement qu'elle est en difficulté" — elle peut être
  // structurellement peu margée, un produit d'appel, en forte progression de
  // volume, etc. NEXUS le CONSTATE, il ne le QUALIFIE plus comme risque tant
  // qu'aucune preuve de récurrence n'existe (c'est exactement le rôle de
  // `NexusRisques`, comparaison à SA PROPRE référence, jamais à la seule
  // médiane du groupe).
  // Migration complète (faire qualifier CES constats eux-mêmes par
  // NexusRisques, domaines Commerce/Carburants/Inventaire) reste un chantier
  // séparé (cadrage Phase 5-6, domaines non encore branchés sur le moteur) —
  // ce lot retire uniquement le VOCABULAIRE et la STRUCTURE de risque
  // usurpés par ces constats, il ne les fait pas encore qualifier par le
  // moteur.
  function construireChapitreRisques({ operations, chapitreCarburants, chapitreMarge, chapitreCommerce, signauxQualifies }) {
    const constatsSectoriels = [];
    const verify = operations && operations.verify && operations.verify.disponible ? operations.verify : null;
    const inventaire = operations && operations.inventaire && operations.inventaire.disponible ? operations.inventaire : null;

    if (verify && verify.ecartCumule > 0) {
      constatsSectoriels.push({ secteur: 'Opérations', libelle: `Écarts de caisse cumulés : ${fmtEuros(verify.ecartCumule)}.` });
    }
    if (inventaire && inventaire.estimatedValue) {
      constatsSectoriels.push({ secteur: 'Opérations', libelle: `Démarque potentielle estimée : ${fmtEuros(inventaire.estimatedValue)}.` });
    }
    if (chapitreMarge && chapitreMarge.disponible && chapitreMarge.classement.destructeurs && chapitreMarge.classement.destructeurs.length) {
      constatsSectoriels.push({ secteur: 'Marge', libelle: `${chapitreMarge.classement.destructeurs.length} catégorie(s) sous la moyenne de marge du magasin (comparaison à la période en cours, pas nécessairement un signe de difficulté).` });
    }
    if (inventaire && inventaire.openDiscrepancies) {
      constatsSectoriels.push({ secteur: 'Opérations', libelle: `${inventaire.openDiscrepancies} écart(s) inventaire encore ouvert(s).` });
    }
    if (inventaire && inventaire.missingCounts) {
      constatsSectoriels.push({ secteur: 'Opérations', libelle: `${inventaire.missingCounts} comptage(s) manquant(s) sur la période.` });
    }
    if (chapitreCommerce && chapitreCommerce.disponible) {
      const enBaisse = chapitreCommerce.categories.filter(c => c.evolution_ca != null && c.evolution_ca < 0);
      if (enBaisse.length) constatsSectoriels.push({ secteur: 'Commerce', libelle: `${enBaisse.length} catégorie(s) en recul : ${enBaisse.slice(0, 3).map(c => c.nom).join(', ')}.` });
    }
    if (chapitreCarburants && chapitreCarburants.disponible && chapitreCarburants.evolution != null && chapitreCarburants.evolution < -0.05) {
      constatsSectoriels.push({ secteur: 'Carburants', libelle: `Volume carburant en recul de ${fmtPct(chapitreCarburants.evolution)} sur la période.` });
    }

    // Résumé (cadrage §15-16) : uniquement dérivé de signauxQualifies —
    // jamais un mélange avec constatsSectoriels, qui n'a par construction
    // aucun niveau de gravité NEXUS.
    // Cadrage risques Phase 3 (18/08/2026, tâche #232, "dimension urgence +
    // référence au contrat NexusRisques") : les signaux qualifiés sont
    // désormais triés par urgence d'abord, gravité ensuite — même règle et
    // même source (`NexusRisques.RANG_URGENCE`/`RANG_NIVEAU`) que le tri
    // local déjà appliqué dans Brief NEXUS depuis P1.3 (v2.53) : "Brief
    // doit montrer en priorité l'urgence, tout en conservant la gravité.
    // Une exposition immédiate peut être plus importante aujourd'hui qu'un
    // risque avéré de moyen terme." Contrairement à Brief, le Rapport
    // n'écrête PAS la liste à 3 signaux (`slice(0,3)`) — c'est un document
    // exhaustif, pas une carte de synthèse ; seul l'ORDRE change ici. Fait
    // ici plutôt que dans `NEXUS-Rapport-v1.html` : le tri est une
    // transformation pure sur des données déjà qualifiées, donc sa place
    // naturelle est ce moteur (Article 11), à l'identique du recours déjà
    // établi à `global.NexusRayonMoteur` un peu plus haut dans ce fichier.
    // Repli sur `{}` si `NexusRisques` n'est pas chargé (contexte de test
    // isolé, par exemple) — dans ce cas `RANG[x] || 0` vaut toujours 0 pour
    // tous les signaux, donc le tri est un no-op stable, jamais une
    // exception (Article 5).
    const RANG_URG = (global.NexusRisques && global.NexusRisques.RANG_URGENCE) || {};
    const RANG_NIV = (global.NexusRisques && global.NexusRisques.RANG_NIVEAU) || {};
    const signaux = (signauxQualifies || []).slice().sort((a, b) => {
      const diffUrg = (RANG_URG[b.urgence] || 0) - (RANG_URG[a.urgence] || 0);
      if (diffUrg !== 0) return diffUrg;
      return (RANG_NIV[b.niveau] || 0) - (RANG_NIV[a.niveau] || 0);
    });
    const resume = {
      risqueAvere: signaux.filter(s => s.niveau === 'risque_avere').length,
      exposition: signaux.filter(s => s.niveau === 'exposition').length,
      signalFaible: signaux.filter(s => s.niveau === 'signal_faible').length,
    };
    return {
      disponible: constatsSectoriels.length > 0 || signaux.length > 0,
      constatsSectoriels, signauxQualifies: signaux, resume,
    };
  }

  // ------------------------------------------------------------
  // 13-14. Forces / Ce qui doit progresser
  // ------------------------------------------------------------
  function construireForces({ chapitre2, chapitreMarge, operations }) {
    const forces = [];
    chapitre2.axes.filter(a => a.statut === 'En hausse').forEach(a => forces.push({ titreCourt: a.nom, detail: a.detail }));
    if (chapitreMarge && chapitreMarge.disponible && chapitreMarge.classement.moteurs.length) {
      forces.push({ titreCourt: 'Marge', detail: `Catégories moteurs de marge : ${chapitreMarge.classement.moteurs.slice(0, 3).map(m => m.nom).join(', ')}.` });
    }
    if (operations.inventaire && operations.inventaire.disponible && operations.inventaire.totalCounts > 0) {
      const tauxCompletion = operations.inventaire.completedCategories;
      if (operations.inventaire.openDiscrepancies === 0) forces.push({ titreCourt: 'Inventaire', detail: 'Aucun écart inventaire ouvert sur la période.' });
    }
    if (operations.verify && operations.verify.disponible && operations.verify.tauxConforme != null && operations.verify.tauxConforme >= 0.9) {
      forces.push({ titreCourt: 'Contrôle caisse', detail: `Taux de conformité des contrôles caisse : ${fmtPct(operations.verify.tauxConforme, 0)}.` });
    }
    return forces.slice(0, 5);
  }

  // Cadrage risques Phase 2 (18/08/2026, tâche #231, cahier "Évolution du
  // moteur Risques NEXUS" §3-4 : donner à "Ce qui doit progresser" une
  // "référence propre" au lieu d'une comparaison de pairs) : le volet Marge
  // de cette liste ne vient plus de `chapitreMarge.classement.destructeurs`
  // (comparaison instantanée à la moyenne pondérée du magasin, sans
  // mémoire dans le temps — exactement le "Mauvaise approche" du cadrage
  // §3, déjà retiré du chapitre 12 en Phase 1/v2.51) mais des signaux
  // `marge` déjà qualifiés par `NexusRisques` (récurrence confirmée contre
  // la référence historique PROPRE de la catégorie — même source que
  // "Risques & vigilances", jamais un 2e calcul ici, Article 11). Une
  // catégorie sous la moyenne du magasin sans historique de dégradation
  // propre ne figure donc plus dans "Ce qui doit progresser" — ce n'est pas
  // une donnée perdue : elle reste visible, non qualifiée, dans "Constats
  // sectoriels" (chapitre 12). Les volets Commerce (`chapitre2.axes` En
  // baisse, `chapitreCommerce`) et Opérations (écarts de caisse) restent
  // volontairement sur leur logique existante — ces domaines ne sont pas
  // encore branchés sur NexusRisques (Phase 6, tâche #235).
  function construireAmeliorer({ chapitre2, chapitreMarge, operations, chapitreCommerce, signauxQualifies }) {
    const items = [];
    chapitre2.axes.filter(a => a.statut === 'En baisse').forEach(a => items.push({
      constat: `${a.nom} en baisse`, impact: a.detail, causeProbable: 'À confirmer — voir le détail du secteur.', actionProposee: `Analyser ${a.nom.toLowerCase()} dans le détail (voir le module dédié).`,
    }));
    const RANG_NIVEAU_LOCAL = { risque_avere: 2, exposition: 1, signal_faible: 0 };
    (signauxQualifies || [])
      .filter(s => s.domaine === 'marge')
      .slice()
      .sort((a, b) => (RANG_NIVEAU_LOCAL[b.niveau] || 0) - (RANG_NIVEAU_LOCAL[a.niveau] || 0))
      .forEach(s => {
        items.push({
          constat: `Marge ${s.sujet || ''}`.trim(),
          impact: s.phrase,
          causeProbable: "Confirmé par comparaison à la référence historique propre de la catégorie (NexusRisques) — pas une simple comparaison à la moyenne du magasin.",
          actionProposee: s.actionRecommandee || `Analyser le pricing et les références les moins contributrices de ${s.sujet || 'cette catégorie'}.`,
        });
      });
    if (operations.verify && operations.verify.disponible && operations.verify.parStatut && (operations.verify.parStatut.anomalie + operations.verify.parStatut.critique) > 0) {
      items.push({
        constat: 'Écarts de caisse récurrents',
        impact: `${operations.verify.parStatut.anomalie + operations.verify.parStatut.critique} contrôle(s) en anomalie ou critique sur ${operations.verify.total}.`,
        causeProbable: operations.verify.composantePlusTouchee !== 'Équilibré entre piste et boutique' ? `Concentré côté ${operations.verify.composantePlusTouchee.toLowerCase()}.` : 'Réparti entre piste et boutique.',
        actionProposee: 'Traiter la récurrence des anomalies de caisse en priorité.',
      });
    }
    if (chapitreCommerce && chapitreCommerce.disponible) {
      const pireCategorie = chapitreCommerce.categories.filter(c => c.evolution_ca != null).sort((a, b) => a.evolution_ca - b.evolution_ca)[0];
      if (pireCategorie && pireCategorie.evolution_ca < -0.05) {
        items.push({
          constat: `${pireCategorie.nom} en recul`, impact: fmtPct(pireCategorie.evolution_ca),
          causeProbable: 'À confirmer — voir le détail de la catégorie.', actionProposee: `Examiner l'assortiment et le prix de ${pireCategorie.nom}.`,
        });
      }
    }
    return items.slice(0, 5);
  }

  // ------------------------------------------------------------
  // 15. Projection économique
  // ------------------------------------------------------------
  function construireProjection({ periode, chapitre1, trajectoire, dateReference }) {
    const aujourdhui = dateReference || new Date();
    const debut = new Date(periode.debut + 'T00:00:00');
    const fin = new Date(periode.fin + 'T00:00:00');
    const periodeEnCours = aujourdhui >= debut && aujourdhui <= fin;

    if (!periodeEnCours) {
      return { disponible: false, raison: "La période sélectionnée est déjà terminée — la projection ne s'applique qu'à une période en cours." };
    }
    if (!chapitre1.ca || !chapitre1.ca.disponible) {
      return { disponible: false, raison: "Donnée de CA insuffisante pour projeter la fin de période." };
    }
    const joursEcoules = Math.max(1, Math.round((aujourdhui - debut) / 86400000) + 1);
    const joursTotal = Math.round((fin - debut) / 86400000) + 1;
    const rythmeActuel = (chapitre1.ca.valeur / joursEcoules) * joursTotal;

    let scenarioMoyenneNMois = null, nbMoisMoyenne = 0;
    if (trajectoire && trajectoire.disponible && trajectoire.mois.length >= 2) {
      const fenetre = trajectoire.mois.slice(-3);
      nbMoisMoyenne = fenetre.length;
      const moyenneJournaliere = fenetre.reduce((s, m) => s + m.ca, 0) / fenetre.length / 30; // approximation mensuelle→journalière, documentée
      scenarioMoyenneNMois = moyenneJournaliere * joursTotal;
    }

    return {
      disponible: true, joursEcoules, joursTotal, rythmeActuel, scenarioMoyenneNMois, nbMoisMoyenne,
      scenarioN1: null, // jamais disponible tant qu'aucune donnée N-1 n'existe pour ce site
      mention: 'ESTIMÉ — projection fondée sur les données disponibles, pas une prévision garantie.',
    };
  }

  // ------------------------------------------------------------
  // 16. Suggestions de développement
  // ------------------------------------------------------------
  function construireSuggestions({ chapitreCommerce, chapitreMarge, chapitreCarburants, chapitreFdj, chapitreEquipe }) {
    const suggestions = [];
    if (chapitreMarge && chapitreMarge.disponible && chapitreMarge.classement.moteurs.length && chapitreMarge.classement.destructeurs.length) {
      suggestions.push({
        secteur: 'Marge', suggestion: `Renforcer les catégories moteurs (${chapitreMarge.classement.moteurs.slice(0, 2).map(m => m.nom).join(', ')}) plutôt que rechercher uniquement du volume sur les catégories à marge faible.`,
        pourquoi: 'Ces catégories dégagent une marge nettement supérieure à la moyenne pondérée du magasin.',
        donneesUtilisees: 'products (CA et marge par catégorie, période affichée).', confiance: 'dérivé',
        impactAttendu: 'Non chiffré — dépend des volumes réellement déplaçables.',
        manquePourConfirmer: "Une décomposition prix/mix par catégorie, non disponible aujourd'hui.",
      });
    }
    if (chapitreCarburants && chapitreCarburants.disponible === false) {
      suggestions.push({
        secteur: 'Carburants', suggestion: 'Démarrer un relevé régulier du stock physique carburant.',
        pourquoi: "Sans relevé régulier, NEXUS ne peut ni contrôler l'écart théorique/réel ni construire l'autonomie de stock.",
        donneesUtilisees: 'carburant_releves (table quasi vide à ce jour).', confiance: 'dérivé',
        impactAttendu: 'Détection plus rapide d\'un écart carburant significatif.', manquePourConfirmer: 'Usage régulier de l\'écran Carburants (Relevé du jour).',
      });
    }
    if (chapitreFdj && chapitreFdj.disponible && chapitreFdj.jeuxTop && chapitreFdj.jeuxTop.length === 1) {
      suggestions.push({
        secteur: 'FDJ', suggestion: `Sécuriser l'approvisionnement de ${chapitreFdj.jeuxTop[0].nom} avant les périodes de forte demande.`,
        pourquoi: "Ce jeu concentre une part significative du CA FDJ de la période — sa rupture aurait un impact direct.",
        donneesUtilisees: 'view_fdj_game_daily (période).', confiance: 'dérivé',
        impactAttendu: 'Non chiffré.', manquePourConfirmer: 'Historique de rupture sur ce jeu (non suivi à ce jour).',
      });
    }
    if (chapitreEquipe && chapitreEquipe.disponible && chapitreEquipe.axeFormation) {
      suggestions.push({
        secteur: 'Équipe', suggestion: 'Concentrer la formation sur la procédure générant le plus d\'anomalies.',
        pourquoi: chapitreEquipe.axeFormation, donneesUtilisees: 'audits_caisse, pointages (période).', confiance: 'dérivé',
        impactAttendu: 'Réduction attendue de la récurrence des anomalies concernées.', manquePourConfirmer: 'Mesure après formation, non encore disponible (boucle apprentissage à construire).',
      });
    }
    // Note : pas de granularité jour-de-semaine disponible sur `products`
    // (blocs d'import, pas de flux quotidien) — une suggestion Commerce du
    // type "tester le dimanche" nécessiterait audits_caisse au quotidien
    // sur plusieurs semaines, non exploité ici dans cette version.
    return suggestions.slice(0, 5);
  }

  // ------------------------------------------------------------
  // 17. Décisions prises + effets observés
  // ------------------------------------------------------------
  // Effet observé d'une décision Marge+ (12/08/2026, cadrage §13, lot
  // P2.2 "Rapport de Direction complet") : compare la marge % de la
  // catégorie AU MOMENT de la décision (`periode_reference_debut/fin`,
  // déjà écrits par Marge+ dans journal_decisions, jamais lus jusqu'ici) à
  // la marge % de la période la PLUS RÉCENTE disponible depuis. Portée
  // volontairement limitée aux décisions `rule_id === 'R5-MARGE-ECART'` —
  // seul domaine où une remesure propre est possible sans nouvelle donnée
  // (le CA/marge d'une catégorie se recalcule directement depuis
  // `products`, déjà chargé pour le chapitre Commerce). Les décisions
  // Produits (R2/R3/R4, comparaison de CA/volume) suivraient une logique
  // de mesure différente (évolution de CA, pas de marge %) — non couvertes
  // par ce lot, consignées comme extension future plutôt que traitées à la
  // légère avec la même formule.
  //
  // IMPORTANT (Article 5) : une hausse de marge après la période de
  // référence ne PROUVE PAS que la décision en est la cause — seulement
  // que la situation a évolué dans ce sens depuis. Le texte produit reste
  // descriptif ("la marge a progressé depuis"), jamais causal ("la
  // décision a fonctionné").
  const SEUIL_BRUIT_EFFET_MARGE_POINTS = 1; // en dessous, ne pas conclure (bruit normal de mix produit)
  function evaluerEffetDecisionMarge(rowsBrut, categorie, periodeReferenceDebut, periodeReferenceFin) {
    if (!rowsBrut || !categorie || !periodeReferenceDebut) return { disponible: false, raison: 'Référence de période absente sur cette décision.' };
    const parPeriode = {};
    rowsBrut.forEach(r => {
      if (r.categorie !== categorie) return;
      const cle = r.periode_debut;
      if (!parPeriode[cle]) parPeriode[cle] = { ca: 0, marge: 0, debut: r.periode_debut, fin: r.periode_fin };
      parPeriode[cle].ca += Number(r.ca) || 0;
      parPeriode[cle].marge += Number(r.marge) || 0;
    });
    const periodes = Object.values(parPeriode).filter(p => p.ca > 0).sort((a, b) => (a.debut < b.debut ? -1 : 1));
    const ref = periodes.find(p => p.debut === periodeReferenceDebut);
    if (!ref) return { disponible: false, raison: 'Période de référence introuvable dans les données actuelles.' };
    const margeRefPct = (ref.marge / ref.ca) * 100;
    const bornePosterieure = periodeReferenceFin || periodeReferenceDebut;
    const posterieures = periodes.filter(p => p.debut > bornePosterieure);
    if (!posterieures.length) return { disponible: false, raison: 'Aucune période postérieure à la décision disponible pour l\'instant.' };
    const plusRecente = posterieures[posterieures.length - 1];
    const margeRecentePct = (plusRecente.marge / plusRecente.ca) * 100;
    const deltaPoints = margeRecentePct - margeRefPct;
    let statut;
    if (deltaPoints >= SEUIL_BRUIT_EFFET_MARGE_POINTS) statut = 'amelioration';
    else if (deltaPoints <= -SEUIL_BRUIT_EFFET_MARGE_POINTS) statut = 'degradation';
    else statut = 'stable';
    const phrase = statut === 'amelioration'
      ? `Marge en progression depuis : ${fmtPts(deltaPoints)} (${margeRefPct.toFixed(1)} % → ${margeRecentePct.toFixed(1)} %).`
      : statut === 'degradation'
        ? `Marge toujours en retrait depuis : ${fmtPts(deltaPoints)} (${margeRefPct.toFixed(1)} % → ${margeRecentePct.toFixed(1)} %).`
        : `Marge stable depuis (${fmtPts(deltaPoints)}) — pas d'évolution significative.`;
    return { disponible: true, statut, deltaPoints, margeRefPct, margeRecentePct, periodeRecenteLabel: `${fmtDateFr(plusRecente.debut)} – ${fmtDateFr(plusRecente.fin)}`, phrase };
  }

  function construireDecisionsChapitre(decisions, rowsBrut) {
    const liste = (decisions || []).map(d => {
      const effet = (d.rule_id === 'R5-MARGE-ECART' && d.periode_reference_debut)
        ? evaluerEffetDecisionMarge(rowsBrut, d.categorie, d.periode_reference_debut, d.periode_reference_fin)
        : { disponible: false, raison: d.rule_id === 'R5-MARGE-ECART' ? 'Aucune période de référence enregistrée pour cette décision.' : "Effet observé non disponible pour ce type de décision (couverture actuelle : décisions Marge+ uniquement)." };
      return {
        date: d.date, decision: d.recommandation || d.rule_id, secteur: d.categorie || d.article || '—',
        responsable: d.employee_id || '—', statut: d.etat, impact_eur: d.impact_eur,
        effet,
      };
    });
    const decisionsMargeAvecEffet = liste.filter(d => d.effet.disponible);
    return {
      disponible: liste.length > 0, decisions: liste,
      // effetsObservesDisponible reflète désormais la couverture RÉELLE,
      // pas un booléen figé — vrai dès qu'au moins une décision Marge+ a pu
      // être remesurée, faux sinon (aucune décision Marge+ sur la période,
      // ou aucune n'a encore de période postérieure disponible).
      effetsObservesDisponible: decisionsMargeAvecEffet.length > 0,
      effetsObservesNote: decisionsMargeAvecEffet.length > 0
        ? `Effet observé disponible sur ${decisionsMargeAvecEffet.length} décision(s) Marge+ (comparaison de la marge % de la catégorie avant/après la décision) — une évolution favorable ne démontre pas que la décision en est la cause, seulement que la situation a changé dans ce sens depuis. Les autres types de décision (Produits, Caisse, Stock...) ne sont pas encore couverts par cette mesure.`
        : "NEXUS ne mesure pas encore d'effet a posteriori sur cette période — soit aucune décision Marge+ n'a été prise, soit aucune période postérieure n'est encore disponible pour remesurer. impact_eur reste une estimation faite au moment de la décision, pas un résultat constaté.",
    };
  }

  // ------------------------------------------------------------
  // 18. Priorités de la prochaine période + signature
  // ------------------------------------------------------------
  function construirePriorites(ameliorer) {
    return (ameliorer || []).slice(0, 5).map((item, i) => ({ rang: i + 1, titre: item.constat, action: item.actionProposee }));
  }

  function construireSignature() {
    return {
      accroche: 'Propulsé par le Conseiller NEXUS',
      sousAccroche: 'Des données aux décisions.',
      mentionConfiance: 'Ce rapport est produit à partir des données disponibles dans NEXUS. Les éléments RÉELS sont mesurés. Les éléments DÉRIVÉS sont calculés. Les éléments ESTIMÉS constituent des projections et non des garanties.',
    };
  }

  // ------------------------------------------------------------
  // Orchestrateur
  // ------------------------------------------------------------
  function construireRapportDirection(input) {
    const chapitreCommerce = construireChapitreCommerce(input.commerceCategories);
    const produitsMoteurs = construireProduitsMoteurs(input.commerceCategories);
    const chapitreMarge = construireChapitreMarge(input.commerceCategories);
    const chapitreCarburants = construireChapitreCarburants(input.carburantsDetail);
    const chapitreFdj = construireChapitreFdj(input.fdjDetail);
    const chapitreOperations = construireChapitreOperations(input.operations || {});
    const chapitreEquipe = construireChapitreEquipe(input.equipe, input.operations && input.operations.verify);
    const trajectoire = construireTrajectoire(input.trajectoire);

    const syntheseExecutive = construireSyntheseExecutive({
      chapitre1: input.chapitre1, chapitre2: input.chapitre2,
      decisionsStrategiques: input.decisionsStrategiques, chapitreMarge,
      signauxQualifies: input.signauxQualifies,
    });
    const tableauDeBord = construireTableauDeBord({
      chapitre1: input.chapitre1, carburantsDetail: input.carburantsDetail, fdjDetail: input.fdjDetail,
      operations: input.operations || {}, equipe: input.equipe,
    });
    const forces = construireForces({ chapitre2: input.chapitre2, chapitreMarge, operations: input.operations || {} });
    const ameliorer = construireAmeliorer({ chapitre2: input.chapitre2, chapitreMarge, operations: input.operations || {}, chapitreCommerce, signauxQualifies: input.signauxQualifies });
    const risques = construireChapitreRisques({ operations: input.operations || {}, chapitreCarburants, chapitreMarge, chapitreCommerce, signauxQualifies: input.signauxQualifies });
    const projection = construireProjection({ periode: input.periode, chapitre1: input.chapitre1, trajectoire: input.trajectoire, dateReference: input.dateReference });
    const suggestions = construireSuggestions({ chapitreCommerce, chapitreMarge, chapitreCarburants, chapitreFdj, chapitreEquipe });
    const decisionsChapitre = construireDecisionsChapitre(input.chapitre1.decisions, input.commerceCategories && input.commerceCategories.rowsBrut);
    const priorites = construirePriorites(ameliorer);

    return {
      couverture: construireCouverture({ nomEntreprise: input.nomEntreprise, periode: input.periode, dateGeneration: input.dateReference }),
      syntheseExecutive, tableauDeBord, trajectoire,
      commerce: chapitreCommerce, produitsMoteurs, marge: chapitreMarge,
      carburants: chapitreCarburants, fdj: chapitreFdj,
      operations: chapitreOperations, equipe: chapitreEquipe,
      risques, forces, ameliorer, projection, suggestions, decisionsChapitre, priorites,
      signature: construireSignature(),
    };
  }

  global.NexusRapportDirectionMoteur = {
    fmtEuros, fmtPct, fmtPts, fmtL, fmtDateFr,
    construireCouverture, construireSyntheseExecutive, construireTableauDeBord, construireTrajectoire,
    construireChapitreCommerce, construireProduitsMoteurs, construireChapitreMarge,
    construireChapitreCarburants, construireChapitreFdj, construireChapitreOperations, construireChapitreEquipe,
    construireChapitreRisques, construireForces, construireAmeliorer, construireProjection,
    construireSuggestions, construireDecisionsChapitre, evaluerEffetDecisionMarge, construirePriorites, construireSignature,
    construireRapportDirection,
  };
})(typeof window !== 'undefined' ? window : globalThis);
