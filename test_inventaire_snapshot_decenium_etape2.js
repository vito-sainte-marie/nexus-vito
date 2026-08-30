// Test — Snapshot Decenium, Étape 2 "UX Photo Decenium" (30/08/2026,
// Frédéric — "oui" à la question de poursuivre après l'Étape 1).
// Couvre : rapprochement des lignes de l'export Stock actuel
// (rapprocherLignesStock, extraction + sandbox vm), résolution de
// l'horodatage effectif d'un export (resoudreHorodatageExport), le
// branchement réel de l'orchestration (construirePhotoDecenium) dans
// NEXUS-Inventaire-Manager-v1.html (vérifications de source — même
// convention que l'Étape 1 pour comparerVentesQuart), le rendu du badge/
// avertissement Photo Decenium, la couche données (creerLignesSnapshot/
// chargerLignesSnapshot), et le champ de seuil configurable dans
// NEXUS-Parametres-Inventaire-v1.html.

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const ROOT = '/sessions/dazzling-compassionate-ride/mnt/image nexus project';

function lireSource(fichier) { return fs.readFileSync(path.join(ROOT, fichier), 'utf8'); }

function testSync(nom, fn) {
  try { fn(); console.log(`OK — ${nom}`); }
  catch (e) { console.error(`FAIL — ${nom}\n  ${e.stack}`); process.exitCode = 1; }
}

async function testAsync(nom, fn) {
  try { await fn(); console.log(`OK — ${nom}`); }
  catch (e) { console.error(`FAIL — ${nom}\n  ${e.stack}`); process.exitCode = 1; }
}

// ------------------------------------------------------------
// Extraction (même convention que test_inventaire_cycle_observation_v2295 :
// brace-matching sur le plus grand <script> inline, puis extraction de
// fonctions/const précises pour exécution en sandbox isolé).
// ------------------------------------------------------------
function extraireBloc(src, debutMotCle) {
  const debut = src.indexOf(debutMotCle);
  if (debut === -1) throw new Error(`Bloc introuvable: ${debutMotCle}`);
  let curseur = debut + debutMotCle.length - 1; // pointe sur le dernier caractère du mot-clé ('(' ou '{')

  // Cas fonction : le mot-clé se termine par '(' — il faut d'abord sauter
  // la liste de paramètres (qui peut elle-même contenir des accolades de
  // déstructuration, ex: "({ a, b, c })") avant de chercher le corps.
  if (debutMotCle.endsWith('(')) {
    let profondeurParen = 1; curseur++;
    while (profondeurParen > 0) {
      if (src[curseur] === '(') profondeurParen++;
      else if (src[curseur] === ')') profondeurParen--;
      curseur++;
    }
    curseur = src.indexOf('{', curseur); // début réel du corps de la fonction
  }

  let i = curseur;
  let profondeur = 1; i++;
  while (profondeur > 0) {
    if (src[i] === '{') profondeur++;
    else if (src[i] === '}') profondeur--;
    i++;
  }
  if (src[i] === ';') i++;
  return src.slice(debut, i);
}

const srcManagerHtml = lireSource('NEXUS-Inventaire-Manager-v1.html');
const scriptManager = [...srcManagerHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)].sort((a, b) => b[1].length - a[1].length)[0][1];

const blocsMoteurRapprochement = [
  extraireBloc(scriptManager, 'const ALIAS_VENTES_SANS_CODE_BARRES = {'),
  extraireBloc(scriptManager, 'function normaliserCodeBarresVentes('),
  extraireBloc(scriptManager, 'function normaliserTexteVentes('),
  extraireBloc(scriptManager, 'function rapprocherLignesStock('),
  extraireBloc(scriptManager, 'function resoudreHorodatageExport('),
].join('\n\n');

const sandboxRapprochement = { console };
vm.createContext(sandboxRapprochement);
vm.runInContext(`${blocsMoteurRapprochement}
this.rapprocherLignesStock = rapprocherLignesStock;
this.resoudreHorodatageExport = resoudreHorodatageExport;
`, sandboxRapprochement);
const { rapprocherLignesStock, resoudreHorodatageExport } = sandboxRapprochement;

// ------------------------------------------------------------
// rapprocherLignesStock
// ------------------------------------------------------------

const PRODUITS_TEST = [
  { id: 'p1', designation: 'Coca Cola 50CL', code_barres: '5449000000996' },
  { id: 'p2', designation: 'Baguette', code_barres: null },
];

testSync('rapprocherLignesStock — rapproche par code-barres et lit la quantité (en-tête "Stock")', () => {
  const lignes = rapprocherLignesStock([
    { 'Lib Article': 'Coca Cola 50CL', 'Code Barres': '5449000000996', 'Stock': 24, 'PA HT': 0.55 },
  ], PRODUITS_TEST);
  assert.strictEqual(lignes[0].produit_id, 'p1');
  assert.strictEqual(lignes[0].quantite_stock, 24);
  assert.strictEqual(lignes[0].prix_achat_ht, 0.55);
});

testSync('rapprocherLignesStock — rapproche par alias pour un produit sans code-barres', () => {
  const lignes = rapprocherLignesStock([
    { 'Lib Article': 'Baguette', 'Code Barres': null, 'Qte Stock': 12 },
  ], PRODUITS_TEST);
  assert.strictEqual(lignes[0].produit_id, 'p2');
  assert.strictEqual(lignes[0].quantite_stock, 12);
});

testSync('rapprocherLignesStock — accepte plusieurs variantes d\'en-tête de quantité (STOCK ACTUEL)', () => {
  const lignes = rapprocherLignesStock([
    { 'Lib Article': 'Coca Cola 50CL', 'Code Barres': '5449000000996', 'STOCK ACTUEL': 7 },
  ], PRODUITS_TEST);
  assert.strictEqual(lignes[0].quantite_stock, 7);
});

testSync('rapprocherLignesStock — référence non reconnue -> produit_id null, jamais deviné', () => {
  const lignes = rapprocherLignesStock([
    { 'Lib Article': 'Article Inconnu XYZ', 'Code Barres': '000000', 'Stock': 3 },
  ], PRODUITS_TEST);
  assert.strictEqual(lignes[0].produit_id, null);
  assert.strictEqual(lignes[0].designation_brute, 'Article Inconnu XYZ');
});

testSync('rapprocherLignesStock — quantité absente -> 0, jamais NaN', () => {
  const lignes = rapprocherLignesStock([
    { 'Lib Article': 'Coca Cola 50CL', 'Code Barres': '5449000000996' },
  ], PRODUITS_TEST);
  assert.strictEqual(lignes[0].quantite_stock, 0);
});

// ------------------------------------------------------------
// resoudreHorodatageExport
// ------------------------------------------------------------

testSync('resoudreHorodatageExport — valeur déclarée -> source manager_declared', () => {
  const r = resoudreHorodatageExport('2026-08-30T10:00', '2026-08-30T10:05:00.000Z');
  assert.strictEqual(r.source, 'manager_declared');
  // new Date('2026-08-30T10:00') est interprété en heure LOCALE (valeur
  // "datetime-local" du champ HTML) — on compare l'instant réel plutôt
  // qu'une chaîne UTC pour rester indépendant du fuseau horaire de la
  // machine qui exécute ce test.
  assert.strictEqual(new Date(r.at).getTime(), new Date('2026-08-30T10:00').getTime());
});

testSync('resoudreHorodatageExport — aucune valeur déclarée -> repli sur l\'instant d\'import, source import_time_estimated', () => {
  const instant = '2026-08-30T10:05:00.000Z';
  const r = resoudreHorodatageExport(null, instant);
  assert.strictEqual(r.source, 'import_time_estimated');
  assert.strictEqual(r.at, instant);
});

// ------------------------------------------------------------
// BRANCHEMENT RÉEL — construirePhotoDecenium (vérifications de source,
// même convention que l'Étape 1 pour comparerVentesQuart : exécuter cette
// fonction nécessiterait de reproduire tout l'environnement Supabase du
// script manager, hors de portée raisonnable pour ce test — Article 5 :
// on vérifie ici précisément ce qui est vérifiable sans fabriquer un faux
// contexte d'exécution).
// ------------------------------------------------------------

testSync('construirePhotoDecenium — bloque la création si le délai est dépassé et non confirmé (besoinConfirmation, aucune écriture)', () => {
  const bloc = extraireBloc(scriptManager, 'async function construirePhotoDecenium(');
  assert.ok(bloc.includes('qualification.delai_depasse && !confirmerMalgreDelai'), 'garde délai dépassé introuvable');
  assert.ok(bloc.includes('besoinConfirmation: true'), 'retour besoinConfirmation introuvable');
  // La garde doit se trouver AVANT le chargement du catalogue / la création
  // du Snapshot (aucune écriture avant confirmation explicite).
  const iGarde = bloc.indexOf('besoinConfirmation: true');
  const iCreation = bloc.indexOf('NexusInventaireSnapshotDonnees.creerSnapshot');
  assert.ok(iGarde > -1 && iCreation > -1 && iGarde < iCreation, 'la garde délai doit précéder la création du Snapshot');
});

testSync('construirePhotoDecenium — crée le Snapshot, le remplace comme actif, puis persiste les lignes de stock', () => {
  const bloc = extraireBloc(scriptManager, 'async function construirePhotoDecenium(');
  const iCreer = bloc.indexOf('NexusInventaireSnapshotDonnees.creerSnapshot');
  const iRemplacer = bloc.indexOf('NexusInventaireSnapshotDonnees.remplacerAnciensSnapshotsActifs');
  const iLignes = bloc.indexOf('NexusInventaireSnapshotDonnees.creerLignesSnapshot');
  assert.ok(iCreer > -1 && iRemplacer > -1 && iLignes > -1, 'un des 3 appels données est introuvable');
  assert.ok(iCreer < iRemplacer && iRemplacer < iLignes, 'ordre attendu : créer -> remplacer -> lignes');
});

testSync('construirePhotoDecenium — utilise le seuil configuré (parametresInventaire.snapshotMaxDelayMinutes) avec repli sur la valeur par défaut', () => {
  const bloc = extraireBloc(scriptManager, 'async function construirePhotoDecenium(');
  assert.ok(bloc.includes('parametresInventaire.snapshotMaxDelayMinutes'), 'lecture du seuil configuré introuvable');
  assert.ok(bloc.includes('DEFAULTS_PARAMETRES_INVENTAIRE.snapshotMaxDelayMinutes'), 'repli par défaut introuvable');
});

testSync('NEXUS-Inventaire-Manager-v1.html — DEFAULTS_PARAMETRES_INVENTAIRE expose snapshotMaxDelayMinutes=5', () => {
  const bloc = scriptManager.slice(scriptManager.indexOf('const DEFAULTS_PARAMETRES_INVENTAIRE'), scriptManager.indexOf('const DEFAULTS_PARAMETRES_INVENTAIRE') + 800);
  assert.ok(bloc.includes('snapshotMaxDelayMinutes: 5'));
});

testSync('NEXUS-Inventaire-Manager-v1.html — section renommée "Photo Decenium" (plus "Comparaison Decenium")', () => {
  assert.ok(scriptManager.includes('Photo Decenium') || srcManagerHtml.includes('Photo Decenium'), 'nouveau titre introuvable');
  assert.ok(!srcManagerHtml.includes('Comparaison Decenium'), 'ancien titre encore présent quelque part');
});

testSync('NEXUS-Inventaire-Manager-v1.html — le fichier Stock actuel est facultatif (bouton Ventes non conditionné à sa présence)', () => {
  const iClick = scriptManager.indexOf("btnComparerVentes.addEventListener('click'");
  const blocClick = scriptManager.slice(iClick, iClick + 2200);
  assert.ok(blocClick.includes('if (fichierStock)'), 'le chemin Stock doit rester conditionnel — comportement historique préservé sans lui');
  assert.ok(blocClick.includes('await comparerVentesQuart(fichier)'), 'le rapprochement Ventes doit toujours avoir lieu, avec ou sans Stock');
});

testSync('NEXUS-Inventaire-Manager-v1.html — la confirmation "Poursuivre quand même" est réinitialisée à chaque nouveau fichier Stock choisi', () => {
  const i = scriptManager.indexOf("snapshotStockFileInput.addEventListener('change'");
  assert.ok(i > -1, 'listener de changement de fichier Stock introuvable');
  const bloc = scriptManager.slice(i, i + 400);
  assert.ok(bloc.includes('snapshotConfirmerMalgreDelai = false'), 'la réinitialisation de la confirmation est manquante');
});

// ------------------------------------------------------------
// Rendu — renderSnapshotBadge / renderSnapshotAvertissement
// ------------------------------------------------------------

function extraireFonction(src, nom) {
  const debut = src.indexOf(`function ${nom}(`);
  if (debut === -1) throw new Error(`Fonction ${nom} introuvable`);
  let i = src.indexOf('{', debut);
  let profondeur = 1; i++;
  while (profondeur > 0) {
    if (src[i] === '{') profondeur++;
    else if (src[i] === '}') profondeur--;
    i++;
  }
  return src.slice(debut, i);
}

testSync('renderSnapshotBadge — aucun Snapshot actif : message informatif, jamais une confiance inventée', () => {
  const fnMoteur = [
    lireSource('nexus-inventaire-snapshot-moteur.js'),
  ].join('\n');
  const fnRender = extraireFonction(scriptManager, 'renderSnapshotBadge');
  const sandbox = { console, global: {} };
  vm.createContext(sandbox);
  vm.runInContext(`${fnMoteur}\n${fnRender}\nthis.renderSnapshotBadge = renderSnapshotBadge; this.NexusInventaireSnapshotMoteur = (typeof window !== 'undefined' ? window : globalThis).NexusInventaireSnapshotMoteur;`, sandbox);
  const html = sandbox.renderSnapshotBadge(null);
  assert.ok(html.includes('Aucune Photo Decenium'));
});

testSync('renderSnapshotBadge — Snapshot actif : affiche confiance et décalage via les libellés du moteur', () => {
  const fnMoteur = lireSource('nexus-inventaire-snapshot-moteur.js');
  const fnRender = extraireFonction(scriptManager, 'renderSnapshotBadge');
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(`${fnMoteur}\n${fnRender}\nthis.renderSnapshotBadge = renderSnapshotBadge; this.NexusInventaireSnapshotMoteur = (typeof window !== 'undefined' ? window : globalThis).NexusInventaireSnapshotMoteur;`, sandbox);
  const html = sandbox.renderSnapshotBadge({
    snapshot_reference_at: '2026-08-30T10:01:00.000Z', confidence_level: 'haute', delta_seconds: 73, validated_with_reserve: false,
  });
  assert.ok(html.includes('Haute'));
  assert.ok(html.includes('1 min 13 s'));
  assert.ok(html.includes('snapshot-badge haute'));
});

testSync('renderSnapshotAvertissement — propose "Poursuivre quand même", jamais posé automatiquement', () => {
  const fnMoteur = lireSource('nexus-inventaire-snapshot-moteur.js');
  const fnRender = extraireFonction(scriptManager, 'renderSnapshotAvertissement');
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(`${fnMoteur}\n${fnRender}\nthis.renderSnapshotAvertissement = renderSnapshotAvertissement; this.NexusInventaireSnapshotMoteur = (typeof window !== 'undefined' ? window : globalThis).NexusInventaireSnapshotMoteur;`, sandbox);
  const html = sandbox.renderSnapshotAvertissement({ delta_seconds: 720, confidence_level: 'faible' });
  assert.ok(html.includes('btnSnapshotPoursuivre'));
  assert.ok(html.includes('12 min'));
});

// ------------------------------------------------------------
// DONNÉES — creerLignesSnapshot / chargerLignesSnapshot (mock client,
// même convention que l'Étape 1)
// ------------------------------------------------------------

global.window = global;
require(path.join(ROOT, 'nexus-inventaire-snapshot-donnees.js'));
const D = global.NexusInventaireSnapshotDonnees;

function fabriquerClientMock({ insertError, selectResult } = {}) {
  const appels = { insert: null, select: [] };
  return {
    _appels: appels,
    from(table) {
      return {
        insert(payload) {
          appels.insert = { table, payload };
          return Promise.resolve({ error: insertError || null });
        },
        select() {
          appels.select.push(table);
          const chain = { eq: () => chain };
          return Object.assign(Promise.resolve(selectResult || { data: [], error: null }), chain);
        },
      };
    },
  };
}

async function runAsyncTests() {

await testAsync('creerLignesSnapshot — insère une ligne par produit rapproché avec le bon snapshot_id/site', async () => {
  const client = fabriquerClientMock();
  const ok = await D.creerLignesSnapshot(client, 'snap-1', 'vito-sainte-marie', [
    { produit_id: 'p1', designation_brute: 'Coca Cola 50CL', code_barres_brut: '5449000000996', quantite_stock: 24, prix_achat_ht: 0.55, importe_par: 'emp-1' },
  ]);
  assert.strictEqual(ok, true);
  const p = client._appels.insert.payload[0];
  assert.strictEqual(client._appels.insert.table, 'inventaire_decenium_snapshot_lignes');
  assert.strictEqual(p.snapshot_id, 'snap-1');
  assert.strictEqual(p.site, 'vito-sainte-marie');
  assert.strictEqual(p.quantite_stock, 24);
});

await testAsync('creerLignesSnapshot — liste vide -> ne fait aucun appel réseau, renvoie true', async () => {
  const client = fabriquerClientMock();
  const ok = await D.creerLignesSnapshot(client, 'snap-1', 'vito-sainte-marie', []);
  assert.strictEqual(ok, true);
  assert.strictEqual(client._appels.insert, null);
});

await testAsync('creerLignesSnapshot — erreur Supabase -> false, jamais une exception non gérée', async () => {
  const client = fabriquerClientMock({ insertError: new Error('boom') });
  const ok = await D.creerLignesSnapshot(client, 'snap-1', 'vito-sainte-marie', [{ designation_brute: 'x', quantite_stock: 1 }]);
  assert.strictEqual(ok, false);
});

}

// ------------------------------------------------------------
// PARAMÈTRES — champ seuil configurable (NEXUS-Parametres-Inventaire-v1.html)
// ------------------------------------------------------------

testSync('NEXUS-Parametres-Inventaire-v1.html — DEFAULTS expose snapshotMaxDelayMinutes=5', () => {
  const src = lireSource('NEXUS-Parametres-Inventaire-v1.html');
  const bloc = src.slice(src.indexOf('const DEFAULTS_PARAMETRES_INVENTAIRE'), src.indexOf('const DEFAULTS_PARAMETRES_INVENTAIRE') + 1500);
  assert.ok(bloc.includes('snapshotMaxDelayMinutes: 5'));
});

testSync('NEXUS-Parametres-Inventaire-v1.html — champ #paramSeuilDelaiSnapshot présent et branché à sauvegarderParametresInventaire', () => {
  const src = lireSource('NEXUS-Parametres-Inventaire-v1.html');
  assert.ok(src.includes('id="paramSeuilDelaiSnapshot"'), 'champ input introuvable');
  assert.ok(src.includes("enregistrerParametre('snapshotMaxDelayMinutes'"), 'listener d\'enregistrement introuvable');
});

runAsyncTests().then(() => {
  if (process.exitCode) { console.log('\nDes tests ont échoué.'); }
  else { console.log('\nTous les tests sont passés.'); }
});
