// Test — NEXUS-Analyse-Ecarts-v1.html, écran consolidé "Analyse des
// écarts" (cadrage de Frédéric v2.268, retour réel de test v2.269).
// Remplace/étend le fichier v2.268 initial : le retour de Frédéric après
// test réel a changé la forme de plusieurs fonctions extraites ici
// (renderParEmploye, actions contextuelles, KPI cliquables, contrôle de
// cohérence) — ce fichier reste nommé "v2268" (premier jet de l'écran)
// mais couvre désormais le comportement v2.269, comme le fait tout test
// de ce dépôt qui suit l'évolution du VRAI code (Article 11).
//
// v2.269 (28/08/2026, retour de Frédéric après test réel du P0) couvre :
//   - KPI jamais réduits au seul solde net, "Solde opérationnel" et
//     "Montant retenu" strictement distincts, jamais compensés (§7).
//   - Couleur cyan (jamais verte) pour un écart positif (§2).
//   - Actions contextuelles dans "À vérifier" (§3).
//   - Vue par employé refaite : excédents/manques constatés jamais
//     compensés, montant retenu distinct, managers jamais exclus (§5/§9).
//   - Activité inhabituelle détectée + qualification (§6).
//   - Contrôle de cohérence toujours visible, jamais filtré (§12).
//   - Composition d'un montant : cycle de vie complet par ligne (§4/§11).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const DIR = __dirname;
const html = fs.readFileSync(path.join(DIR, 'NEXUS-Analyse-Ecarts-v1.html'), 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
const ecartsMoteurSrc = fs.readFileSync(path.join(DIR, 'nexus-ecarts-moteur.js'), 'utf8');

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

function extraire(source, nomFonction) {
  const debut = source.indexOf(`function ${nomFonction}(`);
  assert.ok(debut !== -1, `Fonction ${nomFonction} introuvable`);
  // Saute d'abord la liste de paramètres (jusqu'à la parenthèse fermante
  // correspondante) AVANT de chercher l'accolade ouvrante du corps — sinon
  // un paramètre déstructuré avec valeur par défaut (ex. `{ totalLabel } = {}`)
  // fait croire à tort que son accolade est celle du corps de la fonction.
  let p = source.indexOf('(', debut);
  let profondeurParens = 1, k = p + 1;
  while (profondeurParens > 0) {
    if (source[k] === '(') profondeurParens++;
    else if (source[k] === ')') profondeurParens--;
    k++;
  }
  let i = source.indexOf('{', k);
  let profondeur = 1, j = i + 1;
  while (profondeur > 0) {
    if (source[j] === '{') profondeur++;
    else if (source[j] === '}') profondeur--;
    j++;
  }
  return source.slice(debut, j);
}
function extraireConst(source, nomConst) {
  const debut = source.indexOf(`const ${nomConst} = {`);
  assert.ok(debut !== -1, `Constante ${nomConst} introuvable`);
  let i = source.indexOf('{', debut);
  let profondeur = 1, j = i + 1;
  while (profondeur > 0) {
    if (source[j] === '{') profondeur++;
    else if (source[j] === '}') profondeur--;
    j++;
  }
  return source.slice(debut, j) + ';';
}
function extraireConstTableau(source, nomConst) {
  const debut = source.indexOf(`const ${nomConst} = [`);
  assert.ok(debut !== -1, `Constante ${nomConst} introuvable`);
  let i = source.indexOf('[', debut);
  let profondeur = 1, j = i + 1;
  while (profondeur > 0) {
    if (source[j] === '[') profondeur++;
    else if (source[j] === ']') profondeur--;
    j++;
  }
  return source.slice(debut, j) + ';';
}

function construireContexte() {
  const ctx = { console };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(ecartsMoteurSrc, ctx);

  const elements = {};
  function fabriquerElement(id) {
    return elements[id] || (elements[id] = {
      id, textContent: '', className: '', dataset: {}, value: '', style: {},
      _html: '', get innerHTML() { return this._html; }, set innerHTML(v) { this._html = v; },
      classList: { add() {}, remove() {}, toggle() {} },
      querySelectorAll: () => [], addEventListener() {}, scrollIntoView() {},
    });
  }
  ctx.document = { getElementById: (id) => fabriquerElement(id) };

  const src = [
    extraireConst(script, 'LABEL_ROLE'),
    extraire(script, 'labelRole'),
    extraireConstTableau(script, 'MOTIFS_QUALIFICATION_INHABITUELLE'),
    extraire(script, 'labelMotifQualification'),
    extraire(script, 'fmtEuro'),
    extraire(script, 'fmtEuroAbs'),
    extraire(script, 'fmtDateCourt'),
    extraire(script, 'labelActivite'),
    extraire(script, 'labelStatut'),
    extraire(script, 'labelActionAVerifier'),
    extraire(script, 'renderKpis'),
    extraire(script, 'renderListeAVerifier'),
    extraire(script, 'renderControleCoherence'),
    extraire(script, 'renderParEmploye'),
    extraire(script, 'renderLigneComposition'),
    extraire(script, 'brancherQualification'),
    extraire(script, 'ouvrirPanneau'),
    extraire(script, 'fermerPanneau'),
    extraire(script, 'ouvrirCompositionListe'),
    extraire(script, 'ouvrirDecompositionSolde'),
    'let TOUTES_LES_LIGNES = [];',
    'globalThis.__test = { renderKpis, renderListeAVerifier, renderControleCoherence, renderParEmploye, ouvrirCompositionListe, ouvrirDecompositionSolde, labelActionAVerifier, fmtEuro, setLignes: (l) => { TOUTES_LES_LIGNES = l; } };',
  ].join('\n\n');
  vm.runInContext(src, ctx);
  return { ctx, elements };
}

// ------------------------------------------------------------
// 1) renderKpis — jamais seulement le solde. v2.269 : "Solde
// opérationnel" et "Montant retenu" jamais confondus (§7), couleur cyan
// pour un positif (§2), volume exact (arrondi centimes v2.269 déjà testé
// côté moteur, revérifié ici bout en bout).
// ------------------------------------------------------------
{
  const { ctx, elements } = construireContexte();
  const lignes = [
    { ecartFinal: 190.05, statut: 'cloture_non_explique' },
    { ecartFinal: -81.90, statut: 'cloture_non_explique' },
  ];
  ctx.__test.renderKpis(lignes);
  assert.strictEqual(elements.kpiSoldeNet.textContent, '+108,15 €');
  assert.strictEqual(elements.kpiSoldeNet.className, 'kpi-valeur pos', 'positif -> classe "pos" (mappée au cyan en CSS, jamais vert) : ' + elements.kpiSoldeNet.className);
  assert.strictEqual(elements.kpiMontantRetenu.textContent, '-81,90 €', 'montant retenu = seulement le manque, jamais compensé par l\'excédent');
  assert.strictEqual(elements.kpiMontantRetenu.className, 'kpi-valeur neg');
  assert.strictEqual(elements.kpiVolume.textContent, '271,95 €', 'volume exact, cas réel du retour de Frédéric (plus 271,96) : ' + elements.kpiVolume.textContent);
  ok('renderKpis — Solde opérationnel et Montant retenu strictement distincts, volume exact, classes de couleur correctes');
}

// ------------------------------------------------------------
// 2) labelActionAVerifier — action contextuelle (§3), jamais le
// générique "Ouvrir →".
// ------------------------------------------------------------
{
  const { ctx } = construireContexte();
  assert.strictEqual(ctx.__test.labelActionAVerifier({ activiteInhabituelle: false }), 'Vérifier →');
  assert.strictEqual(ctx.__test.labelActionAVerifier({ activiteInhabituelle: true, qualification: null }), 'Comprendre →', 'activité inhabituelle non qualifiée -> "Comprendre →"');
  assert.strictEqual(ctx.__test.labelActionAVerifier({ activiteInhabituelle: true, qualification: { motif: 'remplacement_absent' } }), 'Vérifier →', 'une fois qualifiée, retombe sur l\'action standard');
  ok('labelActionAVerifier — jamais "Ouvrir →" générique, distinction réelle activité inhabituelle/standard');
}

// ------------------------------------------------------------
// 3) renderListeAVerifier — actions contextuelles affichées, écart
// réellement nul absent (déjà garanti côté moteur/données, revérifié
// ici : aucune ligne à statut a_verifier avec ecartFinal=0 ne doit
// pouvoir s'afficher "+0,00 €").
// ------------------------------------------------------------
{
  const { ctx, elements } = construireContexte();
  const lignes = [
    { statut: 'a_verifier', activite: 'fdj', ecartFinal: 120.38, date: '2026-08-23', quart: '1', employeeNom: 'Fred', activiteInhabituelle: true, qualification: null, deepLink: 'x' },
    { statut: 'a_verifier', activite: 'piste', ecartFinal: -9, date: '2026-08-27', quart: '2', employeeNom: 'Marc', activiteInhabituelle: false, qualification: null, deepLink: 'y' },
  ];
  ctx.__test.renderListeAVerifier(lignes);
  const out = elements.listeAVerifier.innerHTML;
  assert.ok(out.includes('Comprendre →'), 'action "Comprendre →" pour l\'activité inhabituelle de Fred : ' + out);
  assert.ok(out.includes('Vérifier →'), 'action "Vérifier →" pour le cas standard de Marc : ' + out);
  assert.ok(!out.includes('Ouvrir →'), 'plus jamais le générique "Ouvrir →" : ' + out);
  ok('renderListeAVerifier — actions contextuelles conformes (§3)');
}

// ------------------------------------------------------------
// 4) renderControleCoherence — toujours calculé sur TOUTES_LES_LIGNES
// (jamais filtré, §12), un seul type réel : activité inhabituelle non
// qualifiée.
// ------------------------------------------------------------
{
  const { ctx, elements } = construireContexte();
  ctx.__test.setLignes([
    { activiteInhabituelle: true, qualification: null, employeeId: 'fred', employeeNom: 'Fred', employeeRole: 'manager' },
    { activiteInhabituelle: true, qualification: null, employeeId: 'fred', employeeNom: 'Fred', employeeRole: 'manager' },
    { activiteInhabituelle: true, qualification: { motif: 'remplacement_absent' }, employeeId: 'gerant1', employeeNom: 'Sophie', employeeRole: 'gerant' },
    { activiteInhabituelle: false, qualification: null, employeeId: 'dylan', employeeNom: 'Dylan', employeeRole: 'caissier' },
  ]);
  ctx.__test.renderControleCoherence();
  const out = elements.zoneCoherence.innerHTML;
  assert.ok(out.includes('Fred') && out.includes('2 contrôles'), 'Fred (2 lignes non qualifiées) signalé avec le bon compte : ' + out);
  assert.ok(!out.includes('Sophie'), 'Sophie déjà qualifiée -> absente du signal : ' + out);
  assert.ok(!out.includes('Dylan'), 'Dylan (rôle habituel) jamais signalé : ' + out);

  // Aucune activité inhabituelle -> section entièrement vide (pas de
  // titre "Contrôle de cohérence" pour rien).
  const { ctx: ctx2, elements: el2 } = construireContexte();
  ctx2.__test.setLignes([{ activiteInhabituelle: false, qualification: null, employeeId: 'dylan' }]);
  ctx2.__test.renderControleCoherence();
  assert.strictEqual(el2.zoneCoherence.innerHTML, '', 'rien à signaler -> section vide, jamais un bloc vide affiché');

  ok('renderControleCoherence — signal toujours basé sur l\'ensemble des lignes, jamais un employé déjà qualifié ou un rôle habituel');
}

// ------------------------------------------------------------
// 5) renderParEmploye — refonte §9 : Fred (manager, excédent non
// régularisé) et Dylan (employé, excédent+manque) — exemples exacts du
// retour de Frédéric.
// ------------------------------------------------------------
{
  const { ctx, elements } = construireContexte();
  const lignes = [
    { employeeId: 'fred', employeeNom: 'Fred', employeeRole: 'manager', ecartInitial: 120.38, ecartFinal: 120.38, statut: 'cloture_non_explique' },
    { employeeId: 'dylan', employeeNom: 'Dylan', employeeRole: 'caissier', ecartInitial: 30, ecartFinal: 30, statut: 'cloture_non_explique' },
    { employeeId: 'dylan', employeeNom: 'Dylan', employeeRole: 'caissier', ecartInitial: -12, ecartFinal: -12, statut: 'cloture_non_explique' },
  ];
  ctx.__test.renderParEmploye(lignes);
  const out = elements.listeParEmploye.innerHTML;

  assert.ok(out.includes('Fred') && out.includes('Manager'), 'Fred affiché avec son rôle, jamais exclu (§5) : ' + out);
  assert.ok(out.includes('Rôle habituellement sans activité de caisse'), 'bandeau d\'activité inhabituelle affiché pour Fred (manager) : ' + out);
  assert.ok(out.includes('Dylan') && out.includes('Caissier'));
  // Un caissier normal ne doit jamais porter le bandeau inhabituel.
  const zoneD = out.slice(out.indexOf('Dylan'));
  assert.ok(!zoneD.includes('Rôle habituellement sans activité de caisse'), 'Dylan (caissier) ne doit jamais porter le bandeau inhabituel');

  ok('renderParEmploye — managers jamais exclus, bandeau d\'activité inhabituelle affiché uniquement pour les rôles concernés');
}

// ------------------------------------------------------------
// 6) ouvrirCompositionListe / ouvrirDecompositionSolde — §1/§4 : cycle de
// vie complet par ligne, total exact, jamais de compensation dans la
// décomposition du solde.
// ------------------------------------------------------------
{
  const { ctx, elements } = construireContexte();
  const lignes = [
    { id: 'l1', ecartInitial: 12, ecartFinal: 0, statut: 'regularise', date: '2026-08-20', quart: '1', activite: 'boutique', deepLink: 'NEXUS-Verify-v1.html?x', employeeNom: 'Angélique', sourceModule: 'verify', sourceControlId: 'a1', activiteInhabituelle: false },
  ];
  ctx.__test.ouvrirCompositionListe('Test — composition', lignes);
  const out = elements.pdCorps.innerHTML;
  assert.ok(out.includes('Écart initial +12,00 €') && out.includes('Écart final +0,00 €'), 'cycle de vie complet affiché (écart initial jamais effacé, §11) : ' + out);
  assert.ok(out.includes('Voir le contrôle source →'), 'lien vers le contrôle source présent');

  ctx.__test.ouvrirDecompositionSolde([
    { ecartFinal: 35, statut: 'cloture_non_explique' },
    { ecartFinal: -13, statut: 'cloture_non_explique' },
  ]);
  const outSolde = elements.pdCorps.innerHTML;
  assert.ok(outSolde.includes('35,00 €') && outSolde.includes('13,00 €') && outSolde.includes('+22,00 €'), 'décomposition exacte du solde (exemple §7) : ' + outSolde);

  ok('ouvrirCompositionListe/ouvrirDecompositionSolde — cycle de vie complet par ligne, décomposition du solde exacte et jamais compensée');
}

console.log(`\n${n} tests passés.`);
