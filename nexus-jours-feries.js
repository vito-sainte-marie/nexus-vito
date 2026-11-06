// Jours fériés de la station (Martinique), partagés par Tempo et Paye (06/11/2026).
// Un seul calcul : les fériés nationaux (Pâques et dérivés compris) et le 22 mai.
// Faits de calendrier, pas des données saisies : ils se calculent pour n'importe quelle année.
const NexusJoursFeries = (function () {
  function datePaques(annee) {
    const a = annee % 19, b = Math.floor(annee / 100), c = annee % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const moisJour = h + l - 7 * m + 114;
    const mois = Math.floor(moisJour / 31); // 3 = mars, 4 = avril
    const jour = (moisJour % 31) + 1;
    return new Date(annee, mois - 1, jour, 12);
  }

  function joursFeries(annee) {
    const iso = d => d.toISOString().slice(0, 10);
    const decaler = (date, jours) => { const d2 = new Date(date); d2.setDate(d2.getDate() + jours); return d2; };
    const paques = datePaques(annee);
    return [
      { date: `${annee}-01-01`, nom: "Jour de l'an" },
      { date: iso(decaler(paques, 1)), nom: 'Lundi de Pâques' },
      { date: `${annee}-05-01`, nom: 'Fête du Travail' },
      { date: `${annee}-05-08`, nom: 'Victoire 1945' },
      { date: iso(decaler(paques, 39)), nom: 'Ascension' },
      { date: iso(decaler(paques, 50)), nom: 'Lundi de Pentecôte' },
      { date: `${annee}-07-14`, nom: 'Fête Nationale' },
      { date: `${annee}-08-15`, nom: 'Assomption' },
      { date: `${annee}-11-01`, nom: 'Toussaint' },
      { date: `${annee}-11-11`, nom: 'Armistice' },
      { date: `${annee}-12-25`, nom: 'Noël' },
    ];
  }

  function estJourFerie(dateStr) {
    const annee = Number(dateStr.slice(0, 4));
    const trouve = joursFeries(annee).find(f => f.date === dateStr);
    return { ferie: !!trouve, nom: trouve ? trouve.nom : null };
  }

  // Jours fériés Martinique (25/07/2026) : les jours fériés nationaux plus le 22 mai
  // (Abolition de l'esclavage, loi n°83-550 du 30/06/1983), fixe chaque année.
  function joursFeriesMartinique(annee) {
    const feries = joursFeries(annee).slice();
    feries.push({ date: `${annee}-05-22`, nom: "Abolition de l'esclavage (Martinique)" });
    return feries.sort((a, b) => a.date < b.date ? -1 : 1);
  }

  function estJourFerieMartinique(dateStr) {
    const annee = Number(dateStr.slice(0, 4));
    const trouve = joursFeriesMartinique(annee).find(f => f.date === dateStr);
    return { ferie: !!trouve, nom: trouve ? trouve.nom : null };
  }

  return { datePaques, joursFeries, estJourFerie, joursFeriesMartinique, estJourFerieMartinique };
})();
if (typeof window !== 'undefined') window.NexusJoursFeries = NexusJoursFeries;
if (typeof module !== 'undefined' && module.exports) module.exports = NexusJoursFeries;
