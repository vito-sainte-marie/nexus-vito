// Menu bureau repliable « le rideau de verre et le filament » (Guardian 6715363735, 07/11/2026) : trois états (ouvert, rail, caché),
// mémorisés sans casser si localStorage manque, raccourci ⌘/Ctrl+\ ignoré dans un champ, ARIA, mouvement réduit, écran tactile.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
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
const DESK = lire('nexus-desktop.js');
const corps = (src, entete) => {
  const i = src.indexOf(entete); if (i < 0) return '';
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); } }
  return '';
};
const CONST = "const NEXUS_MENU_ETATS = ['ouvert', 'rail', 'cache'];\nconst NEXUS_MENU_CLE = 'nexus_menu_etat_v1';\n";
const fonctions = (src, noms, ctx = '') => new Function(ctx, CONST + noms.map(x => corps(src, 'function ' + x)).join('\n') + '; return {' + noms.join(',') + '};')(ctx);
const F = fonctions(DESK, ['nexusEtatMenuSuivant', 'nexusLireEtatMenu', 'nexusEcrireEtatMenu', 'nexusRaccourciMenuValide']);

t('machine à états : ouvert → rail → caché → ouvert', () => {
  assert.strictEqual(F.nexusEtatMenuSuivant('ouvert'), 'rail');
  assert.strictEqual(F.nexusEtatMenuSuivant('rail'), 'cache');
  assert.strictEqual(F.nexusEtatMenuSuivant('cache'), 'ouvert');
  assert.strictEqual(F.nexusEtatMenuSuivant('inconnu'), 'ouvert', 'état inconnu : retombe sur ouvert');
});
t('persistance : lecture et écriture avec un stockage normal', () => {
  const m = {}; const s = { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; } };
  assert.strictEqual(F.nexusLireEtatMenu(s), 'ouvert');
  assert.strictEqual(F.nexusEcrireEtatMenu('rail', s), true);
  assert.strictEqual(F.nexusLireEtatMenu(s), 'rail');
  s.setItem('nexus_menu_etat_v1', 'n\'importe quoi');
  assert.strictEqual(F.nexusLireEtatMenu(s), 'ouvert', 'valeur illisible = ouvert');
});
t('persistance : localStorage qui lève ou absent ne casse rien', () => {
  const casse = { getItem() { throw new Error('bloqué'); }, setItem() { throw new Error('plein'); } };
  assert.strictEqual(F.nexusLireEtatMenu(casse), 'ouvert');
  assert.strictEqual(F.nexusEcrireEtatMenu('cache', casse), false);
  assert.strictEqual(F.nexusLireEtatMenu({}), 'ouvert', 'objet sans getItem');
});
t('raccourci : Ctrl ou ⌘ + \\ valide, ignoré dans un champ, avec Alt/Maj ou une autre touche', () => {
  const ev = (o) => Object.assign({ key: '\\', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, target: { tagName: 'DIV' } }, o);
  assert.strictEqual(F.nexusRaccourciMenuValide(ev({})), true);
  assert.strictEqual(F.nexusRaccourciMenuValide(ev({ ctrlKey: false, metaKey: true })), true);
  ['INPUT', 'TEXTAREA', 'SELECT'].forEach(x => assert.strictEqual(F.nexusRaccourciMenuValide(ev({ target: { tagName: x } })), false, x));
  assert.strictEqual(F.nexusRaccourciMenuValide(ev({ target: { tagName: 'DIV', isContentEditable: true } })), false);
  assert.strictEqual(F.nexusRaccourciMenuValide(ev({ ctrlKey: false })), false, 'sans modificateur');
  assert.strictEqual(F.nexusRaccourciMenuValide(ev({ altKey: true })), false);
  assert.strictEqual(F.nexusRaccourciMenuValide(ev({ shiftKey: true })), false);
  assert.strictEqual(F.nexusRaccourciMenuValide(ev({ key: 'a' })), false);
  assert.strictEqual(F.nexusRaccourciMenuValide(null), false);
});

// ---- nexusAppliquerEtatMenu sur un DOM simulé ----
function faux() {
  const classes = new Set(); const attrs = []; const btns = [];
  const mk = () => { const a = {}; return { a, setAttribute: (k, v) => { a[k] = v; } }; };
  btns.push(mk(), mk());
  const menu = { inert: false, classList: { add() {}, remove() {} }, _nexusFinBouge: 0 };
  const corpsEl = { classList: { toggle: (c, on) => { on ? classes.add(c) : classes.delete(c); }, contains: c => classes.has(c) } };
  const doc = { body: corpsEl, getElementById: () => menu, querySelectorAll: () => btns, querySelector: () => null };
  const f = new Function('document', 'setTimeout', 'clearTimeout', corps(DESK, 'function nexusAppliquerEtatMenu') + '; return nexusAppliquerEtatMenu;')(doc, () => 0, () => {});
  return { f, classes, menu, btns };
}
t('appliquer : classes du corps, inert et ARIA suivent l\'état', () => {
  const x = faux();
  x.f('rail', false);
  assert.ok(x.classes.has('nexus-menu-rail') && !x.classes.has('nexus-menu-cache') && x.menu.inert === false);
  assert.strictEqual(x.btns[0].a['aria-expanded'], 'true'); assert.strictEqual(x.btns[0].a['aria-label'], 'Replier le menu');
  x.f('cache', false);
  assert.ok(x.classes.has('nexus-menu-cache') && !x.classes.has('nexus-menu-rail') && x.menu.inert === true, 'caché : liens hors tabulation');
  x.btns.forEach(b => { assert.strictEqual(b.a['aria-expanded'], 'false'); assert.strictEqual(b.a['aria-label'], 'Afficher le menu'); });
  x.f('ouvert', false);
  assert.ok(!x.classes.has('nexus-menu-rail') && !x.classes.has('nexus-menu-cache') && x.menu.inert === false);
});

// ---- présence : HTML et CSS ----
const css = DESK.slice(DESK.indexOf('.nexus-sb-barre{'));
t('le bouton de pli : SVG, aria-controls, aria-expanded, aria-label ; le menu porte son identifiant', () => {
  assert.ok(/<button type="button" class="nexus-sb-pli" aria-controls="nexus-sidebar-principal" aria-expanded="true" aria-label="Replier le menu"/.test(DESK));
  assert.ok(/<svg viewBox="0 0 16 16"[^>]*aria-hidden="true"/.test(DESK));
  assert.ok(DESK.includes("sidebar.id = 'nexus-sidebar-principal'"));
  assert.ok(DESK.includes('nexusInstallerPliMenuSidebar();\n    nexusVerifierAlertesFdj();'), 'installé à l\'init');
});
t('le filament est un vrai bouton accessible, dégradé cyan qui respire (opacité 0,35 à 0,7, 4 s)', () => {
  assert.ok(DESK.includes("fil.className = 'nexus-sb-filament'") && DESK.includes("fil.type = 'button'"));
  assert.ok(DESK.includes("fil.setAttribute('aria-label', 'Afficher le menu')"));
  assert.ok(/\.nexus-sb-fil\{[^}]*width:3px;[^}]*linear-gradient\(180deg, #4FC3D9, rgba\(79,195,217,0\)\)/.test(css));
  assert.ok(/@keyframes nexus-sb-souffle\{0%,100%\{opacity:\.35;\} 50%\{opacity:\.7;\}\}/.test(css) && /nexus-sb-souffle 4s/.test(css));
  assert.ok(/\.nexus-sb-filament\{[^}]*width:12px/.test(css), 'zone de survol de 12 px');
});
t('rail de 68 px, menu caché à largeur nulle, courbe élastique de 420 ms', () => {
  assert.ok(/body\.nexus-menu-rail #nexus-sidebar-principal[^{]*\{width:68px/.test(css));
  assert.ok(/body\.nexus-menu-cache #nexus-sidebar-principal[^{]*\{width:0;/.test(css));
  assert.ok(/#nexus-sidebar-principal\{transition:width 420ms cubic-bezier\(\.2,\.9,\.25,1\.15\)/.test(css));
});
t('rideau de verre : flou 0 à 8 px et voile animé en opacité seulement', () => {
  assert.ok(/#nexus-sidebar-principal::after\{[^}]*blur\(8px\)/.test(css));
  assert.ok(/@keyframes nexus-sb-rideau\{0%\{opacity:0;\} 40%\{opacity:1;\} 100%\{opacity:0;\}\}/.test(css));
});
t('cascade : retard de 12 ms par ligne (plafonné), icônes qui se dissolvent à l\'échelle 0,85', () => {
  assert.ok(/min\(var\(--nl-i, 0\), 24\) \* 12ms/.test(css));
  assert.ok(/body\.nexus-menu-cache #nexus-sidebar-principal \.nexus-sidebar-link\{opacity:0; scale:\.85/.test(css));
  assert.ok(/translate:-6px 0/.test(css), 'titre qui glisse de 6 px');
});
t('pastille de verre au survol en rail : flou, filet cyan à 40 %', () => {
  assert.ok(/\.nexus-sb-pastille\{[^}]*rgba\(79,195,217,0\.4\)[^}]*blur\(10px\)/.test(css));
  assert.ok(DESK.includes("if (!document.body.classList.contains('nexus-menu-rail')) return;"));
});
t('les info-bulles cèdent la place à la pastille en rail', () => {
  assert.ok(DESK.includes("if (document.body.classList.contains('nexus-menu-rail')) return;"));
});
t('aperçu au survol du filament seulement avec une vraie souris ; tactile : zone ≥ 24 px', () => {
  assert.ok(/@media \(hover:hover\)\{\s*\.nexus-sb-filament:hover\{width:20px/.test(css));
  assert.ok(/@media \(hover:none\)\{\s*\.nexus-sb-filament\{width:28px/.test(css));
});
t('mouvement réduit : ni cascade, ni flou, ni respiration, ni rebond ; fondu de 120 ms', () => {
  const R = corps(css, '@media (prefers-reduced-motion:reduce) and (min-width:0px)');
  assert.ok(R, 'bloc introuvable');
  assert.ok(/transition:opacity 120ms linear; transition-delay:0ms/.test(R));
  assert.ok(/::after, \.nexus-sb-fil, [^{]*\{animation:none/.test(R));
});
t('thème Jour et mobile : surcharge présente, aucun style du pli dans la page mobile', () => {
  assert.ok(/\[data-theme="jour"\] \.nexus-sb-pastille\{background:rgba\(255,255,255,0\.72\)/.test(css));
  assert.ok(!/nexus-sb-/.test(lire('NEXUS-App-v1.html')));
});
t('anti-flash : l\'état mémorisé est appliqué sans animation au chargement', () => {
  assert.ok(DESK.includes('nexusAppliquerEtatMenu(etat, false);'));
  assert.ok(DESK.includes('nexusAppliquerEtatMenu(etat, true);'));
});

garde('machine à états : le rail suit l\'ouvert', corps(DESK, 'function nexusEtatMenuSuivant'), c => /return NEXUS_MENU_ETATS\[\(i \+ 1\) % NEXUS_MENU_ETATS\.length\]/.test(c), '(i + 1) %', '(i + 2) %');
garde('persistance : lecture sous try/catch', corps(DESK, 'function nexusLireEtatMenu'), c => /try \{[\s\S]*\} catch \(e\) \{ return 'ouvert'; \}/.test(c), "catch (e) { return 'ouvert'; }", 'catch (e) { throw e; }');
garde('persistance : écriture sous try/catch', corps(DESK, 'function nexusEcrireEtatMenu'), c => /catch \(e\) \{ return false; \}/.test(c), 'catch (e) { return false; }', 'catch (e) { throw e; }');
garde('raccourci ignoré dans un champ', corps(DESK, 'function nexusRaccourciMenuValide'), c => /nom === 'INPUT'/.test(c) && /isContentEditable/.test(c), "nom === 'INPUT'", "nom === 'XINPUT'");
garde('raccourci : touche antislash', corps(DESK, 'function nexusRaccourciMenuValide'), c => /ev\.key !== '\\\\'/.test(c), "ev.key !== '\\\\'", "ev.key !== '|'");
garde('menu caché : inert', corps(DESK, 'function nexusAppliquerEtatMenu'), c => /menu\.inert = cache/.test(c), 'menu.inert = cache', 'menu.inert = false');
garde('ARIA : aria-expanded suit l\'état', corps(DESK, 'function nexusAppliquerEtatMenu'), c => /'aria-expanded', cache \? 'false' : 'true'/.test(c), "cache ? 'false' : 'true'", "cache ? 'true' : 'true'");
garde('le focus reste sur le bouton qui vient d\'agir', corps(DESK, 'function nexusInstallerPliMenuSidebar'), c => /if \(cible\) cible\.focus\(\)/.test(c), 'if (cible) cible.focus()', 'if (cible) cible.blur()');
garde('le filament ouvre le menu au clic', corps(DESK, 'function nexusInstallerPliMenuSidebar'), c => /fil\.addEventListener\('click', \(\) => aller\('ouvert', 'fil'\)\)/.test(c), "aller('ouvert', 'fil')", "aller('rail', 'fil')");
garde('rail : 68 px', css, c => /body\.nexus-menu-rail #nexus-sidebar-principal[^{]*\{width:68px/.test(c), '{width:68px', '{width:230px');
garde('filament : 3 px lumineux', css, c => /\.nexus-sb-fil\{[^}]*width:3px/.test(c), 'bottom:0; width:3px', 'bottom:0; width:0px');
garde('respiration : 0,35 à 0,7', css, c => /nexus-sb-souffle\{0%,100%\{opacity:\.35;\} 50%\{opacity:\.7;\}\}/.test(c), '50%{opacity:.7;}', '50%{opacity:1;}');
garde('mouvement réduit : respiration coupée', css, c => /::after, \.nexus-sb-fil, [^{]*\{animation:none/.test(c), '::after, .nexus-sb-fil, .nexus-sb-filament.nexus-sb-eclat', '::after, .nexus-sb-fil-x, .nexus-sb-filament.nexus-sb-eclat');
garde('tactile : zone du filament élargie', css, c => /@media \(hover:none\)\{\s*\.nexus-sb-filament\{width:28px/.test(c), '@media (hover:none){\n    .nexus-sb-filament{width:28px;}', '@media (hover:none){\n    .nexus-sb-filament{width:12px;}');
garde('aperçu au survol : seulement avec une vraie souris', css, c => /@media \(hover:hover\)\{\s*\.nexus-sb-filament:hover/.test(c), '@media (hover:hover){', '@media all{');
garde('cascade plafonnée (rail et caché)', css, c => (c.match(/min\(var\(--nl-i, 0\), 24\)/g) || []).length >= 3, 'min(var(--nl-i, 0), 24) * 12ms', 'var(--nl-i, 0) * 12ms');

console.log(n + ' épreuves OK');
