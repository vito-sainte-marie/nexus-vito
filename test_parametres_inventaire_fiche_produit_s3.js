// Test — Paramètres Inventaire, "Fiche produit : paramétrage hérité /
// exception" (Sprint 3, 20/08/2026, demande de Frédéric : "Paramétrage
// hérité : Bières / Dernière modification : 20/08/2026 / [Modifier pour
// toute la catégorie] [Créer une exception]"). Même discipline que
// test_parametres_inventaire_regles_categorie_s2.js : extraction par regex
// des vraies fonctions du fichier, vm.runInNewContext, fonctions à effet de
// bord (ouvrirFormulaireProfil, revenirReglecategorie, irVersReglageCategorie)
// hors périmètre — seule la construction pure (construireProfilEnEdition) et
// le rendu (renderCarteHeritageProduit) sont testés directement.

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const PROJET = __dirname;

function testSync(nom, fn) {
  try { fn(); console.log(`OK — ${nom}`); }
  catch (e) { console.error(`FAIL — ${nom}\n  ${e.stack}`); process.exitCode = 1; }
}

const html = fs.readFileSync(path.join(PROJET, 'NEXUS-Parametres-Inventaire-v1.html'), 'utf8');
const scriptMatches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const script = scriptMatches.reduce((a, b) => (b.length > a.length ? b : a), '');
assert.ok(script.includes('renderCarteHeritageProduit'), 'Bloc script applicatif introuvable (Sprint 3 non présent ?)');

function extraireFonction(nomFonction) {
  let debut = script.indexOf(`function ${nomFonction}(`);
  assert.ok(debut !== -1, `Fonction ${nomFonction} introuvable`);
  const prefixe = 'async ';
  if (script.slice(debut - prefixe.length, debut) === prefixe) debut -= prefixe.length;
  let i = script.indexOf('(', debut);
  let profParen = 1, k = i + 1;
  while (profParen > 0) {
    if (script[k] === '(') profParen++;
    else if (script[k] === ')') profParen--;
    k++;
  }
  let j = script.indexOf('{', k);
  let profondeur = 1, l = j + 1;
  while (profondeur > 0) {
    if (script[l] === '{') profondeur++;
    else if (script[l] === '}') profondeur--;
    l++;
  }
  return script.slice(debut, l);
}

// ------------------------------------------------------------
// PARTIE 1 — construireProfilEnEdition : une seule fonction de construction,
// quelle que soit la source (ligne propre, catégorie héritée, ou rien).
// ------------------------------------------------------------
(function partie1() {
  const src = [
    'let produitsInventaire = [];',
    extraireFonction('construireProfilEnEdition'),
    `globalThis.__test = {
      setEnv: (env) => { produitsInventaire = env.produitsInventaire || []; },
      construireProfilEnEdition,
    };`,
  ].join('\n\n');
  const ctx = { globalThis: {}, console };
  ctx.globalThis = ctx;
  vm.runInNewContext(src, ctx);
  const T = ctx.__test;
  T.setEnv({ produitsInventaire: [{ id: 'p1', comptage_deux_lieux: true }] });

  testSync('construireProfilEnEdition(source=null) : valeurs par défaut, jamais une exception', () => {
    const e = T.construireProfilEnEdition('p1', null);
    assert.strictEqual(e.production_journaliere, false);
    assert.strictEqual(e.frequence_controle, 'standard');
    assert.strictEqual(e.reapprovisionnable, true);
    assert.strictEqual(e.comptage_deux_lieux, true, 'comptage_deux_lieux vient toujours du produit, jamais de la source règle');
  });

  testSync('construireProfilEnEdition(source=catégorie active) : reprend les champs de la catégorie comme point de départ', () => {
    const e = T.construireProfilEnEdition('p1', { profil: 'production_journaliere', quarts_comptage: ['matin'], comptage_masque: true, frequence_controle: 'critique' });
    assert.strictEqual(e.production_journaliere, true);
    assert.deepStrictEqual(e.quarts_comptage, ['matin']);
    assert.strictEqual(e.comptage_masque, true);
    assert.strictEqual(e.frequence_controle, 'critique');
  });

  testSync('construireProfilEnEdition(source=ligne produit) : même construction, peu importe la provenance (Article 11)', () => {
    const e = T.construireProfilEnEdition('p1', { profil: 'cycle_journalier', duree_max_vente_jours: 3, action_echeance: 'retour_fournisseur_obligatoire' });
    assert.strictEqual(e.remise_a_zero_matin, true);
    assert.strictEqual(e.duree_max_vente_jours, 3);
    assert.strictEqual(e.retour_fournisseur_autorise, true);
  });
})();

// ------------------------------------------------------------
// PARTIE 2 — renderCarteHeritageProduit : les 3 états (exception / hérité /
// aucune règle) affichent le bon message et les bons boutons.
// ------------------------------------------------------------
(function partie2() {
  const src = [
    extraireFonction('fmtDateFr'),
    extraireFonction('libelleReglesProduit'),
    extraireFonction('renderCarteHeritageProduit'),
    `globalThis.__test = { renderCarteHeritageProduit };`,
  ].join('\n\n');
  const ctx = { globalThis: {}, console };
  ctx.globalThis = ctx;
  vm.runInNewContext(src, ctx);
  const T = ctx.__test;
  const p = { id: 'p1', designation: 'Heineken 25 cl' };

  testSync('renderCarteHeritageProduit : exception propre -> "⚠ Exception active", bouton "Modifier cette exception" + "Revenir à..."', () => {
    const regle = { profil: 'presse', updated_at: '2026-08-20T10:00:00Z' };
    const cat = { id: 'cat-bieres', nom: 'Bières', regle_active: true, profil: 'cycle_journalier' };
    const html = T.renderCarteHeritageProduit(p, regle, cat);
    assert.ok(html.includes('⚠ Exception active'));
    assert.ok(html.includes('data-modifier-exception="p1"'));
    assert.ok(html.includes('data-revenir-categorie="p1"'));
    assert.ok(html.includes('« Bières »'), 'doit nommer la catégorie de destination du retour');
    assert.ok(html.includes('20/08/2026'), 'Dernière modification formatée en fr-FR');
  });

  testSync('renderCarteHeritageProduit : exception propre + catégorie SANS règle active -> "Revenir à la règle par défaut"', () => {
    const regle = { profil: 'presse', updated_at: '2026-08-20T10:00:00Z' };
    const cat = { id: 'cat-bieres', nom: 'Bières', regle_active: false };
    const html = T.renderCarteHeritageProduit(p, regle, cat);
    assert.ok(html.includes('Revenir à la règle par défaut'));
  });

  testSync('renderCarteHeritageProduit : catégorie active, pas d\'exception -> "Paramétrage hérité", bouton "Modifier pour toute la catégorie" + "Créer une exception"', () => {
    const cat = { id: 'cat-bieres', nom: 'Bières', regle_active: true, profil: 'cycle_journalier', updated_at: '2026-08-19T08:00:00Z' };
    const html = T.renderCarteHeritageProduit(p, null, cat);
    assert.ok(html.includes('Paramétrage hérité : Bières'));
    assert.ok(html.includes('data-modifier-categorie="cat-bieres"'));
    assert.ok(html.includes('data-creer-exception="p1"'));
    assert.ok(html.includes('19/08/2026'));
  });

  testSync('renderCarteHeritageProduit : pas d\'exception, catégorie sans règle active -> comportement par défaut, un seul bouton "Créer une exception"', () => {
    const cat = { id: 'cat-bieres', nom: 'Bières', regle_active: false };
    const html = T.renderCarteHeritageProduit(p, null, cat);
    assert.ok(html.includes('Aucune règle commune pour « Bières »'));
    assert.ok(html.includes('comportement par défaut'));
    assert.ok(html.includes('data-creer-exception="p1"'));
    assert.ok(!html.includes('data-modifier-exception'));
    assert.ok(!html.includes('data-revenir-categorie'));
  });

  testSync('renderCarteHeritageProduit : produit sans catégorie du tout -> "Aucune catégorie", jamais une exception JS', () => {
    const html = T.renderCarteHeritageProduit(p, null, null);
    assert.ok(html.includes('Aucune catégorie'));
    assert.ok(html.includes('data-creer-exception="p1"'));
  });
})();
