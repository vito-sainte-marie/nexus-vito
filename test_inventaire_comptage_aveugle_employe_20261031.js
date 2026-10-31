// Test — Comptage aveugle imposé à l'employé (lot INVENTAIRE-GAZ-CAGE-20261031, consigne de Frédéric du 31/10).
// Le pompiste ne voit jamais le stock transmis par le quart précédent : pas de valeur transmise dans le DOM, pas de
// bouton « Identique », champ vide, pas de « Réassort potentiel », pas de motif obligatoire. Le manager et le gérant
// gardent le comportement actuel. Assertions sur le texte réel de la page, fonctions extraites et exécutées (vm).
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

function charger(source, role, extra) {
  const ctx = {
    roleDuJour: role, produitsPlanIds: new Set(), modesAveugle: [], employeeCourant: { id: 'e1' },
    dateISO: () => '2026-10-31', livraisonRapideDeclaree: () => false,
    texteEcartOuverture: (e) => `Réassort potentiel +${e}`, ...extra,
  };
  vm.createContext(ctx);
  const code = ['comptageAveugleImpose', 'estMasquePourProduit', 'rendreContenuEcart', 'classeEcartOuverture']
    .map((n) => extraire(n, source)).join('\n');
  vm.runInContext(code, ctx);
  return ctx;
}

let ok = 0;
function cas(nom, f) { f(); ok++; console.log('  ✓ ' + nom); }

for (const role of ['pompiste', 'caissier', 'caissiere', 'renfort', 'vacataire', undefined]) {
  const c = charger(SRC, role);
  cas(`${role} : plan absent, le produit est masqué`, () => assert.strictEqual(c.estMasquePourProduit({ id: 'gaz', categorie_id: 'x' }), true));
  cas(`${role} : aucun texte d'écart (ni Réassort potentiel, ni Déclarer cette livraison)`, () => {
    [8, -8, 0].forEach((e) => assert.strictEqual(c.rendreContenuEcart('gaz', e), ''));
  });
}
for (const role of ['manager', 'gerant']) {
  const c = charger(SRC, role);
  cas(`${role} : écart positif inchangé (Réassort potentiel et bouton de livraison)`, () => {
    const h = c.rendreContenuEcart('gaz', 8);
    assert.ok(h.includes('Réassort potentiel +8') && h.includes('btn-declarer-livraison'));
  });
  cas(`${role} : écart nul « Conforme » inchangé`, () => assert.strictEqual(c.rendreContenuEcart('gaz', 0), 'Conforme'));
  cas(`${role} : produit hors plan non masqué`, () => assert.strictEqual(c.estMasquePourProduit({ id: 'gaz', categorie_id: 'x' }), false));
}

// Câblage : les gabarits d'employé ne montrent plus la valeur transmise ni « Identique » quand le produit est masqué.
cas('carrousel : valeur de départ vide dès que masqué', () => {
  assert.ok(/valeurDepart = \(dejaSaisi[^\n]*\(masque \|\| pasDHistorique \? '' : valeurTransmise\)/.test(SRC));
});
cas('carrousel : « Identique » et « Revenir à Identique » exigent !masque', () => {
  assert.ok(/afficherChoixRapide = !masque &&/.test(SRC));
  assert.ok(/\$\{!masque && !pasDHistorique \? `<button class="btn-text" id="btnAnnulerCorrection"/.test(SRC));
});
cas('carrousel : la valeur transmise n\'est rendue que hors masque', () => {
  const bloc = SRC.slice(SRC.indexOf('const afficherChoixRapide'), SRC.indexOf('const btnConforme'));
  const i = bloc.indexOf('carrousel-valeur'), m = bloc.indexOf('${masque');
  assert.ok(m >= 0 && i > m, 'la valeur est dans la branche non masquée');
});
cas('liste : pas de bouton Identique ni de motif pour un produit masqué', () => {
  assert.ok(/\(estComptageDeuxLieuxEmploye\(p\) \|\| masque\) \? ''/.test(SRC));
});
cas('catégorie : « Valider cette catégorie conforme » n\'écrit rien en mode aveugle', () => {
  const h = SRC.indexOf("getElementById('btnCategorieConforme').addEventListener");
  const bloc = SRC.slice(h, h + 600);
  assert.ok(bloc.includes('comptageAveugleImpose()'));
  const aveugle = bloc.slice(bloc.indexOf('comptageAveugleImpose()'), bloc.indexOf('return;', bloc.indexOf('ouvrirProchaineCategorie')));
  assert.ok(!/comptagesSaisie\[|dernierStock|ecrireOuvertureImmediat/.test(aveugle), 'la branche aveugle n\'écrit ni ne lit le transmis');
});
cas('motif et justification : pilotés par !comptageAveugleImpose()', () => {
  assert.ok((SRC.match(/ecartNonNul && !comptageAveugleImpose\(\)/g) || []).length >= 2);
});


// Aucun geste de l'employé n'écrit le stock transmis comme ouverture (condition de la décision de Frédéric, 31/10 18 h 42).
function ecritures(source) {
  const motif = /compte: (valeurTransmise|transmis \? transmis\.quantite : 0)|input\.value = transmis \? transmis\.quantite : 0/g;
  const res = []; let m;
  while ((m = motif.exec(source))) res.push(m.index);
  return res;
}
function gardees(source) {
  // la garde doit se trouver dans le même gestionnaire, c'est-à-dire après le dernier addEventListener('click' qui précède l'écriture
  return ecritures(source).every((i) => {
    const debut = source.lastIndexOf("addEventListener('click'", i);
    return debut >= 0 && /comptageAveugleImpose\(\)/.test(source.slice(debut, i));
  });
}
cas('chaque écriture du transmis est précédée de la garde employé (Identique liste, btnConforme, Revenir à Identique, catégorie)', () => {
  assert.ok(ecritures(SRC).length >= 4, 'les 4 chemins sont repérés');
  assert.ok(gardees(SRC));
});

// Mutations : retirer chaque levier doit faire échouer les assertions correspondantes.
function mute(nom, de, vers, verif) {
  assert.ok(SRC.includes(de), `ancre de mutation « ${nom} » introuvable`);
  const echoue = (() => { try { verif(SRC.replace(de, vers)); return false; } catch (e) { return true; } })();
  assert.ok(echoue, `la mutation « ${nom} » n'est pas détectée`);
  ok++; console.log('  ✓ mutation détectée : ' + nom);
}
mute('rendreContenuEcart sans garde', "function rendreContenuEcart(produitId, ecart) {\n    if (comptageAveugleImpose()) return '';", 'function rendreContenuEcart(produitId, ecart) {',
  (s) => assert.strictEqual(charger(s, 'pompiste').rendreContenuEcart('gaz', 8), ''));
mute('masque sans levier', 'if (comptageAveugleImpose()) return true;', '', 
  (s) => assert.strictEqual(charger(s, 'pompiste').estMasquePourProduit({ id: 'gaz', categorie_id: 'x' }), true));
mute('levier réduit au pompiste', "return roleDuJour !== 'manager' && roleDuJour !== 'gerant';", "return roleDuJour === 'pompiste';",
  (s) => assert.strictEqual(charger(s, 'caissiere').rendreContenuEcart('gaz', 8), ''));
mute('levier aveugle aussi pour le manager', "return roleDuJour !== 'manager' && roleDuJour !== 'gerant';", 'return true;',
  (s) => assert.ok(charger(s, 'manager').rendreContenuEcart('gaz', 8).includes('Réassort potentiel')));

mute('garde retirée du bouton Identique de la liste', "el.addEventListener('click', () => {\n        if (comptageAveugleImpose()) return; // l'employé n'écrit jamais le stock transmis\n", "el.addEventListener('click', () => {\n", (x) => assert.ok(gardees(x)));
mute('garde retirée de btnConforme', "if (btnConforme) btnConforme.addEventListener('click', () => {\n      if (comptageAveugleImpose()) return; // l'employé n'écrit jamais le stock transmis\n", "if (btnConforme) btnConforme.addEventListener('click', () => {\n", (x) => assert.ok(gardees(x)));
mute('garde retirée de Revenir à Identique', "if (btnAnnulerCorrection) btnAnnulerCorrection.addEventListener('click', () => {\n      if (comptageAveugleImpose()) return; // l'employé n'écrit jamais le stock transmis\n", "if (btnAnnulerCorrection) btnAnnulerCorrection.addEventListener('click', () => {\n", (x) => assert.ok(gardees(x)));

console.log(`\n${ok} vérifications passées`);
