// Table de correspondance rayon Decenium → famille d'icône (Guardian 7064246243, 21/11/2026).
// Données seulement : aucune expression en dur dans un écran. Les règles sont lues dans l'ordre, la première qui
// correspond l'emporte. Chaque règle porte la famille visée (`famille`) et, tant que l'image de cette famille
// n'existe pas, une famille de secours (`secours`, sinon aucune). Une famille sans image prend l'icône neutre.
(function (root) {
  'use strict';
  var NEUTRE = 'cat-petits-articles';

  // Familles dont l'image existe dans assets/icones/v2. Une famille « à venir » y est ajoutée le jour où ses
  // fichiers sont déposés (le script outils/icones-familles/integrer.js les produit).
  var PRETES = ['cat-gaz', 'cat-glacons', 'cat-huiles', 'cat-boissons', 'cat-lave-glace', 'cat-viennoiserie',
    'cat-pains', 'cat-journaux', 'cat-cbd', 'cat-cigarettes', 'cat-petits-articles',
    'cat-confiserie', 'cat-biscuits', 'cat-chips', 'cat-jus', 'cat-eaux', 'cat-bieres', 'cat-alcools',     'cat-tabac', 'cat-feuilles', 'cat-vape', 'cat-cartes', 'cat-glaces', 'cat-epicerie', 'cat-hygiene',     'cat-entretien', 'cat-auto', 'cat-electricite', 'cat-bricolage'];

  // Familles annoncées, images dessinées hors dépôt, à intégrer (identifiants figés par le Guardian).
  var A_VENIR = [];

  // Motifs sur le libellé normalisé (sans accent, minuscules, espaces simples). Ordre significatif.
  var REGLES = [
    { motif: 'lave[- ]?glace|refroidissement', famille: 'cat-lave-glace' },
    { motif: 'glacon', famille: 'cat-glacons' },
    { motif: '\\bglaces?\\b|creme glacee', famille: 'cat-glaces' },
    // Quatre associations corrigées : l'ordre ci-dessous est voulu.
    { motif: 'biscuiterie|pains? d epices?', famille: 'cat-biscuits' },
    { motif: 'vinaigre|graisses?\\b', famille: 'cat-epicerie' },
    { motif: 'huile.*(moteur|auto|vehicule)|lubrifiant', famille: 'cat-huiles' },
    { motif: 'briquet', famille: 'cat-tabac' },
    { motif: 'paquets? de (20|25|30)\\b', famille: 'cat-cigarettes' },
    { motif: 'feuilles?\\b|\\bpapier a rouler|\\bfiltres?\\b', famille: 'cat-feuilles' },
    { motif: 'tabac|a rouler', famille: 'cat-tabac' },
    { motif: 'cigarette', famille: 'cat-cigarettes' },
    { motif: 'vape|cigarette electronique|e[- ]?liquide', famille: 'cat-vape' },
    { motif: '\\bcbd\\b', famille: 'cat-cbd' },
    { motif: '\\bgaz\\b', famille: 'cat-gaz' },
    { motif: 'huile', famille: 'cat-huiles' },
    { motif: 'biere|cidre', famille: 'cat-bieres', secours: 'cat-boissons' },
    { motif: 'alcool|spiritueux|whisky|vodka|rhum|champagne|vins?\\b|apero', famille: 'cat-alcools' },
    { motif: '\\beaux?\\b', famille: 'cat-eaux' },
    { motif: '\\bsucres?\\b|confitures?', famille: 'cat-epicerie' },
    { motif: '\\bjus\\b|soda|sirop|limonade', famille: 'cat-jus' },
    { motif: 'boisson', famille: 'cat-boissons' },
    { motif: 'viennois', famille: 'cat-viennoiserie' },
    { motif: '\\bpains?\\b|sandwich', famille: 'cat-pains' },
    { motif: 'confiserie|bonbon|chocolat|chewing', famille: 'cat-confiserie' },
    { motif: 'chips|biscuits? sales|snack', famille: 'cat-chips' },
    { motif: 'biscuit|gateau|patisserie', famille: 'cat-biscuits' },
    { motif: 'carte|recharge|telephon', famille: 'cat-cartes' },
    { motif: 'journa|presse|magazine', famille: 'cat-journaux' },
    { motif: 'epicerie|conserve|pates|riz|cafe|the\\b', famille: 'cat-epicerie' },
    { motif: 'hygiene|beaute|cosmetique|toilette', famille: 'cat-hygiene' },
    { motif: 'entretien|nettoyage|lessive|menage', famille: 'cat-entretien' },
    { motif: 'auto|essuie|balai|moto', famille: 'cat-auto' },
    { motif: 'electri|pile|ampoule|batterie|chargeur', famille: 'cat-electricite' },
    { motif: 'bricolage|outil|quincaillerie', famille: 'cat-bricolage' },
    // Rayons du lot réel sans règle jusque-là (Guardian 7065506472) : choix à trancher par le Guardian.
    { motif: 'additifs?|carrosserie|pneumatique|lavage|\\binterieur\\b', famille: 'cat-auto' },
    { motif: 'charcuterie|condiments?|farine', famille: 'cat-epicerie' },
    { motif: 'cigares?', famille: 'cat-tabac' },
    { motif: 'codes? promo|courrier', famille: 'cat-cartes' },
    { motif: 'colles?\\b|jardinage', famille: 'cat-bricolage' },
    { motif: 'esthetique|capillaires?', famille: 'cat-hygiene' },
    { motif: 'puffs?\\b', famille: 'cat-vape' },
    { motif: 'vaisselle', famille: 'cat-entretien' },
    { motif: '^accessoires$|^autres$|bois et derives|kits? et packs?|maison deco', famille: 'cat-petits-articles' },
    { motif: 'petits? articles?', famille: 'cat-petits-articles' }
  ].map(function (r) { r.re = new RegExp(r.motif); return r; });

  // Un libellé de rayon qui arrive mal encodé (UTF-8 lu en latin-1 : « Tabac Ã  rouler ») est remis d'aplomb.
  function redresser(s) {
    s = String(s == null ? '' : s);
    if (!/[ÃÂ]/.test(s)) return s;
    try {
      var octets = [];
      for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); if (c > 255) throw new Error('hors latin-1'); octets.push(c); }
      var txt = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(octets));
      if (txt) return txt;
    } catch (e) { /* repli ci-dessous */ }
    return s.replace(/Ã[  ]/g, 'à').replace(/Ã©/g, 'é').replace(/Ã¨/g, 'è').replace(/Ã´/g, 'ô').replace(/Ã§/g, 'ç');
  }
  function normaliser(s) {
    return redresser(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/['’`]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function prete(id) { return PRETES.indexOf(id) >= 0; }
  // Règle retenue pour un rayon, ou null si aucune ne correspond.
  function regle(rayon) {
    var n = normaliser(rayon);
    if (!n) return null;
    for (var i = 0; i < REGLES.length; i++) if (REGLES[i].re.test(n)) return REGLES[i];
    return null;
  }
  // Famille visée par le rayon, image prête ou non. null : rayon inconnu.
  function familleCible(rayon) { var r = regle(rayon); return r ? r.famille : null; }
  // Identifiant dont l'image existe, ou null (les surfaces qui gardent leur pictogramme).
  function familleAffichable(rayon) {
    var r = regle(rayon);
    if (!r) return null;
    if (prete(r.famille)) return r.famille;
    return r.secours && prete(r.secours) ? r.secours : null;
  }
  // Pour la liste des références : toujours une icône, l'icône neutre à défaut.
  function iconeRayon(rayon) { return familleAffichable(rayon) || NEUTRE; }
  // Rayons sans règle : le test les liste pour qu'on les range.
  function inconnus(rayons) {
    var vus = {}, out = [];
    (rayons || []).forEach(function (r) {
      var cle = normaliser(r);
      if (!cle || vus[cle]) return;
      vus[cle] = 1;
      if (!regle(r)) out.push(redresser(r).trim());
    });
    return out.sort();
  }

  var API = { NEUTRE: NEUTRE, PRETES: PRETES, A_VENIR: A_VENIR, REGLES: REGLES, normaliser: normaliser, redresser: redresser,
    familleCible: familleCible, familleAffichable: familleAffichable, iconeRayon: iconeRayon, inconnus: inconnus };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.NexusRayonsFamilles = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
