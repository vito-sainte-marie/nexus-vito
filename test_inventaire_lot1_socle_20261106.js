// Test — Contrôle inventaire, lot 1 (socle visuel, 06/11/2026).
// 1. les composants partagés sont la copie exacte de ceux de NEXUS-Paye-v1.html (Paye n'est pas rebranchée) ;
// 2. la page charge thème, composants et bannière avant ses styles / son script ;
// 3. palette Paye : chaque jeton de couleur du :root a sa valeur Jour, aucune couleur en dur hors :root
//    (hors pictogrammes Excel) ; 4. Paye est inchangée vs origin/production.
const fs = require('fs'); const path = require('path'); const assert = require('assert');
const { execSync } = require('child_process');
const T = require('./nexus-theme.js');
const C = require('./nexus-composants-pilotage.js');
const lire = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const paye = lire('NEXUS-Paye-v1.html'); const page = lire('NEXUS-Inventaire-Manager-v1.html'); const mod = lire('nexus-composants-pilotage.js');
let ok = 0; const cas = (n, f) => { f(); ok++; console.log('  ✓ ' + n); };
const ligne = (src, debut) => { const i = src.indexOf(debut); assert.ok(i >= 0, 'introuvable : ' + debut); return src.slice(i, src.indexOf('\n', i)).trim(); };

cas('ECHAPPE : même code que Paye', () => {
  assert.ok(paye.includes(ligne(mod, 'const ECHAPPE=')), 'ECHAPPE diffère de Paye');
});
cas('infoBtn : même code que Paye', () => {
  assert.ok(paye.includes(ligne(mod, 'const infoBtn=')), 'infoBtn diffère de Paye');
});
cas('anneau : même code que Paye', () => {
  const bloc = (src) => { const i = src.indexOf('function anneau(pct,couleur){'); assert.ok(i >= 0); return src.slice(i, src.indexOf('</svg>`;', i) + 8).replace(/\s+/g, ' '); };
  assert.strictEqual(bloc(mod), bloc(paye));
});
cas('règles .anneau et .st : mêmes déclarations que Paye', () => {
  for (const r of ['.anneau{width:56px;height:56px;flex:none}', '.anneau circle{fill:none;stroke-width:6}', '.anneau .fond{stroke:var(--trace)}', '.st{display:inline-flex;align-items:center;height:30px;padding:0 14px;border-radius:15px;font-size:13px;border:1px solid}']) {
    assert.ok(paye.includes(r), 'absente de Paye : ' + r); assert.ok(C.CSS.includes(r), 'absente du module : ' + r);
  }
});
cas('anneau et pill : rendu', () => {
  assert.ok(C.anneau(50, 'var(--green)').includes("stroke-dasharray=\"" + (157.1 / 2).toFixed(1) + " 157.1\""));
  assert.ok(C.anneau(150, 'x').includes('157.1 157.1')); assert.ok(C.anneau(-5, 'x').includes('0.0 157.1'));
  assert.strictEqual(C.pill('<b>', 'ok'), '<span class="st ok">&lt;b&gt;</span>');
  assert.ok(C.pill('a', 'inconnu').includes('st hp'));
  assert.ok(C.tuile({ valeur: '3/5', libelle: 'Produits', pct: 60, cible: 'x"y' }).includes('data-cible="x&quot;y"'));
});
cas('la page charge thème, composants et bannière avant les styles', () => {
  const s = page.indexOf('<style');
  for (const f of ['nexus-theme.js', 'nexus-composants-pilotage.js', 'nexus-banniere-station.js']) {
    const i = page.search(new RegExp('<script src="' + f.replace('.', '\\.') + '(\\?v=[0-9A-Za-z_-]+)?"></script>')); assert.ok(i > 0 && i < s, f);
  }
  assert.ok(page.indexOf('nexus-theme.js') < page.indexOf('nexus-composants-pilotage.js'));
});
cas('la bannière et le fuseau sont branchés', () => {
  assert.ok(/NexusBanniereStation\.html\(siteId/.test(page)); assert.ok(/NexusBanniereStation\.suivreTheme\(\)/.test(page));
  assert.ok(/NexusTheme\.definirFuseau\(fuseauSite\)/.test(page)); assert.ok(/NexusComposantsPilotage\.brancherInfos\(/.test(page));
});
const racine = {}; for (const m of page.matchAll(/:root\s*\{([^}]*)\}/g)) for (const d of m[1].split(';')) { const i = d.indexOf(':'); if (i > 0) racine[d.slice(0, i).trim()] = d.slice(i + 1).trim(); }
const JOURS = Object.assign({}, T.JOUR, T.JOUR_COMPLEMENT);
const estCouleur = (v) => /#[0-9a-f]{3,8}\b|rgba?\(|^\d+,\s*\d+,\s*\d+$/i.test(v);
cas('chaque jeton de couleur du :root a sa valeur Jour', () => {
  const jourPage = {}; const mj = page.match(/:root\[data-theme="jour"\]\s*\{([^}]*)\}/); if (mj) for (const d of mj[1].split(';')) { const i = d.indexOf(':'); if (i > 0) jourPage[d.slice(0, i).trim()] = 1; }
  for (const k of Object.keys(racine)) if (estCouleur(racine[k])) assert.ok(k in JOURS || k in jourPage, 'sans valeur Jour : ' + k);
});
cas('aucune couleur en dur hors :root (hors pictogrammes Excel)', () => {
  const hors = page.replace(/:root[^{]*\{[^}]*\}/g, '').replace(/var\(\s*--[a-z0-9-]+\s*,\s*[^)]*\)/gi, 'var(--x)').replace(/<meta name="theme-color"[^>]*>/, '');
  const reste = hors.split('\n').filter((l) => /#[0-9A-Fa-f]{3,8}\b|rgba?\(\s*\d/.test(l)).filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l)).filter((l) => !/<(path|rect|svg|g)\b[^>]*\bfill=|<stop\b[^>]*stop-color=/.test(l));
  assert.deepStrictEqual(reste.map((l) => l.trim().slice(0, 90)), []);
});
cas('Paye est inchangée vs origin/production', () => {
  let avant; try { avant = execSync('git show origin/production:NEXUS-Paye-v1.html', { cwd: __dirname, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 }); } catch (e) { return; }
  assert.strictEqual(paye, avant);
});
console.log(ok + ' cas OK');
