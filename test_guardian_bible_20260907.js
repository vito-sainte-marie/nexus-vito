// Épreuves du Guardian Bible / UX Terrain — « jamais un chiffre inventé ».
//
// POURQUOI CE FICHIER EXISTE. Un détecteur statique se juge sur deux choses,
// et une seule est facile : trouver ce qu'il cherche. La difficile est de NE
// PAS trouver ce qu'il ne cherche pas. Le dépôt contient 636 replis vers 0 et
// le garde en retient 17 : l'essentiel de sa valeur tient donc dans ses
// refus, et c'est ce que ce fichier éprouve en priorité.
//
// CE QU'IL VÉRIFIE EN PLUS. Que les épreuves elles-mêmes mordent. Un test qui
// passerait encore sur un garde saboté ne prouve rien. La dernière section
// MUTE le code du garde, vérifie que la mutation s'est réellement appliquée
// (sinon la conclusion « le test a détecté » serait un mensonge de plus), et
// exige que le comportement change.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const RACINE = __dirname;
const SOURCE_GARDE = path.join(RACINE, 'outils', 'guardian-bible.js');
const garde = require(SOURCE_GARDE);

let passes = 0;
function t(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

// ── Bac à sable ─────────────────────────────────────────────────────────
// Les cas d'épreuve sont écrits dans un dossier jetable, avec les noms que le
// garde reconnaît. Aucun fichier du dépôt n'est touché.
function avecFichiers(fichiers, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-bible-'));
  try {
    for (const [nom, contenu] of Object.entries(fichiers)) fs.writeFileSync(path.join(dir, nom), contenu);
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const ecran = (corps) => `<!doctype html><html><body>\n<script>\n${corps}\n</script>\n</body></html>\n`;

function findings(fichiers, module = garde) {
  return avecFichiers(fichiers, dir => module.analyser({ racine: dir }).findings);
}

// ═══ CE QUE LE GARDE DOIT VOIR ══════════════════════════════════════════

t('un volume absent affiché « 0 L » est un chiffre inventé', () => {
  const f = findings({ 'NEXUS-Cas-v1.html': ecran(
    'zone.innerHTML = `<div class="v">${releve.volume_mesure_l || 0} L</div>`;') });
  assert.strictEqual(f.length, 1, 'le cas nominal de la doctrine doit être vu');
  assert.strictEqual(f[0].expression, 'releve.volume_mesure_l');
  assert.strictEqual(f[0].code, 'chiffre_invente_repli_zero');
});

t('`??` ment autant que `||`', () => {
  // `??` ne se replie que sur null/undefined : c'est EXACTEMENT le cas
  // « la donnée n'existe pas encore » que la doctrine vise. L'oublier
  // laisserait passer la forme la plus littérale du défaut.
  const f = findings({ 'NEXUS-Cas-v1.html': ecran(
    'el.innerHTML = `${releve.index_depart ?? 0} L`;') });
  assert.strictEqual(f.length, 1);
});

t('une mise en forme monétaire porte l’unité en elle-même', () => {
  const f = findings({ 'NEXUS-Cas-v1.html': ecran(
    'const s = `<b>${fmtEur(d.impact_eur || 0)}</b>`;') });
  assert.strictEqual(f.length, 1, 'fmtEur() suffit à prouver que le chiffre est lu comme un montant');
  assert.strictEqual(f[0].sink, 'fonction_fmtEur');
});

t('`.toFixed()` et `.toLocaleString()` sont des chemins d’affichage', () => {
  const f = findings({ 'nexus-cas.js':
    'const a = `${(ev.note_globale || 0).toFixed(1)} / 5`;\n'
    + "const b = `${Math.round(x.montant || 0).toLocaleString('fr-FR')}`;\n" });
  assert.strictEqual(f.length, 2);
  assert.ok(f.every(x => x.sink === 'methode_de_mise_en_forme'));
});

t('les couches de données sont dans le périmètre, pas seulement les écrans', () => {
  const f = findings({ 'nexus-cas-donnees.js':
    'const phrase = `Conforme sur ${Math.round((ev.taux || 0) * 100)} % des quarts.`;\n' });
  assert.strictEqual(f.length, 1, 'un moteur qui fabrique la phrase affichée fabrique le chiffre affiché');
});

// ═══ CE QUE LE GARDE DOIT REFUSER DE VOIR ═══════════════════════════════
// Chacun de ces cas vient d'une famille réellement observée dans le dépôt.
// Ce sont eux qui font la différence entre un garde utilisable et 636 cris.

t('dire l’absence (« — ») est CONFORME et ne doit jamais être signalé', () => {
  assert.deepStrictEqual(findings({ 'NEXUS-Cas-v1.html': ecran(
    "el.innerHTML = `${releve.volume_mesure_l ?? '—'} L`;") }), [],
    'la doctrine demande ce repli : le garde doit se taire, pas féliciter');
});

t('une somme dont 0 est l’élément neutre n’invente rien', () => {
  assert.deepStrictEqual(findings({ 'nexus-cas.js':
    'const t = `${lignes.reduce((s, l) => s + (l.montant_eur || 0), 0)} €`;\n' }), []);
});

t('un terme d’addition écrit à la main non plus', () => {
  // `fmtEuro(ca + (tirages || 0))` — relevé sur NEXUS-FDJ-Analyse-v1.html.
  assert.deepStrictEqual(findings({ 'nexus-cas.js':
    'const t = `${fmtEuro(a.ca_grattage + (a.caisse_tirages || 0))}`;\n' }), []);
});

t('un dénombrement vaut légitimement zéro', () => {
  // « 0 alerte » est vrai ; « 0 L » ne l’est pas. C’est toute la différence.
  assert.deepStrictEqual(findings({ 'nexus-cas.js':
    'const t = `${alertes.nb_ouvertes || 0} alerte${x > 1 ? "s" : ""}`;\n' }), []);
});

t('un repli qui alimente une comparaison produit un drapeau, pas un chiffre', () => {
  // Relevé sur NEXUS-FDJ-v1.html:1861 : le repli choisit une classe CSS,
  // tandis que la valeur visible juste à côté est `?? ''`. Accuser ici
  // reviendrait à demander de corriger du code déjà conforme.
  assert.deepStrictEqual(findings({ 'NEXUS-Cas-v1.html': ecran(
    "el.innerHTML = `<button class=\"${(r.caisse_tirages ?? 0) < 0 ? 'actif' : ''}\">±</button>`;") }), []);
});

t('un repli qui ne part pas à l’affichage n’est pas jugé', () => {
  // Le garde ne sait pas ce que deviendra `seuil` : il se tait plutôt que de
  // supposer. Un contrôle qui ne sait pas conclure ne conclut pas.
  assert.deepStrictEqual(findings({ 'nexus-cas.js':
    'const seuil = configuration.seuil_alerte_l || 0;\n' }), []);
});

t('sans unité à l’écran, on ne peut pas affirmer que « 0 » ment', () => {
  assert.deepStrictEqual(findings({ 'NEXUS-Cas-v1.html': ecran(
    'el.innerHTML = `<div>${etat.documents_en_attente ?? 0}</div>`;') }), []);
});

t('un même défaut répété sur une ligne est UN défaut', () => {
  // Relevé sur NEXUS-Debug-v1.html:560 : couleur, signe et valeur replient la
  // même mesure. Trois cris pour une seule correction, c’est du bruit.
  const f = findings({ 'NEXUS-Cas-v1.html': ecran(
    "el.innerHTML = `<span style=\"color:${(a.ecart_total||0)===0?'g':'r'}\">"
    + "${(a.ecart_total||0)>=0?'+':''}${Math.round(a.ecart_total||0)} €</span>`;") });
  assert.strictEqual(f.length, 1);
});

t('les fichiers de test sont hors périmètre', () => {
  assert.deepStrictEqual(findings({ 'test_cas.js':
    'const t = `${x.volume_l || 0} L`;\n' }), [],
    'un jeu d’essai a le droit de fabriquer des chiffres — c’est sa raison d’être');
});

// ═══ LE MASQUE : LÀ OÙ LE GARDE S’EST DÉJÀ TROMPÉ ═══════════════════════

t('un `|| 0` en commentaire ou en chaîne n’affiche rien', () => {
  assert.deepStrictEqual(findings({ 'nexus-cas.js':
    '// exemple : `${x.volume_l || 0} L`\n'
    + 'const doc = "le motif x.montant_eur || 0 € est interdit";\n'
    + '/* bloc : ${y.montant_eur || 0} € */\n' }), []);
});

t('une apostrophe française dans un gabarit n’efface pas l’interpolation', () => {
  // Piège mesuré : traiter `'` comme une ouverture de chaîne à l’intérieur
  // d’un gabarit dévorait le `${...}` qui suit — donc le chemin d’affichage.
  const f = findings({ 'nexus-cas.js':
    "const p = `L'écart d'aujourd'hui est de ${a.ecart_total || 0} €`;\n" });
  assert.strictEqual(f.length, 1, 'le produit est en français : les apostrophes sont partout');
});

t('un littéral d’expression régulière ne déséquilibre pas l’analyse', () => {
  // `/\\d{2}[({]/` ouvre des accolades qui ne se ferment jamais et `/['"]/`
  // ouvre une « chaîne » qui dévore la suite. Avant correction, les 164
  // fichiers du dépôt dérivaient tous.
  const f = findings({ 'nexus-cas.js':
    "const re = /\\d{2}[({]/g;\nconst q = /['\"]/;\n"
    + 'const p = `${a.montant_eur || 0} €`;\n' });
  assert.strictEqual(f.length, 1, 'le repli qui SUIT une regex doit rester visible');
});

t('les parenthèses et accolades restent équilibrées sur tout le dépôt réel', () => {
  // Contrôle de non-dérive du masque : si une seule construction du dépôt
  // n’est pas comprise, les compteurs ne reviennent pas à zéro — et la pile
  // de contexte, donc les verdicts, deviennent faux sans prévenir.
  const enDerive = [];
  for (const f of garde.fichiersCandidats(RACINE)) {
    const src = fs.readFileSync(path.join(RACINE, f), 'utf8');
    const code = garde.neutraliser(f.endsWith('.html') ? garde.isolerScripts(src) : src);
    let par = 0, acc = 0;
    for (let i = 0; i < code.length; i++) {
      const c = code[i];
      if (c === '$' && code[i + 1] === '{') { acc++; i++; continue; }
      if (c === '{') acc++; else if (c === '}') acc--;
      else if (c === '(') par++; else if (c === ')') par--;
    }
    if (par !== 0 || acc !== 0) enDerive.push(`${f} (par ${par}, acc ${acc})`);
  }
  assert.deepStrictEqual(enDerive, [], 'masque en dérive : les verdicts ne sont plus fiables');
});

// ═══ CALIBRATION SUR LE DÉPÔT RÉEL ══════════════════════════════════════

t('le garde reste lisible sur le dépôt réel', () => {
  // La borne n’est pas cosmétique. Un contrôle qui rend des centaines de
  // findings est désactivé, et le principe qu’il protège se retrouve sans
  // gardien : le bruit est un mode de panne, pas un désagrément. Si ce test
  // casse par le haut, il faut recalibrer AVANT de relâcher la borne —
  // `analyser({ journal })` dit exactement quel filtre a laissé passer quoi.
  const journal = [];
  const r = garde.analyser({ racine: RACINE, journal });
  assert.ok(r.replisTotal > 500, `le dépôt doit bien contenir la matière (${r.replisTotal})`);
  assert.ok(r.findings.length <= 40,
    `${r.findings.length} findings sur ${r.replisTotal} replis — au-delà de 40, le garde n’est plus lu`);
  assert.ok(r.findings.length > 0, 'un garde muet sur un dépôt où le défaut existe n’est pas un garde');
  assert.ok(journal.length > 400, 'le journal de calibration doit rester exploitable');
});

t('le balayage complet tient dans le budget du lanceur', () => {
  // `run-tests.js` coupe chaque test à 30 s. Une première version de ce garde
  // mettait 55 s pour un seul balayage : elle passait seule en 29/29 et
  // échouait dans la suite, faisant croire à une régression fonctionnelle
  // là où il n’y avait qu’un `slice` quadratique. Un garde trop lent est un
  // garde désactivé, exactement comme un garde trop bruyant — la borne est
  // donc une épreuve, pas un commentaire. Elle est large pour absorber une
  // machine de CI lente sans devenir instable.
  const t0 = Date.now();
  garde.analyser({ racine: RACINE });
  const ms = Date.now() - t0;
  assert.ok(ms < 15000, `balayage en ${ms} ms — au-delà de 15 s, la suite entière est menacée`);
});

t('l’interface attendue par le routeur est présente', () => {
  assert.strictEqual(typeof garde.analyser, 'function');
  assert.strictEqual(typeof garde.executer, 'function');
  // `executer` reçoit les fichiers du diff : il doit filtrer lui-même son
  // périmètre plutôt que de faire confiance à l’appelant.
  const r = garde.executer({ racine: RACINE, fichiers: ['supabase/migrations/x.sql', '.github/workflows/tests.yml'] });
  assert.deepStrictEqual(r.findings, [], 'hors périmètre : ce garde n’a rien à dire');
});

// ═══ MUTATIONS DU GARDE LUI-MÊME ════════════════════════════════════════
// Une épreuve qui passe encore sur un garde saboté ne prouve rien. On casse
// donc le garde, à un endroit précis, et on exige que le comportement change.
//
// RÈGLE ABSOLUE ICI : vérifier que la mutation s’est APPLIQUÉE avant de lire
// son résultat. Une chaîne cible mal recopiée produirait un « aucune
// différence » qu’on prendrait pour « le garde est robuste » — soit
// exactement le genre de conclusion fabriquée que ce garde combat.
const SRC_ORIGINAL = fs.readFileSync(SOURCE_GARDE, 'utf8');

function gardeMute(cible, remplacement) {
  assert.ok(SRC_ORIGINAL.includes(cible),
    `MUTATION NON APPLICABLE : la cible n’existe plus dans le garde — ${cible.slice(0, 60)}…`);
  const mute = SRC_ORIGINAL.replace(cible, remplacement);
  assert.notStrictEqual(mute, SRC_ORIGINAL, 'la mutation n’a rien changé au source');
  assert.ok(!mute.includes(cible), 'la cible est toujours présente : mutation incomplète');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-bible-mutant-'));
  const chemin = path.join(dir, 'guardian-bible.js');
  fs.writeFileSync(chemin, mute);
  const mod = require(chemin);
  delete require.cache[chemin];
  return mod;
}

function mutation(nom, cible, remplacement, fichiers, attenduSain, verifier) {
  t(`mutation détectée — ${nom}`, () => {
    assert.deepStrictEqual(findings(fichiers).length, attenduSain,
      'le garde sain doit d’abord donner le résultat attendu');
    const mutant = gardeMute(cible, remplacement);
    verifier(findings(fichiers, mutant));
  });
}

mutation('le filtre « part-il à l’affichage ? » est retiré',
  "if (!sink) { noter('hors_affichage', p); continue; }",
  "if (!sink) { sink = 'methode_de_mise_en_forme'; }",
  { 'nexus-cas.js': 'const seuil = configuration.seuil_alerte_l || 0;\nconst autre = x.montant_eur || 0;\n' },
  0,
  f => assert.ok(f.length > 0, 'sans ce filtre le garde accuse du code qui n’affiche rien — non détecté'));

mutation('l’exclusion des sommes (`reduce`) est retirée',
  "if (appels.some(e => APPELS_ACCUMULATION.has(e.nom))) { noter('accumulation', p); continue; }",
  'if (false) { continue; }',
  // Agrégation NON additive : sur une somme, la règle « terme d’addition »
  // couvrirait déjà le cas et la mutation ne mordrait pas — on l’a mesuré.
  { 'nexus-cas.js': 'const t = `${lignes.reduce((s, l) => Math.max(s, l.montant_eur || 0), 0)} €`;\n' },
  0,
  f => assert.strictEqual(f.length, 1, 'une agrégation redeviendrait un finding — non détecté'));

mutation('l’exclusion des comparaisons est retirée',
  "noter('alimente_une_comparaison', p); continue;",
  'void 0;',
  { 'NEXUS-Cas-v1.html': ecran("el.innerHTML = `<b>${(r.ecart_eur ?? 0) < 0 ? 'moins' : 'plus'} €</b>`;") },
  0,
  f => assert.strictEqual(f.length, 1, 'un drapeau redeviendrait un chiffre inventé — non détecté'));

mutation('l’exigence d’unité à l’écran est retirée',
  'if (!RE_UNITE_AFFICHEE.test(apres))',
  'if (false)',
  { 'NEXUS-Cas-v1.html': ecran('el.innerHTML = `<div>${etat.documents_en_attente ?? 0}</div>`;') },
  0,
  f => assert.strictEqual(f.length, 1, 'un chiffre sans unité redeviendrait un finding — non détecté'));

mutation('l’exclusion des dénombrements est retirée',
  "if (mots.some(w => MOTS_DENOMBREMENT.has(w))) { noter('denombrement', p, { operande }); continue; }",
  'if (false) { continue; }',
  { 'nexus-cas.js': 'const t = `${alertes.nb_ouvertes || 0} u`;\n' },
  0,
  f => assert.strictEqual(f.length, 1, 'un compteur redeviendrait un finding — non détecté'));

mutation('la déduplication par ligne est retirée',
  'if (dejaVu.has(cle)) continue;',
  'if (false) continue;',
  { 'NEXUS-Cas-v1.html': ecran(
    'el.innerHTML = `<b>${Math.round(a.ecart_total||0)} €</b><i>${Math.round(a.ecart_total||0)} €</i>`;') },
  1,
  f => assert.strictEqual(f.length, 2, 'le même défaut serait crié plusieurs fois — non détecté'));

mutation('la reconnaissance des littéraux de regex est retirée',
  "if (c === '/' && regexPossible()) {",
  "if (false) {",
  // Sur la MÊME ligne : le masque de chaîne s’arrête au saut de ligne, donc
  // le dégât d’une regex mal comprise est borné à sa ligne — mesuré, pas
  // supposé. Une mutation qu’on ne sait pas rendre visible ne prouve rien.
  { 'nexus-cas.js': "const q = /['\"]/; const p = `${a.montant_eur || 0} €`;\n" },
  1,
  f => assert.strictEqual(f.length, 0, 'la regex dévorerait le code suivant — non détecté'));

mutation('le corps des gabarits n’est plus examiné avant les guillemets',
  '    if (dansGabarit()) {',
  '    if (false) {',
  { 'nexus-cas.js': "const p = `L'écart d'aujourd'hui est de ${a.ecart_total || 0} €`;\n" },
  1,
  f => assert.strictEqual(f.length, 0, 'l’apostrophe française masquerait l’interpolation — non détecté'));

mutation('`??` n’est plus reconnu comme un repli',
  'const RE_REPLI = /(\\|\\||\\?\\?)\\s*(?:0(?![\\w.])|\'0\'|"0")/g;',
  'const RE_REPLI = /(\\|\\|)\\s*(?:0(?![\\w.])|\'0\'|"0")/g;',
  { 'nexus-cas.js': 'const p = `${a.index_depart ?? 0} L`;\n' },
  1,
  f => assert.strictEqual(f.length, 0, 'la forme la plus littérale du défaut passerait — non détecté'));

console.log(`\n${passes} épreuve(s) passée(s) — outils/guardian-bible.js`);
