// Épreuve — 04/11/2026, Accueil du dirigeant : en-tête et carte de service en mobile (Guardian #160 6627868012).
// Deux niveaux. (1) STRUCTURE, toujours exécutée : pile verticale, aucun position:absolute dans l'en-tête dirigeant,
// zones texte/image de la carte. (2) GÉOMÉTRIE à 375 px avec Playwright, si Playwright et un Chromium sont présents :
// getBoundingClientRect de chaque élément de l'en-tête, aucun chevauchement. Sans Playwright (tests.yml ne l'installe
// pas), le niveau 2 s'annonce « NON EXÉCUTÉ » — il ne se présente jamais comme réussi.
const fs = require('fs'); const path = require('path'); const assert = require('assert');
const APP = fs.readFileSync(path.join(__dirname, 'NEXUS-App-v1.html'), 'utf8');
const M = 'body:has(.am-marqueur)';
const bloc = (src) => src.slice(src.indexOf('/* Accueil du dirigeant, V1 visuelle'), src.indexOf('.section-tag{font-family:var(--mono)'));
const base = (src) => { const css = bloc(src); return css.slice(0, css.indexOf('@media (min-width:768px)')); };
const regle = (css, sel) => { const i = css.indexOf(M + ' ' + sel + '{'); assert(i >= 0, 'règle absente : ' + sel); return css.slice(i, css.indexOf('}', i)); };

const STRUCTURE = {
  'mobile : en-tête en une colonne, trois rangées empilées': (src) => {
    assert(/grid-template-columns:minmax\(0,1fr\);/.test(regle(base(src), '.header')));
    assert(/text-align:left/.test(regle(base(src), '#sessionInfo')) && /max-width:none/.test(regle(base(src), '#sessionInfo')));
    assert(/flex-wrap:nowrap/.test(regle(base(src), '.header-brandrow')));
  },
  'mobile : la station tient sur une ligne, sans déborder': (src) => {
    const r = regle(base(src), '.header-sitename');
    assert(/white-space:nowrap/.test(r) && /text-overflow:ellipsis/.test(r));
  },
  'aucun position:absolute ajouté dans l’en-tête dirigeant': (src) => {
    for (const m of bloc(src).matchAll(/([^{}]*)\{([^}]*)\}/g)) if (/\.header|#sessionInfo/.test(m[1])) assert(!/position\s*:\s*absolute/.test(m[2]), m[1]);
  },
  'le bouton ☰ n’est pas touché par le bloc dirigeant': (src) => { assert(!/menu-accueil-bouton/.test(bloc(src))); },
  'carte de service : texte dans ~55 %, image après lui, dégradé': (src) => {
    const b = base(src);
    assert(/max-width:55%/.test(regle(b, '.am-poste .ap-poste-texte')));
    assert(/width:45%/.test(regle(b, '.am-poste .ap-poste-image')));
    assert(/linear-gradient\(90deg,var\(--panel\)/.test(regle(b, '.am-poste::after')));
  },
};
const MUTANTS_STRUCTURE = {
  'mobile : en-tête en une colonne, trois rangées empilées': (s) => s.replace('grid-template-columns:minmax(0,1fr); align-items', 'grid-template-columns:minmax(0,1fr) auto; align-items'),
  'mobile : la station tient sur une ligne, sans déborder': (s) => s.replace('white-space:nowrap; overflow:hidden; text-overflow:ellipsis;', ''),
  'aucun position:absolute ajouté dans l’en-tête dirigeant': (s) => s.replace('text-align:left; font-size:12px; line-height:1.3;}', 'text-align:left; font-size:12px; line-height:1.3; position:absolute;}'),
  'le bouton ☰ n’est pas touché par le bloc dirigeant': (s) => s.replace(M + ' #taglineRole{display:none;}', M + ' .menu-accueil-bouton{top:11px;}\n  ' + M + ' #taglineRole{display:none;}'),
  'carte de service : texte dans ~55 %, image après lui, dégradé': (s) => s.replace('max-width:55%', 'max-width:60%'),
};

// Géométrie : la page réelle, scripts retirés, remplie comme le fait la branche manager.
const fixture = (src) => {
  let s = src.replace(/<script\b[\s\S]*?<\/script>/g, '');
  s = s.replace('<html', '<html data-theme="sombre"');
  s = s.replace(/(id="headerLive"[^>]*>)/, '$1Décisions recalculées à 05:54:01');
  s = s.replace(/(id="sessionInfo"[^>]*>)/, '$1Bonjour Frédéric · <a href="#">Se déconnecter</a>');
  s = s.replace(/(id="stationTitle"[^>]*>)[^<]*/, '$1NEXUS Station Test');
  s = s.replace('class="menu-accueil-bouton"', 'class="menu-accueil-bouton mm-pret"');
  const carte = '<span class="am-marqueur" hidden></span><a class="ap-poste am-poste" id="cheminService" href="#"><div class="ap-poste-texte"><div class="ap-poste-nom">Commencer mon service opérationnel</div></div><div class="ap-poste-image"></div></a>';
  return s.replace(/(id="prisePosteHote"[^>]*>)/, '$1' + carte);
};
const MESURE = () => {
  const sel = ['.menu-accueil-bouton', '.header-wordmark', '.header-mark', '.header-sitewrap', '.header-statut', '#headerLive', '#sessionInfo'];
  const rc = sel.map((s) => [s, document.querySelector(s)]).filter((x) => x[1]).map(([s, e]) => { const r = e.getBoundingClientRect(); return { s, l: r.left, t: r.top, r: r.right, b: r.bottom }; });
  const ov = [];
  for (let i = 0; i < rc.length; i++) for (let j = i + 1; j < rc.length; j++) { const a = rc[i], c = rc[j]; if (a.l < c.r - 1 && c.l < a.r - 1 && a.t < c.b - 1 && c.t < a.b - 1) ov.push(a.s + ' x ' + c.s); }
  const tx = document.querySelector('.am-poste .ap-poste-texte').getBoundingClientRect(); const im = document.querySelector('.am-poste .ap-poste-image').getBoundingClientRect();
  const nm = document.querySelector('.am-poste .ap-poste-nom').getBoundingClientRect(); const carte = document.querySelector('.am-poste').getBoundingClientRect();
  return { n: rc.length, ov, texteApresImage: tx.right > im.left + 1, nomDebordeCarte: nm.right > tx.right + 1 || nm.bottom > carte.bottom + 1, defileH: document.documentElement.scrollWidth > innerWidth };
};
const ouvrir = () => {
  let pw; try { pw = require('playwright'); } catch (e) { try { pw = require(path.join(process.env.PLAYWRIGHT_DIR || '', 'node_modules', 'playwright')); } catch (e2) { return null; } }
  return pw;
};
async function geometrie(src) {
  const pw = ouvrir(); if (!pw) return { saute: 'Playwright absent' };
  let b; try { b = await pw.chromium.launch(process.env.CHR ? { executablePath: process.env.CHR } : {}); } catch (e) { return { saute: 'Chromium indisponible' }; }
  const sorties = [];
  try {
    for (const w of [375, 320]) {
      const p = await b.newPage({ viewport: { width: w, height: 800 } });
      await p.setContent(fixture(src), { waitUntil: 'domcontentloaded' });
      sorties.push([w, await p.evaluate(MESURE)]); await p.close();
    }
  } finally { await b.close(); }
  return { sorties };
}
const verdict = (g) => { for (const [w, r] of g.sorties) { assert(r.n >= 6, w + ' px : éléments de l’en-tête introuvables (' + r.n + ')'); assert.deepStrictEqual(r.ov, [], w + ' px : chevauchement ' + r.ov.join(', ')); assert(!r.texteApresImage && !r.nomDebordeCarte && !r.defileH, w + ' px : carte ou page qui déborde'); } };

(async () => {
  let ko = 0;
  for (const [nom, f] of Object.entries(STRUCTURE)) {
    try { f(APP); } catch (e) { ko++; console.log('✗ ' + nom + ' — ' + e.message); continue; }
    const mut = MUTANTS_STRUCTURE[nom](APP); let mord = false;
    try { f(mut); } catch (e) { mord = true; }
    if (!mord) { ko++; console.log('✗ ' + nom + ' — la mutation ne la fait pas rougir'); continue; }
    console.log('✓ ' + nom);
  }
  const g = await geometrie(APP);
  if (g.saute) console.log('⚠ géométrie 375/320 px : NON EXÉCUTÉE (' + g.saute + ') — la garde des chevauchements n’a rien mesuré ici.');
  else {
    try { verdict(g); console.log('✓ géométrie 375 et 320 px : aucun chevauchement, carte contenue'); } catch (e) { ko++; console.log('✗ géométrie — ' + e.message); }
    const mut = await geometrie(APP.replace('header-statut-row{margin-top:10px;', 'header-statut-row{margin-top:0;'));
    let mord = false; try { verdict(mut); } catch (e) { mord = true; }
    if (!mord) { ko++; console.log('✗ géométrie — la mutation (rangée Connecté collée au ☰) ne la fait pas rougir'); } else console.log('✓ géométrie mord : rangée Connecté remontée sous le ☰ = rouge');
  }
  if (ko) { console.log(ko + ' échec(s)'); process.exit(1); }
  console.log('Accueil dirigeant mobile : ' + Object.keys(STRUCTURE).length + ' épreuves de structure' + (g.saute ? ', géométrie non exécutée.' : ' + géométrie.'));
})();
