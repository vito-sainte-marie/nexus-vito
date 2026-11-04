// Épreuve — 04/11/2026, slogan sur la photo et fondu enchaîné Jour <-> Sombre (Guardian #160 6628368788).
// Présentation seulement : le texte du slogan est toujours écrit par le même code (#taglineTexte).
// Structure : toujours exécutée. Comportement et contraste : Playwright (absent de la CI -> « NON EXÉCUTÉE », jamais « passed »).
const fs = require('fs'); const path = require('path'); const assert = require('assert');
const APP = fs.readFileSync(path.join(__dirname, 'NEXUS-App-v1.html'), 'utf8');
const M = 'body:has(.am-marqueur)';
const code = (src) => { const i = src.indexOf('const SITES_BANNIERE_VITO'); const j = src.indexOf("const hote = document.getElementById('prisePosteHote');", i); return src.slice(i, j); };

const STRUCTURE = {
  'le slogan reste UN élément (#taglineRole), déplacé et non copié': (s) => {
    assert.strictEqual((s.match(/id="taglineRole"/g) || []).length, 1);
    assert.strictEqual((s.match(/id="taglineTexte"/g) || []).length, 1);
    assert(code(s).includes('ban.appendChild(s)') && !/cloneNode|createElement\('div'\)/.test(code(s).split('function sloganSurPhoto')[1].split('\n  }')[0]));
    const i = s.indexOf('function renderPrisePoste('); const j = s.indexOf("if (typeof NexusPriseDePoste === 'undefined')", i);
    assert(/sloganSurPhoto\(\);\s*return;/.test(s.slice(i, j)), 'posé sur la photo après le rendu manager');
    assert(/if \(!hote\) return;\s*sloganDansEntete\(\);/.test(s.slice(i, j)), 'remis dans l’en-tête avant de remplacer le HTML');
  },
  'si la photo échoue, le slogan retourne dans l’en-tête avant le retrait': (s) => {
    const h = new Function('APERCU_BANNIERE_DEMANDE', 'FUSEAU_STATION', 'document', 'MutationObserver', code(s) + '; return banniereAccueilHtml("vito-sainte-marie");')(false, null, { documentElement: { getAttribute: () => 'sombre' }, querySelectorAll: () => [] }, function () { this.observe = () => {}; });
    assert(/onerror="[^"]*insertBefore\(s,i\)[^"]*this\.parentNode\.remove\(\)"/.test(h));
  },
  'CSS : en bas à gauche, gras, italique, ombre, dégradé sombre, points figés si mouvement réduit': (s) => {
    const css = s.slice(s.indexOf('/* Accueil du dirigeant, V1 visuelle'), s.indexOf('.section-tag{font-family:var(--mono)')).replace(/\/\*[\s\S]*?\*\//g, '');
    const r = css.match(/body:has\(\.am-marqueur\) \.am-banniere #taglineRole,\s*body\.nexus-desktop:has\(\.am-marqueur\) \.am-banniere #taglineRole\{([^}]*)\}/);
    assert(r, 'règle du slogan sur la photo');
    for (const k of [/position:absolute/, /left:\d+px/, /bottom:\d+px/, /font-weight:700/, /font-style:italic/, /text-shadow:/, /color:white/]) assert(k.test(r[1]), String(k));
    assert(new RegExp('\\' + 'bbody:has\\(\\.am-marqueur\\) \\.am-banniere::after\\{[^}]*linear-gradient\\(to top').test(css));
    assert(/@media \(prefers-reduced-motion:reduce\)\{\s*body:has\(\.am-marqueur\) \.dots-anim i\{animation:none;\}/.test(css));
    assert(/\.am-banniere img\.am-fondu\{opacity:0; transition:opacity 800ms/.test(css));
  },
  'fondu : préchargement, nouvelle image au-dessus, ancienne retirée à la fin, mouvement réduit immédiat': (s) => {
    const c = code(s);
    assert(c.includes('const FONDU_MS = 800;') && c.includes('new Image()') && c.includes("insertAdjacentElement('afterend', n)"));
    assert(c.includes('actuelle.remove()') && !c.includes('matchMedia'), 'renderPrisePoste ne consulte pas matchMedia : le mouvement réduit relève du CSS');
    assert(/prefers-reduced-motion:reduce\)\{[^]*img\.am-fondu\{transition:none;\}/.test(s.slice(s.indexOf('/* Accueil du dirigeant, V1 visuelle'), s.indexOf('.section-tag{font-family:var(--mono)'))), 'mouvement réduit : transition nulle');
    assert(/pre\.onload = function/.test(c) && !/pre\.onerror/.test(c), 'échec du préchargement : l’ancienne reste');
    assert(c.includes('changerPhotoBanniere(photoAccueilNuit())'));
  },
};
const MUT_STRUCT = {
  'le slogan reste UN élément (#taglineRole), déplacé et non copié': (s) => s.replace('sloganSurPhoto();\n      return;', 'return;'),
  'si la photo échoue, le slogan retourne dans l’en-tête avant le retrait': (s) => s.replace('i.parentNode.insertBefore(s,i);', ''),
  'CSS : en bas à gauche, gras, italique, ombre, dégradé sombre, points figés si mouvement réduit': (s) => s.replace('font-weight:700; font-style:italic; color:white;', 'font-weight:400; font-style:italic; color:white;'),
  'fondu : préchargement, nouvelle image au-dessus, ancienne retirée à la fin, mouvement réduit immédiat': (s) => s.replace('const FONDU_MS = 800;', 'const FONDU_MS = 0;'),
};

// ---- Comportement réel (Playwright) : le vrai CSS, le vrai JS de la page, scripts retirés puis le bloc extrait injecté.
const BASE = 'http://nexus.local/';
const page = (src) => {
  let s = src.replace(/<script\b[\s\S]*?<\/script>/g, '');
  s = s.replace('<html', '<html data-theme="sombre"').replace('<head>', '<head><base href="' + BASE + '">');
  s = s.replace(/(id="sessionInfo"[^>]*>)/, '$1Bonjour Frédéric');
  s = s.replace(/(id="prisePosteHote"[^>]*>)/, '$1');
  const js = '(function(){const APERCU_BANNIERE_DEMANDE=false, FUSEAU_STATION=null;' + code(src)
    + ';window.__t={changerPhotoBanniere,sloganSurPhoto,sloganDansEntete,banniereAccueilHtml};})();';
  return s.replace('</body>', '<script>' + js + '</script></body>');
};
const ouvrir = () => { try { return require('playwright'); } catch (e) { try { return require(path.join(process.env.PLAYWRIGHT_DIR || '', 'node_modules', 'playwright')); } catch (e2) { return null; } } };
const lum = (r, g, b) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };

async function comportement(src) {
  const pw = ouvrir(); if (!pw) return { saute: 'Playwright absent' };
  let b; try { b = await pw.chromium.launch(process.env.CHR ? { executablePath: process.env.CHR } : {}); } catch (e) { return { saute: 'Chromium indisponible' }; }
  const echecs = []; const ct = {}; const ko = (m) => echecs.push(m);
  try {
    const nouveau = async (w, opts) => {
      const ctx = await b.newContext({ viewport: { width: w, height: 800 }, ...(opts || {}) });
      const p = await ctx.newPage(); const reqs = [];
      await p.route(BASE + '**', async (route) => {
        const u = new URL(route.request().url());
        if (u.pathname === '/') return route.fulfill({ contentType: 'text/html', body: p.__html });
        reqs.push(u.pathname);
        try { return await route.fulfill({ contentType: 'image/webp', body: fs.readFileSync(path.join(__dirname, u.pathname)) }); } catch (e) { return route.abort(); }
      });
      p.__reqs = reqs; p.__html = page(src);
      await p.goto(BASE, { waitUntil: 'load' });
      return { ctx, p };
    };
    const monter = (p, avec) => p.evaluate((avec) => {
      const h = document.getElementById('prisePosteHote');
      document.body.classList.remove('accueil-attente');
      window.__t.sloganDansEntete();
      h.innerHTML = '<span class="am-marqueur" hidden></span>' + (avec ? window.__t.banniereAccueilHtml('vito-sainte-marie') : '');
      window.__t.sloganSurPhoto();
    }, avec);
    // 1. Slogan dans la bannière, un seul élément ; une seule image au chargement.
    {
      const { ctx, p } = await nouveau(375); await monter(p, true); await p.waitForTimeout(500);
      const r = await p.evaluate(() => {
        const ban = document.querySelector('.am-banniere'), s = document.getElementById('taglineRole'), br = ban.getBoundingClientRect(), sr = s.getBoundingClientRect(), cs = getComputedStyle(s);
        return { dansBan: s.parentNode === ban, uns: document.querySelectorAll('#taglineRole').length, unt: document.querySelectorAll('#taglineTexte').length, imgs: ban.querySelectorAll('img').length,
          gauche: sr.left - br.left, bas: br.bottom - sr.bottom, dedans: sr.left >= br.left && sr.right <= br.right + 0.5 && sr.top >= br.top && sr.bottom <= br.bottom + 0.5,
          poids: cs.fontWeight, style: cs.fontStyle, ombre: cs.textShadow !== 'none', degrade: /gradient/.test(getComputedStyle(ban, '::after').backgroundImage), h: br.height,
          anim: getComputedStyle(document.querySelector('.dots-anim i')).animationName, nom: document.getElementById('taglineTexte').textContent.length > 20 };
      });
      if (!r.dansBan || r.uns !== 1 || r.unt !== 1) ko('slogan : pas dans la bannière ou dupliqué ' + JSON.stringify([r.dansBan, r.uns, r.unt]));
      if (!r.dedans || r.gauche > 20 || r.bas > 20) ko('slogan : pas en bas à gauche, contenu dans la photo ' + JSON.stringify([r.gauche, r.bas, r.dedans]));
      if (+r.poids < 700 || r.style !== 'italic' || !r.ombre || !r.degrade) ko('slogan : gras/italique/ombre/dégradé ' + JSON.stringify(r));
      if (r.anim !== 'dotsBounce') ko('points : animation perdue (' + r.anim + ')');
      if (r.imgs !== 1) ko('une seule <img> attendue au chargement, ' + r.imgs);
      const photos = p.__reqs.filter((x) => /accueil-station-vito/.test(x));
      if (photos.length !== 1) ko('une seule image téléchargée au chargement, ' + photos.length + ' : ' + photos.join(','));
      ct.h = r.h; ct.p = p;
      // Sans bannière : le slogan reste dans l'en-tête, un seul exemplaire.
      await monter(p, false);
      const r2 = await p.evaluate(() => { const s = document.getElementById('taglineRole'); return { header: !!s.closest('.header'), n: document.querySelectorAll('#taglineTexte').length }; });
      if (!r2.header || r2.n !== 1) ko('sans bannière : le slogan doit rester dans l’en-tête ' + JSON.stringify(r2));
      // Image en échec : bannière retirée, slogan de retour dans l'en-tête.
      await monter(p, true);
      await p.evaluate(() => document.querySelector('.am-banniere img').dispatchEvent(new Event('error')));
      const r3 = await p.evaluate(() => ({ ban: !!document.querySelector('.am-banniere'), header: !!document.getElementById('taglineRole').closest('.header') }));
      if (r3.ban || !r3.header) ko('image en échec : bannière retirée et slogan dans l’en-tête ' + JSON.stringify(r3));
      await ctx.close();
    }
    // 2. Fondu enchaîné : pas de saut, deux images pendant le fondu, une seule après.
    {
      const { ctx, p } = await nouveau(375); await monter(p, true); await p.waitForTimeout(400);
      const avant = await p.evaluate(() => document.querySelector('.am-banniere').getBoundingClientRect().height);
      p.__reqs.length = 0;
      await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'jour'));
      await p.waitForTimeout(350);
      const m = await p.evaluate(() => { const ban = document.querySelector('.am-banniere'), im = [...ban.querySelectorAll('img')]; return { n: im.length, h: ban.getBoundingClientRect().height, op: im.map((i) => +getComputedStyle(i).opacity), src: im.map((i) => i.getAttribute('src')) }; });
      if (m.n !== 2) ko('pendant le fondu : deux images attendues (ancienne dessous, nouvelle dessus), ' + m.n);
      else if (!(m.op[0] === 1 && m.op[1] > 0 && m.op[1] < 1)) ko('pendant le fondu : opacité de la nouvelle image attendue entre 0 et 1 ' + JSON.stringify(m.op));
      else if (/nuit/.test(m.src[1]) || !/nuit/.test(m.src[0])) ko('pendant le fondu : l’ancienne (nuit) dessous, la nouvelle (jour) dessus ' + JSON.stringify(m.src));
      if (Math.abs(m.h - avant) > 0.5) ko('saut de hauteur pendant le fondu ' + avant + ' -> ' + m.h);
      await p.waitForTimeout(900);
      const f = await p.evaluate(() => { const ban = document.querySelector('.am-banniere'), im = [...ban.querySelectorAll('img')]; return { n: im.length, h: ban.getBoundingClientRect().height, src: im.map((i) => i.getAttribute('src')), cls: im.map((i) => i.className), op: im.map((i) => +getComputedStyle(i).opacity) }; });
      if (f.n !== 1 || /nuit/.test(f.src[0]) || f.cls[0] || f.op[0] !== 1) ko('après le fondu : une seule <img> (jour, sans classe de fondu, opaque) attendue ' + JSON.stringify(f));
      if (Math.abs(f.h - avant) > 0.5) ko('saut de hauteur après le fondu');
      const tel = p.__reqs.filter((x) => /accueil-station-vito/.test(x));
      if (tel.length < 1 || tel.length > 1) ko('le changement de thème doit télécharger une seule image, ' + tel.length + ' : ' + tel.join(','));
      // Aller-retour rapide : jamais plus d'une image au repos.
      await p.evaluate(() => { document.documentElement.setAttribute('data-theme', 'sombre'); });
      await p.waitForTimeout(100);
      await p.evaluate(() => { document.documentElement.setAttribute('data-theme', 'jour'); });
      await p.waitForTimeout(1300);
      const g = await p.evaluate(() => ({ n: document.querySelectorAll('.am-banniere img').length, s: document.querySelector('.am-banniere img').getAttribute('src') }));
      if (g.n !== 1 || /nuit/.test(g.s)) ko('aller-retour rapide : une seule image, celle du thème actif ' + JSON.stringify(g));
      await ctx.close();
    }
    // 3. Mouvement réduit : changement immédiat, points figés.
    {
      const { ctx, p } = await nouveau(375, { reducedMotion: 'reduce' }); await monter(p, true); await p.waitForTimeout(300);
      await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'jour'));
      await p.waitForTimeout(150);
      const r = await p.evaluate(() => ({ n: 1, o: getComputedStyle([...document.querySelectorAll('.am-banniere img')].pop()).opacity, s: [...document.querySelectorAll('.am-banniere img')].pop().getAttribute('src'), anim: getComputedStyle(document.querySelector('.dots-anim i')).animationName }));
      if (r.o !== '1' || /nuit/.test(r.s)) ko('mouvement réduit : changement immédiat, sans opacité intermédiaire ' + JSON.stringify(r));
      if (r.anim !== 'none') ko('mouvement réduit : les points doivent rester fixes (' + r.anim + ')');
      await ctx.close();
    }
    // 3b. Taille choisie : téléphone 375 px à DPR 3 -> 1200 (335 px x 3 = 1005), jamais le 1600 ; bureau 1100 px @DPR1 -> 1200, @DPR2 -> 1600.
    // Le `sizes` suit la VUE : la colonne mobile d'un ordinateur (1440 px, ~476 px affichés) à DPR 2 -> 1200, pas 1600.
    for (const [w, dpr, attendu, bureau] of [[375, 3, '-1200.webp', false], [1440, 1, '-1200.webp', true], [1440, 2, '-1600.webp', true], [1440, 2, '-1200.webp', false]]) {
      const { ctx, p } = await nouveau(w, { deviceScaleFactor: dpr });
      await p.evaluate((bu) => { if (bu) document.body.classList.add('nexus-desktop'); }, bureau);
      await monter(p, true);
      await p.waitForFunction(() => { const i = document.querySelector('.am-banniere img'); return i && i.complete && i.currentSrc; }, null, { timeout: 5000 }).catch(() => {});
      const cs = await p.evaluate(() => (document.querySelector('.am-banniere img') || {}).currentSrc || '');
      if (!cs.endsWith(attendu)) ko('taille de photo : ' + w + ' px @DPR' + dpr + ' devrait charger ' + attendu + ', a chargé ' + cs);
      const fs17 = await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.am-banniere #taglineRole')).fontSize));
      if (bureau && (fs17 < 16 || fs17 > 18)) ko('slogan en vue bureau : ' + fs17 + ' px, attendu 16 à 18');
      if (!bureau && fs17 !== 12) ko('slogan en vue mobile : ' + fs17 + ' px, attendu 12 (inchangé)');
      await ctx.close();
    }
    // 4. Contraste AA du texte blanc sur les zones les plus claires de chaque photo (ombre ignorée : cas le plus sévère).
    const cr = [];
    await Promise.all([['jour', 375, false], ['sombre', 375, false], ['jour', 1440, true], ['sombre', 1440, true]].map(async ([theme, w, bureau], idx) => {
      const { ctx, p } = await nouveau(w); await p.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      await p.evaluate((bu) => { if (bu) document.body.classList.add('nexus-desktop'); }, bureau);
      await monter(p, true); await p.waitForTimeout(600);
      const rect = await p.evaluate(() => { const s = document.getElementById('taglineRole'); s.style.visibility = 'hidden'; const r = s.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
      const png = await p.screenshot({ clip: rect });
      const pix = await p.evaluate(async (b64) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data; const L = []; for (let i = 0; i < d.length; i += 4) L.push([d[i], d[i + 1], d[i + 2]]); return L; }, png.toString('base64'));
      const ls = pix.map((q) => lum(q[0], q[1], q[2])).sort((a, c) => a - c);
      const pire = ls[ls.length - 1], p99 = ls[Math.floor(ls.length * 0.99)];
      const rap = (1.05) / (pire + 0.05), rap99 = 1.05 / (p99 + 0.05);
      cr[idx] = (theme + '/' + w + ' pire pixel ' + rap.toFixed(2) + ':1 (99e centile ' + rap99.toFixed(2) + ':1)');
      if (rap99 < 4.5) ko('contraste AA insuffisant (' + theme + ', ' + w + ') : ' + rap99.toFixed(2) + ':1 au 99e centile sous le texte (pire pixel ' + rap.toFixed(2) + ':1)');
      await ctx.close();
        }));
    ct.contraste = cr;
  } finally { await b.close(); }
  return { echecs, ct };
}

(async () => {
  let ko = 0;
  for (const [nom, f] of Object.entries(STRUCTURE)) {
    try { f(APP); } catch (e) { ko++; console.log('✗ ' + nom + ' — ' + e.message); continue; }
    let mord = false; try { f(MUT_STRUCT[nom](APP)); } catch (e) { mord = true; }
    if (!mord) { ko++; console.log('✗ ' + nom + ' — la mutation ne la fait pas rougir'); continue; }
    console.log('✓ ' + nom);
  }
  const MUTS = {
    'slogan hors de la photo (plus en position absolue)': (s) => s.replace('display:block; position:absolute; left:14px; right:14px; bottom:10px;', 'display:block; position:static;'),
    'pas de fondu (échange direct)': (s) => s.replace(/function changerPhotoBanniere\(nuit\) \{/, 'function changerPhotoBanniere(nuit) { document.querySelectorAll(".am-banniere img").forEach(function(i){var b=baseBanniere(nuit);i.setAttribute("srcset",b+"-800.webp 800w, "+b+"-1600.webp 1600w");i.setAttribute("src",b+"-800.webp");}); return;'),
    'ancienne image jamais retirée': (s) => s.replace('actuelle.remove();', ''),
    'plus de dégradé : le texte blanc sur la photo claire': (s) => s.replace('color-mix(in srgb, black 90%, transparent), color-mix(in srgb, black 70%, transparent) 40%, transparent)', 'transparent, transparent)'),
  };
  const [g, ...rs] = await Promise.all([comportement(APP), ...Object.entries(MUTS).map(([, m]) => comportement(m(APP)))]);
  const noms = Object.keys(MUTS);
  if (g.saute) console.log('⚠ comportement du slogan, fondu et contraste : NON EXÉCUTÉ (' + g.saute + ') — rien n’a été mesuré ici.');
  else {
    if (g.echecs.length) { ko++; g.echecs.forEach((e) => console.log('✗ ' + e)); }
    else console.log('✓ comportement réel : slogan dans la bannière (un seul), fondu ~800 ms sans saut, une seule image au repos et au chargement, mouvement réduit, AA — ' + g.ct.contraste.join(' ; '));
    for (let k = 0; k < rs.length; k++) {
      const nom = noms[k], r = rs[k];
      if (r.saute || !r.echecs.length) { ko++; console.log('✗ le comportement ne mord pas : ' + nom); } else console.log('✓ mord : ' + nom + ' (' + r.echecs.length + ' échec(s))');
    }
  }
  if (ko) { console.log(ko + ' échec(s)'); process.exit(1); }
  console.log('Slogan sur la photo et fondu : ' + Object.keys(STRUCTURE).length + ' épreuves de structure' + (g.saute ? ', comportement non exécuté.' : ' + comportement réel.'));
})();
