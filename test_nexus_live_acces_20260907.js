// Test — Autorisation d'accès NEXUS LIVE DÉVELOPPEMENT (nexus-live-acces.js)
// Lot NEXUS-LIVE-CONTROL-CENTER-1-20260906, spec-1.md §2, §7 (tests
// négatifs obligatoires). Ce test porte sur la fonction pure utilisée par
// NEXUS-Live-Developpement-v1.html — la preuve comportementale réelle
// contre l'environnement NEXUS Test (manager-test / employe-test-*) reste
// hors de portée de ce test (nécessite un navigateur, cf. rapport du lot).

const path = require('path');
const vm = require('vm');
const fs = require('fs');
const assert = require('assert');

const code = fs.readFileSync(path.join(__dirname, 'nexus-live-acces.js'), 'utf8');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const A = sandbox.NexusLiveAcces;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

// 1) Créateur explicite -> autorisé.
assert.strictEqual(A.nexusLiveAutorise({ est_createur: true, role: 'manager' }), true);
ok('employee.est_createur === true -> autorisé');

// 2) Manager sans capacité Créateur -> refusé.
assert.strictEqual(A.nexusLiveAutorise({ est_createur: false, role: 'manager' }), false);
assert.strictEqual(A.motifRefusLive({ est_createur: false, role: 'manager' }), 'capacite_createur_absente');
ok('manager sans est_createur -> refusé');

// 3) Employé (pompiste/caissier) sans capacité Créateur -> refusé.
assert.strictEqual(A.nexusLiveAutorise({ est_createur: false, role: 'pompiste' }), false);
ok('employé sans est_createur -> refusé');

// 4) Aucune session -> refusé, fail closed, motif explicite.
assert.strictEqual(A.nexusLiveAutorise(null), false);
assert.strictEqual(A.motifRefusLive(null), 'session_absente');
ok('session absente -> refusé (fail closed)');

// 5) Champ est_createur absent (undefined) -> refusé, jamais un défaut permissif.
assert.strictEqual(A.nexusLiveAutorise({ role: 'manager' }), false);
ok('est_createur non défini -> refusé, pas de défaut permissif');

// 6) est_createur "truthy" non strictement true (ex. chaîne, 1) -> refusé.
// Un flag de capacité ne doit jamais être évalué par coercition implicite.
assert.strictEqual(A.nexusLiveAutorise({ est_createur: 1 }), false);
assert.strictEqual(A.nexusLiveAutorise({ est_createur: 'true' }), false);
ok('valeurs non booléennes strictes refusées (pas de coercition)');

// 7) Rôle métier "manager" ne peut jamais compenser l'absence de capacité
//    Créateur, même combiné à d'autres champs plausibles (multisite, etc.).
assert.strictEqual(A.nexusLiveAutorise({ role: 'manager', multi_site: true, admin_site: true }), false);
ok('aucun rôle/attribut client ne peut se substituer à est_createur');

console.log(`\n${n} assertions Live-Accès passées.`);
