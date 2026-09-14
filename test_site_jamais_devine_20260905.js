// A3-1 (C4) — le site n'est jamais deviné.
//
// Ce test ne compte pas les occurrences du mot « vito » : il vérifie un
// MOTIF. Le défaut A3 n'était pas la présence d'un nom, c'était la
// substitution silencieuse d'un site à un autre. Un test qui compterait les
// noms serait rassuré par un renommage.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const RACINE = __dirname;
const ECRANS = fs.readdirSync(RACINE).filter(f => /^NEXUS-.*\.html$/.test(f));
const MODULES = fs.readdirSync(RACINE).filter(f => /^nexus-.*\.js$/.test(f));
const APPLICATIF = [...ECRANS, ...MODULES];

let passes = 0;
function verifier(nom, fn) {
  fn(); passes++; console.log('OK — ' + nom);
}

// Un identifiant de site en position de repli : `… || 'un-site'`.
// On cible la SUBSTITUTION, pas le nom substitué.
const REPLI_SITE = /\|\|\s*['"](vito-sainte-marie|nexus-station-test|site-fantome-test)['"]/g;
// Une affectation directe d'un identifiant de site à une variable de site.
const AFFECTATION_SITE = /\b(SITE_ACTUEL|SITE_ID|SITE_HOME|siteId)\s*=\s*['"](vito-sainte-marie|nexus-station-test|site-fantome-test)['"]/g;

function occurrences(regex) {
  const trouvees = [];
  for (const f of APPLICATIF) {
    const src = fs.readFileSync(path.join(RACINE, f), 'utf8');
    for (const ligne of src.split('\n').map((t, i) => ({ t, n: i + 1 }))) {
      // Les commentaires documentent la correction — ils ne l'annulent pas.
      const nu = ligne.t.replace(/^\s*(\/\/|\*|--).*$/, '');
      regex.lastIndex = 0;
      if (regex.test(nu)) trouvees.push(`${f}:${ligne.n}  ${ligne.t.trim().slice(0, 110)}`);
    }
  }
  return trouvees;
}

verifier('aucun repli « || \'site\' » dans le code applicatif', () => {
  const t = occurrences(REPLI_SITE);
  assert.strictEqual(t.length, 0,
    'Un site ne doit jamais servir de repli à un autre :\n  ' + t.join('\n  '));
});

verifier('aucune variable de site initialisée à un identifiant en dur', () => {
  const t = occurrences(AFFECTATION_SITE);
  assert.strictEqual(t.length, 0,
    'Une variable de site ne doit pas naître avec la valeur d\'un commerce :\n  ' + t.join('\n  '));
});

verifier('la primitive de site existe et ne contient aucune valeur de repli', () => {
  const src = fs.readFileSync(path.join(RACINE, 'nexus-station.js'), 'utf8');
  const code = src.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert.ok(/function exigerSite/.test(code), 'exigerSite manquant');
  assert.ok(/function siteDe/.test(code), 'siteDe manquant');
  assert.ok(/function fuseauDeLaStation/.test(code), 'fuseauDeLaStation manquant');
  assert.ok(!/vito-sainte-marie/.test(code), 'la primitive ne doit contenir aucun site en dur');
  assert.ok(!/America\/Martinique/.test(code), 'la primitive ne doit contenir aucun fuseau en dur');
});

verifier('siteDe refuse la chaîne vide autant que l’absence', () => {
  const src = fs.readFileSync(path.join(RACINE, 'nexus-station.js'), 'utf8');
  const global = {};
  new Function('window', 'document', src)(global, { getElementById: () => null });
  const S = global.NexusStation;
  assert.strictEqual(S.siteDe(null), null, 'employé absent');
  assert.strictEqual(S.siteDe({}), null, 'site_id absent');
  assert.strictEqual(S.siteDe({ site_id: '' }), null, 'chaîne vide');
  assert.strictEqual(S.siteDe({ site_id: '   ' }), null, 'blancs seuls');
  assert.strictEqual(S.siteDe({ site_id: 42 }), null, 'type inattendu');
  assert.strictEqual(S.siteDe({ site_id: ' vito-sainte-marie ' }), 'vito-sainte-marie', 'valeur réelle conservée');
});

verifier('les 4 écrans corrigés chargent la primitive avant nexus-auth', () => {
  for (const f of ['NEXUS-Mon-Evolution-v1.html', 'NEXUS-Mon-Planning-v1.html',
                   'NEXUS-Debug-v1.html', 'NEXUS-Debug-Createur-v1.html']) {
    const src = fs.readFileSync(path.join(RACINE, f), 'utf8');
    const station = src.indexOf('nexus-station.js');
    const auth = src.indexOf('nexus-auth.js');
    assert.ok(station !== -1, f + ' ne charge pas nexus-station.js');
    assert.ok(station < auth, f + ' charge nexus-station.js après nexus-auth.js');
  }
});

verifier('les 2 écrans employé sortent quand le site est indéterminé', () => {
  for (const f of ['NEXUS-Mon-Evolution-v1.html', 'NEXUS-Mon-Planning-v1.html']) {
    const src = fs.readFileSync(path.join(RACINE, f), 'utf8');
    assert.ok(/NexusStation\.exigerSite\(/.test(src), f + ' n’appelle pas exigerSite');
    assert.ok(/const siteId = NexusStation\.exigerSite\([\s\S]{0,300}?\n\s*if \(!siteId\) return;/.test(src),
      f + ' n’interrompt pas le chargement quand le site est indéterminé');
  }
});

verifier('Debug Créateur ne présélectionne aucun site par défaut nommé', () => {
  const src = fs.readFileSync(path.join(RACINE, 'NEXUS-Debug-Createur-v1.html'), 'utf8');
  assert.ok(/NexusStation\.siteDe\(employee\)/.test(src), 'siteDe non utilisé');
  assert.ok(!/employee\.site_id \|\|/.test(src), 'un repli subsiste');
});

console.log(`\n${passes} vérifications passées — le site n'est jamais deviné.`);
