// Menu bureau repliable « le rideau de verre et le filament » (Guardian 6715363735, 07/11/2026) : trois états (ouvert, rail, caché), un contrôle = un effet (Guardian 6715691902),
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

t('un contrôle, une transition : pli ouvert→rail et rail→ouvert, masquer→caché, afficher→ouvert', () => {
  const g = F.nexusEtatMenuSuivant;
  assert.strictEqual(g('ouvert', 'pli'), 'rail', 'ouvert → rail');
  assert.strictEqual(g('rail', 'pli'), 'ouvert', 'rail → ouvert (le « ›› » ouvre, il ne masque pas)');
  assert.strictEqual(g('rail', 'masquer'), 'cache', 'rail → caché');
  assert.strictEqual(g('cache', 'afficher'), 'ouvert', 'caché → ouvert directement, pas rail');
  assert.strictEqual(g('inconnu', 'pli'), 'rail', 'état inconnu : traité comme ouvert');
  assert.strictEqual(g('rail', 'inconnue'), 'rail', 'action inconnue : ne bouge pas');
});
t('clavier : ⌘/Ctrl+\\ bascule ouvert ↔ rail, ⌘/Ctrl+Maj+\\ bascule caché ↔ ouvert, pas de cycle à trois temps', () => {
  const g = F.nexusEtatMenuSuivant;
  assert.strictEqual(g('ouvert', 'raccourci'), 'rail'); assert.strictEqual(g('rail', 'raccourci'), 'ouvert');
  assert.strictEqual(g('cache', 'raccourci'), 'ouvert', 'depuis caché, le raccourci simple ouvre');
  assert.strictEqual(g('cache', 'raccourci-maj'), 'ouvert'); assert.strictEqual(g('ouvert', 'raccourci-maj'), 'cache');
  assert.strictEqual(g('rail', 'raccourci-maj'), 'cache');
  let e = 'ouvert'; for (let k = 0; k < 6; k++) { e = g(e, 'raccourci'); assert.notStrictEqual(e, 'cache', 'le raccourci simple ne masque jamais'); }
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
t('raccourci : Ctrl ou ⌘ + \\ (avec ou sans Maj) valide, ignoré dans un champ, avec Alt ou une autre touche', () => {
  const ev = (o) => Object.assign({ key: '\\', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, target: { tagName: 'DIV' } }, o);
  assert.strictEqual(F.nexusRaccourciMenuValide(ev({})), true);
  assert.strictEqual(F.nexusRaccourciMenuValide(ev({ ctrlKey: false, metaKey: true })), true);
  ['INPUT', 'TEXTAREA', 'SELECT'].forEach(x => assert.strictEqual(F.nexusRaccourciMenuValide(ev({ target: { tagName: x } })), false, x));
  assert.strictEqual(F.nexusRaccourciMenuValide(ev({ target: { tagName: 'DIV', isContentEditable: true } })), false);
  assert.strictEqual(F.nexusRaccourciMenuValide(ev({ ctrlKey: false })), false, 'sans modificateur');
  assert.strictEqual(F.nexusRaccourciMenuValide(ev({ altKey: true })), false);
  assert.strictEqual(F.nexusRaccourciMenuValide(ev({ shiftKey: true })), true, 'Maj+\\ : bascule caché ↔ ouvert');
  assert.strictEqual(F.nexusRaccourciMenuValide(ev({ shiftKey: true, key: '|' })), true, 'clavier qui rend | avec Maj');
  assert.strictEqual(F.nexusRaccourciMenuValide(ev({ shiftKey: true, key: 'a', code: 'KeyA' })), false);
  assert.strictEqual(F.nexusRaccourciMenuValide(ev({ shiftKey: true, altKey: true })), false);
  assert.strictEqual(F.nexusRaccourciMenuValide(ev({ key: 'a' })), false);
  assert.strictEqual(F.nexusRaccourciMenuValide(null), false);
});

// ---- nexusAppliquerEtatMenu sur un DOM simulé ----
function faux() {
  const classes = new Set();
  const mk = () => { const a = {}; return { a, title: '', setAttribute: (k, v) => { a[k] = v; } }; };
  const pli = mk(), masque = mk(), fil = mk();
  const sel = { '.nexus-sb-pli': pli, '.nexus-sb-masque': masque, '.nexus-sb-filament': fil };
  const menu = { inert: false, classList: { add() {}, remove() {} }, _nexusFinBouge: 0 };
  const corpsEl = { classList: { toggle: (c, on) => { on ? classes.add(c) : classes.delete(c); }, contains: c => classes.has(c) } };
  const doc = { body: corpsEl, getElementById: () => menu, querySelectorAll: () => [], querySelector: q => sel[q] || null };
  const f = new Function('document', 'setTimeout', 'clearTimeout', corps(DESK, 'function nexusAppliquerEtatMenu') + '; return nexusAppliquerEtatMenu;')(doc, () => 0, () => {});
  return { f, classes, menu, pli, masque, fil };
}
t('appliquer : classes du corps et inert suivent l\'état', () => {
  const x = faux();
  x.f('rail', false);
  assert.ok(x.classes.has('nexus-menu-rail') && !x.classes.has('nexus-menu-cache') && x.menu.inert === false);
  x.f('cache', false);
  assert.ok(x.classes.has('nexus-menu-cache') && !x.classes.has('nexus-menu-rail') && x.menu.inert === true, 'caché : liens hors tabulation');
  x.f('ouvert', false);
  assert.ok(!x.classes.has('nexus-menu-rail') && !x.classes.has('nexus-menu-cache') && x.menu.inert === false);
});
t('ARIA : l\'étiquette dit ce que le bouton fait, selon le symbole affiché (‹‹ Réduire, ›› Ouvrir)', () => {
  const x = faux();
  x.f('ouvert', false);
  assert.strictEqual(x.pli.a['aria-label'], 'Réduire le menu'); assert.strictEqual(x.pli.a['aria-expanded'], 'true'); assert.ok(x.pli.title.startsWith('Réduire le menu'));
  x.f('rail', false);
  assert.strictEqual(x.pli.a['aria-label'], 'Ouvrir le menu'); assert.strictEqual(x.pli.a['aria-expanded'], 'false'); assert.ok(x.pli.title.startsWith('Ouvrir le menu'));
  assert.strictEqual(x.masque.a['aria-expanded'], 'true', 'masquer : le menu est encore affiché');
  x.f('cache', false);
  assert.strictEqual(x.masque.a['aria-expanded'], 'false'); assert.strictEqual(x.fil.a['aria-expanded'], 'false');
  x.f('ouvert', false);
  assert.strictEqual(x.fil.a['aria-expanded'], 'true');
});

// ---- présence : HTML et CSS ----
const css = DESK.slice(DESK.indexOf('.nexus-sb-barre{'));
t('les boutons de pli et de masquage : SVG, aria-controls, aria-expanded, aria-label, infobulle ; le menu porte son identifiant', () => {
  assert.ok(/<button type="button" class="nexus-sb-pli" aria-controls="nexus-sidebar-principal" aria-expanded="true" aria-label="Réduire le menu" title="Réduire le menu/.test(DESK));
  assert.ok(/<button type="button" class="nexus-sb-masque" aria-controls="nexus-sidebar-principal" aria-expanded="true" aria-label="Masquer le menu" title="Masquer le menu/.test(DESK));
  assert.ok(!/Replier le menu/.test(DESK), 'plus d\'étiquette « Replier » qui ne dit pas ce que fait le bouton');
  assert.ok(/<svg viewBox="0 0 16 16"[^>]*aria-hidden="true"/.test(DESK));
  assert.ok(DESK.includes("sidebar.id = 'nexus-sidebar-principal'"));
  assert.ok(DESK.includes('nexusInstallerPliMenuSidebar();\n    nexusVerifierAlertesFdj();'), 'installé à l\'init');
});
t('masquer : bouton séparé, visible en rail seulement, sous le bouton qui rouvre', () => {
  assert.ok(/\.nexus-sb-masque\{display:none;/.test(css));
  assert.ok(/body\.nexus-menu-rail \.nexus-sb-masque\{display:flex;\}/.test(css));
  assert.ok(/body\.nexus-menu-rail #nexus-sidebar-principal \.nexus-sb-barre\{flex-direction:column/.test(css), 'empilés : le bouton « masquer » est sous le « ›› »');
  assert.ok(/\.nexus-sb-masque\{[^}]*width:28px; height:24px/.test(css), 'cible ≥ 24 px');
});
t('l\'état caché n\'a qu\'un bouton d\'affichage : un filament, pas de second chevron (ni ::after)', () => {
  assert.strictEqual((corps(DESK, 'function nexusInstallerPliMenuSidebar').match(/document\.createElement\('button'\)/g) || []).length, 1, 'un seul bouton d\'affichage créé');
  assert.strictEqual((DESK.match(/class="nexus-sb-chev"/g) || []).length, 1);
  assert.ok(!/\.nexus-sb-filament::after/.test(css), 'plus de chevron en pseudo-élément');
  assert.ok(!/left:-4px/.test(css), 'plus de doublon de 14 px à x = −4');
  assert.ok(/\.nexus-sb-chev\{[^}]*left:4px;[^}]*width:24px; height:24px/.test(css), 'chevron entièrement à l\'écran, 24 × 24 px');
  assert.ok(DESK.includes("fil.setAttribute('aria-label', 'Afficher le menu')"));
});
t('le filament est un vrai bouton accessible, dégradé cyan qui respire (opacité 0,35 à 0,7, 4 s)', () => {
  assert.ok(DESK.includes("fil.className = 'nexus-sb-filament'") && DESK.includes("fil.type = 'button'"));
  assert.ok(DESK.includes("fil.setAttribute('aria-label', 'Afficher le menu')"));
  assert.ok(/\.nexus-sb-fil\{[^}]*width:3px;[^}]*linear-gradient\(180deg, #4FC3D9, rgba\(79,195,217,0\)\)/.test(css));
  assert.ok(/@keyframes nexus-sb-souffle\{0%,100%\{opacity:\.35;\} 50%\{opacity:\.7;\}\}/.test(css) && /nexus-sb-souffle 4s/.test(css));
  assert.ok(/\.nexus-sb-filament\{[^}]*width:28px/.test(css), 'zone cliquable de 28 px');
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
  assert.ok(/@media \(hover:hover\)\{\s*\.nexus-sb-filament:hover::before\{transform:none; opacity:1;\}/.test(css));
  assert.ok(/@media \(hover:none\)\{\s*\.nexus-sb-filament\{width:32px/.test(css));
});
t('Guardian 6715519682 : icônes du rail à 28 px, panneau de verre de 24 px en 180 ms, chevron 24 × 24 px visible, écart de 16 px', () => {
  assert.ok(/body\.nexus-menu-rail #nexus-sidebar-principal \.nexus-sidebar-link img\{width:28px; height:28px;\}/.test(css), 'icônes du rail à 28 px');
  assert.ok(/\.nexus-sb-filament::before\{[^}]*width:24px;[^}]*blur\(10px\)[^}]*border-right:1px solid rgba\(79,195,217,0\.7\)[^}]*transition:transform 180ms ease, opacity 180ms ease/.test(css), 'panneau de verre');
  assert.ok(/\.nexus-sb-filament:hover \.nexus-sb-fil\{animation:none; opacity:1; filter:drop-shadow\(0 0 5px #4FC3D9\);\}/.test(css), 'filament intensifié');
  assert.ok(/\.nexus-sb-chev\{position:absolute; left:4px; top:12px; width:24px; height:24px;/.test(css), 'chevron 24 × 24 px, dans l\'écran');
  assert.ok(/body\.nexus-desktop\.nexus-menu-cache > \.phone, body\.nexus-desktop\.nexus-menu-cache > \.app\{margin-left:16px;\}/.test(css), 'écart de 16 px');
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

const MACH = corps(DESK, 'function nexusEtatMenuSuivant');
garde('pli : ouvert ↔ rail', MACH, c => /action === 'pli' \|\| action === 'raccourci'\) return e === 'ouvert' \? 'rail' : 'ouvert'/.test(c), "e === 'ouvert' ? 'rail' : 'ouvert'", "e === 'ouvert' ? 'rail' : 'cache'");
garde('masquer : va à caché', MACH, c => /action === 'masquer'\) return 'cache'/.test(c), "action === 'masquer') return 'cache'", "action === 'masquer') return 'rail'");
garde('afficher : va à ouvert, pas à rail', MACH, c => /action === 'afficher'\) return 'ouvert'/.test(c), "action === 'afficher') return 'ouvert'", "action === 'afficher') return 'rail'");
garde('Maj+\\ : caché ↔ ouvert', MACH, c => /e === 'cache' \? 'ouvert' : 'cache'/.test(c), "e === 'cache' ? 'ouvert' : 'cache'", "e === 'cache' ? 'rail' : 'cache'");
garde('persistance : lecture sous try/catch', corps(DESK, 'function nexusLireEtatMenu'), c => /try \{[\s\S]*\} catch \(e\) \{ return 'ouvert'; \}/.test(c), "catch (e) { return 'ouvert'; }", 'catch (e) { throw e; }');
garde('persistance : écriture sous try/catch', corps(DESK, 'function nexusEcrireEtatMenu'), c => /catch \(e\) \{ return false; \}/.test(c), 'catch (e) { return false; }', 'catch (e) { throw e; }');
garde('raccourci ignoré dans un champ', corps(DESK, 'function nexusRaccourciMenuValide'), c => /nom === 'INPUT'/.test(c) && /isContentEditable/.test(c), "nom === 'INPUT'", "nom === 'XINPUT'");
garde('raccourci : touche antislash', corps(DESK, 'function nexusRaccourciMenuValide'), c => /ev\.key !== '\\\\'/.test(c), "ev.key !== '\\\\'", "ev.key !== '|'");
garde('raccourci : Alt le refuse', corps(DESK, 'function nexusRaccourciMenuValide'), c => /\|\| ev\.altKey \|\|/.test(c), '|| ev.altKey ||', '|| ev.altKeyX ||');
garde('menu caché : inert', corps(DESK, 'function nexusAppliquerEtatMenu'), c => /menu\.inert = cache/.test(c), 'menu.inert = cache', 'menu.inert = false');
garde('ARIA : le filament et « masquer » suivent l\'état', corps(DESK, 'function nexusAppliquerEtatMenu'), c => (c.match(/'aria-expanded', cache \? 'false' : 'true'/g) || []).length === 2, "fil.setAttribute('aria-expanded', cache ? 'false' : 'true')", "fil.setAttribute('aria-expanded', 'true')");
garde('ARIA : « ›› » dit Ouvrir, « ‹‹ » dit Réduire', corps(DESK, 'function nexusAppliquerEtatMenu'), c => (c.match(/rail \? 'Ouvrir le menu' : 'Réduire le menu'/g) || []).length === 2, "setAttribute('aria-label', rail ? 'Ouvrir le menu' : 'Réduire le menu')", "setAttribute('aria-label', rail ? 'Réduire le menu' : 'Réduire le menu')");
garde('le focus reste sur le bouton qui vient d\'agir', corps(DESK, 'function nexusInstallerPliMenuSidebar'), c => /if \(cible\) cible\.focus\(\)/.test(c), 'if (cible) cible.focus()', 'if (cible) cible.blur()');
const INST = corps(DESK, 'function nexusInstallerPliMenuSidebar');
garde('le filament ouvre le menu au clic', INST, c => /fil\.addEventListener\('click', \(\) => aller\('afficher', 'fil'\)\)/.test(c), "aller('afficher', 'fil')", "aller('pli', 'fil')");
garde('le bouton « ›› / ‹‹ » fait pli (ouvert ↔ rail)', INST, c => /\.nexus-sb-pli'\)\.addEventListener\('click', \(\) => aller\('pli', 'pli'\)\)/.test(c), "aller('pli', 'pli')", "aller('masquer', 'pli')");
garde('le bouton « masquer » masque', INST, c => /\.nexus-sb-masque'\)\.addEventListener\('click', \(\) => aller\('masquer', 'masque'\)\)/.test(c), "aller('masquer', 'masque')", "aller('pli', 'masque')");
garde('clavier : Maj fait la bascule caché ↔ ouvert', INST, c => /aller\(ev\.shiftKey \? 'raccourci-maj' : 'raccourci', 'clavier'\)/.test(c), "ev.shiftKey ? 'raccourci-maj' : 'raccourci'", "false ? 'raccourci-maj' : 'raccourci'");
garde('rail : 68 px', css, c => /body\.nexus-menu-rail #nexus-sidebar-principal[^{]*\{width:68px/.test(c), '{width:68px', '{width:230px');
garde('filament : 3 px lumineux', css, c => /\.nexus-sb-fil\{[^}]*width:3px/.test(c), 'bottom:0; width:3px', 'bottom:0; width:0px');
garde('respiration : 0,35 à 0,7', css, c => /nexus-sb-souffle\{0%,100%\{opacity:\.35;\} 50%\{opacity:\.7;\}\}/.test(c), '50%{opacity:.7;}', '50%{opacity:1;}');
garde('mouvement réduit : respiration coupée', css, c => /::after, \.nexus-sb-fil, [^{]*\{animation:none/.test(c), '::after, .nexus-sb-fil, .nexus-sb-filament.nexus-sb-eclat', '::after, .nexus-sb-fil-x, .nexus-sb-filament.nexus-sb-eclat');
garde('tactile : zone du filament élargie', css, c => /@media \(hover:none\)\{\s*\.nexus-sb-filament\{width:32px/.test(c), '@media (hover:none){\n    .nexus-sb-filament{width:32px;}', '@media (hover:none){\n    .nexus-sb-filament{width:12px;}');
garde('rail : icônes à 28 px', css, c => /nexus-sidebar-link img\{width:28px; height:28px;\}/.test(c), '.nexus-sidebar-link img{width:28px; height:28px;}', '.nexus-sidebar-link img{width:16px; height:16px;}');
garde('filament : panneau de verre de 24 px', css, c => /\.nexus-sb-filament::before\{[^}]*width:24px/.test(c), 'bottom:0; width:24px; background:rgba(20,27,34,0.55)', 'bottom:0; width:4px; background:rgba(20,27,34,0.55)');
garde('filament : lueur au survol', css, c => /:hover \.nexus-sb-fil\{animation:none; opacity:1; filter:drop-shadow/.test(c), 'animation:none; opacity:1; filter:drop-shadow(0 0 5px #4FC3D9)', 'animation:none; opacity:.4; filter:none');
garde('chevron : 24 × 24 px visible, un seul', css, c => /\.nexus-sb-chev\{position:absolute; left:4px; top:12px; width:24px; height:24px/.test(c) && !/left:-4px/.test(c), 'left:4px; top:12px; width:24px; height:24px', 'left:-4px; top:12px; width:14px; height:24px');
garde('pas de second chevron en pseudo-élément', css, c => !/\.nexus-sb-filament::after/.test(c), '.nexus-sb-filament::before{', '.nexus-sb-filament::after{');
garde('« masquer » visible en rail seulement', css, c => /body\.nexus-menu-rail \.nexus-sb-masque\{display:flex;\}/.test(c), 'body.nexus-menu-rail .nexus-sb-masque{display:flex;}', 'body.nexus-menu-rail .nexus-sb-masque{display:none;}');
garde('écart de 16 px pour le bouton ☰', css, c => /nexus-menu-cache > \.app\{margin-left:16px;\}/.test(c), '> .app{margin-left:16px;}', '> .app{margin-left:0;}');
garde('aperçu au survol : seulement avec une vraie souris', css, c => /@media \(hover:hover\)\{\s*\.nexus-sb-filament:hover/.test(c), '@media (hover:hover){', '@media all{');
garde('cascade plafonnée (rail et caché)', css, c => (c.match(/min\(var\(--nl-i, 0\), 24\)/g) || []).length >= 3, 'min(var(--nl-i, 0), 24) * 12ms', 'var(--nl-i, 0) * 12ms');


// ---- Titre ciblé par sa classe, pastille d'alerte en rail (Guardian 6715869527) ----
t('le titre porte .nexus-sidebar-titre ; aucune règle ni JS ne s\'appuie sur span:last-child', () => {
  assert.ok(DESK.includes('<span class="nexus-sidebar-titre">${item.label}</span>'));
  assert.ok(!/span:last-child|:first-of-type/.test(DESK), 'plus de sélecteur positionnel');
  assert.ok(/body\.nexus-menu-rail #nexus-sidebar-principal \.nexus-sidebar-link > \.nexus-sidebar-titre\{max-width:0; opacity:0/.test(DESK));
  assert.ok(DESK.includes("lien.querySelector('.nexus-sidebar-titre')"));
});
t('en rail, une entrée avec pastille : titre masqué par sa classe (même si la pastille est le dernier enfant) et pastille visible sur le coin de l\'icône', () => {
  assert.ok(/nexus-menu-rail #nexus-sidebar-principal \.nexus-sidebar-link \.nexus-sidebar-dot\{position:absolute; left:calc\(50% \+ 6px\); top:4px;[^}]*width:8px; height:8px; border:2px solid #0D131A/.test(DESK));
  assert.ok(/nexus-menu-rail #nexus-sidebar-principal \.nexus-sidebar-link\{position:relative;\}/.test(DESK));
  assert.ok(!/nexus-menu-rail[^{]*nexus-sidebar-dot\{[^}]*(display:none|opacity:0)/.test(DESK));
  assert.ok(/nexus-sidebar-loupe\.nexus-menu-rail #nexus-sidebar-principal \.nexus-sidebar-link \.nexus-sidebar-dot\{translate:/.test(DESK), 'suit la loupe');
});
garde('rail : le titre est masqué par sa classe', DESK, h => /nexus-menu-rail #nexus-sidebar-principal \.nexus-sidebar-link > \.nexus-sidebar-titre\{max-width:0/.test(h), 'link > .nexus-sidebar-titre{max-width:0', 'link > span:last-child{max-width:0');
garde('rail : la pastille est en surimpression', DESK, h => /nexus-sidebar-dot\{position:absolute; left:calc\(50% \+ 6px\)/.test(h), 'nexus-sidebar-dot{position:absolute;', 'nexus-sidebar-dot{position:static;');

console.log(n + ' épreuves OK');
