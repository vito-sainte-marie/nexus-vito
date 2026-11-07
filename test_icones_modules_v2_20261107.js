// Icônes de modules v2 (kit « nexus-icones-modules-v1.1 », 07/11/2026) : 8 modules, un registre unique
// (nexus-icones.js), 4 surfaces + tuiles employé. ICONES_V2 = false rend chaque surface identique à avant.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }
const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
function garde(nom, src, regle, litteral, remplacement) {
  t(nom, () => {
    assert.ok(regle(src), 'la garde doit passer sur la source');
    assert.ok(src.indexOf(litteral) >= 0, 'littéral introuvable : ' + litteral);
    assert.ok(!regle(src.replace(litteral, remplacement)), 'la garde doit rougir sur la source mutée');
  });
}
const IDS = ['mod-verify', 'mod-inventaire', 'mod-controle-inventaire', 'mod-fdj', 'mod-missions', 'mod-planning', 'mod-paye', 'mod-carburants'];
const SRC = lire('nexus-icones.js');
function charger(src) { const ctx = { window: undefined }; ctx.globalThis = ctx; vm.runInNewContext(src, ctx); return ctx.NexusIcones; }

// ---- Le kit ----
t('les 8 identifiants ont leurs 6 fichiers, aux bonnes tailles', () => {
  IDS.forEach(id => {
    ['.svg', '@1x.webp', '@2x.webp', '@3x.webp', '-24.svg', '-24.png'].forEach(suf => {
      const f = path.join(__dirname, 'assets/icones/v2', id, id + suf);
      assert.ok(fs.existsSync(f), 'manquant : ' + f);
    });
    const taille = suf => fs.statSync(path.join(__dirname, 'assets/icones/v2', id, id + suf)).size;
    assert.ok(taille('@2x.webp') <= 15 * 1024, id + ' @2x > 15 Ko');
    assert.ok(taille('@3x.webp') <= 25 * 1024, id + ' @3x > 25 Ko');
  });
});
t('Paye € n\'est plus en #EAF7FA, et les ids des -24.svg sont suffixés', () => {
  IDS.forEach(id => {
    const d = fs.readFileSync(path.join(__dirname, 'assets/icones/v2', id, id + '.svg'), 'utf8');
    const d24 = fs.readFileSync(path.join(__dirname, 'assets/icones/v2', id, id + '-24.svg'), 'utf8');
    if (id === 'mod-paye') { /* grand SVG : le € n'est plus tracé en #EAF7FA (il restait dans les stops du reflet, opacité .36) et utilise #10354A.
       Le -24.svg est un pictogramme en trait clair sur tuile sombre : son € clair y reste lisible, il n'est pas visé. */
      assert.ok(!/(fill|stroke)="#EAF7FA"/i.test(d)); assert.ok(/stroke="#10354A"/i.test(d)); assert.ok(/#10354A/i.test(d24)); }
    const ids24 = (d24.match(/\bid="([^"]+)"/g) || []).map(x => x.slice(4, -1));
    ids24.forEach(i => assert.ok(/-24(-|$)/.test(i), id + ' : id non suffixé ' + i));
  });
});
t('le README du kit est rangé', () => assert.ok(fs.existsSync(path.join(__dirname, 'assets/icones/v2/LISEZMOI.txt'))));

// ---- Le registre ----
const R = charger(SRC);
t('ICONES_V2 est vrai ; 8 modules, chacun avec un libellé accessible', () => {
  assert.strictEqual(R.ICONES_V2, true);
  assert.deepStrictEqual(Object.keys(R.MODULES).sort(), IDS.slice().sort());
  IDS.forEach(id => assert.ok(R.MODULES[id].libelle));
});
t('jusqu\'à 24 px : version simplifiée ; au-delà : détaillée en srcset 1x/2x/3x', () => {
  IDS.forEach(id => {
    const p = R.chemins(id);
    ['detail1x', 'detail2x', 'detail3x', 'simplifie'].forEach(k => assert.ok(fs.existsSync(path.join(__dirname, p[k])), p[k]));
    const petit = R.img(id, 16, { decoratif: true });
    assert.ok(petit.includes('src="' + p.simplifie + '"') && !petit.includes('srcset'));
    assert.ok(R.img(id, 24).includes(p.simplifie));
    const grand = R.img(id, 34, { decoratif: true });
    assert.ok(grand.includes('srcset="' + p.srcset + '"') && grand.includes('src="' + p.detail1x + '"'));
  });
});
t('décoratif : alt vide et aria-hidden ; sinon alt = libellé accessible', () => {
  assert.ok(/alt="" aria-hidden="true"/.test(R.img('mod-fdj', 20, { decoratif: true })));
  assert.ok(R.img('mod-fdj', 20).includes('alt="FDJ"') && !R.img('mod-fdj', 20).includes('aria-hidden'));
  assert.ok(R.img('mod-controle-inventaire', 20).includes('alt="Contrôle inventaire"'));
});
t('Verify : aucun filtre ni style dans le rendu du registre', () => {
  assert.ok(!/filter|style=/.test(R.img('mod-verify', 20, { decoratif: true })));
});
t('Contrôle inventaire n\'a plus l\'icône d\'Inventaire', () => {
  assert.notStrictEqual(R.chemins('mod-controle-inventaire').simplifie, R.chemins('mod-inventaire').simplifie);
});
t('ICONES_V2 = false : img() rend l\'ancien balisage, appliquer() ne touche à rien', () => {
  const F = charger(SRC.replace('const ICONES_V2 = true;', 'const ICONES_V2 = false;'));
  assert.strictEqual(F.ICONES_V2, false);
  assert.strictEqual(F.img('mod-paye', 34, { ancien: '<img src="ancien.png">' }), '<img src="ancien.png">');
  assert.strictEqual(F.img('mod-paye', 34), '');
  assert.strictEqual(F.appliquer({ querySelectorAll() { throw new Error('ne doit rien parcourir'); } }), 0);
});
t('appliquer() : remplace l\'image, retire le style (filtre) ; remplace l\'emoji d\'un conteneur', () => {
  const mk = (tag, id, taille) => { const at = { 'data-nexus-icone': id, 'data-nexus-taille': String(taille), 'data-nexus-decoratif': '1', style: 'filter:sepia(1)' };
    return { tagName: tag, innerHTML: '⛽', getAttribute: k => at[k], setAttribute: (k, v) => { at[k] = v; }, removeAttribute: k => { delete at[k]; }, at }; };
  const a = mk('IMG', 'mod-verify', 34), b = mk('DIV', 'mod-carburants', 34);
  const nb = R.appliquer({ querySelectorAll: () => [a, b] });
  assert.strictEqual(nb, 2);
  assert.ok(a.at.src.includes('mod-verify') && !('style' in a.at));
  assert.ok(b.innerHTML.includes('mod-carburants') && !b.innerHTML.includes('⛽') && !('style' in b.at));
});

// ---- Les surfaces ----
const APP = lire('NEXUS-App-v1.html'), DESK = lire('nexus-desktop.js'), CAT = lire('nexus-raccourcis-catalogue.js');
const DOC = lire('NEXUS-Documentation-v1.html'), PAR = lire('NEXUS-Parametres-Station-v1.html');
t('barre d\'accueil : les 8 modules portent leur identifiant', () => {
  IDS.forEach(id => assert.ok(APP.includes('data-nexus-icone="' + id + '"'), id));
});
t('menu bureau : Verify, Carburants, Inventaire, Contrôle inventaire, FDJ, Missions, Planning, Paye', () => {
  [['Verify', 'mod-verify'], ['Carburants', 'mod-carburants'], ['Inventaire', 'mod-inventaire'], ['Contrôle inventaire', 'mod-controle-inventaire'],
   ['FDJ', 'mod-fdj'], ['Missions', 'mod-missions'], ['Planning', 'mod-planning'], ['Paye', 'mod-paye']].forEach(([l, id]) =>
    assert.ok(DESK.includes("label: '" + l + "', module: '" + id + "'"), l));
});
t('menu bureau : FDJ Opérations/Performance, Carburants Performance, Réception carburant ne changent pas', () => {
  ['FDJ Opérations', 'FDJ Performance', 'Performance carburants', 'Réception carburant'].forEach(l => {
    const m = DESK.match(new RegExp("label: '" + l + "'[^\\n]*")); if (m) assert.ok(!/module:/.test(m[0]), l);
  });
});
t('raccourcis : Verify, Carburants, Missions, Contrôle inventaire portent un module', () => {
  [['Verify', 'mod-verify'], ['Carburants', 'mod-carburants'], ['Missions', 'mod-missions'], ['Contrôle inventaire', 'mod-controle-inventaire']].forEach(([l, id]) =>
    assert.ok(CAT.includes("label: '" + l + "', module: '" + id + "'"), l));
  assert.strictEqual((CAT.match(/module:/g) || []).length, 4);
});
t('tuiles employé : Missions, Inventaire, FDJ, Mon planning ; Relevés et Réception inchangés', () => {
  [['Missions', 'mod-missions'], ['Inventaire', 'mod-inventaire'], ['FDJ', 'mod-fdj'], ['Mon planning', 'mod-planning']].forEach(([l, id]) =>
    assert.ok(new RegExp("titre: '" + l + "'[^\\n]*module: '" + id + "'").test(APP), l));
  ['Relevés d’index', 'Réception'].forEach(l => assert.ok(!new RegExp("titre: '" + l + "'[^\\n]*module:").test(APP), l));
});
t('Documentation : 7 entrées (Planning deux fois), Carburants et Paye absents', () => {
  assert.strictEqual((DOC.match(/id: '[^']+', module: 'mod-/g) || []).length, 7);
  ['controle-fdj', 'tracabilite', 'assignations'].forEach(i => assert.ok(!new RegExp("id: '" + i + "', module:").test(DOC), i));
});
t('les écrans passent par le registre : barre d\'accueil, raccourcis (accueil et Paramètres), tuiles, bureau, Documentation', () => {
  assert.ok(/NexusIcones\.img\(cat\.module, 20/.test(APP) && /NexusIcones\.img\(t\.module, 19/.test(APP));
  assert.ok(/NexusIcones\.img\(cat\.module, 18/.test(PAR));
  assert.ok(/NexusIcones\.img\(item\.module, 16/.test(DESK));
  assert.ok(/NexusIcones\.img\(m\.module, taille/.test(DOC));
});
t('toute page qui charge nexus-desktop.js charge d\'abord nexus-icones.js', () => {
  const pages = fs.readdirSync(__dirname).filter(f => /\.html$/.test(f));
  let vues = 0;
  pages.forEach(f => {
    const h = lire(f); const d = h.search(/<script src="nexus-desktop\.js/); if (d < 0) return;
    vues++; const i = h.search(/<script src="nexus-icones\.js/);
    assert.ok(i >= 0 && i < d, f);
  });
  assert.ok(vues >= 40);
});
t('les lignes « valeur métier » à emoji ne sont pas touchées', () => {
  ['🔥 À AGIR', '🟡 À SURVEILLER', '📈 OPPORTUNITÉ'].forEach(e => assert.ok(APP.includes(e), e));
});
t('aucun filtre ne subsiste côté Verify une fois le registre appliqué', () => {
  assert.ok(/data-nexus-icone="mod-verify"[^>]*style="filter/.test(APP), 'l\'ancien filtre reste dans la source (retour arrière)');
  assert.ok(/removeAttribute\('style'\)/.test(SRC));
});

// ---- Gardes ----
garde('barre d\'accueil : Paye porte son module', APP, h => /data-nexus-icone="mod-paye"/.test(h), 'data-nexus-icone="mod-paye"', 'data-x="mod-paye"');
garde('le bureau passe par le registre', DESK, h => /NexusIcones\.img\(item\.module, 16/.test(h), 'NexusIcones.img(item.module, 16', 'NexusIcones.img(item.autre, 16');
garde('appliquer retire le style', SRC, h => /el\.removeAttribute\('style'\)/.test(h), "el.removeAttribute('style')", '');
garde('le retour arrière existe', SRC, h => /const ICONES_V2 = true;/.test(h) && /if \(!ICONES_V2\) return 0;/.test(h), 'if (!ICONES_V2) return 0;', '');
garde('le seuil du simplifié est 24 px', SRC, h => /SEUIL_SIMPLIFIE = 24/.test(h), 'SEUIL_SIMPLIFIE = 24', 'SEUIL_SIMPLIFIE = 0');

console.log(n + ' épreuves OK');
