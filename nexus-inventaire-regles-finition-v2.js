// NEXUS Inventaire V2 — finition UX Paramètres > Règles
// 1) Aligne proprement les informations produit quand une catégorie est ouverte.
// 2) Déplace la configuration des emplacements vers Réglages avancés.
(function(){
  'use strict';
  if(!/NEXUS-Parametres-Inventaire-v1\.html$/i.test(location.pathname)) return;

  const style=document.createElement('style');
  style.textContent=`
    /* La page Règles reste une page de lecture métier : on ne configure plus
       les emplacements dans chaque carte catégorie. */
    body.nexus-lieux-en-avance .nexus-cat-location-row .nexus-location-config,
    body.nexus-lieux-en-avance .nexus-location-editor{display:none!important}

    /* Catégorie ouverte : colonnes stables Produit | Règle | Emplacements | Action. */
    body.nexus-lieux-en-avance .cat-block.nexus-product-accordion.nexus-open .categorie-row{
      display:grid!important;
      grid-template-columns:minmax(0,1fr) 28px;
      align-items:center!important;
      column-gap:10px;
      padding:10px 12px!important;
    }
    body.nexus-lieux-en-avance .cat-block.nexus-product-accordion.nexus-open .categorie-row>div:first-child{
      min-width:0;
      display:grid!important;
      grid-template-columns:minmax(180px,1fr) 290px;
      align-items:center;
      column-gap:16px;
      width:100%;
    }
    body.nexus-lieux-en-avance .cat-block.nexus-product-accordion.nexus-open .categorie-row .categorie-nom{
      min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:0!important
    }
    body.nexus-lieux-en-avance .cat-block.nexus-product-accordion.nexus-open .categorie-row .nrv2-product-summary{
      margin:0!important;
      display:grid!important;
      grid-template-columns:110px 165px;
      align-items:center;
      justify-content:end;
      gap:10px!important;
      width:285px;
    }
    body.nexus-lieux-en-avance .cat-block.nexus-product-accordion.nexus-open .categorie-row .nrv2-product-summary>.nrv2-pill{
      text-align:center;justify-self:stretch;white-space:nowrap
    }
    body.nexus-lieux-en-avance .cat-block.nexus-product-accordion.nexus-open .categorie-row .nrv2-product-summary>span:last-child{
      display:block;text-align:left;white-space:nowrap;color:#8fa0b2
    }
    body.nexus-lieux-en-avance .cat-block.nexus-product-accordion.nexus-open .categorie-row>.categorie-etat{
      justify-self:end;margin:0!important
    }

    /* Module Réglages avancés */
    #nexusAdvancedLocations{margin:0 0 16px;padding:16px;border:1px solid rgba(79,195,217,.20);border-radius:14px;background:rgba(20,27,34,.78)}
    #nexusAdvancedLocations .nal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:12px}
    #nexusAdvancedLocations h3{font-size:14px;margin:0 0 4px;color:#edf1f5}
    #nexusAdvancedLocations p{font-size:11.5px;line-height:1.45;color:#7f8da3;margin:0}
    #nexusAdvancedLocations .nal-list{display:flex;flex-direction:column;gap:8px}
    #nexusAdvancedLocations .nal-row{display:grid;grid-template-columns:minmax(170px,1fr) minmax(240px,1.25fr);align-items:center;gap:14px;padding:11px 12px;border:1px solid rgba(148,163,184,.13);border-radius:10px;background:rgba(255,255,255,.012)}
    #nexusAdvancedLocations .nal-name{font-size:12.5px;font-weight:600;color:#dce5ee}
    #nexusAdvancedLocations .nal-sub{font-size:10.5px;color:#657386;margin-top:2px}
    #nexusAdvancedLocations .nal-options{display:flex;align-items:center;justify-content:flex-end;gap:7px;flex-wrap:wrap}
    #nexusAdvancedLocations .nal-option{display:inline-flex;align-items:center;gap:5px;padding:6px 9px;border:1px solid rgba(148,163,184,.18);border-radius:999px;background:rgba(148,163,184,.04);font-size:10.5px;color:#93a1b1;cursor:pointer;white-space:nowrap}
    #nexusAdvancedLocations .nal-option.on{border-color:rgba(79,195,217,.45);background:rgba(79,195,217,.10);color:#d7fbff}
    #nexusAdvancedLocations .nal-option input{accent-color:#4fc3d9}
    #nexusAdvancedLocations .nal-status{font-size:10px;color:#34d399;min-width:70px;text-align:right}
    #nexusAdvancedLocations .nal-note{margin-top:11px!important;padding-top:10px;border-top:1px solid rgba(148,163,184,.10)}
    #nexusAdvancedLocations.nal-hidden{display:none!important}

    @media(max-width:1050px){
      body.nexus-lieux-en-avance .cat-block.nexus-product-accordion.nexus-open .categorie-row>div:first-child{grid-template-columns:minmax(150px,1fr) 235px;column-gap:10px}
      body.nexus-lieux-en-avance .cat-block.nexus-product-accordion.nexus-open .categorie-row .nrv2-product-summary{grid-template-columns:95px 130px;width:235px;gap:8px!important}
    }
    @media(max-width:760px){
      body.nexus-lieux-en-avance .cat-block.nexus-product-accordion.nexus-open .categorie-row>div:first-child{display:block!important}
      body.nexus-lieux-en-avance .cat-block.nexus-product-accordion.nexus-open .categorie-row .nrv2-product-summary{display:flex!important;width:auto;margin-top:5px!important;justify-content:flex-start}
      #nexusAdvancedLocations .nal-row{grid-template-columns:1fr}
      #nexusAdvancedLocations .nal-options{justify-content:flex-start}
    }
  `;
  document.head.appendChild(style);
  document.body.classList.add('nexus-lieux-en-avance');

  let site=null,categories=[],zones=[],mappings=[],saving=false;
  const norm=s=>(s||'').trim().toLocaleLowerCase('fr-FR');

  async function load(){
    const emp=await nexusRequireAuth(); if(!emp) return false; site=emp.site_id;
    const [c,z,m]=await Promise.all([
      nexusClient.from('inventaire_categories').select('id,nom,actif').eq('site',site).eq('actif',true).order('nom'),
      nexusClient.from('inventaire_zones').select('id,code,nom,ordre_affichage').eq('site',site).order('ordre_affichage'),
      nexusClient.from('inventaire_categories_zones_stock').select('id,categorie_id,zone_id,ordre,actif').eq('site',site).eq('actif',true).order('ordre')
    ]);
    if(c.error||z.error||m.error){console.error('Réglages avancés emplacements',c.error||z.error||m.error);return false;}
    categories=c.data||[];zones=z.data||[];mappings=m.data||[];return true;
  }
  function idsFor(catId){return new Set(mappings.filter(m=>m.categorie_id===catId&&m.actif).map(m=>m.zone_id));}

  async function save(catId,ids,status){
    if(saving) return;
    if(ids.length===1){status.textContent='0 ou au moins 2 lieux';setTimeout(()=>status.textContent='',1800);return false;}
    saving=true;status.textContent='Enregistrement…';
    try{
      let r=await nexusClient.from('inventaire_categories_zones_stock').delete().eq('site',site).eq('categorie_id',catId);if(r.error)throw r.error;
      if(ids.length>=2){r=await nexusClient.from('inventaire_categories_zones_stock').insert(ids.map((zone_id,i)=>({site,categorie_id:catId,zone_id,ordre:(i+1)*10,actif:true})));if(r.error)throw r.error;}
      r=await nexusClient.from('inventaire_zone_produit').update({comptage_deux_lieux:ids.length>=2}).eq('site',site).eq('categorie_id',catId).eq('actif',true);if(r.error)throw r.error;
      const reload=await nexusClient.from('inventaire_categories_zones_stock').select('id,categorie_id,zone_id,ordre,actif').eq('site',site).eq('actif',true).order('ordre');if(reload.error)throw reload.error;
      mappings=reload.data||[];status.textContent='Enregistré';setTimeout(()=>status.textContent='',1800);return true;
    }catch(e){console.error('Enregistrement emplacements',e);status.textContent='Erreur';return false;}finally{saving=false;}
  }

  function isAdvanced(){
    const active=[...document.querySelectorAll('.onglet.active,[aria-selected="true"],button.active,a.active')];
    return active.some(el=>/réglages avancés/i.test(el.textContent||''));
  }
  function advancedAnchor(){
    const sections=[...document.querySelectorAll('.section')].filter(el=>el.offsetParent!==null);
    return sections[0]||document.querySelector('.phone')||document.body;
  }

  function buildAdvanced(){
    let box=document.getElementById('nexusAdvancedLocations');
    if(!box){
      box=document.createElement('section');box.id='nexusAdvancedLocations';
      const anchor=advancedAnchor();
      if(anchor.classList?.contains('section')) anchor.prepend(box); else anchor.appendChild(box);
    }
    box.classList.toggle('nal-hidden',!isAdvanced());
    if(!isAdvanced()) return;
    const useful=categories.filter(c=>norm(c.nom)==='cigarettes'||idsFor(c.id).size>=2);
    const rows=(useful.length?useful:categories).map(cat=>{
      const ids=idsFor(cat.id);
      return `<div class="nal-row" data-nal-cat="${cat.id}"><div><div class="nal-name">${cat.nom}</div><div class="nal-sub">${ids.size>=2?'Stock suivi sur plusieurs emplacements':'Emplacement standard'}</div></div><div class="nal-options">${zones.map(z=>`<label class="nal-option ${ids.has(z.id)?'on':''}"><input type="checkbox" data-zone="${z.id}" ${ids.has(z.id)?'checked':''}>📍 ${z.nom}</label>`).join('')}<span class="nal-status"></span></div></div>`;
    }).join('');
    box.innerHTML=`<div class="nal-head"><div><h3>Stock par emplacement</h3><p>À utiliser uniquement pour les catégories dont le stock existe réellement dans plusieurs lieux.</p></div></div><div class="nal-list">${rows}</div><p class="nal-note">Exemple Cigarettes : <b>Bureau + Boutique</b>. NEXUS additionne les comptages et les transferts Bureau ⇄ Boutique sans modifier le stock global.</p>`;
    box.querySelectorAll('[data-nal-cat]').forEach(row=>{
      row.querySelectorAll('[data-zone]').forEach(input=>input.addEventListener('change',async()=>{
        const ids=[...row.querySelectorAll('[data-zone]:checked')].map(x=>x.dataset.zone);
        if(ids.length===1){input.checked=!input.checked;row.querySelector('.nal-status').textContent='0 ou au moins 2 lieux';setTimeout(()=>row.querySelector('.nal-status').textContent='',1800);return;}
        row.querySelectorAll('.nal-option').forEach(l=>l.classList.toggle('on',!!l.querySelector('input')?.checked));
        if(await save(row.dataset.nalCat,ids,row.querySelector('.nal-status'))) setTimeout(buildAdvanced,50);
      }));
    });
  }

  function alignRows(){
    document.querySelectorAll('.cat-block.nexus-product-accordion.nexus-open .categorie-row').forEach(row=>{
      const first=row.firstElementChild;if(!first)return;
      const summary=first.querySelector('.nrv2-product-summary');
      if(summary) row.classList.add('nexus-product-aligned');
    });
  }

  async function init(){
    if(!await load()) return;
    let raf=0;
    const apply=()=>{alignRows();buildAdvanced();};
    new MutationObserver(()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(apply);}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','aria-selected']});
    document.addEventListener('click',e=>{if(/réglages avancés/i.test(e.target?.textContent||''))setTimeout(buildAdvanced,80);},true);
    apply();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
