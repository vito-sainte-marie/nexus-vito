// NEXUS Inventaire V2 — Paramétrage simple du stock par emplacement
// Extension non intrusive de NEXUS-Parametres-Inventaire-v1.html.
// Objectif UX : le manager décrit simplement OÙ se trouve un produit ; NEXUS gère ensuite les transferts.
(function () {
  'use strict';
  if (!/NEXUS-Parametres-Inventaire-v1\.html$/i.test(location.pathname)) return;

  const css = document.createElement('style');
  css.textContent = `
    #nexusStockLocalise{margin:18px 0;padding:18px;border:1px solid rgba(148,163,184,.24);border-radius:16px;background:rgba(15,23,42,.55)}
    #nexusStockLocalise h3{margin:0 0 6px;font-size:16px} #nexusStockLocalise p{margin:0 0 14px;color:#94a3b8;font-size:13px;line-height:1.45}
    .nsl-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.nsl-select{width:100%;padding:11px 12px;border-radius:10px;border:1px solid rgba(148,163,184,.3);background:#0f172a;color:#e2e8f0}
    .nsl-chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.nsl-chip{padding:7px 10px;border-radius:999px;background:rgba(34,211,238,.10);border:1px solid rgba(34,211,238,.25);font-size:12px;color:#cffafe}
    .nsl-note{margin-top:12px!important;color:#cbd5e1!important}.nsl-hidden{display:none!important}@media(max-width:640px){.nsl-row{grid-template-columns:1fr}}
  `;
  document.head.appendChild(css);

  const attendre = (fn, essais=80) => {
    const r=fn(); if(r || essais<=0) return r;
    setTimeout(()=>attendre(fn, essais-1),150);
  };

  async function siteCourant(){
    try { const e=await nexusRequireAuth(); return e && e.site_id; } catch(_){ return null; }
  }

  async function chargerLieux(site){
    const {data}=await nexusClient.from('inventaire_emplacements').select('id,code,nom,actif').eq('site',site).eq('actif',true).order('nom');
    return data||[];
  }

  function carteCategorieSelectionnee(){
    const modal=document.querySelector('#modalCategorie, .modal.show, [role="dialog"]');
    return modal || document.querySelector('.categorie-card.active, .category-card.active');
  }

  function idCategorie(conteneur){
    if(!conteneur) return null;
    return conteneur.dataset.categorieId || conteneur.querySelector('[data-categorie-id]')?.dataset.categorieId || window.categorieEditionId || window.categorieSelectionneeId || null;
  }

  async function statsCategorie(site,categorieId){
    if(!categorieId) return {total:0,multi:0};
    const {data:produits}=await nexusClient.from('inventaire_produits').select('id,comptage_deux_lieux').eq('site',site).eq('categorie_id',categorieId).eq('actif',true);
    const rows=produits||[]; return {total:rows.length,multi:rows.filter(p=>p.comptage_deux_lieux).length};
  }

  async function monter(){
    if(document.getElementById('nexusStockLocalise')) return true;
    const cible=document.querySelector('#catRegleComptage')?.closest('.form-group, .setting-group, .param-row, div')?.parentElement;
    if(!cible) return false;
    const site=await siteCourant(); if(!site) return false;
    const lieux=await chargerLieux(site);
    if(lieux.length<2) return true;
    const bloc=document.createElement('section'); bloc.id='nexusStockLocalise';
    bloc.innerHTML=`<h3>📍 Stock à plusieurs endroits</h3>
      <p>À utiliser seulement si les produits de cette catégorie sont réellement stockés dans plusieurs endroits. Exemple : cigarettes au bureau et en boutique.</p>
      <label style="display:flex;gap:9px;align-items:center;font-size:14px"><input id="nslActif" type="checkbox"> Suivre le stock par emplacement</label>
      <div id="nslOptions" class="nsl-hidden" style="margin-top:13px">
        <div class="nsl-row"><select id="nslPrincipal" class="nsl-select"></select><select id="nslSecondaire" class="nsl-select"></select></div>
        <div class="nsl-chips" id="nslResume"></div>
        <p class="nsl-note">NEXUS additionne automatiquement les lieux pour obtenir le stock total. Un transfert d’un lieu à l’autre ne change jamais le stock global.</p>
      </div>`;
    cible.appendChild(bloc);
    const options=lieux.map(l=>`<option value="${l.code}">${l.nom}</option>`).join('');
    const a=bloc.querySelector('#nslPrincipal'), b=bloc.querySelector('#nslSecondaire'); a.innerHTML=options;b.innerHTML=options;
    const bureau=lieux.find(l=>l.code==='bureau'), boutique=lieux.find(l=>l.code==='boutique'); if(bureau)a.value=bureau.code;if(boutique)b.value=boutique.code;
    const maj=()=>{bloc.querySelector('#nslOptions').classList.toggle('nsl-hidden',!bloc.querySelector('#nslActif').checked);bloc.querySelector('#nslResume').innerHTML=bloc.querySelector('#nslActif').checked?`<span class="nsl-chip">${a.options[a.selectedIndex]?.text||''}</span><span>⇄</span><span class="nsl-chip">${b.options[b.selectedIndex]?.text||''}</span>`:'';};
    bloc.querySelector('#nslActif').addEventListener('change',maj);a.addEventListener('change',maj);b.addEventListener('change',maj);maj();

    // Cette première version est volontairement déclarative : elle n'impose aucune saisie de stock initial.
    // Le stock réel reste issu des comptages physiques ; les transferts maintiennent ensuite la localisation.
    const obs=new MutationObserver(async()=>{
      const c=carteCategorieSelectionnee(), cid=idCategorie(c); if(!cid)return;
      const s=await statsCategorie(site,cid); if(s.total && s.multi){bloc.querySelector('#nslActif').checked=true;maj();}
    }); obs.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class','data-categorie-id']});
    return true;
  }
  attendre(monter);
})();
