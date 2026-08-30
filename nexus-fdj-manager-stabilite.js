// NEXUS FDJ Manager — filet de stabilité après correction / rechargement.
// Ne touche à aucune donnée métier. Empêche seulement un écran de rester
// indéfiniment sur « Chargement… » et fiabilise le retour après enregistrement.
(function () {
  'use strict';
  if (!/NEXUS-FDJ-Manager-v1\.html$/i.test(location.pathname)) return;

  let timer = null;
  let generation = 0;

  function estChargement() {
    const content = document.getElementById('content');
    if (!content) return false;
    const t = (content.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    return !!content.querySelector('.loading') && t.includes('chargement');
  }

  function armerWatchdog() {
    generation += 1;
    const g = generation;
    if (timer) clearTimeout(timer);
    if (!estChargement()) return;
    timer = setTimeout(() => {
      if (g !== generation || !estChargement()) return;
      const content = document.getElementById('content');
      if (!content) return;
      content.innerHTML = `
        <div class="card" style="padding:16px;">
          <div style="font-weight:700;margin-bottom:6px;">Le chargement prend anormalement longtemps.</div>
          <div style="font-size:12px;color:var(--text-mid);line-height:1.5;margin-bottom:14px;">Votre dernière modification peut déjà avoir été enregistrée. NEXUS évite de vous laisser sur un écran bloqué.</div>
          <button type="button" class="btn-primary" id="fdjRetryManager">Recharger FDJ Opérations</button>
          <a href="NEXUS-App-v1.html" class="btn-ghost" style="display:block;text-align:center;text-decoration:none;">Retour à l'accueil</a>
        </div>`;
      document.getElementById('fdjRetryManager')?.addEventListener('click', () => {
        const url = new URL(location.href);
        url.searchParams.set('_reload', Date.now().toString());
        location.replace(url.toString());
      });
    }, 8000);
  }

  // Après l'écran « Quart enregistré », forcer un vrai rechargement de la
  // page manager au lieu de relancer renderAccueil() dans le même état JS.
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#btnApresAccueil');
    if (!btn) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    location.href = 'NEXUS-FDJ-Manager-v1.html';
  }, true);

  const observer = new MutationObserver(armerWatchdog);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  window.addEventListener('unhandledrejection', (e) => {
    console.error('FDJ Manager — promesse rejetée:', e.reason);
    if (!estChargement()) return;
    const content = document.getElementById('content');
    if (!content) return;
    const msg = e.reason && e.reason.message ? e.reason.message : String(e.reason || 'Erreur inconnue');
    content.innerHTML = `<div class="card" style="padding:16px;"><div style="font-weight:700;margin-bottom:8px;">Erreur pendant le chargement</div><div style="font:12px monospace;color:var(--text-mid);word-break:break-word;margin-bottom:14px;">${msg.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</div><button class="btn-primary" onclick="location.reload()">Réessayer</button></div>`;
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', armerWatchdog, { once: true });
  else armerWatchdog();
})();
