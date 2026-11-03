// Test — l'écart d'ouverture se calcule contre la vraie référence, même en comptage à l'aveugle (régression #168, 01/11).
// L'aveugle masque la référence à l'employé, pas au calcul. Absence de référence = aucun écart, jamais 0.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const SRC = fs.readFileSync(process.env.SRC_MUTE || path.join(__dirname, 'NEXUS-Inventaire-v1.html'), 'utf8');

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

// Copie le bloc de purge tel qu'il est écrit dans la page et l'exécute.
function purger(dernierStock, plan) {
  const debut = SRC.indexOf('referenceEcartAveugle = {};\n    Object.keys(dernierStock)');
  const fin = SRC.indexOf('modesAveugle = modesLus;');
  assert.ok(debut > 0 && fin > debut, 'bloc de purge introuvable');
  const ctx = { dernierStock, produitsPlanIds: new Set(plan), referenceEcartAveugle: {}, filCaisseEnCours: false };
  vm.createContext(ctx);
  vm.runInContext(SRC.slice(debut, fin), ctx);
  return ctx;
}

cas('la purge retire la valeur de dernierStock (non-régression #168) et en garde une copie hors DOM', () => {
  const c = purger({ gaz: { quantite: 81, comptage_id: 'c1' }, autre: { quantite: 5, comptage_id: 'c2' } }, ['gaz']);
  assert.strictEqual(c.dernierStock.gaz, undefined);
  assert.strictEqual(c.dernierStock.autre.quantite, 5);
  assert.strictEqual(c.referenceEcartAveugle.gaz.quantite, 81);
  assert.strictEqual(c.referenceEcartAveugle.autre, undefined);
});

function calcul(dernierStock, ref, plan, compte) {
  const ctx = { dernierStock, referenceEcartAveugle: ref, produitsPlanIds: new Set(plan) };
  vm.createContext(ctx);
  vm.runInContext(extraire('referenceEcartPourProduit', SRC), ctx);
  const transmis = ctx.referenceEcartPourProduit('gaz');
  const valeurTransmise = transmis ? transmis.quantite : 0;
  const planAveugle = ctx.produitsPlanIds.has('gaz');
  const nonNul = planAveugle ? (transmis ? Math.abs(compte - valeurTransmise) > 0.001 : false) : true;
  return { transmis, ecart: compte - valeurTransmise, nonNul };
}

cas('aveugle + référence 81, compte 48 : écart −33 contre 81', () => {
  const r = calcul({}, { gaz: { quantite: 81 } }, ['gaz'], 48);
  assert.strictEqual(r.ecart, -33);
  assert.strictEqual(r.nonNul, true);
});
cas('aveugle + référence 81, compte 81 : aucun écart', () => {
  assert.strictEqual(calcul({}, { gaz: { quantite: 81 } }, ['gaz'], 81).nonNul, false);
});
cas('aveugle + aucune référence : aucune alerte (jamais contre 0)', () => {
  assert.strictEqual(calcul({}, {}, ['gaz'], 48).nonNul, false);
});

// Câblage : la validation lit la référence réelle et ne s'appuie plus sur ecartNonNul calculé contre 0.
cas('validerOuverture : référence via referenceEcartPourProduit, écart réel pour les produits du plan', () => {
  assert.ok(/const transmis = referenceEcartPourProduit\(p\.id\);/.test(SRC));
  assert.ok(/const ecartNonNulReel = planAveugle/.test(SRC));
  assert.ok(/if \(ecartNonNulReel\) \{\s*nbEcarts\+\+;/.test(SRC));
});
cas('127 absent du DOM : la copie n\'est ni rendue ni écrite dans un gabarit', () => {
  const rendus = SRC.split('\n').filter((l) => l.includes('referenceEcartAveugle') && /\$\{|innerHTML|textContent|value\s*=/.test(l));
  assert.deepStrictEqual(rendus, []);
});
cas('la purge de dernierStock subsiste (non-régression de #168)', () => {
  assert.ok(/delete dernierStock\[produitId\]/.test(SRC));
});

console.log(`\n${ok} contrôles OK`);
