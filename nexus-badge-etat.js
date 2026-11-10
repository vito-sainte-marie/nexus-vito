// nexus-badge-etat.js — composant partagé des états NEXUS (lot 3 des emojis, vague 1, Guardian 6750743048).
// Référence : planche « Charte des états NEXUS ». Présentation seulement : aucun calcul, aucune écriture.
//
// Cinq axes, un rendu par axe :
//  - gravité      (critique, a-verifier, information, conforme) : badge cerclé, couleur + pictogramme ;
//  - traitement   (en-attente, exclu)                            : badge gris ;
//  - action       (agir, decider, verifier, surveiller)          : pastille pleine neutre, « Agir » en accent ;
//  - qualification (opportunite, recommandation)                 : étiquette grise cerclée, discrète ;
//  - priorité     (rang)                                         : rang en Plex Mono, jamais une couleur.
// Le sens est porté par le texte ; les pictogrammes SVG sont aria-hidden.
// Une action cliquable est un <button> (cible tactile ≥ 44 px sur téléphone) ; une action sans geste
// est une consigne écrite (« À faire : vérifier »), jamais une fausse pastille.
// Les clés viennent de NexusEtatsConseiller (lot 2) : retirer l'emoji d'un libellé ne touche pas ce module.
(function (global) {
  'use strict';

  var CSS = [
    ':root{--nbe-attente:#AAC3D7;--nbe-verifier:#FFC668;--nbe-conforme:#64DAB1;--nbe-critique:#FF8998;--nbe-info:#90E7EC;--nbe-accent:#90E7EC;--nbe-on-accent:#062A30;--nbe-raised:#1F2833;--nbe-line:#33414F;--nbe-secondary:#ACB8C6}',
    ':root[data-theme="jour"]{--nbe-attente:#52677B;--nbe-verifier:#865000;--nbe-conforme:#146445;--nbe-critique:#A82A3F;--nbe-info:#15596C;--nbe-accent:#15596C;--nbe-on-accent:#FFF;--nbe-raised:#E6EDF2;--nbe-line:#C7D5DF;--nbe-secondary:#425466}',
    '.nbe-badge{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 10px;border:1px solid currentColor;border-radius:8px;background:color-mix(in srgb,currentColor 10%,transparent);font:600 12px/1 var(--sans,"IBM Plex Sans",sans-serif);white-space:nowrap}',
    '.nbe-badge svg{width:16px;height:16px;flex:none}',
    '.nbe-gravite-critique{color:var(--nbe-critique)}',
    '.nbe-gravite-a-verifier{color:var(--nbe-verifier)}',
    '.nbe-gravite-information{color:var(--nbe-info)}',
    '.nbe-gravite-conforme{color:var(--nbe-conforme)}',
    '.nbe-traitement{color:var(--nbe-attente)}',
    '.nbe-action{display:inline-flex;align-items:center;justify-content:center;height:30px;padding:0 14px;border:1px solid var(--nbe-line);border-radius:999px;background:var(--nbe-raised);color:var(--nbe-secondary);font:600 12px/1 var(--sans,"IBM Plex Sans",sans-serif);white-space:nowrap}',
    '.nbe-action-agir{background:var(--nbe-accent);border-color:var(--nbe-accent);color:var(--nbe-on-accent)}',
    'button.nbe-action{cursor:pointer}',
    '@media (max-width:600px){button.nbe-action{min-height:44px;min-width:44px}}',
    '.nbe-consigne{font:500 12px/1.3 var(--sans,"IBM Plex Sans",sans-serif);color:var(--nbe-secondary)}',
    '.nbe-consigne-agir{color:var(--nbe-accent);font-weight:600}',
    '.nbe-qualif{display:inline-flex;align-items:center;height:22px;padding:0 8px;border:1px solid var(--nbe-line);border-radius:6px;color:var(--nbe-secondary);font:500 11px/1 var(--sans,"IBM Plex Sans",sans-serif);white-space:nowrap}',
    '.nbe-rang{font:700 11px/1 var(--mono,"IBM Plex Mono",monospace);letter-spacing:.04em;color:var(--nbe-secondary);white-space:nowrap}',
    '.nbe-carte-critique.nbe-carte-critique{border-left-color:var(--nbe-critique)}',
    '.nbe-carte-verifier.nbe-carte-verifier{border-left-color:var(--nbe-verifier)}',
    '.nbe-carte-agir.nbe-carte-agir{border-left-color:var(--nbe-accent)}',
    '.nbe-carte-neutre.nbe-carte-neutre{border-left-color:var(--nbe-line)}',
    '.nbe-compteur-agir{color:var(--nbe-accent)}',
    '.nbe-compteur-neutre{color:var(--nbe-secondary)}',
    '.nbe-groupe-titre{margin:14px 0 8px;font:600 11px/1.2 var(--mono,"IBM Plex Mono",monospace);letter-spacing:.06em;text-transform:uppercase;color:var(--nbe-secondary)}'
  ].join('\n');

  function injecterCss() {
    if (typeof document === 'undefined' || document.getElementById('nexus-badge-etat-css')) return;
    var s = document.createElement('style');
    s.id = 'nexus-badge-etat-css';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  var SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">';
  // Tracés du kit premium (NEXUS_Kit_Premium_v1/assets/etats, viewBox 24) : critique = octogone, à vérifier = triangle.
  var PICTO = {
    'critique': SVG + '<path d="M8.3 3h7.4L21 8.3v7.4L15.7 21H8.3L3 15.7V8.3zM12 7.5v5m0 3.5v.2"/></svg>',
    'a-verifier': SVG + '<path d="M12 3 2.8 20h18.4L12 3zM12 9v4m0 3.5v.2"/></svg>',
    'information': SVG + '<circle cx="12" cy="12" r="9"/><path d="M12 10.8v6"/><path d="M12 7.2h.01"/></svg>',
    'conforme': SVG + '<circle cx="12" cy="12" r="9"/><path d="m7.5 12 3 3 6-6"/></svg>',
    'en-attente': SVG + '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    'exclu': SVG + '<circle cx="12" cy="12" r="9"/><path d="m5.7 18.3 12.6-12.6"/></svg>'
  };
  var LIB_GRAVITE = { 'critique': 'Critique', 'a-verifier': 'À vérifier', 'information': 'Information', 'conforme': 'Conforme' };
  var LIB_TRAITEMENT = { 'en-attente': 'En attente', 'exclu': 'Exclu' };
  var LIB_ACTION = { agir: 'Agir', decider: 'Décider', verifier: 'Vérifier', surveiller: 'Surveiller' };
  var LIB_QUALIF = { opportunite: 'Opportunité', recommandation: 'Recommandation' };

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var has = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };

  // opts.libelle : texte d'origine à garder à la place du libellé de l'axe (style de la gravité, mot du métier).
  function gravite(niveau, opts) {
    if (!has(LIB_GRAVITE, niveau)) return neutre(niveau);
    var lib = opts && opts.libelle ? esc(opts.libelle) : LIB_GRAVITE[niveau];
    return '<span class="nbe-badge nbe-gravite-' + niveau + '" data-axe="gravite" data-etat="' + niveau + '">' + PICTO[niveau] + '<span>' + lib + '</span></span>';
  }

  function traitement(type, opts) {
    if (!has(LIB_TRAITEMENT, type)) return neutre(type);
    var lib = opts && opts.libelle ? esc(opts.libelle) : LIB_TRAITEMENT[type];
    return '<span class="nbe-badge nbe-traitement" data-axe="traitement" data-etat="' + type + '">' + PICTO[type] + '<span>' + lib + '</span></span>';
  }

  // opts.clicable : vrai seulement si la carte offre réellement le geste ; opts.attrs : attributs du <button>.
  function action(type, opts) {
    if (!has(LIB_ACTION, type)) return neutre(type);
    opts = opts || {};
    var lib = LIB_ACTION[type];
    if (opts.clicable) {
      return '<button type="button" class="nbe-action nbe-action-' + type + '" data-axe="action" data-etat="' + type + '"' + (opts.attrs ? ' ' + opts.attrs : '') + '>' + lib + '</button>';
    }
    return '<span class="nbe-consigne nbe-consigne-' + type + '" data-axe="action" data-etat="' + type + '">À faire : ' + lib.toLowerCase() + '</span>';
  }

  function qualification(type) {
    if (!has(LIB_QUALIF, type)) return neutre(type);
    return '<span class="nbe-qualif" data-axe="qualification" data-etat="' + type + '">' + LIB_QUALIF[type] + '</span>';
  }

  // Rendu neutre : toute valeur sans correspondance (TEMPO, SIGNAL, rappels, variantes stock, inconnues).
  function neutre(texte) {
    var t = String(texte == null ? '' : texte).replace(/^[^A-Za-zÀ-ÿ0-9]+/, '').trim();
    if (!t) return '';
    t = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
    return '<span class="nbe-qualif" data-axe="neutre">' + esc(t) + '</span>';
  }

  // Rang de priorité : « ① PRIORITÉ » pour le premier, « #n » ensuite (n = rang calculé + 1). Jamais une couleur.
  function priorite(index, estPriorite) {
    return '<span class="nbe-rang" data-axe="priorite">' + (estPriorite ? '① PRIORITÉ' : '#' + (index + 1)) + '</span>';
  }

  // Rendu d'une chaîne d'état produite (ex. '🔥 À AGIR') depuis la clé stable du lot 2.
  // opts.geste : { clicable, attrs } pour les états d'action ; opts.verifierOffert : la carte offre le geste « Vérifier ».
  function rendu(etat, opts) {
    var E = global.NexusEtatsConseiller;
    opts = opts || {};
    if (!E) return neutre(etat);
    var est = function (k) { return E.est(etat, k); };
    if (est('agir')) return action('agir', opts.geste);
    if (est('decider')) return action('decider', opts.geste);
    if (est('surveiller')) return action('surveiller', opts.geste);
    if (est('opportunite')) return qualification('opportunite');
    if (est('recommandation')) return qualification('recommandation');
    if (est('verifier')) return gravite('a-verifier');
    if (est('critique')) return gravite('critique') + (opts.verifierOffert ? ' ' + action('verifier', opts.geste) : '');
    if (est('exclu')) return traitement('exclu');
    return neutre(etat);
  }

  // Regroupe sans renuméroter : { gains, risques, autres }, chaque élément garde son index d'origine et l'ordre relatif.
  // Affichage seulement : gains = gain() vrai ; risques = critique, verifier, surveiller, decider, exclu ;
  // autres = tempo, signal, rappels, compter, variantes stock, inconnus. Les TOTAUX du Brief restent calculés
  // par gain() seul (tout ce qui n'est pas un gain, « autres » compris, compte dans le risque).
  function grouper(decisions) {
    var E = global.NexusEtatsConseiller, g = [], r = [], a = [];
    (decisions || []).forEach(function (p, i) {
      var x = { p: p, i: i };
      if (E && E.gain(p.etat)) g.push(x);
      else if (E && ['critique', 'verifier', 'surveiller', 'decider', 'exclu'].some(function (k) { return E.est(p.etat, k); })) r.push(x);
      else a.push(x);
    });
    return { gains: g, risques: r, autres: a };
  }

  // Libellé texte sans emoji d'un état du Conseiller, pour un onglet ou un compteur (Centre, Accueil).
  // Onglets et compteurs : « À agir », « Opportunités », « À surveiller ». Autre valeur : texte sans emoji.
  var LIB_ONGLET = { agir: 'À agir', opportunite: 'Opportunités', surveiller: 'À surveiller' };
  function libelle(etat) {
    var E = global.NexusEtatsConseiller;
    if (E) for (var k in LIB_ONGLET) if (has(LIB_ONGLET, k) && E.est(etat, k)) return LIB_ONGLET[k];
    return String(etat == null ? '' : etat).replace(/^[^A-Za-zÀ-ÿ0-9]+/, '').trim();
  }

  // Couleur de bordure d'une carte, d'après la clé : critique, à vérifier, agir ; tout le reste est neutre.
  function classeCarte(etat) {
    var E = global.NexusEtatsConseiller;
    if (E) {
      if (E.est(etat, 'critique')) return 'nbe-carte-critique';
      if (E.est(etat, 'verifier')) return 'nbe-carte-verifier';
      if (E.est(etat, 'agir')) return 'nbe-carte-agir';
    }
    return 'nbe-carte-neutre';
  }

  // Couleur d'un compteur : « À agir » en accent, le reste en texte neutre.
  function classeCompteur(etat) {
    var E = global.NexusEtatsConseiller;
    return (E && E.est(etat, 'agir')) ? 'nbe-compteur-agir' : 'nbe-compteur-neutre';
  }

  injecterCss();

  global.NexusBadgeEtat = {
    libelle: libelle,
    gravite: gravite, traitement: traitement, action: action, qualification: qualification,
    classeCarte: classeCarte, classeCompteur: classeCompteur, priorite: priorite, neutre: neutre, rendu: rendu, grouper: grouper, injecterCss: injecterCss, _CSS: CSS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.NexusBadgeEtat;
})(typeof window !== 'undefined' ? window : globalThis);
