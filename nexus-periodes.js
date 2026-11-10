// ============================================================
// NEXUS Périodes — moteur unique de comparaison de périodes.
//
// Demande de Frédéric le 23/07/2026 : "je ne veux pas que l'appli soit une
// succession de pages mais un système" — après avoir trouvé et corrigé le
// même bug de comparaison de périodes séparément dans Rayon puis Cockpit
// (deux copies du même algorithme, forcément amenées à diverger), ce
// fichier en fait la source unique de vérité, utilisée par toutes les
// pages qui comparent une période à une autre.
//
// Le bug qu'il corrige, une fois pour toutes : comparer aveuglément les
// deux périodes les plus récentes d'une table fabrique des évolutions
// fausses dès qu'elles se chevauchent (double comptage) ou n'ont pas la
// même durée (un trimestre complet contre un mois entamé, par exemple).
// La bonne pratique est de chercher la paire de périodes NON chevauchantes
// la plus récente dont les durées sont proches (±20%), et de séparer
// "période affichée" (la plus récente, pour tout ce qui n'a pas besoin
// d'historique) de "paire comparable" (utilisée uniquement pour calculer
// une évolution).
//
// Inclure dans une page : <script src="nexus-periodes.js?v=20260904-0104"></script>
// (même mécanisme que nexus-auth.js et nexus-vocabulaire.js).
// ============================================================

(function (global) {
  function joursEntre(debut, fin) {
    if (!debut || !fin) return 0;
    // 'T00:00:00' : la soustraction entre deux Date parsées de la même façon
    // annule déjà l'effet du fuseau horaire, mais on le fixe explicitement
    // par cohérence avec le reste de NEXUS plutôt que de compter dessus.
    return Math.round((new Date(fin + 'T00:00:00') - new Date(debut + 'T00:00:00')) / 86400000) + 1;
  }

  // Une paire (actuelle, précédente) n'est valable que si les deux périodes
  // ne se chevauchent pas ET si leurs durées sont proches (écart ≤ 20 %).
  function paireValide(actuelle, precedente) {
    if (precedente.fin >= actuelle.debut) return false; // chevauchement -> exclue
    const ecart = Math.max(actuelle.duree, precedente.duree) > 0
      ? Math.abs(actuelle.duree - precedente.duree) / Math.max(actuelle.duree, precedente.duree) : 1;
    return ecart <= 0.2;
  }

  // Analyse un tableau de lignes portant chacune une période (par défaut
  // les champs periode_debut/periode_fin, ex. la table `products`) et
  // retourne :
  //   - periodesTriees : toutes les périodes distinctes, plus récente d'abord
  //   - periodeAffichage : la plus récente (pour les indicateurs "snapshot"
  //     qui n'ont pas besoin d'historique : contribution, top ventes...)
  //   - rowsAffichage : les lignes de cette période
  //   - paire : { actuelle, precedente } la paire comparable la plus
  //     récente trouvée, ou null si aucune ne remplit les conditions
  //   - rowsPaireActuelle / rowsPairePrecedente : les lignes de chaque
  //     moitié de la paire (vides si paire est null)
  //   - periodeEnCours : true si periodeAffichage n'est PAS la période
  //     "actuelle" de la paire (autrement dit : la période la plus récente
  //     est encore trop tôt/incomplète pour être comparée équitablement)
  function analyserPeriodes(rows, options) {
    const champDebut = (options && options.champDebut) || 'periode_debut';
    const champFin = (options && options.champFin) || 'periode_fin';

    const parCle = {};
    (rows || []).forEach(r => {
      const debut = r[champDebut], fin = r[champFin];
      if (!debut || !fin) return;
      const cle = `${debut}|${fin}`;
      if (!parCle[cle]) parCle[cle] = { debut, fin, duree: joursEntre(debut, fin) };
    });
    const periodesTriees = Object.values(parCle).sort((a, b) => b.debut.localeCompare(a.debut));

    if (!periodesTriees.length) {
      return {
        periodesTriees: [], periodeAffichage: null, rowsAffichage: [],
        paire: null, rowsPaireActuelle: [], rowsPairePrecedente: [], periodeEnCours: false,
      };
    }

    const periodeAffichage = periodesTriees[0];
    const rowsAffichage = rows.filter(r => r[champDebut] === periodeAffichage.debut && r[champFin] === periodeAffichage.fin);

    let paire = null;
    if (options && options.appariement === 'dernieres') {
      // Tendances (arbitrage de Frédéric, 10/11/2026) : T1 = avant-dernière
      // période importée, T2 = dernière, sans contrainte d'écart de durée.
      // La continuité et le rapport de durées sont signalés par
      // qualiteComparaison, jamais corrigés ici.
      if (periodesTriees.length >= 2) paire = { actuelle: periodesTriees[0], precedente: periodesTriees[1] };
    } else {
      for (let i = 0; i < periodesTriees.length - 1 && !paire; i++) {
        if (paireValide(periodesTriees[i], periodesTriees[i + 1])) {
          paire = { actuelle: periodesTriees[i], precedente: periodesTriees[i + 1] };
        }
      }
    }
    const rowsPaireActuelle = paire ? rows.filter(r => r[champDebut] === paire.actuelle.debut && r[champFin] === paire.actuelle.fin) : [];
    const rowsPairePrecedente = paire ? rows.filter(r => r[champDebut] === paire.precedente.debut && r[champFin] === paire.precedente.fin) : [];
    const periodeEnCours = paire
      ? (periodeAffichage.debut !== paire.actuelle.debut || periodeAffichage.fin !== paire.actuelle.fin)
      : periodesTriees.length > 0;

    return { periodesTriees, periodeAffichage, rowsAffichage, paire, rowsPaireActuelle, rowsPairePrecedente, periodeEnCours };
  }

  // Évolution agrégée (somme d'un champ, "ca" par défaut) entre deux jeux
  // de lignes déjà filtrés par période — typiquement rowsPaireActuelle et
  // rowsPairePrecedente. Retourne null si la base précédente est nulle ou
  // absente, plutôt que de fabriquer un pourcentage à partir de rien.
  function evolutionAgregee(rowsActuelle, rowsPrecedente, champ) {
    champ = champ || 'ca';
    const totalActuelle = (rowsActuelle || []).reduce((s, r) => s + (r[champ] || 0), 0);
    const totalPrecedente = (rowsPrecedente || []).reduce((s, r) => s + (r[champ] || 0), 0);
    return totalPrecedente > 0 ? (totalActuelle - totalPrecedente) / totalPrecedente : null;
  }

  // ============================================================
  // TENDANCES — règle commune (lot 1 Produits, PR B, 10/11/2026).
  //
  // Une seule définition d'une « tendance » pour les six modules qui en
  // affichent une (Indice, Brief, Cockpit, Conseiller, Rayon, Produits).
  // Fonctions PURES : aucun accès réseau, aucune lecture d'horloge cachée
  // (la date du jour est un paramètre ; son défaut est calculé dans le
  // fuseau de la station, jamais en UTC ni dans le fuseau du navigateur).
  //
  //  Règle 1 — ventes moyennes par jour : T1 et T2 n'ont pas la même durée
  //    (14 j contre 17 j par exemple) ; comparer les CA bruts fabrique une
  //    hausse artificielle. évolution = (v2/d2 − v1/d1) / (v1/d1).
  //  Règle 2 — fraîcheur : au-delà de 21 jours entre la fin de T2 et
  //    aujourd'hui (fuseau de la station), la paire ne dit plus rien de la
  //    tendance « actuelle ». L'historique reste consultable.
  //  Règle 3 — plancher de volume (par article seulement) : T1 doit
  //    atteindre 50 € de CA OU 10 unités, pour 14 jours, proportionnellement
  //    à la durée réelle de T1. En dessous : « ventes insuffisantes », jamais
  //    une baisse ni un conseil.
  // ============================================================
  const FRAICHEUR_MAX_JOURS = 21;
  const JOURS_REFERENCE_PLANCHER = 14;
  const PLANCHER_CA_EUR = 50;
  const PLANCHER_UNITES = 10;
  const FUSEAU_REPLI_TENDANCE = 'America/Martinique';
  const MESSAGE_VENTES_INSUFFISANTES = 'Ventes insuffisantes pour établir une tendance fiable';

  // Date du jour (AAAA-MM-JJ) dans le fuseau demandé. Intl uniquement.
  function dateDuJourStation(instant, fuseau) {
    const d = instant instanceof Date ? instant : new Date(instant == null ? Date.now() : instant);
    const tz = fuseau || global.NEXUS_FUSEAU_STATION || FUSEAU_REPLI_TENDANCE;
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  }

  function dateDuJourDesOptions(options) {
    if (options && options.dateDuJour) return options.dateDuJour;
    return dateDuJourStation(options && options.instant, options && options.fuseau);
  }

  // Jours écoulés entre la fin de T2 et aujourd'hui (0 = T2 finit aujourd'hui).
  function agePaireJours(paire, dateDuJour) {
    if (!paire || !paire.actuelle || !paire.actuelle.fin || !dateDuJour) return null;
    return joursEntre(paire.actuelle.fin, dateDuJour) - 1;
  }

  function paireFraiche(paire, options) {
    const age = agePaireJours(paire, dateDuJourDesOptions(options));
    return age !== null && age <= FRAICHEUR_MAX_JOURS;
  }

  // Règle 1. null si une durée ou la base T1 est nulle : jamais de chiffre inventé.
  function evolutionVentesMoyennes(valeurT2, dureeT2, valeurT1, dureeT1) {
    if (!(dureeT1 > 0) || !(dureeT2 > 0) || !(valeurT1 > 0)) return null;
    const moyT1 = valeurT1 / dureeT1;
    const moyT2 = (valeurT2 || 0) / dureeT2;
    return (moyT2 - moyT1) / moyT1;
  }

  // Règle 3 : plancher de T1 ramené à sa durée réelle.
  function planchersVolume(dureeT1) {
    const k = (dureeT1 > 0 ? dureeT1 : 0) / JOURS_REFERENCE_PLANCHER;
    return { ca: PLANCHER_CA_EUR * k, unites: PLANCHER_UNITES * k };
  }

  function volumeSuffisant(caT1, quantiteT1, dureeT1) {
    const f = planchersVolume(dureeT1);
    return (caT1 || 0) >= f.ca || (quantiteT1 || 0) >= f.unites;
  }

  // Rapport maximal toléré entre la durée de T1 et celle de T2 (arbitrage
  // du 10/11/2026). Strictement supérieur : exactement 2 n'est pas signalé.
  const RAPPORT_DUREES_MAX = 2;
  const MESSAGE_PRUDENCE = 'Comparaison à interpréter avec prudence';

  // Liste (AAAA-MM-JJ) des jours de debut à fin inclus, plafonnée par sécurité.
  function listeJours(debut, fin) {
    const out = [];
    for (let d = debut, i = 0; d <= fin && i < 400; d = ajouterJours(d, 1), i++) out.push(d);
    return out;
  }

  // Continuité entre T1 et T2 : fin T1 + 1 j doit valoir début T2. Les jours
  // non couverts sont listés avec leurs dates, jamais comblés ; un
  // chevauchement est signalé de la même façon.
  function continuitePaire(paire) {
    if (!paire || !paire.actuelle || !paire.precedente) return null;
    const finT1 = paire.precedente.fin, debutT2 = paire.actuelle.debut;
    const attendu = ajouterJours(finT1, 1);
    if (attendu === debutT2) return { ok: true, jours_non_couverts: [], chevauchement: [] };
    if (debutT2 > attendu) {
      return { ok: false, jours_non_couverts: listeJours(attendu, ajouterJours(debutT2, -1)), chevauchement: [] };
    }
    return { ok: false, jours_non_couverts: [], chevauchement: listeJours(debutT2, finT1) };
  }

  // Qualité de la comparaison T1/T2 (une fois par paire). Fiable = aucun
  // avertissement. Les jours sans vente ne sont détectés que si les lignes
  // portent un détail quotidien, ce qui n'est pas le cas de `products` :
  // le critère n'est donc pas évalué ici (voir rapport de PR).
  function qualiteComparaison(paire, options) {
    if (!paire || !paire.actuelle || !paire.precedente) {
      return { fiable: false, avertissements: [], rapport_durees: null, continuite: null, partielle: false };
    }
    const d1 = paire.precedente.duree, d2 = paire.actuelle.duree;
    const rapport = Math.min(d1, d2) > 0 ? Math.max(d1, d2) / Math.min(d1, d2) : null;
    const continuite = continuitePaire(paire);
    const partielle = paire.actuelle.fin >= dateDuJourDesOptions(options);
    const avertissements = [];
    if (rapport === null || rapport > RAPPORT_DUREES_MAX) avertissements.push(MESSAGE_PRUDENCE);
    if (partielle) avertissements.push('Période en cours : la dernière période n\u2019est pas terminée');
    if (continuite && continuite.jours_non_couverts.length) {
      avertissements.push('Jours non couverts entre les deux périodes : ' + continuite.jours_non_couverts.join(', '));
    }
    if (continuite && continuite.chevauchement.length) {
      avertissements.push('Les deux périodes se chevauchent : ' + continuite.chevauchement.join(', '));
    }
    return { fiable: avertissements.length === 0, avertissements, rapport_durees: rapport, continuite, partielle };
  }

  // Tendance d'un ARTICLE. v = { caT1, quantiteT1, caT2, quantiteT2 }.
  // statut : 'qualifiee' | 'perimee' | 'insuffisante' | 'indisponible'.
  // Seul 'qualifiee' porte des évolutions ; les autres n'ont jamais de pourcentage.
  // Traçabilité : dates, durées, totaux, moyennes par jour, continuité,
  // avertissements. `fiable` est faux dès qu'un avertissement existe ; une
  // recommandation commerciale fondée sur la seule tendance exige
  // `recommandable` (statut 'qualifiee' ET fiable).
  function tendanceArticle(v, paire, options) {
    const base = { statut: 'indisponible', evolutionCA: null, evolutionQuantite: null, message: null,
      fiable: false, recommandable: false, avertissements: [], continuite: null, rapport_durees: null,
      periodes: null, libelle_evolution: 'ventes moyennes par jour' };
    if (!paire || !paire.actuelle || !paire.precedente || !v) return base;
    const q = qualiteComparaison(paire, options);
    const d1 = paire.precedente.duree, d2 = paire.actuelle.duree;
    const tracabilite = {
      fiable: q.fiable, avertissements: q.avertissements, continuite: q.continuite, rapport_durees: q.rapport_durees,
      periodes: {
        t1: { debut: paire.precedente.debut, fin: paire.precedente.fin, duree: d1, ca: v.caT1 || 0, quantite: v.quantiteT1 || 0,
          ca_moyen_jour: d1 > 0 ? (v.caT1 || 0) / d1 : null, quantite_moyenne_jour: d1 > 0 ? (v.quantiteT1 || 0) / d1 : null },
        t2: { debut: paire.actuelle.debut, fin: paire.actuelle.fin, duree: d2, ca: v.caT2 || 0, quantite: v.quantiteT2 || 0,
          ca_moyen_jour: d2 > 0 ? (v.caT2 || 0) / d2 : null, quantite_moyenne_jour: d2 > 0 ? (v.quantiteT2 || 0) / d2 : null },
      },
    };
    const rien = { ...base, ...tracabilite, fiable: false };
    if (!paireFraiche(paire, options)) return { ...rien, statut: 'perimee' };
    const seuilCA = options && options.seuilCA != null ? options.seuilCA * (d1 / JOURS_REFERENCE_PLANCHER) : null;
    const f = planchersVolume(d1);
    const okVolume = ((v.caT1 || 0) >= (seuilCA != null ? seuilCA : f.ca)) || ((v.quantiteT1 || 0) >= f.unites);
    if (!okVolume) return { ...rien, statut: 'insuffisante', message: MESSAGE_VENTES_INSUFFISANTES };
    const evolutionCA = evolutionVentesMoyennes(v.caT2, d2, v.caT1, d1);
    const evolutionQuantite = evolutionVentesMoyennes(v.quantiteT2, d2, v.quantiteT1, d1);
    if (evolutionCA === null && evolutionQuantite === null) return rien;
    return { ...base, ...tracabilite, statut: 'qualifiee', evolutionCA, evolutionQuantite, recommandable: q.fiable };
  }

  // ============================================================
  // Résolution de périodes CALENDAIRES — ajout du 10/08/2026 pour
  // Rapport NEXUS (cahier des charges "cadrage développeur" du même
  // jour, §3 "Sélection de période").
  //
  // Différence de fond avec analyserPeriodes ci-dessus : là-haut, on ne
  // fait QUE trouver la meilleure paire parmi des périodes qui existent
  // déjà dans une table (les blocs d'import irréguliers de `products`).
  // Ici, le manager choisit une période CALENDAIRE arbitraire (semaine,
  // mois, trimestre, année, dates libres) — NEXUS doit la découper
  // lui-même, indépendamment de ce qui existe ou non dans une table.
  //
  // Ces fonctions sont pures (aucun accès Supabase) : elles calculent
  // seulement les bornes {debut, fin} de la période demandée et de sa
  // référence de comparaison. Aller chercher si des données couvrent
  // réellement ces bornes est la responsabilité de nexus-rapport-donnees.js
  // (colle Supabase), qui applique une cascade de sources et répond
  // explicitement "données insuffisantes" plutôt que de fabriquer un
  // chiffre — voir ce fichier pour le détail et sa justification
  // (constat du 10/08/2026 : products n'a que 4 blocs d'import non
  // calendaires, normalized_sales et audits_caisse sont quotidiens mais
  // encore peu profonds).
  // ============================================================

  function pad2(n) { return String(n).padStart(2, '0'); }
  function isoDate(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
  function ajouterJours(dateStr, n) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return isoDate(d);
  }
  // Lundi de la semaine contenant dateStr (convention ISO 8601, FR).
  function debutSemaine(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const jourIso = (d.getDay() + 6) % 7; // 0 = lundi ... 6 = dimanche
    d.setDate(d.getDate() - jourIso);
    return isoDate(d);
  }
  function dernierJourMois(annee, moisIndex0) { return isoDate(new Date(annee, moisIndex0 + 1, 0)); }

  const NOMS_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  /**
   * Découpe une période CALENDAIRE à partir d'une date d'ancrage (par
   * défaut aujourd'hui). `type` : 'semaine' | 'mois' | 'trimestre' |
   * 'annee' | 'libre'. Pour 'libre', fournir `bornesLibres: {debut, fin}`
   * (dates ISO déjà choisies par le manager) — la fonction se contente
   * alors de les valider et de calculer la durée.
   * Retourne { type, debut, fin, duree, label }.
   */
  function resoudrePeriodeCalendaire(type, dateAncrage, bornesLibres) {
    const ancrage = dateAncrage || isoDate(new Date());
    const d = new Date(ancrage + 'T00:00:00');

    if (type === 'semaine') {
      const debut = debutSemaine(ancrage);
      const fin = ajouterJours(debut, 6);
      return { type, debut, fin, duree: joursEntre(debut, fin), label: `Semaine du ${debut.split('-').reverse().join('/')}` };
    }
    if (type === 'mois') {
      const debut = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`;
      const fin = dernierJourMois(d.getFullYear(), d.getMonth());
      return { type, debut, fin, duree: joursEntre(debut, fin), label: `${NOMS_MOIS[d.getMonth()]} ${d.getFullYear()}` };
    }
    if (type === 'trimestre') {
      const q = Math.floor(d.getMonth() / 3);
      const debut = `${d.getFullYear()}-${pad2(q * 3 + 1)}-01`;
      const fin = dernierJourMois(d.getFullYear(), q * 3 + 2);
      return { type, debut, fin, duree: joursEntre(debut, fin), label: `T${q + 1} ${d.getFullYear()}` };
    }
    if (type === 'annee') {
      const debut = `${d.getFullYear()}-01-01`, fin = `${d.getFullYear()}-12-31`;
      return { type, debut, fin, duree: joursEntre(debut, fin), label: `${d.getFullYear()}` };
    }
    if (type === 'libre') {
      if (!bornesLibres || !bornesLibres.debut || !bornesLibres.fin) throw new Error('resoudrePeriodeCalendaire("libre") requiert bornesLibres:{debut,fin}.');
      const { debut, fin } = bornesLibres;
      return { type, debut, fin, duree: joursEntre(debut, fin), label: `${debut.split('-').reverse().join('/')} → ${fin.split('-').reverse().join('/')}` };
    }
    throw new Error(`resoudrePeriodeCalendaire : type de période inconnu "${type}".`);
  }

  /**
   * Calcule la ou les périodes de RÉFÉRENCE d'une période calendaire déjà
   * résolue, dans l'ordre de préférence donné par le cadrage développeur
   * (§3) : la première retournée est la référence principale, les
   * suivantes sont des replis à essayer SI la principale n'a pas de
   * données couvrant sa plage (jamais l'inverse — la référence la plus
   * proche dans le temps est toujours la plus pertinente si elle existe).
   * Retourne un tableau de { debut, fin, label } — jamais vide, mais le
   * chargeur de données (nexus-rapport-donnees.js) peut ne trouver de
   * données pour AUCUNE d'entre elles, auquel cas la comparaison doit
   * être affichée comme indisponible plutôt que fabriquée.
   *
   * `dateDuJourISO` (13/08/2026, demande directe de Frédéric, capture
   * NEXUS Carburants Pilotage : "18 413 L −54,5 %" sur une semaine
   * entamée depuis 3 jours comparée à une semaine précédente COMPLÈTE —
   * "le calcul actuel est mathématiquement défendable, mais visuellement
   * il raconte une histoire trompeuse") — par défaut aujourd'hui, mais
   * paramétrable pour rester une fonction pure et testable sans dépendre
   * de `new Date()` au moment de l'appel. Quand la période affichée n'est
   * pas terminée (`fin > dateDuJourISO`), chaque référence candidate est
   * TRONQUÉE au même nombre de jours écoulés depuis SON PROPRE début —
   * "toujours comparer ce qui est comparable", la règle proposée par
   * Frédéric, appliquée une seule fois ici plutôt que dupliquée en 5
   * variantes par type de période (semaine/mois/trimestre/année/libre
   * suivent donc tous exactement la même logique de troncature, aucun cas
   * particulier codé en dur). Une période déjà TERMINÉE (fin <=
   * dateDuJourISO) n'est jamais tronquée : elle continue de se comparer
   * intégralement à une référence intégrale, comme avant ce lot — aucun
   * changement de comportement pour un rapport sur une période passée.
   * Chaque référence tronquée porte `tronquee: true`, `finPeriodeComplete`
   * (la fin réelle du mois/trimestre/année de référence, pour qui voudrait
   * l'afficher) et `joursEcoules`, pour que l'écran puisse construire un
   * libellé honnête ("mêmes jours écoulés") plutôt que de laisser croire à
   * une période de référence complète.
   */
  function resoudrePeriodesReference(periode, dateDuJourISO) {
    const { type, debut, fin } = periode;
    const d = new Date(debut + 'T00:00:00');

    let candidats;
    if (type === 'semaine') {
      const debutPrec = ajouterJours(debut, -7), finPrec = ajouterJours(fin, -7);
      candidats = [{ debut: debutPrec, fin: finPrec, label: 'Semaine précédente' }];
    } else if (type === 'mois') {
      const moisPrec = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      const debutPrec = `${moisPrec.getFullYear()}-${pad2(moisPrec.getMonth() + 1)}-01`;
      const finPrec = dernierJourMois(moisPrec.getFullYear(), moisPrec.getMonth());
      const debutAnPrec = `${d.getFullYear() - 1}-${pad2(d.getMonth() + 1)}-01`;
      const finAnPrec = dernierJourMois(d.getFullYear() - 1, d.getMonth());
      candidats = [
        { debut: debutPrec, fin: finPrec, label: 'Mois précédent' },
        { debut: debutAnPrec, fin: finAnPrec, label: `${NOMS_MOIS[d.getMonth()]} ${d.getFullYear() - 1} (même mois, année précédente)` },
      ];
    } else if (type === 'trimestre') {
      const q = Math.floor(d.getMonth() / 3);
      const moisDebutTrimPrec = q * 3 - 3;
      const anneeTrimPrec = moisDebutTrimPrec < 0 ? d.getFullYear() - 1 : d.getFullYear();
      const moisTrimPrec = ((moisDebutTrimPrec % 12) + 12) % 12;
      const debutPrec = `${anneeTrimPrec}-${pad2(moisTrimPrec + 1)}-01`;
      const finPrec = dernierJourMois(anneeTrimPrec, moisTrimPrec + 2);
      const debutAnPrec = `${d.getFullYear() - 1}-${pad2(q * 3 + 1)}-01`;
      const finAnPrec = dernierJourMois(d.getFullYear() - 1, q * 3 + 2);
      candidats = [
        { debut: debutPrec, fin: finPrec, label: 'Trimestre précédent' },
        { debut: debutAnPrec, fin: finAnPrec, label: `T${q + 1} ${d.getFullYear() - 1} (même trimestre, année précédente)` },
      ];
    } else if (type === 'annee') {
      candidats = [{ debut: `${d.getFullYear() - 1}-01-01`, fin: `${d.getFullYear() - 1}-12-31`, label: 'Année précédente' }];
    } else {
      // 'libre' : période précédente de même durée, immédiatement avant.
      const jours = joursEntre(debut, fin);
      candidats = [{ debut: ajouterJours(debut, -jours), fin: ajouterJours(debut, -1), label: 'Période précédente de même durée' }];
    }

    const dateDuJour = dateDuJourISO || isoDate(new Date());
    if (fin <= dateDuJour) return candidats; // période déjà terminée : jamais tronquée

    const joursEcoules = Math.max(1, joursEntre(debut, dateDuJour));
    return candidats.map(c => {
      const finPeriodeComplete = c.fin;
      const dureeCandidatComplet = joursEntre(c.debut, finPeriodeComplete);
      const finVoulue = ajouterJours(c.debut, joursEcoules - 1);
      // Jamais dépasser la fin réelle du candidat (ex. comparer un mois de
      // 31 jours entamé au jour 30 à un février de référence : on s'arrête
      // à la fin réelle de février, la troncature "à avancement égal"
      // atteint alors sa limite honnête plutôt que de fabriquer des jours
      // qui n'existent pas dans le mois de référence). `couvertureInsuffisante`
      // signale précisément ce cas résiduel à l'écran, pour qu'il l'affiche
      // plutôt que de laisser croire à une troncature parfaite.
      const finRetenue = finVoulue < finPeriodeComplete ? finVoulue : finPeriodeComplete;
      const couvertureInsuffisante = dureeCandidatComplet < joursEcoules;
      return { ...c, fin: finRetenue, finPeriodeComplete, tronquee: finRetenue !== finPeriodeComplete, joursEcoules, couvertureInsuffisante };
    });
  }

  // ============================================================
  // Regroupement par MOIS CALENDAIRE — ajout du 11/08/2026 pour le chapitre
  // "Trajectoire" du Rapport NEXUS de Direction (demande de Frédéric :
  // "12 derniers mois" avec courbes CA/marge). `products` n'est pas un flux
  // quotidien : c'est une suite de blocs d'import aux bornes irrégulières
  // (periode_debut/periode_fin saisies à l'import), qui ne coïncident pas
  // avec les mois calendaires. Il n'existe aucune mesure infra-bloc — NEXUS
  // ne sait pas combien du CA d'un bloc a été fait tel jour précis.
  //
  // Méthode choisie, documentée pour rester honnête plutôt que de simuler
  // une fausse précision : chaque bloc est intégralement rattaché au mois
  // calendaire de SON periode_debut (pas de répartition au prorata des
  // jours, qui donnerait une illusion de précision journalière que les
  // données ne permettent pas). Un bloc à cheval sur plusieurs mois calendaires
  // (periode_debut et periode_fin dans des mois différents) est signalé
  // (`blocsPartiels`) pour que l'écran/le PDF affiche la réserve — jamais
  // caché.
  function regrouperParMoisCalendaire(rows, options) {
    const champDebut = (options && options.champDebut) || 'periode_debut';
    const champFin = (options && options.champFin) || 'periode_fin';
    const champCa = (options && options.champCa) || 'ca';
    const champMarge = (options && options.champMarge) || 'marge';

    const parMois = {};
    let blocsPartiels = 0;
    const blocsVus = new Set();
    (rows || []).forEach(r => {
      const debut = r[champDebut], fin = r[champFin];
      if (!debut) return;
      const cleBloc = `${debut}|${fin}`;
      if (fin && debut.slice(0, 7) !== fin.slice(0, 7) && !blocsVus.has(cleBloc)) {
        blocsVus.add(cleBloc);
        blocsPartiels++;
      }
      const moisCle = debut.slice(0, 7); // 'YYYY-MM'
      if (!parMois[moisCle]) parMois[moisCle] = { moisCle, ca: 0, marge: 0, nbLignes: 0 };
      parMois[moisCle].ca += r[champCa] || 0;
      parMois[moisCle].marge += r[champMarge] || 0;
      parMois[moisCle].nbLignes += 1;
    });

    const mois = Object.values(parMois).sort((a, b) => a.moisCle.localeCompare(b.moisCle)).map(m => {
      const [annee, moisIdx] = m.moisCle.split('-');
      return { ...m, label: `${NOMS_MOIS[parseInt(moisIdx, 10) - 1]} ${annee}` };
    });

    return { mois, blocsPartiels, methode: 'affectation_debut_bloc' };
  }

  global.NexusPeriodes = {
    joursEntre, paireValide, analyserPeriodes, evolutionAgregee,
    resoudrePeriodeCalendaire, resoudrePeriodesReference, regrouperParMoisCalendaire,
    // ajouterJours (22/08/2026, correction du crash "ajouterJours is not a
    // function" bloquant tout Brief NEXUS) : utilisée en interne ici depuis
    // le début, jamais exposée publiquement — nexus-brief-donnees.js
    // (chargerCarburantsBriefAvecFallback, v2.215) l'appelle depuis
    // l'extérieur du module pour calculer J-1, ce qui exigeait qu'elle soit
    // exportée. Réutilise la même fonction qu'en interne (Article 11,
    // jamais une deuxième implémentation d'un simple "date + n jours").
    ajouterJours,
    // Tendances (lot 1 Produits, PR B) — règle commune, fonctions pures.
    FRAICHEUR_MAX_JOURS, JOURS_REFERENCE_PLANCHER, PLANCHER_CA_EUR, PLANCHER_UNITES,
    MESSAGE_VENTES_INSUFFISANTES, MESSAGE_PRUDENCE,
    dateDuJourStation, agePaireJours, paireFraiche, evolutionVentesMoyennes,
    planchersVolume, volumeSuffisant, tendanceArticle,
    RAPPORT_DUREES_MAX, continuitePaire, qualiteComparaison,
  };
})(window);
