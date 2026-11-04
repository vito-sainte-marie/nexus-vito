// Épreuve — 04/11/2026 (Guardian #160, 6632758608, demande 2) : le service de jaugeage est versionné
//   (nexus-ocr-worker/jaugeage/) et le texte qu'il produit est bien lu par l'écran Relevés Piste.
// Chaîne éprouvée, sans photo réelle ni réseau :
//   lectures Vision SYNTHÉTIQUES (coordonnées et textes fabriqués ici)
//     -> lecture_jaugeage.analyser (contrôles compris)
//     -> jaugeage_service.texte_pour_releves_piste  (= resultat_texte écrit dans documents_ocr_file)
//     -> nexus-veeder-root.js lireEcranVeederRoot / completude.
// Python tourne en mode isolé (-I) ; le module du service s'importe sans supabase (import différé dans main()).
// Le dossier versionné ne doit contenir ni secret, ni .env, ni photo, ni binaire compilé, ni journal.

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');
const VR = require('./nexus-veeder-root.js');

const DOSSIER = path.join(__dirname, 'nexus-ocr-worker', 'jaugeage');

// --- 1. Contenu du dossier versionné -------------------------------------------------------------
const ATTENDUS = ['README.md', 'jaugeage_service.py', 'lecteur.swift', 'lecture_jaugeage.py', 'reference_cuves.json'];
assert.deepStrictEqual(fs.readdirSync(DOSSIER).sort(), ATTENDUS, 'Le dossier jaugeage ne contient que les 5 fichiers prévus');
for (const f of ATTENDUS) {
  const t = fs.readFileSync(path.join(DOSSIER, f), 'utf8');
  assert.ok(!/eyJ[A-Za-z0-9_-]{20,}/.test(t), `${f} : jeton JWT`);
  assert.ok(!/sb_secret_|service_role/i.test(t) || f === 'README.md', `${f} : mention de clé service`);
  assert.ok(!/(SERVICE_KEY|SUPABASE_URL)[ \t]*=[ \t]*\S+/.test(t), `${f} : variable d'environnement affectée d'une valeur`);
}
const readme = fs.readFileSync(path.join(DOSSIER, 'README.md'), 'utf8');
for (const mot of ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'NEXUS_SITE', 'NEXUS_JAUGEAGE_PRODUCTION=oui', 'lecteur-vision', '--une-fois']) {
  assert.ok(readme.includes(mot), `README : ${mot}`);
}
assert.ok(!/(SERVICE_KEY|SUPABASE_URL)[ \t]*=[ \t]*\S+/.test(readme), 'README : le .env est décrit SANS valeurs');

// --- 2. Lectures Vision synthétiques ------------------------------------------------------------
const ligne = (texte, x, y, largeur = 0.1) => ({ texte, confiance: 0.99, x, y, largeur, hauteur: 0.025 });
const LIBELLES = ['Volume Produit', 'Hauteur Produit', 'Espace Vide', 'Temperature', 'Hauteur Eau'];

// cuve = { n, repere, cap, produit, col (0|1), yTitre, valeurs: [volume, hauteur, espace, temp, eau] }
function vision(cuves, { horodatage = '04/11/2026 02:30 PM' } = {}) {
  const lignes = [];
  if (horodatage) lignes.push(ligne(horodatage, 0.3, 0.95, 0.3));
  for (const c of cuves) {
    const x0 = c.col === 0 ? 0.05 : 0.55;
    lignes.push(ligne(`RESERVOIR ${c.n}: ${c.repere} ${c.cap}M3 ${c.produit}`, x0, c.yTitre, 0.3));
    lignes.push(ligne(String(c.valeurs[0]), x0 + 0.03, c.yTitre - 0.1, 0.06)); // dessin de la cuve
    LIBELLES.forEach((l, i) => {
      const y = c.yTitre - 0.05 - i * 0.03;
      lignes.push(ligne(l, x0 + 0.15, y, 0.2));
      lignes.push(ligne(c.valeurs[i] === undefined ? '' : String(c.valeurs[i]), x0 + 0.4, y, 0.08));
    });
  }
  return { moteur: 'apple-vision', nb_lignes: lignes.length, lignes };
}
const CUVES = [
  { n: 1, repere: 'R1', cap: 30, produit: 'GO',  col: 0, yTitre: 0.85, valeurs: [12000, '1234.5', 16761, '18.2', '0.0'] },
  { n: 2, repere: 'R2', cap: 10, produit: 'SP',  col: 0, yTitre: 0.50, valeurs: [5000, '812.3', 4534, '17.9', '0.0'] },
  { n: 3, repere: 'R3', cap: 20, produit: 'GNR', col: 1, yTitre: 0.85, valeurs: [8000, '1010.0', 11019, '18.0', '0.0'] },
  { n: 4, repere: 'R4', cap: 30, produit: 'GO',  col: 1, yTitre: 0.50, valeurs: [9000, '902.4', 21000, '18.4', '0.0'] }, // 9000 + 21000 ≠ 30471 : à vérifier
];

function service(vis) {
  const code = `
import sys, json
sys.dont_write_bytecode = True
sys.path.insert(0, ${JSON.stringify(DOSSIER)})
import lecture_jaugeage as LJ, jaugeage_service as JS
r = LJ.analyser(json.load(sys.stdin))
print(json.dumps({"resultat": r, "texte": JS.texte_pour_releves_piste(r)}))`;
  const p = spawnSync('python3', ['-I', '-c', code], { input: JSON.stringify(vis), encoding: 'utf8', timeout: 30000 });
  assert.strictEqual(p.status, 0, `python3 a échoué : ${p.stderr}`);
  return JSON.parse(p.stdout);
}

// --- 3. Scénario A : une cuve douteuse ------------------------------------------------------------
const A = service(vision(CUVES));
assert.deepStrictEqual(A.resultat.cuves.map(c => c.statut), ['a_valider', 'a_valider', 'a_valider', 'a_verifier'], 'A : statuts du service');
assert.strictEqual(A.resultat.statut, 'a_verifier', 'A : une cuve douteuse rend la lecture entière à vérifier');
assert.strictEqual(A.resultat.horodatage_ecran, '2026-11-04T14:30');
assert.ok(A.texte.startsWith('ECRAN 2026-11-04T14:30\nRESERVOIR 1: R1 30M3 GO'), 'A : la ligne ECRAN précède le premier en-tête');
assert.ok(/RESERVOIR 4: R4 30M3 GO\nLECTURE A VERIFIER$/.test(A.texte), 'A : la cuve douteuse ne porte aucun nombre');

const lues = VR.lireEcranVeederRoot(A.texte);
assert.strictEqual(lues.length, 4, 'A : quatre blocs lus');
assert.deepStrictEqual(lues.map(c => [c.reservoir, c.produit, c.capacite_m3, c.volume_l, c.alerte]), [
  [1, 'GO', 30, 12000, null],
  [2, 'SP', 10, 5000, null],
  [3, 'GNR', 20, 8000, null],
  [4, 'GO', 30, null, 'valeur_absente'],
], 'A : volumes lus par l\'écran, la cuve douteuse reste illisible');
assert.deepStrictEqual(VR.completude(lues), { complet: false, manque: ['GO'] }, 'A : il manque un GO');

// --- 4. Scénario B : toutes les cuves lisibles -------------------------------------------------------
const B = service(vision(CUVES.map(c => c.n === 4 ? { ...c, valeurs: [9000, '902.4', 21471, '18.4', '0.0'] } : c)));
assert.deepStrictEqual(B.resultat.cuves.map(c => c.statut), ['a_valider', 'a_valider', 'a_valider', 'a_valider']);
assert.strictEqual(B.resultat.statut, 'a_valider');
const luesB = VR.lireEcranVeederRoot(B.texte);
assert.deepStrictEqual(luesB.map(c => c.volume_l), [12000, 5000, 8000, 9000], 'B : quatre volumes');
assert.deepStrictEqual(VR.completude(luesB), { complet: true, manque: [] }, 'B : jaugeage complet');

// --- 5. Scénario C : eau présente, un chiffre mal lu -----------------------------------------------------
const C = service(vision(CUVES.map(c => c.n === 2 ? { ...c, valeurs: [5000, '812.3', 4534, '17.9', '3.5'] } : c.n === 3 ? { ...c, valeurs: [8000, '1010.0', 11029, '18.0', '0.0'] } : c)));
assert.strictEqual(C.resultat.cuves[1].statut, 'a_verifier', 'C : de l\'eau est à confirmer par un humain');
assert.strictEqual(C.resultat.cuves[2].statut, 'a_verifier', 'C : un seul chiffre faux fait sauter volume + espace vide');
const luesC = VR.lireEcranVeederRoot(C.texte);
assert.deepStrictEqual(luesC.map(c => c.volume_l), [12000, null, null, null], 'C : seule la cuve sûre porte un volume (R4 garde son espace vide faux)');

// --- 6. Scénario D : texte sans aucun bloc de cuve -------------------------------------------------------------
// (le service lui-même lève une exception sur une photo sans titre : défaut signalé, non figé ici)
assert.deepStrictEqual(VR.lireEcranVeederRoot('ECRAN 2026-11-04T14:30'), [], 'D : rien à lire, rien d\'inventé');

console.log('test_jaugeage_service_resultat_texte_20261104 : 4 scénarios, dossier versionné sans secret ni photo — OK');
