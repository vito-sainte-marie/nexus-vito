// ------------------------------------------------------------
// NEXUS — registre unique des icônes de modules v2 (07/11/2026, kit « nexus-icones-modules-v1.1 »)
// ------------------------------------------------------------
// Source de vérité des 42 icônes de modules (lot 1 : Verify, Inventaire, Contrôle inventaire, FDJ, Missions,
// Planning, Paye, Carburants ; lot 2, kit « nexus-icones-modules-lot2-v1.1 » : Carburants Performance, Capital,
// Brief, Réception carburant, Assignations, FDJ Performance, Comptes Clients, Résultats, Journal, Progression,
// Paramètres, Produits ; lot 3, kit « nexus-icones-modules-lot3-v1.1 » : Accueil, Cockpit, Rapport, Scanner,
// Radar, Tempo, Campagnes, Scanner stock, Évaluations, Boîte de réception, Imports, Rappels ; lot 4, kit « nexus-icones-modules-lot4-v1.1 » : Administration, Aide, Apprentissage,
// Centre d'intelligence, Coach FDJ, Évolution, Pointage, Prise de poste, Rayon, Traçabilité). Chaque surface (barre d'accueil, menu bureau, raccourcis, Documentation,
// tuiles employé) passe par ici ; aucune ne connaît les chemins du kit.
//
// Pour chaque identifiant : version détaillée (WebP @1x/@2x/@3x, via srcset), version simplifiée
// (SVG « -24 », jusqu'à 24 px) et libellé accessible.
//
// RETOUR ARRIÈRE SANS REVERT : ICONES_V2 = false. Chaque surface garde alors exactement son icône
// actuelle (png, emoji, filtre) : img() rend l'ancien balisage fourni par la surface, et appliquer()
// ne touche à rien. Ce fichier ne fait aucun calcul, aucun accès Supabase.
//
// Inclure dans une page : <script src="nexus-icones.js?v=20260904-0104"></script> (avant nexus-desktop.js).
// ------------------------------------------------------------

(function (global) {
  const ICONES_V2 = true;
  const BASE = 'assets/icones/v2/';
  const SEUIL_SIMPLIFIE = 24; // px : jusqu'à cette taille, version simplifiée

  const MODULES = {
    'mod-verify':              { libelle: 'Verify' },
    'mod-inventaire':          { libelle: 'Inventaire' },
    'mod-controle-inventaire': { libelle: 'Contrôle inventaire' },
    'mod-fdj':                 { libelle: 'FDJ' },
    'mod-missions':            { libelle: 'Missions' },
    'mod-planning':            { libelle: 'Planning' },
    'mod-paye':                { libelle: 'Paye' },
    'mod-carburants':          { libelle: 'Carburants' },
    'mod-carburants-performance': { libelle: 'Carburants Performance' },
    'mod-capital':             { libelle: 'Capital NEXUS' },
    'mod-brief':               { libelle: 'Brief NEXUS' },
    'mod-reception-carburant': { libelle: 'Réception carburant' },
    'mod-assignations':        { libelle: 'Assignations' },
    'mod-fdj-performance':     { libelle: 'FDJ Performance' },
    'mod-comptes-clients':     { libelle: 'Comptes Clients' },
    'mod-resultats':           { libelle: 'Résultats' },
    'mod-journal':             { libelle: 'Journal' },
    'mod-progression':         { libelle: 'Progression' },
    'mod-parametres':          { libelle: 'Paramètres' },
    'mod-produits':            { libelle: 'Produits' },
    'mod-accueil':             { libelle: 'Accueil' },
    'mod-cockpit':             { libelle: 'Cockpit' },
    'mod-rapport':             { libelle: 'Rapport NEXUS' },
    'mod-scanner':             { libelle: 'Scanner NEXUS' },
    'mod-radar':               { libelle: 'Radar du Manager' },
    'mod-tempo':               { libelle: 'Tempo' },
    'mod-campagnes':           { libelle: 'Campagnes' },
    'mod-scanner-stock':       { libelle: 'Scanner Stock' },
    'mod-evaluations':         { libelle: 'Évaluations' },
    'mod-boite-reception':     { libelle: 'Boîte de réception' },
    'mod-imports':             { libelle: 'Imports' },
    'mod-rappels':             { libelle: 'Rappels' },
    'mod-admin':               { libelle: 'Administration' },
    'mod-aide':                { libelle: 'Aide' },
    'mod-apprentissage':       { libelle: 'Apprentissage' },
    'mod-centre-intelligence': { libelle: "Centre d'intelligence" },
    'mod-coach-fdj':           { libelle: 'Coach FDJ' },
    'mod-evolution':           { libelle: 'Évolution' },
    'mod-pointage':            { libelle: 'Pointage' },
    'mod-prise-de-poste':      { libelle: 'Prise de poste' },
    'mod-rayon':               { libelle: 'Rayon' },
    'mod-tracabilite':         { libelle: 'Traçabilité' },
  };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function chemins(id) {
    if (!MODULES[id]) return null;
    const d = BASE + id + '/' + id;
    return {
      detail1x: d + '@1x.webp',
      detail2x: d + '@2x.webp',
      detail3x: d + '@3x.webp',
      simplifie: d + '-24.svg',
      srcset: d + '@1x.webp 1x, ' + d + '@2x.webp 2x, ' + d + '@3x.webp 3x',
    };
  }

  // Attributs <img> d'un module pour une taille d'affichage (px). decoratif : un libellé visible suit
  // l'icône → alt="" et aria-hidden="true". Sinon alt = libellé accessible.
  function attributs(id, taille, opts) {
    const c = chemins(id);
    if (!c) return null;
    const o = opts || {};
    const t = Number(taille) > 0 ? Number(taille) : SEUIL_SIMPLIFIE;
    const a = t <= SEUIL_SIMPLIFIE
      ? { src: c.simplifie }
      : { src: c.detail1x, srcset: c.srcset };
    a.width = t; a.height = t;
    a.alt = o.decoratif ? '' : MODULES[id].libelle;
    if (o.decoratif) a['aria-hidden'] = 'true';
    return a;
  }

  // Balisage <img>. ICONES_V2 = false (ou id inconnu) : l'ancien balisage fourni par la surface, tel quel.
  function img(id, taille, opts) {
    const o = opts || {};
    const a = ICONES_V2 ? attributs(id, taille, o) : null;
    if (!a) return o.ancien || '';
    return '<img ' + Object.keys(a).map(k => k + '="' + esc(a[k]) + '"').join(' ') + '>';
  }

  // Pour le balisage statique : <img data-nexus-icone="mod-x" data-nexus-taille="24" …ancien src…> ou
  // n'importe quel conteneur. Le HTML statique porte déjà le NOUVEAU fichier (aucun ancien PNG n'est téléchargé) ;
  // l'ancien rendu est gardé en data-nexus-ancien-src / -alt / -style / -emoji. ICONES_V2 = false : appliquer() restaure l'ancien.
  function appliquer(racine) {
    const doc = racine || (typeof document !== 'undefined' ? document : null);
    if (!doc || !doc.querySelectorAll) return 0;
    let n = 0;
    doc.querySelectorAll('[data-nexus-icone]').forEach(el => {
      const id = el.getAttribute('data-nexus-icone');
      const estImg = String(el.tagName).toUpperCase() === 'IMG';
      if (!ICONES_V2) { // retour arrière : on restaure l'ancien rendu gardé dans data-nexus-ancien-*
        if (estImg) {
          if (el.hasAttribute('data-nexus-ancien-src')) el.setAttribute('src', el.getAttribute('data-nexus-ancien-src'));
          ['srcset', 'width', 'height', 'aria-hidden'].forEach(k => el.removeAttribute(k));
          if (el.hasAttribute('data-nexus-ancien-alt')) el.setAttribute('alt', el.getAttribute('data-nexus-ancien-alt'));
          if (el.hasAttribute('data-nexus-ancien-style')) el.setAttribute('style', el.getAttribute('data-nexus-ancien-style'));
        } else if (el.hasAttribute('data-nexus-ancien-emoji')) {
          el.textContent = el.getAttribute('data-nexus-ancien-emoji');
        } else return;
        n++; return;
      }
      const taille = el.getAttribute('data-nexus-taille');
      const deco = el.getAttribute('data-nexus-decoratif') === '1';
      const a = attributs(id, taille, { decoratif: deco });
      if (!a) return;
      if (estImg) { Object.keys(a).forEach(k => el.setAttribute(k, a[k])); }
      else { el.innerHTML = img(id, taille, { decoratif: deco }); }
      el.removeAttribute('style'); n++;
    });
    return n;
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => appliquer());
    else appliquer();
  }

  global.NexusIcones = { ICONES_V2, MODULES, SEUIL_SIMPLIFIE, chemins, attributs, img, appliquer };
})(typeof window !== 'undefined' ? window : globalThis);
