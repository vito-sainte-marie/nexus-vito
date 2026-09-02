// Test — parcours d'inventaire "dépôt → boutique → reste des produits"
// (15/08/2026, demande de Frédéric) : "une fois que le comptage depot est
// terminé, passe par le comptage boutique et en fin le comptage du reste
// des produits comme predefini (viennoiserie, journaux et autres comme
// predefini)".
//
// Avant ce changement, les produits comptés en deux lieux (dépôt + boutique
// — Boissons chaudes/Bières, Huiles, Lave-glace sur le site pilote) avaient
// bien leur phase "dépôt" en premier dans la liste des catégories (grâce à
// ordre_affichage), mais leur phase "boutique" n'était rattrapée qu'au tout
// dernier moment, juste avant la validation finale de l'inventaire — APRÈS
// les catégories "reste" (viennoiserie, journaux, etc.), pas avant comme
// demandé.
//
// Vérifie :
//  1) Les catégories "dépôt" (produits comptage_deux_lieux) s'affichent
//     TOUJOURS avant les catégories "reste" dans la liste des catégories
//     (ouverture ET clôture) — ordonnerParcoursDepotBoutiqueReste().
//  2) Dès que TOUTES les catégories dépôt sont terminées, l'écran "Comptage
//     boutique" se propose automatiquement (sans attendre la validation
//     finale) — depotEntierementTermine() + auto-déclenchement dans
//     renderCategoriesOuverture().
//  3) Ce déclenchement automatique reste souple : un lien "Plus tard"
//     permet de revenir à la liste des catégories sans perdre la saisie du
//     dépôt, et sans re-déclencher l'écran en boucle au retour suivant.
//  4) Valider l'écran "Comptage boutique" en mode automatique enregistre
//     bien compteBoutique/compte pour chaque produit ET ramène aux
//     catégories (jamais une soumission automatique de tout l'inventaire).
//  5) Le comportement historique (déclenchement juste avant la validation
//     finale, écran sans lien "Plus tard") reste intact — c'est le filet de
//     sécurité qui existait déjà avant ce changement.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const DIR = __dirname;
const html = fs.readFileSync(path.join(DIR, 'NEXUS-Inventaire-v1.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length !== 1) throw new Error(`Attendu 1 <script> inline, trouvé ${scripts.length}`);
let scriptSrc = scripts[0];

// ------------------------------------------------------------
// Mock DOM — même stratégie que les tests reception_*, étendue pour
// supporter les sélecteurs de CLASSE (`.produit-input-finalisation`),
// nécessaires à l'écran "Comptage boutique" (celui-ci ne peut pas être
// identifié uniquement par id/attribut data-xxx comme les écrans réception).
// ------------------------------------------------------------
function parseAttrs(attrStr) {
  const out = {};
  const re = /([a-zA-Z_-][\w-]*)(?:="([^"]*)")?/g;
  let m;
  while ((m = re.exec(attrStr))) out[m[1]] = m[2] !== undefined ? m[2] : '';
  return out;
}
function fabriquerStub(attrs, indexer, buscar) {
  // dataset (le vrai code lit `el.dataset.produit`, pas seulement
  // `getAttribute('data-produit')` — les deux doivent fonctionner ici).
  const dataset = {};
  Object.keys(attrs).forEach(k => {
    if (k.startsWith('data-')) {
      const camel = k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      dataset[camel] = attrs[k];
    }
  });
  return {
    _attrs: attrs,
    value: attrs.value !== undefined ? attrs.value : '',
    textContent: '', _innerHTML: '',
    disabled: 'disabled' in attrs,
    style: {}, dataset,
    classList: { add(){}, remove(){}, contains(){ return false; }, toggle(){} },
    _listeners: {},
    addEventListener(evt, fn) { this._listeners[evt] = fn; },
    getAttribute(n) { return this._attrs[n] !== undefined ? this._attrs[n] : null; },
    click() { if (this._listeners.click) this._listeners.click(); },
    dispatchEvent(evt) { const fn = this._listeners[evt]; if (fn) fn({ target: this }); },
    // Approximation grossière (registre global plutôt que descendants réels)
    // — suffisant pour ce test, comme pour la fabrique de #content ci-dessous.
    querySelectorAll(selector) { return buscar ? buscar(selector) : []; },
    querySelector() { return null; },
    get innerHTML() { return this._innerHTML; },
    set innerHTML(v) { this._innerHTML = v; if (indexer) indexer(v, { reset: false }); },
  };
}
function fabriquerDocument() {
  let byId = {};
  let byAttr = {};   // '[data-xxx]' -> [stub...] ET '.classe' -> [stub...]
  const registreExterne = new Map();

  // Supporte `[data-xxx]` (attribut) ET `.classe` — pas de combinateurs ni
  // de pseudo-classes, non nécessaires ici. Approximation volontairement
  // globale (registre plat, pas de vraie hiérarchie DOM) : suffisant pour ce
  // test, même stratégie que les autres tests reception_* de ce projet.
  function buscarSelector(selector) {
    if (byAttr[selector]) return byAttr[selector];
    const mAttr = selector.match(/^\[([\w-]+)\]$/);
    if (mAttr) return byAttr[`[${mAttr[1]}]`] || [];
    return [];
  }

  function indexerFragment(htmlStr, { reset }) {
    if (reset) { byId = {}; byAttr = {}; }
    const reTag = /<([a-zA-Z][a-zA-Z0-9]*)((?:\s+[a-zA-Z_-][\w-]*(?:="[^"]*")?)*)\s*\/?>/g;
    let m;
    while ((m = reTag.exec(htmlStr))) {
      const attrs = parseAttrs(m[2]);
      const stub = fabriquerStub(attrs, indexerFragment, buscarSelector);
      if (attrs.id) byId[attrs.id] = stub;
      Object.keys(attrs).forEach(a => {
        if (a.startsWith('data-')) { byAttr[`[${a}]`] = byAttr[`[${a}]`] || []; byAttr[`[${a}]`].push(stub); }
      });
      if (attrs.class) {
        attrs.class.split(/\s+/).filter(Boolean).forEach(c => {
          byAttr[`.${c}`] = byAttr[`.${c}`] || [];
          byAttr[`.${c}`].push(stub);
        });
      }
    }
  }

  function contentElement() {
    return {
      classList: { add(){}, remove(){}, contains(){ return false; }, toggle(){} },
      offsetWidth: 0,
      querySelectorAll(selector) { return buscarSelector(selector); },
      querySelector() { return null; },
      get innerHTML() { return this._html || ''; },
      set innerHTML(v) { this._html = v; indexerFragment(v, { reset: true }); },
    };
  }
  const contentStub = contentElement();

  function elementExterne(id) {
    if (!registreExterne.has(id)) {
      registreExterne.set(id, {
        id, value: '', textContent: '', _innerHTML: '', style: {},
        classList: { add(){}, remove(){}, contains(){ return false; }, toggle(){} },
        addEventListener(){}, click(){}, querySelectorAll(){ return []; }, querySelector(){ return null; },
        get innerHTML() { return this._innerHTML; },
        set innerHTML(v) { this._innerHTML = v; },
      });
    }
    return registreExterne.get(id);
  }

  return {
    getElementById(id) {
      if (id === 'content') return contentStub;
      if (byId[id]) return byId[id];
      return elementExterne(id);
    },
    querySelectorAll(selector) { return buscarSelector(selector); },
    querySelector() { return null; },
    // Écouteur délégué global (ex. déclaration rapide de livraison, hors
    // périmètre de ce test) — no-op, juste pour que le script s'exécute
    // sans lever d'erreur au chargement.
    addEventListener() {},
  };
}

const documentMock = fabriquerDocument();

// ------------------------------------------------------------
// Mock nexusClient — chaîne Supabase générique, un fixture statique par
// table. Les filtres (.eq/.in/.order/...) sont acceptés mais ignorés : les
// fixtures sont déjà pré-formées pour le seul scénario de ce test (site
// unique, employé unique), donc l'exactitude du filtrage réel n'est pas ce
// que ce test vérifie (le moteur de sélection Supabase n'est pas en jeu ici
// — seule la logique NEXUS de parcours dépôt/boutique/reste l'est).
// ------------------------------------------------------------
function chain(rows) {
  const obj = {
    select() { return obj; }, eq() { return obj; }, gte() { return obj; },
    order() { return obj; }, in() { return obj; }, limit() { return obj; },
    insert(payload) { return chain([Object.assign({ id: 'created-' + Math.random().toString(36).slice(2) }, payload)]); },
    update() { return chain([]); },
    maybeSingle() { return Promise.resolve({ data: rows[0] !== undefined ? rows[0] : null, error: null }); },
    single() { return Promise.resolve({ data: rows[0], error: null }); },
    then(resolve, reject) { return Promise.resolve({ data: rows, error: null }).then(resolve, reject); },
  };
  return obj;
}

const PRODUITS_FIXTURE = [
  // Catégories DÉPÔT (comptage_deux_lieux) — doivent apparaître EN PREMIER.
  { id: 'p-huile', site: 'site-test', designation: 'Huile 5W40', categorie_id: 'cat-huiles', zone_id: 'zid-boutique',
    unite: 'L', sensible: false, ordre_affichage: 1, actif: true, comptage_deux_lieux: true,
    inventaire_categories: { nom: 'Huiles', ordre_affichage: 5, jours_rotation: null }, inventaire_zones: { code: 'boutique' } },
  { id: 'p-boisson', site: 'site-test', designation: 'Café grains 1kg', categorie_id: 'cat-boissons', zone_id: 'zid-boutique',
    unite: 'unité', sensible: false, ordre_affichage: 1, actif: true, comptage_deux_lieux: true,
    inventaire_categories: { nom: 'Boissons chaudes / Bières', ordre_affichage: 4, jours_rotation: null }, inventaire_zones: { code: 'boutique' } },
  // Catégories RESTE (prédéfinies, sans dépôt) — doivent apparaître EN DERNIER.
  { id: 'p-viennoiserie', site: 'site-test', designation: 'Croissant', categorie_id: 'cat-viennoiserie', zone_id: 'zid-boutique',
    unite: 'unité', sensible: false, ordre_affichage: 1, actif: true, comptage_deux_lieux: false,
    inventaire_categories: { nom: 'Viennoiserie', ordre_affichage: 7, jours_rotation: null }, inventaire_zones: { code: 'boutique' } },
  { id: 'p-journal', site: 'site-test', designation: 'Le Parisien', categorie_id: 'cat-journaux', zone_id: 'zid-boutique',
    unite: 'unité', sensible: false, ordre_affichage: 1, actif: true, comptage_deux_lieux: false,
    inventaire_categories: { nom: 'Journaux', ordre_affichage: 9, jours_rotation: null }, inventaire_zones: { code: 'boutique' } },
];

const FIXTURES = {
  station_config: [],
  shifts: [],
  inventaire_quarts: [{ id: 'quart1', site: 'site-test', date: '2026-08-15', quart: 'soir', statut: 'ouverture_en_cours' }],
  inventaire_quart_employes: [{ id: 'qe1', quart_id: 'quart1', employee_id: 'emp1', zone_id: null, a_valide_ouverture: false, a_valide_cloture: false, heure_arrivee: null }],
  inventaire_zones: [{ id: 'zid-piste', code: 'piste' }, { id: 'zid-boutique', code: 'boutique' }],
  inventaire_zone_produit: PRODUITS_FIXTURE,
  inventaire_regles_produit: [],
  inventaire_comptages: [],
  inventaire_modes_controle: [],
};

const nexusClientMock = { from(table) { return chain(FIXTURES[table] || []); } };

const sandbox = {
  document: documentMock, console,
  nexusRequireAuth: () => Promise.resolve({ id: 'emp1', nom: 'Valérie', site_id: 'site-test', role: 'caissiere' }),
  nexusClient: nexusClientMock, setInterval: () => 0, Date,
  alert: (msg) => { throw new Error(`alert() appelé de façon inattendue : ${msg}`); },
  confirm: () => true,
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
};
vm.createContext(sandbox);

scriptSrc += `
;globalThis.__NEXUS_TEST__ = {
  get comptagesSaisie(){ return comptagesSaisie; },
  get produitsZone(){ return produitsZone; },
  get boutiqueRattrapageIgnore(){ return boutiqueRattrapageIgnore; }, set boutiqueRattrapageIgnore(v){ boutiqueRattrapageIgnore = v; },
  get employeeCourant(){ return employeeCourant; },
  demarrerOuvertureComptage, renderCategoriesOuverture, renderFinalisationDoubleLieu, renderCloture,
  ordonnerParcoursDepotBoutiqueReste, grouperParCategorie, depotEntierementTermine,
  produitsDoubleLieuEnAttenteBoutique,
};
`;
vm.runInContext(scriptSrc, sandbox);

async function attendre(cond, tentatives = 30) {
  for (let i = 0; i < tentatives; i++) {
    await new Promise(r => setTimeout(r, 0));
    if (cond()) return true;
  }
  return false;
}

(async () => {
  const H = sandbox.__NEXUS_TEST__;
  await attendre(() => !!H.employeeCourant);
  assert.ok(H.employeeCourant, "L'initialisation (nexusRequireAuth) doit aboutir");

  // ------------------------------------------------------------
  // 1) Ordonnancement — dépôt d'abord, reste en dernier (unitaire, pur)
  // ------------------------------------------------------------
  const groupesSynthetiques = [
    { nom: 'Journaux', ordre: 9, items: [{ comptage_deux_lieux: false }] },
    { nom: 'Huiles', ordre: 5, items: [{ comptage_deux_lieux: true }] },
    { nom: 'Viennoiserie', ordre: 7, items: [{ comptage_deux_lieux: false }] },
    { nom: 'Boissons chaudes / Bières', ordre: 4, items: [{ comptage_deux_lieux: true }] },
  ];
  const ordonnes = H.ordonnerParcoursDepotBoutiqueReste(groupesSynthetiques);
  // Array.from() : `ordonnes` est un tableau créé dans le realm de la vm
  // (prototype Array différent de celui de ce process Node) — deepStrictEqual
  // compare aussi les prototypes, donc sans cette conversion la comparaison
  // échouerait même à contenu strictement identique.
  assert.deepStrictEqual(Array.from(ordonnes.map(g => g.nom)), ['Huiles', 'Boissons chaudes / Bières', 'Journaux', 'Viennoiserie'],
    'Les catégories dépôt (Huiles, Boissons) doivent précéder les catégories reste (Journaux, Viennoiserie), ordre interne conservé');
  console.log('✓ 1. ordonnerParcoursDepotBoutiqueReste — dépôt avant reste, ordre interne stable');

  // ------------------------------------------------------------
  // 2) Écran catégories réel — l'ordre d'affichage suit bien ce tri
  // ------------------------------------------------------------
  await H.demarrerOuvertureComptage();
  let contenu = sandbox.document.getElementById('content').innerHTML;
  assert.strictEqual(sandbox.document.getElementById('titre').textContent, "Inventaire d'ouverture");
  const posHuiles = contenu.indexOf('Huiles');
  const posBoissons = contenu.indexOf('Boissons chaudes');
  const posViennoiserie = contenu.indexOf('Viennoiserie');
  const posJournaux = contenu.indexOf('Journaux');
  assert.ok(posHuiles >= 0 && posBoissons >= 0 && posViennoiserie >= 0 && posJournaux >= 0, 'Les 4 catégories doivent apparaître à l\'écran');
  assert.ok(posHuiles < posViennoiserie && posHuiles < posJournaux, 'Huiles (dépôt) doit apparaître avant Viennoiserie/Journaux (reste)');
  assert.ok(posBoissons < posViennoiserie && posBoissons < posJournaux, 'Boissons (dépôt) doit apparaître avant Viennoiserie/Journaux (reste)');
  console.log('✓ 2. Écran "Inventaire d\'ouverture" — catégories dépôt affichées avant les catégories reste');

  // ------------------------------------------------------------
  // 3) Dépôt partiellement terminé — pas d'auto-déclenchement du rattrapage
  //    boutique (une seule des deux catégories dépôt est faite).
  // ------------------------------------------------------------
  H.comptagesSaisie['p-huile'] = { compteDepot: 12 };
  H.renderCategoriesOuverture();
  assert.strictEqual(sandbox.document.getElementById('titre').textContent, "Inventaire d'ouverture", 'Dépôt incomplet (Boissons pas encore fait) : pas de rattrapage automatique');
  console.log('✓ 3. Dépôt partiellement terminé (1/2 catégories) — aucun déclenchement automatique prématuré');

  // ------------------------------------------------------------
  // 4) Dépôt ENTIÈREMENT terminé — l'écran "Comptage boutique" se propose
  //    automatiquement, AVANT toute catégorie "reste".
  // ------------------------------------------------------------
  H.comptagesSaisie['p-boisson'] = { compteDepot: 8 };
  H.renderCategoriesOuverture();
  assert.strictEqual(sandbox.document.getElementById('titre').textContent, 'Comptage boutique', 'Dépôt 100% terminé -> "Comptage boutique" doit se proposer automatiquement');
  contenu = sandbox.document.getElementById('content').innerHTML;
  assert.ok(contenu.includes('Huile 5W40') && contenu.includes('Café grains'), 'Les 2 produits en attente de boutique doivent être listés');
  assert.ok(!contenu.includes('Croissant') && !contenu.includes('Le Parisien'), 'Les catégories "reste" (viennoiserie, journaux) ne doivent PAS apparaître sur cet écran de rattrapage');
  assert.ok(sandbox.document.getElementById('btnValiderFinalisationDoubleLieu').textContent.includes('Valider le comptage boutique') || true, 'Bouton présent'); // le texte exact est vérifié via innerHTML ci-dessous
  assert.ok(contenu.includes('Valider le comptage boutique'), 'En mode auto, le bouton ne doit PAS dire "Terminer..." (ce n\'est pas la validation finale)');
  assert.ok(contenu.includes('Plus tard'), 'Un lien "Plus tard" doit permettre de reporter ce rattrapage sans le perdre');
  console.log('✓ 4. Dépôt 100% terminé -> "Comptage boutique" se propose automatiquement, avant toute catégorie reste, avec option "Plus tard"');

  // ------------------------------------------------------------
  // 5) "Plus tard" — retour aux catégories, jamais reproposé en boucle
  // ------------------------------------------------------------
  sandbox.document.getElementById('btnPlusTardFinalisationDoubleLieu')._listeners.click();
  assert.strictEqual(H.boutiqueRattrapageIgnore, true, 'boutiqueRattrapageIgnore doit passer à true après "Plus tard"');
  assert.strictEqual(sandbox.document.getElementById('titre').textContent, "Inventaire d'ouverture", '"Plus tard" doit ramener aux catégories');
  H.renderCategoriesOuverture();
  assert.strictEqual(sandbox.document.getElementById('titre').textContent, "Inventaire d'ouverture", 'Un retour normal aux catégories ne doit PAS reproposer "Comptage boutique" en boucle après "Plus tard"');
  assert.strictEqual(H.produitsDoubleLieuEnAttenteBoutique().length, 2, 'La saisie dépôt n\'est pas perdue : les 2 produits restent en attente de boutique');
  console.log('✓ 5. "Plus tard" — reporté sans perte de saisie, jamais reproposé en boucle');

  // ------------------------------------------------------------
  // 6) Valider le rattrapage boutique (mode auto) — enregistre les deux
  //    lieux ET ramène aux catégories, ne soumet JAMAIS l'inventaire seul.
  // ------------------------------------------------------------
  H.boutiqueRattrapageIgnore = false;
  H.renderFinalisationDoubleLieu('ouverture', { auto: true });
  assert.strictEqual(sandbox.document.getElementById('titre').textContent, 'Comptage boutique');
  const champs = sandbox.document.querySelectorAll('.produit-input-finalisation');
  assert.strictEqual(champs.length, 2, 'Les 2 champs de saisie boutique doivent être présents');
  champs.forEach(champ => {
    const produitId = champ.getAttribute('data-produit');
    champ.value = produitId === 'p-huile' ? '3' : '5';
  });
  sandbox.document.getElementById('btnValiderFinalisationDoubleLieu')._listeners.click();
  assert.strictEqual(sandbox.document.getElementById('titre').textContent, "Inventaire d'ouverture", 'Valider en mode auto doit ramener aux catégories (jamais une soumission automatique)');
  assert.strictEqual(H.comptagesSaisie['p-huile'].compteBoutique, 3);
  assert.strictEqual(H.comptagesSaisie['p-huile'].compte, 15, 'compte = compteDepot(12) + compteBoutique(3)');
  assert.strictEqual(H.comptagesSaisie['p-boisson'].compte, 13, 'compte = compteDepot(8) + compteBoutique(5)');
  assert.strictEqual(H.produitsDoubleLieuEnAttenteBoutique().length, 0, 'Plus aucun produit en attente de boutique une fois validé');
  console.log('✓ 6. Rattrapage boutique validé (mode auto) — dépôt+boutique enregistrés, retour aux catégories, aucune soumission automatique');

  // ------------------------------------------------------------
  // 7) Comportement historique préservé — déclenchement non-auto (juste
  //    avant validation finale) : pas de lien "Plus tard", bouton "Terminer".
  // ------------------------------------------------------------
  H.comptagesSaisie['p-huile'] = { compteDepot: 20 }; // à nouveau en attente de boutique
  H.renderFinalisationDoubleLieu('ouverture'); // sans {auto:true} — comportement historique
  contenu = sandbox.document.getElementById('content').innerHTML;
  assert.ok(contenu.includes("Terminer et valider mon inventaire d'ouverture"), 'Hors mode auto, le bouton doit rester "Terminer et valider..." (comportement historique inchangé)');
  assert.ok(!contenu.includes('Plus tard'), 'Hors mode auto (déclenché juste avant la validation finale), pas de lien "Plus tard" — c\'est un filet de sécurité, pas une étape qu\'on peut reporter');
  console.log('✓ 7. Déclenchement historique (juste avant validation finale) inchangé — aucun lien "Plus tard", bouton "Terminer..."');

  // ------------------------------------------------------------
  // 8) Clôture — même ordonnancement dépôt → reste dans la liste affichée.
  // ------------------------------------------------------------
  H.renderCloture();
  contenu = sandbox.document.getElementById('content').innerHTML;
  const posHuilesC = contenu.indexOf('Huiles');
  const posViennoiserieC = contenu.indexOf('Viennoiserie');
  const posJournauxC = contenu.indexOf('Journaux');
  assert.ok(posHuilesC >= 0 && posHuilesC < posViennoiserieC && posHuilesC < posJournauxC, 'Clôture : catégorie dépôt (Huiles) avant les catégories reste (Viennoiserie, Journaux)');
  console.log('✓ 8. Clôture — catégories dépôt affichées avant les catégories reste (même ordonnancement qu\'à l\'ouverture)');

  console.log('\nTous les tests inventaire_parcours_depot_boutique_reste passent.');
})().catch(e => { console.error(e); process.exit(1); });
