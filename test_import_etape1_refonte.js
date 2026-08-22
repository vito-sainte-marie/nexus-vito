// Test — Refonte étape 1 de l'assistant d'import (21/08/2026, demande de
// Frédéric : "la première étape passe d'un sélecteur de fichiers amélioré
// à un véritable assistant d'alimentation de NEXUS").
//
// Deux fonctions pures extraites du script inline de NEXUS-Import-v1.html
// (jamais réécrites à la main — même discipline que les tests FDJ) :
//  - lendemainFr(dateIso) : calcule la date du lendemain, utilisée par le
//    Conseiller compacté ("le prochain fichier devrait commencer le X")
//    pour ne plus jamais répéter deux fois la même date (bug signalé par
//    Frédéric, capture à l'appui : "06/08/2026 ... jusqu'au 06/08/2026").
//  - construireContenuCarteType(type, ctx) : contenu de la carte
//    contextuelle "Vous allez importer : X" apparaissant sous les 4 choix
//    une fois un type sélectionné — "l'amélioration la plus importante"
//    selon Frédéric.

const fs = require('fs');
const assert = require('assert');

const CHEMIN_BASE = __dirname;
const html = fs.readFileSync(`${CHEMIN_BASE}/NEXUS-Import-v1.html`, 'utf8');
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

const src = [
  extraireConst('LIBELLES_TYPE_IMPORT'),
  extraire('construireContenuCarteType'),
  extraire('lendemainFr'),
].join('\n');
const ctx = {};
ctx.globalThis = ctx;
const fn = new (require('vm').Script)(`${src}\nglobalThis.__construireContenuCarteType = construireContenuCarteType; globalThis.__lendemainFr = lendemainFr;`);
require('vm').createContext(ctx);
fn.runInContext(ctx);

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

// ------------------------------------------------------------
// 1) lendemainFr — jamais la même date que la période connue (le bug
//    signalé par Frédéric : le conseiller répétait "06/08/2026" deux fois
//    au lieu de calculer le jour suivant).
// ------------------------------------------------------------
assert.strictEqual(ctx.__lendemainFr('2026-08-06'), '07/08/2026');
ok('lendemainFr("2026-08-06") -> "07/08/2026" (jamais la même date répétée)');

assert.strictEqual(ctx.__lendemainFr('2026-08-31'), '01/09/2026', 'Franchissement de mois correct');
ok('lendemainFr : franchit correctement un changement de mois (31/08 -> 01/09)');

assert.strictEqual(ctx.__lendemainFr('2026-12-31'), '01/01/2027', 'Franchissement d\'année correct');
ok('lendemainFr : franchit correctement un changement d\'année (31/12 -> 01/01)');

assert.strictEqual(ctx.__lendemainFr(null), null, 'Pas de date connue -> null, jamais une fausse date (Article 5)');
assert.strictEqual(ctx.__lendemainFr(undefined), null);
ok('lendemainFr(null/undefined) -> null, jamais une date inventée');

// ------------------------------------------------------------
// 2) construireContenuCarteType — la carte "Vous allez importer : X"
// ------------------------------------------------------------

// Ventes / catalogue — avec historique connu (cas réel de la capture de
// Frédéric : dernière période jusqu'au 06/08/2026).
let carteVentes = ctx.__construireContenuCarteType('ventes_catalogue', { dernierePeriodeFinVentesDate: '06/08/2026' });
assert.strictEqual(carteVentes.titre, 'Vous allez importer : Ventes / catalogue');
assert.ok(carteVentes.corps.includes('références produits') && carteVentes.corps.includes('marge'), 'Corps explicite ce que NEXUS va chercher dans le fichier');
assert.strictEqual(carteVentes.contexte, 'Dernière période connue : 06/08/2026');
ok('Ventes/catalogue avec historique : titre + corps explicatif + dernière période connue');

// Ventes / catalogue — premier import (aucune période connue).
let carteVentesVide = ctx.__construireContenuCarteType('ventes_catalogue', {});
assert.ok(carteVentesVide.contexte.toLowerCase().includes('première période'), 'Sans historique, message honnête plutôt qu\'une date inventée');
ok('Ventes/catalogue sans historique : "première période" annoncée, jamais une fausse date');

// Stock théorique — reprend l'exemple exact de Frédéric ("ne sera jamais
// confondu avec un comptage physique terrain").
let carteStock = ctx.__construireContenuCarteType('stock_theorique', { dernierReleveDate: '15/08/2026' });
assert.strictEqual(carteStock.titre, 'Vous allez importer : Stock théorique');
assert.ok(carteStock.corps.includes('jamais confondu avec un comptage physique terrain'), 'Reprend l\'avertissement explicite demandé par Frédéric (important pour l\'architecture Inventaire)');
assert.strictEqual(carteStock.contexte, 'Dernier relevé connu : 15/08/2026');
ok('Stock théorique : avertissement "jamais confondu avec un comptage physique terrain" présent');

// Panier moyen.
let cartePanier = ctx.__construireContenuCarteType('panier_moyen', { dernierJourPanierDate: '20/08/2026' });
assert.strictEqual(cartePanier.titre, 'Vous allez importer : Panier moyen');
assert.strictEqual(cartePanier.contexte, 'Dernier jour connu : 20/08/2026');
ok('Panier moyen : titre + dernier jour connu');

// Campagne NEXUS — avec et sans promotions disponibles.
let carteCampagneAvec = ctx.__construireContenuCarteType('campagne', { nbCampagnesDisponibles: 3 });
assert.strictEqual(carteCampagneAvec.contexte, '3 campagne(s) disponible(s).');
let carteCampagneSans = ctx.__construireContenuCarteType('campagne', { nbCampagnesDisponibles: 0 });
assert.strictEqual(carteCampagneSans.contexte, 'Aucune promotion déclarée pour l\'instant.');
ok('Campagne NEXUS : contexte reflète le nombre réel de promotions disponibles (0 -> message honnête, pas un silence)');

// Type inconnu — ne doit jamais planter (défensif, comme le reste du
// moteur Import).
let carteInconnue = ctx.__construireContenuCarteType('type_qui_n_existe_pas', {});
assert.strictEqual(carteInconnue.titre, 'Vous allez importer : type_qui_n_existe_pas');
assert.strictEqual(carteInconnue.corps, '');
ok('Type inconnu : ne plante jamais, corps vide plutôt qu\'une erreur');

console.log(`\n${n}/${n} tests passés — refonte étape 1 Import (carte contextuelle + Conseiller sans date dupliquée).`);
