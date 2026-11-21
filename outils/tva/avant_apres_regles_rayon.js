// Avant / après : références comptées « TVA à vérifier » par l'accueil Produits, sans puis avec les décisions du pilote par rayon (18/11/2026).
// Usage : node outils/tva/avant_apres_regles_rayon.js <products.json> [confirmations.json] [periodeDebut periodeFin]
// products.json : lignes de produits du site pilote (article, categorie, tva, periode_debut, periode_fin, ...). Lecture seule, rien n'est écrit.
const fs = require('fs'), path = require('path'), vm = require('vm');
const racine = path.join(__dirname, '..', '..');
const [fp, fc, d, f] = process.argv.slice(2);
if (!fp) { console.error('Usage : node avant_apres_regles_rayon.js <products.json> [confirmations.json] [debut fin]'); process.exit(2); }
const products = JSON.parse(fs.readFileSync(fp, 'utf8'));
const registre = fc ? JSON.parse(fs.readFileSync(fc, 'utf8')) : [];
const charger = (regles) => {
  const sb = { console }; sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
  ['nexus-conseiller.js', 'nexus-marge.js'].concat(regles ? ['nexus-tva-regles-pilote.js'] : [], ['nexus-produits-mesure.js'])
    .forEach(n => vm.runInContext(fs.readFileSync(path.join(racine, n), 'utf8'), sb, { filename: n }));
  return sb.NexusProduitsMesure;
};
const site = 'vito-sainte-marie';
const run = (M) => M.mesurer({ products, site, periodeDebut: d, periodeFin: f, tvaConfirmations: registre, dateReference: f })
  .mesures.filter(m => m.tva && m.tva.etat === 'incoherente');
const cle = m => m.article;
const avant = run(charger(false)), apres = run(charger(true));
const reste = new Set(apres.map(cle));
const rayon = a => (products.find(p => p.article === a) || {}).categorie || '';
console.log('AVANT (registre seul) : ' + avant.length + ' références à vérifier');
console.log('APRÈS (registre + règles de rayon) : ' + apres.length);
console.log('\nRetirées par les règles de rayon :');
avant.filter(m => !reste.has(cle(m))).forEach(m => console.log('  - ' + m.article + ' | ' + rayon(m.article)));
console.log('\nRestent à vérifier (hors des cinq rayons du 18/11 ou contredites) :');
apres.forEach(m => console.log('  - ' + m.article + ' | ' + rayon(m.article) + ' | ' + m.tva.raison));
process.exit(apres.length ? 1 : 0);
