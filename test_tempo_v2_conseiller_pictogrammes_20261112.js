// Tempo V2 — « Conseiller NEXUS » et 16 pictogrammes : présentation seule, jamais un libellé remplacé.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
global.window = {};
require('./nexus-vocabulaire.js');
const V = window.NexusVocab;
const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const v2 = lire('NEXUS-Tempo-v2.html'), jours = lire('NEXUS-Tempo-v2-Jours.html'), mois = lire('NEXUS-Tempo-v2-Mois.html');
const lex = lire('nexus-vocabulaire.js');
let echecs = 0;
function t(nom, fn) { try { fn(); console.log('  ok   ' + nom); } catch (e) { echecs++; console.log('  FAIL ' + nom + '\n       ' + e.message); } }
const PREMIUM = ['tempo-jour-fort-recurrent', 'tempo-jour-faible-recurrent', 'tempo-plus-forte-moyenne', 'tempo-plus-faible-moyenne',
  'tempo-comparaison-quarts', 'tempo-jours-forts-faibles', 'tempo-mois-favorables', 'tempo-vacances', 'tempo-performance-pompistes',
  'tempo-decouverte', 'tempo-evolution-masquee'];
const SIMPLE = ['tempo-activite-irreguliere', 'tempo-rythme-potentiel', 'tempo-variation-habituelle', 'tempo-fiabilite-donnees', 'tempo-comparaison-historique'];
const D = 'assets/icones/tempo/';

t('les 16 pictogrammes existent dans les deux déclinaisons', () => {
  assert.strictEqual(PREMIUM.length + SIMPLE.length, 16);
  PREMIUM.forEach(n => ['.svg', '-48.webp', '-96.webp', '-144.webp'].forEach(x => assert.ok(fs.existsSync(D + 'premium/' + n + x), n + x)));
  SIMPLE.forEach(n => ['.svg', '-24.png'].forEach(x => assert.ok(fs.existsSync(D + 'simple/' + n + x), n + x)));
});
t('chaque pictogramme est référencé dans la bonne page', () => {
  const ou = {
    'tempo-jour-fort-recurrent': jours, 'tempo-jour-faible-recurrent': jours, 'tempo-plus-forte-moyenne': jours, 'tempo-plus-faible-moyenne': jours,
    'tempo-activite-irreguliere': jours, 'tempo-rythme-potentiel': jours, 'tempo-variation-habituelle': jours,
    'tempo-comparaison-quarts': v2, 'tempo-jours-forts-faibles': v2, 'tempo-mois-favorables': v2, 'tempo-vacances': v2, 'tempo-performance-pompistes': v2,
    'tempo-decouverte': v2, 'tempo-evolution-masquee': v2, 'tempo-fiabilite-donnees': v2, 'tempo-comparaison-historique': v2
  };
  const construits = { 'tempo-jour-fort-recurrent': ['jour-', 'fort', '-recurrent'], 'tempo-jour-faible-recurrent': ['jour-', 'faible', '-recurrent'], 'tempo-plus-forte-moyenne': ['plus-', 'forte', '-moyenne'], 'tempo-plus-faible-moyenne': ['plus-', 'faible', '-moyenne'] };
  Object.keys(ou).forEach(n => assert.ok(construits[n] ? construits[n].every(m => ou[n].includes("'" + m + "'") || ou[n].includes(m)) && ou[n].includes("'tempo-'") : ou[n].includes(n), n));
  assert.ok(mois.includes('tempo-comparaison-historique'));
});
t('toujours des <img>, jamais de SVG en ligne pour un pictogramme', () => {
  [v2, jours, mois].forEach(h => {
    assert.ok(!/<svg[^>]*>\s*<defs>/i.test(h.replace(/<svg[^>]*style="display:none"[\s\S]*?<\/svg>/, '')), 'SVG en ligne avec <defs>');
    assert.ok(!/id="g"|id="s"/.test(h), 'dégradé g ou s en ligne');
  });
});
t('tout pictogramme a un alt vide et des dimensions fixes', () => {
  [v2, jours, mois].forEach(h => {
    const imgs = h.match(/<img[^>]*icones\/tempo[^>]*>/g) || [];
    imgs.forEach(i => assert.ok(/alt=""/.test(i), i));
    imgs.filter(i => !/class="picto-/.test(i)).forEach(i => assert.fail(i));
  });
  assert.ok(/im\.alt = ''/.test(v2));
});
t('les premium portent srcset WebP 48/96/144 et les simples 24 px', () => {
  assert.ok(/-48\.webp 48w, [^"]*-96\.webp 96w, [^"]*-144\.webp 144w/.test(v2));
  assert.ok(/class="picto-p"[^>]*width="48" height="48"/.test(v2));
  assert.ok(/width = 24; im\.height = 24/.test(v2));
});
t('le pictogramme masqué n’apparaît que pour une découverte de type masquée', () => {
  assert.ok(/c\.type === 'masquee' \? 'tempo-evolution-masquee' : 'tempo-decouverte'/.test(v2));
  assert.strictEqual((v2.match(/tempo-evolution-masquee/g) || []).length, 1);
});
t('la comparabilité faible n’a son pictogramme que si elle est faible', () => {
  const i = v2.indexOf('if (comp.faible) {');
  assert.ok(i > -1 && v2.slice(i, i + 400).includes('tempo-fiabilite-donnees'));
});
t('« Conseiller NEXUS » vient du lexique et remplace « Lecture Tempo »', () => {
  assert.strictEqual(V.jours.tuiles.titreLecture, 'Conseiller NEXUS');
  assert.ok(!/Lecture Tempo/.test(lex + jours + v2 + mois));
});
t('la carte du Conseiller suit NEXUS-Tempo-v1 : avatar rond 44 px, srcset 64/96/128, alt vide', () => {
  assert.ok(jours.includes('class="conseiller-card"') && jours.includes('class="conseiller-avatar"'));
  assert.ok(/assets\/avatar\/nexus-avatar-64\.png/.test(jours) && /96w/.test(jours) && /128w/.test(jours));
  assert.ok(/width="44" height="44" alt=""/.test(jours));
  assert.ok(/\.conseiller-avatar\{[^}]*44px[^}]*border-radius:50%/.test(jours.replace(/\s+/g, ' ').replace(/ ?: ?/g, ':').replace(/ ?; ?/g, ';')));
});
t('le Conseiller ne donne ni action ni décision', () => {
  const i = jours.indexOf('class="conseiller-card"');
  const bloc = jours.slice(i, i + 900);
  assert.ok(!/NexusVocab\.decision|\.decision\b/.test(bloc));
  assert.ok(!/\b(devez|devriez|faites|faire|essayez|prévoyez|augmentez|baissez|réduisez|recommand|agissez)\w*/i.test(bloc));
  assert.ok(!/décision/i.test(String(V.jours.tuiles.titreLecture)));
});
t('aucun pictogramme ne remplace un libellé, aucun mot « favorable » à l’écran', () => {
  [v2, jours, mois].forEach(h => {
    const visible = h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ');
    assert.ok(!/favorable/i.test(visible), 'mot « favorable » affiché');
  });
  const tuiles = v2.match(/<img class="picto-p"[^>]*>\s*<span class="t-titre">[^<]+/g) || [];
  assert.strictEqual(tuiles.length, 5);
});
t('les pictogrammes Tempo ne sont référencés que par les pages du périmètre (sans git)', () => {
  const ok = ['NEXUS-Tempo-v2.html', 'NEXUS-Tempo-v2-Jours.html', 'NEXUS-Tempo-v2-Mois.html', 'nexus-vocabulaire.js'];
  fs.readdirSync(__dirname).filter(f => /\.(html|js)$/.test(f) && !/^test_/.test(f)).forEach(f => {
    const c = fs.readFileSync(path.join(__dirname, f), 'utf8');
    if (c.includes('assets/icones/tempo/')) assert.ok(ok.includes(f), 'référence hors périmètre : ' + f);
  });
});

console.log(echecs ? echecs + ' échec(s)' : 'tous ok');
process.exit(echecs ? 1 : 0);
