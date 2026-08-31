// NEXUS Stock localisé — deep-link transfert interne prérempli.
// Utilisé depuis Contrôle inventaire pour aller directement du besoin à l'action.
(function(){
  'use strict';
  if((location.pathname.split('/').pop()||'')!=='NEXUS-Stock-Localise-v1.html') return;
  const qs=new URLSearchParams(location.search);
  const produit=qs.get('reassort_produit'),source=qs.get('reassort_source'),destination=qs.get('reassort_destination');
  const cartouches=Number(qs.get('reassort_cartouches')),facteur=Number(qs.get('reassort_facteur'));
  if(!produit||!source||!destination||!(cartouches>0)||!(facteur>0)) return;

  function nettoyerUrl(){
    const u=new URL(location.href);['reassort_produit','reassort_source','reassort_destination','reassort_cartouches','reassort_facteur'].forEach(k=>u.searchParams.delete(k));
    history.replaceState(null,'',u.pathname+u.search+u.hash);
  }
  async function tenter(){
    for(let i=0;i<80;i++){
      const btn=document.getElementById('nexusStockTransferBtn');
      if(btn){
        btn.click();
        for(let j=0;j<40;j++){
          const p=document.getElementById('nstProduit'),s=document.getElementById('nstSource'),d=document.getElementById('nstDestination'),q=document.getElementById('nstQuantite'),u=document.getElementById('nstUnite'),f=document.getElementById('nstFacteur');
          if(p&&s&&d&&q&&u&&f){
            p.value=produit;p.dispatchEvent(new Event('change'));
            s.value=source;s.dispatchEvent(new Event('change'));
            d.value=destination;d.dispatchEvent(new Event('change'));
            u.value='cartouche';u.dispatchEvent(new Event('change'));
            f.value=String(facteur);f.dispatchEvent(new Event('input'));
            q.value=String(cartouches);
            nettoyerUrl();
            return;
          }
          await new Promise(r=>setTimeout(r,100));
        }
      }
      await new Promise(r=>setTimeout(r,100));
    }
    console.warn('NEXUS: transfert prérempli indisponible.');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tenter,{once:true});else tenter();
})();