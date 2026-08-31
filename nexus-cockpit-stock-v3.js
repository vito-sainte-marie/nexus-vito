// NEXUS Cockpit — lecture du Stock Engine central.
// Présentation/lecture seule : aucune écriture de stock depuis le Cockpit.
// Doctrine : réel et théorique restent distincts ; aucun écart n'est présenté
// comme décisionnel si les horodatages ne sont pas comparables.
(function(){
  'use strict';
  const PAGE='NEXUS-Cockpit-v2.html';
  if((location.pathname.split('/').pop()||'')!==PAGE) return;

  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const fmt=q=>q==null?'—':new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(Number(q));
  const signe=q=>q>0?`+${fmt(q)}`:fmt(q);

  function attendreMoteur(max=60){
    return new Promise((resolve,reject)=>{
      let n=0;
      const t=setInterval(()=>{
        n++;
        if(window.NexusStock){clearInterval(t);resolve(window.NexusStock);}
        else if(n>=max){clearInterval(t);reject(new Error('Stock Engine indisponible'));}
      },100);
    });
  }

  function ajouterStyles(){
    if(document.getElementById('nexusCockpitStockStyles')) return;
    const s=document.createElement('style');
    s.id='nexusCockpitStockStyles';
    s.textContent=`
      #nexusCockpitStockSection .ncs-card{background:linear-gradient(145deg,rgba(79,195,217,.06),var(--panel));border:1px solid rgba(79,195,217,.20);border-radius:14px;padding:14px}
      #nexusCockpitStockSection .ncs-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
      #nexusCockpitStockSection .ncs-title{font-size:14px;font-weight:700;color:var(--text)}
      #nexusCockpitStockSection .ncs-sub{font-size:11px;color:var(--text-mid);line-height:1.45;margin-top:3px}
      #nexusCockpitStockSection .ncs-badge{font-family:var(--mono);font-size:9px;color:var(--cyan);border:1px solid rgba(79,195,217,.25);background:rgba(79,195,217,.07);border-radius:20px;padding:4px 7px;white-space:nowrap}
      #nexusCockpitStockSection .ncs-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:7px;margin-top:12px}
      #nexusCockpitStockSection .ncs-kpi{background:var(--panel-raised);border:1px solid var(--hairline);border-radius:10px;padding:10px}
      #nexusCockpitStockSection .ncs-kpi-v{font:700 18px var(--mono);color:var(--text)}
      #nexusCockpitStockSection .ncs-kpi-l{font-size:10px;color:var(--text-dim);line-height:1.35;margin-top:2px}
      #nexusCockpitStockSection .ncs-list{margin-top:12px;border-top:1px solid var(--hairline)}
      #nexusCockpitStockSection .ncs-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;padding:9px 0;border-bottom:1px solid var(--hairline)}
      #nexusCockpitStockSection .ncs-name{font-size:11.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #nexusCockpitStockSection .ncs-meta{font-size:9.5px;color:var(--text-dim);margin-top:2px}
      #nexusCockpitStockSection .ncs-gap{font:600 12px var(--mono);color:var(--amber);align-self:center}
      #nexusCockpitStockSection .ncs-note{font-size:10px;color:var(--text-dim);line-height:1.45;margin-top:10px}
      #nexusCockpitStockSection .ncs-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:11px}
      #nexusCockpitStockSection .ncs-link{font:600 10.5px var(--mono);color:var(--cyan);text-decoration:none;padding:7px 9px;border:1px solid rgba(79,195,217,.22);border-radius:8px}
      @media(min-width:900px){#nexusCockpitStockSection .ncs-grid{grid-template-columns:repeat(4,1fr)}}
    `;
    document.head.appendChild(s);
  }

  function monterSection(){
    let section=document.getElementById('nexusCockpitStockSection');
    if(section) return section;
    const plans=document.getElementById('plansAction');
    const planSection=plans&&plans.closest('.section');
    if(!planSection||!planSection.parentNode) return null;
    section=document.createElement('div');
    section.className='section';
    section.id='nexusCockpitStockSection';
    section.innerHTML='<div class="section-title">État du stock <span class="badge badge-derived">Stock Engine NEXUS</span></div><div class="ncs-card"><div class="ncs-sub">Lecture de la vérité stock centrale…</div></div>';
    planSection.parentNode.insertBefore(section,planSection);
    const div=document.createElement('div');div.className='divider';
    planSection.parentNode.insertBefore(div,planSection);
    return section;
  }

  function rendre(section,rows){
    const reels=rows.filter(r=>r.stock_reel_observe!=null);
    const theoriqueSeul=rows.filter(r=>r.stock_reel_observe==null&&r.stock_theorique!=null);
    const comparables=rows.filter(r=>window.NexusStock.comparer(r).comparable);
    const provisoires=rows.filter(r=>r.stock_reel_observe!=null&&r.stock_theorique!=null&&!window.NexusStock.comparer(r).comparable);
    const localises=rows.filter(r=>r.transferts_internes_integres===true);
    const ecarts=comparables
      .map(r=>({r,c:window.NexusStock.comparer(r)}))
      .filter(x=>x.c.ecart!=null&&Math.abs(Number(x.c.ecart))>0.001)
      .sort((a,b)=>Math.abs(Number(b.c.ecart))-Math.abs(Number(a.c.ecart)))
      .slice(0,3);

    let detail='';
    if(ecarts.length){
      detail=`<div class="ncs-list">${ecarts.map(({r,c})=>`<div class="ncs-row"><div><div class="ncs-name">${esc(r.designation)}</div><div class="ncs-meta">Réel ${fmt(c.reel)} · Théorique ${fmt(c.theorique)} · horodatages comparables</div></div><div class="ncs-gap">${signe(Number(c.ecart))}</div></div>`).join('')}</div>`;
    }else if(comparables.length){
      detail='<div class="ncs-note">Les références actuellement comparables ne présentent pas d’écart mesurable.</div>';
    }else{
      detail='<div class="ncs-note">Aucun écart n’est interprété pour l’instant : NEXUS attend des sources réel/théorique suffisamment proches dans le temps.</div>';
    }

    section.innerHTML=`
      <div class="section-title">État du stock <span class="badge badge-derived">Stock Engine NEXUS</span></div>
      <div class="ncs-card">
        <div class="ncs-head"><div><div class="ncs-title">Une seule vérité stock, deux natures distinctes</div><div class="ncs-sub">Le réel vient du terrain. Le théorique vient des imports/Decenium. NEXUS ne les additionne jamais.</div></div><span class="ncs-badge">Lecture seule</span></div>
        <div class="ncs-grid">
          <div class="ncs-kpi"><div class="ncs-kpi-v">${reels.length}</div><div class="ncs-kpi-l">références avec stock réel</div></div>
          <div class="ncs-kpi"><div class="ncs-kpi-v">${theoriqueSeul.length}</div><div class="ncs-kpi-l">théorique uniquement</div></div>
          <div class="ncs-kpi"><div class="ncs-kpi-v">${comparables.length}</div><div class="ncs-kpi-l">réel / théorique comparables</div></div>
          <div class="ncs-kpi"><div class="ncs-kpi-v">${provisoires.length}</div><div class="ncs-kpi-l">comparaisons provisoires</div></div>
        </div>
        ${detail}
        <div class="ncs-note">${localises.length?`${localises.length} référence${localises.length>1?'s':''} intègre${localises.length>1?'nt':' '} les transferts internes dans le stock réel localisé, sans modifier le total global.`:'Les transferts internes seront intégrés dès qu’un stock réel localisé complet existe.'}</div>
        <div class="ncs-actions"><a class="ncs-link" href="NEXUS-Inventaire-Manager-v1.html">Contrôle inventaire →</a><a class="ncs-link" href="NEXUS-Stock-Localise-v1.html">Stock par emplacement →</a></div>
      </div>`;
  }

  async function init(){
    ajouterStyles();
    const section=monterSection();
    if(!section) return;
    try{
      const moteur=await attendreMoteur();
      const emp=await nexusRequireAuth();
      if(!emp) return;
      const rows=await moteur.chargerEtat(emp.site_id);
      rendre(section,rows);
    }catch(e){
      console.error('Cockpit Stock Engine:',e);
      section.innerHTML='<div class="section-title">État du stock <span class="badge badge-derived">Stock Engine NEXUS</span></div><div class="ncs-card"><div class="ncs-sub">État stock momentanément indisponible. Les autres moteurs du Cockpit restent inchangés.</div><div class="ncs-actions"><a class="ncs-link" href="NEXUS-Inventaire-Manager-v1.html">Ouvrir Inventaire →</a></div></div>';
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
