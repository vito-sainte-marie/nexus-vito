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

  // Tickets restants dans le carnet actuellement en cours (le plus
  // récemment activé pour ce jeu) : tickets_par_carnet - tickets vendus
  // (fdj_shift_counts.ventes_qte) depuis cette activation. Retourne null —
  // jamais 0 par défaut — si aucun carnet n'a jamais été activé pour ce
  // jeu, ou si tickets_par_carnet est inconnu (jeu non encore répertorié
  // dans la planche FDJ) : "non calculable" plutôt qu'un faux zéro.
  // Plancher à 0 si le calcul devient négatif (carnet déjà épuisé sans
  // qu'un nouveau n'ait encore été activé — fait réel, pas une erreur de
  // calcul, mais jamais restitué en négatif).
  function ticketsRestantsCarnetEnCours(mouvements, shiftCounts, gameId, ticketsParCarnet) {
    if (!ticketsParCarnet) return null;
    let derniereActivation = null;
    (mouvements || []).forEach(m => {
      if (m.type_mouvement !== 'activation' || m.game_id !== gameId || !m.created_at) return;
      if (!derniereActivation || new Date(m.created_at) > new Date(derniereActivation)) derniereActivation = m.created_at;
    });
    if (!derniereActivation) return null;
    const seuil = new Date(derniereActivation).getTime();
    let vendu = 0;
    (shiftCounts || []).forEach(c => {
      if (c.game_id !== gameId || !c.created_at) return;
      if (new Date(c.created_at).getTime() > seuil) vendu += Number(c.ventes_qte) || 0;
    });
    return Math.max(Number(ticketsParCarnet) - vendu, 0);
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
  //   - 'reapprovisionner' (🔴) : plus rien en caisse non activée. Le
  //     libellé distingue "Rupture totale" (rien nulle part, y compris le
  //     bureau) de "Réapprovisionner" (une réserve existe au bureau, il
  //     suffit de la redescendre) — même donnée, deux degrés d'urgence.
  //   - 'vigilance' (🟠) : une réserve existe en caisse, mais rien n'est
  //     actuellement en cours de vente (`solde.actives <= 0`, entre deux
  //     carnets) OU l'autonomie estimée est courte
  //     (FDJ_SEUIL_AUTONOMIE_VIGILANCE_JOURS) quand elle est calculable.
  //   - 'ok' (🟢) : le reste.
  function etatLigneStockV2(solde, approNonTrace, ticketsParCarnet, autonomie) {
    if (approNonTrace > 0) {
      const carnetsEstimes = ticketsParCarnet ? Math.floor(approNonTrace / ticketsParCarnet) : null;
      return { statut: 'rapprocher', couleur: 'ambre', badge: '⚠️ À rapprocher', rapprochement: true, carnetsEstimes, approNonTrace };
    }
    const s = solde || { bureau: 0, actives: 0, nonActives: 0 };
    if (s.nonActives <= 0) {
      const rupture = s.bureau <= 0;
      return { statut: 'reapprovisionner', couleur: 'rouge', badge: rupture ? '🔴 Rupture totale' : '🔴 Réapprovisionner' };
    }
    const autonomieCourte = autonomie && autonomie.jours !== null && autonomie.jours <= FDJ_SEUIL_AUTONOMIE_VIGILANCE_JOURS;
    if (s.actives <= 0 || autonomieCourte) {
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
  //   rompue: bool — sortie de chaineContinuite(...).rompue pour ce quart,
  //   aRevoir: bool — fdj_shifts.a_revoir de ce quart,
  //   validationManagerFaite: bool | null — true si fdj_cash_controls.statut
  //     de ce quart est déjà 'conforme'/'valide_avec_ecart'/'regularise'
  //     (donc autre chose que 'provisoire' ou absent) ; null si aucun
  //     contrôle de caisse n'existe encore pour ce quart (pas encore
  //     clôturé — ne compte pas comme un défaut de confiance, juste "pas
  //     encore là").
  // }
  // Retourne { integrite: 'OK'|'PARTIELLE'|'ROMPUE', motif } — motif = null
  // | 'quart_manquant' | 'a_revoir' | 'validation_manager_attendue'.
  function etatIntegriteFdj(signaux) {
    const s = signaux || {};
    if (s.rompue) return { integrite: 'ROMPUE', motif: 'quart_manquant' };
    if (s.aRevoir) return { integrite: 'PARTIELLE', motif: 'a_revoir' };
    if (s.validationManagerFaite === false) return { integrite: 'PARTIELLE', motif: 'validation_manager_attendue' };
    return { integrite: 'OK', motif: null };
  }

  global.NexusFdjMoteur = {
    calculerVentesJeu, ventesGrattageTotal, caisseGrattage, caisseAttendue, ecartCaisse,
    soldesCarnetsParJeu, soldeCarnetsJeu, soldesCarnetsAvecReference,
    calculerCandidatsFdj,
    quartPrecedentAttendu, quartSuivant, chaineContinuite,
    approNonTraceParJeu, lignesApproNonTracees,
    minutesDepuisMinuit, quartDansFenetreAcces, evaluerAccesQuart,
    etatIntegriteFdj,
    FDJ_ROTATION_FENETRE_JOURS_DEFAUT, FDJ_SEUIL_AUTONOMIE_VIGILANCE_JOURS,
    rotationCarnetsJeu, ticketsRestantsCarnetEnCours, calculerAutonomieJeu,
    etatLigneStockV2, phraseFamillePalier, syntheseGlobaleFdjStock,
  };
})(typeof window !== 'undefined' ? window : globalThis);
