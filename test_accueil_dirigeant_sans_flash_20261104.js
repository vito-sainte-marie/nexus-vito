// Épreuve — 04/11/2026, Accueil du dirigeant : aucun flash de l'ancienne mise en page au chargement (Guardian #160 6628455185).
// (1) STRUCTURE, toujours exécutée : l'attente masque tout l'en-tête (marque comprise) en gardant la place ; accueilPret()
//     n'est appelé qu'après renderPrisePoste (qui pose .am-marqueur) ; le filet de 8 s subsiste.
// (2) IMAGE PAR IMAGE avec Playwright : la page naît en attente, le marqueur est posé plus tard, puis l'attente est levée ;
//     à chaque image (requestAnimationFrame) l'en-tête visible a la mise en page finale. Sans Playwright : « NON EXÉCUTÉ ».
const fs = require('fs'); const path = require('path'); const assert = require('assert');
const APP = fs.readFileSync(path.join(__dirname, 'NEXUS-App-v1.html'), 'utf8');

const STRUCTURE = {
  'attente : tout l’en-tête, marque comprise, est invisible mais garde sa place': (src) => {
    assert(/body\.accueil-attente \.header > \*[^{]*\{visibility:hidden !important;\}/.test(src));
    assert(/body\.accueil-attente \.header-brandrow \*/.test(src) && /body\.accueil-attente \.menu-accueil-bouton/.test(src));
    assert(!/body\.accueil-attente[^{]*\{[^}]*display\s*:\s*none/.test(src), 'display:none libère la place et fait sauter la page');
  },
  'accueilPret() n’est appelé qu’après le rendu du poste': (src) => {
    const i = src.indexOf('renderPrisePoste(employee, serviceCourant, estNiveauManager);'); assert(i > 0);
    const j = src.indexOf('accueilPret();', i); assert(j > i, 'accueilPret doit suivre renderPrisePoste');
    assert(!src.slice(src.indexOf('function accueilPret()') + 60, i).includes('accueilPret();'), 'appel prématuré avant renderPrisePoste');
    assert(/setTimeout\(accueilPret, 8000\);/.test(src), 'filet de sécurité de 8 s');
  },
};
const MUTANTS = {
  'attente : tout l’en-tête, marque comprise, est invisible mais garde sa place': (s) => s.replace('body.accueil-attente .header > *, body.accueil-attente .header-brandrow *, body.accueil-attente .menu-accueil-bouton{visibility:hidden !important;}', ''),
  'accueilPret() n’est appelé qu’après le rendu du poste': (s) => s.replace('renderPrisePoste(employee, serviceCourant, estNiveauManager);', 'accueilPret(); renderPrisePoste(employee, serviceCourant, estNiveauManager);'),
};

const fixture = (src) => {
  let s = src.replace(/<script\b[\s\S]*?<\/script>/g, '');
  s = s.replace('<html', '<html data-theme="sombre"');
  s = s.replace(/(id="stationTitle"[^>]*>)[^<]*/, '$1NEXUS Station Test');
  s = s.replace('class="menu-accueil-bouton"', 'class="menu-accueil-bouton mm-pret"');
  return s;
};
const ouvrir = () => { let pw; try { pw = require('playwright'); } catch (e) { try { pw = require(path.join(process.env.PLAYWRIGHT_DIR || '', 'node_modules', 'playwright')); } catch (e2) { return null; } } return pw; };

// Scénario : page en attente (ancienne mise en page), 300 ms, pose du marqueur + carte, 300 ms, levée de l'attente.
const SCENARIO = async () => { try { await document.fonts.ready; } catch (e) {} // polices posées : la mesure vise la mise en page, pas l'échange de police
  return new Promise((resolve) => {
  const sig = () => ['.header-wordmark', '.header-mark', '.header-sitewrap', '.header-statut'].map((q) => { const r = document.querySelector(q).getBoundingClientRect(); return [q, Math.round(r.left), Math.round(r.top)].join(':'); }).join('|');
  const visible = () => getComputedStyle(document.querySelector('.header-brandrow')).visibility !== 'hidden' || getComputedStyle(document.querySelector('.header-wordmark')).visibility !== 'hidden';
  const frames = []; let fini = false;
  const tick = () => { frames.push({ vis: visible(), sig: sig(), marq: !!document.querySelector('.am-marqueur'), attente: document.body.classList.contains('accueil-attente') }); if (!fini) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  setTimeout(() => {
    document.getElementById('prisePosteHote').innerHTML = '<span class="am-marqueur" hidden></span><a class="ap-poste am-poste" href="#"><div class="ap-poste-texte"><div class="ap-poste-nom">Commencer mon service</div></div></a>';
    setTimeout(() => { document.body.classList.remove('accueil-attente'); setTimeout(() => { fini = true; resolve(frames); }, 300); }, 300);
  }, 300);
  });
};
async function images(src) {
  const pw = ouvrir(); if (!pw) return { saute: 'Playwright absent' };
  let b; try { b = await pw.chromium.launch(process.env.CHR ? { executablePath: process.env.CHR } : {}); } catch (e) { return { saute: 'Chromium indisponible' }; }
  const res = [];
  try {
    for (const [nom, w, bureau] of [['375', 375, false], ['colonne 520 dans 1440', 1440, false], ['bureau 1440', 1440, true]]) {
      const p = await b.newPage({ viewport: { width: w, height: 800 } });
      await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort()); // l’échange de police web (1 à 4 px) n’est pas la mise en page mesurée : police de secours stable
      await p.setContent(fixture(src), { waitUntil: 'domcontentloaded' });
      if (bureau) await p.evaluate(() => document.body.classList.add('nexus-desktop'));
      res.push([nom, await p.evaluate(SCENARIO)]); await p.close();
    }
  } finally { await b.close(); }
  return { res };
}
const verdict = (g) => {
  for (const [nom, frames] of g.res) {
    const fin = frames[frames.length - 1]; assert(fin.vis && !fin.attente && fin.marq, nom + ' : état final inattendu');
    const visibles = frames.filter((f) => f.vis); assert(visibles.length > 0, nom + ' : l’en-tête n’est jamais dévoilé');
    const faux = visibles.filter((f) => f.sig !== fin.sig);
    assert(faux.length === 0, nom + ' : ' + faux.length + ' image(s) montrent l’en-tête dans une mise en page différente de la finale');
    const avant = frames.filter((f) => !f.marq); assert(avant.length > 3 && avant.every((f) => !f.vis), nom + ' : l’en-tête est visible avant le marqueur');
  }
};

(async () => {
  let ko = 0;
  for (const [nom, f] of Object.entries(STRUCTURE)) {
    try { f(APP); } catch (e) { ko++; console.log('✗ ' + nom + ' — ' + e.message); continue; }
    let mord = false; try { f(MUTANTS[nom](APP)); } catch (e) { mord = true; }
    if (!mord) { ko++; console.log('✗ ' + nom + ' — la mutation ne la fait pas rougir'); continue; }
    console.log('✓ ' + nom);
  }
  const [g, m] = await Promise.all([images(APP), images(APP.replace('body.accueil-attente .header > *, body.accueil-attente .header-brandrow *, body.accueil-attente .menu-accueil-bouton{visibility:hidden !important;}', ''))]);
  if (g.saute) console.log('⚠ image par image : NON EXÉCUTÉ (' + g.saute + ') — aucun flash n’a été mesuré ici.');
  else {
    try { verdict(g); console.log('✓ image par image (375, colonne 520, bureau) : l’en-tête n’apparaît jamais dans une mise en page différente de la finale'); } catch (e) { ko++; console.log('✗ image par image — ' + e.message); }
    let mord = false; try { verdict(m); } catch (e) { mord = true; }
    if (!mord) { ko++; console.log('✗ image par image — la mutation (en-tête non masqué) ne la fait pas rougir'); } else console.log('✓ image par image mord : en-tête non masqué en attente = rouge');
  }
  if (ko) { console.log(ko + ' échec(s)'); process.exit(1); }
  console.log('Accueil dirigeant sans flash : ' + Object.keys(STRUCTURE).length + ' épreuves de structure' + (g.saute ? ', images non exécutées.' : ' + images.'));
})();
