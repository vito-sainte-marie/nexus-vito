// Tempo V2 — signature visuelle des trois activités : CSS et balisage seulement.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const racine = __dirname;
let echecs = 0;
function t(nom, fn) {
  try { fn(); console.log('  ok   ' + nom); }
  catch (e) { echecs++; console.log('  FAIL ' + nom + '\n       ' + e.message); }
}
const PAGE = 'NEXUS-Tempo-v2.html';
const html = fs.readFileSync(path.join(racine, PAGE), 'utf8');
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
const sansScripts = html.replace(/<script[\s\S]*?<\/script>/g, '');
const css = (html.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];
const bloc = (re) => { const m = sansScripts.match(re); assert.ok(m, 'bloc introuvable : ' + re); return m[0]; };

t('six jetons d\'activité, Nuit puis Jour', () => {
  const nuit = css.slice(0, css.indexOf(':root[data-theme="jour"]'));
  const jour = css.slice(css.indexOf(':root[data-theme="jour"]'), css.indexOf('*{box-sizing'));
  for (const [k, v] of [['piste', '#22C7B8'], ['boutique', '#C47A55'], ['fdj', '#A18BF2']])
    assert.ok(new RegExp('--' + k + ':\\s*' + v, 'i').test(nuit), k + ' Nuit');
  for (const [k, v] of [['piste', '#0F766E'], ['boutique', '#7A4A3A'], ['fdj', '#6246C9']])
    assert.ok(new RegExp('--' + k + ':\\s*' + v, 'i').test(jour), k + ' Jour');
  for (const [k, v] of [['piste', '34,199,184'], ['boutique', '196,122,85'], ['fdj', '161,139,242']])
    assert.ok(new RegExp('--' + k + '-rgb:\\s*' + v).test(nuit), k + ' rgb Nuit');
  for (const [k, v] of [['piste', '15,118,110'], ['boutique', '122,74,58'], ['fdj', '98,70,201']])
    assert.ok(new RegExp('--' + k + '-rgb:\\s*' + v).test(jour), k + ' rgb Jour');
});

t('opacités : bordure 32/30 %, halo 10/6 %, icône 14/10 %', () => {
  const nuit = css.slice(0, css.indexOf(':root[data-theme="jour"]'));
  const jour = css.slice(css.indexOf(':root[data-theme="jour"]'), css.indexOf('*{box-sizing'));
  assert.ok(/--a-bord:\.32/.test(nuit) && /--a-glow:\.10/.test(nuit) && /--a-ico:\.14/.test(nuit));
  assert.ok(/--a-bord:\.30/.test(jour) && /--a-glow:\.06/.test(jour) && /--a-ico:\.10/.test(jour));
  assert.ok(/border-top:3px solid rgb\(var\(--c-rgb\)\)/.test(css), 'barre de 3 px');
  assert.ok(/radial-gradient\(circle at 0 0,[^;]*transparent 60%\)/.test(css), 'halo en coin, évanoui à 60 %');
  assert.ok(!/box-shadow|text-shadow|filter:\s*drop-shadow/.test(css.slice(css.indexOf('Lot « signature'))), 'pas d\'ombre portée');
});

t('chaque indicateur et chaque sous-carte portent la bonne classe', () => {
  for (const [id, a] of [['indPiste', 'piste'], ['indBoutique', 'boutique'], ['indFdj', 'fdj'], ['qLitres', 'piste'], ['qBoutique', 'boutique'], ['qFdj', 'fdj']])
    assert.ok(new RegExp('id="' + id + '"').test(sansScripts) && new RegExp('class="[^"]*\\bact\\b[^"]*\\ba-' + a + '\\b[^"]*" id="' + id + '"').test(sansScripts), id + ' / ' + a);
});

t('icône 32 px (28 px en sous-carte), SVG en ligne aria-hidden, nom écrit à côté', () => {
  assert.ok(/\.ico\{[^}]*width:32px;[^}]*height:32px;[^}]*border-radius:9px/.test(css));
  assert.ok(/\.colonne \.ico\{width:28px;\s*height:28px/.test(css));
  for (const [id, a, nom] of [['indPiste', 'piste', 'Piste · Litres vendus'], ['indBoutique', 'boutique', 'Boutique · Marge commerciale'], ['indFdj', 'fdj', 'FDJ · CA des jeux'],
    ['qLitres', 'piste', 'Litres'], ['qBoutique', 'boutique', 'CA boutique'], ['qFdj', 'fdj', 'CA FDJ']]) {
    const b = bloc(new RegExp('id="' + id + '"[\\s\\S]*?<h3>[^<]*</h3>'));
    assert.ok(b.includes('<use href="#i-' + a + '"/>'), id + ' icône ' + a);
    assert.ok(/<svg aria-hidden="true">/.test(b), id + ' aria-hidden');
    assert.ok(b.includes('<h3>' + nom + '</h3>'), id + ' nom');
  }
  for (const a of ['piste', 'boutique', 'fdj']) assert.ok(new RegExp('<symbol id="i-' + a + '"').test(sansScripts));
});

t('barres : Quart 1 couleur pleine, Quart 2 à 45 %', () => {
  assert.ok(/\.act \.q1\{background:rgb\(var\(--c-rgb\)\)/.test(css));
  assert.ok(/\.act \.q2\{background:rgba\(var\(--c-rgb\), \.45\)/.test(css));
});

t('les six tuiles : pastilles dans l\'ordre, bande partagée pour les croisées', () => {
  const attendu = [
    ['Le quart 1 vend-il plus que le quart 2 ?', ['piste', 'boutique', 'fdj']],
    ['Comment se situent les pompistes ?', ['piste']],
    ['Quels sont mes jours forts et faibles ?', ['piste', 'boutique', 'fdj']],
    ['Quels mois me sont favorables ?', ['piste', 'boutique', 'fdj']],
    ['Les vacances changent-elles mon activité ?', ['piste', 'boutique', 'fdj']],
    ['Quand la piste tourne, la boutique suit-elle ?', ['piste', 'boutique']],
  ];
  const tuiles = [...sansScripts.matchAll(/<div class="tuile([^"]*)" aria-disabled="true">([\s\S]*?)<span class="t-sous">/g)];
  assert.strictEqual(tuiles.length, 6);
  const NOM = { piste: 'Piste', boutique: 'Boutique', fdj: 'FDJ' };
  attendu.forEach(([titre, acts], i) => {
    const [, cls, corps] = tuiles[i];
    assert.ok(corps.includes(titre), 'ordre : ' + titre);
    const pas = [...corps.matchAll(/<span class="pastille a-(\w+)"><svg aria-hidden="true"><use href="#i-\w+"\/><\/svg>([^<]*)<\/span>/g)];
    assert.deepStrictEqual(pas.map(p => p[1]), acts, titre);
    assert.deepStrictEqual(pas.map(p => p[2]), acts.map(a => NOM[a]), titre + ' noms');
    if (acts.length === 1) {
      assert.ok(/\bact\b/.test(cls) && cls.includes('a-' + acts[0]), titre + ' carte mono-activité');
      assert.ok(!/bande/.test(corps));
    } else {
      assert.ok(!/\bact\b|\ba-/.test(cls), titre + ' : bordure neutre, sans halo');
      const bande = corps.match(/<div class="bande"[^>]*>([\s\S]*?)<\/div>/);
      assert.ok(bande, titre + ' bande');
      assert.deepStrictEqual([...bande[1].matchAll(/class="a-(\w+)"/g)].map(m => m[1]), acts, titre + ' bande');
    }
  });
});

t('découvertes : emplacements neutres', () => {
  const d = bloc(/<section class="decouvertes"[\s\S]*?<\/section>/);
  assert.ok(!/\ba-(piste|boutique|fdj)\b|\bact\b|pastille/.test(d));
});

t('aucune couleur d\'activité dans .niveau, .arbitrage, .evol', () => {
  for (const sel of ['\\.niveau[^{]*', '\\.arbitrage[^{]*', '\\.evol[^{]*', '\\.total[^{]*']) {
    for (const m of css.matchAll(new RegExp('(?:^|\\n)(' + sel + ')\\{([^}]*)\\}', 'g')))
      assert.ok(!/--piste|--boutique|--fdj|--c-rgb/.test(m[2]), m[1] + ' porte une couleur d\'activité');
  }
  for (const cls of ['niveau', 'arbitrage', 'evol']) {
    for (const m of sansScripts.matchAll(new RegExp('<[a-z0-9]+ class="[^"]*\\b' + cls + '\\b[^"]*"', 'g')))
      assert.ok(!/\ba-(piste|boutique|fdj)\b|\bact\b/.test(m[0]), cls + ' balisé avec une activité : ' + m[0]);
  }
  assert.ok(!/\.(niveau|arbitrage|evol|total)[^{]*\{[^}]*(?:piste|boutique|fdj)/.test(css));
});

t('« Hypothèse » : contour pointillé ambre, fond transparent, libellé gardé', () => {
  assert.ok(/\.niveau\.hypothese\{[^}]*background:transparent[^}]*border:1px dotted var\(--t-amber\)/.test(css));
  assert.ok(/class="niveau hypothese">Hypothèse</.test(sansScripts));
});

t('« En attente d\'arbitrage » : horloge ◷ avant chaque ligne d\'attente', () => {
  const lignes = [...sansScripts.matchAll(/<div class="arbitrage"[^>]*>([\s\S]*?)<\/div>/g)];
  assert.ok(lignes.length >= 8, 'lignes d\'attente : ' + lignes.length);
  for (const [, c] of lignes) {
    assert.ok(/^<span class="attente-ico" aria-hidden="true">◷<\/span>/.test(c), 'sans horloge : ' + c);
    assert.ok(c.length > 20);
  }
  assert.ok(!/en attente d'arbitrage|\(G\d\)/i.test(sansScripts), 'code ou ancien libellé visible');
});

t('signature complète aussi sur .colonne.act et .tuile.act (spécificité relevée)', () => {
  const m = css.match(/\.act, \.colonne\.act, \.tuile\.act\{([^}]*)\}/);
  assert.ok(m, 'règle de signature non relevée en spécificité');
  assert.ok(/border:1px solid rgba\(var\(--c-rgb\), var\(--a-bord\)\)/.test(m[1]), 'bordure teintée');
  assert.ok(/border-top:3px solid rgb\(var\(--c-rgb\)\)/.test(m[1]), 'trait 3 px');
  assert.ok(/radial-gradient\(circle at 0 0, rgba\(var\(--c-rgb\), var\(--a-glow\)\)/.test(m[1]), 'lueur');
  // aucune règle .colonne{...} / .tuile{...} ultérieure ne doit repasser sur border/background sans la spécificité de .act
  assert.ok(/class="tuile act a-piste"/.test(sansScripts), 'tuile simple Piste');
  assert.ok((sansScripts.match(/class="colonne act a-(piste|boutique|fdj)"/g) || []).length === 3);
});

t('.evol : classe attente-g5 dans le balisage, horloge par CSS, JS intact', () => {
  assert.strictEqual((sansScripts.match(/<div class="evol attente-g5">/g) || []).length, 3);
  assert.ok(/\.attente-g5::before\{content:"◷ ";\}/.test(css));
});

t('valeur principale des indicateurs : 32 px gras quand mesurée, 15 px pour les états vides', () => {
  assert.ok(/\.valeur \.nb\{[^}]*font-size:32px;[^}]*font-weight:700/.test(css));
  assert.ok(/\n\.valeur\{[^}]*font-size:15px/.test(css), 'état vide à 15 px');
});

t('flèche des analyses : toujours cyan NEXUS', () => {
  assert.ok(/\.fleche\{[^}]*color:var\(--t-cyan\)/.test(css));
});

t('le JS de la page est inchangé (empreinte du bloc script)', () => {
  const h = crypto.createHash('sha256').update(scripts).digest('hex');
  assert.strictEqual(h, 'b8cfd39dcf95b64d8486e54115ef1e3f6955bceeaa25c3ddfd8d272d71d36fb1');
});

t('nexus-tempo.js intact (aucune référence aux classes de signature)', () => {
  const j = fs.readFileSync(path.join(racine, 'nexus-tempo.js'), 'utf8');
  assert.ok(!/a-piste|a-boutique|a-fdj|pastille/.test(j));
});

console.log(echecs ? '\n' + echecs + ' échec(s)' : '\nTout est vert');
process.exit(echecs ? 1 : 0);
