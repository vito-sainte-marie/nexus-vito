'use strict';
// Mutations de « Envoyer quand même » : chaque mutant doit rendre l'épreuve rouge.
const fs = require('fs'), os = require('os'), path = require('path'), { spawnSync } = require('child_process');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-forcee-'));
const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const SRC = { G: lire('nexus-capture-guidee.js'), C: lire('nexus-camera-page.js'), P: lire('NEXUS-Releves-Piste-v1.html') };
const ENV = { G: 'NEXUS_CAPTURE_GUIDEE_SOURCE', C: 'NEXUS_CAMERA_SOURCE', P: 'NEXUS_RELEVES_SOURCE' };
const EXT = { G: 'js', C: 'js', P: 'html' };
const MUTANTS = [
  ['bouton', 'absent au 2e refus (seuil 3)', 'G', 'const SEUIL_REFUS_FORCER = 2', 'const SEUIL_REFUS_FORCER = 3'],
  ['bouton', 'présent dès le 1er refus (seuil 1)', 'G', 'const SEUIL_REFUS_FORCER = 2', 'const SEUIL_REFUS_FORCER = 1'],
  ['bouton', 'compteur jamais remis à zéro', 'G', '(q && q.ok) ? 0 : compteur + 1', 'compteur + (q && q.ok ? 0 : 1)'],
  ['bouton', 'chaque verdict compté, même accepté', 'G', '(q && q.ok) ? 0 : compteur + 1', 'compteur + 1'],
  ['bouton', 'bouton strictement après le 2e refus', 'G', 'compteur >= SEUIL_REFUS_FORCER', 'compteur > SEUIL_REFUS_FORCER'],
  ['marque', 'qualite_forcee absent', 'G', 'qualite_forcee: true, nettete', 'qualite_forcee: false, nettete'],
  ['marque', 'netteté non conservée', 'G', 'nettete: q.nettete, reflet: q.reflet, motif', 'nettete: 0, reflet: q.reflet, motif'],
  ['marque', 'reflet non conservé', 'G', 'nettete: q.nettete, reflet: q.reflet, motif', 'nettete: q.nettete, reflet: 0, motif'],
  ['marque', 'suffixe sans netteté', 'G', "'_qforcee-n' + Math.round(d.nettete) + '-r'", "'_qforcee-n0-r'"],
  ['marque', 'suffixe posé pour une photo non forcée', 'G', "if (!d || d.qualite_forcee !== true) return '';", ''],
  ['seuils', 'seuil de netteté modifié', 'G', 'const SEUIL_NETTETE = 500', 'const SEUIL_NETTETE = 450'],
  ['seuils', 'seuil de reflet modifié', 'G', 'const SEUIL_REFLET = 0.03', 'const SEUIL_REFLET = 0.05'],
  ['câblage', 'compteur non alimenté par la caméra', 'C', 'refus = guide.refusSuivant(refus, q);', ''],
  ['câblage', 'bouton non conditionné au compteur', 'C', 'guide.forcagePropose(refus) ?', 'true ?'],
  ['câblage', 'photo validée sans marque', 'C', 'if (forcee) f.qualiteForcee = guide.descriptifForcee(forcee);', ''],
  ['câblage', 'libellé du bouton modifié', 'C', "b.textContent = 'Envoyer quand même'", "b.textContent = 'Envoyer'"],
  ['envoi', 'marque lue sur le fichier redimensionné', 'P', 'forcee: fichier.qualiteForcee', 'forcee: envoi.qualiteForcee'],
];
let survivants = 0, applicables = 0;
MUTANTS.forEach(([axe, nom, cible, a, b], i) => {
  if (!SRC[cible].includes(a)) { console.log(`INAPPLICABLE [${axe}] ${nom} (motif absent)`); survivants++; return; }
  applicables++;
  const f = path.join(dir, `m${i}.${EXT[cible]}`);
  fs.writeFileSync(f, SRC[cible].replace(a, b));
  const r = spawnSync(process.execPath, [path.join(__dirname, 'test_jaugeage_qualite_forcee_20261022.js')], { env: Object.assign({}, process.env, { [ENV[cible]]: f }), encoding: 'utf8', timeout: 60000 });
  const tue = r.status !== 0; if (!tue) survivants++;
  console.log(`${tue ? 'TUÉ     ' : 'SURVIVANT'} [${axe}] ${nom}`);
});
fs.rmSync(dir, { recursive: true, force: true });
console.log(`mutations : ${applicables - survivants} tuées sur ${MUTANTS.length}, ${survivants} survivant(s) ou inapplicable(s)`);
process.exit(survivants ? 1 : 0);
