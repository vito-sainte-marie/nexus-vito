// nexus-carburant-marqueur-calendrier.js — marqueur calendrier de l'en-tête Carburants Performance (10/11/2026).
// AFFICHAGE SEULEMENT : aucune écriture, aucun calcul de stock, de consommation, d'autonomie ni de prévision.
//
// Deux niveaux, jamais mélangés :
//  1) fait de calendrier : un férié (inventaire_calendrier_site, type 'ferie'), affiché « <indicateur> : <nom> — <date courte> » ;
//  2) vigilance          : UN message sous les badges, de J-3 à J-1, avec l'heure limite de station_config.carburant_commande_config.cutoff_heure
//     (jamais 11 h en dur). Heure absente : message qui n'affirme rien sur l'heure.
// Le marqueur n'affirme jamais une absence de livraison : il ne lit pas la règle de livraison.
// Les vacances scolaires sont un repère secondaire : jamais assimilées à une fermeture fournisseur ni à une interruption de livraison.
// Les dates sont celles de la STATION (fuseau station_config.fuseau_horaire), jamais UTC ni le fuseau du navigateur.
(function (global) {
  'use strict';

  var HORIZON_JOURS = 3; // un férié est annoncé de J-3 à J

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // Date AAAA-MM-JJ et heure HH:MM dans le fuseau de la station, pour un instant donné.
  function dateHeureLocales(instantMs, fuseau) {
    var p = {};
    new Intl.DateTimeFormat('en-CA', { timeZone: fuseau || 'America/Martinique', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(instantMs)).forEach(function (x) { p[x.type] = x.value; });
    var h = p.hour === '24' ? '00' : p.hour;
    return { dateISO: p.year + '-' + p.month + '-' + p.day, heureHHMM: h + ':' + p.minute };
  }

  // Écart en jours entre deux dates pures (arithmétique à midi UTC : indépendante du fuseau de la machine).
  function ecartJours(deISO, aISO) {
    var d = deISO.split('-'), a = aISO.split('-');
    return Math.round((Date.UTC(+a[0], +a[1] - 1, +a[2], 12) - Date.UTC(+d[0], +d[1] - 1, +d[2], 12)) / 86400000);
  }

  function heureValide(h) { return typeof h === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(h); }

  // Nom affiché : le libellé sans l'année finale (« Armistice 1918 » → « Armistice »). La donnée n'est pas modifiée.
  function nomAffiche(libelle) {
    var n = String(libelle).replace(/\s+(1[5-9]|20)\d{2}\s*$/, '').trim();
    return n || String(libelle);
  }

  // Vacances : libellé court (« Vacances de la Toussaint » → « Toussaint »). Affichage seulement.
  function vacancesCourt(libelle) {
    var n = String(libelle).replace(/^\s*Vacances\s+(?:de\s+la\s+|de\s+l['’]\s*|du\s+|des\s+|de\s+|d['’]\s*)/i, '').trim();
    return n ? n.charAt(0).toUpperCase() + n.slice(1) : String(libelle);
  }

  var JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
  var MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  // Date courte « mer. 11 nov. » : date pure AAAA-MM-JJ, calcul à midi UTC, indépendant du fuseau de la machine.
  function dateCourte(dateISO) {
    var a = dateISO.split('-'), d = new Date(Date.UTC(+a[0], +a[1] - 1, +a[2], 12));
    return JOURS[d.getUTCDay()] + ' ' + (+a[2]) + ' ' + MOIS[+a[1] - 1];
  }

  function indicateur(delta) {
    if (delta === 0) return 'Aujourd’hui';
    if (delta === 1) return 'Demain';
    return 'Dans ' + delta + ' jours';
  }

  // « 11:00 » → « 11 h », « 11:30 » → « 11 h 30 », « 09:05 » → « 9 h 05 ».
  function heureFr(hhmm) {
    var p = hhmm.split(':'), h = String(+p[0]);
    return p[1] === '00' ? h + ' h' : h + ' h ' + p[1];
  }

  function messageContextuel(cutoff, heureHHMM) {
    if (!heureValide(cutoff)) return 'Anticipez vos besoins en carburant. Vérifiez vos besoins avant la prochaine commande.';
    var h = heureFr(cutoff);
    if (heureValide(heureHHMM) && heureHHMM >= cutoff) return 'L’heure limite habituelle de commande (' + h + ') est dépassée. Vérifiez vos approvisionnements à venir.';
    return 'Anticipez vos besoins en carburant. Vérifiez vos stocks et vos commandes avant ' + h + '.';
  }

  // Cœur pur. entree : { dateISO, heureHHMM, calendrier:[{date,type,libelle}]|null, config }.
  // Retourne null (rien à afficher) ou { principal, vacances, complement, signaux }.
  function evaluer(entree) {
    if (!entree || !entree.dateISO || !Array.isArray(entree.calendrier) || !entree.calendrier.length) return null;
    var cal = entree.calendrier.filter(function (l) { return l && l.date && l.libelle; });
    var feries = cal.filter(function (l) { return l.type === 'ferie'; });
    var vacances = cal.filter(function (l) { return l.type === 'vacances' && l.date === entree.dateISO; })[0] || null;

    // Le férié le plus proche, de J (aujourd'hui) à J-3 ; une seule ligne même si deux fériés se suivent.
    var proche = null;
    feries.forEach(function (l) {
      var d = ecartJours(entree.dateISO, l.date);
      if (d < 0 || d > HORIZON_JOURS) return;
      if (!proche || d < proche.delta) proche = { delta: d, date: l.date, libelle: String(l.libelle) };
    });

    var principal = null, complement = null, signaux = [];
    if (proche) {
      var nom = nomAffiche(proche.libelle);
      principal = { type: 'ferie', delta: proche.delta, dateISO: proche.date, libelle: nom, texte: indicateur(proche.delta) + ' : ' + nom + ' — ' + dateCourte(proche.date) };
      // Un seul message, de J-3 à J-1 ; aucun le jour J.
      if (proche.delta >= 1) {
        var cfg = entree.config, cutoff = cfg && cfg.cutoff_heure;
        complement = messageContextuel(cutoff, entree.heureHHMM);
        if (!heureValide(cutoff)) signaux.push('cutoff_heure_absente');
      }
    }
    if (!principal && !vacances) return null;
    var court = vacances ? vacancesCourt(vacances.libelle) : null;
    return { principal: principal, vacances: vacances ? { libelle: court, texte: 'Vacances scolaires : ' + court } : null, complement: complement, signaux: signaux };
  }

  var ICONE = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="2" y="3" width="12" height="11" rx="2"/><path d="M2 6.5h12M5.5 1.8v2.4M10.5 1.8v2.4"/></svg>';

  function rendreHTML(res, apercu) {
    if (!res) return '';
    var h = '';
    if (res.principal) {
      h += '<span class="mcal-pastille mcal-ferie" data-mcal="ferie" data-delta="' + res.principal.delta + '">' + ICONE
        + '<span class="mcal-texte">' + esc(res.principal.texte) + '</span></span>';
    }
    if (res.vacances) h += '<span class="mcal-pastille mcal-vacances" data-mcal="vacances"><span class="mcal-texte">' + esc(res.vacances.texte) + '</span></span>';
    if (res.complement) h += '<span class="mcal-complement" data-mcal="complement">' + esc(res.complement) + '</span>';
    if (apercu) h += '<span class="mcal-apercu">aperçu</span>';
    return h;
  }

  var CSS = [
    '.marqueur-cal{display:flex;flex-wrap:wrap;gap:6px 8px;align-items:center;margin-top:8px;max-width:100%}',
    '.marqueur-cal[hidden]{display:none}',
    '.mcal-pastille{display:inline-flex;align-items:center;gap:6px;max-width:100%;padding:5px 11px;border:1px solid var(--hairline,#242E38);border-radius:999px;background:var(--panel-raised,#1A222C);color:var(--text,#EDF1F5);font:500 12px/1.3 var(--sans,"IBM Plex Sans",sans-serif)}',
    '.mcal-pastille svg{width:14px;height:14px;flex:none;color:var(--text-mid,#8A96A5)}',
    '.mcal-texte{min-width:0;overflow-wrap:anywhere}',
    '.mcal-vacances{color:var(--text-mid,#8A96A5);font-weight:400}',
    '.mcal-complement{flex:1 1 100%;font:400 12px/1.4 var(--sans,"IBM Plex Sans",sans-serif);color:var(--text-mid,#8A96A5)}',
    '.mcal-apercu{font:600 10px/1 var(--mono,"IBM Plex Mono",monospace);text-transform:uppercase;letter-spacing:.06em;color:var(--text-mid,#8A96A5);border:1px dashed var(--hairline,#242E38);border-radius:4px;padding:2px 5px}',
    ':root[data-theme="jour"] .mcal-pastille{background:#E6EDF2;border-color:#C7D5DF;color:#1B2733}',
    ':root[data-theme="jour"] .mcal-pastille svg,:root[data-theme="jour"] .mcal-vacances,:root[data-theme="jour"] .mcal-complement,:root[data-theme="jour"] .mcal-apercu{color:#425466}',
    '@media (max-width:600px){.mcal-pastille{font-size:12px;padding:5px 10px}}'
  ].join('\n');

  function injecterCss() {
    if (typeof document === 'undefined' || document.getElementById('nexus-marqueur-calendrier-css')) return;
    var s = document.createElement('style'); s.id = 'nexus-marqueur-calendrier-css'; s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  // Lecture de la MÊME table que le moteur (inventaire_calendrier_site), filtrée par site, sous RLS, sur une fenêtre courte.
  // Erreur ou table vide : null, jamais de donnée inventée.
  async function chargerCalendrier(client, siteId, dateISO) {
    try {
      var fin = new Date(Date.UTC(+dateISO.slice(0, 4), +dateISO.slice(5, 7) - 1, +dateISO.slice(8, 10) + HORIZON_JOURS + 1)).toISOString().slice(0, 10);
      var r = await client.from('inventaire_calendrier_site').select('date,type,libelle')
        .eq('site', siteId).in('type', ['ferie', 'vacances']).gte('date', dateISO).lte('date', fin);
      if (r.error) { console.error('Marqueur calendrier:', r.error); return null; }
      return r.data || [];
    } catch (e) { console.error('Marqueur calendrier:', e); return null; }
  }

  // Aperçu SANS écriture : ?marqueur_date=AAAA-MM-JJ, ?marqueur_heure=HH:MM, ?marqueur_calendrier=demo|vide|erreur.
  // Tout reste en mémoire ; le rendu porte alors la mention « aperçu ».
  function lireApercu(search) {
    var q; try { q = new URLSearchParams(search || ''); } catch (_) { return null; }
    var d = q.get('marqueur_date'), h = q.get('marqueur_heure'), c = q.get('marqueur_calendrier');
    if (!d && !h && !c) return null;
    return { dateISO: /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : null, heureHHMM: heureValide(h) ? h : null, calendrier: c };
  }

  // Démo en mémoire, alignée sur les données réelles : Armistice le 2026-11-11 ; Toussaint (Martinique) du 2026-10-20 au 2026-11-02.
  function calendrierDemo(dateISO) {
    var l = [{ date: '2026-11-11', type: 'ferie', libelle: 'Armistice 1918' }];
    if (dateISO >= '2026-10-20' && dateISO <= '2026-11-02') l.push({ date: dateISO, type: 'vacances', libelle: 'Vacances de la Toussaint' });
    return l;
  }

  // Branche le marqueur dans l'en-tête. ctx : { client, siteId, fuseau(), config(), conteneur, search }.
  async function monter(ctx) {
    var el = ctx.conteneur; if (!el) return;
    injecterCss();
    var apercu = lireApercu(ctx.search);
    var cache = { cle: null, calendrier: null };
    async function rafraichir() {
      var maintenant = dateHeureLocales(Date.now(), ctx.fuseau());
      var dateISO = (apercu && apercu.dateISO) || maintenant.dateISO;
      var heure = (apercu && apercu.heureHHMM) || maintenant.heureHHMM;
      if (cache.cle !== dateISO) {
        if (apercu && apercu.calendrier === 'vide') cache.calendrier = [];
        else if (apercu && apercu.calendrier === 'erreur') cache.calendrier = null;
        else if (apercu && apercu.calendrier === 'demo') cache.calendrier = calendrierDemo(dateISO);
        else cache.calendrier = await chargerCalendrier(ctx.client, ctx.siteId, dateISO);
        cache.cle = dateISO;
      }
      var res = evaluer({ dateISO: dateISO, heureHHMM: heure, calendrier: cache.calendrier, config: ctx.config() });
      el.innerHTML = rendreHTML(res, !!apercu);
      el.hidden = !res;
    }
    await rafraichir();
    // Le changement de jour se fait à minuit LOCAL de la station : réévaluation chaque minute (pur, sans requête sauf nouveau jour).
    if (!apercu || !apercu.dateISO) setInterval(rafraichir, 60000);
    return rafraichir;
  }

  global.NexusCarburantMarqueurCalendrier = {
    HORIZON_JOURS: HORIZON_JOURS, nomAffiche: nomAffiche, vacancesCourt: vacancesCourt, dateCourte: dateCourte, heureFr: heureFr, dateHeureLocales: dateHeureLocales, ecartJours: ecartJours, evaluer: evaluer, rendreHTML: rendreHTML,
    calendrierDemo: calendrierDemo, chargerCalendrier: chargerCalendrier, lireApercu: lireApercu, monter: monter, injecterCss: injecterCss, _CSS: CSS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.NexusCarburantMarqueurCalendrier;
})(typeof window !== 'undefined' ? window : globalThis);
