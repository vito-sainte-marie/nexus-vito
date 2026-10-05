// Un transfert de titulaire n'impose pas de verdict — défaut constaté le
// 05/10/2026 : pour transférer le Q1 FDJ ouvert par erreur par un pompiste,
// Frédéric a dû choisir « Conforme », et l'enregistrement complet a écrit
// 29 comptages préremplis, deux rapports vides, une saisie de caisse et un
// audit `correction_manager` pour un simple changement de titulaire.
//
// Ce que ce test garde, sans base de données :
//   - FDJ Manager offre un bouton « Transférer seulement », affiché seulement
//     quand un transfert est en cours, et câblé à transfererSeulement() ;
//   - transfererSeulement() exige le motif (≥ 5 caractères) mais aucun verdict ;
//   - elle n'appelle que fdj_transferer_responsabilite_quart, puis relit le
//     quart : aucune écriture de table, aucune autre RPC ;
//   - elle traite les refus comme enregistrerEdition (`deja_responsable`
//     n'est pas une erreur).
//
// Preuve que chaque garde mord : chaque contrôle est rejoué sur une copie
// mutée en mémoire (ancre exigée unique) et doit alors échouer.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const FICHIERS = { manager: 'NEXUS-FDJ-Manager-v1.html' };
const SOURCES = {};
for (const [cle, f] of Object.entries(FICHIERS)) SOURCES[cle] = fs.readFileSync(path.join(__dirname, f), 'utf8');

// Corps d'une fonction JS : de `async function nom(` à la ligne `  }` qui la ferme.
function corpsFonction(src, nom) {
  const entete = `  async function ${nom}() {\n`;
  const debut = src.indexOf(entete);
  assert.ok(debut >= 0, `fonction ${nom} introuvable`);
  assert.strictEqual(src.indexOf(entete, debut + 1), -1, `${nom} définie deux fois`);
  const fin = src.indexOf('\n  }\n', debut);
  assert.ok(fin > debut, `fin de ${nom} introuvable`);
  return src.slice(debut, fin);
}

function sansCommentaires(texte) {
  return texte.split('\n').map(l => { const i = l.indexOf('//'); return i >= 0 ? l.slice(0, i) : l; }).join('\n');
}

const CONTROLES = {
  bouton_dans_le_bloc_transfert: S => {
    const src = S.manager;
    const ouverture = src.indexOf('${transfertEnCours() ? `\n      <div class="champ-note"');
    assert.ok(ouverture > 0, 'bloc de transfert introuvable');
    const fermeture = src.indexOf("` : ''}", ouverture);
    const bloc = src.slice(ouverture, fermeture);
    assert.ok(bloc.includes('id="champMotifTransfert"'), 'le motif doit rester dans le bloc');
    assert.ok(bloc.includes('<button type="button" class="btn-modifier" id="btnTransfererSeulement"'), 'bouton « Transférer seulement » absent du bloc de transfert');
    assert.strictEqual(src.split('id="btnTransfererSeulement"').length, 2, 'un seul bouton attendu');
  },
  bouton_cable: S => {
    const code = sansCommentaires(S.manager);
    assert.ok(code.includes("if (btnTransfererSeulement) btnTransfererSeulement.addEventListener('click', transfererSeulement);"),
      'le bouton doit déclencher transfererSeulement');
  },
  motif_exige_sans_verdict: S => {
    const code = sansCommentaires(corpsFonction(S.manager, 'transfererSeulement'));
    assert.ok(code.includes('if (!transfertEnCours()) return;'), 'sans transfert en cours, rien ne part');
    const garde = code.indexOf('if (motif.length < 5) {');
    assert.ok(garde > 0, 'le motif de 5 caractères doit être exigé');
    const garde2 = code.indexOf('return;', garde);
    assert.ok(garde2 > garde && garde2 < code.indexOf('nexusClient.rpc('), 'le refus du motif précède l\'appel réseau');
    assert.ok(!/resultatControle|verdictCoherentAvecEcart|motifEcartObligatoire/.test(code), 'aucun verdict ne doit être exigé');
  },
  seule_la_commande_de_transfert: S => {
    const code = sansCommentaires(corpsFonction(S.manager, 'transfererSeulement'));
    const rpcs = code.match(/nexusClient\.rpc\('([a-z_]+)'/g) || [];
    assert.deepStrictEqual(rpcs, ["nexusClient.rpc('fdj_transferer_responsabilite_quart'"], 'une seule RPC : le transfert');
    assert.ok(!/\.from\(|\.upsert\(|\.insert\(|\.update\(|enregistrerEdition\(/.test(code), 'aucune écriture de table ni enregistrement complet');
    assert.ok(code.includes('p_shift_id: edition.shiftId,') && code.includes('p_nouveau_responsable_id: edition.employeeId,') && code.includes('p_motif: motif,'),
      'arguments du transfert');
    assert.ok(code.trimEnd().endsWith('await rechargerQuartEdition();'), 'le quart est relu après le transfert');
  },
  refus_traites: S => {
    const code = sansCommentaires(corpsFonction(S.manager, 'transfererSeulement'));
    const iErr = code.indexOf('if (eTransfert) {');
    const iRefus = code.indexOf("if (rTransfert && rTransfert.transfere === false && rTransfert.motif !== 'deja_responsable') {");
    const iRelire = code.indexOf('await rechargerQuartEdition();');
    assert.ok(iErr > 0 && iRefus > iErr && iRelire > iRefus, 'erreur et refus doivent être traités avant la relecture');
    for (const i of [iErr, iRefus]) {
      const bloc = code.slice(i, code.indexOf('\n    }\n', i));
      assert.ok(/\breturn;/.test(bloc), 'un refus doit arrêter le geste');
      assert.ok(/alert\(/.test(bloc), 'un refus doit être affiché');
    }
  },
};

const MUTATIONS = [
  ['bouton_dans_le_bloc_transfert', 'manager', '      <button type="button" class="btn-modifier" id="btnTransfererSeulement" style="margin:-8px 0 6px;">Transférer seulement</button>\n', ''],
  ['bouton_cable', 'manager', "btnTransfererSeulement.addEventListener('click', transfererSeulement);", "btnTransfererSeulement.addEventListener('click', enregistrerEdition);"],
  ['motif_exige_sans_verdict', 'manager', '    if (motif.length < 5) {\n      alert(\'Indiquez', '    if (!edition.resultatControle || motif.length < 5) {\n      alert(\'Indiquez'],
  ['motif_exige_sans_verdict', 'manager', '    if (motif.length < 5) {\n      alert(\'Indiquez', '    if (false) {\n      alert(\'Indiquez'],
  ['seule_la_commande_de_transfert', 'manager', '    await rechargerQuartEdition();\n  }\n\n  async function enregistrerEdition() {', '    await enregistrerEdition();\n  }\n\n  async function enregistrerEdition() {'],
  ['seule_la_commande_de_transfert', 'manager', "      p_shift_id: edition.shiftId,\n      p_nouveau_responsable_id: edition.employeeId,\n      p_motif: motif,\n    });\n",
    "      p_shift_id: edition.shiftId,\n      p_nouveau_responsable_id: edition.employeeId,\n      p_motif: motif,\n    });\n    await nexusClient.from('fdj_reports').upsert([]);\n"],
  ['refus_traites', 'manager', "    if (rTransfert && rTransfert.transfere === false && rTransfert.motif !== 'deja_responsable') {\n      if (btnT) { btnT.disabled = false; btnT.textContent = 'Transférer seulement'; }\n      alert('Transfert refus\\u00e9 : ' + (rTransfert.message || rTransfert.motif));\n      return;\n",
    "    if (rTransfert && rTransfert.transfere === false && rTransfert.motif !== 'deja_responsable') {\n      if (btnT) { btnT.disabled = false; btnT.textContent = 'Transférer seulement'; }\n      alert('Transfert refus\\u00e9 : ' + (rTransfert.message || rTransfert.motif));\n"],
];

let reussis = 0;
const echecs = [];

console.log('=== Contrôles sur les sources réelles ===');
for (const [nom, controle] of Object.entries(CONTROLES)) {
  try { controle(SOURCES); reussis++; console.log(`  ok   ${nom}`); }
  catch (e) { echecs.push(`${nom} : ${e.message}`); console.log(`  ÉCHEC ${nom} : ${e.message}`); }
}

console.log('\n=== Mutations — chaque contrôle visé doit rougir ===');
const vises = new Set();
for (const [nom, cle, ancre, remplacement] of MUTATIONS) {
  const n = SOURCES[cle].split(ancre).length - 1;
  if (n !== 1) { echecs.push(`mutation ${nom}/${cle} : ancre trouvée ${n} fois (1 exigée)`); console.log(`  ÉCHEC ancre ${nom}/${cle} ×${n}`); continue; }
  const mutees = Object.assign({}, SOURCES, { [cle]: SOURCES[cle].replace(ancre, () => remplacement) });
  let rouge = false;
  try { CONTROLES[nom](mutees); } catch (_) { rouge = true; }
  if (rouge) { reussis++; vises.add(nom); console.log(`  ok   ${nom} rougit (${cle})`); }
  else { echecs.push(`${nom} reste vert sous mutation de ${cle}`); console.log(`  ÉCHEC ${nom} reste vert sous mutation (${cle})`); }
}
for (const nom of Object.keys(CONTROLES)) {
  if (!vises.has(nom)) echecs.push(`${nom} : aucune mutation ne le fait rougir`);
}

console.log(`\n${reussis} vérification(s) réussie(s), ${echecs.length} échec(s).`);
if (echecs.length) {
  echecs.forEach(e => console.error(`  - ${e}`));
  process.exit(1);
}
console.log('Tous les tests "transfert sans verdict" passent.');
