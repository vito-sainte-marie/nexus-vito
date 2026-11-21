'use strict';
// Garde de cache (Guardian 7068475563) : un script local modifié doit changer de ?v= dans toutes les pages qui le chargent.
// Sans cela, GitHub Pages et les navigateurs servent l'ancienne version (vignettes vides après #345 et #347).
// Référence : origin/production. Si la référence est absente (clone sans cette branche), les épreuves de comparaison sont sautées.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const D = __dirname;
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }
function git(args) { return cp.execFileSync('git', args, { cwd: D, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }); }
function gitOuNull(args) { try { return git(args); } catch (e) { return null; } }

const RE = /src="([A-Za-z0-9_.\-]+\.js)\?v=([^"]+)"/g;
function versions(html) { const m = {}; let r; RE.lastIndex = 0; while ((r = RE.exec(html))) m[r[1]] = r[2]; return m; }
const pages = fs.readdirSync(D).filter(f => /\.html$/.test(f));
const ref = gitOuNull(['rev-parse', '--verify', '-q', 'origin/production']);

t('chaque script local chargé avec ?v= existe', () => {
  pages.forEach(p => {
    const v = versions(fs.readFileSync(path.join(D, p), 'utf8'));
    Object.keys(v).forEach(s => assert.ok(fs.existsSync(path.join(D, s)), p + ' charge ' + s + ' absent du dépôt'));
  });
});

if (!ref) {
  console.log('SAUTÉ comparaison à origin/production : référence absente');
} else {
  t('script modifié depuis origin/production : son ?v= change dans toutes les pages qui le chargent', () => {
    const cache = {};
    const diff = s => {
      if (!(s in cache)) {
        const base = gitOuNull(['show', 'origin/production:' + s]);
        cache[s] = base !== null && base !== fs.readFileSync(path.join(D, s), 'utf8');
      }
      return cache[s];
    };
    const fautes = [];
    pages.forEach(p => {
      const baseHtml = gitOuNull(['show', 'origin/production:' + p]);
      if (baseHtml === null) return;
      const avant = versions(baseHtml), apres = versions(fs.readFileSync(path.join(D, p), 'utf8'));
      Object.keys(apres).forEach(s => {
        if (avant[s] !== undefined && avant[s] === apres[s] && diff(s)) fautes.push(p + ' : ' + s + '?v=' + apres[s]);
      });
    });
    assert.deepStrictEqual(fautes, [], 'script modifié mais ?v= inchangé (cache périmé en ligne) :\n' + fautes.join('\n'));
  });
}

t('nexus-icones.js : une seule version déclarée dans toutes les pages', () => {
  const vs = new Set();
  pages.forEach(p => { const v = versions(fs.readFileSync(path.join(D, p), 'utf8')); if (v['nexus-icones.js']) vs.add(v['nexus-icones.js']); });
  assert.strictEqual(vs.size, 1, 'versions : ' + Array.from(vs).join(', '));
});
console.log(n + ' épreuves OK');
