// Photo de la station (bannière), partagée par l'Accueil et la page Paye (05/11/2026).
// Une seule règle pour les deux pages : mêmes sites, même aperçu sur Test, même photo selon le
// thème (Jour = photo de jour, Sombre = photo de nuit), même fondu enchaîné. Présentation seulement.
const NexusBanniereStation = (function () {
  // Seul point à étendre pour la bannière : la liste des sites qui l'affichent.
  // Lot futur (note du Guardian, #160) : bannière pour toutes les stations ViTO,
  // une photo par enseigne (Total, Sol…) choisie dans les Réglages de la station.
  // Cela demande une donnée par site ou enseigne, un écran de Réglages et une
  // migration : décisions de Frédéric. Ne pas l'implémenter ici.
  const SITES_BANNIERE_VITO = ['vito-sainte-marie'];
  const SITE_APERCU_BANNIERE = 'nexus-station-test';
  const FONDU_MS = 800;
  // La photo suit le thème actif : Jour = photo de jour, Sombre = photo de nuit. Une seule
  // image est présente à la fois ; elle est remplacée quand nexus-theme.js change data-theme.
  function photoNuit() {
    try { return document.documentElement.getAttribute('data-theme') !== 'jour'; } catch (e) { return true; }
  }
  function base(nuit) {
    return 'assets/accueil/accueil-station-vito' + (nuit ? '-nuit' : '');
  }
  function srcsetDe(b) {
    return b + '-800.webp 800w, ' + b + '-1200.webp 1200w, ' + b + '-1600.webp 1600w';
  }
  // Paramètre d'aperçu lu une fois : ?apercu_banniere=1 montre le bandeau sur Test ;
  // il n'a d'effet pour AUCUN autre site (Production inclus).
  function apercuDemande() {
    try { return new URLSearchParams(window.location.search).get('apercu_banniere') === '1'; } catch (e) { return false; }
  }
  function siteAvecBanniere(siteId, apercu) {
    return SITES_BANNIERE_VITO.indexOf(siteId) !== -1 || (siteId === SITE_APERCU_BANNIERE && apercu === true);
  }
  // Changement de thème : la nouvelle photo est préchargée, puis posée AU-DESSUS de l'ancienne
  // (opacité 0 -> 1, ~800 ms) ; l'ancienne n'est retirée qu'à la fin. La bannière garde sa hauteur
  // fixe : aucun saut. Mouvement réduit : la transition CSS est nulle, le remplacement est immédiat. Préchargement en échec : l'ancienne reste.
  function changerPhoto(nuit) {
    document.querySelectorAll('.am-banniere').forEach(function (ban) {
      const actuelle = ban.querySelector('img:not(.am-fondu)');
      if (!actuelle) return;
      ban.querySelectorAll('img.am-fondu').forEach(function (x) { x.remove(); });
      const propre = ban.getAttribute(nuit ? 'data-photo-nuit' : 'data-photo-jour');
      const b = base(nuit);
      const src = propre || (b + '-800.webp');
      const srcset = propre ? '' : srcsetDe(b);
      ban._jeton = (ban._jeton || 0) + 1;
      const jeton = ban._jeton;
      const pre = new Image();
      pre.sizes = actuelle.getAttribute('sizes') || '';
      if (srcset) pre.srcset = srcset;
      pre.onload = function () {
        if (ban._jeton !== jeton || !ban.contains(actuelle)) return;
        const n = document.createElement('img');
        n.className = 'am-fondu';
        n.setAttribute('sizes', actuelle.getAttribute('sizes') || '');
        if (srcset) n.setAttribute('srcset', srcset);
        n.setAttribute('src', src);
        n.setAttribute('width', actuelle.getAttribute('width') || '1600');
        n.setAttribute('height', actuelle.getAttribute('height') || '800');
        n.setAttribute('decoding', 'async');
        n.setAttribute('alt', actuelle.getAttribute('alt') || '');
        actuelle.insertAdjacentElement('afterend', n);
        void n.offsetWidth;
        n.classList.add('am-fondu-visible');
        setTimeout(function () {
          if (ban._jeton !== jeton) return;
          n.classList.remove('am-fondu', 'am-fondu-visible');
          actuelle.remove();
        }, FONDU_MS + 50);
      };
      pre.src = src;
    });
  }
  // Le HTML de la bannière : vide hors des sites de la liste (et hors aperçu Test).
  function html(siteId, o) {
    o = o || {};
    if (!siteAvecBanniere(siteId, o.apercu === true)) return '';
    if (o.photos && o.photos.jour && o.photos.nuit) {
      // Illustration propre à une page (ex. Contrôle inventaire) : une seule image par thème.
      return '<div class="am-banniere" data-photo-jour="' + o.photos.jour + '" data-photo-nuit="' + o.photos.nuit + '">'
        + '<img src="' + (photoNuit() ? o.photos.nuit : o.photos.jour) + '" width="1600" height="533" decoding="async"'
        + ' alt="' + (o.alt || '') + '" onerror="' + (o.surErreur || '') + 'this.parentNode.remove()"></div>';
    }
    const b = base(photoNuit());
    return '<div class="am-banniere"><img src="' + b + '-800.webp"'
      + ' srcset="' + srcsetDe(b) + '"'
      + ' sizes="' + o.sizes + '" width="1600" height="800" loading="lazy" decoding="async"'
      + ' alt="La station ViTO de Sainte-Marie : auvent, totem et végétation tropicale"'
      + ' onerror="' + (o.surErreur || '') + 'this.parentNode.remove()"></div>';
  }
  // En-tête commun aux cinq pages Manager (Guardian 6739596255, 09/11/2026) : modèle de Contrôle
  // inventaire, posé UNE fois ici. Photo centrée derrière le texte, dégradé qui laisse lire le titre,
  // pastille Menu opaque. Chaque page ne règle que son cadrage : .header{--banniere-cadrage:X% Y%}.
  const CSS_ENTETE = [
    '.header{padding:18px 20px 14px;position:relative;min-height:150px;overflow:hidden}',
    '.header>.am-banniere{position:absolute;inset:0;z-index:0;overflow:hidden;-webkit-mask-image:linear-gradient(to bottom,black 70%,transparent 100%);mask-image:linear-gradient(to bottom,black 70%,transparent 100%)}',
    '.header>.am-banniere img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:var(--banniere-cadrage,85% 58%)}',
    '.header>.am-banniere::after{content:"";position:absolute;inset:0;background:linear-gradient(to right,var(--bg) 0%,var(--bg) 18%,transparent 75%);opacity:.92;pointer-events:none}',
    '.header>.am-banniere img.am-fondu{opacity:0;transition:opacity 800ms ease}',
    '.header>.am-banniere img.am-fondu-visible{opacity:1}',
    '@media (prefers-reduced-motion:reduce){.header>.am-banniere img.am-fondu{transition:none}}',
    '.header>.entete-texte{position:relative;z-index:1;max-width:600px}',
    '.header>.menu-btn{position:absolute;top:18px;right:18px;z-index:5;display:flex;align-items:center;gap:6px;font-family:var(--mono);font-size:10.5px;font-weight:600;letter-spacing:.03em;text-transform:uppercase;color:var(--cyan);background:var(--panel);border:1px solid rgba(var(--cyan-rgb,34,211,238),.3);border-radius:20px;padding:7px 12px;text-decoration:none;white-space:nowrap}',
    'body:not(.nexus-desktop) .header>.am-banniere{inset:0 0 auto 0;height:170px}',
    'body:not(.nexus-desktop) .header>.am-banniere::after{background:linear-gradient(to right,var(--bg) 0%,var(--bg) 55%,transparent 100%),linear-gradient(to bottom,transparent 45%,var(--bg) 100%);opacity:.95}',
    'body:not(.nexus-desktop) .header>.entete-texte{max-width:none}',
    'body:not(.nexus-desktop) .header>.entete-texte .eyebrow{padding-right:96px}',
    ':root[data-theme="jour"] .header>.am-banniere::after{background:linear-gradient(to right,var(--panel) 0%,var(--panel) 50%,transparent 100%),linear-gradient(to bottom,transparent 45%,var(--panel) 100%);opacity:.96}',
    ':root[data-theme="jour"] body:not(.nexus-desktop) .header>.am-banniere::after{background:linear-gradient(to right,var(--panel) 0%,var(--panel) 62%,transparent 100%),linear-gradient(to bottom,transparent 45%,var(--panel) 100%);opacity:.96}',
    ':root[data-theme="jour"] .header>.menu-btn{background:var(--panel);border:1px solid var(--line);color:var(--text)}'
  ].join('\n');
  try {
    if (typeof document !== 'undefined' && document.head && !document.getElementById('nexus-entete-banniere')) {
      const st = document.createElement('style');
      st.id = 'nexus-entete-banniere';
      st.textContent = CSS_ENTETE;
      document.head.insertBefore(st, document.head.firstChild);
    }
  } catch (e) {}
  // Observe data-theme : à chaque changement, la photo suit le thème.
  let observe = false;
  function suivreTheme() {
    if (observe) return;
    try {
      observe = true;
      new MutationObserver(function () { changerPhoto(photoNuit()); })
        .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    } catch (e) {}
  }
  return { SITES_BANNIERE_VITO, SITE_APERCU_BANNIERE, FONDU_MS, photoNuit, base, apercuDemande, siteAvecBanniere, changerPhoto, html, suivreTheme, CSS_ENTETE };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NexusBanniereStation;
