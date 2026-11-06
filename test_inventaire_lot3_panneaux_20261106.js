// Contrôle inventaire — lot 3 « panneaux » (06/11/2026).
// Garde-fou imposé après l'incident #207 : aucun test n'exécutait `renderTout` jusqu'au bout.
// Ce test charge le script ENTIER de NEXUS-Inventaire-Manager-v1.html dans un contexte `vm`
// (mini-DOM à base d'expressions régulières, aucune dépendance) et appelle `renderTout` sur trois
// contextes réalistes : quart clos avec alertes, quart pas encore démarré, photo Decenium active.
// Toute exception, tout lien manquant (flèches de date, périodes, décisions, Tout valider,
// import) ou tout « Chargement… » fait échouer le test.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Inventaire-Manager-v1.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const script = scripts.sort((a, b) => b.length - a.length)[0];
assert(script && script.includes('function renderTout'), 'script principal introuvable');

// ---------- mini-DOM ----------
const idsStatiques = new Set([...html.replace(/<script[\s\S]*?<\/script>/g, '').matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
const liens = {}; // clé de sélecteur -> nombre d'écouteurs posés

function creerElement(cle, attrs) {
  const el = {
    _cle: cle, _html: '', _attrs: attrs || {}, dataset: {}, hidden: false, value: '', textContent: '', style: {}, children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() { liens[cle] = (liens[cle] || 0) + 1; },
    removeEventListener() {}, appendChild(x) { return x; }, insertAdjacentHTML() {}, insertAdjacentElement() {},
    scrollIntoView() {}, focus() {}, click() {}, remove() {}, closest() { return null; },
    getAttribute(n) { return this._attrs[n] === undefined ? null : this._attrs[n]; },
    setAttribute(n, v) { this._attrs[n] = v; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    contains() { return false; }, parentNode: null,
  };
  Object.defineProperty(el, 'innerHTML', { configurable: true, get() { return this._html; }, set(v) { this._html = String(v); } });
  return el;
}

function creerDocument() {
  const elements = {};
  const doc = { currentContenu: '' };
  const parId = id => {
    if (!idsStatiques.has(id) && !new RegExp('\\sid="' + id.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '"').test(doc.currentContenu)) return null;
    return elements[id] || (elements[id] = creerElement('#' + id));
  };
  // Sélecteurs gérés : liste séparée par des virgules de `#id`, `.classe`, `tag`, `[attr]`, `[attr="v"]`, avec suffixe d'attribut éventuel.
  const trouver = sel => {
    const sortie = [];
    sel.split(',').map(s => s.trim()).forEach(s => {
      const dernier = s.split(/\s+/).pop().replace(/^>/, '');
      const cls = (dernier.match(/\.([\w-]+)/) || [])[1];
      const attr = dernier.match(/\[([\w-]+)(?:="([^"]*)")?\]/);
      const tag = (dernier.match(/^([a-z][\w-]*)/) || [])[1];
      const reBalise = /<([a-z][\w-]*)\b([^>]*)>/g;
      let m, i = 0;
      while ((m = reBalise.exec(doc.currentContenu))) {
        const attrs = {};
        m[2].replace(/([\w-]+)="([^"]*)"/g, (_, k, v) => { attrs[k] = v; return ''; });
        if (tag && m[1] !== tag) continue;
        if (cls && !(attrs.class || '').split(/\s+/).includes(cls)) continue;
        if (attr && (attrs[attr[1]] === undefined || (attr[2] !== undefined && attrs[attr[1]] !== attr[2]))) continue;
        const el = creerElement(s);
        el.dataset = Object.fromEntries(Object.keys(attrs).filter(k => k.startsWith('data-')).map(k => [k.slice(5).replace(/-(\w)/g, (_, c) => c.toUpperCase()), attrs[k]]));
        el._attrs = attrs; el._i = i++;
        sortie.push(el);
      }
    });
    return sortie;
  };
  doc.getElementById = id => parId(id);
  doc.querySelector = sel => (sel.startsWith('#') && !sel.includes(' ') ? parId(sel.slice(1)) : trouver(sel)[0] || null);
  doc.querySelectorAll = sel => trouver(sel);
  doc.createElement = () => creerElement('createElement');
  doc.addEventListener = () => {};
  doc.documentElement = creerElement('html');
  doc.body = creerElement('body');
  doc.head = creerElement('head');
  doc.elements = elements;
  return doc;
}

// ---------- contexte d'exécution ----------
function creerContexte() {
  const document = creerDocument();
  const chaine = () => { const p = new Proxy(function () {}, { get: (_, k) => (k === 'then' ? undefined : p), apply: () => p }); return p; };
  const sandbox = {
    document, console, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    window: { location: { search: '', href: '' }, addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    navigator: { userAgent: 'test' }, location: { search: '', href: '' },
    URLSearchParams, Intl, Date, Promise, JSON, Math, Set, Map, Array, Object, String, Number, Error, RegExp,
    nexusRequireAuth: () => new Promise(() => {}), // l'initialisation réelle n'a pas lieu : on appelle renderTout nous-mêmes
    nexusClient: chaine(), XLSX: {}, PDFLib: {},
    NexusComposantsPilotage: require('./nexus-composants-pilotage.js'),
    NexusBanniereStation: require('./nexus-banniere-station.js'),
    NexusTheme: { definirFuseau() {} }, NexusForfait: {}, NexusInventaireMoteur: {},
  };
  // Les modules s'accrochent à `window` : ici window est le contexte global lui-même.
  Object.assign(sandbox, sandbox.window);
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  const ctx = vm.createContext(sandbox);
  // Modules d'inventaire que la page charge elle-même (<script src="nexus-inventaire-*.js">) : exécutés tels quels.
  [...html.matchAll(/<script src="(nexus-inventaire-[\w-]+\.js)[^"]*"/g)].forEach(m => {
    vm.runInContext(fs.readFileSync(path.join(__dirname, m[1]), 'utf8'), ctx, { filename: m[1] });
  });
  return ctx;
}

function chargerPage() {
  const contexte = creerContexte();
  vm.runInContext(script, contexte, { filename: 'NEXUS-Inventaire-Manager-v1.html' });
  return contexte;
}

// ---------- jeux de données ----------
const cat = (nom, total, comptes, manquants) => ({ nom, total, comptes, zones: new Set(['piste']), produitsManquants: manquants || [],
  zoneLabel: 'Piste', statutLabel: comptes === 0 ? 'Non commencé' : comptes < total ? 'En cours' : 'Terminé' });
const alerte = (id, type) => ({ id, type_alerte: type || 'ecart_comptage', gravite: 'attention', statut: 'ouverte', produit_id: 'p-' + id,
  valeur_attendue: 5, valeur_constatee: 3, cree_le: '2026-11-06T10:00:00Z', inventaire_produits: { designation: 'Produit ' + id } });

function ctxDe(quartStatut, avecAlertes, photo, ventes) {
  const alertesOuvertes = avecAlertes ? [alerte('a1'), alerte('a2', 'cloture_incomplete')] : [];
  const categories = [cat('Boissons', 4, 4), cat('Confiserie', 6, 2, ['Bonbon', 'Gum', 'Réglisse', 'Menthe']), cat('Auto', 3, 0, ['Huile', 'Lave-glace', 'Balai'])];
  const synthese = {
    phase: 'clotures', total: 13, comptes: 6, manquants: 7, pourcentage: 46, categories, categoriesTotal: 3,
    categoriesTerminees: 1, categoriesIncompletes: categories.filter(c => c.comptes < c.total), ecartsAControler: alertesOuvertes.length, clotureImpossible: true,
  };
  return {
    alertesOuvertes, sensiblesNonComptesDetail: [], employesSite: [], modesAveugleActifs: [], jaugeageActif: false,
    synthese, etat: { texte: 'Clôturé', urgence: null }, produitsSensiblesTotal: 0,
    decisionsQuart: avecAlertes ? [{ id: 'd1', resolution: 'validee', cree_le: '2026-11-06T11:00:00Z', alerte_id: 'a0' }, { id: 'd2', resolution: 'recomptage', cree_le: '2026-11-06T11:05:00Z', alerte_id: 'a3' }] : [],
    review: null, bornes: { debut: '2026-11-06', fin: '2026-11-06' }, alertesPeriode: [], decisionsPeriode: [],
    importDeceniumFait: !!ventes, couverture7: null, couverture14: null, couverture30: null,
    qualiteRapprochement: null, maturiteInventaire: null, cutoverInventaire: null, missionsAvecRapprochement: [],
    snapshotActif: photo ? { id: 's1', cree_le: '2026-11-06T09:00:00Z', reference: 'REF-1', confiance: 'bonne' } : null,
    quartStatut,
  };
}

const cas = [
  { nom: 'quart clos avec alertes', quart: { id: 'q1', statut: 'cloture', date: '2026-11-06', quart: 'matin' }, ctx: ctxDe('cloture', true, false, false), ventes: 'non-importees' },
  { nom: 'quart pas encore démarré', quart: null, ctx: ctxDe(null, false, false, false), ventes: 'quart-non-demarre' },
  { nom: 'photo Decenium active', quart: { id: 'q2', statut: 'cloture', date: '2026-11-06', quart: 'matin' }, ctx: ctxDe('cloture', true, true, true), ventes: 'importees' },
];

let verifies = 0;
for (const c of cas) {
  const contexte = chargerPage();
  const doc = contexte.document;
  const contenu = doc.getElementById('content');
  assert(contenu, 'le conteneur #content doit exister dans la page');
  // Le script déclare ses états avec `let` : on les pose dans la portée du script.
  vm.runInContext('quartRow = ' + JSON.stringify(c.quart) + '; dateSelectionnee = "2026-11-06"; periodeSelectionnee = "jour";', contexte);
  // `renderTout` pose innerHTML sur #content ; le mini-DOM relit ensuite ce HTML pour les sélecteurs.
  Object.defineProperty(contenu, 'innerHTML', { configurable: true, get() { return doc.currentContenu; }, set(v) { doc.currentContenu = String(v); } });
  contexte.__ctx = c.ctx;
  try {
    vm.runInContext('renderTout(__ctx)', contexte);
  } catch (e) {
    assert.fail(`renderTout a levé une exception sur « ${c.nom} » : ${e && e.stack || e}`);
  }
  const rendu = doc.currentContenu;
  assert(rendu.length > 500, `${c.nom} : rendu vide`);
  assert(!/Chargement…|Chargement\.\.\./.test(rendu), `${c.nom} : « Chargement… » ne doit jamais rester une fois la page rendue`);
  assert.strictEqual(contenu.dataset.ventes, c.ventes, `${c.nom} : statut des ventes`);
  assert.strictEqual(contenu.dataset.vue, 'jour', `${c.nom} : data-vue`);
  if (!c.quart) {
    // Comportement inchangé : sans quart démarré, la page dit qu'aucun inventaire n'a commencé
    // (pas de carte d'import ni de panneaux : il n'y a rien à importer ni à décider).
    assert(rendu.includes("Aucun inventaire n'a encore été démarré"), `${c.nom} : message d'attente absent`);
    assert(!rendu.includes('id="sectionATerminer"') && !rendu.includes('id="sectionAControler"'), `${c.nom} : aucun panneau attendu`);
    // Carte Photo Decenium en lecture seule : état visible, aucun formulaire d'import.
    assert(/class="section-titre"[^>]*>[^<]*Photo Decenium/.test(rendu) && rendu.includes('quart pas encore démarré'), `${c.nom} : carte Photo en lecture seule absente`);
    assert(!rendu.includes('id="ventesFileInput"') && !rendu.includes('id="btnComparerVentes"'), `${c.nom} : aucun import sans quart`);
    verifies++;
    continue;
  }
  assert(rendu.includes('id="sectionATerminer"'), `${c.nom} : panneau Comptages absent`);
  assert(rendu.includes('id="sectionAControler"'), `${c.nom} : panneau Décisions absent`);
  assert(/Photo Decenium|PHOTO DECENIUM/.test(rendu), `${c.nom} : carte Photo Decenium absente`);
  assert((rendu.match(/class="section-titre"[^>]*>[^<]*Photo Decenium/gi) || []).length <= 1, `${c.nom} : la Photo Decenium doit tenir en une seule carte`);
  if (c.ctx.decisionsQuart.length) {
    assert(rendu.includes('class="inv-historique"') && !rendu.includes('Aucune décision enregistrée'), `${c.nom} : l'historique des décisions doit s'afficher (${c.ctx.decisionsQuart.length} décisions)`);
  }
  if (c.ctx.alertesOuvertes.length) {
    assert.strictEqual((rendu.match(/class="inv-fiche"/g) || []).length, c.ctx.alertesOuvertes.length, `${c.nom} : une fiche par anomalie ouverte`);
    // Les 5 décisions existantes restent proposées, inchangées, dans chaque fiche.
    const decisions = [...rendu.matchAll(/data-decision="([^"]+)"/g)].map(m => m[1]);
    assert(new Set(decisions).size >= 5, `${c.nom} : les 5 décisions doivent rester disponibles (trouvé ${[...new Set(decisions)].join(',')})`);
    assert(liens['.btn-decision[data-decision]'] > 0 || liens['.btn-decision'] > 0, `${c.nom} : boutons de décision non liés`);
    assert(liens['#btnToutValider'] > 0 || !rendu.includes('id="btnToutValider"'), `${c.nom} : Tout valider non lié`);
  } else {
    assert(rendu.includes('Aucun écart ouvert'), `${c.nom} : état vide des décisions`);
  }
  // Une ligne par catégorie, les incomplètes d'abord.
  const lignes = [...rendu.matchAll(/class="categorie-manquante inv-cat [^"]*"[^>]*data-cat="([^"]*)"/g)].map(m => m[1]);
  const attendu = c.ctx.synthese.categories.map(x => x.nom);
  assert.deepStrictEqual([...lignes].sort(), [...attendu].sort(), `${c.nom} : une ligne par catégorie`);
  assert(liens['.categorie-manquante'] > 0, `${c.nom} : les lignes de catégorie doivent se déplier (écouteur manquant)`);
  verifies++;
}
assert.strictEqual(verifies, cas.length);

// Liaisons posées par le script hors rendu : flèches de date, périodes, import.
assert(/function brancherEntete[\s\S]*btnJourPrec[\s\S]*btnJourSuiv/.test(script), 'flèches de date liées par brancherEntete');
assert(/querySelectorAll\('\.periode-pill'\)\.forEach\(el => el\.addEventListener\('click'/.test(script), 'périodes liées après le rendu');
assert(/getElementById\('btnComparerVentes'\)/.test(script), 'import des ventes lié après le rendu');
assert(/getElementById\('btnToutValider'\)/.test(script), 'Tout valider lié après le rendu');

console.log(`OK : renderTout exécuté jusqu'au bout sur ${verifies} contextes réalistes.`);
