// Passage du moteur T1 sur les données réelles de Sainte-Marie, en lecture seule (fichiers locaux, aucun réseau).
// node executer_sainte_marie_t1.js  → resultats/resultats_sainte_marie_t1.json
const fs = require('fs'), path = require('path');
globalThis.window = globalThis;
require('./nexus-produits-mesure.js');
const T = require('./nexus-politique-tarifaire.js');
const lire = f => JSON.parse(fs.readFileSync(path.join(__dirname, 'donnees', f), 'utf8'));
const config = require('./config_sainte_marie_t1.js');

const ventes = lire('ventes_decenium_2periodes.json').map(r => Object.assign({}, r, { categorie: String(r.categorie || '').replace(/Ã\u00a0/g, 'à').replace(/\s+/g, ' ').trim() }));
const P1 = ventes.filter(r => r.periode_debut === '2026-09-19'), P2 = ventes.filter(r => r.periode_debut === '2026-10-05');
const RAYONS = new Set(config.RAYONS);
const portee = rows => rows.filter(r => RAYONS.has(r.categorie));
const stock = lire('stock_pa_net_ht_20261110.json').lignes;

const res = T.analyser(portee(P2), portee(P1), Object.assign({}, config.contexte, { stock }));
fs.mkdirSync(path.join(__dirname, 'resultats'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'resultats', 'resultats_sainte_marie_t1.json'), JSON.stringify(res, null, 1));

const s = res.synthese, g = res.gains;
console.log('Références', s.references, '| fiabilité', s.fiabilite, '| conformité', s.conformite);
console.log('Statuts', s.statuts);
console.log('Alertes', s.alertes);
console.log('Règles', s.regles);
for (const sc of ['prixDecides', 'minimum', 'cible']) console.log('décisionnel', sc.padEnd(12), JSON.stringify(g.decisionnels[sc]));
for (const sc of ['minimum', 'cible']) console.log('repère indicatif, non décisionnel', sc.padEnd(8), JSON.stringify(g.reperesIndicatifs[sc]));
console.log('preuves techniques (insuffisantes, jamais un gain exploitable)', JSON.stringify(g.preuvesTechniques));
console.log('Exclus réglementaire', s.exclusReglementaire, '| exceptions validées', s.exclusException);
console.log('Coût', s.cout.libelle, '|', s.cout.methode);
