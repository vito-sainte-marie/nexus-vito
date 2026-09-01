// NEXUS Carburants — finition mobile / cohérence de libellés (01/09/2026)
(function (global) {
  'use strict';
  if ((location.pathname.split('/').pop() || '').toLowerCase() !== 'nexus-carburants-pilotage-v1.html') return;

  let observer = null;
  let raf = null;
  let siteCache = null;
  let p0Cache = null;

  function clientNexus() {
    try { return typeof nexusClient !== 'undefined' ? nexusClient : (global.nexusClient || null); }
    catch (e) { return global.nexusClient || null; }
  }

  function aujourdhuiLocal() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

  async function dernierPointZero() {
    if (p0Cache) return p0Cache;
    const client = clientNexus();
    const site = await siteCourant();
    if (!client || !site) return null;
    const q = await client.from('carburant_stock_references')
      .select('id,date,type,statut,source,created_at')
      .eq('site', site)
      .eq('type', 'initialisation')
      .lte('date', aujourdhuiLocal())
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
      .commande-carte .section-note{color:var(--text-mid)!important;}
      #btnPreparerCommande{font-family:var(--sans)!important;font-weight:700!important;letter-spacing:.01em!important;}
      #moteurZone .kpi-row{gap:12px;align-items:flex-start;}
      #moteurZone .kpi-label{flex:1;min-width:0;}
      #moteurZone .kpi-valeur{text-align:right;flex-shrink:0;}
      #moteurZone .kpi-row:last-child{display:block;padding-top:11px;}
      #moteurZone .kpi-row:last-child .kpi-label{display:block;margin-bottom:6px;font-size:11px;font-family:var(--mono);text-transform:uppercase;letter-spacing:.04em;}
      #moteurZone .kpi-row:last-child .kpi-valeur{display:block;text-align:left;font-family:var(--sans)!important;font-size:12.5px!important;font-weight:600!important;line-height:1.55;letter-spacing:0!important;overflow-wrap:anywhere;}
      .lecture-nexus-ligne{font-family:var(--sans)!important;}
      .lecture-nexus-ligne > span:last-child{min-width:0;}
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
    if (!p0 || p0.date !== aujourdhuiLocal()) return;

    // Le point zéro certifie le stock, indépendamment de la capacité à calculer
    // une autonomie. Ne pas appeler le stock « non évaluable » quand l'écart
    // physique/théorique courant est nul et la nouvelle référence est active.
    document.querySelectorAll('.carb-carte').forEach(carte => {
      const txt = carte.textContent || '';
      if (!/Écart[\s\S]*?\+?0\s*L/i.test(txt)) return;
      remplacerTexte(carte, /Situation stock\s*:\s*Non évaluable/gi, 'Situation stock : Référence certifiée');
    });

    // Bandeau : date métier lisible et formulation plus concise.
    document.querySelectorAll('div').forEach(el => {
      const txt = (el.textContent || '').trim();
      if (!/^Nouvelle référence carburants certifiée le \d{4}-\d{2}-\d{2}\./i.test(txt)) return;
      el.textContent = `Nouvelle référence certifiée — ${dateFrLisible(p0.date)}. Les écarts antérieurs restent archivés mais ne sont plus propagés. Les prochains contrôles repartent de cette référence.`;
    });

    // Historique : la source est informative, jamais un faux bouton.
    const cartesP0 = document.querySelectorAll('.historique-pz-carte');
    cartesP0.forEach(carte => {
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

  appliquer();
  observer = new MutationObserver(programmer);
  observer.observe(document.body, { childList: true, subtree: true });
})(typeof window !== 'undefined' ? window : globalThis);
