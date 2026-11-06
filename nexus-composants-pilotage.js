// Composants de pilotage partagés (Contrôle inventaire, lot 1 — 06/11/2026) : anneau d'indicateur,
// pastilles d'état, bouton « i » et sa fenêtre d'explication, tuile d'indicateur.
// Le code de `ECHAPPE`, `infoBtn` et `anneau` est la copie exacte de celui de NEXUS-Paye-v1.html
// (test_inventaire_lot1_socle_20261106.js compare les deux). Paye n'est pas rebranchée sur ce
// module dans ce lot : ses tests exécutent son script en ligne dans un contexte isolé.
// Présentation seulement : aucun calcul, aucune donnée.
const NexusComposantsPilotage = (function () {
  const ECHAPPE=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const infoBtn=(cle,label)=>`<button type="button" class="info-btn" data-info="${cle}" aria-label="Information${label?` : ${ECHAPPE(label)}`:''}">i</button>`;
  function anneau(pct,couleur){
   const c=157.1, d=Math.max(0,Math.min(100,pct))/100*c;
   return `<svg class="anneau" viewBox="0 0 60 60" aria-hidden="true"><circle class="fond" cx="30" cy="30" r="25"/><circle cx="30" cy="30" r="25" style="stroke:${couleur}" stroke-linecap="round" stroke-dasharray="${d.toFixed(1)} ${c}" transform="rotate(-90 30 30)"/></svg>`;
  }
  // Pastille d'état : ton = ok (validé), todo (en attente), bad (critique), hp (neutre).
  const TONS = ['ok', 'todo', 'bad', 'hp'];
  function pill(texte, ton) {
    return '<span class="st ' + (TONS.indexOf(ton) !== -1 ? ton : 'hp') + '">' + ECHAPPE(texte) + '</span>';
  }
  // Tuile cliquable : anneau (facultatif), valeur, libellé, pastille facultative, bouton « i » facultatif.
  // `cible` est lu par le gestionnaire de la page (data-cible) ; la tuile ne décide de rien.
  function tuile(o) {
    o = o || {};
    const ring = o.pct == null ? '' : anneau(o.pct, o.couleur || 'var(--cyan)');
    const info = o.info ? infoBtn(o.info, o.libelle) : '';
    return '<div class="np-tuile"><button type="button" class="np-tuile-corps" data-cible="' + ECHAPPE(o.cible || '') + '">'
      + ring + '<span class="np-tuile-texte"><span class="np-tuile-valeur">' + ECHAPPE(o.valeur) + '</span>'
      + '<span class="np-tuile-libelle">' + ECHAPPE(o.libelle) + '</span>'
      + (o.pastille ? o.pastille : '') + '</span></button>' + info + '</div>';
  }
  const CSS = [
    '.anneau{width:56px;height:56px;flex:none}',
    '.anneau circle{fill:none;stroke-width:6}',
    '.anneau .fond{stroke:var(--trace)}',
    '.st{display:inline-flex;align-items:center;height:30px;padding:0 14px;border-radius:15px;font-size:13px;border:1px solid}',
    '.st.ok{background:rgba(var(--green-rgb,41,201,138),.14);color:var(--green);border-color:rgba(var(--green-rgb,41,201,138),.35)}',
    '.st.todo{background:rgba(var(--amber-rgb,245,161,42),.14);color:var(--amber);border-color:rgba(var(--amber-rgb,245,161,42),.45)}',
    '.st.bad{background:rgba(var(--red-rgb,255,138,138),.14);color:var(--red);border-color:rgba(var(--red-rgb,255,138,138),.45)}',
    '.st.hp{background:var(--caps);color:var(--mid);border-color:var(--line)}',
    '.info-btn{width:44px;height:44px;border:0;background:none;position:relative;font-size:0;cursor:pointer;flex:none}',
    '.info-btn::before{content:"i";position:absolute;inset:11px;border:1px solid rgba(var(--cyan-rgb,36,216,227),.35);border-radius:50%;background:rgba(var(--cyan-rgb,36,216,227),.09);color:var(--cyan);font:700 10px var(--mono);display:flex;align-items:center;justify-content:center}',
    '.np-tuile{display:flex;align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:14px;min-height:72px}',
    '.np-tuile-corps{flex:1;display:flex;align-items:center;gap:12px;padding:8px 4px 8px 12px;background:none;border:0;color:var(--text);font-family:var(--sans);text-align:left;cursor:pointer;min-height:44px}',
    '.np-tuile-texte{display:flex;flex-direction:column;gap:2px;min-width:0}',
    '.np-tuile-valeur{font:700 20px var(--mono)}',
    '.np-tuile-libelle{font-size:13px;color:var(--mid)}',
    '.np-info{position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px;background:var(--veil,rgba(0,0,0,.6))}',
    '.np-info[hidden]{display:none}',
    '.np-info-carte{max-width:420px;width:100%;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:20px;color:var(--text);font-family:var(--sans)}',
    '.np-info-carte h3{font-size:16px;margin-bottom:8px}',
    '.np-info-carte p{font-size:14px;line-height:1.5;color:var(--mid);margin-bottom:16px}',
    '.np-info-carte button{min-height:44px;padding:0 18px;border:0;border-radius:10px;background:var(--cyan);color:var(--on-cyan,#04222A);font:600 14px var(--sans);cursor:pointer}',
  ].join('\n');
  function injecterStyle() {
    if (typeof document === 'undefined' || document.getElementById('nexus-composants-pilotage')) return;
    const s = document.createElement('style');
    s.id = 'nexus-composants-pilotage';
    s.textContent = CSS;
    document.head.insertBefore(s, document.head.firstChild);
  }
  // Fenêtre d'explication : un seul gestionnaire délégué, texte pris dans le dictionnaire fourni par la page.
  function brancherInfos(infos) {
    if (typeof document === 'undefined') return;
    let fen = document.getElementById('npInfo');
    if (!fen) {
      fen = document.createElement('div');
      fen.className = 'np-info'; fen.id = 'npInfo'; fen.hidden = true;
      fen.innerHTML = '<div class="np-info-carte" role="dialog" aria-modal="true" aria-labelledby="npInfoTitre"><h3 id="npInfoTitre"></h3><p id="npInfoTexte"></p><button type="button" id="npInfoFermer">J’ai compris</button></div>';
      document.body.appendChild(fen);
      fen.addEventListener('click', e => { if (e.target === fen || e.target.id === 'npInfoFermer') fen.hidden = true; });
      document.addEventListener('keydown', e => { if (e.key === 'Escape') fen.hidden = true; });
    }
    if (document._npInfosBranche) { document._npInfos = infos || {}; return; }
    document._npInfosBranche = true; document._npInfos = infos || {};
    document.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('.info-btn');
      if (!b) return;
      e.stopPropagation();
      const info = document._npInfos[b.dataset.info];
      if (!info) return;
      document.getElementById('npInfoTitre').textContent = info[0];
      document.getElementById('npInfoTexte').textContent = info[1];
      fen.hidden = false;
    });
  }
  injecterStyle();
  return { ECHAPPE, infoBtn, anneau, pill, tuile, brancherInfos, CSS };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NexusComposantsPilotage;
