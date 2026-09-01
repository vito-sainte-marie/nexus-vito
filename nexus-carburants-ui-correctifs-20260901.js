// NEXUS Carburants Performance — correctifs UI ciblés après captures Safari iOS du 01/09/2026.
// Aucun calcul métier n'est modifié.
(function () {
  'use strict';
  if ((location.pathname.split('/').pop() || '').toLowerCase() !== 'nexus-carburants-pilotage-v1.html') return;

  function css() {
    if (document.getElementById('nexus-carburants-ui-correctifs-20260901-css')) return;
    const s = document.createElement('style');
    s.id = 'nexus-carburants-ui-correctifs-20260901-css';
    s.textContent = `
      #moteurZone .kpi-row.nexus-lecture-row{display:block!important;padding-top:12px!important;}
      #moteurZone .nexus-lecture-row .kpi-label{display:block!important;margin:0 0 6px!important;font-family:var(--sans)!important;font-size:11px!important;font-weight:600!important;color:var(--text-mid)!important;}
      #moteurZone .nexus-lecture-row .kpi-valeur{display:block!important;width:100%!important;text-align:left!important;font-family:var(--sans)!important;font-size:12.5px!important;font-weight:500!important;line-height:1.55!important;letter-spacing:0!important;white-space:normal!important;overflow-wrap:normal!important;word-break:normal!important;}
      .historique-pz-source.nexus-source-info{font-family:var(--sans)!important;text-transform:none!important;letter-spacing:0!important;}
      @media(max-width:430px){
        .stock-table{table-layout:fixed!important;width:100%!important;}
        .stock-table th,.stock-table td{padding-left:7px!important;padding-right:7px!important;}
        .stock-table th:nth-child(1),.stock-table td:nth-child(1){width:21%!important;}
        .stock-table th:nth-child(2),.stock-table td:nth-child(2),.stock-table th:nth-child(3),.stock-table td:nth-child(3),.stock-table th:nth-child(4),.stock-table td:nth-child(4){width:14%!important;white-space:nowrap!important;font-size:10.5px!important;}
        .stock-table th:nth-child(5),.stock-table td:nth-child(5){width:37%!important;}
        .historique-releve-preuve{font-family:var(--sans)!important;font-size:9.5px!important;white-space:nowrap!important;padding:4px 7px!important;}
        .historique-releve-source{font-family:var(--sans)!important;font-size:8px!important;line-height:1.25!important;}
      }
    `;
    document.head.appendChild(s);
  }

  function corrigerLecture() {
    const rows = document.querySelectorAll('#moteurZone .kpi-row');
    rows.forEach(row => {
      const label = row.querySelector('.kpi-label');
      if (!label || !/^Lecture\s*NEXUS$/i.test((label.textContent || '').trim())) return;
      row.classList.add('nexus-lecture-row');
      label.textContent = 'Lecture NEXUS';
      const valeur = row.querySelector('.kpi-valeur');
      if (valeur) {
        // La phrase reste une phrase de lecture, pas une donnée technique monospace.
        valeur.style.fontFamily = 'var(--sans)';
      }
    });
  }

  function corrigerSourcePointZeroHistorique() {
    // Correction historique ciblée et vérifiable : la référence certifiée du
    // 01/09/2026 est enregistrée en base avec source=veeder_root. L'ancien
    // renderer ne connaît que insite360/terrain et rabat toute autre source
    // sur « Autre ».
    document.querySelectorAll('.historique-pz-carte').forEach(carte => {
      const texte = carte.textContent || '';
      if (!/1\s*sept/i.test(texte) || !/POINT\s+ZÉRO\s+ACTIF/i.test(texte)) return;
      const src = carte.querySelector('.historique-pz-source');
      if (!src) return;
      src.textContent = 'Source : Veeder-Root';
      src.classList.add('nexus-source-info');
      src.removeAttribute('href'); src.removeAttribute('target'); src.removeAttribute('rel');
    });
  }

  function ajouterVeederRootAuSelecteur() {
    const select = document.getElementById('pz_source');
    if (!select || select.querySelector('option[value="veeder_root"]')) return;
    const option = document.createElement('option');
    option.value = 'veeder_root';
    option.textContent = 'Veeder-Root (jauge automatique locale)';
    const terrain = select.querySelector('option[value="terrain"]');
    select.insertBefore(option, terrain || null);
  }

  function appliquer() {
    css();
    corrigerLecture();
    corrigerSourcePointZeroHistorique();
    ajouterVeederRootAuSelecteur();
  }

  let raf = 0;
  function programmer() {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; appliquer(); });
  }
  appliquer();
  new MutationObserver(programmer).observe(document.body, { childList: true, subtree: true });
})();
