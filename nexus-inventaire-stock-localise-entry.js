// NEXUS Inventaire V2 — accès manager au stock par emplacement
(function(){
  'use strict';
  const pages=new Set(['NEXUS-Inventaire-Manager-v1.html','NEXUS-Inventaire-v1.html']);
  const page=location.pathname.split('/').pop(); if(!pages.has(page)) return;

  function injecterStyleManager(){
    if(document.getElementById('nexusStockLocaliseEntryStyle')) return;
    const s=document.createElement('style');
    s.id='nexusStockLocaliseEntryStyle';
    s.textContent=`
      .nexus-stock-entry-manager{
        display:flex;align-items:center;justify-content:space-between;gap:14px;
        margin:14px 0 2px;padding:13px 15px;border-radius:14px;
        border:1px solid rgba(79,195,217,.24);
        background:linear-gradient(135deg,rgba(79,195,217,.10),rgba(20,27,34,.92) 45%,rgba(20,27,34,.96));
        box-shadow:0 10px 28px rgba(0,0,0,.16);text-decoration:none;
        transition:transform .15s ease,border-color .15s ease,background .15s ease;
      }
      .nexus-stock-entry-manager:hover{transform:translateY(-1px);border-color:rgba(79,195,217,.40);background:linear-gradient(135deg,rgba(79,195,217,.14),rgba(20,27,34,.94) 48%,rgba(20,27,34,.98));}
      .nexus-stock-entry-manager .nse-icon{width:38px;height:38px;display:grid;place-items:center;border-radius:11px;background:rgba(79,195,217,.11);border:1px solid rgba(79,195,217,.22);font-size:18px;flex:0 0 auto;}
      .nexus-stock-entry-manager .nse-copy{min-width:0;flex:1;}
      .nexus-stock-entry-manager .nse-title{font:700 12.5px/1.25 'IBM Plex Sans',sans-serif;color:#EAF2F6;letter-spacing:-.01em;}
      .nexus-stock-entry-manager .nse-sub{margin-top:3px;font:500 10.5px/1.35 'IBM Plex Sans',sans-serif;color:#7F93A3;}
      .nexus-stock-entry-manager .nse-action{font:700 10px/1 'IBM Plex Mono',monospace;color:#65D5E9;white-space:nowrap;display:flex;align-items:center;gap:6px;}
      .nexus-stock-entry-manager .nse-arrow{font-size:15px;line-height:1;}
      @media(min-width:900px){.nexus-stock-entry-manager{max-width:560px;margin-top:15px;}}
      @media(max-width:560px){.nexus-stock-entry-manager{align-items:flex-start}.nexus-stock-entry-manager .nse-action{margin-top:3px}.nexus-stock-entry-manager .nse-sub{max-width:230px}}
    `;
    document.head.appendChild(s);
  }

  function ajouterAccesManager(){
    if(document.getElementById('nexusStockLocaliseEntry')) return true;
    const header=document.querySelector('.header');
    if(!header) return false;
    injecterStyleManager();
    const a=document.createElement('a');
    a.id='nexusStockLocaliseEntry';
    a.href='NEXUS-Stock-Localise-v1.html';
    a.className='nexus-stock-entry-manager';
    a.innerHTML=`
      <span class="nse-icon">📦</span>
      <span class="nse-copy">
        <span class="nse-title">Stock par emplacement</span>
        <span class="nse-sub">Voir et relever le stock physique par lieu — bureau, boutique, dépôt…</span>
      </span>
      <span class="nse-action">Ouvrir <span class="nse-arrow">→</span></span>`;
    const meta=document.getElementById('nexusInventaireManagerPremiumMeta');
    const sub=header.querySelector('.sub');
    (meta||sub||header.lastElementChild)?.insertAdjacentElement('afterend',a);
    return true;
  }

  function ajouterAccesInventaire(){
    if(new URLSearchParams(location.search).has('test_role')) return;
    const acces=document.getElementById('nexusStockLocaliseEntry');
    const outils=document.getElementById('nexusOutilsStock');
    if(!acces||!outils)return;
    outils.hidden=false;
  }

  async function init(){
    try{
      const e=await nexusRequireAuth(); if(!e||!['manager','gerant'].includes(e.role)) return;
      if(page==='NEXUS-Inventaire-Manager-v1.html'){
        let essais=0;
        const tenter=()=>{if(ajouterAccesManager()||essais++>40)return;setTimeout(tenter,150)};
        tenter();
      }else{
        ajouterAccesInventaire();
      }
    }catch(err){console.error('Accès stock localisé:',err)}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
