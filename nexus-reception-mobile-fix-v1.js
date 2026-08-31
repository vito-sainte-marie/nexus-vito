// NEXUS Réception carburant — correctif mobile ciblé
// 31/08/2026 : sécurise le choix de la cuve destination sur Safari iOS,
// supprime le faux message "Encore incomplet" pour les compartiments vides
// et rend explicite la navigation arrière sans abandonner la visite.
(function(){
  'use strict';
  if((location.pathname.split('/').pop()||'')!=='NEXUS-Carburant-Reception-v1.html') return;

  let cuvesParCarburant = null;
  let correctionEnCours = false;

  function lireCarburantActif(){
    const chip=document.querySelector('#ficheCompartimentZone .carburant-chip.actif');
    if(chip && chip.dataset && chip.dataset.carb) return String(chip.dataset.carb).toLowerCase();
    const txt=(document.querySelector('#ficheCompartimentZone .carburant-chip.actif')?.textContent||'').trim().toUpperCase();
    if(txt==='GO') return 'go';
    if(txt==='SP95') return 'sp95';
    if(txt==='GNR') return 'gnr';
    return null;
  }

  async function chargerCuves(){
    if(cuvesParCarburant) return cuvesParCarburant;
    try{
      const {data:{session}}=await nexusClient.auth.getSession();
      if(!session) return null;
      const {data:emp}=await nexusClient.from('employees').select('site_id').eq('id',session.user.id).maybeSingle();
      if(!emp||!emp.site_id) return null;
      const {data,error}=await nexusClient.from('station_config').select('cuves_carburants').eq('site',emp.site_id).maybeSingle();
      if(error||!data) return null;
      cuvesParCarburant=data.cuves_carburants||{};
      return cuvesParCarburant;
    }catch(e){console.error('NEXUS réception — chargement cuves:',e);return null;}
  }

  function optionsAttendues(carb){
    const groupe=cuvesParCarburant&&cuvesParCarburant[carb];
    if(!groupe||groupe.actif===false||!Array.isArray(groupe.cuves)) return [];
    return groupe.cuves.filter(Boolean);
  }

  async function reparerSelectCuve(){
    if(correctionEnCours) return;
    const select=document.getElementById('fCuveCompartiment');
    if(!select) return;
    const carb=lireCarburantActif();
    if(!carb) return;
    await chargerCuves();
    const cuves=optionsAttendues(carb);
    if(!cuves.length) return;

    const idsActuels=[...select.options].map(o=>String(o.value||'')).filter(Boolean);
    const idsAttendus=cuves.map(c=>String(c.id));
    const manque=idsAttendus.some(id=>!idsActuels.includes(id));
    const optionsVides=idsActuels.length===0;
    if(!manque&&!optionsVides){
      if(select.disabled) select.disabled=false;
      return;
    }

    correctionEnCours=true;
    try{
      const valeurAvant=select.value;
      select.innerHTML='<option value="">— Choisir —</option>'+cuves.map(c=>`<option value="${String(c.id).replace(/"/g,'&quot;')}">${c.label||c.id}</option>`).join('');
      select.disabled=false;
      if(valeurAvant&&idsAttendus.includes(String(valeurAvant))) select.value=valeurAvant;
      else if(cuves.length===1){
        select.value=String(cuves[0].id);
        select.dispatchEvent(new Event('change',{bubbles:true}));
      }
    }finally{correctionEnCours=false;}
  }

  function compartimentsVides(){
    return new Set([...document.querySelectorAll('.compartiment-bloc.compartiment-vide[data-compartiment]')]
      .map(el=>String(el.dataset.compartiment)));
  }

  function corrigerMessageIncomplet(){
    const box=document.querySelector('.compartiments-incomplet');
    if(!box) return;
    const vides=compartimentsVides();
    if(!vides.size) return;
    const texte=(box.textContent||'');
    const nums=[...texte.matchAll(/compartiment\s+(\d+)/gi)].map(m=>m[1]);
    if(nums.length&&nums.every(n=>vides.has(String(n)))) box.style.display='none';
  }

  function rendreRetourExplicite(){
    const ids=['btnRetourJaugeage','btnRetourCompartiments','btnRetourReception','btnRetourCalcul'];
    ids.forEach(id=>{
      const btn=document.getElementById(id);
      if(!btn) return;
      if(btn.dataset.nexusRetourCorriger==='1') return;
      btn.dataset.nexusRetourCorriger='1';
      btn.textContent='← Corriger l’étape précédente';
      btn.setAttribute('aria-label','Retourner à l’étape précédente pour corriger une saisie sans annuler la réception');
      btn.style.borderColor='rgba(79,195,217,.35)';
      btn.style.color='var(--cyan)';
    });

    // Aide courte : rassure l'utilisateur sur le fait que "Retour" n'est
    // pas synonyme d'annulation. Ajoutée une seule fois sous le bouton actif.
    const actif=ids.map(id=>document.getElementById(id)).find(Boolean);
    if(actif && !document.getElementById('nexusRetourCorrectionNote')){
      const note=document.createElement('div');
      note.id='nexusRetourCorrectionNote';
      note.style.cssText='font-size:11px;color:var(--text-dim);text-align:center;margin-top:-4px;margin-bottom:12px;line-height:1.45;';
      note.textContent='Vos saisies restent dans la visite en cours. Seul « Annuler » recommence la réception.';
      actif.insertAdjacentElement('afterend',note);
    }
  }

  function corriger(){
    reparerSelectCuve();
    corrigerMessageIncomplet();
    rendreRetourExplicite();
  }

  function init(){
    corriger();
    const obs=new MutationObserver(()=>corriger());
    obs.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','disabled']});
    document.addEventListener('click',e=>{
      if(e.target&&e.target.closest&&e.target.closest('#btnToggleVideCompartiment,.carburant-chip')) setTimeout(corriger,0);
    },true);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
