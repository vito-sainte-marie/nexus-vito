// Test — Trace de contrôle FDJ, écran manager (16/08/2026) : relevé par
// quart + export journée complète + historique par employé.
//
// Extrait les vraies fonctions de NEXUS-FDJ-Manager-v1.html (jamais
// réécrites à la main), comme tous les tests de ce module.
//
// Deux volets :
//  1. Fonctions utilitaires pures (jeuxDuSnapshot, formatValeurDiffReleve,
//     libelleTypeVersionReleve, libelleCaractereReleve, decalerMois,
//     libelleMoisAnnee) — vérifiées directement.
//  2. Composition PDF (construireReleveClotureQuartPdf,
//     construireExportJourneePdf) — exécutée contre le VRAI
//     nexus-pdf-moteur.js (pdf-lib mocké au plus bas niveau, même
//     discipline que test_fdj_composition.js) avec des données réalistes,
//     pour vérifier qu'aucune primitive n'explose (jeu disparu, relevé
//     absent, plusieurs versions avec régularisation, etc.).

const fs = require('fs');
const assert = require('assert');

const CHEMIN_BASE = '/sessions/dazzling-compassionate-ride/mnt/image nexus project';

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
// VOLET 1 — fonctions utilitaires pures.
// ------------------------------------------------------------
(() => {
  const jeux = [
    { id: 'j1', nom: 'CASH 5€', ordre_affichage: 1 },
    { id: 'j2', nom: 'GOAL', ordre_affichage: 2 },
    { id: 'j3', nom: 'BANCO', ordre_affichage: 3 },
  ];
  const src = [
    extraire('jeuxDuSnapshot'),
    extraireConst('LABELS_DIFF_RELEVE'),
    extraire('formatValeurDiffReleve'),
    extraire('labelStatutCaisse'),
    extraireConst('STATUTS_CAISSE'),
    extraire('nomJeu'),
    extraire('renderDiffReleve'),
    extraireConst('LIBELLES_TYPE_VERSION_RELEVE'),
    extraire('libelleTypeVersionReleve'),
    extraire('libelleCaractereReleve'),
    extraireConst('LIBELLES_MOIS_FR'),
    extraire('libelleMoisAnnee'),
    extraire('decalerMois'),
    'function fmtEuro(n) { return (n === null || n === undefined || n === \'\' || isNaN(n)) ? \'—\' : `${Number(n).toLocaleString(\'fr-FR\', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`; }',
    'function fmtNum(n) { return (n === null || n === undefined) ? \'—\' : Number(n).toLocaleString(\'fr-FR\', { maximumFractionDigits: 2 }); }',
  ].join('\n');
  const ctx = { jeux, console };
  ctx.globalThis = ctx;
  const fn = new (require('vm').Script)(`${src}\nglobalThis.__jeuxDuSnapshot = jeuxDuSnapshot; globalThis.__formatValeurDiffReleve = formatValeurDiffReleve; globalThis.__nomJeu = nomJeu; globalThis.__renderDiffReleve = renderDiffReleve; globalThis.__libelleTypeVersionReleve = libelleTypeVersionReleve; globalThis.__libelleCaractereReleve = libelleCaractereReleve; globalThis.__libelleMoisAnnee = libelleMoisAnnee; globalThis.__decalerMois = decalerMois;`);
  require('vm').createContext(ctx);
  fn.runInContext(ctx);

  // jeuxDuSnapshot : ordonné selon `jeux`, uniquement les jeux présents.
  const snap = { stock_initial_par_jeu: { j3: 10, j1: 5 }, appro_par_jeu: {}, stock_final_par_jeu: { j2: 2 } };
  const res = ctx.__jeuxDuSnapshot(snap);
  assert.deepStrictEqual(res.map(j => j.id), ['j1', 'j2', 'j3'], 'jeuxDuSnapshot respecte l\'ordre de `jeux`, jamais l\'ordre des clés JSON');
  console.log('OK — jeuxDuSnapshot : ordre stable (ordre_affichage), jamais l\'ordre des clés JSON.');

  // formatValeurDiffReleve : euros pour les montants, brut pour le reste, "—" si null.
  assert.strictEqual(ctx.__formatValeurDiffReleve('ecart', 5), '5,00 €');
  assert.strictEqual(ctx.__formatValeurDiffReleve('stock_initial_par_jeu', 23), '23');
  assert.strictEqual(ctx.__formatValeurDiffReleve('ecart', null), '—');
  console.log('OK — formatValeurDiffReleve : euros pour les montants, brut pour les quantités, "—" si absent.');

  // renderDiffReleve : reproduit l'exemple exact de Frédéric, CASH 24 -> 23.
  const diffExemple = { ecart: { avant: 5, apres: 0 }, stock_initial_par_jeu: { j1: { avant: 24, apres: 23 } } };
  const html2 = ctx.__renderDiffReleve(diffExemple);
  assert.ok(html2.includes('5,00 €') && html2.includes('0,00 €'), 'Diff écart visible (5,00€ -> 0,00€)');
  assert.ok(html2.includes('CASH 5€') && html2.includes('24') && html2.includes('23'), 'Diff stock initial visible avec le nom du jeu');
  assert.strictEqual(ctx.__renderDiffReleve(null), '', 'Pas de diff (recalcul auto sans changement de chiffre) -> chaîne vide, jamais un artefact visuel');
  console.log('OK — renderDiffReleve reproduit l\'exemple de Frédéric (CASH 24->23, écart 5,00€->0,00€) et gère l\'absence de diff.');

  // libellés
  assert.strictEqual(ctx.__libelleTypeVersionReleve('validation_employe'), 'Validation employé');
  assert.strictEqual(ctx.__libelleTypeVersionReleve('recalcul_automatique_chaine'), 'Recalcul automatique (chaîne rétablie)');
  assert.strictEqual(ctx.__libelleCaractereReleve('provisoire'), 'Provisoire — continuité à régulariser');
  assert.strictEqual(ctx.__libelleCaractereReleve('definitif'), 'Définitif');
  console.log('OK — libellés type de version et caractère du relevé.');

  // navigation mensuelle : décembre -> janvier (changement d'année), pas de bug de fuseau.
  assert.strictEqual(ctx.__decalerMois('2026-12', 1), '2027-01', 'decalerMois franchit correctement le changement d\'année');
  assert.strictEqual(ctx.__decalerMois('2026-01', -1), '2025-12', 'decalerMois recule correctement à travers le changement d\'année');
  assert.strictEqual(ctx.__libelleMoisAnnee('2026-08'), 'août 2026');
  console.log('OK — decalerMois/libelleMoisAnnee : navigation mensuelle correcte, y compris changement d\'année.');
})();

// ------------------------------------------------------------
// VOLET 2 — composition PDF (relevé de quart + export journée), contre
// le vrai nexus-pdf-moteur.js, pdf-lib mocké au plus bas niveau.
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

let addPageCount = 0;
const fakeFont = { widthOfTextAtSize: (t, s) => String(t).length * s * 0.5 };
function makeFakePage() {
  addPageCount++;
  return { drawText: () => {}, drawRectangle: () => {}, drawLine: () => {}, drawImage: () => {} };
}
function fakeDoc() {
  const pages = [];
  return {
    addPage: () => { const p = makeFakePage(); pages.push(p); return p; },
    getPages: () => pages,
    embedFont: async () => fakeFont,
    setTitle: () => {}, setAuthor: () => {}, setSubject: () => {}, setCreator: () => {}, setProducer: () => {},
    save: async () => new Uint8Array([1, 2, 3]),
  };
}

async function runVoletPdf() {
  const jeux = [
    { id: 'j1', nom: 'CASH 5€', ordre_affichage: 1 },
    { id: 'j2', nom: 'GOAL', ordre_affichage: 2 },
  ];
  const employesSite = [{ id: 'e1', nom: 'Loane' }];
  const src = [
    extraireConst('LABELS_DIFF_RELEVE'),
    extraire('formatValeurDiffReleve'),
    extraireConst('LIBELLES_TYPE_VERSION_RELEVE'),
    extraire('libelleTypeVersionReleve'),
    extraire('libelleCaractereReleve'),
    extraireConst('STATUTS_CAISSE'),
    extraire('labelStatutCaisse'),
    extraire('nomJeu'),
    extraire('nomEmploye'),
    extraire('jeuxDuSnapshot'),
    extraire('construireReleveClotureQuartPdf'),
    extraire('construireExportJourneePdf'),
    'function fmtEuro(n) { return (n === null || n === undefined || n === \'\' || isNaN(n)) ? \'—\' : `${Number(n).toLocaleString(\'fr-FR\', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`; }',
    'function fmtNum(n) { return (n === null || n === undefined) ? \'—\' : Number(n).toLocaleString(\'fr-FR\', { maximumFractionDigits: 2 }); }',
  ].join('\n');
  const ctx = { jeux, employesSite, NexusPdfMoteur, console };
  ctx.globalThis = ctx;
  const fn = new (require('vm').Script)(`${src}\nglobalThis.__construireReleveClotureQuartPdf = construireReleveClotureQuartPdf; globalThis.__construireExportJourneePdf = construireExportJourneePdf;`);
  require('vm').createContext(ctx);
  fn.runInContext(ctx);

  const shift = { id: 'shift-1', date: '2026-08-16', quart: '2', employee_id: 'e1' };
  // Version 1 (employé) — écart +5,00€ ; version 2 (manager) — régularisé à 0,00€,
  // reprend l'exemple exact de Frédéric.
  const v1 = {
    version_num: 1, type_version: 'validation_employe', cree_le: '2026-08-16T20:05:00Z', cree_par: null,
    stock_initial_par_jeu: { j1: 24, j2: 10 }, appro_par_jeu: { j1: 3, j2: 0 }, stock_final_par_jeu: { j1: 20, j2: 8 },
    ventes_par_jeu: { j1: { qte: 7, valeur: 35 }, j2: { qte: 2, valeur: 20 } },
    ventes_grattage_valeur: 55, lots_payes_grattage: 10, caisse_tirages: 20, regularisations: 0,
    caisse_attendue: 271.8, caisse_reelle: 276.8, ecart: 5,
    anomalie_chaine: { rompue: false }, statut: 'valide_avec_ecart', caractere: 'definitif',
    motif_regularisation: null, diff_vs_precedent: null,
    signature: { nom: 'Loane', role: 'employe', date_heure: '2026-08-16T20:05:00Z' },
  };
  const v2 = {
    version_num: 2, type_version: 'regularisation_manager', cree_le: '2026-08-17T09:00:00Z', cree_par: null,
    stock_initial_par_jeu: { j1: 23, j2: 10 }, appro_par_jeu: { j1: 3, j2: 0 }, stock_final_par_jeu: { j1: 20, j2: 8 },
    ventes_par_jeu: { j1: { qte: 6, valeur: 30 }, j2: { qte: 2, valeur: 20 } },
    ventes_grattage_valeur: 50, lots_payes_grattage: 10, caisse_tirages: 20, regularisations: 0,
    caisse_attendue: 276.8, caisse_reelle: 276.8, ecart: 0,
    anomalie_chaine: { rompue: false }, statut: 'regularise', caractere: 'definitif',
    motif_regularisation: 'Erreur de stock initial sur CASH 5€ : 24 -> 23.',
    diff_vs_precedent: { ecart: { avant: 5, apres: 0 }, stock_initial_par_jeu: { j1: { avant: 24, apres: 23 } } },
    signature: { nom: 'Manager', role: 'manager', date_heure: '2026-08-17T09:00:00Z' },
  };

  addPageCount = 0;
  const pdfQuart = await ctx.__construireReleveClotureQuartPdf(shift, [v1, v2]);
  assert.ok(pdfQuart.bytes && pdfQuart.bytes.length > 0, 'PDF relevé de quart produit des octets');
  assert.strictEqual(pdfQuart.nomFichier, 'NEXUS-FDJ-Releve-2026-08-16-Q2.pdf');
  assert.ok(addPageCount >= 1, 'Au moins une page créée');
  console.log(`OK — construireReleveClotureQuartPdf (2 versions, régularisation) : ${addPageCount} page(s), ${pdfQuart.bytes.length} octets, fichier "${pdfQuart.nomFichier}".`);

  // Quart sans relevé du tout — ne doit jamais planter côté écran (renderReleveQuart
  // gère ce cas en amont sans appeler la composition PDF), mais le cas "provisoire,
  // une seule version" doit lui fonctionner sans erreur.
  addPageCount = 0;
  const vProvisoire = { ...v1, caractere: 'provisoire', anomalie_chaine: { rompue: true, manquants: ['2026-08-15|1'] }, diff_vs_precedent: null };
  const pdfProvisoire = await ctx.__construireReleveClotureQuartPdf(shift, [vProvisoire]);
  assert.ok(pdfProvisoire.bytes.length > 0, 'PDF relevé provisoire (version unique) produit des octets sans planter');
  console.log('OK — construireReleveClotureQuartPdf : relevé provisoire à version unique ne plante jamais (bandeau + aucun historique de diff).');

  // Export journée : Quart 1 sans relevé, Quart 2 avec 2 versions.
  addPageCount = 0;
  const shift1 = { id: 'shift-0', date: '2026-08-16', quart: '1', employee_id: 'e1' };
  const pdfJournee = await ctx.__construireExportJourneePdf('2026-08-16', [
    { shift: shift1, releves: [] },
    { shift, releves: [v1, v2] },
  ]);
  assert.ok(pdfJournee.bytes.length > 0, 'PDF export journée produit des octets');
  assert.strictEqual(pdfJournee.nomFichier, 'NEXUS-FDJ-Journee-2026-08-16.pdf');
  console.log(`OK — construireExportJourneePdf (Q1 sans relevé + Q2 avec régularisation) : ${addPageCount} page(s), ${pdfJournee.bytes.length} octets, fichier "${pdfJournee.nomFichier}".`);

  console.log('\nTous les tests "Trace de contrôle FDJ — écran manager" passent.');
}

runVoletPdf().catch(e => { console.error('ECHEC:', e); process.exit(1); });
