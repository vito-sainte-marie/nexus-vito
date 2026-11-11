// Photo rayon (terrain) : mission_completions a deux FK vers employees (employee_id, ajuste_par).
// Un embed non qualifie est ambigu pour PostgREST : la requete echoue et la photo ne se charge jamais.
const fs = require('fs'); const assert = require('assert');
const src = fs.readFileSync(__dirname + '/NEXUS-Produits-v1.html', 'utf8');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const blocs = [...src.matchAll(/\.from\('mission_completions'\)[\s\S]{0,400}?\.select\(([^)]*\)[^)]*)\)/g)];
ok(blocs.length >= 1, "au moins une lecture de mission_completions avec select");
for (const b of blocs) {
  ok(!/employees\(/.test(b[1]), "embed employees(...) non qualifie refuse sur mission_completions : " + b[1]);
}
ok(/employees!mission_completions_employee_id_fkey\(nom\)/.test(src), 'embed qualifie par la FK employee_id');
console.log('OK', n, 'verifications');
