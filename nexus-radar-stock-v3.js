// NEXUS — Radar Stock V3
// Le Radar consomme la vérité Stock Engine sans transformer la couverture
// des données en score de performance. Une donnée disponible n'est pas
// automatiquement une bonne performance, et une donnée absente n'est pas 0.
(function(){
  'use strict';

  async function attendre(max=100){
    for(let i=0;i<max;i++){
      if(window.NexusStock && window.nexusRequireAuth && document.getElementById('domainList')) return true;
      await new Promise(r=>setTimeout(r,100));
    }
    return false;
  }

  function injecterStyles(){
    if(document.getElementById('nexus-radar-stock-v3-style')) return;
    const style=document.createElement('style');
    style.id='nexus-radar-stock-v3-style';
    style.textContent=`
      .nexus-radar-stock-v3{margin-top:14px;background:var(--panel);border:1px solid rgba(79,195,217,.24);border-radius:14px;padding:15px 16px;}
      .nexus-radar-stock-v3-head{display:flex;align-items:center;justify-content:space-between;gap:12px;}
      .nexus-radar-stock-v3-title{font-size:13px;font-weight:700;}
      .nexus-radar-stock-v3-badge{font-family:var(--mono);font-size:9px;color:var(--cyan);background:rgba(79,195,217,.1);padding:4px 8px;border-radius:20px;}
      .nexus-radar-stock-v3-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:12px;}
      .nexus-radar-stock-v3-kpi{background:var(--panel-raised);border-radius:10px;padding:10px;}
      .nexus-radar-stock-v3-kpi b{display:block;font-family:var(--mono);font-size:17px;}
      .nexus-radar-stock-v3-kpi span{display:block;font-size:10px;color:var(--text-dim);margin-top:3px;line-height:1.35;}
      .nexus-radar-stock-v3-note{font-size:11px;color:var(--text-mid);line-height:1.55;margin-top:12px;}
    `;
    document.head.appendChild(style);
  }

  function trouverLigneStocks(){
    return [...document.querySelectorAll('#domainList .domain-row')].find(row=>{
      const t=(row.querySelector('.domain-name')?.textContent || '').toLowerCase();
      return t.includes('stock');
    }) || null;
  }

  function mettreAJourLigneStocks(resume){
    const row=trouverLigneStocks();
    if(!row) return false;
    const sub=row.querySelector('.domain-sub');
    if(sub) sub.textContent='Stock Engine connecté · données distinguées réel / théorique';
    const val=row.querySelector('.domain-val');
    if(val){
      val.classList.remove('non-mesure');
      val.textContent=`${resume.avecReference}/${resume.total}`;
      val.title='Références disposant d’une source de stock exploitable / références actives';
    }
    return true;
  }

  function rendreBloc(resume){
    const list=document.getElementById('domainList');
    if(!list) return;
    let el=document.getElementById('nexusRadarStockV3');
    if(!el){
      el=document.createElement('div');
      el.id='nexusRadarStockV3';
      el.className='nexus-radar-stock-v3';
      list.insertAdjacentElement('afterend',el);
    }
    el.innerHTML=`
      <div class="nexus-radar-stock-v3-head">
        <div class="nexus-radar-stock-v3-title">📦 État de connaissance du stock</div>
        <div class="nexus-radar-stock-v3-badge">Source centrale</div>
      </div>
      <div class="nexus-radar-stock-v3-grid">
        <div class="nexus-radar-stock-v3-kpi"><b>${resume.reel}</b><span>références avec stock physique observé</span></div>
        <div class="nexus-radar-stock-v3-kpi"><b>${resume.theorique}</b><span>références avec stock théorique disponible</span></div>
        <div class="nexus-radar-stock-v3-kpi"><b>${resume.comparables}</b><span>comparaisons réel / théorique fiables</span></div>
        <div class="nexus-radar-stock-v3-kpi"><b>${resume.indisponibles}</b><span>références sans source exploitable</span></div>
      </div>
      <div class="nexus-radar-stock-v3-note">Le Radar mesure ici la <b>couverture de connaissance</b>, pas la qualité du stock. Une référence connue n’est pas forcément saine ; un écart n’est interprété que lorsque réel et théorique sont temporellement comparables.</div>
    `;
  }

  function corrigerNoteHistorique(){
    const notes=[...document.querySelectorAll('.note-card')];
    const note=notes.find(n=>(n.textContent || '').includes('Capability 006'));
    if(!note) return;
    note.textContent='Les domaines non mesurables restent neutres. Le Stock Engine est maintenant connecté au Radar : NEXUS distingue stock physique, stock théorique et comparaisons fiables. Le Radar ne transforme pas encore cette couverture en score de performance tant que les seuils métier du site ne sont pas définis.';
  }

  (async()=>{
    if(!(await attendre())) return;
    injecterStyles();
    const employee=await window.nexusRequireAuth();
    if(!employee || !['manager','gerant'].includes(employee.role)) return;
    try{
      const etats=await window.NexusStock.chargerEtat(employee.site_id);
      const resume={
        total:etats.length,
        reel:etats.filter(e=>e.stock_reel_observe!=null).length,
        theorique:etats.filter(e=>e.stock_theorique!=null).length,
        comparables:etats.filter(e=>window.NexusStock.comparer(e).comparable).length,
        indisponibles:etats.filter(e=>window.NexusStock.stockPourUsage(e,'reference').quantite==null).length
      };
      resume.avecReference=resume.total-resume.indisponibles;
      rendreBloc(resume);
      corrigerNoteHistorique();
      let essais=0;
      const timer=setInterval(()=>{
        essais++;
        if(mettreAJourLigneStocks(resume) || essais>40) clearInterval(timer);
      },150);
    }catch(err){
      console.error('Radar Stock V3:',err);
    }
  })();
})();
