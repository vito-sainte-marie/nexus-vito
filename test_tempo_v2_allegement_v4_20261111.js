// Lot « Tempo V2, allègement V4 » : présentation seule. Rien n'est calculé ni retiré :
// ce que la carte ne montre plus est dans la fiche détaillée.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

function t(nom, fn) {
  try { fn(); console.log('  ok   ' + nom); }
  catch (e) { console.log('  FAIL ' + nom + '\n       ' + String(e.message).split('\n')[0]); process.exitCode = 1; }
}
const racine = __dirname;
const html = fs.readFileSync(path.join(racine, 'NEXUS-Tempo-v2.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
const sansScripts = html.replace(/<script[\s\S]*?<\/script>/g, '');
const css = (html.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];
global.window = {};
require(path.join(racine, 'nexus-tempo.js'));
const T = window.NexusTempo;
const article = (id) => { const m = sansScripts.match(new RegExp('<(article|div) class="[^"]*" id="' + id + '"[\\s\\S]*?(?=<article|<div class="colonne|</section>)')); assert.ok(m, id); return m[0]; };
const ids3 = ['indPiste', 'indBoutique', 'indFdj'];
const idsQ = ['qLitres', 'qBoutique', 'qFdj'];

t('charte épurée : bordure pleine, pas de trait visible, pas de halo, pas de fond d\'icône', () => {
  assert.ok(/\.act, \.colonne\.act, \.tuile\.act\{[^}]*border:1\.5px solid rgba\(var\(--c-rgb\), \.85\)/.test(css));
  assert.ok(!/border-top:3px|radial-gradient|--a-glow|--a-bord/.test(css));
  assert.ok(!/<(div|span) class="trait/.test(sansScripts));
  assert.ok(!/\.ico\{[^}]*background/.test(css));
});

t('chiffres en sans (IBM Plex Sans), plus en mono', () => {
  assert.ok(/\.valeur \.nb\{font-family:var\(--t-sans\)/.test(css));
  for (const sel of ['.eyebrow', '.pill', '.titre-section', '.niveau', '.pastille', '.valeur']) {
    const m = css.match(new RegExp('\\n\\' + sel + '\\{[^}]*\\}'));
    assert.ok(m, sel);
    assert.ok(!/--t-mono/.test(m[0]), sel + ' encore en mono');
  }
});

t('chaque carte : une seule évolution courte et au plus un constat', () => {
  for (const id of ids3) {
    const a = article(id);
    assert.strictEqual((a.match(/class="evol-court"/g) || []).length, 1, id + ' évolution');
    assert.ok((a.match(/class="constat"/g) || []).length <= 1, id + ' constat');
    assert.ok(/<h3>[^<]{1,12}<\/h3>/.test(a), id + ' titre court');
    assert.ok(/class="detail-btn"[^>]*data-detail="/.test(a), id + ' bouton Détail');
  }
});

t('libelleEvolution : trois états, sinon « Tendance non déterminée »', () => {
  const L = T.libelleEvolution;
  assert.strictEqual(typeof L, 'function');
  assert.strictEqual(L({ etat: 'ok', pct: 3, ecart: 30, erreurType: 10, dansVariationHabituelle: true }), 'Variation habituelle');
  assert.strictEqual(L({ etat: 'ok', pct: -12, ecart: -120, erreurType: 10, dansVariationHabituelle: false }), 'Baisse confirmée');
  assert.strictEqual(L({ etat: 'ok', pct: 12, ecart: 120, erreurType: 10, dansVariationHabituelle: false }), 'Hausse confirmée');
  assert.strictEqual(L({ etat: 'insuffisant' }), 'Tendance non déterminée');
  assert.strictEqual(L({ etat: 'ok', pct: null }), 'Tendance non déterminée');
  assert.strictEqual(L(null), 'Tendance non déterminée');
  assert.strictEqual(L(undefined), 'Tendance non déterminée');
});

t('plus de « dans la variation habituelle » nulle part dans la page', () => {
  assert.ok(!/dans la variation habituelle/.test(html));
  assert.ok(/libelleEvolution/.test(scripts));
});

t('chaque chiffre retiré des cartes est dans la fiche (détail masqué rempli puis recopié)', () => {
  for (const id of [...ids3, ...idsQ]) assert.ok(/class="detail-source" hidden/.test(article(id)), id + ' detail-source');
  for (const id of ids3) {
    const a = article(id);
    for (const c of ['total', 'periode', 'evol']) assert.ok(new RegExp('class="' + c + '[ "]').test(a), id + ' .' + c);
  }
  assert.ok(/data-arbitrage="G1"[\s\S]*?id="horsAppel"/.test(article('indBoutique')), 'G1 + hors appel (Boutique)');
  assert.ok(/data-arbitrage="G3"/.test(article('indFdj')), 'G3 (FDJ)');
  assert.ok(/\.carb-lignes/.test(scripts) && /\.carb-quarts/.test(scripts), 'carburants et quarts conservés');
  assert.ok(/detail-source > \.valeur|\.detail-source \.valeur|detail-source[^']*valeur/.test(scripts), 'ligne des quarts lue dans le détail');
  assert.ok(/'Fiabilité de la comparaison'/.test(scripts), 'fiabilité (écart, erreur type, sans le …, exceptionnels)');
  assert.ok(/Calcul et sources/.test(scripts) && /piedSources/.test(scripts), 'calcul et sources');
  for (const m of ['Sans le ', 'Journées exceptionnelles']) assert.ok(scripts.includes(m), m);
});

t('fiche : dialogue accessible, Échap, retour du focus, piège de tabulation, fond cliquable', () => {
  assert.ok(/id="fiche" role="dialog" aria-modal="true" aria-labelledby="ficheTitre"/.test(sansScripts));
  assert.ok(/id="ficheTitre" tabindex="-1"/.test(sansScripts));
  assert.ok(/aria-label="Fermer la fiche"/.test(sansScripts));
  assert.ok(/e\.key === 'Escape'/.test(scripts));
  assert.ok(/e\.key !== 'Tab'/.test(scripts) && /e\.shiftKey/.test(scripts));
  assert.ok(/retour\.focus\(\)/.test(scripts) && /titre\.focus\(\)/.test(scripts));
  assert.ok(/e\.target === fond/.test(scripts));
  assert.ok(/\[hidden\]\{display:none ?!important;?\}/.test(css));
  assert.ok(/prefers-reduced-motion/.test(css));
  assert.ok(/max-width:\s*767px|max-width:767px|max-width: 767px/.test(css) || /768px/.test(css), 'feuille basse sous 768 px');
});

t('survol : réservé à .tuile.disponible (aucun effet sur les cartes)', () => {
  const hovers = css.match(/[^\n}]*:hover[^{]*\{/g) || [];
  for (const h of hovers) assert.ok(/\.tuile\.disponible|\.detail-btn|\.fiche-fermer|summary/.test(h), 'survol hors périmètre : ' + h.trim());
  assert.ok(!/\.carte[^{]*:hover|\.colonne[^{]*:hover|\.indicateur[^{]*:hover/.test(css));
});

t('aucune écriture : lecture seule', () => {
  assert.ok(!/\.(insert|update|upsert|delete|rpc)\s*\(/.test(scripts));
  assert.ok(!/localStorage|sessionStorage/.test(scripts));
});

t('nexus-tempo.js : seuil de Welch inchangé (2 erreurs-types)', () => {
  const j = fs.readFileSync(path.join(racine, 'nexus-tempo.js'), 'utf8');
  assert.ok(/SEUIL_ECART_TYPES\s*=\s*2\b/.test(j) && /Math\.abs\(ecart\) <= SEUIL_ECART_TYPES \* se/.test(j));
});
