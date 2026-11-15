// ============================================================
// Campagne V2, lot C9 : fiche de valorisation par produit.
// Composant pur : aucun calcul nouveau, tout vient de NexusCampagneBilan.bilanArticle (FIFO analytique).
// Un seul composant, trois emplacements : page Ventes, produits moteurs / à revoir, bilan d'une promotion.
// Inclure : <script src="nexus-campagne-fiche.js?v=20261115-1"></script>
// ============================================================
(function (global) {
  'use strict';

  const LIBELLES = {
    titreVentes: 'unités vendues',
    avant: 'Stock acheté avant la promotion',
    promo: 'Stock acheté au tarif promotionnel',
    coutTotal: 'Coût total des ventes',
    coutMoyen: 'Coût moyen des unités vendues',
    restant: 'Stock restant',
    restantPromo: 'Stock promotionnel restant',
    dontAvant: 'dont avant la promotion',
    dontPromo: 'dont au tarif promotionnel',
    valeurAchat: 'Valeur d\'achat',
    economie: 'Économie d\'achat',
    economieSuite: 'par rapport au PMP Decenium d\'avant promotion',
    methode: 'Méthode Campagne (FIFO analytique)',
    aucunPoint: 'Fiche disponible après le premier import de ventes',
    estime: 'estimé',
    excedent: 'unités vendues au-delà du stock connu, coût non valorisé',
    sansPrix: 'unités sans prix d\'achat connu, coût non valorisé',
    apres: 'reçue après les ventes',
    voir: 'Voir la fiche de valorisation',
    masquer: 'Masquer la fiche',
    chargement: 'Calcul de la fiche…',
  };

  function num(v) { if (v === null || v === undefined || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; }
  function dec(v, d) { return Number(v).toFixed(d).replace('.', ','); }
  function eur(v, d) { return v === null || v === undefined ? 'n.d.' : dec(v, d === undefined ? 2 : d) + ' €'; }
  function nombre(v) { return String(Math.round(Number(v) * 1000) / 1000).replace('.', ','); }
  function jma(iso) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; }

  // Structure de la fiche, à partir d'un bilanArticle (avec .article) et d'options { aucunPoint, dateVentes }.
  function construire(ba, opts) {
    const o = opts || {};
    if (!ba || o.aucunPoint) return { etat: 'aucun_point', article: ba && ba.article ? ba.article : '', message: LIBELLES.aucunPoint };
    const consommes = ba.consommes || [];
    const lignes = consommes.map(c => ({
      type: c.origine === 'stock_depart' ? 'avant' : 'promo',
      libelle: c.origine === 'stock_depart' ? LIBELLES.avant : LIBELLES.promo,
      date: c.origine === 'livraison' ? (c.date_livraison || null) : null,
      unites: c.unites,
      pa: c.pa,
      total: c.pa === null ? null : Math.round(c.unites * c.pa * 100) / 100,
      estime: !!c.estime,
    }));
    const valorisees = consommes.filter(c => c.pa !== null).reduce((s, c) => s + c.unites, 0);
    const moyen = valorisees > 0 ? ba.cout_ventes / valorisees : null;
    const restantLots = (ba.stock_restant && ba.stock_restant.lots) || [];
    // Seules les raisons qui touchent le coût comptent ici : la marge de référence et le CA relèvent d'autres écrans.
    const raisons = (ba.raisons || []).filter(r => !/^marge de référence incalculable|^chiffre d'affaires de la promotion absent/.test(r));
    const apres = restantLots.filter(l => l.apres).reduce((s, l) => s + l.unites, 0);
    const somme = (fn) => restantLots.filter(fn).reduce((a, l) => a + l.unites, 0);
    const origines = [];
    const avantU = somme(l => l.origine === 'stock_depart');
    const promoU = somme(l => l.origine !== 'stock_depart');
    restantLots.forEach(l => origines.push({ type: l.origine === 'stock_depart' ? 'avant' : 'promo', unites: l.unites, pa: l.pa }));
    return {
      etat: 'fiche',
      article: ba.article || '',
      unites_vendues: ba.unites_vendues,
      lignes,
      cout_total: ba.cout_ventes,
      cout_moyen: moyen,
      excedent_unites: ba.excedent_unites || 0,
      sans_prix: ba.unites_sans_prix || 0,
      restant: {
        unites: ba.stock_restant ? ba.stock_restant.unites : 0,
        valeur_ht: ba.stock_restant ? ba.stock_restant.valeur_ht : null,
        economie: promoU > 0 ? ba.economie_achat_stock_restant : null,
        apres,
        origines,
        unites_avant: avantU,
        unites_promo: promoU,
      },
      estimee: raisons.length > 0,
      raisons,
      mentions: ba.mentions || [],
      methode: LIBELLES.methode,
    };
  }

  function html(f, esc) {
    const e = esc || (x => String(x));
    if (!f) return '';
    if (f.etat === 'aucun_point') return '<div class="fv-fiche fv-vide">' + e(f.message) + '</div>';
    const L = LIBELLES;
    let h = '<div class="fv-fiche" data-fiche="' + e(f.article) + '">';
    h += '<div class="fv-tete"><b>' + e(f.article) + '</b><span>' + nombre(f.unites_vendues) + ' ' + e(L.titreVentes) + '</span></div>';
    f.lignes.forEach(l => {
      const lib = l.libelle + (l.date ? ' (livraison du ' + jma(l.date) + ')' : '');
      const calc = l.pa === null ? 'prix inconnu' : nombre(l.unites) + ' × ' + dec(l.pa, 2) + ' = ' + eur(l.total);
      h += '<div class="fv-l"><span>' + e(lib) + (l.estime ? ' <em>(' + e(L.estime) + ', PA facturé absent)</em>' : '') + '</span><b>' + e(calc) + '</b></div>';
    });
    if (f.excedent_unites > 0) h += '<div class="fv-l fv-alerte"><span>' + nombre(f.excedent_unites) + ' ' + e(L.excedent) + '</span></div>';
    if (f.sans_prix > 0) h += '<div class="fv-l fv-alerte"><span>' + nombre(f.sans_prix) + ' ' + e(L.sansPrix) + '</span></div>';
    h += '<div class="fv-l fv-tot"><span>' + e(L.coutTotal) + (f.estimee ? ' <em>(' + e(L.estime) + ')</em>' : '') + '</span><b>' + eur(f.cout_total) + '</b></div>';
    h += '<div class="fv-l"><span>' + e(L.coutMoyen) + '</span><b>' + (f.cout_moyen === null ? 'n.d.' : dec(f.cout_moyen, 3) + ' €') + '</b></div>';
    const toutPromo = f.restant.unites_promo > 0 && f.restant.unites_avant === 0;
    h += '<div class="fv-reste"><div class="fv-l"><span>' + e(toutPromo ? L.restantPromo : L.restant) + '</span><b>' + nombre(f.restant.unites) + ' unités</b></div>';
    if (!toutPromo) {
      f.restant.origines.forEach(o => {
        h += '<div class="fv-l fv-dont"><span>' + e(o.type === 'avant' ? L.dontAvant : L.dontPromo) + '</span><b>' + (o.pa === null || o.pa === undefined ? nombre(o.unites) + ' × prix inconnu' : nombre(o.unites) + ' × ' + dec(o.pa, 2)) + '</b></div>';
      });
    }
    h += '<div class="fv-l"><span>' + e(L.valeurAchat) + '</span><b>' + eur(f.restant.valeur_ht) + ' HT</b></div>';
    if (f.restant.economie !== null && f.restant.economie !== undefined) {
      h += '<div class="fv-l"><span>' + e(L.economie + ' : ' + dec(f.restant.economie, 2) + ' € ' + L.economieSuite) + '</span></div>';
    }
    if (f.restant.apres > 0) h += '<div class="fv-note">' + nombre(f.restant.apres) + ' unités ' + e(L.apres) + ' comprises.</div>';
    h += '</div>';
    if (f.estimee && f.raisons.length) h += '<div class="fv-note">' + f.raisons.map(r => e(L.estime + ' : ' + r)).join('<br>') + '</div>';
    f.mentions.forEach(m => { h += '<div class="fv-note">' + e(m) + '</div>'; });
    h += '<div class="fv-methode">' + e(f.methode) + '</div></div>';
    return h;
  }

  // Raccourci : bilanArticle -> html, pour les trois emplacements.
  function rendre(ba, opts, esc) { return html(construire(ba, opts), esc); }

  // CSS unique, injecté une fois (thème Tempo, variables --t-*).
  const CSS = '.fv-fiche{margin:6px 0 10px; padding:10px 12px; background:var(--t-raised); border:1px solid var(--t-line); border-radius:10px; font-size:12.5px; color:var(--t-mid);}'
    + '.fv-tete{display:flex; justify-content:space-between; gap:10px; margin-bottom:6px; color:var(--t-text);}.fv-tete span{color:var(--t-mid);}'
    + '.fv-l{display:flex; justify-content:space-between; gap:12px; padding:4px 0;}.fv-l b{color:var(--t-text); font-weight:600; text-align:right; white-space:nowrap;}.fv-dont{padding-left:10px;}'
    + '.fv-l em,.fv-note em{font-style:normal; color:var(--t-amber);}'
    + '.fv-tot{border-top:1px solid var(--t-line); margin-top:4px; padding-top:6px;}'
    + '.fv-alerte{color:var(--t-amber);}'
    + '.fv-reste{margin-top:8px; padding:8px 10px; border:1px dashed var(--t-line); border-radius:8px;}'
    + '.fv-note{margin-top:6px; line-height:1.45; color:var(--t-amber);}'
    + '.fv-methode{margin-top:8px; font-size:11px; color:var(--t-mid); opacity:.8;}'
    + '.fv-vide{font-style:italic;}';
  function injecterStyle(doc) {
    const d = doc || (typeof document !== 'undefined' ? document : null);
    if (!d || d.getElementById('fv-style')) return;
    const s = d.createElement('style'); s.id = 'fv-style'; s.textContent = CSS; d.head.appendChild(s);
  }

  global.NexusCampagneFiche = { LIBELLES, CSS, construire, html, rendre, injecterStyle };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.NexusCampagneFiche;
})(typeof window !== 'undefined' ? window : globalThis);
