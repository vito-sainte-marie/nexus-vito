// NEXUS Carburants — finition mobile / cohérence de libellés (01/09/2026)
(function (global) {
  'use strict';
  if ((location.pathname.split('/').pop() || '').toLowerCase() !== 'nexus-carburants-pilotage-v1.html') return;

  let observer = null;
  let raf = null;
  let siteCache = null;
  let p0Cache = null;
  let fuseauCache = null;
  let fuseauRefuse = false;

  function clientNexus() {
    try { return typeof nexusClient !== 'undefined' ? nexusClient : (global.nexusClient || null); }
    catch (e) { return global.nexusClient || null; }
  }

  function dateFrLisible(iso) {
    if (!iso) return '';
    const d = new Date(`${iso}T12:00:00`);
    const jour = d.getDate() === 1 ? '1er' : String(d.getDate());
    const mois = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
    return `${jour} ${mois}. ${d.getFullYear()}`;
  }

  async function siteCourant() {
    if (siteCache) return siteCache;
    const client = clientNexus();
    if (!client) return null;
    const s = await client.auth.getSession();
    const uid = s && s.data && s.data.session && s.data.session.user ? s.data.session.user.id : null;
    if (!uid) return null;
    const q = await client.from('employees').select('site_id,est_createur').eq('id', uid).maybeSingle();
    if (q.error || !q.data) return null;
    let site = q.data.site_id;
    if (q.data.est_createur) {
      const consulte = localStorage.getItem('nexus_site_consulte_createur');
      if (consulte) site = consulte;
    }
    siteCache = site;
    return site;
  }

  // Le fuseau de la station, mémorisé comme le site l'est : `appliquer` est
  // rappelé à chaque image du MutationObserver. Une configuration absente est
  // mémorisée elle aussi — elle ne se répare pas en cours de page, et la
  // redemander à chaque image produirait une lecture réseau et une ligne de
  // journal par image. Une panne RÉSEAU n'est pas mémorisée : elle peut cesser.
  async function fuseauCourant() {
    if (fuseauCache) return fuseauCache;
    if (fuseauRefuse) return null;
    const S = global.NexusStation;
    if (!S || !S.fuseauDeLaStation) return null;
    const site = await siteCourant();
    if (!site) return null;
    const f = await S.fuseauDeLaStation(site);
    if (f && f.timezone) { fuseauCache = f.timezone; return fuseauCache; }
    if (f && f.indetermine === 'configuration') fuseauRefuse = true;
    return null;
  }

  // La date du jour à la STATION, jamais celle de l'appareil. Cet écran ne
  // l'AFFICHE pas, il CHOISIT des données avec : `.lte('date', …)` borne la
  // recherche du point zéro, et `p0.date !== …` décide si le bandeau du jour
  // s'applique. Passé 20 h locales, un appareil en UTC est déjà au lendemain —
  // la borne laisse passer un point zéro de demain, et la référence du jour
  // cesse d'être reconnue. Sans fuseau on ne calcule pas : aucun repli sur
  // l'horloge machine, qui rendrait un mauvais jour en silence.
  async function aujourdhuiStation() {
    const tz = await fuseauCourant();
    return tz ? global.NexusStation.dateLocaleStation(tz) : null;
  }

  async function dernierPointZero() {
    if (p0Cache) return p0Cache;
    const client = clientNexus();
    const site = await siteCourant();
    const auj = await aujourdhuiStation();
    if (!client || !site || !auj) return null;
    const q = await client.from('carburant_stock_references')
      .select('id,date,type,statut,source,created_at')
      .eq('site', site)
      .eq('type', 'initialisation')
      .lte('date', auj)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (q.error || !q.data) return null;
    p0Cache = q.data;
    return p0Cache;
  }

  function remplacerTexte(root, regex, remplacement) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      regex.lastIndex = 0;
      if (!node.nodeValue || !regex.test(node.nodeValue)) continue;
      regex.lastIndex = 0;
      node.nodeValue = node.nodeValue.replace(regex, remplacement);
    }
  }

  function injecterCSS() {
    if (document.getElementById('nexus-carburants-mobile-polish-v2-css')) return;
    const style = document.createElement('style');
    style.id = 'nexus-carburants-mobile-polish-v2-css';
    style.textContent = `
      /* Lecture : Sans. Données et valeurs : Mono. */
      .section-titre,.section-note,.reference-certifiee-bandeau,.lien-historique-neutralise,
      .lecture-nexus-card,.lecture-nexus-titre,.lecture-nexus-ligne,.commande-carte,
      .commande-carte-titre,.commande-bandeau,.carb-ref-physique,.carb-stat-row .lbl,
      .carb-autonomie-bloc .lbl,.carb-fiab-row,.historique-pz-carte,.historique-recep-carte{
        font-family:var(--sans)!important;
      }
      .carb-pct2,.carb-stat-row .val,.carb-autonomie-bloc .val,
      .stock-table td:not(:first-child),.historique-pz-valeurs{
        font-family:var(--mono)!important;
      }
      .reference-certifiee-bandeau{font-size:12px!important;line-height:1.55!important;font-weight:500!important;}
      .lecture-nexus-titre{font-size:10px!important;font-weight:700!important;letter-spacing:.06em!important;}
      .lecture-nexus-badge-signalements{font-family:var(--sans)!important;font-weight:600!important;letter-spacing:0!important;}
      .commande-carte .section-note{color:var(--text-mid)!important;}
      #btnPreparerCommande{font-family:var(--sans)!important;font-weight:700!important;letter-spacing:.01em!important;}
      #moteurZone .kpi-row{gap:12px;align-items:flex-start;}
      #moteurZone .kpi-label{flex:1;min-width:0;font-family:var(--sans)!important;}
      #moteurZone .kpi-valeur{text-align:right;flex-shrink:0;}
      #moteurZone .kpi-row:last-child{display:block;padding-top:11px;}
      #moteurZone .kpi-row:last-child .kpi-label{display:block;margin-bottom:6px;font-size:10px;font-family:var(--sans)!important;text-transform:uppercase;letter-spacing:.06em;}
      #moteurZone .kpi-row:last-child .kpi-valeur{display:block;text-align:left;font-family:var(--sans)!important;font-size:12.5px!important;font-weight:600!important;line-height:1.55;letter-spacing:0!important;overflow-wrap:anywhere;}
      .lecture-nexus-ligne > span:last-child{min-width:0;}
      .situation-grid{display:grid!important;}
      @media(max-width:430px){
        #moteurZone .kpi-card{padding:14px 13px;}
        #moteurZone .kpi-row:not(:last-child){display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;}
        #moteurZone .kpi-valeur{font-size:13px;}
        .commande-carte .section-note{font-size:11.5px!important;line-height:1.58!important;}
      }
    `;
    document.head.appendChild(style);
  }

  function corrigerCouverture() {
    remplacerTexte(document.body, /Couverture estimée\s*:/gi, 'Dernier quart entièrement couvert :');
  }

  function corrigerLectureNexus() {
    const zone = document.getElementById('moteurZone');
    if (!zone) return;
    const rows = zone.querySelectorAll('.kpi-row');
    if (!rows.length) return;
    const derniere = rows[rows.length - 1];
    const label = derniere.querySelector('.kpi-label');
    if (label && /Lecture\s*NEXUS/i.test(label.textContent || '')) label.textContent = 'Lecture NEXUS';
  }

  async function corrigerPointZeroEtSituation() {
    const p0 = await dernierPointZero();
    const auj = await aujourdhuiStation();
    if (!p0 || !auj || p0.date !== auj) return;

    // Les cartes v2 sont .carb-carte2. On ne touche jamais à leur parent.
    document.querySelectorAll('.carb-carte2').forEach(carte => {
      const txt = carte.textContent || '';
      if (!/Écart[\s\S]*?\+?0\s*L/i.test(txt)) return;
      remplacerTexte(carte, /Situation stock\s*:\s*Non évaluable/gi, 'Situation stock : Référence certifiée');
    });

    // CRITIQUE : ne jamais parcourir tous les <div>. situationZone contient
    // lui aussi le texte du bandeau ; lui affecter textContent détruit les
    // jauges enfants. La correction est strictement limitée au bandeau.
    const bandeau = document.querySelector('#situationZone > .reference-certifiee-bandeau, .reference-certifiee-bandeau');
    if (bandeau) {
      const txt = (bandeau.textContent || '').trim();
      if (/^Nouvelle référence carburants certifiée le \d{4}-\d{2}-\d{2}\./i.test(txt) || /^Nouvelle référence certifiée/i.test(txt)) {
        bandeau.textContent = `Nouvelle référence certifiée — ${dateFrLisible(p0.date)}. Les écarts antérieurs restent archivés mais ne sont plus propagés. Les prochains contrôles repartent de cette référence.`;
      }
    }

    // Historique : la source est informative, jamais un faux bouton.
    document.querySelectorAll('.historique-pz-carte').forEach(carte => {
      if (!/POINT\s+ZÉRO\s+ACTIF/i.test(carte.textContent || '')) return;
      const source = carte.querySelector('.historique-pz-source');
      if (!source) return;
      const labels = { veeder_root: 'Veeder-Root', insite360: 'Insite360', terrain: 'Terrain' };
      source.textContent = `Source : ${labels[p0.source] || p0.source || 'non précisée'}`;
      source.removeAttribute('href');
      source.removeAttribute('target');
      source.removeAttribute('rel');
    });
  }

  function appliquer() {
    injecterCSS();
    corrigerCouverture();
    corrigerLectureNexus();
    corrigerPointZeroEtSituation();
  }

  function programmer() {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = null; appliquer(); });
  }

  function demarrer() {
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', demarrer, { once: true });
      return;
    }
    appliquer();
    if (!observer) {
      observer = new MutationObserver(programmer);
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }
  demarrer();
})(typeof window !== 'undefined' ? window : globalThis);
