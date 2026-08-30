// NEXUS Inventaire V2 — Stock par emplacement dans Paramètres > Règles
// Le manager configure simplement les lieux physiques d'une catégorie.
// Les quantités réelles restent issues des comptages et des transferts internes.
(function () {
  'use strict';
  if (!/NEXUS-Parametres-Inventaire-v1\.html$/i.test(location.pathname)) return;

  const css = document.createElement('style');
  css.textContent = `
    #nexusStockLocalise{margin:14px 0 18px;padding:15px 16px;border:1px solid rgba(79,195,217,.24);border-radius:14px;background:rgba(15,23,42,.50)}
    #nexusStockLocalise .nsl-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
    #nexusStockLocalise h3{margin:0 0 4px;font-size:14px;color:#edf1f5}
    #nexusStockLocalise p{margin:0;color:#8290a3;font-size:11.5px;line-height:1.45}
    .nsl-grid{display:grid;grid-template-columns:minmax(180px,1fr) minmax(260px,2fr);gap:12px;margin-top:13px;align-items:start}
    .nsl-select{width:100%;padding:10px 11px;border-radius:9px;border:1px solid rgba(148,163,184,.24);background:#111923;color:#e2e8f0;font:inherit;font-size:12px}
    .nsl-switch{display:flex;align-items:center;gap:8px;margin:2px 0 10px;font-size:12px;color:#dbe5ef;cursor:pointer}
    .nsl-lieux{display:flex;flex-wrap:wrap;gap:7px}.nsl-lieu{display:flex;align-items:center;gap:6px;padding:7px 9px;border:1px solid rgba(148,163,184,.18);border-radius:9px;background:rgba(148,163,184,.05);font-size:11.5px;color:#cbd5e1;cursor:pointer}
    .nsl-lieu.on{border-color:rgba(79,195,217,.48);background:rgba(79,195,217,.10);color:#d8fbff}
    .nsl-resume{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:10px;min-height:24px}.nsl-chip{padding:4px 8px;border-radius:999px;background:rgba(79,195,217,.10);border:1px solid rgba(79,195,217,.24);font-size:10.5px;color:#cffafe}
    .nsl-status{margin-left:auto;font-size:10.5px;color:#7f8da3}.nsl-status.ok{color:#34d399}.nsl-status.err{color:#f5a623}
    .nsl-hidden{display:none!important}.nsl-help{margin-top:9px!important;color:#9eacbd!important}
    @media(max-width:760px){.nsl-grid{grid-template-columns:1fr}.nsl-head{flex-direction:column}}
  `;
  document.head.appendChild(css);

  let site = null;
  let categories = [];
  let zones = [];
  let categorieId = null;
  let mappings = [];
  let enSauvegarde = false;

  async function chargerContexte(){
    const employee = await nexusRequireAuth();
    if (!employee) return false;
    site = employee.site_id;
    const [catsRes,zonesRes,mapRes] = await Promise.all([
      nexusClient.from('inventaire_categories').select('id,nom,actif').eq('site',site).eq('actif',true).order('nom'),
      nexusClient.from('inventaire_zones').select('id,code,nom,ordre_affichage').eq('site',site).order('ordre_affichage'),
      nexusClient.from('inventaire_categories_zones_stock').select('id,categorie_id,zone_id,ordre,actif').eq('site',site).eq('actif',true).order('ordre')
    ]);
    if (catsRes.error || zonesRes.error || mapRes.error) {
      console.error('Stock par emplacement : chargement impossible', catsRes.error || zonesRes.error || mapRes.error);
      return false;
    }
    categories = catsRes.data || [];
    zones = zonesRes.data || [];
    mappings = mapRes.data || [];
    const configuree = categories.find(c => mappings.filter(m=>m.categorie_id===c.id).length >= 2);
    const cigarettes = categories.find(c => c.nom.toLowerCase()==='cigarettes');
    categorieId = (configuree || cigarettes || categories[0] || {}).id || null;
    return !!categorieId;
  }

  function trouverAncrage(){
    const titres=[...document.querySelectorAll('h1,h2,h3,h4')];
    return titres.find(el => /Règles par catégorie/i.test((el.textContent||'').trim())) ||
           titres.find(el => /Comment souhaitez-vous les compter/i.test((el.textContent||'').trim()));
  }

  function mappingActif(catId){ return mappings.filter(m=>m.categorie_id===catId && m.actif); }

  function construire(){
    if (document.getElementById('nexusStockLocalise')) return true;
    const ancre = trouverAncrage();
    if (!ancre || !categories.length || !zones.length) return false;
    const bloc=document.createElement('section'); bloc.id='nexusStockLocalise';
    bloc.innerHTML=`
      <div class="nsl-head">
        <div><h3>📍 Stock par emplacement</h3><p>Indiquez simplement où le stock d'une catégorie peut se trouver. NEXUS additionne automatiquement les lieux.</p></div>
        <span id="nslStatus" class="nsl-status"></span>
      </div>
      <div class="nsl-grid">
        <div>
          <select id="nslCategorie" class="nsl-select" aria-label="Catégorie"></select>
        </div>
        <div>
          <label class="nsl-switch"><input id="nslActif" type="checkbox"> Stock présent à plusieurs endroits</label>
          <div id="nslLieux" class="nsl-lieux"></div>
          <div id="nslResume" class="nsl-resume"></div>
          <p class="nsl-help">Exemple : <strong>Cigarettes · Bureau + Boutique</strong>. Aucun stock n'est à saisir ici : les quantités viennent des comptages physiques.</p>
        </div>
      </div>`;
    ancre.insertAdjacentElement('afterend',bloc);

    const select=bloc.querySelector('#nslCategorie');
    select.innerHTML=categories.map(c=>`<option value="${c.id}">${c.nom}</option>`).join('');
    select.value=categorieId;
    select.addEventListener('change',()=>{ categorieId=select.value; rendreEtat(); });
    bloc.querySelector('#nslActif').addEventListener('change',async e=>{
      if(e.target.checked && mappingActif(categorieId).length<2){
        const bureau=zones.find(z=>z.code==='bureau'), boutique=zones.find(z=>z.code==='boutique');
        const defaults=[bureau,boutique].filter(Boolean).slice(0,2);
        if(defaults.length<2) defaults.splice(0,defaults.length,...zones.slice(0,2));
        await sauvegarderZones(defaults.map(z=>z.id));
      } else if(!e.target.checked){
        await sauvegarderZones([]);
      }
    });
    rendreEtat();
    return true;
  }

  function rendreEtat(){
    const bloc=document.getElementById('nexusStockLocalise'); if(!bloc) return;
    const actifs=mappingActif(categorieId);
    const ids=new Set(actifs.map(m=>m.zone_id));
    const on=actifs.length>=2;
    bloc.querySelector('#nslActif').checked=on;
    const lieux=bloc.querySelector('#nslLieux');
    lieux.classList.toggle('nsl-hidden',!on);
    lieux.innerHTML=zones.map(z=>`<label class="nsl-lieu ${ids.has(z.id)?'on':''}"><input type="checkbox" data-nsl-zone="${z.id}" ${ids.has(z.id)?'checked':''}> ${z.nom}</label>`).join('');
    lieux.querySelectorAll('[data-nsl-zone]').forEach(input=>input.addEventListener('change',async()=>{
      const choisis=[...lieux.querySelectorAll('[data-nsl-zone]:checked')].map(x=>x.dataset.nslZone);
      if(choisis.length<2){
        input.checked=true;
        statut('Choisissez au moins 2 lieux.', 'err');
        return;
      }
      await sauvegarderZones(choisis);
    }));
    const selection=zones.filter(z=>ids.has(z.id));
    bloc.querySelector('#nslResume').innerHTML=on
      ? `<span class="nsl-chip">${categories.find(c=>c.id===categorieId)?.nom||''}</span><span style="color:#64748b">→</span>${selection.map(z=>`<span class="nsl-chip">${z.nom}</span>`).join('<span style="color:#64748b">+</span>')}`
      : '<span style="font-size:10.5px;color:#64748b">Stock suivi dans un seul emplacement</span>';
  }

  function statut(message,type=''){
    const el=document.getElementById('nslStatus'); if(!el) return;
    el.textContent=message; el.className='nsl-status '+type;
    if(message) setTimeout(()=>{ if(el.textContent===message) el.textContent=''; },2200);
  }

  async function sauvegarderZones(zoneIds){
    if(enSauvegarde || !categorieId) return;
    enSauvegarde=true; statut('Enregistrement…');
    try{
      const existants=mappings.filter(m=>m.categorie_id===categorieId);
      if(existants.length){
        const {error}=await nexusClient.from('inventaire_categories_zones_stock').delete().eq('site',site).eq('categorie_id',categorieId);
        if(error) throw error;
      }
      if(zoneIds.length>=2){
        const lignes=zoneIds.map((zone_id,i)=>({site,categorie_id:categorieId,zone_id,ordre:(i+1)*10,actif:true}));
        const {error}=await nexusClient.from('inventaire_categories_zones_stock').insert(lignes);
        if(error) throw error;
      }
      const multi=zoneIds.length>=2;
      const {error:updateError}=await nexusClient.from('inventaire_zone_produit').update({comptage_deux_lieux:multi}).eq('site',site).eq('categorie_id',categorieId).eq('actif',true);
      if(updateError) throw updateError;
      const {data,error:reloadError}=await nexusClient.from('inventaire_categories_zones_stock').select('id,categorie_id,zone_id,ordre,actif').eq('site',site).eq('actif',true).order('ordre');
      if(reloadError) throw reloadError;
      mappings=data||[];
      rendreEtat(); statut('Enregistré', 'ok');
    } catch(err){
      console.error('Stock par emplacement : enregistrement impossible',err);
      statut('Enregistrement impossible', 'err');
    } finally { enSauvegarde=false; }
  }

  async function init(){
    try{
      if(!await chargerContexte()) return;
      let essais=0;
      const timer=setInterval(()=>{
        essais++;
        if(construire() || essais>80) clearInterval(timer);
      },150);
    } catch(err){ console.error('Stock par emplacement : initialisation',err); }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
