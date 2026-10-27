// MESURE-TEMPORAIRE (lot INVENTAIRE-CHAINE-INITIALISATION-20261027) : branche du lot uniquement, a retirer avant la PR.
window.__nxMesure = { longtasks: [], titre: [], loading: [] };
try { new PerformanceObserver(function (l) { l.getEntries().forEach(function (e) { window.__nxMesure.longtasks.push({ debut: Math.round(e.startTime), duree: Math.round(e.duration) }); }); }).observe({ type: 'longtask', buffered: true }); } catch (e) { window.__nxMesure.longtaskErreur = String(e); }
performance.mark('nx:debut-script');
document.addEventListener('DOMContentLoaded', function () {
  var t = document.getElementById('titre'), c = document.getElementById('content');
  function noter(tab, v) { tab.push({ t: Math.round(performance.now()), v: v }); }
  if (t) { noter(window.__nxMesure.titre, t.textContent.trim().slice(0, 40)); new MutationObserver(function () { noter(window.__nxMesure.titre, t.textContent.trim().slice(0, 40)); }).observe(t, { childList: true, characterData: true, subtree: true }); }
  if (c) { var f = function () { noter(window.__nxMesure.loading, !!c.querySelector('.loading')); }; f(); new MutationObserver(f).observe(c, { childList: true, subtree: true }); }
});
