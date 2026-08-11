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
// Inclure dans une page : <script src="nexus-periodes.js"></script>
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
    for (let i = 0; i < periodesTriees.length - 1 && !paire; i++) {
      if (paireValide(periodesTriees[i], periodesTriees[i + 1])) {
        paire = { actuelle: periodesTriees[i], precedente: periodesTriees[i + 1] };
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
   */
  function resoudrePeriodesReference(periode) {
    const { type, debut, fin } = periode;
    const d = new Date(debut + 'T00:00:00');

    if (type === 'semaine') {
      const debutPrec = ajouterJours(debut, -7), finPrec = ajouterJours(fin, -7);
      return [{ debut: debutPrec, fin: finPrec, label: 'Semaine précédente' }];
    }
    if (type === 'mois') {
      const moisPrec = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      const debutPrec = `${moisPrec.getFullYear()}-${pad2(moisPrec.getMonth() + 1)}-01`;
      const finPrec = dernierJourMois(moisPrec.getFullYear(), moisPrec.getMonth());
      const debutAnPrec = `${d.getFullYear() - 1}-${pad2(d.getMonth() + 1)}-01`;
      const finAnPrec = dernierJourMois(d.getFullYear() - 1, d.getMonth());
      return [
        { debut: debutPrec, fin: finPrec, label: 'Mois précédent' },
        { debut: debutAnPrec, fin: finAnPrec, label: `${NOMS_MOIS[d.getMonth()]} ${d.getFullYear() - 1} (même mois, année précédente)` },
      ];
    }
    if (type === 'trimestre') {
      const q = Math.floor(d.getMonth() / 3);
      const moisDebutTrimPrec = q * 3 - 3;
      const anneeTrimPrec = moisDebutTrimPrec < 0 ? d.getFullYear() - 1 : d.getFullYear();
      const moisTrimPrec = ((moisDebutTrimPrec % 12) + 12) % 12;
      const debutPrec = `${anneeTrimPrec}-${pad2(moisTrimPrec + 1)}-01`;
      const finPrec = dernierJourMois(anneeTrimPrec, moisTrimPrec + 2);
      const debutAnPrec = `${d.getFullYear() - 1}-${pad2(q * 3 + 1)}-01`;
      const finAnPrec = dernierJourMois(d.getFullYear() - 1, q * 3 + 2);
      return [
        { debut: debutPrec, fin: finPrec, label: 'Trimestre précédent' },
        { debut: debutAnPrec, fin: finAnPrec, label: `T${q + 1} ${d.getFullYear() - 1} (même trimestre, année précédente)` },
      ];
    }
    if (type === 'annee') {
      return [{ debut: `${d.getFullYear() - 1}-01-01`, fin: `${d.getFullYear() - 1}-12-31`, label: 'Année précédente' }];
    }
    // 'libre' : période précédente de même durée, immédiatement avant.
    const jours = joursEntre(debut, fin);
    return [{ debut: ajouterJours(debut, -jours), fin: ajouterJours(debut, -1), label: 'Période précédente de même durée' }];
  }

  global.NexusPeriodes = {
    joursEntre, paireValide, analyserPeriodes, evolutionAgregee,
    resoudrePeriodeCalendaire, resoudrePeriodesReference,
  };
})(window);
