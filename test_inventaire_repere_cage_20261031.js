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

function chargerRepere(source) {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(extraire('repereCageHtml', source), ctx);
  return ctx.repereCageHtml;
}
const gaz = (r) => ({ id: 'gaz', designation: 'Gaz 12,5 kg', repere_cage: r });
const repere = chargerRepere(SRC);

cas('repère valide : passé, daté, texte échappé', () => {
  const h = repere(gaz({ texte: 'on a commencé par la rangée du fond', date: '2026-10-30' }));
  assert.ok(h.includes('noté le 30/10/2026'));
  assert.ok(h.includes('on a commencé par la rangée du fond'));
  assert.ok(!repere(gaz({ texte: '<b>x</b>', date: '2026-10-30' })).includes('<b>'));
});
cas('aucun repère sans réglage, sans date valide, ou avec un chiffre', () => {
  assert.strictEqual(repere(gaz(null)), '');
  assert.strictEqual(repere({ id: 'x' }), '');
  assert.strictEqual(repere(gaz({ texte: 'fond', date: 'hier' })), '');
  assert.strictEqual(repere(gaz({ texte: 'fond', date: '' })), '');
  assert.strictEqual(repere(gaz({ texte: 'il restait 27 bouteilles', date: '2026-10-30' })), '');
  assert.strictEqual(repere(gaz({ texte: '  ', date: '2026-10-30' })), '');
});
cas('le repère n\'est branché qu\'à la clôture', () => {
  const appels = SRC.split('repereCageHtml(').length - 1;
  assert.strictEqual(appels, 2, 'définition + un seul appel');
  const ligne = extraire('renderLigneCloture', SRC);
  assert.ok(ligne.includes('repereCageHtml(p)'));
  for (const n of ['renderCarrousel', 'renderCarrouselProduction', 'renderLigneOuverture']) {
    if (SRC.includes(`function ${n}(`)) assert.ok(!extraire(n, SRC).includes('repereCageHtml'), n);
  }
});

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
mute('repère avec chiffres admis', '|| /\\d/.test(r.texte)', '', (s) => assert.strictEqual(chargerRepere(s)(gaz({ texte: 'il restait 27', date: '2026-10-30' })), ''));
mute('repère sans date exigée', "if (!m) return '';", '', (s) => assert.strictEqual(chargerRepere(s)(gaz({ texte: 'fond', date: 'hier' })), ''));
mute('repère non échappé', "${esc(r.texte.trim())}", '${r.texte.trim()}', (s) => assert.ok(!chargerRepere(s)(gaz({ texte: '<b>x</b>', date: '2026-10-30' })).includes('<b>')));
mute('repère branché au carrousel', "const transmis = dernierStock[p.id];\n    const masque", "const transmis = dernierStock[p.id]; repereCageHtml(p);\n    const masque", (s) => assert.strictEqual(s.split('repereCageHtml(').length - 1, 2));

console.log(`\n${ok} vérifications passées`);
