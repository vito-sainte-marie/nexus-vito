// NEXUS Réception carburant — correctif stable
// 31/08/2026 : choix cuve fiable mobile/desktop, compartiments vides,
// navigation arrière explicite. Aucun calcul métier modifié.
(function(){
  'use strict';
  if((location.pathname.split('/').pop()||'')!=='NEXUS-Carburant-Reception-v1.html') return;

  let cuvesParCarburant=null;
  let chargementCuves=null;

  function lireCarburantActif(){
    const chip=document.querySelector('#ficheCompartimentZone .carburant-chip.actif');
    if(chip?.dataset?.carb) return String(chip.dataset.carb).toLowerCase();
    const txt=(chip?.textContent||'').trim().toUpperCase();
    if(txt==='GO') return 'go'; if(txt==='SP95') return 'sp95'; if(txt==='GNR') return 'gnr';
    return null;
  }

  async function chargerCuves(){
    if(cuvesParCarburant) return cuvesParCarburant;
    if(chargementCuves) return chargementCuves;
    chargementCuves=(async()=>{
      try{
        const {data:{session}}=await nexusClient.auth.getSession();
        if(!session) return null;
        const {data:emp,error:eEmp}=await nexusClient.from('employees').select('site_id').eq('id',session.user.id).maybeSingle();
        if(eEmp||!emp?.site_id) throw eEmp||new Error('site utilisateur introuvable');
        const {data,error}=await nexusClient.from('station_config').select('cuves_carburants').eq('site',emp.site_id).maybeSingle();
        if(error||!data) throw error||new Error('configuration cuves introuvable');
        cuvesParCarburant=data.cuves_carburants||{};
        return cuvesParCarburant;
      }catch(e){console.error('NEXUS réception — chargement cuves:',e);return null;}
      finally{chargementCuves=null;}
    })();
    return chargementCuves;
  }

  function optionsAttendues(carb){
    const g=cuvesParCarburant?.[carb];
    return g&&g.actif!==false&&Array.isArray(g.cuves)?g.cuves.filter(Boolean):[];
  }

  function appliquerValeurCuve(select,valeur){
    if(!select) return;
    select.value=String(valeur||'');
    select.dispatchEvent(new Event('change',{bubbles:true}));
  }

  function rendreBoutonsCuves(select,cuves){
    if(!select||!cuves.length) return;
    const signature=cuves.map(c=>`${c.id}:${c.label||''}`).join('|');
    let zone=document.getElementById('nexusChoixCuveBoutons');
    if(!zone){
      zone=document.createElement('div');
      zone.id='nexusChoixCuveBoutons';
      zone.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin:0 0 14px;';
      select.insertAdjacentElement('afterend',zone);
    }
    const valeur=String(select.value||'');
    if(zone.dataset.signature===signature&&zone.dataset.valeur===valeur){
      select.style.display='none';
      return;
    }
    zone.dataset.signature=signature;
    zone.dataset.valeur=valeur;
    zone.innerHTML=cuves.map(c=>{
      const actif=valeur===String(c.id);
      return `<button type="button" class="nexus-cuve-btn" data-cuve-id="${String(c.id).replace(/"/g,'&quot;')}" style="min-height:52px;border-radius:10px;border:1px solid ${actif?'var(--cyan)':'var(--hairline)'};background:${actif?'rgba(79,195,217,.16)':'var(--panel-raised)'};color:${actif?'var(--text)':'var(--text-mid)'};font:600 14px var(--sans);padding:11px 12px;cursor:pointer;">${c.label||c.id}</button>`;
    }).join('');
    zone.querySelectorAll('.nexus-cuve-btn').forEach(btn=>btn.addEventListener('click',()=>{
      appliquerValeurCuve(select,btn.dataset.cuveId);
      zone.dataset.valeur='__force__';
      rendreBoutonsCuves(select,cuves);
    }));
    select.style.display='none';
  }

  function afficherErreurCuves(select){
    if(!select||document.getElementById('nexusErreurCuves')) return;
    const d=document.createElement('div');
    d.id='nexusErreurCuves';
    d.style.cssText='margin:-4px 0 14px;padding:10px 12px;border-radius:10px;border:1px solid rgba(240,87,90,.4);background:rgba(240,87,90,.08);color:var(--red);font-size:12px;line-height:1.45;';
    d.textContent='Impossible de charger les cuves de ce carburant. Revenez à l’étape précédente puis réessayez.';
    select.insertAdjacentElement('afterend',d);
  }

  async function reparerChoixCuve(){
    const select=document.getElementById('fCuveCompartiment');
    if(!select) return;
    const carb=lireCarburantActif();
    if(!carb) return;
    if(select.dataset.nexusPreparation==='1') return;
    select.dataset.nexusPreparation='1';
    try{
      await chargerCuves();
      const cuves=optionsAttendues(carb);
      if(!cuves.length){afficherErreurCuves(select);return;}
      document.getElementById('nexusErreurCuves')?.remove();
      const signature=`${carb}|${cuves.map(c=>c.id).join(',')}`;
      if(select.dataset.nexusCuvesReady!==signature){
        const avant=String(select.value||'');
        select.innerHTML='<option value="">— Choisir —</option>'+cuves.map(c=>`<option value="${String(c.id).replace(/"/g,'&quot;')}">${c.label||c.id}</option>`).join('');
        select.disabled=false;
        select.dataset.nexusCuvesReady=signature;
        const ids=cuves.map(c=>String(c.id));
        if(avant&&ids.includes(avant)) appliquerValeurCuve(select,avant);
        else if(cuves.length===1) appliquerValeurCuve(select,cuves[0].id);
      }
      rendreBoutonsCuves(select,cuves);
    } finally {
      delete select.dataset.nexusPreparation;
    }
  }

  function compartimentsVides(){
    return new Set([...document.querySelectorAll('.compartiment-bloc.compartiment-vide[data-compartiment]')].map(el=>String(el.dataset.compartiment)));
  }
  function corrigerMessageIncomplet(){
    const box=document.querySelector('.compartiments-incomplet'); if(!box) return;
    const vides=compartimentsVides(); if(!vides.size) return;
    const nums=[...(box.textContent||'').matchAll(/compartiment\s+(\d+)/gi)].map(m=>m[1]);
    if(nums.length&&nums.every(n=>vides.has(String(n)))) box.style.display='none';
  }

  function rendreRetourExplicite(){
    const ids=['btnRetourJaugeage','btnRetourCompartiments','btnRetourReception','btnRetourCalcul'];
    ids.forEach(id=>{const btn=document.getElementById(id);if(!btn||btn.dataset.nexusRetourCorriger==='1')return;btn.dataset.nexusRetourCorriger='1';btn.textContent='← Corriger l’étape précédente';btn.style.borderColor='rgba(79,195,217,.35)';btn.style.color='var(--cyan)';});
    const actif=ids.map(id=>document.getElementById(id)).find(Boolean);
    if(actif&&!document.getElementById('nexusRetourCorrectionNote')){const n=document.createElement('div');n.id='nexusRetourCorrectionNote';n.style.cssText='font-size:11px;color:var(--text-dim);text-align:center;margin-top:-4px;margin-bottom:12px;line-height:1.45;';n.textContent='Vos saisies restent dans la visite en cours. Seul « Annuler » recommence la réception.';actif.insertAdjacentElement('afterend',n);}
  }

  function corriger(){reparerChoixCuve();corrigerMessageIncomplet();rendreRetourExplicite();}
  function init(){
    corriger();
    let timer=null;
    const obs=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(corriger,30);});
    obs.observe(document.body,{childList:true,subtree:true});
    document.addEventListener('click',e=>{if(e.target?.closest?.('#btnToggleVideCompartiment,.carburant-chip,[data-compartiment]'))setTimeout(corriger,0);},true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
