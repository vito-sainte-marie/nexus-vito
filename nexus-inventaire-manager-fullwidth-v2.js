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
      /* Le cockpit garde deux colonnes mais utilise réellement le viewport. */
      body.nexus-inventaire-manager-fullwidth .manager-layout,
      body.nexus-inventaire-manager-fullwidth .desktop-grid,
      body.nexus-inventaire-manager-fullwidth .content-grid,
      body.nexus-inventaire-manager-fullwidth .grid-2{
        width:100% !important;
        max-width:none !important;
      }
    }

    /* Très grands écrans : respiration supplémentaire sans recréer un conteneur étroit. */
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
  `;
  document.head.appendChild(style);
  document.body.classList.add('nexus-inventaire-manager-fullwidth');
})();
