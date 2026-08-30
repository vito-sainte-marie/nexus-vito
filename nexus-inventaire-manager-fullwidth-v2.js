// NEXUS Inventaire Manager — layout desktop pleine largeur
// Présentation uniquement. Aucun calcul ni donnée métier modifié.
(function(){
  'use strict';
  if(!/NEXUS-Inventaire-Manager-v1\.html$/i.test(location.pathname)) return;

  const style=document.createElement('style');
  style.id='nexus-inventaire-manager-fullwidth-v2';
  style.textContent=`
    /* La page historique utilise .phone (460px). En desktop manager,
       NEXUS devient un cockpit et occupe tout l'espace de travail disponible. */
    @media (min-width: 900px){
      body.nexus-inventaire-manager-fullwidth{
        justify-content:stretch !important;
        align-items:stretch !important;
      }
      body.nexus-inventaire-manager-fullwidth .phone{
        width:100% !important;
        max-width:none !important;
        min-width:0 !important;
        margin:0 !important;
        padding-left:0 !important;
        padding-right:0 !important;
        flex:1 1 auto !important;
      }
      body.nexus-inventaire-manager-fullwidth .header,
      body.nexus-inventaire-manager-fullwidth .section{
        width:100% !important;
        max-width:none !important;
        padding-left:clamp(22px,2vw,36px) !important;
        padding-right:clamp(22px,2vw,36px) !important;
      }
      body.nexus-inventaire-manager-fullwidth .divider{
        margin-left:clamp(22px,2vw,36px) !important;
        margin-right:clamp(22px,2vw,36px) !important;
      }
      body.nexus-inventaire-manager-fullwidth .manager-layout,
      body.nexus-inventaire-manager-fullwidth .desktop-grid,
      body.nexus-inventaire-manager-fullwidth .content-grid,
      body.nexus-inventaire-manager-fullwidth .grid-2{
        width:100% !important;
        max-width:none !important;
      }
    }

    /* Photo Decenium ne doit jamais disparaître lors du passage plein écran. */
    body.nexus-inventaire-manager-fullwidth .ventes-card,
    body.nexus-inventaire-manager-fullwidth .snapshot-stock-row,
    body.nexus-inventaire-manager-fullwidth .snapshot-heure-row{
      visibility:visible !important;
      opacity:1 !important;
    }

    .inv-photo-decenium-access{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:18px;
      margin:4px 0 18px;
      padding:14px 16px;
      border:1px solid rgba(86,199,220,.22);
      border-radius:14px;
      background:linear-gradient(135deg,rgba(86,199,220,.10),rgba(21,30,40,.88) 52%,rgba(215,180,91,.045));
      text-decoration:none;
      color:inherit;
      box-shadow:0 10px 28px rgba(0,0,0,.14);
      cursor:pointer;
    }
    .inv-photo-decenium-access:hover{border-color:rgba(86,199,220,.38); transform:translateY(-1px);}
    .inv-photo-decenium-access-main{display:flex;align-items:center;gap:12px;min-width:0;}
    .inv-photo-decenium-access-icon{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:rgba(86,199,220,.12);font-size:17px;flex:0 0 auto;}
    .inv-photo-decenium-access-title{font-size:13px;font-weight:700;color:#E9F2F5;}
    .inv-photo-decenium-access-sub{font-size:11px;color:#8293A3;margin-top:2px;line-height:1.35;}
    .inv-photo-decenium-access-action{font:700 10px/1 var(--mono);color:#56C7DC;white-space:nowrap;letter-spacing:.03em;}
    .inv-photo-decenium-access.is-waiting{opacity:.65;cursor:default;pointer-events:none;}

    #photoDeceniumSection{scroll-margin-top:18px;}

    @media (min-width: 1500px){
      body.nexus-inventaire-manager-fullwidth .header,
      body.nexus-inventaire-manager-fullwidth .section{
        padding-left:38px !important;
        padding-right:38px !important;
      }
      body.nexus-inventaire-manager-fullwidth .divider{
        margin-left:38px !important;
        margin-right:38px !important;
      }
    }

    @media (max-width: 560px){
      .inv-photo-decenium-access{padding:12px 13px;gap:10px;}
      .inv-photo-decenium-access-sub{display:none;}
      .inv-photo-decenium-access-action{font-size:9px;}
    }
  `;
  document.head.appendChild(style);
  document.body.classList.add('nexus-inventaire-manager-fullwidth');

  function normaliser(s){
    return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toUpperCase();
  }

  function trouverPhotoDecenium(){
    const titres=[...document.querySelectorAll('.section-titre,.section-titre-action-row .section-titre')];
    const titre=titres.find(el=>normaliser(el.textContent).includes('PHOTO DECENIUM'));
    if(!titre) return null;
    titre.id='photoDeceniumSection';

    let n=titre.parentElement && titre.parentElement.classList.contains('section-titre-action-row')
      ? titre.parentElement.nextElementSibling
      : titre.nextElementSibling;
    let garde=0;
    while(n && garde<5 && !n.classList.contains('ventes-card')){ n=n.nextElementSibling; garde++; }
    if(n && n.classList.contains('ventes-card')){
      n.style.removeProperty('display');
      n.hidden=false;
      n.setAttribute('aria-hidden','false');
    }
    return {titre,carte:n && n.classList.contains('ventes-card') ? n : null};
  }

  function installerAccesPhoto(){
    let acces=document.getElementById('invPhotoDeceniumAccess');
    const photo=trouverPhotoDecenium();

    if(!acces){
      const section=document.querySelector('.section');
      if(!section) return;
      acces=document.createElement('a');
      acces.id='invPhotoDeceniumAccess';
      acces.className='inv-photo-decenium-access is-waiting';
      acces.href='#photoDeceniumSection';
      acces.innerHTML=`
        <span class="inv-photo-decenium-access-main">
          <span class="inv-photo-decenium-access-icon">📸</span>
          <span>
            <div class="inv-photo-decenium-access-title">Photo Decenium</div>
            <div class="inv-photo-decenium-access-sub">Rapprocher les ventes et le stock actuel avec les comptages physiques.</div>
          </span>
        </span>
        <span class="inv-photo-decenium-access-action">Ouvrir →</span>`;
      section.insertAdjacentElement('afterbegin',acces);
    }

    if(photo){
      acces.classList.remove('is-waiting');
      acces.onclick=(e)=>{
        e.preventDefault();
        photo.titre.scrollIntoView({behavior:'smooth',block:'start'});
      };
    }else{
      acces.classList.add('is-waiting');
      acces.querySelector('.inv-photo-decenium-access-action').textContent='Chargement…';
    }
  }

  installerAccesPhoto();
  const obs=new MutationObserver(()=>requestAnimationFrame(installerAccesPhoto));
  obs.observe(document.documentElement,{childList:true,subtree:true});
})();
