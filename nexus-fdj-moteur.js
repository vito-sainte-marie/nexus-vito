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
  // RÈGLE DE PERMISSION — ÉCART DE CAISSE FDJ (16/08/2026, demande de
  // Frédéric) : "Voir : oui. Corriger avant validation : oui, avec
  // traçabilité. Modifier après validation : non. Régulariser après
  // validation : manager uniquement, sans effacer le constat d'origine."
  // "Validation" = le quart lui-même validé (transmis) par l'employé
  // (fdj_shifts.statut === 'valide'), pas la validation manager de la
  // caisse — une fois transmis, l'employé ne touche plus rien directement,
  // il ne peut plus que demander une correction (voir
  // NEXUS-FDJ-v1.html::soumettreDemandeCorrection, alerte tracée type
  // 'correction_caisse_demandee'). Source unique consommée par les deux
  // écrans (Article 11) plutôt que deux implémentations du même bout de
  // phrase.
  function permissionsEcartCaisseEmploye(shift) {
    const valide = !!(shift && shift.statut === 'valide');
    return { voir: true, corrigerDirectement: !valide, demanderCorrection: valide };
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
  // CONTINUITÉ DYNAMIQUE — 16/08/2026, demande de Frédéric : "Cette alerte
  // ne doit pas être persistée comme un statut définitif d'un quart. Elle
  // doit être calculée dynamiquement à partir de la chaîne chronologique
  // réelle." Constat qui a motivé ce lot : `previous_shift_id` (Étape 1,
  // 13/08/2026) n'est écrit qu'UNE SEULE fois, seulement si la chaîne
  // n'était pas rompue au moment où l'employé a ouvert son quart — si le
  // quart précédent était alors manquant, previous_shift_id reste NULL
  // pour toujours (aucun "replay" ne le comble rétroactivement, voir Étape
  // 4 du backlog Fiabilisation, pas encore construite). Un badge qui lit
  // cette colonne reste donc bloqué sur "rompue" même après que le quart
  // manquant a été complété. Cette fonction ne lit et n'écrit AUCUNE
  // colonne : elle recalcule la vérité à chaque appel, à partir de
  // `ensemble` (la liste des quarts déjà chargée par l'écran appelant,
  // aucune requête supplémentaire) — donc automatiquement à jour à chaque
  // rendu, sans "déclencheur" explicite à poser sur chaque action.
  //
  // Règle demandée, appliquée au SEUL quart immédiatement attendu avant
  // quartActuel (pas un scan arbitraire en arrière comme chaineContinuite,
  // qui répond à une question différente — voir plus haut) :
  //   - absent (aucun quart à ce jour+quart précis) → rompue
  //   - présent mais statut != 'valide' (encore brouillon) → rompue
  //   - présent et 'valide' → chaîne intacte
  // Exception : le tout premier quart jamais connu du site n'a rien à
  // attendre avant lui — détecté en cherchant si un SEUL quart, de
  // n'importe quel statut, existe avant quartActuel dans `ensemble` (pas
  // une liste figée en base, ce qui permet au tout premier quart réel de
  // ne jamais être signalé à tort).
  //
  // `quartActuel` = { id, date, quart }. `ensemble` = [{ id, date, quart,
  // statut }] tous les quarts connus du site, tous statuts confondus.
  // Retourne { rompue, motif } — motif = null | 'quart_manquant' |
  // 'quart_incomplet'.
  function chaineInterrompueDynamique(quartActuel, ensemble) {
    const liste = ensemble || [];
    const existeQuartAvant = liste.some(s => s.id !== quartActuel.id && quartAvant({ date: s.date, quart: s.quart }, quartActuel));
    if (!existeQuartAvant) return { rompue: false, motif: null };
    const attendu = quartPrecedentAttendu(quartActuel.date, quartActuel.quart);
    const candidat = liste.find(s => s.id !== quartActuel.id && s.date === attendu.date && s.quart === attendu.quart);
    if (!candidat) return { rompue: true, motif: 'quart_manquant' };
    if (candidat.statut !== 'valide') return { rompue: true, motif: 'quart_incomplet' };
    return { rompue: false, motif: null };
  }

  // CONTINUITÉ DE STOCK — 16/08/2026, demande de Frédéric : "si la chaîne
  // temporelle est restaurée mais que stock_final_quart_précédent !=
  // stock_initial_quart_suivant, remplacer l'alerte par une anomalie
  // spécifique de type Continuité de stock à vérifier, sans qualifier la
  // chaîne d'interrompue." N'a de sens que lorsque
  // chaineInterrompueDynamique(...).rompue est déjà false — comparer des
  // quarts qui ne se suivent pas n'aurait aucun sens (voir chaineContinuite
  // plus haut, même principe). Ne compare un jeu que si les DEUX valeurs
  // sont connues (jamais 0 par défaut, qui inventerait un écart ou un
  // faux "conforme"). Retourne la liste des jeux en écart, jamais un
  // simple booléen : chaque jeu en écart devient sa propre anomalie.
  function ecartsContinuiteStock(stockFinalPrecedentParJeu, stockInitialActuelParJeu) {
    const finMap = stockFinalPrecedentParJeu || {};
    const initMap = stockInitialActuelParJeu || {};
    const jeux = new Set([...Object.keys(finMap), ...Object.keys(initMap)]);
    const ecarts = [];
    jeux.forEach(gameId => {
      const f = finMap[gameId], i = initMap[gameId];
      if (f === undefined || f === null || i === undefined || i === null) return;
      if (Number(f) !== Number(i)) ecarts.push({ game_id: gameId, stock_final_precedent: Number(f), stock_initial_actuel: Number(i) });
    });
    return ecarts;
  }

  // AUTO vs À REVOIR — 16/08/2026, demande de Frédéric : une chaîne
  // rétablie ne signifie pas que les anciens écarts calculés pendant la
  // rupture sont automatiquement valides ; "résolution de l'alerte +
  // recalcul des données doivent être indissociables". Décision explicite
  // de Frédéric (question posée sur le cas le plus sensible — un quart déjà
  // validé par un manager avec un écart potentiellement faux) : "Recalculer
  // et réécrire automatiquement". Cette fonction pure trace la seule ligne
  // rouge qui reste, indépendante de cette décision : ne jamais réécrire
  // automatiquement une valeur qu'un humain a lui-même tapée/confirmée —
  // seules les valeurs encore "héritées automatiquement" (jamais touchées
  // par personne, voir fdj_shift_counts.stock_initial_auto) sont
  // propagées sans arbitrage. Sépare `ecarts` (sortie de
  // ecartsContinuiteStock) en deux lots :
  //   - `applicables` : stock_initial_auto === true sur le quart actuel
  //     pour ce jeu -> NEXUS peut corriger stock_initial + recalculer
  //     ventes/écart tout seul (voir reconcilierAlertesChaine).
  //   - `aRevoir` : stock_initial_auto !== true (false ou inconnu) -> flux
  //     inchangé, alerte 'continuite_stock_a_verifier' posée pour
  //     arbitrage manager.
  // `stockInitialAutoParJeu` : { [game_id]: boolean } du quart ACTUEL
  // uniquement (celui dont le stock_initial est en jeu, pas le précédent).
  function ecartsContinuiteAAppliquer(ecarts, stockInitialAutoParJeu) {
    const auto = stockInitialAutoParJeu || {};
    const applicables = [];
    const aRevoir = [];
    (ecarts || []).forEach(e => {
      if (auto[e.game_id] === true) applicables.push(e);
      else aRevoir.push(e);
    });
    return { applicables, aRevoir };
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
  // `referenceCreeLe` (14/08/2026, demande de Frédéric — voir "État du
  // stock FDJ, refonte lecture managériale") : ISO du dernier point zéro
  // certifié (fdj_stock_references.created_at), optionnel. Un appro non
  // tracé antérieur à ce point zéro est déjà absorbé dans le stock
  // physique certifié depuis — le laisser remonter indéfiniment dans
  // "⚠️ À rapprocher" mélange deux sujets très différents ("il faut
  // remettre un carnet en caisse" et "NEXUS ne parvient pas à
  // reconstruire proprement le mouvement historique") et fait perdre sa
  // valeur à l'alerte (observé : 20 jeux sur 29 en "à rapprocher" sur le
  // site pilote, tous antérieurs au point zéro du 13/08/2026). Sans
  // référence fournie (site jamais encore certifié), comportement
  // inchangé : rien n'est filtré. `shiftCounts` doit alors porter
  // `created_at` (déjà une colonne native de fdj_shift_counts) en plus de
  // shift_id/game_id/appro — à charger côté appelant.
  function lignesApproNonTracees(shiftCounts, mouvements, referenceCreeLe) {
    const couverts = new Set();
    (mouvements || []).forEach(m => {
      if (m.type_mouvement === 'activation' && m.shift_id) couverts.add(`${m.shift_id}|${m.game_id}`);
    });
    const seuil = referenceCreeLe ? new Date(referenceCreeLe).getTime() : null;
    return (shiftCounts || []).filter(c => {
      if (!c.appro || Number(c.appro) <= 0) return false;
      if (seuil !== null && c.created_at && new Date(c.created_at).getTime() <= seuil) return false; // absorbé dans le point zéro
      return !couverts.has(`${c.shift_id}|${c.game_id}`);
    });
  }

  function approNonTraceParJeu(shiftCounts, mouvements, referenceCreeLe) {
    const total = {};
    lignesApproNonTracees(shiftCounts, mouvements, referenceCreeLe).forEach(c => {
      total[c.game_id] = (total[c.game_id] || 0) + Number(c.appro);
    });
    return total;
  }

  // ------------------------------------------------------------
  // RÉCONCILIATION APPRO ↔ ACTIVATION, EN QUANTITÉ — 20/08/2026, demande
  // de Frédéric : "une quantité saisie en appro doit toujours être
  // rattachée à une activation existante ou provoquer la création d'une
  // activation manquante [...] il ne doit pas faire activation +100 puis
  // appro manuel +100, sinon tu comptes 200 tickets alors qu'un seul
  // carnet est entré en jeu."
  //
  // Distincte de `lignesApproNonTracees` ci-dessus, qui répond à une
  // question différente ("existe-t-il AU MOINS UNE activation pour ce
  // quart+jeu ?", présence seule) : cette fonction compare la QUANTITÉ.
  // Elle détecte donc aussi le cas que `lignesApproNonTracees` ne peut
  // pas voir — un appro EN EXCÈS alors qu'une activation existe déjà
  // (double comptage), pas seulement une activation totalement absente.
  //
  // `appro` : tickets saisis pour ce (shift, jeu). `carnetsActives` :
  // somme des `quantite` des mouvements type_mouvement='activation' pour
  // CE shift_id ET ce game_id (déjà filtrés par l'appelant — Article 11,
  // cette fonction ne sait pas interroger Supabase). `ticketsParCarnet` :
  // jeu.tickets_par_carnet, ou null si inconnu.
  //
  // Retourne { etat, appro, carnetsActives, ticketsActives, ecartTickets,
  // carnetsImpliques }. `etat` :
  //   'aucun_ecart'            — rien à faire, appro = 0 ou déjà couvert.
  //   'conditionnement_inconnu' — jeu sans tickets_par_carnet : "il ne
  //      faut surtout pas inventer une activation" (Frédéric) — jamais de
  //      confirmation proposée dans ce cas, l'appro reste tel quel.
  //   'appro_non_multiple'     — l'appro ne correspond à aucun nombre
  //      entier de carnets ("Appro = 130" avec des carnets de 100) —
  //      avertissement seul, aucune activation ne peut être déduite d'un
  //      reste.
  //   'appro_non_couvert'      — l'appro implique plus de carnets que
  //      d'activations enregistrées : cas central du retour de Frédéric,
  //      propose la création de `carnetsImpliques` activation(s)
  //      manquante(s), SOUS CONFIRMATION EXPLICITE (jamais silencieux).
  //   'appro_en_exces'         — l'inverse : plus d'activations que ce
  //      que l'appro justifie (le double-comptage à éviter) — signalé,
  //      jamais corrigé seul (NEXUS ne sait pas laquelle des deux saisies
  //      est en trop).
  function reconciliationApproActivation(appro, carnetsActives, ticketsParCarnet) {
    const approNum = Number(appro) || 0;
    const activesNum = Number(carnetsActives) || 0;
    if (approNum <= 0) return { etat: 'aucun_ecart', appro: approNum, carnetsActives: activesNum, ticketsActives: null, ecartTickets: 0, carnetsImpliques: 0 };
    if (!ticketsParCarnet) return { etat: 'conditionnement_inconnu', appro: approNum, carnetsActives: activesNum, ticketsActives: null, ecartTickets: null, carnetsImpliques: null };
    const ticketsParCarnetNum = Number(ticketsParCarnet);
    const ticketsActives = activesNum * ticketsParCarnetNum;
    if (approNum % ticketsParCarnetNum !== 0) {
      return { etat: 'appro_non_multiple', appro: approNum, carnetsActives: activesNum, ticketsActives, ecartTickets: approNum - ticketsActives, carnetsImpliques: null };
    }
    const carnetsAppro = approNum / ticketsParCarnetNum;
    if (carnetsAppro === activesNum) return { etat: 'aucun_ecart', appro: approNum, carnetsActives: activesNum, ticketsActives, ecartTickets: 0, carnetsImpliques: 0 };
    if (carnetsAppro > activesNum) return { etat: 'appro_non_couvert', appro: approNum, carnetsActives: activesNum, ticketsActives, ecartTickets: approNum - ticketsActives, carnetsImpliques: carnetsAppro - activesNum };
    return { etat: 'appro_en_exces', appro: approNum, carnetsActives: activesNum, ticketsActives, ecartTickets: approNum - ticketsActives, carnetsImpliques: activesNum - carnetsAppro };
  }

  // ------------------------------------------------------------
  // SYNCHRONISATION CONTRÔLÉE APPRO <-> ACTIVATION, côté correction MANAGER
  // a posteriori (27/08/2026, demande explicite de Frédéric, suite à sa
  // question sur `NEXUS-FDJ-Manager-v1.html`, écran "Modifier ce quart FDJ").
  //
  // Distinct de `reconciliationApproActivation` + `creerActivationImplicite`
  // (20/08/2026, `NEXUS-FDJ-v1.html`) qui ne couvrent que la clôture EN
  // DIRECT par l'employé, pendant le quart lui-même. Ici, le manager modifie
  // un quart déjà passé — v2.67 avait volontairement laissé ce cas de côté
  // ("détecter et signaler, jamais reconstruire ou deviner", chantier séparé
  // explicitement noté). Frédéric formalise maintenant la règle : "Appro est
  // la donnée de vente du quart. Activation est le mouvement de stock. Les
  // deux restent conceptuellement distincts, mais NEXUS doit les rapprocher
  // automatiquement et proposer une correction explicite lorsqu'ils se
  // contredisent." — jamais automatique, toujours sous confirmation
  // explicite du manager (même philosophie que le confirm() employé), et
  // jamais un écrasement silencieux d'une activation directement observée.
  //
  // Réutilise TEL QUEL `reconciliationApproActivation` (Article 11, aucune
  // deuxième fonction de comparaison quantité-à-quantité) — cette fonction
  // ajoute seulement la décision d'action et la distinction d'origine
  // (reconstituée par correction manager vs activation réellement observée),
  // que `reconciliationApproActivation` seule ne peut pas trancher puisqu'elle
  // ne reçoit qu'un total agrégé de carnets actifs, jamais le détail des
  // mouvements sous-jacents.
  //
  // `mouvementsQuart` : mouvements 'activation'/'correction' du quart+jeu
  // concerné (déjà chargés par l'appelant, Article 11 — jamais une requête
  // en plus ici, fonction pure). `methode_identification` de chaque
  // mouvement permet de savoir si l'excédent (cas 'appro_en_exces') provient
  // d'une activation RECONSTITUÉE par une précédente correction manager
  // (qu'on peut légitimement proposer d'annuler) ou d'une activation
  // réellement observée en direct par un employé ('quantite'/'scan'/
  // 'saisie_manuelle'/'implicite_appro' — jamais remise en cause
  // automatiquement, seulement signalée comme avant, voir
  // verifierReconciliationApproActivation côté employé).
  //
  // Retourne toujours un objet { action, ... } :
  //   - 'proposer_synchronisation' (etat 'appro_non_couvert') : `carnets`
  //     manquants à proposer de créer.
  //   - 'proposer_annulation' (etat 'appro_en_exces', excédent au moins
  //     partiellement couvert par une activation reconstituée) :
  //     `carnetsReconstitues` = quantité annulable (plafonnée à l'écart réel
  //     — jamais plus que ce que l'écart justifie, même si la reconstitution
  //     initiale était plus grande).
  //   - 'signaler_ecart_direct' (etat 'appro_en_exces' mais excédent
  //     entièrement porté par une activation directement observée) : jamais
  //     d'action automatique proposée, seulement un signalement (même
  //     comportement que l'existant côté employé).
  //   - 'aucune' (aucun_ecart, conditionnement_inconnu, appro_non_multiple —
  //     ce dernier reste un signalement passif, jamais une action, la
  //     quantité elle-même étant douteuse).
  function decisionSynchronisationApproActivation(reconciliation, mouvementsQuart) {
    if (!reconciliation) return { action: 'aucune' };
    if (reconciliation.etat === 'appro_non_couvert') {
      return { action: 'proposer_synchronisation', carnets: reconciliation.carnetsImpliques };
    }
    if (reconciliation.etat === 'appro_en_exces') {
      const reconstitue = (mouvementsQuart || [])
        .filter(m => m.methode_identification === 'reconstituee_correction_manager')
        .reduce((somme, m) => somme + Number(m.quantite || 0), 0);
      if (reconstitue > 0) {
        return { action: 'proposer_annulation', carnetsReconstitues: Math.min(reconstitue, reconciliation.carnetsImpliques) };
      }
      return { action: 'signaler_ecart_direct' };
    }
    return { action: 'aucune' };
  }

  // ------------------------------------------------------------
  // ROTATION / AUTONOMIE / TICKETS RESTANTS — 14/08/2026, demande de
  // Frédéric ("État du stock FDJ, refonte lecture managériale") : retrouver
  // le visuel opérationnel qu'il avait sur papier (stock caisse, rotation,
  // ce qui reste à vendre) sans jamais inventer un chiffre que NEXUS ne
  // peut pas réellement établir (Article 5). Même famille de calcul que
  // l'autonomie carburant (nexus-carburant-moteur.js) : stock disponible /
  // consommation moyenne récente = jours d'autonomie — transposée ici en
  // carnets/jour plutôt qu'en litres/jour.
  // ------------------------------------------------------------
  const FDJ_ROTATION_FENETRE_JOURS_DEFAUT = 30;
  const FDJ_SEUIL_AUTONOMIE_VIGILANCE_JOURS = 3;

  // Seuil "pas encore à la moitié du carnet" (14/08/2026, demande de
  // Frédéric : "si je ne suis pas arrivé à la moitié du carnet, même s'il
  // n'y a pas de carnet en caisse, ne me demande pas de réapprovisionner").
  // Règle simple et fixe pour l'instant, volontairement — Frédéric a lui-
  // même envisagé une évolution où NEXUS "apprend du roulement" propre à
  // chaque jeu (rotation réelle) et n'aurait plus besoin de ce seuil fixe
  // après une soixantaine de quarts consécutifs de données par jeu ; non
  // implémenté ici (aucune spécification du modèle d'apprentissage, aucun
  // historique encore assez profond sur le site pilote pour le valider) —
  // à cadrer séparément si le besoin se confirme à l'usage. Voir
  // `etatLigneStockV2` : ne s'applique QUE s'il existe un carnet en cours
  // identifiable (`solde.actives > 0` et tickets restants calculables) —
  // sans carnet en cours, rien ne dit qu'il reste du temps, donc pas
  // d'exception à la règle.
  const FDJ_SEUIL_FRACTION_CARNET_PAS_ENCORE_MOITIE = 0.5;

  // Carnets activés par jour en moyenne, sur une fenêtre bornée par le
  // dernier point zéro (jamais avant — les mouvements antérieurs sont déjà
  // absorbés dans la référence, les compter reviendrait à dupliquer une
  // activité déjà comptée ailleurs) ET par `fenetreJours`. Le nombre de
  // jours réellement écoulés sert de diviseur (jamais la fenêtre nominale
  // complète si le point zéro est plus récent qu'elle — même discipline que
  // chargerConsommationJournaliereMoyenne côté Carburants : ne jamais
  // diluer une moyenne par des jours qui n'existent pas encore). Retourne
  // un nombre >= 0, jamais null (0 activation sur la fenêtre est un fait,
  // pas une absence de donnée) — c'est à l'appelant (calculerAutonomieJeu)
  // de décider qu'une rotation nulle rend l'autonomie non calculable.
  // Limite connue (15/08/2026, non corrigée ici — hors périmètre de la
  // demande "tickets restants") : cette fonction compte des mouvements
  // 'activation' réels, donc peut sous-compter la rotation d'un jeu dont
  // un carnet reste en cours sans activation tracée après une
  // certification physique (même écart de modèle que documenté pour
  // ticketsRestantsCarnetEnCours) — à reprendre si l'usage montre que ça
  // fausse l'autonomie affichée.
  function rotationCarnetsJeu(mouvements, gameId, maintenant, fenetreJours, referenceCreeLe) {
    const fenetre = fenetreJours || FDJ_ROTATION_FENETRE_JOURS_DEFAUT;
    const maintenantMs = maintenant instanceof Date ? maintenant.getTime() : new Date(maintenant).getTime();
    const debutFenetreMs = maintenantMs - fenetre * 86400000;
    const referenceMs = referenceCreeLe ? new Date(referenceCreeLe).getTime() : null;
    const debutMs = referenceMs !== null ? Math.max(debutFenetreMs, referenceMs) : debutFenetreMs;
    let total = 0;
    (mouvements || []).forEach(m => {
      if (m.type_mouvement !== 'activation' || m.game_id !== gameId || !m.created_at) return;
      const t = new Date(m.created_at).getTime();
      if (t > debutMs && t <= maintenantMs) total += Number(m.quantite) || 0;
    });
    const joursEcoules = Math.max((maintenantMs - debutMs) / 86400000, 1);
    return total / joursEcoules;
  }

  // Tickets restants dans le carnet actuellement en cours, pour un jeu.
  // 15/08/2026 (v2) : source RECONSTRUITE — demande de Frédéric après
  // vérification en direct de l'écran ("les tickets en cours doivent être
  // pris du stock de fin de la dernière caisse [...] de Loanne"). Ancienne
  // version : reconstruction indirecte à partir de la dernière activation
  // trouvée dans fdj_stock_movements, puis somme des ventes depuis cette
  // date. Deux défauts, tous deux constatés en usage réel sur BANCO 1€ :
  // (1) une activation antérieure au point zéro pouvait remonter un total
  // périmé (corrigé une première fois le 15/08 par un filtre sur
  // referenceCreeLe — toujours insuffisant, voir (2)) ; (2) même filtrée,
  // cette approche reste aveugle à un carnet réellement entamé mais dont
  // l'activation n'a jamais été (re)tracée comme mouvement après une
  // certification physique — le comptage physique d'un point zéro capture
  // un TOTAL de carnets en caisse (`caisse_reel`), jamais "combien sont en
  // cours de vente" : sur BANCO 1€, la certification du 13/08 au soir a
  // enregistré 0 carnet en caisse, alors que le comptage de quart suivant
  // (14/08 08h59, Samantha) démarrait déjà à 136/150 tickets — carnet
  // manifestement déjà entamé, jamais compté comme "actif" par le système
  // de mouvements. **Nouvelle source, directe et fiable** : le
  // `stock_final` du DERNIER comptage de quart enregistré pour ce jeu
  // (`fdj_shift_counts`) — un chiffre physiquement compté par l'employé à
  // chaque quart, jamais recalculé ni sujet au même écart de modèle.
  // Retourne null — jamais 0 par défaut — si aucun comptage de quart
  // n'existe encore pour ce jeu, ou si tickets_par_carnet est inconnu
  // (jeu non encore répertorié dans la planche FDJ). Plancher à 0 si la
  // valeur enregistrée était négative (ne devrait jamais arriver en usage
  // normal, mais jamais restitué en négatif).
  function ticketsRestantsCarnetEnCours(shiftCounts, gameId, ticketsParCarnet) {
    if (!ticketsParCarnet) return null;
    let dernier = null;
    (shiftCounts || []).forEach(c => {
      if (c.game_id !== gameId || !c.created_at || c.stock_final === null || c.stock_final === undefined) return;
      if (!dernier || new Date(c.created_at) > new Date(dernier.created_at)) dernier = c;
    });
    if (!dernier) return null;
    return Math.max(Number(dernier.stock_final) || 0, 0);
  }

  // Combine solde (carnets en caisse non activés) + fraction du carnet en
  // cours (tickets restants / tickets par carnet) en un stock disponible
  // en équivalent-carnets, puis en jours d'autonomie via la rotation
  // moyenne. `jours: null` avec `motif` explicite si non calculable —
  // jamais une estimation fabriquée à partir d'une rotation nulle/inconnue.
  function calculerAutonomieJeu({ solde, ticketsRestants, ticketsParCarnet, rotationCarnetsJour }) {
    const nonActives = (solde && solde.nonActives) || 0;
    const fractionEnCours = (ticketsParCarnet && ticketsRestants != null) ? ticketsRestants / ticketsParCarnet : 0;
    const stockDisponibleCarnets = nonActives + fractionEnCours;
    if (!rotationCarnetsJour || rotationCarnetsJour <= 0) {
      return { jours: null, stockDisponibleCarnets, motif: 'rotation_inconnue' };
    }
    return { jours: Math.round((stockDisponibleCarnets / rotationCarnetsJour) * 10) / 10, stockDisponibleCarnets, motif: null };
  }

  // ------------------------------------------------------------
  // ÉTAT DE LIGNE — V2 (14/08/2026) — sépare strictement deux axes que
  // l'ancienne etatLigneStock() mélangeait dans un même bucket "vigilance"
  // (couleur différente sur la ligne, mais même filtre) : le stock réel
  // (0 carnet en caisse = agir MAINTENANT) et la traçabilité (appro non
  // rapproché = NEXUS ne sait pas encore, indépendant du niveau de stock).
  // Priorité : un rapprochement en attente prime toujours (les chiffres de
  // stock ne sont pas fiables tant qu'il n'est pas résolu) — inchangé par
  // rapport à l'ancienne version, juste renommé/étendu.
  //   - 'reapprovisionner' (🔴) : plus rien en caisse non activée ET le
  //     carnet en cours (s'il y en a un identifiable) est déjà entamé au-
  //     delà de sa moitié — voir FDJ_SEUIL_FRACTION_CARNET_PAS_ENCORE_MOITIE.
  //     Le libellé distingue "Rupture totale" (rien nulle part, y compris
  //     le bureau) de "Réapprovisionner" (une réserve existe au bureau, il
  //     suffit de la redescendre) — même donnée, deux degrés d'urgence.
  //   - 'vigilance' (🟠) : soit une réserve existe en caisse mais rien
  //     n'est actuellement en cours de vente (`solde.actives <= 0`, entre
  //     deux carnets) OU l'autonomie estimée est courte
  //     (FDJ_SEUIL_AUTONOMIE_VIGILANCE_JOURS) quand elle est calculable ;
  //     soit rien en caisse non activée MAIS le carnet en cours n'a pas
  //     encore atteint sa moitié (14/08/2026, demande de Frédéric : "si je
  //     ne suis pas arrivé à la moitié du carnet, même s'il n'y a pas de
  //     carnet en caisse, ne me demande pas de réapprovisionner" — il
  //     reste du temps, pas la peine d'alarmer, mais l'absence de réserve
  //     mérite quand même d'être visible plutôt que masquée en 🟢 OK).
  //   - 'ok' (🟢) : le reste.
  function etatLigneStockV2(solde, approNonTrace, ticketsParCarnet, ticketsRestants, autonomie) {
    if (approNonTrace > 0) {
      const carnetsEstimes = ticketsParCarnet ? Math.floor(approNonTrace / ticketsParCarnet) : null;
      return { statut: 'rapprocher', couleur: 'ambre', badge: '⚠️ À rapprocher', rapprochement: true, carnetsEstimes, approNonTrace };
    }
    const s = solde || { bureau: 0, actives: 0, nonActives: 0 };
    // 15/08/2026 : signal unique "un carnet est actuellement en cours de
    // vente" — priorité au dernier comptage de quart réel (ticketsRestants,
    // cf. ticketsRestantsCarnetEnCours) sur le solde de mouvements carnet
    // (solde.actives), qui peut être aveugle à un carnet déjà entamé avant
    // une certification physique (celle-ci ne capture qu'un TOTAL de
    // carnets en caisse, jamais "combien sont en cours" — écart de modèle
    // confirmé sur BANCO 1€, cf. commentaire de ticketsRestantsCarnetEnCours).
    // solde.actives ne sert plus de repli que si ticketsRestants est
    // lui-même inconnu (aucun comptage de quart, ou tickets_par_carnet non
    // répertorié — rien d'autre à évaluer dans ce cas).
    const carnetEnCoursConnu = ticketsRestants != null ? ticketsRestants > 0 : s.actives > 0;
    if (s.nonActives <= 0) {
      const carnetEnCoursPasEncoreMoitie = carnetEnCoursConnu && ticketsParCarnet && ticketsRestants != null
        && (ticketsRestants / ticketsParCarnet) > FDJ_SEUIL_FRACTION_CARNET_PAS_ENCORE_MOITIE;
      if (carnetEnCoursPasEncoreMoitie) {
        return { statut: 'vigilance', couleur: 'ambre', badge: '🟠 Vigilance' };
      }
      const rupture = s.bureau <= 0;
      return { statut: 'reapprovisionner', couleur: 'rouge', badge: rupture ? '🔴 Rupture totale' : '🔴 Réapprovisionner' };
    }
    const autonomieCourte = autonomie && autonomie.jours !== null && autonomie.jours <= FDJ_SEUIL_AUTONOMIE_VIGILANCE_JOURS;
    if (!carnetEnCoursConnu || autonomieCourte) {
      return { statut: 'vigilance', couleur: 'ambre', badge: '🟠 Vigilance' };
    }
    return { statut: 'ok', couleur: 'vert', badge: '🟢 OK' };
  }

  // Phrase de synthèse par palier de prix (14/08/2026) : évite de faire
  // relire ligne par ligne un palier entier quand tout va bien, et nomme
  // explicitement ce qui ne va pas sinon. `items` : [{ jeu:{nom}, etat }],
  // etat = sortie de etatLigneStockV2. Ne mentionne jamais les jeux en
  // 'rapprocher' (axe traçabilité, volontairement hors de cette phrase —
  // consigne de Frédéric : ne jamais mélanger les deux sujets).
  function phraseFamillePalier(items) {
    const aReapprovisionner = items.filter(x => x.etat.statut === 'reapprovisionner');
    const vigilance = items.filter(x => x.etat.statut === 'vigilance');
    if (!aReapprovisionner.length && !vigilance.length) return 'Tous les jeux de ce palier sont couverts.';
    const phrases = [];
    aReapprovisionner.forEach(x => phrases.push(`🔴 ${x.jeu.nom} n'a aucun carnet en caisse.`));
    vigilance.forEach(x => phrases.push(`🟠 ${x.jeu.nom} est à surveiller.`));
    const couverts = items.length - aReapprovisionner.length - vigilance.length;
    if (couverts > 0) phrases.push(couverts === 1 ? 'Le reste est couvert.' : 'Le reste est couvert.');
    return phrases.join(' ');
  }

  // Synthèse globale (bandeau haut d'écran, 14/08/2026) : totaux + une
  // seule recommandation d'action, dérivée exclusivement de faits déjà
  // connus (jamais une supposition sur les habitudes du site) — descendre
  // au bureau les jeux en 'reapprovisionner' pour lesquels une réserve
  // existe réellement (`solde.bureau > 0`), jamais pour ceux en rupture
  // totale (rien à descendre). `jeux` : [{id, nom}], `etats` : {
  // [game_id]: etatLigneStockV2(...) }, `soldes` : { [game_id]: solde }.
  function syntheseGlobaleFdjStock(jeux, etats, soldes) {
    const compte = { tous: jeux.length, ok: 0, vigilance: 0, reapprovisionner: 0, rapprocher: 0 };
    let carnetsDisponiblesCaisse = 0;
    jeux.forEach(j => {
      compte[etats[j.id].statut]++;
      const s = soldes[j.id];
      if (s && s.nonActives > 0) carnetsDisponiblesCaisse += s.nonActives;
    });
    const aRedescendre = jeux.filter(j => etats[j.id].statut === 'reapprovisionner' && soldes[j.id] && soldes[j.id].bureau > 0);
    const recommandation = aRedescendre.length
      ? `Descendre ${aRedescendre.length === 1 ? '1 carnet' : `${aRedescendre.length} carnets`} du bureau : ${aRedescendre.map(j => j.nom).join(', ')}.`
      : null;
    return { compte, carnetsDisponiblesCaisse, recommandation };
  }

  // ------------------------------------------------------------
  // RÈGLE D'ACCÈS AUX QUARTS — 13/08/2026, spécification de Frédéric
  // ("Règle d'accès aux quarts FDJ — V1") : un quart devient accessible 30
  // minutes avant son heure officielle (paramétrable par station, déjà lue
  // depuis station_config.horaires.quart1/quart2.normal — jamais une
  // constante JS, voir NEXUS-FDJ-v1.html::quartDuMoment). Dès qu'un employé
  // s'engage réellement dans un quart (validation du stock de départ), ce
  // quart est verrouillé pour lui pour le reste de la journée — l'autre
  // devient inaccessible sans dérogation manager tracée (voir
  // fdj_employee_shift_locks, Data Dictionary v2.72). Pure fonction : le
  // verrou lui-même (`verrou`) est fourni par l'appelant (déjà chargé
  // depuis Supabase), jamais interrogé ici.
  //
  // `horaireDebutHHMM` : chaîne "HH:MM" | null/undefined si l'horaire de ce
  // quart n'est pas connu pour ce site — dans ce cas la fenêtre horaire
  // n'est jamais bloquante (vérité avant certitude : NEXUS ne verrouille
  // jamais sur une donnée qu'il n'a pas).
  function minutesDepuisMinuit(hhmm) {
    if (!hhmm) return null;
    const [h, m] = String(hhmm).split(':').map(Number);
    if (Number.isNaN(h)) return null;
    return h * 60 + (Number.isNaN(m) ? 0 : m);
  }

  function quartDansFenetreAcces(minutesMaintenant, horaireDebutHHMM, fenetreAvantMin) {
    const debut = minutesDepuisMinuit(horaireDebutHHMM);
    if (debut === null || minutesMaintenant === null || minutesMaintenant === undefined) return true;
    const fenetre = (fenetreAvantMin === null || fenetreAvantMin === undefined) ? 30 : fenetreAvantMin;
    return minutesMaintenant >= debut - fenetre;
  }

  // `verrou` : { quart, locked_at, source_lock, ... } | null — le verrou du
  // jour pour CET employé (au plus une ligne par employé et par jour, voir
  // la contrainte UNIQUE(employee_id, date_service)). Retourne
  // { accessible, motif } avec motif = null | 'verrouille_autre_quart' |
  // 'hors_fenetre'. Le verrou prime toujours sur la fenêtre horaire : un
  // quart verrouillé sur cet employé reste accessible même hors fenêtre
  // (elle a déjà commencé son quart), mais l'AUTRE quart lui reste fermé
  // même s'il entre dans sa propre fenêtre.
  function evaluerAccesQuart(quart, minutesMaintenant, horaireDebutHHMM, fenetreAvantMin, verrou) {
    if (verrou && verrou.quart !== quart) {
      return { accessible: false, motif: 'verrouille_autre_quart' };
    }
    if (verrou && verrou.quart === quart) {
      return { accessible: true, motif: null };
    }
    if (!quartDansFenetreAcces(minutesMaintenant, horaireDebutHHMM, fenetreAvantMin)) {
      return { accessible: false, motif: 'hors_fenetre' };
    }
    return { accessible: true, motif: null };
  }

  // ------------------------------------------------------------
  // MOTEUR D'INTÉGRITÉ FDJ — 13/08/2026, Étape 1 de l'audit de fiabilisation
  // ("NEXUS_FDJ_Audit_Fiabilisation_Chaine_Quarts.pdf", §11/§14 : chaque
  // écran doit pouvoir afficher un niveau de confiance unique — OK /
  // PARTIELLE / ROMPUE — plutôt que de laisser chaque écran retrouver ou
  // interpréter lui-même les signaux de rupture. Ne remplace aucun moteur
  // métier existant : compose seulement des signaux déjà calculés ailleurs
  // (chaineContinuite pour la rupture de chaîne, déjà en place depuis plus
  // tôt le 13/08/2026 ; a_revoir et le statut de fdj_cash_controls pour la
  // validation manager) en une seule sortie normalisée. Volontairement une
  // pure fonction : tous les signaux sont fournis par l'appelant, jamais
  // interrogés ici.
  //
  // `signaux` = {
  //   rompue: bool — sortie de chaineInterrompueDynamique(...).rompue pour
  //     ce quart (16/08/2026 : plus jamais depuis previous_shift_id figé),
  //   stockAVerifier: bool — 16/08/2026, une anomalie continuite_stock_a_verifier
  //     est active pour ce quart (chaîne intacte, mais stock_final du
  //     précédent ≠ stock_initial saisi ici),
  //   aRevoir: bool — fdj_shifts.a_revoir de ce quart,
  //   validationManagerFaite: bool | null — true si fdj_cash_controls.statut
  //     de ce quart est déjà 'conforme'/'valide_avec_ecart'/'regularise'
  //     (donc autre chose que 'provisoire' ou absent) ; null si aucun
  //     contrôle de caisse n'existe encore pour ce quart (pas encore
  //     clôturé — ne compte pas comme un défaut de confiance, juste "pas
  //     encore là").
  // }
  // Retourne { integrite: 'OK'|'PARTIELLE'|'ROMPUE', motif } — motif = null
  // | 'quart_manquant' | 'continuite_stock_a_verifier' | 'a_revoir' |
  // 'validation_manager_attendue'. rompue reste prioritaire (un vrai trou
  // dans la chaîne prime sur tout le reste), stockAVerifier ensuite (une
  // chaîne intacte mais un stock qui ne recolle pas mérite un œil, mais ce
  // n'est jamais qualifié de "chaîne interrompue" — demande explicite de
  // Frédéric).
  function etatIntegriteFdj(signaux) {
    const s = signaux || {};
    if (s.rompue) return { integrite: 'ROMPUE', motif: 'quart_manquant' };
    if (s.stockAVerifier) return { integrite: 'PARTIELLE', motif: 'continuite_stock_a_verifier' };
    if (s.aRevoir) return { integrite: 'PARTIELLE', motif: 'a_revoir' };
    if (s.validationManagerFaite === false) return { integrite: 'PARTIELLE', motif: 'validation_manager_attendue' };
    return { integrite: 'OK', motif: null };
  }

  // ------------------------------------------------------------
  // TRACE DE CONTRÔLE FDJ — 16/08/2026, demande de Frédéric : "je créerais
  // [...] une fiche de clôture immuable [...] Le point le plus important est
  // justement la conservation de deux niveaux : Situation au moment où
  // l'employé valide, puis, s'il y a intervention ensuite : Situation après
  // régularisation manager." Chaque version posée dans fdj_releves_cloture
  // est un snapshot complet, jamais réécrit — ces deux fonctions PURES
  // (Article 11, une seule vérité) calculent le statut et le différentiel
  // affiché entre deux versions, consommées à la fois par l'écran employé
  // (validation, version 1, jamais de diff) et l'écran manager
  // (régularisation, version 2+, diff obligatoire).
  // ------------------------------------------------------------

  // Statut d'une version du relevé de clôture (corrigé le 16/08/2026,
  // sécurisation structurelle demandée par Frédéric, point 1 : "Ne plus
  // déduire `regularise` simplement de `version_num > 1`. Une version
  // `recalcul_automatique_chaine` n'est pas une régularisation manager.")
  // — le statut reflète maintenant QUI/QUOI a produit la version
  // (`typeVersion`), jamais seulement sa position dans la séquence :
  //   - 'regularisation_manager' -> toujours 'regularise' (le fait qu'il y
  //     ait EU une intervention humaine reste tracé, même à écart nul) ;
  //   - 'recalcul_automatique_chaine' -> 'recalcule_automatiquement' (un
  //     acteur système, jamais un jugement manager) ;
  //   - 'validation_employe' (ou type absent/inconnu, jamais un blocage) ->
  //     'conforme' si l'écart est nul, 'valide_avec_ecart' sinon, un simple
  //     constat chiffré. `versionNum` n'intervient plus dans ce calcul —
  //     conservé en paramètre pour ne pas casser la signature des 3 sites
  //     d'appel existants.
  // "Caractère" du relevé (16/08/2026, demande de Frédéric, revu le même
  // jour — sécurisation point 2 : "Séparer chaine_interrompue et
  // continuite_stock_a_verifier. Les deux peuvent rendre un relevé
  // provisoire mais ne doivent pas être enregistrés comme la même
  // anomalie.") — dimension SÉPARÉE du statut (qui parle de l'écart) :
  // parle de la CONFIANCE dans les données au moment du snapshot.
  // `provisoire` si la chaîne de continuité est rompue OU si une anomalie
  // de stock reste à vérifier sur ce quart (les deux causes restent
  // distinctes dans `anomalie_chaine`, voir call sites — cette fonction ne
  // fait que les COMBINER pour la seule question "peut-on faire confiance
  // à ce snapshot ?", jamais les fusionner en une même anomalie stockée).
  function caractereRelevecloture({ chaineInterrompue, continuiteStockAVerifier } = {}) {
    return (chaineInterrompue || continuiteStockAVerifier) ? 'provisoire' : 'definitif';
  }

  function statutRelevecloture(versionNum, ecart, typeVersion) {
    if (typeVersion === 'regularisation_manager') return 'regularise';
    if (typeVersion === 'recalcul_automatique_chaine') return 'recalcule_automatiquement';
    return (ecart === null || ecart === undefined || ecart === 0) ? 'conforme' : 'valide_avec_ecart';
  }

  // Différentiel entre deux versions successives d'un même quart — ex.
  // "stock initial CASH 24 → 23, écart +5,00€ → 0,00€". Ne retient QUE les
  // champs qui ont réellement changé (jamais un diff bruyant listant tout).
  // `precedent`/`nouveau` : objets au même format que les colonnes de
  // fdj_releves_cloture (stock_initial_par_jeu, ecart, caisse_reelle, etc.).
  // Retourne null si rien n'a changé ou s'il n'y a pas de version précédente
  // (première validation employé — jamais de diff contre du vide).
  function diffClotureFdj(precedent, nouveau) {
    if (!precedent) return null;
    const diff = {};
    const champsSimples = ['ventes_grattage_valeur', 'lots_payes_grattage', 'caisse_tirages', 'regularisations', 'caisse_attendue', 'caisse_reelle', 'ecart', 'statut'];
    champsSimples.forEach(champ => {
      const avant = precedent[champ] === undefined ? null : precedent[champ];
      const apres = nouveau[champ] === undefined ? null : nouveau[champ];
      if (avant !== apres) diff[champ] = { avant, apres };
    });
    const champsParJeu = ['stock_initial_par_jeu', 'appro_par_jeu', 'stock_final_par_jeu'];
    champsParJeu.forEach(champ => {
      const avantMap = precedent[champ] || {};
      const apresMap = nouveau[champ] || {};
      const jeuxTouches = new Set([...Object.keys(avantMap), ...Object.keys(apresMap)]);
      const parJeu = {};
      jeuxTouches.forEach(gameId => {
        const avant = avantMap[gameId] === undefined ? null : avantMap[gameId];
        const apres = apresMap[gameId] === undefined ? null : apresMap[gameId];
        if (avant !== apres) parJeu[gameId] = { avant, apres };
      });
      if (Object.keys(parJeu).length) diff[champ] = parJeu;
    });
    return Object.keys(diff).length ? diff : null;
  }

  // ============================================================
  // FDJ Fiabilisation — Étape 2 : versionnage des corrections de stock +
  // propagation automatique + repassage a_revoir + alerte manager (cahier
  // `NEXUS_FDJ_Audit_Fiabilisation_Chaine_Quarts.pdf`, désigné par Frédéric
  // lui-même dans le cadrage de l'Étape 1 comme "le vrai cœur du risque
  // signalé"). Jusqu'ici, `ecartsContinuiteAAppliquer` ne traitait que la
  // reconstruction APRÈS rétablissement d'une chaîne rompue
  // (`reconcilierAlertesChaine`, Continuité FDJ v2, 16-18/08) — mais une
  // régularisation manager directe sur un quart déjà lié à son suivant
  // (`enregistrerEdition`, écran "Modifier ce quart FDJ") ne déclenchait
  // AUCUNE propagation ni alerte : le stock_initial du quart suivant
  // pouvait rester silencieusement incohérent avec le nouveau stock_final
  // corrigé. Cette fonction comble précisément ce trou, en respectant la
  // même ligne rouge que `ecartsContinuiteAAppliquer` : ne jamais réécrire
  // automatiquement une valeur de stock_initial qu'un humain a déjà
  // confirmée sur le quart suivant.
  // ============================================================

  // `corrections` : liste de { game_id, nouvelle_valeur } — uniquement les
  // jeux dont le stock_final du quart corrigé a RÉELLEMENT changé (jamais
  // un signal sur une valeur identique, Article 5 — c'est à l'appelant de
  // ne fournir ici que les jeux effectivement modifiés). `contexteSuivant` :
  // map game_id -> { stock_initial, stock_initial_auto } du quart
  // immédiatement suivant, tel que chargé par l'appelant (ou absent si ce
  // quart n'a pas encore de ligne pour ce jeu — rien à propager pour
  // l'instant, pas une erreur). Retourne :
  //  - `applicables` : au format attendu par
  //    `appliquerCorrectionsAutomatiquesContinuite` ({ game_id,
  //    stock_final_precedent }) — stock_initial du quart suivant encore
  //    hérité automatiquement (stock_initial_auto===true), jamais touché
  //    par un humain, propagation sûre.
  //  - `aRevoir` : au format attendu par l'insertion `fdj_alertes` de type
  //    `continuite_stock_a_verifier` ({ game_id, valeur_quart_precedent,
  //    valeur_saisie }) — stock_initial du quart suivant déjà confirmé par
  //    un humain ET réellement différent de la nouvelle valeur corrigée
  //    (si la valeur humaine coïncide déjà avec la correction, aucune
  //    alerte n'est levée — jamais une fausse alarme sur une coïncidence).
  function propagationCorrectionStock(corrections, contexteSuivant) {
    const liste = corrections || [];
    const contexte = contexteSuivant || {};
    const applicables = [];
    const aRevoir = [];
    liste.forEach(c => {
      if (c.game_id === undefined || c.game_id === null) return;
      const ctx = contexte[c.game_id];
      if (!ctx) return; // le quart suivant n'a pas encore de ligne pour ce jeu -> rien à propager pour l'instant
      if (ctx.stock_initial_auto === true) {
        applicables.push({ game_id: c.game_id, stock_final_precedent: c.nouvelle_valeur });
      } else if (ctx.stock_initial !== c.nouvelle_valeur) {
        aRevoir.push({ game_id: c.game_id, valeur_quart_precedent: c.nouvelle_valeur, valeur_saisie: ctx.stock_initial });
      }
    });
    return { applicables, aRevoir };
  }

  // ============================================================
  // FDJ Fiabilisation — Étape 3 : boîte d'exceptions manager (cahier
  // `NEXUS_FDJ_Audit_Fiabilisation_Chaine_Quarts.pdf`, §12 — "Le manager ne
  // doit pas chercher les incohérences jeu par jeu. NEXUS doit regrouper
  // les causes racines."). Fonction PURE d'agrégation uniquement — ne
  // détecte rien elle-même, ne fait que regrouper des signaux déjà
  // calculés/chargés ailleurs (Article 11) :
  //  - correctionsRetroactives : union (déjà faite par l'appelant) des
  //    alertes 'stock_initial_modifie' encore ouvertes et des quarts
  //    a_revoir=true (posés par propagationCorrectionStock, Étape 2) —
  //    dans les deux cas "une valeur de stock a changé, un manager doit
  //    vérifier/valider avant de faire confiance à ce qui en dépend".
  //  - quartsManquants : alertes 'chaine_interrompue' encore ouvertes
  //    (chaineInterrompueDynamique).
  //  - carnetsARapprocher : jeux dont approNonTraceParJeu > 0 — même
  //    détection que le badge "⚠️ À rapprocher" de l'écran État du stock
  //    (etatLigneStockV2).
  //  - ecartsRecalcules : relevés de clôture 'recalcul_automatique_chaine'
  //    (statutRelevecloture) pas encore marqués revalidés par un manager.
  //  - replaysRequis : vide tant que needs_replay (Étape 4) n'existe pas —
  //    le type reste dans la synthèse pour ne pas retoucher cette fonction
  //    quand l'Étape 4 arrivera.
  // `signaux` : { correctionsRetroactives, quartsManquants,
  // carnetsARapprocher, ecartsRecalcules, replaysRequis } — chaque clé
  // attend un tableau (vide si absent, jamais une exception, Article 5).
  function syntheseExceptionsManager(signaux) {
    const s = signaux || {};
    const categorie = (cle, libelleUn, libellePlusieurs) => {
      const items = s[cle] || [];
      return { cle, count: items.length, items, libelle: items.length <= 1 ? libelleUn : libellePlusieurs };
    };
    const categories = [
      categorie('correctionsRetroactives', 'correction rétroactive', 'corrections rétroactives'),
      categorie('quartsManquants', 'quart manquant', 'quarts manquants'),
      categorie('carnetsARapprocher', 'carnet à rapprocher', 'carnets à rapprocher'),
      categorie('ecartsRecalcules', 'écart recalculé', 'écarts recalculés'),
      categorie('replaysRequis', 'replay requis', 'replays requis'),
    ];
    const total = categories.reduce((acc, c) => acc + c.count, 0);
    const parties = categories.filter(c => c.count > 0).map(c => `${c.count} ${c.libelle}`);
    const phrase = total === 0 ? "Aucune exception à vérifier aujourd'hui." : `À vérifier aujourd'hui : ${parties.join(' - ')}.`;
    return { total, categories, phrase };
  }

  // ============================================================
  // F2 "Caisse réelle" (20/08/2026, cahier "NEXUS FDJ — Audit de
  // consolidation", §4) — vue manager jour/semaine. Même règle que partout
  // ailleurs dans FDJ depuis F1 : le statut du QUART (fdj_shifts.statut)
  // prime toujours sur le statut de la CAISSE (fdj_cash_controls.statut)
  // — un quart encore 'brouillon' n'entre jamais dans un total, même si
  // une caisse a déjà été notée dessus (voir aussi la vue SQL
  // view_fdj_shift_facts.caisse_comptabilisable, même formule côté
  // serveur, Article 11 — deux implémentations indépendantes de la MÊME
  // règle, jamais un total qui recalcule différemment côté client).
  // `shift` : { statut, cash: { statut, caisse_reelle, ... } | null } | null.
  function caisseComptabilisableQuart(shift) {
    return !!(shift && shift.statut === 'valide' && shift.cash && shift.cash.statut && shift.cash.statut !== 'provisoire');
  }

  // Ce qu'une cellule Q1/Q2 doit afficher pour un quart donné.
  // `etat` : 'absent' (quart jamais ouvert) | 'brouillon' (ouvert, pas
  // transmis) | 'en_attente' (transmis, caisse pas encore contrôlée par le
  // manager) | 'comptabilise' (transmis + contrôlé, montant fiable).
  function quartCaisseReelleCellule(shift) {
    if (!shift) return { etat: 'absent', montant: null };
    if (shift.statut !== 'valide') return { etat: 'brouillon', montant: null };
    if (!caisseComptabilisableQuart(shift)) return { etat: 'en_attente', montant: null };
    return { etat: 'comptabilise', montant: shift.cash.caisse_reelle };
  }

  // État d'une journée pour la vue semaine. `quarts` = tableau des shifts
  // attendus ce jour (ex. [q1, q2], null pour un quart jamais ouvert).
  // 'a_venir' si la date est dans le futur (rien à attendre) ; 'controle'
  // si TOUS les quarts attendus sont comptabilisables ; 'a_terminer' sinon
  // (au moins un quart manquant, brouillon, ou caisse pas encore
  // contrôlée) — jamais un jour présenté "Contrôlé" sur la foi d'un seul
  // quart quand deux sont attendus (Article 5, pas de fausse précision).
  function etatJourCaisseReelle(quarts, dateStr, aujourdhuiStr) {
    if (dateStr > aujourdhuiStr) return 'a_venir';
    if ((quarts || []).length && quarts.every(caisseComptabilisableQuart)) return 'controle';
    return 'a_terminer';
  }

  // Total "Caisse réelle du jour" : somme des quarts comptabilisables
  // UNIQUEMENT si TOUS les quarts attendus le sont — sinon `null` (jamais
  // une somme partielle présentée comme le total du jour, Article 5). Le
  // mockup du cahier affiche alors "Non consolidée" plutôt qu'un chiffre.
  function totalJourCaisseReelle(quarts) {
    if (!(quarts || []).length || !quarts.every(caisseComptabilisableQuart)) return null;
    return quarts.reduce((somme, q) => somme + Number(q.cash.caisse_reelle || 0), 0);
  }

  // ============================================================
  // F3 "Comparabilité" (20/08/2026, cahier "NEXUS FDJ — Audit de
  // consolidation", §5) — "Le moteur doit comparer uniquement des fenêtres
  // homologues et clôturées." Exemple du cahier : si jeudi est en cours,
  // comparer lundi+mardi+mercredi de cette semaine à lundi+mardi+mercredi
  // de la semaine précédente — jamais une semaine partielle contre une
  // semaine complète (source des évolutions "-60 %"/"-78,6 %" citées dans
  // l'audit). La journée en cours reste visible dans l'écran opérationnel
  // (§5 : "reste visible... mais ne participe ni à l'évolution ni à la
  // courbe comparative") — cette fonction ne filtre QUE ce qui alimente
  // une évolution, jamais les totaux bruts affichés par ailleurs.
  // ------------------------------------------------------------
  // Même hypothèse que F2 (etatJourCaisseReelle/totalJourCaisseReelle) :
  // 2 quarts attendus par jour (Q1+Q2, voir horairesQuartsSite). `ligneJour`
  // vient de view_fdj_daily_summary (nb_quarts_controles déjà corrigé par
  // le correctif caisse_comptabilisable, v2.181 — inclut donc déjà "quart
  // encore brouillon" dans son exclusion, pas la peine de revérifier ici).
  const FDJ_QUARTS_ATTENDUS_PAR_JOUR = 2;
  function jourFdjEstCloture(ligneJour) {
    return !!(ligneJour && Number(ligneJour.nb_quarts_controles) >= FDJ_QUARTS_ATTENDUS_PAR_JOUR);
  }

  function ajouterJoursIso(dateStr, n) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // `dailyActuel`/`dailyComp` : lignes view_fdj_daily_summary de la période
  // actuelle et de la période de comparaison (déjà filtrées par borne de
  // date par l'appelant). `debutActuelIso`/`debutCompIso` : premier jour de
  // chaque période (ISO). `dureeJours` : longueur des deux fenêtres (déjà
  // égales par construction, voir resoudrePeriode côté écran). Aligne les
  // deux fenêtres jour par jour (offset 0 = premier jour de chacune) et ne
  // garde une paire que si les DEUX jours sont clôturés — un jour manquant
  // ou non clôturé, des deux côtés, exclut la paire entière plutôt que de
  // fabriquer un point de comparaison partiel (Article 5).
  function fenetreComparableFdj(dailyActuel, dailyComp, debutActuelIso, debutCompIso, dureeJours) {
    const parDateActuel = {}; (dailyActuel || []).forEach(l => { parDateActuel[l.date] = l; });
    const parDateComp = {}; (dailyComp || []).forEach(l => { parDateComp[l.date] = l; });
    const jours = [];
    for (let i = 0; i < dureeJours; i++) {
      const dateActuel = ajouterJoursIso(debutActuelIso, i);
      const dateComp = ajouterJoursIso(debutCompIso, i);
      const ligneActuel = parDateActuel[dateActuel] || null;
      const ligneComp = parDateComp[dateComp] || null;
      const clotureActuel = jourFdjEstCloture(ligneActuel);
      const clotureComp = jourFdjEstCloture(ligneComp);
      let raisonExclusion = null;
      if (!clotureActuel) raisonExclusion = 'jour_non_cloture';
      else if (!clotureComp) raisonExclusion = 'reference_non_cloturee';
      jours.push({ dateActuel, dateComp, comparable: !raisonExclusion, raisonExclusion, ligneActuel, ligneComp });
    }
    const comparables = jours.filter(j => j.comparable);
    return {
      jours,
      dailyActuelComparable: comparables.map(j => j.ligneActuel),
      dailyCompComparable: comparables.map(j => j.ligneComp),
      nbComparables: comparables.length,
      nbAttendus: dureeJours,
      couverture: `${comparables.length}/${dureeJours}`,
      toutesComparables: comparables.length === dureeJours,
    };
  }

  // ============================================================
  // FALLBACK TEMPOREL "DERNIER ÉTAT FIABLE" — extension à FDJ (22/08/2026,
  // demande de Frédéric : "j'ai appliqué ça à Carburants, applique la même
  // règle à FDJ" — v2.214 avait déjà anticipé cette extension : "ce
  // mécanisme devrait ensuite devenir générique... Carburants, FDJ,
  // Inventaire ou Verify").
  //
  // Différence structurelle avec Carburants, assumée et documentée : la
  // Maîtrise Carburants est un contrôle PONCTUEL du jour (jaugeage physique
  // fait ou non aujourd'hui) ; la Maîtrise FDJ (`nbEcarts`) est déjà, par
  // construction, une SOMME sur une fenêtre glissante de 7 jours
  // (`chargerCandidatsFdj`, Article 11 — jamais un 2e calcul). Il n'existe
  // donc pas de "valeur du jour" isolée à figer : ce qu'on gèle, c'est la
  // FENÊTRE de 7 jours elle-même, en la faisant se terminer au dernier jour
  // FDJ réellement clôturé plutôt qu'à aujourd'hui tant qu'aujourd'hui n'est
  // pas clôturé (`jourFdjEstCloture`, déjà utilisée par `fenetreComparableFdj`
  // ci-dessus pour un autre écran — même notion de "jour complet", jamais
  // une 2e définition). La Performance (`caGrattage`/`evolutionCa`), elle,
  // reste TOUJOURS calculée sur la fenêtre vivante se terminant aujourd'hui
  // — le CA de grattage déjà encaissé aujourd'hui est une donnée réelle,
  // jamais mise de côté (même principe que Carburants : Performance jamais
  // gelée par une Maîtrise incomplète).
  //
  // Décision de fraîcheur : réutilise TELLE QUELLE
  // `NexusCarburantMoteur.fraicheurCarburant({completAujourdhui, fallback})`
  // (Article 11) — sa signature est déjà 100 % générique (aucun champ propre
  // au carburant), c'est de fait déjà le mécanisme partagé annoncé par la
  // v2.214, simplement pas encore renommé/déplacé. À déplacer vers un
  // fichier neutre (ex. nexus-fraicheur-moteur.js) si un 3e secteur
  // (Inventaire/Verify) en a besoin un jour — prématuré pour 2 consommateurs.
  // ------------------------------------------------------------

  // Dernier jour FDJ clôturé strictement AVANT `dateAujourdhui`, en
  // parcourant les lignes déjà chargées par chargerCandidatsFdj (aucune
  // nouvelle requête, Article 11 — la fenêtre déjà récupérée par Brief pour
  // le calcul comp/actuel couvre largement assez de jours en arrière).
  function trouverDernierJourFdjFiable(dailyRows, dateAujourdhui) {
    const parDate = {};
    (dailyRows || []).forEach(l => { if (l && l.date && l.date < dateAujourdhui) parDate[l.date] = l; });
    const dates = Object.keys(parDate).sort().reverse();
    for (const date of dates) {
      if (jourFdjEstCloture(parDate[date])) {
        const joursEcoules = Math.round((new Date(dateAujourdhui + 'T00:00:00') - new Date(date + 'T00:00:00')) / 86400000);
        return { trouve: true, date, joursEcoules };
      }
    }
    return { trouve: false };
  }

  // Ré-agrège `nb_ecarts_non_nuls` sur les 7 jours calendaires se terminant
  // à `dateFin` (le dernier jour fiable trouvé ci-dessus) — même fenêtre de
  // 7 jours que `chargerCandidatsFdj`, simplement décalée pour ne jamais
  // inclure un jour non clôturé dans la Maîtrise. Aucune nouvelle requête :
  // relit les lignes déjà chargées.
  function sommerEcartsFenetreFdj(dailyRows, dateFin) {
    const debut = ajouterJoursIso(dateFin, -6);
    return (dailyRows || [])
      .filter(l => l && l.date && l.date >= debut && l.date <= dateFin)
      .reduce((s, l) => s + (l.nb_ecarts_non_nuls != null ? Number(l.nb_ecarts_non_nuls) : 0), 0);
  }

  // Bloc "Aujourd'hui — en cours" pour FDJ (même principe que
  // construireBlocEnCours de nexus-carburant-moteur.js, jamais fondu dans le
  // score figé) : décrit ce qui est déjà connu du jour en construction, au
  // grain réellement disponible (nb_quarts_controles/nb_ecarts_non_nuls de
  // la ligne du jour, déjà remontée par view_fdj_daily_summary).
  function construireBlocEnCoursFdj({ nbQuartsControlesJour, nbEcartsJour }) {
    if (!nbQuartsControlesJour) return ["Aucun quart FDJ clôturé pour l'instant aujourd'hui."];
    const lignes = [`${nbQuartsControlesJour}/${FDJ_QUARTS_ATTENDUS_PAR_JOUR} quarts FDJ clôturés aujourd'hui.`];
    lignes.push((nbEcartsJour || 0) > 0
      ? `${nbEcartsJour} écart${nbEcartsJour > 1 ? 's' : ''} de caisse déjà constaté${nbEcartsJour > 1 ? 's' : ''} aujourd'hui.`
      : "Aucun écart de caisse constaté pour l'instant aujourd'hui.");
    return lignes;
  }

  // Signal critique confirmé (23/08/2026, audit "Anti-dégradation
  // temporelle", section 3.2/règle de précédence #5) : *"une rupture FDJ
  // confirmée [...] doit remplacer immédiatement le fallback, même si le
  // cycle global du jour n'est pas encore complet."* Un écart de caisse
  // DÉJÀ constaté aujourd'hui (sur un quart déjà remonté, même si le jour
  // entier n'est pas encore clôturé) est un fait réel, pas une incertitude
  // — il ne doit jamais être masqué derrière un score figé plus ancien et
  // plus favorable. Distinct de `jourFdjEstCloture` : un jour peut être
  // incomplet (Q2 pas encore fait) tout en portant déjà, sur Q1, un écart
  // réel et non nul.
  function signalCritiqueFdjAujourdhui(ligneAujourdhui) {
    return !!(ligneAujourdhui && Number(ligneAujourdhui.nb_ecarts_non_nuls) > 0);
  }

  // Progression du comptage d'un quart pour les cartes "Quarts du jour"
  // (20/08/2026, cahier UX §4/§5) : "L'objectif est que tu puisses voir une
  // anomalie sans ouvrir le quart." `counts` = lignes fdj_shift_counts du
  // quart (peut être vide), `totalJeux` = nombre de jeux actifs du site.
  // Retourne { stockDebut: {comptes, total, etat}, stockFin: {...} } avec
  // etat ∈ 'non_commence' | 'partiel' | 'termine'. Volontairement PAS de
  // distinction 'corrigé'/'validé' au niveau du comptage — NEXUS ne trace
  // aucun flag "ce comptage a été corrigé/validé" par jeu, seulement un
  // statut global de caisse (voir plus loin) : jamais une fausse précision
  // par jeu que la donnée ne permet pas (Article 5).
  function progressionComptageQuart(counts, totalJeux) {
    const etatDe = (comptes, total) => {
      if (!total || comptes <= 0) return 'non_commence';
      if (comptes >= total) return 'termine';
      return 'partiel';
    };
    const debutComptes = (counts || []).filter(c => c.stock_initial !== null && c.stock_initial !== undefined).length;
    const finComptes = (counts || []).filter(c => c.stock_final !== null && c.stock_final !== undefined).length;
    return {
      stockDebut: { comptes: debutComptes, total: totalJeux, etat: etatDe(debutComptes, totalJeux) },
      stockFin: { comptes: finComptes, total: totalJeux, etat: etatDe(finComptes, totalJeux) },
    };
  }

  // ------------------------------------------------------------
  // F5 (20/08/2026, cahier §8 "Continuité FDJ : rendre l'alerte explicable
  // et résoluble", critères FDJ-17/18/19) : le moteur savait déjà calculer
  // dynamiquement SI la chaîne est rompue et POURQUOI (chaineInterrompueDynamique,
  // motif 'quart_manquant'/'quart_incomplet', ajouté le 16/08/2026) — ce qui
  // manquait, c'est la traduction de ce code en les 3 informations concrètes
  // que le cahier demande d'afficher : Cause / Élément manquant / Action.
  // Fonctions pures, à partir du même `motif` déjà produit ailleurs — jamais
  // une deuxième détection de rupture (Article 11).
  // ------------------------------------------------------------
  function causeAlerteContinuite(motif) {
    if (motif === 'quart_manquant') return 'Relevé de clôture manquant — aucun quart trouvé au créneau attendu';
    if (motif === 'quart_incomplet') return 'Quart précédent encore en brouillon — comptage final non exploitable';
    return null; // chaîne saine, ou motif inconnu — jamais un texte inventé (Article 5)
  }
  function elementManquantAlerteContinuite(motif) {
    if (motif === 'quart_manquant') return 'Relevé de clôture du quart précédent';
    if (motif === 'quart_incomplet') return 'Validation du quart précédent (statut encore Brouillon)';
    return null;
  }
  function actionAlerteContinuite(motif) {
    if (motif === 'quart_manquant') return 'Créer ou compléter le quart manquant';
    if (motif === 'quart_incomplet') return 'Ouvrir et valider le quart précédent';
    return null;
  }
  // Combine chaineInterrompueDynamique + les 3 traductions ci-dessus en un
  // seul appel pour les écrans — même detail que reconcilierAlertesChaine
  // utilise déjà pour agir, cette fois pour AFFICHER (Article 11 : une
  // seule fonction qui sait ce qu'un motif signifie, pas une par écran).
  function detailAlerteContinuite(quartActuel, ensemble) {
    const etat = chaineInterrompueDynamique(quartActuel, ensemble);
    return {
      ...etat,
      cause: causeAlerteContinuite(etat.motif),
      elementManquant: elementManquantAlerteContinuite(etat.motif),
      action: actionAlerteContinuite(etat.motif),
    };
  }
  // État affiché de l'alerte elle-même (cahier §8.1) — dérivé des colonnes
  // déjà en base (`resolue_le`/`resolue_automatiquement`, posées par
  // reconcilierAlertesChaine, aucune migration nécessaire). NEXUS ne
  // distingue aujourd'hui aucune action manager de résolution manuelle
  // distincte du recalcul automatique (aucun écran ne pose
  // resolue_automatiquement=false + resolue_le), et ne retient pas non plus
  // un 4e état "ancien incident, non actif" au sens du cahier — seulement
  // 'active'/'resolue_automatiquement' sont donc des états réellement
  // atteignables par le code actuel ; 'resolue_manager' est prévu pour
  // rester correct SI une telle action est ajoutée un jour, mais n'est
  // jamais produit aujourd'hui (voir Data Dictionary, limite assumée).
  function etatAlerteContinuite(alerte) {
    if (!alerte || !alerte.resolue_le) return 'active';
    return alerte.resolue_automatiquement ? 'resolue_automatiquement' : 'resolue_manager';
  }
  const LABELS_ETAT_ALERTE_CONTINUITE = {
    active: 'À résoudre', resolue_automatiquement: 'Résolue automatiquement', resolue_manager: 'Résolue manuellement',
  };
  function labelEtatAlerteContinuite(etat) { return LABELS_ETAT_ALERTE_CONTINUITE[etat] || etat; }

  // ------------------------------------------------------------
  // F4 (20/08/2026, cahier §3, FDJ-08) : "Résultat métier du contrôle" —
  // distinct de tout statut administratif (fdj_shifts.statut) et du
  // "Statut du contrôle" opérationnel existant (fdj_cash_controls.statut,
  // 7 valeurs historiques STATUTS_CAISSE côté écran) : ni l'un ni l'autre
  // ne portait le jugement explicite demandé par le cahier ("Ne pas
  // utiliser « Validé » comme unique statut métier"). Colonne dédiée
  // `fdj_cash_controls.resultat_controle`, additive (migration
  // fdj_cash_controls_resultat_controle) — constante ici plutôt que
  // dupliquée dans chaque écran qui l'affichera (Manager aujourd'hui,
  // Analyse/PDF potentiellement demain, F7).
  // ------------------------------------------------------------
  const RESULTATS_CONTROLE_FDJ = [
    { value: '', label: 'Non renseigné' },
    { value: 'conforme', label: 'Conforme' },
    { value: 'avec_ecart', label: 'Conforme avec écart justifié' },
    { value: 'a_regulariser', label: 'Écart à régulariser' },
    // Valeurs historiques : plus jamais proposées dans le formulaire
    // (voir optionsVerdictControleFdj), conservées uniquement pour que
    // labelResultatControle continue de savoir afficher un contrôle déjà
    // enregistré avec l'une de ces anciennes valeurs (Article 5 : ne
    // jamais faire disparaître ou mal afficher une donnée passée).
    { value: 'a_revoir', label: 'À revoir (ancien libellé)' },
    { value: 'non_comparable', label: 'Non comparable (ancien libellé)' },
  ];
  function labelResultatControle(v) {
    const r = RESULTATS_CONTROLE_FDJ.find(x => x.value === v);
    return r ? r.label : (v || 'Non renseigné');
  }

  // ------------------------------------------------------------
  // VERDICT DU CONTRÔLE — cohérent avec l'écart, jamais librement
  // contradictoire (21/08/2026, demande de Frédéric suite à un cas réel
  // où "Conforme" avait été choisi alors que l'écart retenu était de
  // +1,00 €). Le manager ne choisit plus un statut de caisse à part :
  // il choisit un verdict, dont l'écart déjà calculé restreint les
  // options possibles, et NEXUS dérive lui-même le statut de la caisse.
  // ------------------------------------------------------------

  // Options de verdict réellement proposables pour un écart donné —
  // jamais "Conforme" si l'écart n'est pas exactement zéro, jamais les
  // deux options "avec écart" si l'écart est nul (il n'y aurait rien à
  // justifier ni à régulariser).
  function optionsVerdictControleFdj(ecart) {
    if (ecart === null || ecart === undefined || ecart === 0) {
      return [{ value: 'conforme', label: 'Conforme' }];
    }
    return [
      { value: 'avec_ecart', label: 'Conforme avec écart justifié' },
      { value: 'a_regulariser', label: 'Écart à régulariser' },
    ];
  }

  // Un verdict "conforme" n'a de sens que si l'écart est nul, et
  // inversement — sert à savoir si un verdict déjà choisi doit être
  // réinitialisé quand l'écart change (jamais laisser une combinaison
  // incohérente affichée ni enregistrée).
  function verdictCoherentAvecEcart(verdict, ecart) {
    return optionsVerdictControleFdj(ecart).some(o => o.value === verdict);
  }

  // Statut de caisse dérivé du verdict — jamais saisi librement par le
  // manager (voir migration fdj_cash_controls_verdict_a_regulariser,
  // 21/08/2026). 'provisoire' par défaut si aucun verdict retenu.
  function deriverStatutCaisseDepuisVerdict(verdict) {
    if (verdict === 'conforme') return 'conforme';
    if (verdict === 'avec_ecart') return 'valide_avec_ecart';
    if (verdict === 'a_regulariser') return 'a_regulariser';
    return 'provisoire';
  }

  // Le motif de l'écart (menu déroulant, pas seulement son commentaire
  // libre) devient obligatoire dès que l'écart n'est pas nul — sans
  // motif, "Conforme avec écart justifié" ne serait justifié par rien.
  function motifEcartObligatoire(ecart) {
    return !(ecart === null || ecart === undefined || ecart === 0);
  }

  // État du quart — badge de synthèse en lecture seule (jamais un champ
  // saisi à la main) : où en est ce quart, tout compris. Distinct de
  // "État de saisie" (fdj_shifts.statut, brouillon/valide) : un quart
  // peut être "validé" (saisie terminée) sans que son contrôle de
  // caisse soit encore tranché.
  //   'non_controle' : saisie pas encore validée, OU validée mais sans
  //     verdict retenu pour l'instant (contrôle manager encore à faire).
  //   'controle'     : validé + verdict Conforme (écart nul).
  //   'cloture'      : validé + verdict Conforme avec écart justifié —
  //     l'écart existe mais est documenté, rien de plus à faire.
  //   'a_regulariser': validé + verdict Écart à régulariser — une
  //     action reste due, jamais confondu avec "clôturé".
  function etatDuQuartFdj({ statutShift, verdictControle, ecart } = {}) {
    if (statutShift !== 'valide') return { code: 'non_controle', label: 'Non contrôlé' };
    if (!verdictCoherentAvecEcart(verdictControle, ecart) || !verdictControle) {
      return { code: 'non_controle', label: 'Non contrôlé' };
    }
    if (verdictControle === 'conforme') return { code: 'controle', label: 'Contrôlé' };
    if (verdictControle === 'avec_ecart') return { code: 'cloture', label: 'Clôturé' };
    return { code: 'a_regulariser', label: 'À régulariser' };
  }

  // ------------------------------------------------------------
  // TRAÇABILITÉ DES MOUVEMENTS + RÉCONCILIATION PHYSIQUE — 24/08/2026,
  // demande de Frédéric : "Ajoute au module Stock FDJ une chaîne de
  // traçabilité complète des mouvements et une fonction de réconciliation
  // physique [...] pour comprendre en moins d'une minute ce qui s'est
  // passé depuis ton dernier inventaire, même si certaines opérations
  // n'ont pas été saisies correctement."
  //
  // Constat avant d'écrire une ligne de code (Article 11) : la chaîne de
  // mouvements demandée EXISTE déjà — fdj_stock_movements (audit §14,
  // "boîte noire des mouvements de stock FDJ", type_mouvement parmi
  // reception/transfert/activation/retour/blocage/correction) et le point
  // de référence demandé existe déjà lui aussi — fdj_stock_references +
  // fdj_stock_reference_lignes (09/08/2026, "Inventaire de référence FDJ",
  // validerInventaireRef côté écran), qui enregistre déjà avant
  // (stock_theorique_*_avant) et après (bureau_reel/caisse_reel), auteur
  // (controle_par), date, et ne touche JAMAIS fdj_stock_movements (aucun
  // mouvement rétroactif inventé) — exactement la règle demandée. Ce qui
  // manquait réellement, ajouté ici : motif et référence précédente
  // explicite (colonnes ajoutées par la migration
  // ajouter_motif_et_reference_precedente_fdj_stock_references), et une
  // vue chronologique UNIFIÉE des deux (l'écran "Historique des
  // mouvements" n'existait pas encore).
  // ------------------------------------------------------------

  // Libellés humains des type_mouvement de fdj_stock_movements — seule
  // source (Article 11), pour que l'écran Historique et tout futur
  // consommateur affichent toujours le même mot pour le même fait.
  const LABEL_TYPE_MOUVEMENT = {
    reception: 'Réception',
    transfert: 'Transfert Bureau → Caisse',
    activation: 'Activation',
    retour: 'Retour vers le Bureau',
    blocage: 'Retrait / blocage',
    correction: 'Correction manuelle',
  };

  // Écarts d'une réconciliation (lignes de fdj_stock_reference_lignes) —
  // avant = stock_theorique_*_avant (ce que NEXUS calculait), après =
  // bureau_reel/caisse_reel (ce que le manager a physiquement compté).
  // `aUnEcart` conditionne si un motif doit être exigé côté écran : un
  // recomptage qui confirme exactement le théorique n'a rien à motiver,
  // un écart réel doit toujours porter une explication (même provisoire,
  // "à vérifier") plutôt que de disparaître silencieusement dans la
  // nouvelle référence.
  function ecartsReferenceLignes(lignes) {
    const parJeu = {};
    let aUnEcart = false;
    (lignes || []).forEach(l => {
      const theoBureau = Number(l.stock_theorique_bureau_avant) || 0;
      const theoCaisse = Number(l.stock_theorique_caisse_avant) || 0;
      const ecartBureau = (Number(l.bureau_reel) || 0) - theoBureau;
      const ecartCaisse = (Number(l.caisse_reel) || 0) - theoCaisse;
      if (ecartBureau !== 0 || ecartCaisse !== 0) aUnEcart = true;
      parJeu[l.game_id] = { ecartBureau, ecartCaisse, theoBureau, theoCaisse, bureauReel: Number(l.bureau_reel) || 0, caisseReel: Number(l.caisse_reel) || 0 };
    });
    return { parJeu, aUnEcart };
  }

  // Trajet lisible d'un mouvement — jamais un simple "source_id →
  // destination_id" technique. `locations` : { [id]: { type, nom } } —
  // uniquement les emplacements réels du site (fdj_locations), jamais un
  // libellé fixe : un site qui renomme "Caisse" en "Comptoir" voit ce
  // nouveau nom partout, y compris ici (même discipline que
  // emplacementParType côté écran).
  function trajetMouvement(m, locations) {
    const nom = (id) => (id && locations && locations[id]) ? locations[id].nom : null;
    if (m.type_mouvement === 'reception') return `Fournisseur → ${nom(m.location_destination_id) || 'Bureau'}`;
    if (m.type_mouvement === 'activation') return `Activé en ${nom(m.location_source_id) || nom(m.location_destination_id) || 'caisse'}`;
    if (m.type_mouvement === 'correction') return `Correction — ${nom(m.location_destination_id) || nom(m.location_source_id) || '—'}`;
    const src = nom(m.location_source_id), dst = nom(m.location_destination_id);
    if (src && dst) return `${src} → ${dst}`;
    if (dst) return `→ ${dst}`;
    if (src) return `${src} → —`;
    return '—';
  }

  // Une ligne d'historique "mouvement" — normalisée pour l'écran. `ctx` =
  // { jeuxParId: {[id]:{nom}}, locationsParId: {[id]:{nom,type}},
  // employesParId: {[id]:{nom}} } — construits une seule fois côté écran
  // à partir des tableaux déjà chargés (chargerJeux/chargerEmplacements/
  // chargerEmployesSite, Article 11 — jamais une nouvelle requête ici,
  // fonction pure).
  function ligneHistoriqueMouvement(m, ctx) {
    const jeu = ctx.jeuxParId[m.game_id];
    const employe = m.employee_id ? ctx.employesParId[m.employee_id] : null;
    return {
      categorie: 'mouvement',
      instant: m.created_at,
      jeuNom: jeu ? jeu.nom : 'Jeu inconnu',
      typeMouvement: m.type_mouvement,
      typeLabel: LABEL_TYPE_MOUVEMENT[m.type_mouvement] || m.type_mouvement,
      quantite: Number(m.quantite) || 0,
      trajet: trajetMouvement(m, ctx.locationsParId),
      auteurNom: employe ? employe.nom : (m.employee_id ? 'Employé' : 'Manager'),
      justification: m.justification || null,
      shiftId: m.shift_id || null,
    };
  }

  // Une entrée d'historique "réconciliation" — un point de référence posé
  // (fdj_stock_references) avec le détail par jeu de ses lignes. `refs` :
  // [{id, date, type, controle_par, motif, created_at, reference_precedente_id}].
  // `lignesParReference` : { [reference_id]: [fdj_stock_reference_lignes] }
  // — chargées séparément par l'appelant (une seule requête pour toutes
  // les lignes de toutes les références, jamais une requête par
  // référence). `ctx` : même forme que ligneHistoriqueMouvement, plus
  // jeuxParId utilisé pour nommer chaque ligne d'écart dans le détail.
  function ligneHistoriqueReconciliation(ref, lignes, ctx) {
    const { parJeu, aUnEcart } = ecartsReferenceLignes(lignes);
    const ecarts = Object.entries(parJeu)
      .filter(([, e]) => e.ecartBureau !== 0 || e.ecartCaisse !== 0)
      .map(([gameId, e]) => ({ jeuNom: (ctx.jeuxParId[gameId] || {}).nom || 'Jeu inconnu', ...e }));
    const employe = ref.controle_par ? ctx.employesParId[ref.controle_par] : null;
    return {
      categorie: 'reconciliation',
      instant: ref.created_at,
      type: ref.type,
      auteurNom: employe ? employe.nom : '—',
      motif: ref.motif || null,
      aUnEcart,
      nbJeuxControles: lignes.length,
      nbEcarts: ecarts.length,
      ecarts,
      referencePrecedenteId: ref.reference_precedente_id || null,
    };
  }

  // Timeline unifiée, triée du plus récent au plus ancien — c'est LA
  // fonction consommée par l'écran "Historique des mouvements" (jamais
  // deux listes séparées à recroiser mentalement par le manager).
  // `references` : lignes fdj_stock_references. `lignesParReference` :
  // voir ligneHistoriqueReconciliation. Fonction pure : aucun accès
  // Supabase, tout est fourni par l'appelant.
  function construireHistoriqueFdj(mouvements, references, lignesParReference, ctx) {
    const evts = [];
    (mouvements || []).forEach(m => evts.push(ligneHistoriqueMouvement(m, ctx)));
    (references || []).forEach(ref => evts.push(ligneHistoriqueReconciliation(ref, (lignesParReference || {})[ref.id] || [], ctx)));
    evts.sort((a, b) => new Date(b.instant || 0) - new Date(a.instant || 0));
    return evts;
  }

  global.NexusFdjMoteur = {
    calculerVentesJeu, ventesGrattageTotal, caisseGrattage, caisseAttendue, ecartCaisse, permissionsEcartCaisseEmploye,
    soldesCarnetsParJeu, soldeCarnetsJeu, soldesCarnetsAvecReference,
    calculerCandidatsFdj,
    quartPrecedentAttendu, quartSuivant, chaineContinuite,
    chaineInterrompueDynamique, ecartsContinuiteStock, ecartsContinuiteAAppliquer,
    approNonTraceParJeu, lignesApproNonTracees, reconciliationApproActivation, decisionSynchronisationApproActivation,
    minutesDepuisMinuit, quartDansFenetreAcces, evaluerAccesQuart,
    etatIntegriteFdj,
    FDJ_ROTATION_FENETRE_JOURS_DEFAUT, FDJ_SEUIL_AUTONOMIE_VIGILANCE_JOURS,
    FDJ_SEUIL_FRACTION_CARNET_PAS_ENCORE_MOITIE,
    rotationCarnetsJeu, ticketsRestantsCarnetEnCours, calculerAutonomieJeu,
    etatLigneStockV2, phraseFamillePalier, syntheseGlobaleFdjStock,
    statutRelevecloture, diffClotureFdj, caractereRelevecloture,
    propagationCorrectionStock,
    syntheseExceptionsManager,
    caisseComptabilisableQuart, quartCaisseReelleCellule, etatJourCaisseReelle, totalJourCaisseReelle,
    progressionComptageQuart,
    FDJ_QUARTS_ATTENDUS_PAR_JOUR, jourFdjEstCloture, fenetreComparableFdj,
    trouverDernierJourFdjFiable, sommerEcartsFenetreFdj, construireBlocEnCoursFdj,
    signalCritiqueFdjAujourdhui,
    RESULTATS_CONTROLE_FDJ, labelResultatControle,
    optionsVerdictControleFdj, verdictCoherentAvecEcart, deriverStatutCaisseDepuisVerdict, motifEcartObligatoire, etatDuQuartFdj,
    causeAlerteContinuite, elementManquantAlerteContinuite, actionAlerteContinuite, detailAlerteContinuite,
    etatAlerteContinuite, labelEtatAlerteContinuite,
    LABEL_TYPE_MOUVEMENT, ecartsReferenceLignes, trajetMouvement,
    ligneHistoriqueMouvement, ligneHistoriqueReconciliation, construireHistoriqueFdj,
  };
})(typeof window !== 'undefined' ? window : globalThis);
