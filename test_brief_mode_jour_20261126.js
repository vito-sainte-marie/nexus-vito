// Brief en mode Jour (fiche docs/conception/brief-mode-jour.md, Guardian #383 7193749302)
const assert = require('assert'); const fs = require('fs');
const T = require('./nexus-theme.js');
const html = fs.readFileSync('NEXUS-Brief-v1.html', 'utf8');
let n = 0; const ok = (m, f) => { f(); n++; console.log('  ✓ ' + m); };
const lum = h => { const c = [1,3,5].map(i => parseInt(h.slice(i, i+2), 16)/255).map(v => v <= .03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4)); return .2126*c[0]+.7152*c[1]+.0722*c[2]; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); };
const J = Object.assign({}, T.JOUR, T.JOUR_COMPLEMENT);
ok('theme-color présent (le module le met à jour)', () => assert(/<meta name="theme-color"/.test(html)));
ok('le module est chargé avant les styles', () => assert(html.indexOf('nexus-theme.js') < html.indexOf('<style')));
ok('le fuseau de la station est transmis au thème', () => assert(/NexusTheme\.definirFuseau\(FUSEAU_STATION\)/.test(html)));
ok('aucun bloc « Affichage » dans le Brief', () => assert(!/>\s*Affichage\s*<|menuHtml|brancherMenu/.test(html)));
ok('theme-color Jour = fond Jour', () => assert(/^#[0-9A-F]{6}$/i.test(T.JOUR['--bg'])));
[['--on-amber','--amber'],['--on-cyan','--cyan'],['--on-cyan-alt','--cyan'],['--on-green','--green'],['--on-red','--red'],
 ['--green-text','--green-dim'],['--amber-text','--amber-dim'],['--red-text','--red-dim'],['--text','--bg'],['--text','--panel'],
 ['--nbe-conforme','--panel'],['--nbe-verifier','--panel'],['--nbe-critique','--panel'],['--nbe-attente','--panel']].forEach(([a, b]) => {
  if (!/^#/.test(J[a] || '') || !/^#/.test(J[b] || '')) return;
  ok(`contraste Jour ${a} sur ${b} ≥ 4,5`, () => assert(ratio(J[a], J[b]) >= 4.5, a + '/' + b + ' ' + ratio(J[a], J[b]).toFixed(2)));
});
console.log(n + ' épreuves');
