/* Thème Sombre / Jour / Auto du parcours pompiste (lot MODE-JOUR-POMPISTE-20261102).
 *
 * Chargé en SYNCHRONE dans le <head> de chaque page du parcours : le thème est posé
 * sur <html> avant le premier rendu, donc sans flash. Les pages gardent leurs valeurs
 * Sombre dans `:root` (rien ne change en Sombre) ; ce module n'ajoute que le bloc
 * `:root[data-theme="jour"]`, plus spécifique, qui ne redéfinit que des jetons.
 *
 * Auto : Jour de 6 h 00 (inclus) à 18 h 00 (exclu), heure de la STATION, Sombre sinon.
 * Le fuseau vient de `sites.timezone` : la page qui le connaît le donne à
 * `definirFuseau`, qui le garde sur l'appareil pour le premier rendu suivant. Tant
 * qu'il est inconnu, l'heure de l'appareil ne sert qu'à choisir une teinte d'affichage
 * (jamais un quart ni un jour métier) ; elle est corrigée dès que le fuseau arrive.
 *
 * Aucun accès Supabase, aucune logique métier : un réglage d'affichage.
 */
(function (root) {
  'use strict';

  const CLE_REGLAGE = 'nexus_theme';
  const CLE_FUSEAU = 'nexus_theme_fuseau';
  const REGLAGES = ['sombre', 'jour', 'auto'];
  const DEBUT_JOUR = 6;   // inclus
  const FIN_JOUR = 18;    // exclu

  // Valeurs Sombre = celles des :root des pages (l'épreuve le vérifie page par page).
  // Elles ne servent qu'à l'épreuve de contraste et au meta theme-color.
  const SOMBRE = {
    '--bg': '#0B0F14', '--panel': '#141B22', '--panel-raised': '#1A222C', '--hairline': '#242E38',
    '--text': '#EDF1F5', '--text-mid': '#8A96A5', '--text-dim': '#57626F',
    '--cyan': '#4FC3D9', '--green': '#34D399', '--green-dim': '#153629',
    '--amber': '#F5A623', '--amber-dim': '#3A2E14', '--red': '#F0575A', '--red-dim': '#3A1D1F',
    '--gold': '#D4AF37', '--gold-dim': '#332B12', '--on-cyan': '#04141A',
  };

  // Palette Jour : décision de Frédéric (Guardian #160, 6577633047) pour la base ; les
  // rouges, l'ambre pâle et l'or sont proposés ici, leurs contrastes sont mesurés par
  // test_theme_jour_contrastes_20261102.js (texte ≥ 4,5:1 sur chaque fond d'usage).
  const JOUR = {
    '--bg': '#F4F6F8', '--panel': '#FFFFFF', '--panel-raised': '#EEF2F5', '--hairline': '#D5DCE3',
    '--text': '#0F172A', '--text-mid': '#475569', '--text-dim': '#56657A',
    '--cyan': '#0B7285', '--green': '#047857', '--green-dim': '#D1FAE5',
    '--amber': '#B45309', '--amber-dim': '#FEF3C7', '--red': '#B91C1C', '--red-dim': '#FEE2E2',
    '--gold': '#8A6A00', '--gold-dim': '#FEF3C7', '--on-cyan': '#FFFFFF',
  };

  // Jetons ajoutés aux pages pour sortir les couleurs en dur (valeur Sombre = l'ancien
  // littéral, déclarée dans le :root de chaque page). Ici : leurs valeurs Jour.
  const JOUR_COMPLEMENT = {
    '--cyan-rgb': '11,114,133', '--red-rgb': '185,28,28', '--green-rgb': '4,120,87',
    '--amber-rgb': '180,83,9', '--gold-rgb': '138,106,0',
    '--on-cyan-alt': '#FFFFFF', '--on-green': '#FFFFFF', '--on-red': '#FFFFFF', '--on-amber': '#FFFFFF',
    '--red-text': '#7F1D1D', '--amber-text': '#78350F', '--green-text': '#064E3B',
    '--panel-hover': 'rgba(15,23,42,0.05)', '--ghost': 'rgba(15,23,42,0.035)',
    '--ghost-line': 'rgba(15,23,42,0.10)', '--ghost-faint': 'rgba(15,23,42,0.02)', '--veil': 'rgba(15,23,42,0.45)',
    '--shadow-rgb': '15,23,42', '--panel-rgb': '255,255,255',
    '--sheet-end': 'rgba(255,255,255,0.98)', '--cyan-hover': '#095C6C',
    '--text-soft': '#334155', '--text-faint': '#64748B', '--text-link': '#475569',
    '--chip-vert': '#047857', '--sp95': '#047857', '--go': '#B45309', '--gnr': '#B91C1C', '--muted-ecran': '#64748B',
    '--muted': '#64748B', '--cyan-fonce': '#CFE8EE', '--cyan-tint': '#EAF4F6', '--retour-fg': '#475569', '--retour-rgb': '71,85,105', '--surface-vert': '#D1FAE5', '--surface-ambre': '#FEF3C7',
    '--mm-hover': '#EEF2F5', '--mm-titre': '#64748B', '--seg-vide': '#D5DCE3', '--seg-plein': '#047857',
    '--rec-bord': '#E5C07A', '--rec-fond': '#FFF7E6', '--rec-attendue': '#FFEFC7', '--rec-texte': '#92400E', '--rec-sous': '#92400E',
    '--poste-fondu': '255,255,255',
    '--ap-text': '#0F172A', '--ap-mid': '#475569', '--ap-dim': '#475569', '--cyan-hi': '#2AA3BB', '--rec-bord-fort': '#92400E',
    // Alias de NEXUS-Releves-Piste-v1.html (noms courts).
    '--raised': '#EEF2F5', '--hair': '#D5DCE3', '--mid': '#475569', '--dim': '#56657A',
  };

  // ── Calcul pur ──────────────────────────────────────────────────────
  function reglageValide(r) { return REGLAGES.indexOf(r) !== -1 ? r : 'auto'; }

  // heure : nombre d'heures décimal dans [0, 24) (ex. 5.99, 6, 17.99, 18) ; non fini → null.
  function themeAuto(heure) {
    if (typeof heure !== 'number' || !isFinite(heure)) return null;
    return heure >= DEBUT_JOUR && heure < FIN_JOUR ? 'jour' : 'sombre';
  }

  // Rend 'jour' ou 'sombre'. Réglage absent ou inconnu = auto ; auto sans heure exploitable = sombre.
  function calculerTheme(reglage, heure) {
    const r = reglageValide(reglage);
    if (r === 'jour') return 'jour';
    if (r === 'sombre') return 'sombre';
    return themeAuto(heure) || 'sombre';
  }

  // Heure décimale dans le fuseau donné ; null si le fuseau est absent ou illisible.
  function heureDansFuseau(fuseau, instant) {
    if (typeof fuseau !== 'string' || !fuseau.trim()) return null;
    try {
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone: fuseau, hour: '2-digit', minute: '2-digit', hour12: false })
        .formatToParts(instant || new Date());
      const h = Number(parts.find((p) => p.type === 'hour').value) % 24;
      const m = Number(parts.find((p) => p.type === 'minute').value);
      return h + m / 60;
    } catch (e) { return null; }
  }

  // Stockage : jamais d'exception ; un stockage inaccessible équivaut à « rien de mémorisé ».
  function lire(stockage, cle) {
    try { return stockage ? stockage.getItem(cle) : null; } catch (e) { return null; }
  }
  function ecrire(stockage, cle, valeur) {
    try { if (stockage) { stockage.setItem(cle, valeur); return true; } } catch (e) { /* appareil sans stockage */ }
    return false;
  }
  function lireReglage(stockage) { return reglageValide(lire(stockage, CLE_REGLAGE)); }

  // ── Application sur le document ─────────────────────────────────────
  function cssJour() {
    const decl = (o) => Object.keys(o).map((k) => k + ':' + o[k]).join(';');
    return ':root[data-theme="jour"]{color-scheme:light;' + decl(JOUR) + ';' + decl(JOUR_COMPLEMENT) + '}'
      + ':root[data-theme="sombre"]{color-scheme:dark}';
  }

  const etat = { fuseau: null, reglage: 'auto', theme: null, doc: null, stockage: null, minuteur: null };

  function stockageAppareil() {
    try { return root && root.localStorage ? root.localStorage : null; } catch (e) { return null; }
  }

  function evaluer() {
    const heure = heureDansFuseau(etat.fuseau, new Date());
    // Fuseau inconnu : heure de l'appareil, pour la seule teinte d'affichage.
    const h = heure !== null ? heure : (function () { const d = new Date(); return d.getHours() + d.getMinutes() / 60; })();
    return calculerTheme(etat.reglage, h);
  }

  function appliquer() {
    const theme = evaluer();
    if (theme === etat.theme || !etat.doc) return theme;
    etat.theme = theme;
    const html = etat.doc.documentElement;
    html.setAttribute('data-theme', theme);
    const meta = etat.doc.querySelector && etat.doc.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'jour' ? JOUR['--bg'] : SOMBRE['--bg']);
    return theme;
  }

  function definirReglage(reglage) {
    etat.reglage = reglageValide(reglage);
    ecrire(etat.stockage, CLE_REGLAGE, etat.reglage);
    return appliquer();
  }

  function definirFuseau(fuseau) {
    if (typeof fuseau !== 'string' || !fuseau.trim()) return appliquer();
    etat.fuseau = fuseau.trim();
    ecrire(etat.stockage, CLE_FUSEAU, etat.fuseau);
    return appliquer();
  }

  function init(doc, stockage) {
    etat.doc = doc;
    etat.stockage = stockage;
    etat.reglage = lireReglage(stockage);
    const f = lire(stockage, CLE_FUSEAU);
    etat.fuseau = f && f.trim() ? f.trim() : null;
    if (doc.head) {
      const style = doc.createElement('style');
      style.id = 'nexus-theme-jour';
      style.textContent = cssJour();
      doc.head.appendChild(style);
    }
    appliquer();
    // Réévalué sans recharger : toutes les 60 s et au retour de l'application au premier plan.
    if (root && root.setInterval) etat.minuteur = root.setInterval(appliquer, 60000);
    if (doc.addEventListener) doc.addEventListener('visibilitychange', appliquer);
  }

  // Bloc du menu ☰ (rendu côté page, aucune logique métier).
  function menuHtml() {
    const libelle = { sombre: 'Sombre', jour: 'Jour', auto: 'Auto' };
    return '<div class="mm-groupe" data-groupe="theme"><div class="mm-titre">Affichage</div>'
      + '<div class="mm-theme" role="group" aria-label="Thème">'
      + REGLAGES.map((r) => '<button type="button" class="mm-theme-btn' + (r === etat.reglage ? ' mm-theme-actif' : '')
        + '" data-theme-reglage="' + r + '" aria-pressed="' + (r === etat.reglage ? 'true' : 'false') + '">' + libelle[r] + '</button>').join('')
      + '</div></div>';
  }
  function brancherMenu(conteneur) {
    if (!conteneur || !conteneur.querySelectorAll) return;
    conteneur.querySelectorAll('[data-theme-reglage]').forEach((b) => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        definirReglage(b.getAttribute('data-theme-reglage'));
        conteneur.querySelectorAll('[data-theme-reglage]').forEach((x) => {
          const actif = x === b;
          x.classList.toggle('mm-theme-actif', actif);
          x.setAttribute('aria-pressed', actif ? 'true' : 'false');
        });
      });
    });
  }

  const api = {
    CLE_REGLAGE, CLE_FUSEAU, REGLAGES, DEBUT_JOUR, FIN_JOUR, SOMBRE, JOUR, JOUR_COMPLEMENT,
    reglageValide, themeAuto, calculerTheme, heureDansFuseau, lireReglage, cssJour,
    definirReglage, definirFuseau, reglageCourant: () => etat.reglage, menuHtml, brancherMenu,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.NexusTheme = api;
    if (root.document && root.document.documentElement) init(root.document, stockageAppareil());
  }
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : null));
