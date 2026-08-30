// NEXUS Inventaire V2 — Emplacements intégrés à la page Paramètres > Règles
// UX premium : les lieux sont présentés au niveau de la catégorie, les listes
// de produits deviennent repliables et les mentions répétitives sont supprimées.
(function () {
  'use strict';
  if (!/NEXUS-Parametres-Inventaire-v1\.html$/i.test(location.pathname)) return;

  const css = document.createElement('style');
  css.textContent = `
    /* La page Règles doit rester lisible : une catégorie = une unité visuelle. */
    #nexusStockLocalise{display:none!important}

    .nexus-cat-location-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px;padding-top:8px;border-top:1px solid rgba(148,163,184,.12)}
    .nexus-cat-location-label{font-size:10.5px;color:#718096;min-width:72px}
    .nexus-location-pills{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
    .nexus-location-pill{display:inline-flex;align-items:center;gap:5px;min-height:24px;padding:4px 8px;border-radius:999px;border:1px solid rgba(79,195,217,.22);background:rgba(79,195,217,.08);font-size:10.5px;color:#c9f7ff;white-space:nowrap}
    .nexus-location-sep{font-size:10px;color:#52606f}
    .nexus-location-empty{font-size:10.5px;color:#64748b}
    .nexus-location-config{margin-left:auto;border:0;background:transparent;color:#4fc3d9;font:600 10.5px 'IBM Plex Mono',monospace;cursor:pointer;padding:4px 0}

    .nexus-location-editor{display:none;margin-top:10px;padding:11px 12px;border:1px solid rgba(79,195,217,.18);border-radius:10px;background:rgba(79,195,217,.045)}
    .nexus-location-editor.open{display:block}
    .nexus-location-editor-title{font-size:11px;font-weight:600;color:#dfe8f1;margin-bottom:7px}
    .nexus-location-options{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
    .nexus-location-option{display:flex;align-items:center;gap:6px;padding:6px 9px;border:1px solid rgba(148,163,184,.18);border-radius:8px;background:rgba(148,163,184,.04);font-size:11px;color:#aeb9c7;cursor:pointer}
    .nexus-location-option.on{border-color:rgba(79,195,217,.46);background:rgba(79,195,217,.10);color:#ddfbff}
    .nexus-location-option input{accent-color:#4fc3d9}
    .nexus-location-note{margin-top:7px;font-size:10.5px;line-height:1.4;color:#718096}
    .nexus-location-status{margin-left:auto;font-size:10px;color:#718096}
    .nexus-location-status.ok{color:#34d399}.nexus-location-status.err{color:#f5a623}

    /* Produits : transformer chaque groupe de catégorie en accordéon compact. */
    .cat-block.nexus-product-accordion{margin-bottom:10px!important;border:1px solid rgba(148,163,184,.16);border-radius:12px;overflow:hidden;background:rgba(20,27,34,.72)}
    .cat-block.nexus-product-accordion>.cat-head{padding:11px 12px!important;margin:0!important;cursor:pointer;background:rgba(255,255,255,.012)}
    .cat-block.nexus-product-accordion>.cat-head:hover{background:rgba(79,195,217,.035)}
    .nexus-cat-head-main{display:flex;align-items:center;gap:8px;min-width:0;flex:1}
    .nexus-cat-head-meta{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-left:auto}
    .nexus-cat-head-locations{display:flex;align-items:center;gap:5px;white-space:nowrap}
    .nexus-cat-head-chevron{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:999px;background:rgba(148,163,184,.07);color:#7b8796;font-size:11px;transition:transform .18s ease}
    .cat-block.nexus-product-accordion.nexus-open>.cat-head .nexus-cat-head-chevron{transform:rotate(90deg);color:#4fc3d9;background:rgba(79,195,217,.10)}
    .cat-block.nexus-product-accordion:not(.nexus-open)>.card,
    .cat-block.nexus-product-accordion:not(.nexus-open)>:not(.cat-head){display:none!important}
    .cat-block.nexus-product-accordion.nexus-open>.card{display:block}

    /* Les lieux ne doivent pas être répétés sur chacune des références. */
    .categorie-count.nexus-duplicate-location{display:none!important}

    @media(min-width:980px){
      .nexus-cat-location-row{flex-wrap:nowrap}
      .nexus-location-pills{min-width:220px}
    }
    @media(max-width:760px){
      .nexus-location-config{margin-left:0}
      .nexus-cat-head-meta{width:100%;margin-left:0}
    }
  `;
  document.head.appendChild(css);

  let site = null;
  let categories = [];
  let zones = [];
  let mappings = [];
  let enSauvegarde = false;
  const accordionsOuverts = new Set();

  const normaliser = (s) => (s || '').trim().toLocaleLowerCase('fr-FR');

  async function chargerContexte() {
    const employee = await nexusRequireAuth();
    if (!employee) return false;
    site = employee.site_id;
    const [catsRes, zonesRes, mapRes] = await Promise.all([
      nexusClient.from('inventaire_categories').select('id,nom,actif').eq('site', site).eq('actif', true).order('nom'),
      nexusClient.from('inventaire_zones').select('id,code,nom,ordre_affichage').eq('site', site).order('ordre_affichage'),
      nexusClient.from('inventaire_categories_zones_stock').select('id,categorie_id,zone_id,ordre,actif').eq('site', site).eq('actif', true).order('ordre')
    ]);
    if (catsRes.error || zonesRes.error || mapRes.error) {
      console.error('Emplacements inventaire : chargement impossible', catsRes.error || zonesRes.error || mapRes.error);
      return false;
    }
    categories = catsRes.data || [];
    zones = zonesRes.data || [];
    mappings = mapRes.data || [];
    return true;
  }

  function categorieParNom(nom) {
    const n = normaliser(nom).replace(/\s*\([^)]*\)\s*$/, '');
    return categories.find(c => normaliser(c.nom) === n) || null;
  }

  function zonesCategorie(catId) {
    const ids = mappings.filter(m => m.categorie_id === catId && m.actif).map(m => m.zone_id);
    return zones.filter(z => ids.includes(z.id));
  }

  function htmlPills(lieux) {
    if (!lieux.length) return '<span class="nexus-location-empty">Emplacement standard</span>';
    return lieux.map((z, i) => `${i ? '<span class="nexus-location-sep">+</span>' : ''}<span class="nexus-location-pill">📍 ${z.nom}</span>`).join('');
  }

  function statut(editor, message, type = '') {
    const el = editor && editor.querySelector('.nexus-location-status');
    if (!el) return;
    el.textContent = message;
    el.className = `nexus-location-status ${type}`;
    if (message) setTimeout(() => { if (el.textContent === message) el.textContent = ''; }, 2200);
  }

  async function sauvegarderZones(categorieId, zoneIds, editor) {
    if (enSauvegarde || !categorieId) return;
    if (zoneIds.length === 1) {
      statut(editor, 'Choisissez 0 ou au moins 2 lieux.', 'err');
      return;
    }
    enSauvegarde = true;
    statut(editor, 'Enregistrement…');
    try {
      const { error: delError } = await nexusClient.from('inventaire_categories_zones_stock')
        .delete().eq('site', site).eq('categorie_id', categorieId);
      if (delError) throw delError;

      if (zoneIds.length >= 2) {
        const lignes = zoneIds.map((zone_id, i) => ({ site, categorie_id: categorieId, zone_id, ordre: (i + 1) * 10, actif: true }));
        const { error: insError } = await nexusClient.from('inventaire_categories_zones_stock').insert(lignes);
        if (insError) throw insError;
      }

      const { error: updateError } = await nexusClient.from('inventaire_zone_produit')
        .update({ comptage_deux_lieux: zoneIds.length >= 2 })
        .eq('site', site).eq('categorie_id', categorieId).eq('actif', true);
      if (updateError) throw updateError;

      const { data, error: reloadError } = await nexusClient.from('inventaire_categories_zones_stock')
        .select('id,categorie_id,zone_id,ordre,actif').eq('site', site).eq('actif', true).order('ordre');
      if (reloadError) throw reloadError;
      mappings = data || [];
      statut(editor, 'Enregistré', 'ok');
      appliquerUX();
    } catch (err) {
      console.error('Emplacements inventaire : enregistrement impossible', err);
      statut(editor, 'Enregistrement impossible', 'err');
    } finally {
      enSauvegarde = false;
    }
  }

  function injecterEmplacementsDansCartesCategories() {
    document.querySelectorAll('[data-categorie-regle]').forEach(row => {
      const catId = row.dataset.categorieRegle;
      const cat = categories.find(c => c.id === catId);
      if (!cat) return;
      const card = row.closest('.card');
      if (!card) return;

      const ancien = card.querySelector(`.nexus-cat-location-row[data-cat-id="${catId}"]`);
      if (ancien) ancien.remove();
      const ancienEditor = card.querySelector(`.nexus-location-editor[data-cat-id="${catId}"]`);
      if (ancienEditor) ancienEditor.remove();

      const lieux = zonesCategorie(catId);
      const line = document.createElement('div');
      line.className = 'nexus-cat-location-row';
      line.dataset.catId = catId;
      line.innerHTML = `
        <span class="nexus-cat-location-label">Stock</span>
        <span class="nexus-location-pills">${htmlPills(lieux)}</span>
        <button type="button" class="nexus-location-config" data-edit-locations="${catId}">${lieux.length >= 2 ? 'Modifier les lieux' : 'Configurer les lieux'}</button>`;
      card.appendChild(line);

      const editor = document.createElement('div');
      editor.className = 'nexus-location-editor';
      editor.dataset.catId = catId;
      const ids = new Set(lieux.map(z => z.id));
      editor.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px">
          <div class="nexus-location-editor-title">Où peut se trouver le stock de « ${cat.nom} » ?</div>
          <span class="nexus-location-status"></span>
        </div>
        <div class="nexus-location-options">
          ${zones.map(z => `<label class="nexus-location-option ${ids.has(z.id) ? 'on' : ''}"><input type="checkbox" data-zone-id="${z.id}" ${ids.has(z.id) ? 'checked' : ''}> ${z.nom}</label>`).join('')}
        </div>
        <div class="nexus-location-note">Choisissez plusieurs lieux uniquement si la catégorie est réellement répartie physiquement. NEXUS additionnera les comptages ; un transfert interne ne modifiera pas le stock global.</div>`;
      card.appendChild(editor);

      line.querySelector('[data-edit-locations]').addEventListener('click', ev => {
        ev.preventDefault(); ev.stopPropagation();
        editor.classList.toggle('open');
      });
      editor.querySelectorAll('[data-zone-id]').forEach(input => input.addEventListener('change', async ev => {
        ev.stopPropagation();
        const choisis = [...editor.querySelectorAll('[data-zone-id]:checked')].map(x => x.dataset.zoneId);
        if (choisis.length === 1) {
          input.checked = !input.checked;
          statut(editor, 'Choisissez 0 ou au moins 2 lieux.', 'err');
          return;
        }
        editor.querySelectorAll('.nexus-location-option').forEach(label => {
          label.classList.toggle('on', !!label.querySelector('input')?.checked);
        });
        await sauvegarderZones(catId, choisis, editor);
      }));
    });
  }

  function masquerMentionsLieuxRepetees() {
    document.querySelectorAll('.categorie-count').forEach(el => {
      if (/📍\s*(Dépôt|Depot|Bureau|Boutique)/i.test(el.textContent || '')) el.classList.add('nexus-duplicate-location');
    });
  }

  function transformerGroupesProduitsEnAccordeons() {
    document.querySelectorAll('.cat-block').forEach((bloc, index) => {
      const head = bloc.querySelector(':scope > .cat-head');
      if (!head) return;
      bloc.classList.add('nexus-product-accordion');
      const nomEl = head.querySelector('.cat-nom') || head.firstElementChild;
      const nom = (nomEl && nomEl.textContent || '').trim();
      const cat = categorieParNom(nom);
      const key = cat ? cat.id : `index-${index}`;
      bloc.dataset.nexusAccordionKey = key;

      if (!head.querySelector('.nexus-cat-head-chevron')) {
        const meta = document.createElement('div');
        meta.className = 'nexus-cat-head-meta';
        const lieux = cat ? zonesCategorie(cat.id) : [];
        meta.innerHTML = `
          ${lieux.length >= 2 ? `<span class="nexus-cat-head-locations">${htmlPills(lieux)}</span>` : ''}
          <span class="nexus-cat-head-chevron">›</span>`;
        head.appendChild(meta);
      }

      if (accordionsOuverts.has(key)) bloc.classList.add('nexus-open');
      head.onclick = (ev) => {
        if (ev.target.closest('button,input,a,select')) return;
        ev.preventDefault();
        const ouvrir = !bloc.classList.contains('nexus-open');
        bloc.classList.toggle('nexus-open', ouvrir);
        if (ouvrir) accordionsOuverts.add(key); else accordionsOuverts.delete(key);
      };
    });
  }

  function appliquerUX() {
    // Le module historique autonome ne doit plus apparaître : l'information
    // est maintenant placée exactement là où le manager règle la catégorie.
    const standalone = document.getElementById('nexusStockLocalise');
    if (standalone) standalone.remove();
    injecterEmplacementsDansCartesCategories();
    transformerGroupesProduitsEnAccordeons();
    masquerMentionsLieuxRepetees();
  }

  async function init() {
    try {
      if (!await chargerContexte()) return;
      let raf = null;
      const observer = new MutationObserver(() => {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(appliquerUX);
      });
      observer.observe(document.body, { childList: true, subtree: true });
      appliquerUX();
    } catch (err) {
      console.error('Emplacements inventaire : initialisation', err);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
