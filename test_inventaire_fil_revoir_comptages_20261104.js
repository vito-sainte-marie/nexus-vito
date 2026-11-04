// Test — Fil « Mon début de quart » : revue des comptages et retour d'en-tête
// (retour terrain du 04/11/2026). Navigation seule : aucune écriture ajoutée.
const fs = require('fs');
const assert = require('assert');
const vm = require('vm');

const html = fs.readFileSync(__dirname + '/NEXUS-Inventaire-v1.html', 'utf8');
const nav = fs.readFileSync(__dirname + '/nexus-header-nav.js', 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

function extraire(src, nom) {
  const d = src.indexOf(`function ${nom}(`);
  assert.ok(d !== -1, `Fonction ${nom} introuvable`);
  let j = src.indexOf('{', d) + 1, n = 1;
  while (n > 0) { if (src[j] === '{') n++; else if (src[j] === '}') n--; j++; }
  return src.slice(d, j);
}

// --- 1. Écran de validation : bouton de revue, sans toucher à la validation
const valid = extraire(script, 'renderFilValidation');
assert.ok(valid.includes('id="btnRevoirComptages"') && valid.includes('← Revoir mes comptages'), 'bouton « Revoir mes comptages » absent');
assert.ok(valid.includes("addEventListener('click', renderFilRevue)"), 'le bouton ne ouvre pas la revue');
assert.ok(valid.includes('validerOuverture()'), 'la validation existante doit rester');
assert.ok(!/history\.back/.test(valid));

// --- 2. La revue donne accès à TOUS les produits du fil, valeurs affichées, même saisie
const revue = extraire(script, 'renderFilRevue');
assert.ok(revue.includes('groupesRequis.map') && revue.includes('g.items.map'), 'la revue doit lister tous les produits de tous les groupes');
assert.ok(revue.includes('comptagesSaisie[p.id]'), 'la revue doit montrer la valeur saisie');
assert.ok(revue.includes('ouvrirProduitDuFil('), 'chaque ligne doit ouvrir le produit');
assert.ok(!/ecrire|upsert|insert|fetch\(/.test(revue), 'la revue ne doit rien écrire');
const ouvrir = extraire(script, 'ouvrirProduitDuFil');
assert.ok(ouvrir.includes('renderCarrousel(groupe)') && ouvrir.includes('renderCategorieListe(groupe)'), 'carrousel ET liste doivent s\'ouvrir sur le produit');
assert.ok(ouvrir.includes('carrouselIndex = index'));

// --- 3. Retour d'en-tête : comportement exécuté
const src = [extraire(script, 'filRetourEntete')].join('\n');
function jouer(etat) {
  const log = [];
  const ctx = {
    enFil: () => etat.enFil !== false, filFermeture: !!etat.fermeture,
    ecranFil: etat.ecran, categorieActive: etat.cat, carrouselIndex: etat.idx,
    groupesParcoursOuverture: () => ({ groupesRequis: [
      { nom: 'A', items: [1, 2, 3] }, { nom: 'B', items: [1, 2] } ] }),
    reculerCarrousel: (g) => log.push('recule:' + g.nom),
    ouvrirProduitDuFil: (g, i) => log.push('ouvre:' + g.nom + ':' + i),
    renderFilValidation: () => log.push('validation'),
  };
  vm.createContext(ctx);
  vm.runInContext(src + ';globalThis.r = filRetourEntete();', ctx);
  return { r: ctx.r, log };
}
let o;
o = jouer({ ecran: 'carrousel', cat: 'A', idx: 1 });
assert.deepStrictEqual([o.r, o.log], [true, ['recule:A']], 'produit 2 → produit 1');
o = jouer({ ecran: 'carrousel', cat: 'A', idx: 0 });
assert.strictEqual(o.r, false, 'premier produit du fil → navigation normale');
o = jouer({ ecran: 'carrousel', cat: 'B', idx: 0 });
assert.deepStrictEqual([o.r, o.log], [true, ['ouvre:A:2']], 'début de catégorie → dernier produit précédent');
o = jouer({ ecran: 'validation' });
assert.deepStrictEqual([o.r, o.log], [true, ['ouvre:B:1']], 'validation → dernier produit');
o = jouer({ ecran: 'revue' });
assert.deepStrictEqual([o.r, o.log], [true, ['validation']]);
o = jouer({ ecran: 'carrousel', cat: 'A', idx: 2, enFil: false });
assert.strictEqual(o.r, false, 'caisse : inchangé');
o = jouer({ ecran: 'carrousel', cat: 'A', idx: 2, fermeture: true });
assert.strictEqual(o.r, false, 'fin de quart : inchangé');

// --- 4. En-tête : crochet pris en compte avant history.back
const ret = extraire(nav, 'retourner');
assert.ok(ret.indexOf('surRetour') !== -1 && ret.indexOf('surRetour') < ret.indexOf('history.back'), 'le crochet doit passer avant history.back');
let dos = 0;
const w = { history: { length: 5, back: () => dos++ }, location: {}, NexusHeaderNav: { surRetour: () => true } };
vm.runInNewContext(ret + ';retourner();', { window: w });
assert.strictEqual(dos, 0, 'crochet true : pas de history.back');
w.NexusHeaderNav.surRetour = () => false;
vm.runInNewContext(ret + ';retourner();', { window: w });
assert.strictEqual(dos, 1, 'crochet false : history.back');

// --- 5. Bouton produit précédent : vrai bouton secondaire
assert.ok(!html.includes('<button class="btn-text" id="btnProduitPrecedent"'), 'btnProduitPrecedent doit être un vrai bouton');
assert.strictEqual((html.match(/class="btn-ghost" id="btnProduitPrecedent"/g) || []).length, 2);

// --- 6. Revalidation : le produit corrigé repasse par la saisie existante
assert.ok(extraire(script, 'reculerCarrousel').includes('renderCarrousel(groupe)'));
// --- 7. Pluriel : « 3 unités », « 1 unité » (retour Guardian, recette 6634872830)
const corpsRevue = extraire(script, 'renderFilRevue');
assert.ok(/p\.unite === 'unité' && Number\(s\.compte\) > 1 \? 'unités'/.test(corpsRevue), 'la revue doit accorder « unités » au-delà de 1');

console.log('OK test_inventaire_fil_revoir_comptages_20261104');
