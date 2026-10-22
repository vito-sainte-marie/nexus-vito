// Épreuves du lot JAUGEAGE-SAISIE-DIRECTE-20261022 : la saisie des quatre volumes
// passe devant la lecture automatique à l'écran de jaugeage Veeder-Root.
//
// Périmètre : NEXUS-Releves-Piste-v1.html (texte/markup de l'écran) et la logique
// pure ajoutée dans nexus-releves-piste.js (fusionnerLectureTardive). Aucun OCR,
// aucune Supabase Production : la logique de fusion est testée hors réseau.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }

const DIR = __dirname;
const html = fs.readFileSync(path.join(DIR, 'NEXUS-Releves-Piste-v1.html'), 'utf8');
const R = require('./nexus-releves-piste.js');

// ---- 1. Message après la photo : plus d'attente, consigne de saisie directe ----

t('LIB_STATUT.en_attente invite à saisir, ne parle plus de lecture différée', () => {
  const m = html.match(/en_attente:\s*'((?:[^'\\]|\\.)*)'/);
  assert.ok(m, 'en_attente introuvable dans LIB_STATUT');
  assert.strictEqual(m[1].replace(/\\'/g, '\''), 'Photo enregistrée. Saisissez les quatre volumes affichés sur l\'écran du Veeder-Root.');
});

t('« elle peut tarder » a disparu de l\'écran de jaugeage', () => {
  assert.ok(!/tarder/i.test(html));
});

t('le mot « échec » n\'est écrit nulle part sur cet écran', () => {
  assert.ok(!/échec/i.test(html));
});

// ---- 2. Après l'envoi réussi, le focus va au premier champ vide ----

t('envoyerPhoto() place le focus sur le premier volume vide après succès', () => {
  assert.ok(/jauge\.docId = ins\.data\.id; jauge\.statut = 'en_attente'; reseau\.ok = true; photoEnregistree = true;/.test(html));
  assert.ok(/if \(photoEnregistree\) focusPremierVolumeVide\(\);/.test(html));
});

t('focusPremierVolumeVide() cible le premier des quatre champs non saisis', () => {
  const m = html.match(/function focusPremierVolumeVide\(\)[\s\S]*?\n  \}/);
  assert.ok(m, 'focusPremierVolumeVide introuvable');
  const src = m[0];
  const cuves = ['SP-30', 'GO-20', 'GO-10', 'GNR-30'];
  const focused = [];
  const vm = require('vm');
  const ctx = {
    CUVES: cuves.map(k => ({ k })),
    jauge: { saisies: { 'SP-30': '12000', 'GO-20': '' } },
    document: { querySelector(sel) { const k = sel.match(/data-j="([^"]+)"/)[1]; return { focus() { focused.push(k); } }; } },
  };
  vm.createContext(ctx);
  vm.runInContext(src + '\nfocusPremierVolumeVide();', ctx);
  assert.deepStrictEqual(focused, ['GO-20']);
});

t('focusPremierVolumeVide() ne fait rien si les quatre volumes sont déjà saisis', () => {
  const m = html.match(/function focusPremierVolumeVide\(\)[\s\S]*?\n  \}/);
  const src = m[0];
  const cuves = ['SP-30', 'GO-20', 'GO-10', 'GNR-30'];
  const focused = [];
  const vm = require('vm');
  const ctx = {
    CUVES: cuves.map(k => ({ k })),
    jauge: { saisies: { 'SP-30': '1', 'GO-20': '2', 'GO-10': '3', 'GNR-30': '4' } },
    document: { querySelector() { focused.push('appelé'); return null; } },
  };
  vm.createContext(ctx);
  vm.runInContext(src + '\nfocusPremierVolumeVide();', ctx);
  assert.deepStrictEqual(focused, []);
});

// ---- 3. « Actualiser la lecture » devient un lien discret, plus un bouton plein ----

t('le bouton « Actualiser la lecture » porte la classe discrète .lien, plus .btn2', () => {
  assert.ok(/<button class="lien" data-act="jrafraichir">Actualiser la lecture<\/button>/.test(html));
  assert.ok(!/<button class="btn2" data-act="jrafraichir">/.test(html));
});

t('.lien est stylée en lien discret : jamais pleine largeur comme .btn2', () => {
  const m = html.match(/\.lien\{([^}]*)\}/);
  assert.ok(m, 'règle CSS .lien introuvable');
  assert.ok(!/width:100%/.test(m[1]));
  assert.ok(/text-decoration:underline/.test(m[1]));
});

// ---- 4. Une lecture tardive ne remplit que les champs vides, décoche la confirmation ----

t('fusionnerLectureTardive : remplit un champ vide depuis la proposition', () => {
  const r = R.fusionnerLectureTardive({ 'SP-30': '', 'GO-20': '18500' }, { 'SP-30': { volume_l: 12345 } });
  assert.strictEqual(r.saisies['SP-30'], '12345');
});

t('fusionnerLectureTardive : n\'écrase jamais une saisie déjà présente', () => {
  const r = R.fusionnerLectureTardive({ 'SP-30': '99999' }, { 'SP-30': { volume_l: 12345 } });
  assert.strictEqual(r.saisies['SP-30'], '99999');
});

t('fusionnerLectureTardive : décoche la confirmation dès qu\'une lecture exploitable arrive', () => {
  assert.strictEqual(R.fusionnerLectureTardive({ 'SP-30': '99999' }, { 'SP-30': { volume_l: 12345 } }).decocherConfirmation, true);
});

t('fusionnerLectureTardive : aucune proposition → ne décoche rien, ne modifie rien', () => {
  const r = R.fusionnerLectureTardive({ 'SP-30': '99999' }, {});
  assert.strictEqual(r.decocherConfirmation, false);
  assert.deepStrictEqual(r.saisies, { 'SP-30': '99999' });
});

t('fusionnerLectureTardive : une proposition illisible (volume_l null) ne remplit pas', () => {
  const r = R.fusionnerLectureTardive({ 'SP-30': '' }, { 'SP-30': { volume_l: null } });
  assert.strictEqual(r.saisies['SP-30'], '');
});

t('actualiserLecture() appelle fusionnerLectureTardive et jamais une fusion ad hoc', () => {
  const m = html.match(/async function actualiserLecture\(\)[\s\S]*?\n  \}/);
  assert.ok(m, 'actualiserLecture introuvable');
  const src = m[0];
  assert.ok(/R\.fusionnerLectureTardive\(jauge\.saisies, jauge\.propositions\)/.test(src));
  assert.ok(/if \(f\.decocherConfirmation\) jauge\.confirme = false;/.test(src));
});

console.log(`\n${n}/${n} tests passent (test_jaugeage_saisie_directe_20261022.js).`);
