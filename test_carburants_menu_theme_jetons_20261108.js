// Carburants Pilotage : bouton « ☰ Menu », choix Affichage (Sombre/Jour/Auto), jetons Jour du jaune, audit des jetons (Guardian 6726565151).
const assert = require('assert'); const fs = require('fs'); const path = require('path');
const T = require('./nexus-theme.js');
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }
function garde(nom, src, regle, lit, rempl) { t(nom, () => { assert.ok(regle(src), 'passe sur la source'); assert.ok(src.indexOf(lit) >= 0, 'littéral introuvable : ' + lit); assert.ok(!regle(src.replace(lit, rempl)), 'doit rougir une fois mutée'); }); }
const F = 'NEXUS-Carburants-Pilotage-v1.html';
const SRC = fs.readFileSync(path.join(__dirname, F), 'utf8');
const SANS_COM = s => s.replace(/\/\*[\s\S]*?\*\//g, '');
const INVARIANTS = new Set(['--safe-top', '--safe-bottom', '--mono', '--sans', '--icone-pompe', '--carb-couleur', '--ombre-carte', '--halo-statut', '--teinte-moyenne', '--nbe-attente', '--nbe-verifier', '--nbe-conforme', '--nbe-critique', '--nbe-info', '--nbe-accent']); // --nbe-* : définis par nexus-badge-etat.js (Jour et Nuit)
const estCouleur = v => /#[0-9a-f]{3,8}\b|rgba?\(/i.test(v);
function jetons(src, entete) {
  const out = {}; const s = SANS_COM(src);
  const re = new RegExp(entete.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'g');
  for (const m of s.matchAll(re)) for (const d of m[1].split(';')) { const i = d.indexOf(':'); if (i > 0 && d.trim().startsWith('--')) out[d.slice(0, i).trim()] = d.slice(i + 1).trim(); }
  return out;
}
const SOMBRE = jetons(SRC, ':root');
const JOUR_PAGE = jetons(SRC, ':root[data-theme="jour"]');
const JOUR = Object.assign({}, T.JOUR, T.JOUR_COMPLEMENT, JOUR_PAGE);
const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

t('bouton « ☰ Menu » : dans l\'en-tête, lien vers l\'accueil, pastille du gabarit commun', () => {
  assert.ok(/<header class="header hero" id="heroCarburants">\s*<a class="menu-btn" href="NEXUS-App-v1\.html">☰ Menu<\/a>/.test(SRC));
  assert.ok(!SRC.includes('haut-page'), 'plus de rangée .haut-page');
  assert.ok(!SRC.includes('menu-pastille'), 'plus de pastille locale');
});
t('Affichage retiré de cette page (le choix Sombre/Jour/Auto reste dans le menu de l\'Accueil)', () => {
  assert.ok(!SRC.includes('btnAffichage') && !SRC.includes('panneauAffichage') && !SRC.includes('affichage-panneau'));
  assert.ok(!SRC.includes('data-theme-reglage') && !SRC.includes('NexusTheme.menuHtml()') && !SRC.includes('brancherMenu'));
});
t('analyse, synthèse : une colonne sous 700 px de largeur du CONTENEUR, pas de la fenêtre', () => {
  assert.ok(/\.analyse-conteneur\{container-type:inline-size;\}/.test(SRC));
  assert.ok(/@container \(max-width:699px\)\{\.grille-analyse\{grid-template-columns:1fr;\}\}/.test(SRC));
  assert.ok(/\.lecture-nexus-card\{container-type:inline-size;\}/.test(SRC));
  assert.ok(/@container \(max-width:699px\)\{\.lecture-nexus-colonnes\{grid-template-columns:1fr;\}\}/.test(SRC));
  assert.ok(!/@media[^{]*\{\s*\.(grille-analyse|lecture-nexus-colonnes)\{/.test(SRC));
  assert.ok(/<div class="analyse-conteneur">\s*<div class="grille-analyse">/.test(SRC));
  assert.ok(/\.situation-grid\{display:grid; grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,260px\),1fr\)\)/.test(SRC), 'situation : déjà pilotée par le conteneur');
});
t('le fil « NEXUS / Carburants » est conservé', () => { assert.ok(SRC.includes('<a href="NEXUS-App-v1.html" class="menu-btn-fil">NEXUS</a> / Carburants')); });
t('Jour : --yellow lisible (≥ 4,5:1) sur --yellow-dim', () => {
  assert.ok(JOUR_PAGE['--yellow'] && JOUR_PAGE['--yellow-dim']);
  assert.ok(ratio(JOUR_PAGE['--yellow'], JOUR_PAGE['--yellow-dim']) >= 4.5, String(ratio(JOUR_PAGE['--yellow'], JOUR_PAGE['--yellow-dim'])));
});
t('audit : tout jeton couleur Sombre a une valeur Jour (page ∪ JOUR ∪ JOUR_COMPLEMENT)', () => {
  const manques = Object.keys(SOMBRE).filter(k => !INVARIANTS.has(k) && estCouleur(SOMBRE[k]) && !(k in JOUR));
  assert.deepStrictEqual(manques, []);
});
t('audit : tout var(--x) sans repli est défini (Sombre ou invariant documenté)', () => {
  const s = SANS_COM(SRC); const inconnus = new Set();
  for (const m of s.matchAll(/var\(\s*(--[a-z0-9-]+)\s*\)/gi)) if (!(m[1] in SOMBRE) && !(m[1] in JOUR) && !INVARIANTS.has(m[1])) inconnus.add(m[1]);
  assert.deepStrictEqual([...inconnus], []);
});
t('identifiants et libellés métier inchangés (présentation seule)', () => {
  assert.ok(/a_anticiper: \{ gravite: 'a-verifier', libelle: 'À surveiller'/.test(SRC));
  assert.ok(SRC.includes('id="heroCarburants"') && SRC.includes('id="btnInfoPage"'));
});

garde('bouton Menu : lien vers l\'accueil, dans l\'en-tête', SRC, c => /<header class="header hero" id="heroCarburants">\s*<a class="menu-btn" href="NEXUS-App-v1\.html">/.test(c), '<a class="menu-btn" href="NEXUS-App-v1.html">', '<a class="menu-btn" href="#">');
garde('Affichage ne revient pas', SRC, c => !c.includes('btnAffichage'), '<a class="menu-btn"', '<button id="btnAffichage"></button><a class="menu-btn"');
garde('grille d\'analyse pilotée par le conteneur', SRC, c => /@container \(max-width:699px\)\{\.grille-analyse\{/.test(c), '@container (max-width:699px){.grille-analyse{', '@media (max-width:820px){.grille-analyse{');
garde('synthèse pilotée par le conteneur', SRC, c => /@container \(max-width:699px\)\{\.lecture-nexus-colonnes\{/.test(c), '@container (max-width:699px){.lecture-nexus-colonnes{', '@media (max-width:820px){.lecture-nexus-colonnes{');
garde('le conteneur d\'analyse existe', SRC, c => /\.analyse-conteneur\{container-type:inline-size;\}/.test(c), '.analyse-conteneur{container-type:inline-size;}', '.analyse-conteneur{}');
t('garde mutée : sans --yellow Jour, l\'audit rougit', () => {
  const S2 = Object.assign({}, JOUR_PAGE); delete S2['--yellow'];
  const J2 = Object.assign({}, T.JOUR, T.JOUR_COMPLEMENT, S2);
  assert.ok(Object.keys(SOMBRE).some(k => !INVARIANTS.has(k) && estCouleur(SOMBRE[k]) && !(k in J2)));
});
// ---- Finition « premium » des cartes (Guardian 6726640433) et jeton --surf (Guardian 6726647152) ----
const SC = SANS_COM(SRC);
const FIN = SC.slice(SC.indexOf('.carb-carte2,.carb-carte2.statut-corriger'));
t('--surf défini dans les deux thèmes (Sombre #0D202E, Jour #FFFFFF), comme la Paye', () => {
  assert.ok(/:root\{[^}]*--surf:#0D202E;/.test(SC));
  assert.ok(/\[data-theme="jour"\]\{[^}]*--surf:#FFFFFF;/.test(SC));
});
t('carte : liseré de 3 px en pseudo-élément pleine largeur, coins nets (overflow hidden)', () => {
  assert.ok(/\.carb-carte2::before\{content:''; position:absolute; top:0; left:0; right:0; height:3px; background:var\(--carb-couleur/.test(FIN));
  assert.ok(/overflow:hidden/.test(FIN.slice(0, 400)));
});
t('carte : bordure toujours --hairline (le statut passe par la pastille et un halo, pas la bordure)', () => {
  assert.ok(/\.carb-carte2,\.carb-carte2\.statut-corriger,\.carb-carte2\.statut-surveiller\{[^}]*border:1px solid var\(--hairline\)/.test(FIN));
  assert.ok(/--halo-statut:0 0 16px/.test(FIN));
});
t('cartes de même hauteur, pastilles calées en bas (colonne flex, margin-top:auto)', () => {
  assert.ok(/display:flex; flex-direction:column/.test(FIN));
  assert.ok(/\.carb-pills\{margin-top:auto/.test(FIN));
});
t('pourcentage : « % » à 55 % de la taille, chiffres tabulaires', () => {
  assert.ok(/\.carb-pct-signe\{font-size:\.55em/.test(FIN));
  assert.ok(/\.carb-pct2\{[^}]*align-items:baseline[^}]*tabular-nums/.test(FIN));
});
t('lignes de 32 px, un seul filet entre blocs, aucun entre lignes d\'un bloc', () => {
  assert.ok(/\.carb-stat-row,\.carb-ventes-ligne\{[^}]*min-height:32px/.test(FIN));
  assert.ok(/\.carb-stat-row \+ \.carb-stat-row\{border-top:0;\}/.test(FIN));
  assert.ok(/\.carb-bloc\{padding:14px 0; border-top:1px solid var\(--hairline\)/.test(FIN));
});
t('libellés sans 13 px --text-mid, valeurs mono tabulaires, valeur d\'Autonomie en sans semi-gras', () => {
  assert.ok(/\.carb-stat-row \.lbl[^{]*\{font-family:var\(--sans\); font-size:13px;[^}]*color:var\(--text-mid\)/.test(FIN));
  assert.ok(/\.carb-stat-row \.val[^{]*\{[^}]*font-family:var\(--mono\)[^}]*tabular-nums/.test(FIN));
  assert.ok(/\.carb-autonomie-bloc \.val\{font-family:var\(--sans\); font-size:13px; font-weight:600/.test(FIN));
  assert.ok(SC.includes('carb-bloc-titre'));
});
t('pastilles de 40 px, badge rond de 20 px', () => {
  assert.ok(/\.carb-fiab-row\{[^}]*height:40px/.test(FIN));
  assert.ok(/\.carb-fiab-badge\{width:20px; height:20px; border-radius:50%/.test(FIN));
});
t('profondeur : dégradé du panneau, reflet intérieur de 1 px, ombre douce ; survol +2 px réservé au bureau et coupé en mouvement réduit', () => {
  assert.ok(/linear-gradient\(180deg, color-mix\(in srgb, var\(--panel\)/.test(FIN));
  assert.ok(/box-shadow:inset 0 1px 0/.test(FIN));
  assert.ok(/@media \(hover:hover\) and \(min-width:821px\)\{[^@]*translateY\(-2px\)/.test(FIN));
  assert.ok(/prefers-reduced-motion:reduce\)\{[^@]*transform:none/.test(FIN));
});
t('espacements : marge intérieure 20 px, légende détachée de 12 px en 12 px', () => {
  assert.ok(/border-radius:16px; padding:20px;/.test(FIN));
  assert.ok(/\.jauge-legende\{margin-top:12px;[^}]*font-size:12px/.test(FIN));
});
t('« À confirmer » avec accent (moteur)', () => {
  const M = fs.readFileSync(path.join(__dirname, 'nexus-carburant-moteur.js'), 'utf8');
  assert.ok(M.includes("texte: 'À confirmer'") && !M.includes("'A confirmer'"));
});
garde('liseré 3 px', FIN, c => /::before\{[^}]*height:3px/.test(c), 'height:3px', 'height:0');
garde('bordure --hairline', FIN, c => /\.statut-surveiller\{[^}]*border:1px solid var\(--hairline\)/.test(c), 'border:1px solid var(--hairline); border-radius:16px', 'border:1px solid var(--amber); border-radius:16px');
garde('pastilles en bas', FIN, c => /\.carb-pills\{margin-top:auto/.test(c), '.carb-pills{margin-top:auto', '.carb-pills{margin-top:0');
garde('% à 55 %', FIN, c => /\.carb-pct-signe\{font-size:\.55em/.test(c), 'font-size:.55em', 'font-size:1em');
garde('lignes de 32 px', FIN, c => /min-height:32px/.test(c), 'min-height:32px', 'min-height:40px');
garde('pastilles de 40 px', FIN, c => /height:40px; min-height:40px/.test(c), 'height:40px; min-height:40px', 'height:30px; min-height:30px');
garde('survol +2 px', FIN, c => /translateY\(-2px\)/.test(c), 'translateY(-2px)', 'translateY(-6px)');
garde('--surf Jour', SC, c => /--surf:#FFFFFF;/.test(c), '--surf:#FFFFFF;', '');
console.log(n + ' épreuves OK');
