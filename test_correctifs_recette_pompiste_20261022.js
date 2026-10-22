// Épreuve — 22/10/2026, lot PARCOURS-POMPISTE-CORRECTIFS-RECETTE-20261022 (decision-1).
// C1 : le filtre des catégories du fil ne retient que Gaz, Glaçons, Écailles, sur le mot entier.
// Le module est exécuté tel quel ; chaque épreuve est contrôlée par une mutation.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const lire = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const SRC = {
  module: lire('nexus-fil-debut-quart.js'),
  inv: lire('NEXUS-Inventaire-v1.html'),
  rel: lire('NEXUS-Releves-Piste-v1.html'),
  donnees: lire('nexus-carburant-donnees.js'),
  app: lire('NEXUS-App-v1.html'),
};

function charger(src) {
  const m = { exports: {} };
  new Function('module', 'self', src)(m, undefined);
  return m.exports;
}

function epreuves(S) {
  const echecs = [];
  const eprouve = (nom, f) => { try { f(); } catch (e) { echecs.push(`${nom} — ${e.message}`); } };
  const F = charger(S.module);

  eprouve('C1 retenues', () => {
    ['Gaz', 'Gaz butane 13 kg', 'Bouteille de gaz', 'Glaçons', 'Glaçons 5 kg', 'Glacons', 'Écailles', 'Ecailles', 'Écailles de glace']
      .forEach(n => assert.strictEqual(F.categorieDuFil(n), true, `« ${n} » doit être retenu`));
  });
  eprouve('C1 exclues', () => {
    ['Lave-glace & Liquide de refroidissement', 'Lave-glace', 'Huiles', 'Huile moteur', 'Liquide de refroidissement', '', null, undefined, 'Gazole', 'Glacée', 'Pagaz']
      .forEach(n => assert.strictEqual(F.categorieDuFil(n), false, `« ${n} » doit être exclu`));
  });

  eprouve('C4 un seul compteur', () => {
    assert.ok(/const prefixeEtape = \(idx === -1 \|\| enFil\(\)\) \? '' :/.test(S.inv), "le préfixe « Étape n/N » doit être vide dans le fil");
  });
  eprouve('C2 plus de confirm natif dans l\'ouverture', () => {
    const debut = S.inv.indexOf("getElementById('btnCategorieConforme')");
    const fin = S.inv.indexOf('async function validerOuverture');
    const zone = S.inv.slice(debut, fin + 4000);
    assert.ok(!/[^.\w]confirm\(/.test(zone.replace(/confirmerEnPage/g, '')), 'confirm() natif restant dans le parcours d\'ouverture');
    assert.ok(!/Aucun chiffre saisi pour \$\{p\.designation\} — on enregistre 0\. Confirmer/.test(S.inv) , 'ancien texte natif');
    assert.ok(/if \(!enFil\(\)\) \{[\s\S]{0,600}confirmerEnPage\(message/.test(S.inv), 'la question « conforme » doit être supprimée dans le fil');
  });
  eprouve('C2 accord du pluriel', () => {
    assert.ok(!/les \$\{simples\.length\} produit\$\{/.test(S.inv), 'ancien accord « les 1 produit »');
    assert.ok(/nb > 1 \? `les \$\{nb\} produits restants` : 'le produit restant'/.test(S.inv), 'accord singulier/pluriel absent');
  });
  eprouve('C6 jaugeage existant annoncé dès l\'ouverture', () => {
    const i = S.rel.indexOf('function vueJauge');
    const v = S.rel.slice(i, i + 6000);
    const c = v.indexOf('const conf = pret ?');
    const r = v.indexOf('${photo}${lignes}');
    assert.ok(c > 0 && r > c, 'repères de vueJauge introuvables');
    const conf = v.slice(c, r);
    assert.ok(!conf.includes('${avert}'), 'l\'avertissement est encore enfermé dans le bloc réservé aux quatre champs remplis');
    assert.ok(/\$\{photo\}\$\{lignes\}\$\{avert\}\$\{conf\}/.test(v), 'l\'avertissement doit être rendu hors du bloc de confirmation');
  });
  eprouve('C5 jaugeage du jour fait', () => {
    const g = {};
    new Function('globalThis', 'window', S.donnees.replace(/\(typeof window !== 'undefined' \? window : globalThis\);\s*$/, '(globalThis);'))(g, undefined);
    const f = g.NexusCarburantDonnees.jaugeageDuJourFait;
    assert.strictEqual(f(null, { id: 'r1', origine: 'manager' }), true, 'relevé du manager sans statut : fait');
    assert.strictEqual(f({ statut: 'impossible' }, null), true, 'impossible sans relevé : fait');
    assert.strictEqual(f({ statut: 'fait' }, null), true, 'fait sans relevé : fait');
    assert.strictEqual(f(null, null), false, 'ni statut ni relevé : à faire');
    assert.strictEqual(f({ statut: 'autre' }, null), false, 'statut inconnu sans relevé : à faire');
    assert.ok(/const jaugeageFait = NexusCarburantDonnees\.jaugeageDuJourFait\(statutJaugeageJour, releveJaugeageJour\)/.test(S.app), 'l\'Accueil doit appliquer la règle commune');
    assert.ok(/chargerReleveDuJour\(nexusClient, employee\.site_id, todayISO\)/.test(S.app), 'l\'Accueil doit lire le relevé du jour');
  });
  eprouve('C3 ouverture faite, clôture à faire', () => {
    assert.ok(/inventaire_quarts\(date, cloture_le, is_simulation, statut\)/.test(S.app), 'la requête doit lire le statut du quart');
    assert.ok(/const inventaireOuvertureFaite = inventaireApplicable && !inventaireFait &&/.test(S.app), 'inventaireOuvertureFaite absent');
    assert.ok(/r\.inventaire_quarts\.statut === 'ouvert'/.test(S.app), 'l\'ouverture faite doit se déduire du statut « ouvert »');
    assert.ok(/!ctx\.inventaireOuvertureFaite/.test(S.app), 'la relance d\'inventaire doit s\'arrêter une fois l\'ouverture faite');
    assert.ok(/if \(ctx\.inventaireOuvertureFaite\) \{\s*return \{[^}]*Il restera la clôture, en fin de quart/.test(S.app), 'message « ouverture faite, clôture en fin de quart » absent');
    assert.ok(/inventaireApplicable && !inventaireFait && !inventaireOuvertureFaite/.test(S.app), 'le fil ne doit plus renvoyer vers l\'inventaire');
  });
  return echecs;
}

const ok = (m) => console.log('OK  ', m);
const echecs = epreuves(SRC);
if (echecs.length) { echecs.forEach(e => console.error('ROUGE —', e)); console.error(`${echecs.length} épreuve(s) rouge(s) sur la source réelle.`); process.exit(1); }
ok('la source réelle passe toutes les épreuves (C1, C2, C4)');

function muter(nom, cle, de, vers, attendu) {
  assert.ok(SRC[cle].includes(de), `mutation « ${nom} » : ancre introuvable`);
  const mutant = Object.assign({}, SRC, { [cle]: SRC[cle].replace(de, vers) });
  const e = epreuves(mutant);
  assert.ok(e.some(x => x.startsWith(attendu)), `mutation « ${nom} » : ${attendu} est restée verte (rouges : ${e.join(' | ') || 'aucun'})`);
  ok(`mutation « ${nom} » → ${attendu} rougit`);
}
muter('glace en sous-chaîne', 'module', "(?<![\\p{L}\\p{N}])(?:gaz|gla[cç]ons?|[ée]cailles?)(?![\\p{L}\\p{N}])/iu", "gaz|gla[cç]on|glace|[ée]caille/i", 'C1 exclues');
muter('mot entier perdu', 'module', "(?<![\\p{L}\\p{N}])(?:gaz|gla[cç]ons?|[ée]cailles?)(?![\\p{L}\\p{N}])/iu", "gaz|gla[cç]ons?|[ée]cailles?/i", 'C1 exclues');
muter('glaçons oubliés', 'module', "gla[cç]ons?|", "", 'C1 retenues');
muter('compteur doublé', 'inv', "(idx === -1 || enFil()) ? ''", "(idx === -1) ? ''", 'C4');
muter('confirm natif rétabli', 'inv', "if (!(await confirmerEnPage(`Aucun chiffre saisi pour ${p.designation} — on enregistre 0.`, 'Enregistrer 0'))) return;", "if (!confirm(`Aucun chiffre saisi pour ${p.designation} — on enregistre 0. Confirmer ?`)) return;", 'C2 plus de confirm');
muter('question conforme dans le fil', 'inv', "if (!enFil()) {\n        const nb", "if (true) {\n        const nb", 'C2 plus de confirm');
muter('accord « les 1 produit »', 'inv', "nb > 1 ? `les ${nb} produits restants` : 'le produit restant'", "`les ${nb} produits restants`", 'C2 accord');
muter('avertissement de nouveau dans conf', 'rel', "const conf = pret ? `${total}<div", "const conf = pret ? `${total}${avert}<div", 'C6');
muter('avertissement retiré du rendu', 'rel', "${photo}${lignes}${avert}${conf}", "${photo}${lignes}${conf}", 'C6');
muter('relevé ignoré', 'donnees', "return statutClos || !!releveJour;", "return statutClos;", 'C5');
muter('impossible ignoré', 'donnees', "statutJour.statut === 'fait' || statutJour.statut === 'impossible'", "statutJour.statut === 'fait'", 'C5');
muter('Accueil sans règle commune', 'app', "const jaugeageFait = NexusCarburantDonnees.jaugeageDuJourFait(statutJaugeageJour, releveJaugeageJour);", "const jaugeageFait = !!(statutJaugeageJour && statutJaugeageJour.statut === 'fait');", 'C5');
muter('statut du quart non lu', 'app', "inventaire_quarts(date, cloture_le, is_simulation, statut)", "inventaire_quarts(date, cloture_le, is_simulation)", 'C3');
muter('ouverture non reconnue', 'app', "r.inventaire_quarts.statut === 'ouvert'", "r.inventaire_quarts.statut === 'jamais'", 'C3');
console.log('Toutes les épreuves du lot sont vertes.');
