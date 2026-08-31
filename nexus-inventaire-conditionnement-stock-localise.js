// NEXUS Inventaire — applique les facteurs de conditionnement par produit
// sur Stock par emplacement, Contrôle ciblé et Transfert interne.
(function(){
  'use strict';
  if((location.pathname.split('/').pop()||'')!=='NEXUS-Stock-Localise-v1.html') return;

  const attendre=()=>new Promise(resolve=>{
    let n=0;const t=setInterval(()=>{n++;if(window.NexusConditionnement){clearInterval(t);resolve(true);}else if(n>80){clearInterval(t);resolve(false);}},75);
  });
  const facteur=(designation,fallback=10)=>window.NexusConditionnement.facteurDepuisDesignation(designation,fallback)||fallback;

  function designationLigne(row){return row?.querySelector('.product')?.textContent?.trim()||'';}
  function ajusterLignes(){
    const fallback=Math.max(1,Number(document.getElementById('facteur')?.value)||10);
    document.querySelectorAll('.row[data-prod]').forEach(row=>{
      const cart=row.querySelector('.q-cart'),pack=row.querySelector('.q-pack');
      if(!cart||!pack||row.dataset.nexusConditionnementApplique==='1') return;
      const nom=designationLigne(row),f=facteur(nom,fallback);
      // Le rendu natif a décomposé avec le facteur global. On reconstruit la
      // quantité de base puis on la redécompose avec le facteur du produit.
      const base=(Math.max(0,Number(cart.value)||0)*fallback)+Math.max(0,Number(pack.value)||0);
      const d=window.NexusConditionnement.decomposer(base,nom,fallback);
      cart.value=d.conditionnements;pack.value=d.unites;
      row.dataset.nexusConditionnementApplique='1';row.dataset.nexusFacteur=String(f);
      const labels=row.querySelectorAll('.miniLabel');
      labels.forEach(l=>{if(/cartouches/i.test(l.textContent||''))l.textContent=`Cartouches (${f}P)`;});
    });
  }

  function ajusterFacteurCible(){
    const prod=document.getElementById('nccProduit'),input=document.getElementById('nccFacteur');
    if(!prod||!input) return;
    const nom=prod.options[prod.selectedIndex]?.textContent||''; const f=facteur(nom,10);
    input.value=String(f);input.readOnly=true;input.title=`Conditionnement détecté dans la désignation : ${f}P`;
  }

  function ajusterFacteurTransfert(){
    const prod=document.getElementById('nstProduit'),unite=document.getElementById('nstUnite'),input=document.getElementById('nstFacteur');
    if(!prod||!unite||!input||unite.value!=='cartouche') return;
    const nom=prod.options[prod.selectedIndex]?.textContent||''; const f=facteur(nom,10);
    input.value=String(f);input.readOnly=true;input.title=`Conditionnement détecté dans la désignation : ${f}P`;
  }

  async function enregistrerReleveComplet(ev){
    const btn=ev.target.closest?.('#btnEnregistrer'); if(!btn) return;
    ev.preventDefault();ev.stopImmediatePropagation();
    const emp=await nexusRequireAuth(); if(!emp) return;
    const catId=document.getElementById('categorie')?.value;
    const rows=[];
    for(const row of document.querySelectorAll('.row[data-prod]')){
      const produitId=row.dataset.prod; if(!produitId) continue;
      const nom=designationLigne(row);const f=facteur(nom,Math.max(1,Number(document.getElementById('facteur')?.value)||10));
      const pairs=new Map();
      row.querySelectorAll('.q-cart[data-zone]').forEach(c=>pairs.set(c.dataset.zone,{c,u:row.querySelector(`.q-pack[data-zone="${c.dataset.zone}"]`)}));
      for(const [zoneId,x] of pairs){
        if(!x.c||!x.u||x.c.value===''||x.u.value===''){
          const status=document.getElementById('status');if(status){status.textContent='Complétez toutes les références visibles.';status.className='status err';}
          return;
        }
        const cond=Math.max(0,Number(x.c.value)||0),unit=Math.max(0,Number(x.u.value)||0);
        rows.push({site:emp.site_id,produit_id:produitId,zone_id:zoneId,quantite_base:cond*f+unit,quantite_conditionnement:cond,quantite_unitaire:unit,facteur_conditionnement:f,unite_conditionnement:'cartouche',employee_id:emp.id,type_releve:'complet'});
      }
    }
    if(!rows.length) return;
    btn.disabled=true;const status=document.getElementById('status');if(status){status.textContent='Enregistrement…';status.className='status';}
    const {error}=await nexusClient.from('inventaire_stock_localise_releves').insert(rows);
    if(error){console.error('Relevé localisé conditionnement:',error);btn.disabled=false;if(status){status.textContent='Enregistrement impossible';status.className='status err';}return;}
    if(status){status.textContent='Relevé enregistré';status.className='status ok';}
    setTimeout(()=>location.reload(),350);
  }

  async function init(){
    if(!(await attendre())) return;
    const factorWrap=document.getElementById('facteur')?.closest('.factor');
    if(factorWrap){factorWrap.title='Valeur de secours uniquement. Les suffixes -10P, -8P, -5P… de chaque produit sont prioritaires.';}

    const mo=new MutationObserver(()=>{adjust();});
    function adjust(){ajusterLignes();ajusterFacteurCible();ajusterFacteurTransfert();}
    mo.observe(document.body,{childList:true,subtree:true,attributes:false});
    document.addEventListener('change',e=>{
      if(e.target?.id==='nccProduit')setTimeout(ajusterFacteurCible,0);
      if(['nstProduit','nstUnite'].includes(e.target?.id))setTimeout(ajusterFacteurTransfert,0);
    },true);
    document.addEventListener('click',enregistrerReleveComplet,true);
    adjust();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
