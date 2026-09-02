// ============================================================
// NEXUS Rapport — moteur de calcul pur (10/08/2026).
//
// Premier jet du "cadrage développeur" du 10/08/2026 (Rapport NEXUS),
// limité au périmètre choisi par Frédéric pour prouver l'architecture
// bout-en-bout : Chapitre 1 (Synthèse dirigeant) + Chapitre 2 (Santé de
// l'entreprise). Comme tous les moteurs NEXUS (Article 11), ce fichier
// ne fait AUCUN accès Supabase — il reçoit des données déjà chargées
// (par nexus-rapport-donnees.js) et calcule. Réutilisé à l'identique
// par l'écran (NEXUS-Rapport-v1.html) et par l'export PDF, pour que les
// deux ne puissent jamais raconter deux histoires différentes.
//
// Portée volontairement honnête (V1) : Chapitre 2 ne couvre que les
// axes Commerce et Marge, les deux seuls pour lesquels un calcul
// période-vs-référence fiable existe aujourd'hui (via la cascade CA/
// marge de nexus-rapport-donnees.js). Opérations et Équipe demandent un
// scoping par période calendaire de l'écart de caisse et des pointages
// qui n'existe pas encore — plutôt que d'improviser un calcul non
// vérifié, ce moteur les retourne explicitement en "Données
// insuffisantes pour cette période" (voir axesNonCouverts). À compléter
// dans une itération suivante, pas dans ce premier bout-en-bout.
//
// Inclure (après nexus-boussole-moteur.js si les statuts textuels sont
// réutilisés côté appelant — ce fichier ne l'importe pas lui-même) :
//   <script src="nexus-rapport-moteur.js?v=20260902-1823"></script>
// ------------------------------------------------------------

(function (global) {
  const SEUIL_STABLE_PCT = 0.02; // sous ce seuil (2 %), une évolution est dite "stable" plutôt que hausse/baisse

  /**
   * Évolution relative entre une valeur actuelle et une valeur de
   * référence — null si l'une des deux manque ou si la référence est
   * nulle (division impossible, jamais un pourcentage fabriqué à partir
   * de rien : même principe que NexusPeriodes.evolutionAgregee).
   */
  function evolutionRatio(actuel, reference) {
    if (actuel == null || reference == null || reference === 0) return null;
    return (actuel - reference) / reference;
  }

  function directionTexte(evolution) {
    if (evolution == null) return 'Non mesurable';
    if (evolution >= SEUIL_STABLE_PCT) return 'En hausse';
    if (evolution <= -SEUIL_STABLE_PCT) return 'En baisse';
    return 'Stable';
  }

  /**
   * Construit le contenu du Chapitre 1 — Synthèse dirigeant.
   * Entrées déjà résolues par l'appelant (période, référence, chargeurs
   * de nexus-rapport-donnees.js, décisions du journal) :
   *   periode          : { debut, fin, label, type }
   *   ca               : résultat de chargerCaPeriode() sur la période actuelle
   *   caRef            : résultat de chargerAvecRepli(chargerCaPeriode, ...) sur la/les référence(s)
   *   marge            : résultat de chargerMargePeriode() sur la période actuelle
   *   margeRef         : résultat de chargerAvecRepli(chargerMargePeriode, ...) sur la/les référence(s)
   *   decisions        : tableau de journal_decisions (déjà filtré sur la période)
   * Retourne un objet prêt à être rendu à l'écran ET dans le PDF —
   * jamais de mise en forme HTML/PDF ici, seulement des valeurs et du
   * texte brut.
   */
  function construireChapitreSynthese({ periode, ca, caRef, marge, margeRef, decisions }) {
    const evolutionCa = (ca && ca.disponible && caRef && caRef.disponible) ? evolutionRatio(ca.valeur, caRef.valeur) : null;
    const evolutionMargeTaux = (marge && marge.disponible && margeRef && margeRef.disponible && marge.tauxPct != null && margeRef.tauxPct != null)
      ? marge.tauxPct - margeRef.tauxPct // écart en POINTS, pas en % relatif — plus lisible pour un taux
      : null;

    const directionCa = directionTexte(evolutionCa);
    const directionMarge = evolutionMargeTaux == null ? 'Non mesurable' : (evolutionMargeTaux >= 0.5 ? 'En hausse' : evolutionMargeTaux <= -0.5 ? 'En baisse' : 'Stable');

    const nbDecisions = (decisions || []).length;
    const impactDecisions = (decisions || []).reduce((s, d) => s + (d.impact_eur || 0), 0);

    // Phrase de synthèse — construite à partir de ce qui est réellement
    // mesurable, jamais d'affirmation sur un axe "Non mesurable".
    const morceaux = [];
    if (ca && ca.disponible) {
      morceaux.push(evolutionCa == null
        ? `CA de la période : ${formaterEuros(ca.valeur)} (pas de référence comparable disponible).`
        : `CA ${directionCa === 'En hausse' ? 'en hausse' : directionCa === 'En baisse' ? 'en baisse' : 'stable'} à ${formaterEuros(ca.valeur)} (${evolutionCa >= 0 ? '+' : ''}${(evolutionCa * 100).toFixed(1)} % vs ${caRef.periodeUtilisee ? caRef.periodeUtilisee.label.toLowerCase() : 'référence'}).`);
    } else {
      morceaux.push("CA : données insuffisantes pour cette période.");
    }
    if (marge && marge.disponible && marge.tauxPct != null) {
      const suffixeCouverture = marge.couvertureIncertaine ? ' (échantillon partiel des ventes — taux indicatif, à confirmer)' : '';
      morceaux.push((evolutionMargeTaux == null
        ? `Marge de la période : ${marge.tauxPct.toFixed(1)} % (pas de référence comparable disponible).`
        : `Marge à ${marge.tauxPct.toFixed(1)} % (${evolutionMargeTaux >= 0 ? '+' : ''}${evolutionMargeTaux.toFixed(1)} pt vs ${margeRef.periodeUtilisee ? margeRef.periodeUtilisee.label.toLowerCase() : 'référence'}).`) + suffixeCouverture);
    } else {
      morceaux.push("Marge : données insuffisantes pour cette période.");
    }
    morceaux.push(nbDecisions > 0
      ? `${nbDecisions} décision${nbDecisions > 1 ? 's' : ''} enregistrée${nbDecisions > 1 ? 's' : ''} dans le journal sur la période${impactDecisions ? `, pour un impact estimé de ${formaterEuros(impactDecisions)}` : ''}.`
      : "Aucune décision enregistrée dans le journal sur cette période.");

    return {
      periode,
      ca, caRef, evolutionCa, directionCa,
      marge, margeRef, evolutionMargeTaux, directionMarge,
      nbDecisions, impactDecisions, decisions: decisions || [],
      syntheseTexte: morceaux.join(' '),
    };
  }

  /**
   * Construit le contenu du Chapitre 2 — Santé de l'entreprise / "Rapport
   * par secteur" (audit stratégique Brief/Rapport de Direction, 11/08/2026,
   * section 4). Commerce et Marge restent la base V1 (voir en-tête du
   * fichier). `extra` (optionnel, additif — signature rétrocompatible avec
   * les appelants qui ne passent que chapitreSynthese) permet d'ajouter
   * Carburants et FDJ dès que le manager les scope sur la même période —
   * ces deux secteurs ont une source période-scopée réelle
   * (NexusCarburantDonnees.chargerVentesPeriode, vues view_fdj_*), calculée
   * par l'appelant (NEXUS-Rapport-v1.html) et simplement mise en forme ici
   * (Article 11 : ce fichier ne recalcule jamais un volume ou un CA FDJ,
   * il compose). Opérations et Équipe restent honnêtement "Non couverts
   * (V1)" — aucun scoping par période calendaire fiable n'existe encore
   * pour l'écart de caisse ou les pointages (voir Brief NEXUS, où ces deux
   * secteurs restent scopés "aujourd'hui"/"glissant", jamais sur une
   * période calendaire arbitraire).
   *
   * extra.carburants / extra.fdj, si fournis : soit
   *   { disponible:true, ... } → ajouté à `axes`,
   *   { disponible:false, raison } → ajouté à `axesNonCouverts`,
   *   absent → secteur non demandé par l'appelant (pas de trace dans le
   *   rapport, ex. site sans secteur FDJ activé).
   */
  function construireChapitreSante(chapitreSynthese, extra) {
    const axes = [
      {
        nom: 'Commerce', icone: '🛒',
        statut: chapitreSynthese.evolutionCa == null ? 'Données insuffisantes' : chapitreSynthese.directionCa,
        detail: chapitreSynthese.ca && chapitreSynthese.ca.disponible
          ? `CA : ${formaterEuros(chapitreSynthese.ca.valeur)}${chapitreSynthese.evolutionCa != null ? ` (${chapitreSynthese.evolutionCa >= 0 ? '+' : ''}${(chapitreSynthese.evolutionCa * 100).toFixed(1)} %)` : ''}.`
          : "Aucune donnée de CA pour cette période.",
        confiance: chapitreSynthese.ca && chapitreSynthese.ca.disponible ? chapitreSynthese.ca.confiance : null,
      },
      {
        nom: 'Marge', icone: '💰',
        statut: chapitreSynthese.evolutionMargeTaux == null ? 'Données insuffisantes' : chapitreSynthese.directionMarge,
        detail: chapitreSynthese.marge && chapitreSynthese.marge.disponible && chapitreSynthese.marge.tauxPct != null
          ? `Marge : ${chapitreSynthese.marge.tauxPct.toFixed(1)} %${chapitreSynthese.evolutionMargeTaux != null ? ` (${chapitreSynthese.evolutionMargeTaux >= 0 ? '+' : ''}${chapitreSynthese.evolutionMargeTaux.toFixed(1)} pt)` : ''}${chapitreSynthese.marge.couvertureIncertaine ? ' — échantillon partiel des ventes, taux indicatif' : ''}.`
          : "Aucune donnée de marge pour cette période.",
        confiance: chapitreSynthese.marge && chapitreSynthese.marge.disponible ? chapitreSynthese.marge.confiance : null,
      },
    ];

    const axesNonCouverts = [
      { nom: 'Opérations', icone: '⚙️', raison: "Le scoping par période calendaire de l'écart de caisse n'est pas encore construit." },
      { nom: 'Équipe', icone: '👥', raison: "Le scoping par période calendaire des pointages n'est pas encore construit." },
    ];

    const e = extra || {};
    if (e.carburants) {
      if (e.carburants.disponible) {
        const evol = e.carburants.evolution;
        axes.push({
          nom: 'Carburants', icone: '⛽',
          statut: evol == null ? 'Données insuffisantes' : directionTexte(evol),
          detail: `Volume : ${Math.round(e.carburants.volumeActuel).toLocaleString('fr-FR')} L${evol != null ? ` (${evol >= 0 ? '+' : ''}${(evol * 100).toFixed(1)} %)` : ''}${e.carburants.produitMoteur ? ` · Moteur : ${(e.carburants.produitMoteur.cle || '').toUpperCase()}` : ''}${e.carburants.couvertureIncertaine ? ' — couverture partielle des quarts, volume indicatif' : ''}.`,
          confiance: e.carburants.couvertureIncertaine ? 'derive' : 'reel',
        });
      } else {
        axesNonCouverts.push({ nom: 'Carburants', icone: '⛽', raison: e.carburants.raison || "Aucune vente carburant enregistrée sur cette période." });
      }
    }
    if (e.fdj) {
      if (e.fdj.disponible) {
        const evol = e.fdj.evolution;
        // Couverture quarts finalisés (23/08/2026, audit "Anti-dégradation
        // temporelle" §6, v2.225) — même convention que Carburants
        // (couvertureIncertaine ci-dessus) : le CA FDJ n'a jamais inclus de
        // quart en brouillon (déjà filtré côté SQL, view_fdj_daily_summary),
        // mais rien ne le disait au manager. Ajouté UNIQUEMENT quand la
        // période contient réellement des quarts non inclus (jamais un
        // "10/10 quarts finalisés" qui n'apporterait rien) — Article 5,
        // ne pas fabriquer une inquiétude là où tout est déjà complet.
        const quartsNonInclus = (e.fdj.nbQuartsTotal != null && e.fdj.nbQuartsControles != null)
          ? Math.max(0, e.fdj.nbQuartsTotal - e.fdj.nbQuartsControles) : 0;
        const couvertureIncomplete = quartsNonInclus > 0;
        const suffixeCouverture = couvertureIncomplete
          ? ` — ${e.fdj.nbQuartsControles}/${e.fdj.nbQuartsTotal} quarts finalisés, ${quartsNonInclus} non inclus (en attente de validation)`
          : '';
        axes.push({
          nom: 'FDJ', icone: '🎟️',
          statut: evol == null ? 'Données insuffisantes' : directionTexte(evol),
          detail: `CA FDJ : ${formaterEuros(e.fdj.caActuel)}${evol != null ? ` (${evol >= 0 ? '+' : ''}${(evol * 100).toFixed(1)} %)` : ''}${e.fdj.jeuMoteur ? ` · Jeu moteur : ${e.fdj.jeuMoteur.nom}` : ''}${suffixeCouverture}.`,
          confiance: couvertureIncomplete ? 'derive' : 'reel',
        });
      } else {
        axesNonCouverts.push({ nom: 'FDJ', icone: '🎟️', raison: e.fdj.raison || "Aucun quart FDJ contrôlé sur cette période." });
      }
    }

    const forces = axes.filter(a => a.statut === 'En hausse' || a.statut === 'Stable');
    const fragilites = axes.filter(a => a.statut === 'En baisse');
    const insuffisants = axes.filter(a => a.statut === 'Données insuffisantes');

    return { axes, axesNonCouverts, forces, fragilites, insuffisants };
  }

  function formaterEuros(n) {
    if (n == null) return '—';
    return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
  }

  global.NexusRapportMoteur = {
    evolutionRatio, directionTexte, formaterEuros,
    construireChapitreSynthese, construireChapitreSante,
  };
})(typeof window !== 'undefined' ? window : globalThis);
