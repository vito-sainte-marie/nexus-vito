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

  global.NexusPeriodes = { joursEntre, paireValide, analyserPeriodes, evolutionAgregee };
})(window);
