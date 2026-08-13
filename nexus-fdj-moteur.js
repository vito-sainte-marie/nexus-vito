// NEXUS FDJ — moteur de calcul partagé (09/08/2026)
//
// Même principe que nexus-conseiller.js (Article 11 de la Constitution
// NEXUS, "une seule vérité") : les formules de rapprochement FDJ (ventes
// par jeu, caisse grattage, caisse attendue, écart) ne vivent qu'ICI —
// NEXUS-FDJ-v1.html (comptage employé) et NEXUS-FDJ-Manager-v1.html
// (correction manager, pouvoir total comme NEXUS Verify) les consomment
// toutes les deux, jamais une copie locale. C'est la même erreur qui avait
// été trouvée et corrigée trois fois cette session (Centre d'Intelligence,
// Produits) — inutile de la refaire ici dès la première version de FDJ.
//
// Formules validées le 09/08/2026 contre le relevé réel du 07/08/2026
// (quart 1, feuille CONTROLE CAISSE) : ventes grattage 576 €, lots payés
// 385 € → caisse grattage 191 €, + caisse tirages 85,70 € → caisse
// attendue 276,70 €, caisse réelle comptée 276,80 € → écart +0,10 €.
//
// Aucune dépendance DOM/Supabase — pures fonctions de calcul.
// Inclure : <script src="nexus-fdj-moteur.js"></script>
// ------------------------------------------------------------

(function (global) {
  // Ventes d'un jeu = stock_initial + appro - stock_final — jamais saisi.
  // `compte` : { stock_initial, appro, stock_final } | undefined.
  // Tant que stock_initial ou stock_final manque, NEXUS ne calcule rien
  // ("vérité avant certitude") : { qte:null, valeur:null }.
  function calculerVentesJeu(compte, prix) {
    if (!compte || compte.stock_initial === null || compte.stock_initial === undefined ||
        compte.stock_final === null || compte.stock_final === undefined) {
      return { qte: null, valeur: null };
    }
    const appro = compte.appro || 0;
    const qte = Number(compte.stock_initial) + Number(appro) - Number(compte.stock_final);
    return { qte, valeur: qte * Number(prix) };
  }

  // `jeux` : [{id, prix}], `countsParJeu` : { [game_id]: {stock_initial, appro, stock_final} }
  function ventesGrattageTotal(jeux, countsParJeu) {
    let total = 0;
    for (const jeu of jeux) {
      const v = calculerVentesJeu((countsParJeu || {})[jeu.id], jeu.prix);
      if (v.valeur !== null) total += v.valeur;
    }
    return total;
  }

  function caisseGrattage(ventesTotal, lotsPayes) {
    if (lotsPayes === null || lotsPayes === undefined || lotsPayes === '') return null;
    return ventesTotal - Number(lotsPayes);
  }

  function caisseAttendue(grattage, caisseTirages, regularisations) {
    if (grattage === null || caisseTirages === null || caisseTirages === undefined || caisseTirages === '') return null;
    return grattage + Number(caisseTirages) + Number(regularisations || 0);
  }

  function ecartCaisse(caisseReelle, attendue) {
    if (attendue === null || caisseReelle === null || caisseReelle === undefined || caisseReelle === '') return null;
    return Math.round((Number(caisseReelle) - attendue) * 100) / 100;
  }

  // ------------------------------------------------------------
  // SOLDES DE CARNETS — 09/08/2026, précision terrain de Frédéric : un
  // transfert Bureau → Caisse n'est PAS une activation. Un carnet confié à
  // la caisse reste "non activé" (aucun impact sur l'appro, aucun
  // engagement financier) jusqu'à ce que la caissière l'active
  // explicitement. NEXUS doit donc distinguer :
  //   - OÙ est le carnet (Bureau / Caisse) — emplacement.
  //   - DANS QUEL ÉTAT il est (non activé / activé) — engagement.
  // Calculé ici à partir des fdj_stock_movements bruts (jamais stocké en
  // dur), pour ne jamais dupliquer cette règle entre l'écran manager
  // ("Réapprovisionner la caisse", type_mouvement='transfert') et l'écran
  // employé ("Activer un carnet", type_mouvement='activation').
  //
  // `mouvements` : lignes brutes fdj_stock_movements (type_mouvement,
  // quantite, game_id, location_source_id, location_destination_id).
  // `locationCaisseId` : id de l'emplacement de type 'caisse' du site.
  // Retourne { [game_id]: { confies, actives, nonActives } } — confies =
  // total de carnets transférés vers la caisse (moins les retours vers le
  // bureau), actives = total de carnets activés, nonActives = confies −
  // actives (jamais négatif dans l'affichage, mais peut apparaître
  // négatif ici si une activation n'a pas été précédée d'un transfert
  // enregistré — NEXUS le signale plutôt que de le masquer).
  function soldesCarnetsParJeu(mouvements, locationCaisseId) {
    const soldes = {};
    const assurer = (id) => {
      if (!soldes[id]) soldes[id] = { confies: 0, actives: 0, nonActives: 0 };
      return soldes[id];
    };
    (mouvements || []).forEach(m => {
      const qte = Number(m.quantite) || 0;
      if (m.type_mouvement === 'transfert' && m.location_destination_id === locationCaisseId) {
        assurer(m.game_id).confies += qte;
      } else if (m.type_mouvement === 'activation') {
        assurer(m.game_id).actives += qte;
      } else if (m.type_mouvement === 'retour' && m.location_source_id === locationCaisseId) {
        assurer(m.game_id).confies -= qte;
      }
    });
    Object.values(soldes).forEach(s => { s.nonActives = s.confies - s.actives; });
    return soldes;
  }
  function soldeCarnetsJeu(mouvements, locationCaisseId, gameId) {
    const soldes = soldesCarnetsParJeu(mouvements, locationCaisseId);
    return soldes[gameId] || { confies: 0, actives: 0, nonActives: 0 };
  }

  // ------------------------------------------------------------
  // POINT ZÉRO — 09/08/2026, demande de Frédéric : "Inventaire de référence
  // FDJ". Un contrôle physique certifié (Bureau + Caisse non activé)
  // devient le nouveau point de départ du stock. Les mouvements déjà
  // enregistrés avant cette date gardent toute leur valeur d'historique
  // (activations → appro, audit) mais n'entrent plus dans le calcul du
  // stock physique confié : "à compter de cet inventaire, seuls les
  // mouvements postérieurs modifient le stock." Fonction dédiée plutôt que
  // de complexifier soldesCarnetsParJeu (qui reste utilisée telle quelle
  // partout où aucune référence n'existe encore).
  //
  // 09/08/2026, audit "Moteur de clairvoyance manager" (Phase A, §3/§18) :
  // ajout de la réception FDJ (Transporteur → Bureau) et des retraits /
  // blocages (Bureau ou Caisse → Zone bloquée, réversible vers le Bureau).
  // Un carnet bloqué sort du stock disponible (bureau/caisse) sans jamais
  // être compté comme activé — "ne pas modifier sans fait".
  //
  // `reference` : { creeLe: <ISO string, ex. fdj_stock_references.created_at>,
  //   lignes: { [game_id]: { bureau, caisse } } } — ou null/undefined pour
  //   se comporter comme avant toute initialisation (bureau part de 0,
  //   jamais vraiment fiable tant qu'aucun inventaire n'a été fait).
  // `locations` : { caisse, bureau, bloque } — ids des emplacements du site
  //   (bloque peut être omis si l'emplacement n'existe pas encore).
  // Retourne { [game_id]: { bureau, confies, actives, bloques, nonActives } }.
  function soldesCarnetsAvecReference(mouvements, locations, reference) {
    locations = locations || {};
    const soldes = {};
    const assurer = (id) => {
      if (!soldes[id]) {
        const ligne = reference && reference.lignes ? reference.lignes[id] : null;
        soldes[id] = {
          bureau: ligne ? Number(ligne.bureau) || 0 : 0,
          confies: ligne ? Number(ligne.caisse) || 0 : 0,
          actives: 0,
          bloques: 0,
          nonActives: 0,
        };
      }
      return soldes[id];
    };
    const seuil = reference && reference.creeLe ? new Date(reference.creeLe).getTime() : null;
    (mouvements || []).forEach(m => {
      if (seuil !== null && m.created_at && new Date(m.created_at).getTime() <= seuil) return; // avant le point zéro : déjà incorporé dans la référence
      const qte = Number(m.quantite) || 0;
      const s = assurer(m.game_id);
      if (m.type_mouvement === 'transfert' && m.location_destination_id === locations.caisse) {
        s.confies += qte;
        if (m.location_source_id === locations.bureau) s.bureau -= qte;
      } else if (m.type_mouvement === 'activation') {
        s.actives += qte;
      } else if (m.type_mouvement === 'retour') {
        if (m.location_source_id === locations.caisse) {
          s.confies -= qte;
          if (m.location_destination_id === locations.bureau) s.bureau += qte;
        } else if (m.location_source_id === locations.bloque) {
          s.bloques -= qte;
          if (m.location_destination_id === locations.bureau) s.bureau += qte;
          else if (m.location_destination_id === locations.caisse) s.confies += qte;
        }
      } else if (m.type_mouvement === 'reception' && m.location_destination_id === locations.bureau) {
        s.bureau += qte;
      } else if (m.type_mouvement === 'blocage') {
        if (m.location_source_id === locations.bureau) { s.bureau -= qte; s.bloques += qte; }
        else if (m.location_source_id === locations.caisse) { s.confies -= qte; s.bloques += qte; }
      } else if (m.type_mouvement === 'correction') {
        if (m.location_destination_id === locations.caisse) s.confies += qte;
        else if (m.location_destination_id === locations.bureau) s.bureau += qte;
      }
    });
    if (reference && reference.lignes) Object.keys(reference.lignes).forEach(id => assurer(id));
    Object.values(soldes).forEach(s => { s.nonActives = s.confies - s.actives; });
    return soldes;
  }

  // ------------------------------------------------------------
  // CONSEILLER FDJ — Phase D (09/08/2026, audit "Moteur de clairvoyance
  // manager", §46 items 13-16 : règles déterministes + objet
  // recommandation commun). Reprend EXACTEMENT les règles jusqu'ici
  // écrites en dur dans renderEnsemble() de NEXUS-FDJ-Analyse-v1.html
  // (rupture/vigilance de stock, écarts de caisse validés, recul/
  // progression de CA sur la période vs la période de comparaison) —
  // extraites ici pour que ce ne soit plus une logique dupliquée mais une
  // seule vérité, consommée à la fois par l'onglet Conseiller de
  // NEXUS-FDJ-Analyse-v1.html (rapport complet, période choisie par le
  // manager) ET par NEXUS-Brief-v1.html (remontée fusionnée aux autres
  // moteurs via NexusConseiller.normaliserFdj, fenêtre fixe 7 jours).
  //
  // Volontairement limité à des faits déjà mesurés (audit §23) : jamais
  // une prédiction, jamais un jugement sur une personne, jamais "vous
  // devez commander N carnets" (NEXUS ne connaît pas les contraintes de
  // commande FDJ), jamais "stock optimal" (aucun objectif défini). Pure
  // fonction : aucun appel Supabase ici, tout est fourni par l'appelant
  // (même discipline que calculerCandidatsProduits dans
  // nexus-conseiller.js).
  //
  // `donnees` = {
  //   soldes: sortie de soldesCarnetsAvecReference (par game_id),
  //   jeux: [{id, nom}],
  //   actuel: sommes sur la période sélectionnée ({ca_grattage,
  //     nb_ecarts_non_nuls, ...}) — mêmes champs que CHAMPS_SUMMARY dans
  //     NEXUS-FDJ-Analyse-v1.html,
  //   evolCa: évolution du CA grattage vs période de comparaison (null si
  //     non disponible),
  //   jeuMoteur: {id, nom} | null — jeu au CA le plus élevé de la période,
  //   labelPeriode / labelComp: libellés déjà résolus par l'appelant (ex.
  //     "cette semaine" / "la semaine précédente"),
  //   periodeCle: identifiant stable de la période (ex. date de début),
  //     utilisé pour construire un candidate_id stable.
  // }
  // Retourne une liste de candidats bruts { id, type, niveau
  //   ('critique'|'attention'|'positif'), titre, constat, preuve,
  //   decision, impactAttendu, limites, cible, confiance, impactEur }.
  function calculerCandidatsFdj(donnees) {
    const d = donnees || {};
    const soldes = d.soldes || {};
    const jeux = d.jeux || [];
    const actuel = d.actuel || {};
    const labelPeriode = d.labelPeriode || 'la période sélectionnée';
    const labelComp = d.labelComp || 'la période précédente';
    const cle = d.periodeCle || 'periode';
    const candidats = [];

    const jeuxRupture = jeux.filter(j => { const s = soldes[j.id]; return s && s.nonActives <= 0 && s.bureau <= 0; });
    const jeuxVigilance = jeux.filter(j => { const s = soldes[j.id]; return s && s.nonActives <= 0 && s.bureau > 0; });

    if (jeuxRupture.length) {
      const noms = jeuxRupture.map(j => j.nom).join(', ');
      candidats.push({
        id: `FDJ-RUPTURE-${jeuxRupture.map(j => j.id).sort().join('|')}`,
        type: 'FDJ-STOCK-RUPTURE', niveau: 'critique',
        titre: jeuxRupture.length === 1 ? jeuxRupture[0].nom : `${jeuxRupture.length} jeux`,
        constat: `${noms} : plus aucun carnet disponible, ni en caisse ni au bureau.`,
        preuve: `Stock calculé à partir du dernier inventaire de référence FDJ et des mouvements enregistrés depuis.`,
        decision: `Sécurisez le stock de ${noms} dès que possible.`,
        impactAttendu: "Vente non interrompue sur ce ou ces jeux.",
        limites: null, confiance: 'Élevée',
        cible: 'NEXUS-FDJ-Manager-v1.html', impactEur: 0,
      });
    } else if (jeuxVigilance.length) {
      const noms = jeuxVigilance.map(j => j.nom).join(', ');
      candidats.push({
        id: `FDJ-VIGILANCE-${jeuxVigilance.map(j => j.id).sort().join('|')}`,
        type: 'FDJ-STOCK-VIGILANCE', niveau: 'attention',
        titre: jeuxVigilance.length === 1 ? jeuxVigilance[0].nom : `${jeuxVigilance.length} jeux`,
        constat: `${noms} : plus rien en caisse, mais du stock reste au bureau.`,
        preuve: `Stock calculé à partir du dernier inventaire de référence FDJ et des mouvements enregistrés depuis.`,
        decision: `Réapprovisionnez la caisse pour ${noms}.`,
        impactAttendu: "Rupture évitée avant qu'elle ne se produise.",
        limites: null, confiance: 'Élevée',
        cible: 'NEXUS-FDJ-Manager-v1.html', impactEur: 0,
      });
    }

    if (actuel.nb_ecarts_non_nuls > 0) {
      candidats.push({
        id: `FDJ-ECART-${cle}`,
        type: 'FDJ-ECART-CAISSE', niveau: actuel.nb_ecarts_non_nuls > 1 ? 'critique' : 'attention',
        titre: 'Écarts de caisse FDJ',
        constat: `${actuel.nb_ecarts_non_nuls} écart${actuel.nb_ecarts_non_nuls > 1 ? 's' : ''} de caisse validé${actuel.nb_ecarts_non_nuls > 1 ? 's' : ''} sur ${labelPeriode}.`,
        preuve: `Comptages de quart validés par le manager, comparés à la caisse attendue.`,
        decision: `Vérifiez la ou les causes de ${actuel.nb_ecarts_non_nuls > 1 ? 'ces écarts' : 'cet écart'}.`,
        impactAttendu: "Écart clarifié avant qu'il ne se reproduise.",
        limites: "Un écart validé n'est pas automatiquement une erreur — voir le détail par quart avant toute conclusion.",
        confiance: 'Élevée',
        cible: 'NEXUS-FDJ-Analyse-v1.html', impactEur: 0,
      });
    }

    if (d.evolCa != null && d.evolCa <= -0.15) {
      candidats.push({
        id: `FDJ-RECUL-${cle}`,
        type: 'FDJ-JOUR-RECUL', niveau: 'attention',
        titre: 'Activité FDJ en recul',
        constat: `CA grattage en recul de ${Math.round(Math.abs(d.evolCa) * 100)} % sur ${labelPeriode}, vs ${labelComp}.`,
        preuve: `Comparaison des vues d'agrégation FDJ (période actuelle vs période comparable précédente).`,
        decision: `Vérifiez stock, activations et rapports de quart avant de conclure sur la cause.`,
        impactAttendu: "Cause du recul identifiée avant qu'elle ne s'installe.",
        limites: "Une seule comparaison de période — pas encore une tendance confirmée sur plusieurs périodes.",
        confiance: 'Moyenne',
        cible: 'NEXUS-FDJ-Analyse-v1.html', impactEur: 0,
      });
    } else if (d.evolCa != null && d.evolCa >= 0.15) {
      candidats.push({
        id: `FDJ-CROISSANCE-${cle}`,
        type: 'FDJ-CROISSANCE', niveau: 'positif',
        titre: 'Activité FDJ en progression',
        constat: `CA grattage en progression de ${Math.round(d.evolCa * 100)} % sur ${labelPeriode}${d.jeuMoteur ? `, portée notamment par ${d.jeuMoteur.nom}` : ''}.`,
        preuve: `Comparaison des vues d'agrégation FDJ (période actuelle vs période comparable précédente).`,
        decision: `Maintenez le stock disponible sur ${d.jeuMoteur ? d.jeuMoteur.nom : 'les jeux moteurs'} pour ne pas casser la dynamique.`,
        impactAttendu: "Dynamique commerciale prolongée sans rupture.",
        limites: "Une seule comparaison de période — pas encore une tendance confirmée sur plusieurs périodes.",
        confiance: 'Moyenne',
        cible: 'NEXUS-FDJ-Analyse-v1.html', impactEur: 0,
      });
    }

    return candidats;
  }

  // ------------------------------------------------------------
  // CONTINUITÉ DE LA CHAÎNE DE QUARTS — 13/08/2026, capture d'écran de
  // Frédéric : Samantha ouvre son quart du 13/08 Q1, NEXUS le compare au
  // 10/08 Q2 (dernier quart validé RETROUVÉ), mais 3 jours de quarts sont
  // manquants entre les deux (11/08 et 12/08 jamais comptés). Résultat :
  // 15 fausses alertes "stock initial modifié", une par jeu, alors que le
  // vrai problème est unique et en amont — la chaîne est interrompue, pas
  // les comptages de Samantha qui sont mal faits.
  //
  // Le calendrier FDJ a exactement 2 quarts fixes par jour, '1' puis '2'
  // (voir QUARTS_FDJ_JOUR dans nexus-fdj-analyse-donnees.js — même vérité,
  // jamais dupliquée). Pure fonction : aucune dépendance Supabase/DOM.
  // Consommée par NEXUS-FDJ-v1.html (avant de créer une alerte
  // stock_initial_modifie, à l'ouverture d'un quart) et par
  // NEXUS-FDJ-Manager-v1.html (pour afficher une alerte racine unique de
  // rupture plutôt que N alertes par jeu).
  // ------------------------------------------------------------
  function ajouterJoursIso(dateIso, n) {
    const d = new Date(`${dateIso}T00:00:00`);
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // Quart immédiatement précédent celui donné, dans le calendrier FDJ à 2
  // quarts/jour (Q2 -> Q1 même jour ; Q1 -> Q2 la veille).
  function quartPrecedentAttendu(date, quart) {
    return quart === '2' ? { date, quart: '1' } : { date: ajouterJoursIso(date, -1), quart: '2' };
  }

  // Quart immédiatement suivant celui donné (symétrique de quartPrecedentAttendu).
  function quartSuivant(date, quart) {
    return quart === '1' ? { date, quart: '2' } : { date: ajouterJoursIso(date, 1), quart: '1' };
  }

  function quartAvant(a, b) {
    return a.date !== b.date ? a.date < b.date : a.quart < b.quart;
  }

  // `quartTrouve` : { date, quart } du dernier quart VALIDÉ retrouvé avant
  // `quartActuel` (ou null si aucun quart précédent n'existe encore — premier
  // quart jamais compté, ce n'est pas une rupture). Retourne { rompue,
  // manquants } — manquants : liste ordonnée des { date, quart } strictement
  // entre les deux (bornes exclues). rompue = false et manquants = [] si les
  // deux quarts sont déjà consécutifs (chaîne intacte).
  function chaineContinuite(quartTrouve, quartActuel) {
    if (!quartTrouve) return { rompue: false, manquants: [] };
    const attendu = quartPrecedentAttendu(quartActuel.date, quartActuel.quart);
    if (quartTrouve.date === attendu.date && quartTrouve.quart === attendu.quart) {
      return { rompue: false, manquants: [] };
    }
    const manquants = [];
    let cur = quartSuivant(quartTrouve.date, quartTrouve.quart);
    let garde = 0; // sécurité anti-boucle infinie (jamais > ~2 ans de quarts manquants)
    while (quartAvant(cur, quartActuel) && garde < 2000) {
      manquants.push({ date: cur.date, quart: cur.quart });
      cur = quartSuivant(cur.date, cur.quart);
      garde++;
    }
    return { rompue: manquants.length > 0, manquants };
  }

  // ------------------------------------------------------------
  // APPRO NON TRACÉE — 13/08/2026, capture d'écran de Frédéric : après avoir
  // complété un quart FDJ ancien (rattrapage ou correction manager), l'écran
  // "État du stock" continuait d'afficher "OK" pour CASH alors qu'en réalité
  // 2 carnets de moins restaient en caisse non activée. Cause : l'appro
  // (compteur TICKETS, fdj_shift_counts) et les mouvements de stock
  // (compteur CARNETS, fdj_stock_movements) ne sont synchronisés que lors
  // d'une activation EN DIRECT (executerActivationCarnet, NEXUS-FDJ-v1.html)
  // — jamais quand un manager saisit ou corrige l'appro après coup
  // (enregistrerEdition, NEXUS-FDJ-Manager-v1.html n'écrit jamais dans
  // fdj_stock_movements). Périmètre validé avec Frédéric : détecter et
  // signaler honnêtement, jamais reconstruire ou deviner une activation à
  // sa place (voir NEXUS-Data-Dictionary-v2, v2.67) — un rejeu chronologique
  // complet (3 types d'événements, versions temporelles) reste un chantier
  // séparé, à cadrer si le besoin se confirme à l'usage.
  //
  // `shiftCounts` : [{shift_id, game_id, appro}] — uniquement les lignes
  // avec appro > 0 (à filtrer côté appelant). `mouvements` : lignes brutes
  // fdj_stock_movements (shift_id, game_id, type_mouvement). Un mouvement
  // 'activation' avec un shift_id donné pour un jeu donné "couvre" l'appro
  // de CE quart pour CE jeu — un rapprochement quantité-à-quantité serait
  // une fausse précision tant que la conversion tickets/carnet n'est pas
  // garantie sans reste (carnet entamé). Retourne { [game_id]:
  // approNonTraceTickets } — uniquement les jeux réellement concernés.
  // 13/08/2026 (v2, redesign écran État du stock) : extrait de
  // approNonTraceParJeu pour exposer aussi le détail ligne par ligne (quels
  // quarts précis sont non tracés, pas seulement le total par jeu) — utile
  // pour afficher "quart(s) concernés" dans le détail dépliable de l'écran,
  // sans dupliquer la logique de détection (Article 11). Retourne les
  // lignes `shiftCounts` filtrées, telles quelles (shift_id, game_id, appro).
  function lignesApproNonTracees(shiftCounts, mouvements) {
    const couverts = new Set();
    (mouvements || []).forEach(m => {
      if (m.type_mouvement === 'activation' && m.shift_id) couverts.add(`${m.shift_id}|${m.game_id}`);
    });
    return (shiftCounts || []).filter(c => {
      if (!c.appro || Number(c.appro) <= 0) return false;
      return !couverts.has(`${c.shift_id}|${c.game_id}`);
    });
  }

  function approNonTraceParJeu(shiftCounts, mouvements) {
    const total = {};
    lignesApproNonTracees(shiftCounts, mouvements).forEach(c => {
      total[c.game_id] = (total[c.game_id] || 0) + Number(c.appro);
    });
    return total;
  }

  global.NexusFdjMoteur = {
    calculerVentesJeu, ventesGrattageTotal, caisseGrattage, caisseAttendue, ecartCaisse,
    soldesCarnetsParJeu, soldeCarnetsJeu, soldesCarnetsAvecReference,
    calculerCandidatsFdj,
    quartPrecedentAttendu, quartSuivant, chaineContinuite,
    approNonTraceParJeu, lignesApproNonTracees,
  };
})(typeof window !== 'undefined' ? window : globalThis);
