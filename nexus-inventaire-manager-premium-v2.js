// NEXUS Inventaire Manager — finition premium V2
// Couche de présentation uniquement : aucune donnée métier, aucun calcul,
// aucune décision et aucun enregistrement ne sont modifiés ici.
(function () {
  'use strict';

  if (!/NEXUS-Inventaire-Manager-v1\.html$/i.test(window.location.pathname)) return;

  const STYLE_ID = 'nexus-inventaire-manager-premium-v2-style';

  const normaliser = (texte) => String(texte || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

  function injecterStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      :root{
        --inv-premium-surface:#111820;
        --inv-premium-surface-2:#151E28;
        --inv-premium-surface-3:#19232F;
        --inv-premium-line:rgba(141,162,183,.15);
        --inv-premium-line-strong:rgba(141,162,183,.23);
        --inv-premium-cyan:#56C7DC;
        --inv-premium-cyan-soft:rgba(86,199,220,.10);
        --inv-premium-gold:#D7B45B;
        --inv-premium-gold-soft:rgba(215,180,91,.09);
        --inv-premium-green:#55D7A0;
        --inv-premium-radius:16px;
        --inv-premium-shadow:0 12px 34px rgba(0,0,0,.18);
        --ipv-body-bg:#0B0F14;
        --ipv-card-bg:linear-gradient(180deg, rgba(21,30,40,.96), rgba(17,24,32,.96));
        --ipv-card-secondary:rgba(17,24,32,.72);
        --ipv-field-bg:rgba(21,30,40,.9);
        --ipv-pill-bg:rgba(21,30,40,.82);
        --ipv-statut-bg:rgba(255,255,255,.018);
        --ipv-file-bg:rgba(25,35,47,.72);
        --ipv-badge-bg:rgba(25,35,47,.62);
        --ipv-stat-bg:linear-gradient(180deg, rgba(25,35,47,.8), rgba(18,26,35,.82));
        --ipv-eyebrow:rgba(86,199,220,.88);
        --ipv-titre:#8997A5;
        --ipv-titre-cyan:rgba(86,199,220,.82);
        --ipv-titre-or:rgba(215,180,91,.82);
        --ipv-vide:#8997A5;
        --ipv-statut:#8997A5;
        --ipv-desc:#8997A5;
      }
      /* Jour : les surfaces et les textes de cette feuille suivent le thème actif (jamais un fond Sombre sous un texte Jour). */
      :root[data-theme="jour"]{
        --inv-premium-line:var(--line);
        --inv-premium-line-strong:#B8C4CF;
        --inv-premium-shadow:0 4px 14px rgba(15,23,42,.08);
        --ipv-body-bg:var(--bg);
        --ipv-card-bg:var(--panel);
        --ipv-card-secondary:#F8FAFC;
        --ipv-field-bg:var(--panel);
        --ipv-pill-bg:var(--panel);
        --ipv-statut-bg:#F1F5F9;
        --ipv-file-bg:#F1F5F9;
        --ipv-badge-bg:#F1F5F9;
        --ipv-stat-bg:var(--panel);
        --ipv-eyebrow:#0B6F83;
        --ipv-titre:var(--text-mid);
        --ipv-titre-cyan:#0B6F83;
        --ipv-titre-or:#7A5A00;
        --ipv-vide:var(--text-mid);
        --ipv-statut:var(--text-mid);
        --ipv-desc:var(--text-mid);
        --ipv-access-bg:var(--panel);
      }

      .synthese-card .param-note{color:var(--text-mid)}

      body.nexus-inventaire-manager-premium-v2{
        background:
          radial-gradient(circle at 14% -8%, rgba(79,195,217,.055), transparent 28%),
          radial-gradient(circle at 86% 0%, rgba(212,175,55,.035), transparent 24%),
          var(--ipv-body-bg);
      }

      body.nexus-inventaire-manager-premium-v2 .phone{
        border-left:0 !important;
        border-right:0 !important;
      }

      body.nexus-inventaire-manager-premium-v2 .header{
        padding-top:26px;
        padding-bottom:18px;
      }

      body.nexus-inventaire-manager-premium-v2 .eyebrow{
        font-size:10px;
        letter-spacing:.16em;
        color:var(--ipv-eyebrow);
      }

      body.nexus-inventaire-manager-premium-v2 .title{
        font-size:clamp(22px,2vw,30px);
        letter-spacing:-.025em;
        font-weight:650;
      }

      body.nexus-inventaire-manager-premium-v2 .divider{
        background:linear-gradient(90deg, transparent, rgba(141,162,183,.22) 8%, rgba(141,162,183,.22) 92%, transparent);
      }

      body.nexus-inventaire-manager-premium-v2 .section{
        padding-top:18px;
        padding-bottom:28px;
      }

      body.nexus-inventaire-manager-premium-v2 .section-titre,
      body.nexus-inventaire-manager-premium-v2 .section-titre-action-row .section-titre{
        margin-top:24px;
        margin-bottom:9px;
        color:var(--ipv-titre);
        font-size:9.5px;
        font-weight:700;
        letter-spacing:.115em;
      }

      body.nexus-inventaire-manager-premium-v2 .section-titre.premium-primary-section{
        color:var(--ipv-titre-cyan);
      }

      body.nexus-inventaire-manager-premium-v2 .section-titre.premium-decision-section{
        color:var(--ipv-titre-or);
      }

      body.nexus-inventaire-manager-premium-v2 .card,
      body.nexus-inventaire-manager-premium-v2 .ventes-card,
      body.nexus-inventaire-manager-premium-v2 .empty{
        border-color:var(--inv-premium-line) !important;
        border-radius:var(--inv-premium-radius) !important;
        background:var(--ipv-card-bg) !important;
        box-shadow:var(--inv-premium-shadow);
      }

      body.nexus-inventaire-manager-premium-v2 .card{
        padding:7px 15px;
      }

      body.nexus-inventaire-manager-premium-v2 .premium-card-primary{
        position:relative;
        overflow:hidden;
        border-color:rgba(86,199,220,.20) !important;
      }

      body.nexus-inventaire-manager-premium-v2 .premium-card-primary::before{
        content:'';
        position:absolute;
        inset:0 auto 0 0;
        width:2px;
        background:linear-gradient(180deg, transparent, rgba(86,199,220,.75), transparent);
      }

      body.nexus-inventaire-manager-premium-v2 .premium-card-decision{
        border-color:rgba(215,180,91,.18) !important;
      }

      body.nexus-inventaire-manager-premium-v2 .premium-card-secondary{
        box-shadow:none;
        background:var(--ipv-card-secondary) !important;
      }

      body.nexus-inventaire-manager-premium-v2 .empty{
        min-height:58px;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:15px 18px;
        color:var(--ipv-vide);
        line-height:1.5;
        box-shadow:none;
      }

      body.nexus-inventaire-manager-premium-v2 .quart-select-row{
        gap:7px;
        align-items:stretch;
      }

      body.nexus-inventaire-manager-premium-v2 .date-input{
        min-height:42px;
        border-radius:12px;
        border-color:var(--inv-premium-line);
        background:var(--ipv-field-bg);
        font-size:14px;
      }

      body.nexus-inventaire-manager-premium-v2 .quart-pill,
      body.nexus-inventaire-manager-premium-v2 .periode-pill{
        border-color:var(--inv-premium-line);
        background:var(--ipv-pill-bg);
        transition:transform .15s ease, border-color .15s ease, background .15s ease;
      }

      body.nexus-inventaire-manager-premium-v2 .quart-pill:hover,
      body.nexus-inventaire-manager-premium-v2 .periode-pill:hover{
        transform:translateY(-1px);
        border-color:var(--inv-premium-line-strong);
      }

      body.nexus-inventaire-manager-premium-v2 .quart-pill.active{
        background:rgba(86,199,220,.12);
        border-color:rgba(86,199,220,.30);
        box-shadow:inset 0 0 0 1px rgba(86,199,220,.05);
      }

      body.nexus-inventaire-manager-premium-v2 .periode-pill.active{
        background:rgba(215,180,91,.10);
        border-color:rgba(215,180,91,.27);
      }

      body.nexus-inventaire-manager-premium-v2 .quart-statut{
        display:inline-flex;
        align-items:center;
        min-height:28px;
        padding:5px 9px;
        margin:2px 0 15px;
        border-radius:8px;
        border:1px solid var(--inv-premium-line);
        background:var(--ipv-statut-bg);
        color:var(--ipv-statut);
      }

      body.nexus-inventaire-manager-premium-v2 .ventes-card{
        position:relative;
        overflow:hidden;
        padding:17px;
        border-color:rgba(86,199,220,.18) !important;
      }

      body.nexus-inventaire-manager-premium-v2 .ventes-card::after{
        content:'';
        position:absolute;
        width:220px;
        height:220px;
        right:-100px;
        top:-130px;
        pointer-events:none;
        background:radial-gradient(circle, rgba(86,199,220,.07), transparent 68%);
      }

      body.nexus-inventaire-manager-premium-v2 .ventes-desc{
        max-width:880px;
        color:var(--ipv-desc);
      }

      body.nexus-inventaire-manager-premium-v2 .ventes-file-label{
        min-height:42px;
        border-color:rgba(141,162,183,.16);
        background:var(--ipv-file-bg);
      }

      body.nexus-inventaire-manager-premium-v2 .btn-comparer{
        min-height:42px;
        border-radius:11px;
        padding-left:16px;
        padding-right:16px;
        box-shadow:0 8px 18px rgba(79,195,217,.12);
      }

      body.nexus-inventaire-manager-premium-v2 .snapshot-badge,
      body.nexus-inventaire-manager-premium-v2 .ventes-resume{
        border:1px solid var(--inv-premium-line);
        background:var(--ipv-badge-bg);
      }

      body.nexus-inventaire-manager-premium-v2 .stats-row{
        gap:8px;
      }

      body.nexus-inventaire-manager-premium-v2 .stat-mini{
        border-radius:13px;
        border-color:var(--inv-premium-line);
        background:var(--ipv-stat-bg);
      }

      body.nexus-inventaire-manager-premium-v2 button,
      body.nexus-inventaire-manager-premium-v2 a{
        -webkit-tap-highlight-color:transparent;
      }

      body.nexus-inventaire-manager-premium-v2 .menu-btn{
        border-color:rgba(86,199,220,.22);
        background:rgba(86,199,220,.075);
        box-shadow:0 8px 24px rgba(0,0,0,.12);
      }

      @media (min-width: 900px){
        body.nexus-inventaire-manager-premium-v2 .phone{
          max-width:1640px !important;
          padding-left:10px;
          padding-right:10px;
        }

        body.nexus-inventaire-manager-premium-v2 .header{
          padding-left:28px;
          padding-right:28px;
        }

        body.nexus-inventaire-manager-premium-v2 .divider{
          margin-left:28px;
          margin-right:28px;
        }

        body.nexus-inventaire-manager-premium-v2 .section{
          padding-left:28px;
          padding-right:28px;
        }
      }

      @media (max-width: 560px){
        body.nexus-inventaire-manager-premium-v2 .header{
          padding:20px 16px 14px;
        }

        body.nexus-inventaire-manager-premium-v2 .section{
          padding-left:14px;
          padding-right:14px;
        }

        body.nexus-inventaire-manager-premium-v2 .divider{
          margin-left:14px;
          margin-right:14px;
        }

        body.nexus-inventaire-manager-premium-v2 .quart-select-row{
          flex-wrap:wrap;
        }

        body.nexus-inventaire-manager-premium-v2 .date-input{
          min-width:100%;
        }

        body.nexus-inventaire-manager-premium-v2 .ventes-file-row{
          align-items:stretch;
          flex-direction:column;
        }

        body.nexus-inventaire-manager-premium-v2 .btn-comparer{
          width:100%;
          max-width:none;
        }

        body.nexus-inventaire-manager-premium-v2 .snapshot-heure-row{
          flex-direction:column;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function renommerEtClasserTitres() {
    document.querySelectorAll('.section-titre').forEach((el) => {
      const texte = normaliser(el.textContent);

      if (texte.includes('COUVERTURE PHYSIQUE DU CATALOGUE')) {
        el.textContent = 'Couverture terrain';
        el.classList.add('premium-primary-section');
      } else if (texte === 'BRIEF INVENTAIRE') {
        el.textContent = 'Pilotage du quart';
        el.classList.add('premium-primary-section');
      } else if (texte === 'PROGRESSION') {
        el.textContent = 'Avancement opérationnel';
        el.classList.add('premium-primary-section');
      } else if (texte === 'A TERMINER') {
        el.textContent = 'À faire';
        el.classList.add('premium-decision-section');
      } else if (texte === 'A CONTROLER') {
        el.textContent = 'Points à contrôler';
        el.classList.add('premium-decision-section');
      } else if (texte === 'DECISIONS DU QUART') {
        el.textContent = 'Décisions';
        el.classList.add('premium-decision-section');
      } else if (texte.includes('PHOTO DECENIUM')) {
        el.classList.add('premium-primary-section');
      }
    });
  }

  function classerCartes() {
    document.querySelectorAll('.card, .ventes-card, .empty').forEach((card) => {
      card.classList.remove('premium-card-primary', 'premium-card-decision', 'premium-card-secondary');

      let precedent = card.previousElementSibling;
      let garde = 0;
      while (precedent && garde < 4) {
        if (precedent.classList && precedent.classList.contains('section-titre')) break;
        if (precedent.classList && precedent.classList.contains('section-titre-action-row')) {
          precedent = precedent.querySelector('.section-titre');
          break;
        }
        precedent = precedent.previousElementSibling;
        garde += 1;
      }

      const titre = precedent && precedent.textContent ? normaliser(precedent.textContent) : '';
      if (/PILOTAGE DU QUART|AVANCEMENT OPERATIONNEL|PHOTO DECENIUM|COUVERTURE TERRAIN/.test(titre)) {
        card.classList.add('premium-card-primary');
      } else if (/A FAIRE|POINTS A CONTROLER|DECISIONS/.test(titre)) {
        card.classList.add('premium-card-decision');
      } else if (/HISTORIQUE|CHRONOLOGIE|PARAMETRES/.test(titre)) {
        card.classList.add('premium-card-secondary');
      }
    });
  }

  function clarifierEtatsVides() {
    document.querySelectorAll('.empty').forEach((el) => {
      const txt = normaliser(el.textContent);
      if (txt === 'AUCUN ECART OUVERT.') el.textContent = 'Aucun écart ouvert — rien ne nécessite votre intervention.';
      if (txt.includes('AUCUNE MISSION APPLICABLE')) {
        el.textContent = 'Aucune mission applicable pour cette phase. NEXUS reste en attente et ne considère pas le quart comme terminé.';
      }
    });
  }

  function appliquer() {
    document.body.classList.add('nexus-inventaire-manager-premium-v2');
    injecterStyles();
    renommerEtClasserTitres();
    classerCartes();
    clarifierEtatsVides();
  }

  let frame = null;
  function programmer() {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = null;
      appliquer();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', appliquer, { once: true });
  } else {
    appliquer();
  }

  const observer = new MutationObserver(programmer);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
