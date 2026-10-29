// Épreuve — lot JAUGEAGE-CARBURANT-FIL-UNIQUE-20261029 (choix A de Frédéric, 27/10/2026 ; décision d9c8f065).
// Le jaugeage d'ouverture ne se fait qu'à l'étape 1 du parcours pompiste (Relevés piste) : la carte de l'Inventaire disparaît,
// la porte « impossible » passe à l'étape 1, l'étape 1 se saute quand un relevé du jour existe, et le gérant qui saisit
// le jaugeage depuis la photo (POSTE-006) écrit toujours avec l'origine « manager ». Aucune donnée n'est supprimée.
// Chaque épreuve est contrôlée par une mutation des sources.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const lire = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const SRC = {
  inv: lire('NEXUS-Inventaire-v1.html'),
  rel: lire('NEXUS-Releves-Piste-v1.html'),
  carb: lire('NEXUS-Carburants-v1.html'),
  mod: lire('nexus-fil-debut-quart.js'),
  app: lire('NEXUS-App-v1.html'),
};
const EPREUVES = {
  J1: (s) => { assert.ok(!s.inv.includes('carteJaugeageCarburant'), 'la carte est revenue dans l\'Inventaire'); },
  J2: (s) => { assert.ok(!s.inv.includes('lienJaugeageImpossible') && !/renderJaugeageImpossible|demarrerJaugeageOuverture/.test(s.inv), 'porte « impossible » ou saisie d\'ouverture restée dans l\'Inventaire'); },
  J3: (s) => { assert.ok(s.rel.includes('data-act="jimpossible"') && /declarerJaugeageImpossible[\s\S]{0,500}enregistrerJaugeageImpossible/.test(s.rel), 'porte « impossible » absente de l\'étape 1'); },
  J4: (s) => { assert.ok(/\(ex \|\| jauge\.enregistre \|\| jauge\.impossible\) \? '' : '<div class="sub"><button class="lien-discret" data-act="jimpossible"/.test(s.rel), 'le lien « impossible » reste offert après un relevé ou un signalement'); },
  J5: (s) => { assert.ok(/resteJaugeage && 1/.test(s.mod), 'l\'étape 1 n\'est plus sautée quand le jaugeage du jour existe'); },
  J6: (s) => { const o = s.carb.match(/origine: '(\w+)'/g) || []; assert.ok(o.length >= 3 && o.every(x => x === "origine: 'manager'"), 'écriture du gérant sans origine « manager » : ' + o.join(',')); },
  J7: (s) => { assert.ok(!/\.delete\(|\.from\('carburant_releve(s|_versions)'\)[^;]{0,80}delete/.test(s.rel + s.inv), 'suppression de données de jaugeage'); },
};
function rouges(src) {
  const r = [];
  for (const [k, f] of Object.entries(EPREUVES)) { try { f(src); } catch (e) { r.push(k); } }
  return r;
}
assert.deepStrictEqual(rouges(SRC), [], 'état réel : épreuves rouges ' + rouges(SRC).join(','));
console.log('OK état réel : J1..J7 vertes');
function muter(nom, cle, avant, apres, attendu) {
  assert.ok(SRC[cle].includes(avant), `mutation « ${nom} » : ancre introuvable`);
  const m = { ...SRC, [cle]: SRC[cle].replace(avant, apres) };
  assert.ok(rouges(m).includes(attendu), `mutation « ${nom} » : ${attendu} est restée verte`);
  console.log(`OK mutation « ${nom} » → ${attendu} rougit`);
}
muter('carte revenue', 'inv', 'return \'\';\n  }\n\n  async function toggleDetailReleveJaugeage', 'return `<div id="carteJaugeageCarburant"></div>`;\n  }\n\n  async function toggleDetailReleveJaugeage', 'J1');
muter('porte impossible gardée dans l\'Inventaire', 'inv', 'function libelleMotifImpossible', 'function renderJaugeageImpossible(){}\n  function libelleMotifImpossible', 'J2');
muter('lien impossible retiré de l\'étape 1', 'rel', 'data-act="jimpossible"', 'data-act="x"', 'J3');
muter('lien impossible offert après relevé', 'rel', '(ex || jauge.enregistre || jauge.impossible) ?', 'false ?', 'J4');
muter('jaugeage fait resté dans le plan', 'mod', 'resteJaugeage && 1', '1', 'J5');
muter('gérant sans origine manager', 'carb', "origine: 'manager',", "origine: 'terrain_pompiste',", 'J6');
muter('suppression de données', 'rel', 'function vueJaugeImpossible', 'function z(c){c.from(\'carburant_releves\').delete()}\n  function vueJaugeImpossible', 'J7');
console.log('OK 7 épreuves, 7 mutations');
