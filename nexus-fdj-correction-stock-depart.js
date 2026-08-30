// NEXUS FDJ — correction du stock de départ pendant la clôture
// Objectif : si la caissière constate une erreur de comptage d'ouverture,
// elle peut corriger le départ avant de clôturer. La modification est ensuite
// persistée par le flux FDJ existant et tracée automatiquement côté Supabase.
(function () {
  'use strict';
  if (!/NEXUS-FDJ-v1\.html$/i.test(location.pathname)) return;

  const style = document.createElement('style');
  style.textContent = `
    .fdj-depart-edit-wrap{position:relative}
    .fdj-depart-edit{border-color:rgba(79,195,217,.30)!important;background:rgba(79,195,217,.035)!important}
    .fdj-depart-edit.modifie{border-color:rgba(245,166,35,.58)!important;background:rgba(245,166,35,.055)!important;color:#f7c86c!important}
    .fdj-depart-edit-note{margin:0 0 12px;padding:10px 12px;border:1px solid rgba(79,195,217,.16);border-radius:10px;background:rgba(79,195,217,.045);font-size:11px;line-height:1.45;color:#8392a5}
    .fdj-depart-edit-note b{color:#d8f8ff;font-weight:600}
    .fdj-depart-edit-badge{display:none;margin-top:4px;text-align:center;font:600 8px 'IBM Plex Mono',monospace;letter-spacing:.04em;text-transform:uppercase;color:#f5a623}
    .fdj-depart-edit-wrap.modifie .fdj-depart-edit-badge{display:block}
  `;
  document.head.appendChild(style);

  const valeursOrigine = new Map();
  const valeursModifiees = new Map();
  let raf = null;

  function phaseClotureVisible() {
    const titre = (document.getElementById('titre')?.textContent || '').toLowerCase();
    return titre.includes('grattage') || document.querySelector('.champ-stock-final');
  }

  function injecterNote() {
    if (!phaseClotureVisible() || document.querySelector('.fdj-depart-edit-note')) return;
    const stepper = document.querySelector('.stepper-label') || document.querySelector('.stepper');
    if (!stepper) return;
    const note = document.createElement('div');
    note.className = 'fdj-depart-edit-note';
    note.innerHTML = '<b>Erreur au départ ?</b> Vous pouvez corriger le stock de départ avant de clôturer. NEXUS conserve automatiquement la trace de la modification.';
    stepper.insertAdjacentElement('afterend', note);
  }

  function rendreDepartsEditables() {
    if (!phaseClotureVisible()) return;
    document.querySelectorAll('.jeu-row').forEach(row => {
      const gameId = row.dataset.jeu;
      if (!gameId) return;
      const labels = [...row.querySelectorAll('.jeu-input-label')];
      const labelDepart = labels.find(el => (el.textContent || '').trim().toLowerCase() === 'départ');
      if (!labelDepart) return;
      const wrap = labelDepart.closest('.jeu-input-wrap');
      if (!wrap || wrap.querySelector('.fdj-depart-edit')) return;
      const readonly = wrap.querySelector('.jeu-input-readonly');
      if (!readonly) return;

      let courant = null;
      try {
        courant = (typeof countsSaisie !== 'undefined' && countsSaisie[gameId]) ? countsSaisie[gameId].stock_initial : null;
      } catch (_) {}
      if (courant === null || courant === undefined) {
        const brut = (readonly.textContent || '').replace(',', '.').trim();
        courant = brut === '' ? null : Number(brut);
      }
      if (!valeursOrigine.has(gameId)) valeursOrigine.set(gameId, courant);

      const conteneur = document.createElement('div');
      conteneur.className = 'fdj-depart-edit-wrap';
      const input = document.createElement('input');
      input.type = 'number';
      input.inputMode = 'decimal';
      input.min = '0';
      input.step = '1';
      input.className = 'jeu-input fdj-depart-edit';
      input.dataset.jeu = gameId;
      input.value = courant ?? '';
      input.setAttribute('aria-label', 'Corriger le stock de départ');
      const badge = document.createElement('div');
      badge.className = 'fdj-depart-edit-badge';
      badge.textContent = 'Départ corrigé';
      conteneur.appendChild(input);
      conteneur.appendChild(badge);
      readonly.replaceWith(conteneur);

      const appliquer = () => {
        const valeur = input.value === '' ? null : Number(input.value);
        const origine = valeursOrigine.get(gameId);
        try {
          if (typeof countsSaisie !== 'undefined') {
            if (!countsSaisie[gameId]) countsSaisie[gameId] = { stock_initial: null, appro: 0, stock_final: null };
            countsSaisie[gameId].stock_initial = valeur;
            countsSaisie[gameId].stock_initial_auto = false;
          }
          if (typeof sauvegarderDraft === 'function') sauvegarderDraft();
        } catch (err) {
          console.error('FDJ — correction stock de départ:', err);
        }
        const modifie = Number(valeur) !== Number(origine);
        conteneur.classList.toggle('modifie', modifie);
        input.classList.toggle('modifie', modifie);
        if (modifie) valeursModifiees.set(gameId, { ancienne: origine, nouvelle: valeur });
        else valeursModifiees.delete(gameId);
      };

      input.addEventListener('input', appliquer);
      input.addEventListener('change', () => {
        appliquer();
        // Le calcul des ventes/anomalies dépend du départ. On réaffiche après
        // validation du champ, pas à chaque frappe, pour ne pas casser le clavier mobile.
        try { if (typeof renderGrattage === 'function') renderGrattage(); } catch (_) {}
      });
      input.addEventListener('keydown', e => {
        try { if (typeof jeuInputToucheEntree === 'function') jeuInputToucheEntree(e); } catch (_) {}
      });

      const dejaModifie = valeursModifiees.has(gameId);
      conteneur.classList.toggle('modifie', dejaModifie);
      input.classList.toggle('modifie', dejaModifie);
    });
  }

  function appliquerUX() {
    injecterNote();
    rendreDepartsEditables();
  }

  const observer = new MutationObserver(() => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(appliquerUX);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', appliquerUX, { once: true });
  else appliquerUX();
})();
