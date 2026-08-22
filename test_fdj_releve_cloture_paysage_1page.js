// Test — Relevé de clôture FDJ en A4 PAYSAGE, toujours 1 SEULE page à
// l'impression (21/08/2026, demande de Frédéric : "peux-tu faire en sorte
// que le relevé de clôture fdj de chaque quart soit en mode paysage et
// qu'il s'adapte à une seule feuille A4 à l'impression").
//
// Avant ce lot, construireReleveClotureQuartPdf (NEXUS-FDJ-Manager-v1.html)
// utilisait ConstructeurRapport (pagination libre, portrait) — un quart
// avec beaucoup de versions/corrections pouvait déjà déborder sur
// plusieurs pages. Ce test vérifie spécifiquement les deux exigences :
// (1) la page créée est bien en PAYSAGE (largeur > hauteur), (2) une
// seule page est TOUJOURS créée, même avec un historique de versions ou
// une liste de jeux volontairement excessifs (stress test).
//
// Extrait les vraies fonctions de NEXUS-FDJ-Manager-v1.html et le vrai
// nexus-pdf-moteur.js (pdf-lib mocké au plus bas niveau), même discipline
// que test_fdj_releve_manager_ecran.js.

const fs = require('fs');
const assert = require('assert');

const CHEMIN_BASE = __dirname;
const html = fs.readFileSync(`${CHEMIN_BASE}/NEXUS-FDJ-Manager-v1.html`, 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

function extraire(nomFonction) {
  const debut = (() => {
    const iAsync = script.indexOf(`async function ${nomFonction}(`);
    if (iAsync !== -1) return iAsync;
    return script.indexOf(`function ${nomFonction}(`);
  })();
  assert.ok(debut !== -1, `Fonction ${nomFonction} introuvable`);
  let i = script.indexOf('{', debut);
  let profondeur = 1, j = i + 1;
  while (profondeur > 0) {
    if (script[j] === '{') profondeur++;
    else if (script[j] === '}') profondeur--;
    j++;
  }
  return script.slice(debut, j);
}
function extraireConst(nomConst) {
  const debut = script.indexOf(`const ${nomConst} = `);
  assert.ok(debut !== -1, `Constante ${nomConst} introuvable`);
  const fin = script.indexOf(';\n', debut);
  return script.slice(debut, fin + 1);
}

// ------------------------------------------------------------
// Mock pdf-lib — capture la TAILLE de chaque page créée (largeur/hauteur),
// ce que test_fdj_releve_manager_ecran.js ne faisait pas (il vérifiait
// seulement qu'au moins une page existait).
// ------------------------------------------------------------
global.PDFLib = {
  PDFDocument: { create: async () => fakeDoc() },
  StandardFonts: { Helvetica: 'Helvetica', HelveticaBold: 'Helvetica-Bold' },
  rgb: (r, g, b) => ({ r, g, b }),
};
const srcPdfMoteur = fs.readFileSync(`${CHEMIN_BASE}/nexus-pdf-moteur.js`, 'utf8');
const windowPdf = {};
const fnPdf = new Function('window', 'PDFLib', 'navigator', 'document', 'URL', srcPdfMoteur + '\nreturn window.NexusPdfMoteur;');
const NexusPdfMoteur = fnPdf(windowPdf, global.PDFLib, {}, {}, {});

let pagesCreees = [];
const fakeFont = { widthOfTextAtSize: (t, s) => String(t).length * s * 0.5 };
function makeFakePage() {
  return { drawText: () => {}, drawRectangle: () => {}, drawLine: () => {}, drawImage: () => {} };
}
function fakeDoc() {
  const pages = [];
  return {
    addPage: (dims) => { pagesCreees.push(dims); const p = makeFakePage(); pages.push(p); return p; },
    getPages: () => pages,
    embedFont: async () => fakeFont,
    setTitle: () => {}, setAuthor: () => {}, setSubject: () => {}, setCreator: () => {}, setProducer: () => {},
    save: async () => new Uint8Array([1, 2, 3]),
  };
}

async function run() {
  // Volontairement 12 jeux (bien plus que les 3-6 habituels) pour
  // vérifier que tableauCompact plafonne sans planter.
  const jeux = Array.from({ length: 12 }, (_, i) => ({ id: `j${i}`, nom: `JEU ${i}`, ordre_affichage: i }));
  const employesSite = [{ id: 'e1', nom: 'Loane' }, { id: 'e2', nom: 'Manager Test' }];
  const src = [
    extraireConst('LABELS_DIFF_RELEVE'),
    extraire('formatValeurDiffReleve'),
    extraireConst('LIBELLES_TYPE_VERSION_RELEVE'),
    extraire('libelleTypeVersionReleve'),
    extraire('libelleCaractereReleve'),
    extraireConst('STATUTS_CAISSE'),
    extraire('labelStatutCaisse'),
    extraire('labelStatutRelevecloture'),
    extraire('libelleAnomalieChaine'),
    extraire('nomJeu'),
    extraire('nomEmploye'),
    extraire('jeuxDuSnapshot'),
    extraire('construireReleveClotureQuartPdf'),
    'function fmtEuro(n) { return (n === null || n === undefined || n === \'\' || isNaN(n)) ? \'—\' : `${Number(n).toLocaleString(\'fr-FR\', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`; }',
    'function fmtNum(n) { return (n === null || n === undefined) ? \'—\' : Number(n).toLocaleString(\'fr-FR\', { maximumFractionDigits: 2 }); }',
  ].join('\n');
  const ctx = { jeux, employesSite, NexusPdfMoteur, console };
  ctx.globalThis = ctx;
  const fn = new (require('vm').Script)(`${src}\nglobalThis.__construireReleveClotureQuartPdf = construireReleveClotureQuartPdf;`);
  require('vm').createContext(ctx);
  fn.runInContext(ctx);

  const shift = { id: 'shift-stress', date: '2026-08-21', quart: '1', employee_id: 'e1' };

  // Cas normal : 1 version, quelques jeux avec vente. Sert de témoin.
  const stockInitial = {}, appro = {}, stockFinal = {}, ventes = {};
  jeux.forEach((j, i) => { stockInitial[j.id] = 10 + i; appro[j.id] = i % 2; stockFinal[j.id] = 5 + i; ventes[j.id] = { qte: i, valeur: i * 10 }; });
  const versionBase = (n, override = {}) => ({
    version_num: n, type_version: n === 1 ? 'validation_employe' : 'regularisation_manager',
    cree_le: `2026-08-2${n}T09:00:00Z`, cree_par: n === 1 ? null : 'e2',
    stock_initial_par_jeu: stockInitial, appro_par_jeu: appro, stock_final_par_jeu: stockFinal, ventes_par_jeu: ventes,
    ventes_grattage_valeur: 120, lots_payes_grattage: 15, caisse_tirages: 30, regularisations: 0,
    caisse_attendue: 135, caisse_reelle: 135, ecart: 0,
    anomalie_chaine: { chaine_interrompue: false, continuite_stock_a_verifier: false },
    statut: 'conforme', caractere: 'definitif',
    motif_regularisation: n > 1 ? `Correction n°${n} : ajustement mineur suite à un pointage tardif du manager.` : null,
    diff_vs_precedent: n > 1 ? { ecart: { avant: 1, apres: 0 } } : null,
    signature: { nom: n === 1 ? 'Loane' : 'Manager Test', role: n === 1 ? 'employe' : 'manager', date_heure: `2026-08-2${n}T09:00:00Z` },
    ...override,
  });

  pagesCreees = [];
  const pdfNormal = await ctx.__construireReleveClotureQuartPdf(shift, [versionBase(1)]);
  assert.strictEqual(pagesCreees.length, 1, 'Cas normal (1 version) : exactement 1 page créée');
  assert.ok(pagesCreees[0][0] > pagesCreees[0][1], `Page en PAYSAGE attendue (largeur > hauteur) — reçu ${pagesCreees[0][0]} x ${pagesCreees[0][1]}`);
  assert.ok(pdfNormal.bytes.length > 0);
  console.log(`OK — cas normal (12 jeux, 1 version) : 1 page, paysage confirmé (${pagesCreees[0][0].toFixed(1)} x ${pagesCreees[0][1].toFixed(1)} pt).`);

  // Stress test : 20 versions (bien plus que ce qu'un vrai quart FDJ
  // accumule en pratique) — avant ce lot, un historique de cette taille
  // avec ConstructeurRapport (pagination libre) aurait probablement
  // débordé sur plusieurs pages. Doit rester 1 SEULE page, quitte à
  // plafonner l'historique affiché (listePoints gère déjà ce renvoi).
  const versions20 = Array.from({ length: 20 }, (_, i) => versionBase(i + 1));
  pagesCreees = [];
  const pdfStress = await ctx.__construireReleveClotureQuartPdf(shift, versions20);
  assert.strictEqual(pagesCreees.length, 1, 'Stress test (20 versions, 12 jeux) : exactement 1 page créée, jamais un débordement');
  assert.ok(pagesCreees[0][0] > pagesCreees[0][1], 'Stress test : page toujours en paysage');
  assert.ok(pdfStress.bytes.length > 0);
  console.log(`OK — stress test (12 jeux, 20 versions) : toujours 1 seule page A4 paysage (largeur ${pagesCreees[0][0].toFixed(1)}pt > hauteur ${pagesCreees[0][1].toFixed(1)}pt), aucun débordement.`);

  // Relevé provisoire (bandeau conditionnel) : doit aussi rester 1 page.
  pagesCreees = [];
  const pdfProvisoire = await ctx.__construireReleveClotureQuartPdf(shift, [versionBase(1, { caractere: 'provisoire' })]);
  assert.strictEqual(pagesCreees.length, 1, 'Relevé provisoire (bandeau affiché) : toujours 1 seule page');
  console.log('OK — relevé provisoire (bandeau conditionnel affiché) : toujours 1 seule page, le corps s\'adapte à l\'espace restant.');

  // Vérifie que le format de page utilisé est bien celui d'un A4 (aire
  // conservée), pas un format inventé — largeur et hauteur inversées
  // par rapport au portrait A4 (595.28 x 841.89 pt).
  const [largeur, hauteur] = pagesCreees[0];
  assert.ok(Math.abs(largeur - 841.89) < 0.01 && Math.abs(hauteur - 595.28) < 0.01, `Dimensions A4 paysage attendues (841.89 x 595.28 pt) — reçu ${largeur} x ${hauteur}`);
  console.log('OK — dimensions exactes A4 paysage (841.89 x 595.28 pt, aire A4 conservée, simple rotation).');

  console.log('\nTous les tests "Relevé de clôture FDJ — A4 paysage, 1 page" passent.');
}

run().catch(e => { console.error('ECHEC:', e); process.exit(1); });
