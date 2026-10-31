// Test — Repère de cage (lot INVENTAIRE-GAZ-CAGE-20261031) et DOM de l'employé.
// 1. Le repère ne dit jamais une quantité, n'apparaît qu'à la clôture, au passé, daté.
// 2. Le HTML réellement rendu pour un employé (carrousel d'ouverture) ne contient pas la valeur transmise.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const SRC = fs.readFileSync(path.join(__dirname, 'NEXUS-Inventaire-v1.html'), 'utf8');

function extraire(nom, source) {
  const debut = source.indexOf(`function ${nom}(`);
  assert.ok(debut >= 0, `fonction ${nom} introuvable`);
  let i = source.indexOf('{', debut), n = 0;
  for (let j = i; j < source.length; j++) {
    if (source[j] === '{') n++;
    else if (source[j] === '}' && --n === 0) return source.slice(debut, j + 1);
  }
  throw new Error(`accolade non fermée pour ${nom}`);
}
let ok = 0;
function cas(nom, f) { f(); ok++; console.log('  ✓ ' + nom); }

function charger(source, reperes) {
  const ctx = { reperesCage: reperes || {} };
  vm.createContext(ctx);
  vm.runInContext(['const REPERE_CAGE_VALIDITE_MS = 24 * 3600 * 1000;', extraire('calculerRepereCage', source), extraire('repereCageHtml', source)].join('\n') + '\nthis.calc = calculerRepereCage; this.html = repereCageHtml;', ctx);
  return ctx;
}
const CFG = { nb_cages: 5, capacite: 30 };
const T0 = Date.parse('2026-10-31T20:00:00Z');
const dernier = (q, dt = 3600e3) => ({ quantite: q, compte_le: new Date(T0 - dt).toISOString() });
const calc = (src, q, o = {}) => charger(src).calc(o.cfg === undefined ? CFG : o.cfg, o.d === undefined ? dernier(q, o.dt) : o.d, o.depuis, T0);
const gaz = { id: 'gaz', designation: 'Gaz 12,5 kg', repere_cage: CFG };
const rendu = (src, q, extra) => { const r = calc(src, q, extra); return charger(src, r ? { gaz: r } : {}).html(gaz); };

cas('cage déduite du dernier comptage, bornes comprises', () => {
  const att = { 150: 1, 151: null, 121: 1, 120: 2, 91: 2, 90: 3, 61: 3, 60: 4, 31: 4, 30: 5, 1: 5, 127: 1, 27: 5 };
  for (const [q, cage] of Object.entries(att)) {
    const r = calc(SRC, Number(q));
    if (cage === null) assert.strictEqual(r, null, `q=${q}`); else assert.strictEqual(r.cage, cage, `q=${q}`);
  }
  assert.strictEqual(calc(SRC, 150).plein, true);
  assert.strictEqual(calc(SRC, 149).plein, false);
  assert.strictEqual(calc(SRC, 0).etat, 'epuise');
  assert.strictEqual(calc(SRC, -1), null);
});
cas('textes rendus, sans aucune quantité', () => {
  const h = rendu(SRC, 127);
  assert.ok(/dernier comptage \(.+\), votre collègue était à la cage 1\./.test(h), h);
  assert.ok(!h.includes('127'));
  assert.ok(rendu(SRC, 27).includes('cage 5'));
  assert.ok(!rendu(SRC, 27).includes('27'));
  assert.ok(rendu(SRC, 150).includes('la vente commence à la cage 1'));
  assert.ok(rendu(SRC, 0).includes('Stock épuisé au dernier comptage'));
});
cas('abstention : comptage ancien, livraison, correction, brouillon, réglage absent', () => {
  const MSG = 'Aucun repère de cage disponible. Effectuez le comptage complet.';
  assert.ok(rendu(SRC, 127, { dt: 25 * 3600e3 }).includes(MSG));
  assert.ok(rendu(SRC, 127, { dt: 23 * 3600e3 }).includes('cage 1'));
  assert.ok(rendu(SRC, 127, { depuis: { mouvements: 1, corrections: 0 } }).includes(MSG));
  assert.ok(rendu(SRC, 127, { depuis: { mouvements: 0, corrections: 1 } }).includes(MSG));
  assert.ok(rendu(SRC, 127, { depuis: { mouvements: 0, corrections: 0 } }).includes('cage 1'));
  assert.ok(rendu(SRC, 127, { d: null }).includes(MSG));
  assert.ok(rendu(SRC, 127, { cfg: null }).includes(MSG));
  assert.strictEqual(calc(SRC, 127, { cfg: { nb_cages: 0, capacite: 30 } }), null);
  assert.strictEqual(calc(SRC, 127, { cfg: { texte: 'x', date: '2026-10-31' } }), null);
  assert.strictEqual(charger(SRC).html({ id: 'x', repere_cage: null }), '');
  assert.strictEqual(charger(SRC).html({ id: 'x' }), '');
});
cas('le repère n\'est branché qu\'à la clôture et lit seulement des comptages validés', () => {
  assert.strictEqual(SRC.split('repereCageHtml(').length - 1, 2, 'définition + un seul appel');
  assert.ok(extraire('renderLigneCloture', SRC).includes('repereCageHtml(p)'));
  for (const n of ['renderCarrousel', 'renderCarrouselProduction', 'renderLigneOuverture']) {
    if (SRC.includes(`function ${n}(`)) assert.ok(!extraire(n, SRC).includes('repereCageHtml'), n);
  }
  assert.ok(extraire('demarrerCloture', SRC).includes('chargerReperesCage(produitsZone)'));
  assert.ok(extraire('chargerReperesCage', SRC).includes(".eq('statut', 'valide')"));
});

// chargerReperesCage rejoué contre une base simulée qui applique réellement les filtres demandés.
async function reperesDepuis(source, lignes) {
  const filtres = { in: {}, eq: {} };
  const table = (nom) => {
    const q = { _f: [] };
    q.select = () => q;
    q.in = (c, v) => { q._f.push((r) => v.includes(r[c])); return q; };
    q.eq = (c, v) => { q._f.push((r) => r[c] === v); return q; };
    q.gt = () => q;
    q.order = () => Promise.resolve({ data: nom === 'inventaire_comptages' ? lignes.filter((r) => q._f.every((g) => g(r))).sort((a, b) => b.compte_le.localeCompare(a.compte_le)) : [], error: null });
    q.then = (res) => res({ count: 0, error: null });
    return q;
  };
  const ctx = { reperesCage: {}, nexusClient: { from: table }, console, Date: class extends Date { static now() { return T0; } } };
  vm.createContext(ctx);
  vm.runInContext(['const REPERE_CAGE_VALIDITE_MS = 24 * 3600 * 1000;', extraire('calculerRepereCage', source), 'async ' + extraire('chargerReperesCage', source), 'this.go = chargerReperesCage;'].join('\n'), ctx);
  await ctx.go([{ id: 'gaz', repere_cage: CFG }]);
  return ctx.reperesCage.gaz || null;
}
const ligne = (type, q, dt, extra) => Object.assign({ id: type + q, produit_id: 'gaz', type_comptage: type, quantite: q, statut: 'valide', source: 'manuel', compte_le: new Date(T0 - dt).toISOString() }, extra);
(async () => {
  let r = await reperesDepuis(SRC, [ligne('cloture', 27, 12 * 3600e3), ligne('ouverture', 127, 1 * 3600e3)]);
  assert.strictEqual(r && r.cage, 1, 'ouverture 127 après clôture 27 : cage 1'); ok++; console.log('  ✓ ouverture du quart plus récente que la clôture de la veille');
  r = await reperesDepuis(SRC, [ligne('cloture', 27, 3 * 3600e3), ligne('ouverture', 127, 1 * 3600e3, { source: 'transmis' })]);
  assert.strictEqual(r && r.cage, 5, 'ligne transmise auto plus récente ignorée'); ok++; console.log('  ✓ ligne transmise automatique ignorée');
  r = await reperesDepuis(SRC, [ligne('cloture', 27, 3 * 3600e3), ligne('ouverture', 127, 1 * 3600e3, { statut: 'annule' })]);
  assert.strictEqual(r && r.cage, 5, 'ligne non validée ignorée'); ok++; console.log('  ✓ ligne non validée ignorée');
  // mutation : ancienne source (clôtures seules) détectée par la première épreuve
  const ancien = SRC.replace(".in('type_comptage', ['ouverture', 'cloture'])", ".eq('type_comptage', 'cloture')");
  assert.notStrictEqual(ancien, SRC);
  const rm = await reperesDepuis(ancien, [ligne('cloture', 27, 12 * 3600e3), ligne('ouverture', 127, 1 * 3600e3)]);
  assert.notStrictEqual(rm && rm.cage, 1, 'mutation « clôtures seules » non détectée'); ok++; console.log('  ✓ mutation détectée : clôtures seules');
  const sansSource = SRC.replace(".eq('source', 'manuel')", '');
  const rs = await reperesDepuis(sansSource, [ligne('cloture', 27, 3 * 3600e3), ligne('ouverture', 127, 1 * 3600e3, { source: 'transmis' })]);
  assert.notStrictEqual(rs && rs.cage, 5, 'mutation « source non filtrée » non détectée'); ok++; console.log('  ✓ mutation détectée : source non filtrée');
  console.log(`\n${ok} vérifications passées (suite asynchrone)`);
})().catch((e) => { console.error(e); process.exit(1); });

// HTML rendu pour un employé : carrousel d'ouverture avec un stock transmis connu.
function rendreCarrousel(source, role, transmis) {
  const sortie = { html: '' };
  const els = {};
  const elem = (id) => els[id] || (els[id] = { textContent: '', set innerHTML(v) { if (id === 'content') sortie.html = v; }, addEventListener() {}, focus() {}, select() {}, classList: { add() {}, remove() {} }, style: {}, dataset: {}, value: '' });
  const base = {
    roleDuJour: role, produitsPlanIds: new Set(), modesAveugle: [], employeeCourant: { id: 'e1' },
    document: { getElementById: elem, querySelectorAll: () => [] },
    carrouselIndex: 0, carrouselModeCorrection: false, quartActuel: 'soir', profilParProduit: {}, comptagesSaisie: {},
    dernierStock: { gaz: { quantite: transmis } }, dateISO: () => '2026-10-31', livraisonRapideDeclaree: () => false,
    libelleEtapeParcours: () => ({ titre: 't', sousTitre: 's' }), renderBarreProgression: () => '', calcBarreHtml: () => '',
    renderSelectMotif: () => '', estComptageDeuxLieuxEmploye: () => false, estCigaretteCaisseEmploye: () => false,
    fmtNum: (n) => String(n), texteEcartOuverture: (e) => `Réassort potentiel +${e}`,
  };
  const ctx = new Proxy(base, { has: () => true, get: (t, k) => (k in t ? t[k] : (k === Symbol.unscopables ? undefined : () => undefined)), set: (t, k, v) => { t[k] = v; return true; } });
  vm.createContext(ctx);
  vm.runInContext(['comptageAveugleImpose', 'estMasquePourProduit', 'renderCarrousel'].map((n) => extraire(n, source)).join('\n'), ctx);
  base.renderCarrousel({ nom: 'Gaz', items: [{ id: 'gaz', designation: 'Gaz 12,5 kg', unite: 'u', categorie_id: 'c' }] });
  return sortie.html;
}
const TRANSMIS = 127;
cas('HTML rendu pour un employé : aucune trace de la valeur transmise', () => {
  for (const role of ['pompiste', 'caissiere', 'renfort']) {
    const h = rendreCarrousel(SRC, role, TRANSMIS);
    assert.ok(h.length > 100, 'le carrousel a bien été rendu');
    assert.ok(!h.includes(String(TRANSMIS)), `${role} : valeur transmise dans le HTML`);
    assert.ok(!/Stock transmis|Transmis :/.test(h), `${role} : libellé de stock transmis`);
    assert.ok(!h.includes('btnConforme') && !h.includes('Identique — valider'), `${role} : bouton Identique actif`);
    assert.ok(!/Réassort potentiel/.test(h));
  }
});
cas('le manager voit toujours le transmis (le test sait détecter)', () => {
  const h = rendreCarrousel(SRC, 'manager', TRANSMIS);
  assert.ok(h.includes(String(TRANSMIS)));
});

function mute(nom, de, vers, verif) {
  assert.ok(SRC.includes(de), `ancre « ${nom} » introuvable`);
  let echoue = false; try { verif(SRC.replace(de, vers)); } catch (e) { echoue = true; }
  assert.ok(echoue, `mutation « ${nom} » non détectée`);
  ok++; console.log('  ✓ mutation détectée : ' + nom);
}
mute('employé démasqué', 'if (comptageAveugleImpose()) return true;', '', (s) => assert.ok(!rendreCarrousel(s, 'pompiste', TRANSMIS).includes(String(TRANSMIS))));
mute('cage inversée', 'config.nb_cages - Math.ceil(q / config.capacite) + 1', 'Math.ceil(q / config.capacite)', (s) => assert.strictEqual(charger(s).calc(CFG, dernier(127), undefined, T0).cage, 1));
mute('arrondi bas', 'Math.ceil(q / config.capacite)', 'Math.floor(q / config.capacite)', (s) => assert.strictEqual(charger(s).calc(CFG, dernier(31), undefined, T0).cage, 4));
mute('au-delà de la capacité admis', 'q > config.nb_cages * config.capacite) return null', 'false) return null', (s) => assert.strictEqual(charger(s).calc(CFG, dernier(151), undefined, T0), null));
mute('comptage ancien admis', ' || maintenant - t > REPERE_CAGE_VALIDITE_MS', '', (s) => assert.strictEqual(charger(s).calc(CFG, dernier(127, 25 * 3600e3), undefined, T0), null));
mute('livraison depuis ignorée', 'depuisComptage.mouvements || depuisComptage.corrections', 'false', (s) => assert.strictEqual(charger(s).calc(CFG, dernier(127), { mouvements: 1 }, T0), null));
mute('quantité dans le texte', "`Lors du dernier comptage (${quand}), votre collègue était à la cage ${cage}.`", "`Lors du dernier comptage (${quand}), ${r.quantite} à la cage ${cage}.`", (s) => assert.ok(!/127/.test(charger(s, { gaz: Object.assign(charger(s).calc(CFG, dernier(127), undefined, T0), { quantite: 127 }) }).html(gaz))));
mute('repère branché au carrousel', "const transmis = dernierStock[p.id];\n    const masque", "const transmis = dernierStock[p.id]; repereCageHtml(p);\n    const masque", (s) => assert.strictEqual(s.split('repereCageHtml(').length - 1, 2));

console.log(`\n${ok} vérifications passées`);
