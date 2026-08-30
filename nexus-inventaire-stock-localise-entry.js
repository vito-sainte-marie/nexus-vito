// NEXUS Inventaire V2 — accès manager au stock par emplacement
(function(){
  'use strict';
  const pages=new Set(['NEXUS-Inventaire-Manager-v1.html','NEXUS-Inventaire-v1.html']);
  const page=location.pathname.split('/').pop(); if(!pages.has(page)) return;
  async function init(){
    try{
      const e=await nexusRequireAuth(); if(!e||!['manager','gerant'].includes(e.role)) return;
      if(document.getElementById('nexusStockLocaliseEntry')) return;
      const a=document.createElement('a'); a.id='nexusStockLocaliseEntry'; a.href='NEXUS-Stock-Localise-v1.html'; a.textContent='📦 Stock par emplacement';
      a.style.cssText="position:fixed;right:16px;bottom:72px;z-index:175;text-decoration:none;border:1px solid rgba(79,195,217,.38);background:#14232a;color:#4FC3D9;border-radius:22px;padding:10px 14px;font:600 11px 'IBM Plex Mono',monospace;box-shadow:0 8px 24px rgba(0,0,0,.30)";
      document.body.appendChild(a);
    }catch(err){console.error('Accès stock localisé:',err)}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();