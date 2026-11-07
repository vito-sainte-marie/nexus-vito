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
// (Garde « Paye est inchangée vs origin/production » retirée le 07/11/2026 : elle valait pour le lot 1 Inventaire, qui ne devait
// pas toucher Paye. Elle rougissait toute PR Paye légitime — ici le type « Absence ». Les cas ci-dessus continuent de prouver
// que les composants partagés restent la copie exacte de ceux de Paye.)
cas('kit graphique : bannières jour/nuit et pictogrammes présents, sans couleur en dur', () => {
  const B = require('./nexus-banniere-station.js');
  for (const f of ['inventaire-banniere-sombre.webp', 'inventaire-banniere-claire.webp']) assert.ok(fs.statSync(path.join(__dirname, 'assets/inventaire', f)).size > 10000, f);
  for (const n of ['comptage', 'gaz', 'glacons', 'cigarettes', 'decenium', 'anomalies', 'stock', 'recomptage']) {
    const svg = lire('assets/inventaire/icones/' + n + '.svg');
    assert.ok(svg.includes('viewBox="0 0 64 64"') && svg.includes('currentColor'), n);
    // Gaz et Glaçons (demande Frédéric 07/11) portent leurs couleurs : seulement en repli de var(--ico-…), jamais en littéral nu.
    assert.ok(!/#[0-9a-f]{3,8}\b|rgba?\(/i.test(svg.replace(/var\(--ico-[0-9a-f]+,#[0-9a-f]{3,6}\)/gi, 'var(--x)')), 'couleur en dur : ' + n);
  }
  assert.ok(/photos: \{jour: 'assets\/inventaire\/inventaire-banniere-claire\.webp', nuit: 'assets\/inventaire\/inventaire-banniere-sombre\.webp'\}/.test(page));
  const h = B.html('vito-sainte-marie', { photos: { jour: 'a-jour.webp', nuit: 'a-nuit.webp' }, alt: 'x' });
  assert.ok(h.includes('data-photo-jour="a-jour.webp"') && h.includes('data-photo-nuit="a-nuit.webp"') && h.includes('src="a-nuit.webp"'));
  assert.ok(B.html('vito-sainte-marie', {sizes: '1px'}).includes('assets/accueil/'), "l'Accueil et Paye gardent leurs photos");
});
console.log(ok + ' cas OK');
