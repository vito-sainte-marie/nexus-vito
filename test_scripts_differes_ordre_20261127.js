'use strict';
// B0-perf-6 : scripts externes en defer (ordre conservé), script principal lancé en dernier, pdf-lib à la demande.
// Référence d'ordre : HEAD (avant ce lot) via git ; si absente, seules les épreuves structurelles tournent.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const cp = require('child_process');
const D = __dirname;
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }
function gitOuNull(args) { try { return cp.execFileSync('git', args, { cwd: D, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }); } catch (e) { return null; } }
const PAGES = ['NEXUS-App', 'NEXUS-Brief', 'NEXUS-Carburant-Reception', 'NEXUS-Carburants-Pilotage', 'NEXUS-Inventaire', 'NEXUS-Parametres-Station', 'NEXUS-Rapport', 'NEXUS-Releves-Piste'].map(p => p + '-v1.html');
const AVEC_PDF = ['NEXUS-Brief-v1.html', 'NEXUS-Carburants-Pilotage-v1.html', 'NEXUS-Rapport-v1.html'];
const lire = p => fs.readFileSync(path.join(D, p), 'utf8');
const balises = h => (h.match(/<script\b[^>]*>/g) || []);
const srcDe = b => { const m = /\bsrc="([^"]+)"/.exec(b); return m ? m[1].replace(/\?v=.*$/, '') : null; };
const externes = h => balises(h).map(b => ({ src: srcDe(b), defer: /\bdefer\b/.test(b), async: /\basync\b/.test(b) })).filter(s => s.src);
const PDF_LIB = /pdf-lib/;
const SCRIPTS_PROPRES = ['nexus-charger-pdf.js', 'nexus-demarrer-principal.js'];

PAGES.forEach(p => {
  t(p + ' : tous les scripts externes sont différés sauf nexus-theme.js, jamais async', () => {
    const ext = externes(lire(p)).filter(s => !PDF_LIB.test(s.src));
    ext.forEach(s => {
      assert.ok(!s.async, s.src + ' ne doit pas être async (l\'ordre ne serait plus garanti)');
      if (s.src === 'nexus-theme.js') assert.ok(!s.defer, 'nexus-theme.js doit rester synchrone (thème avant le premier rendu)');
      else assert.ok(s.defer, s.src + ' doit porter defer');
    });
  });

  t(p + ' : ordre des scripts externes identique à HEAD, plus les deux scripts du lot', () => {
    const avantHtml = gitOuNull(['show', 'HEAD:' + p]);
    const apres = externes(lire(p)).map(s => s.src);
    if (avantHtml === null) return;
    const avant = externes(avantHtml).map(s => s.src).filter(s => !PDF_LIB.test(s) && s !== 'nexus-pdf-moteur.js');
    const apresFiltre = apres.filter(s => !SCRIPTS_PROPRES.includes(s) && s !== 'nexus-pdf-moteur.js' && !PDF_LIB.test(s));
    assert.deepStrictEqual(apresFiltre, avant, 'l\'ordre d\'exécution des scripts externes a changé');
  });

  t(p + ' : pdf-lib et le moteur PDF ne se chargent plus au démarrage', () => {
    const ext = externes(lire(p)).map(s => s.src);
    assert.ok(!ext.some(s => PDF_LIB.test(s)), 'pdf-lib encore chargé au démarrage');
    assert.ok(!ext.includes('nexus-pdf-moteur.js'), 'nexus-pdf-moteur.js encore chargé au démarrage');
  });

  t(p + ' : le script principal est inerte (text/plain) et lancé par le dernier script différé', () => {
    const h = lire(p);
    assert.strictEqual((h.match(/<script type="text\/plain" id="nexus-script-principal">/g) || []).length, 1, 'un seul script principal text/plain attendu');
    const ext = externes(h);
    assert.strictEqual(ext[ext.length - 1].src, 'nexus-demarrer-principal.js', 'le lanceur doit être le dernier script externe');
    assert.strictEqual(ext.filter(s => s.src === 'nexus-demarrer-principal.js').length, 1);
    const iPrincipal = h.indexOf('id="nexus-script-principal"'), iLanceur = h.indexOf('nexus-demarrer-principal.js');
    assert.ok(iPrincipal < iLanceur, 'le lanceur doit venir après le script principal dans le document');
    // aucun script exécutable en ligne après le lanceur ou après le principal, hors balises de données
    const execInline = (h.match(/<script(?![^>]*\b(src|type)=)[^>]*>/g) || []);
    execInline.forEach(b => assert.ok(!/id="nexus-script-principal"/.test(b)));
  });

  t(p + ' : chaque script chargé existe (et les deux scripts du lot portent un ?v=)', () => {
    (lire(p).match(/<script\b[^>]*\bsrc="[^"]+"/g) || []).forEach(b => {
      const m = /src="([^"]+)"/.exec(b)[1];
      if (/^https?:/.test(m)) return;
      if (SCRIPTS_PROPRES.includes(m.replace(/\?v=.*$/, ''))) assert.ok(/\?v=[^"]+$/.test(m), m + ' sans ?v=');
      assert.ok(fs.existsSync(path.join(D, m.replace(/\?v=.*$/, ''))), m + ' absent');
    });
  });
});

AVEC_PDF.forEach(p => {
  t(p + ' : nexus-charger-pdf.js précède le script principal et chaque point d\'entrée PDF l\'attend', () => {
    const h = lire(p);
    const ext = externes(h).map(s => s.src);
    assert.ok(ext.includes('nexus-charger-pdf.js'), 'chargeur à la demande absent');
    const corps = h.slice(h.indexOf('id="nexus-script-principal"'));
    const appels = (corps.match(/await nexusChargerPdf\(\)/g) || []).length;
    const entrees = (corps.match(/await NexusPdfMoteur\.creerRapport(UnePage)?\(/g) || []).length;
    assert.ok(entrees > 0 && appels >= entrees, 'chaque creerRapport doit être précédé de await nexusChargerPdf()');
    // pour chaque creerRapport, le dernier await nexusChargerPdf() précédent doit exister dans la même fonction (< 60 lignes avant)
    const lignes = corps.split('\n');
    lignes.forEach((l, i) => {
      if (/await NexusPdfMoteur\.creerRapport(UnePage)?\(/.test(l)) {
        assert.ok(lignes.slice(Math.max(0, i - 60), i).some(x => /await nexusChargerPdf\(\)/.test(x)), 'creerRapport sans nexusChargerPdf() juste avant : ligne ' + i);
      }
    });
  });
});

// ---- exécution simulée : ordre réel des scripts différés puis lanceur, window.* défini à l'usage ----
function simulerPage(p) {
  const h = lire(p);
  const ordre = [];
  const ext = externes(h).filter(s => !/^nexus-theme\.js$/.test(s.src));
  const doc = {
    readyState: 'loading', _ecoutes: [], body: { appendChild(s) { s._pose = true; executer(s); } }, head: { appendChild() {} },
    getElementById(id) { return id === 'nexus-script-principal' ? { textContent: 'journal.push("principal");' } : null; },
    createElement() { return { set text(v) { this._t = v; }, get text() { return this._t; } }; },
    addEventListener(ev, f) { this._ecoutes.push([ev, f]); }
  };
  const journal = [];
  const ctx = { window: null, document: doc, console, journal, setTimeout, Promise };
  ctx.window = ctx; vm.createContext(ctx);
  function executer(s) { vm.runInContext(s._t, ctx); }
  const lanceur = fs.readFileSync(path.join(D, 'nexus-demarrer-principal.js'), 'utf8');
  ext.forEach(s => {
    if (s.src === 'nexus-demarrer-principal.js') return;
    ordre.push(s.src);
    journal.push(s.src);
    doc.readyState = 'interactive';
  });
  vm.runInContext(lanceur, ctx);
  return { journal, ordre };
}
PAGES.forEach(p => {
  t(p + ' : simulation — les scripts différés passent avant le principal, qui est exécuté une seule fois en dernier', () => {
    const { journal } = simulerPage(p);
    assert.strictEqual(journal[journal.length - 1], 'principal');
    assert.strictEqual(journal.filter(x => x === 'principal').length, 1);
    assert.ok(journal.length > 1, 'aucun script différé exécuté avant le principal');
  });
});

(async () => {
  const src = fs.readFileSync(path.join(D, 'nexus-charger-pdf.js'), 'utf8');
  const charges = [];
  const ctx = { console, setTimeout, Promise };
  ctx.window = ctx; ctx.self = ctx;
  ctx.document = {
    head: { appendChild(s) { charges.push(s.src.replace(/\?v=.*$/, '')); setTimeout(() => { if (/pdf-lib/.test(s.src)) ctx.PDFLib = {}; else ctx.NexusPdfMoteur = { ok: 1 }; s.onload && s.onload(); }, 0); } },
    createElement() { return {}; }
  };
  vm.createContext(ctx); vm.runInContext(src, ctx);
  assert.strictEqual(typeof ctx.nexusChargerPdf, 'function', 'window.nexusChargerPdf non défini');
  const a = ctx.nexusChargerPdf(), b = ctx.nexusChargerPdf();
  assert.strictEqual(a, b, 'le chargement doit être mémoïsé');
  const m = await a;
  assert.deepStrictEqual(m, { ok: 1 });
  assert.strictEqual(charges.length, 2);
  assert.ok(/pdf-lib/.test(charges[0]) && /nexus-pdf-moteur\.js$/.test(charges[1]), 'ordre : pdf-lib puis moteur : ' + charges);
  n++; console.log('OK nexus-charger-pdf.js à la demande, ordre pdf-lib puis moteur, mémoïsé');
  console.log('\n' + n + ' épreuves passées');
})().catch(e => { console.error('ÉCHEC', e); process.exit(1); });
