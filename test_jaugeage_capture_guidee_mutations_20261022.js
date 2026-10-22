'use strict';
// Mutations de la capture guidée : chaque mutant d'une source doit rendre l'épreuve rouge.
const fs = require('fs'), os = require('os'), path = require('path'), { spawnSync } = require('child_process');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-capture-'));
const G = fs.readFileSync(path.join(__dirname, 'nexus-capture-guidee.js'), 'utf8');
const C = fs.readFileSync(path.join(__dirname, 'nexus-camera-page.js'), 'utf8');
const MUTANTS = [
  ['cadrage', 'proportion 5/3 -> 4/3', 'G', 'const PROPORTION_ECRAN = 5 / 3', 'const PROPORTION_ECRAN = 4 / 3'],
  ['cadrage', 'cadre non centré', 'G', 'x: (vueW - w) / 2', 'x: 0'],
  ['cadrage', 'consigne modifiée', 'G', "Faites entrer l\\'écran dans le cadre", "Cadrez l\\'écran"],
  ['recadrage', 'marge nulle (en-tête coupé)', 'G', 'const MARGE_RECADRAGE = 0.06', 'const MARGE_RECADRAGE = 0'],
  ['recadrage', 'marge haute supprimée', 'G', 'y0 = Math.max(0, Math.floor(v.y - my))', 'y0 = Math.max(0, Math.floor(v.y))'],
  ['recadrage', 'recadrage non borné', 'G', 'Math.min(videoW, Math.ceil(v.x + v.w + mx))', 'Math.ceil(v.x + v.w + mx)'],
  ['qualité', 'seuil de netteté nul', 'G', 'const SEUIL_NETTETE = 500', 'const SEUIL_NETTETE = 0'],
  ['qualité', 'seuil de netteté démesuré', 'G', 'const SEUIL_NETTETE = 500', 'const SEUIL_NETTETE = 100000'],
  ['qualité', 'reflet jamais détecté', 'G', 'const SEUIL_REFLET = 0.03', 'const SEUIL_REFLET = 2'],
  ['qualité', 'message de flou modifié', 'G', 'Photo floue, reprenez-la', 'Floue'],
  ['non-régression', 'guide appliqué sans option', 'C', 'if (guide && capturerGuide(video)) return;', 'if (capturerGuide(video)) return;'],
  ['non-régression', 'cadre posé sans option', 'C', 'if (guide) poserCadre(video);', 'poserCadre(video);'],
  ['non-régression', 'JPEG 0.92 changé dans le chemin historique (dernière occurrence)', 'C', "LAST:'image/jpeg', 0.92", "'image/jpeg', 0.8"],
  ['non-régression', 'consigne remplacée sans option', 'C', 'if (guide && guide.CONSIGNE) consigne = guide.CONSIGNE;', 'consigne = (guide || {}).CONSIGNE || consigne; consigne = "x";'],
];
let survivants = 0, applicables = 0;
MUTANTS.forEach(([axe, nom, cible, a0, b], i) => {
  let a = a0;
  const src = cible === 'G' ? G : C;
  const dernier = a.startsWith('LAST:'); if (dernier) a = a.slice(5);
  if (!src.includes(a)) { console.log(`INAPPLICABLE [${axe}] ${nom} (motif absent)`); survivants++; return; }
  applicables++;
  const f = path.join(dir, `m${i}-${cible === 'G' ? 'guide' : 'camera'}.js`);
  fs.writeFileSync(f, dernier ? src.slice(0, src.lastIndexOf(a)) + b + src.slice(src.lastIndexOf(a) + a.length) : src.replace(a, b));
  const env = Object.assign({}, process.env, cible === 'G' ? { NEXUS_CAPTURE_GUIDEE_SOURCE: f } : { NEXUS_CAMERA_SOURCE: f });
  const r = spawnSync(process.execPath, [path.join(__dirname, 'test_jaugeage_capture_guidee_20261022.js')], { env, encoding: 'utf8', timeout: 60000 });
  const tue = r.status !== 0;
  if (!tue) survivants++;
  console.log(`${tue ? 'TUÉ     ' : 'SURVIVANT'} [${axe}] ${nom}`);
});
fs.rmSync(dir, { recursive: true, force: true });
console.log(`mutations : ${applicables - survivants} tuées sur ${MUTANTS.length}, ${survivants} survivant(s) ou inapplicable(s)`);
process.exit(survivants ? 1 : 0);
