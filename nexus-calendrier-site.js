// nexus-calendrier-site.js — calcul partagé du calendrier du site (10/11/2026).
// Une seule source de calcul pour : l'épreuve, le workflow des jours fériés (1er janvier) et le workflow
// des vacances (1er du mois). Aucun accès réseau, aucune écriture : il ne fait que calculer.
//
// 1) Fériés du site : 14 jours par an (les 12 de la Martinique + Vendredi saint + Victor Schœlcher).
//    NexusJoursFeries (11 et 12 jours) reste intact : il sert Tempo et Paye.
//    Arithmétique en UTC pur : aucune dépendance au fuseau de la machine.
// 2) Vacances : lues dans data.education.gouv.fr, jeu « fr-en-calendrier-scolaire ». Les dates y sont des
//    minuits de Paris exprimés en UTC : on les reconvertit en date locale Europe/Paris.
//    Jamais une date estimée : une période sans fin publiée est ignorée.
//    Convention : début ET fin inclus (même convention que la liste figée de Tempo).
(function (global) {
  'use strict';

  var ACADEMIES = ['Aix-Marseille', 'Amiens', 'Besançon', 'Bordeaux', 'Caen', 'Clermont-Ferrand', 'Corse', 'Créteil',
    'Dijon', 'Grenoble', 'Guadeloupe', 'Guyane', 'Lille', 'Limoges', 'Lyon', 'Martinique', 'Mayotte', 'Montpellier',
    'Nancy-Metz', 'Nantes', 'Nice', 'Normandie', 'Nouvelle Calédonie', 'Orléans-Tours', 'Paris', 'Poitiers',
    'Polynésie', 'Reims', 'Rennes', 'Rouen', 'Réunion', 'Saint Pierre et Miquelon', 'Strasbourg', 'Toulouse',
    'Versailles', 'Wallis et Futuna'];

  var SOURCE_URL = 'https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records';
  var POPULATIONS_RETENUES = ['-', 'Élèves'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function isoUTC(ms) { var d = new Date(ms); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }

  // Pâques (calendrier grégorien), en millisecondes UTC à minuit.
  function paquesUTC(annee) {
    var a = annee % 19, b = Math.floor(annee / 100), c = annee % 100;
    var d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    var g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    var i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    var m = Math.floor((a + 11 * h + 22 * l) / 451);
    var mj = h + l - 7 * m + 114;
    return Date.UTC(annee, Math.floor(mj / 31) - 1, (mj % 31) + 1);
  }

  function feriesSite(annee) {
    var J = 86400000, p = paquesUTC(annee), y = String(annee);
    var liste = [
      { date: y + '-01-01', libelle: "Jour de l'An" },
      { date: isoUTC(p - 2 * J), libelle: 'Vendredi saint' },
      { date: isoUTC(p + 1 * J), libelle: 'Lundi de Pâques' },
      { date: y + '-05-01', libelle: 'Fête du Travail' },
      { date: y + '-05-08', libelle: 'Victoire 1945' },
      { date: isoUTC(p + 39 * J), libelle: 'Ascension' },
      { date: y + '-05-22', libelle: "Abolition de l'esclavage (Martinique)" },
      { date: isoUTC(p + 50 * J), libelle: 'Lundi de Pentecôte' },
      { date: y + '-07-14', libelle: 'Fête nationale' },
      { date: y + '-07-21', libelle: 'Victor Schœlcher' },
      { date: y + '-08-15', libelle: 'Assomption' },
      { date: y + '-11-01', libelle: 'Toussaint' },
      { date: y + '-11-11', libelle: 'Armistice 1918' },
      { date: y + '-12-25', libelle: 'Noël' }
    ];
    liste.sort(function (x, z) { return x.date < z.date ? -1 : x.date > z.date ? 1 : 0; });
    return liste;
  }

  // Instant ISO -> date locale Europe/Paris (AAAA-MM-JJ).
  function dateParis(instant) {
    var parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instant));
    return parts; // en-CA donne déjà AAAA-MM-JJ
  }

  // Périodes officielles d'une académie : [{ libelle, debut, fin }], dédoublonnées, triées.
  // Ignore : une autre académie, une population non retenue (Enseignants), une période sans fin publiée.
  function periodesDepuisSource(enregistrements, academie) {
    var vues = {}, sortie = [];
    (enregistrements || []).forEach(function (r) {
      if (!r || r.location !== academie) return;
      if (POPULATIONS_RETENUES.indexOf(r.population == null ? '-' : r.population) < 0) return;
      if (!r.start_date || !r.end_date || !r.description) return;
      var p = { libelle: String(r.description), debut: dateParis(r.start_date), fin: dateParis(r.end_date) };
      if (p.fin < p.debut) return;
      var cle = p.libelle + '|' + p.debut + '|' + p.fin;
      if (vues[cle]) return;
      vues[cle] = 1; sortie.push(p);
    });
    sortie.sort(function (x, z) { return x.debut < z.debut ? -1 : x.debut > z.debut ? 1 : 0; });
    return sortie;
  }

  // Une ligne par jour de chaque période (début et fin inclus).
  function joursDesPeriodes(periodes) {
    var lignes = [];
    periodes.forEach(function (p) {
      var a = p.debut.split('-'), z = p.fin.split('-');
      var t = Date.UTC(+a[0], +a[1] - 1, +a[2]), fin = Date.UTC(+z[0], +z[1] - 1, +z[2]);
      for (; t <= fin; t += 86400000) lignes.push({ date: isoUTC(t), type: 'vacances', libelle: p.libelle });
    });
    return lignes;
  }

  // Seules les périodes qui touchent la fenêtre [du, au] (AAAA-MM-JJ) sont gardées.
  function periodesDansFenetre(periodes, du, au) {
    return periodes.filter(function (p) { return p.fin >= du && p.debut <= au; });
  }

  function q(s) { return "'" + String(s).replace(/'/g, "''") + "'"; }

  // INSERT idempotent : jamais d'écrasement, jamais de suppression. created_by reste nul.
  function sqlInsertCalendrier(site, lignes) {
    if (!lignes.length) return '';
    var vals = lignes.map(function (l) { return '  (' + q(site) + ', ' + q(l.date) + ', ' + q(l.type) + ', ' + q(l.libelle) + ')'; }).join(',\n');
    return 'insert into public.inventaire_calendrier_site (site, date, type, libelle)\nvalues\n' + vals + '\non conflict (site, date, type) do nothing;';
  }

  global.NexusCalendrierSite = {
    ACADEMIES: ACADEMIES, SOURCE_URL: SOURCE_URL, POPULATIONS_RETENUES: POPULATIONS_RETENUES,
    paquesUTC: paquesUTC, feriesSite: feriesSite, dateParis: dateParis,
    periodesDepuisSource: periodesDepuisSource, joursDesPeriodes: joursDesPeriodes,
    periodesDansFenetre: periodesDansFenetre, sqlInsertCalendrier: sqlInsertCalendrier
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.NexusCalendrierSite;
})(typeof window !== 'undefined' ? window : globalThis);
