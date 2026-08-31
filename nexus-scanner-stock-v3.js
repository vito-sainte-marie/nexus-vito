// NEXUS Scanner — contexte stock issu du Stock Engine central.
// Le Scanner conserve ses calculs CA/marge/ABC ; cette couche ajoute seulement
// la nature et la fiabilité du stock disponible, sans reconstruire le stock.
(function(){
  'use strict';
  const PAGE='NEXUS-Scanner-v1.html';
  if((location.pathname.split('/').pop()||'')!==PAGE) return;

  function attendreMoteur(max=60){
    return new Promise((resolve,reject)=>{
      let n=0;const t=setInterval(()=>{n++;if(window.NexusStock){clearInterval(t);resolve(window.NexusStock);}else if(n>=max){clearInterval(t);reject(new Error('Stock Engine indisponible'));}},100);
    });
  }
  function style(){
    if(document.getElementById('nexusScannerStockStyles')) return;
    const s=document.createElement('style');s.id='nexusScannerStockStyles';s.textContent=`
      #nexusScannerStockContext{margin:14px 20px 0;padding:13px 14px;border:1px solid rgba(79,195,217,.20);border-radius:13px;background:linear-gradient(145deg,rgba(79,195,217,.055),var(--panel));}
      .nss-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.nss-title{font-size:12.5px;font-weight:700}.nss-badge{font:600 9px var(--mono);color:var(--cyan);border:1px solid rgba(79,195,217,.25);padding:3px 7px;border-radius:20px;white-space:nowrap}
      .nss-copy{font-size:10.5px;color:var(--text-mid);line-height:1.45;margin-top:4px}.nss-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:10px}.nss-kpi{background:var(--panel-raised);border-radius:9px;padding:8px;text-align:center}.nss-v{font:700 15px var(--mono)}.nss-l{font-size:8.5px;color:var(--text-dim);line-height:1.25;margin-top:2px}.nss-note{font-size:9.5px;color:var(--text-dim);line-height:1.4;margin-top:9px}.nss-link{display:inline-block;margin-top:8px;font:600 10px var(--mono);color:var(--cyan)}
    `;document.head.appendChild(s);
  }
  function mount(){
    let el=document.getElementById('nexusScannerStockContext');if(el)return el;
    const root=document.getElementById('root');if(!root||!root.parentNode)return null;
    el=document.createElement('div');el.id='nexusScannerStockContext';el.innerHTML='<div class="nss-copy">Lecture de la vérité stock centrale…</div>';
    root.parentNode.insertBefore(el,root);return el;
  }
  async function init(){
    style();const el=mount();if(!el)return;
    try{
      const moteur=await attendreMoteur();const emp=await nexusRequireAuth();if(!emp)return;
      const rows=await moteur.chargerEtat(emp.site_id);
      const reel=rows.filter(r=>r.stock_reel_observe!=null).length;
      const theorique=rows.filter(r=>r.stock_reel_observe==null&&r.stock_theorique!=null).length;
      const comparable=rows.filter(r=>moteur.comparer(r).comparable).length;
      const provisoire=rows.filter(r=>r.stock_reel_observe!=null&&r.stock_theorique!=null&&!moteur.comparer(r).comparable).length;
      el.innerHTML=`<div class="nss-head"><div class="nss-title">Contexte stock</div><span class="nss-badge">Stock Engine</span></div>
        <div class="nss-copy">Scanner peut désormais lire la même vérité stock qu’Inventaire et Cockpit. Le réel et le théorique restent séparés.</div>
        <div class="nss-grid"><div class="nss-kpi"><div class="nss-v">${reel}</div><div class="nss-l">stock réel</div></div><div class="nss-kpi"><div class="nss-v">${theorique}</div><div class="nss-l">théorique seul</div></div><div class="nss-kpi"><div class="nss-v">${comparable}</div><div class="nss-l">comparables</div></div></div>
        <div class="nss-note">${provisoire?`${provisoire} comparaison${provisoire>1?'s':''} reste${provisoire>1?'nt':''} provisoire${provisoire>1?'s':''} car les horodatages réel/théorique sont trop éloignés.`:'Aucune comparaison provisoire actuellement.'} Aucun import ne remplace le stock réel.</div>
        <a class="nss-link" href="NEXUS-Inventaire-Manager-v1.html">Voir la source Inventaire →</a>`;
    }catch(e){console.error('Scanner Stock Engine:',e);el.innerHTML='<div class="nss-head"><div class="nss-title">Contexte stock</div><span class="nss-badge">Stock Engine</span></div><div class="nss-copy">Contexte stock momentanément indisponible. Les calculs CA, marge et ABC du Scanner restent inchangés.</div>';}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
