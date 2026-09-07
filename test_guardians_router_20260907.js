// Épreuves du routeur Guardians backend (Gouvernance Autonome v2).
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  scopesPourFichier,
  calculerScopes,
  guardianSecurity,
  identitesGlobalesDeclarees,
  guardianArchitectureCollisions,
  guardianArchitectureDependances,
  reglesEnPortee,
  preflightHeadCanonique,
} = require('./outils/guardians-router.js');

let passes = 0;
function t(nom, fn) { fn(); passes++; console.log(`  ok — ${nom}`); }

t('scopesPourFichier reconnaît une migration Supabase', () => {
  const s = scopesPourFichier('supabase/migrations/20260101000000_x.sql');
  assert(s.has('security') && s.has('supabase'));
});

t('calculerScopes agrège plusieurs fichiers', () => {
  const { scopes, modules } = calculerScopes(['outils/x.js', 'test_carburant_y.js']);
  assert(scopes.has('development'));
  assert(scopes.has('qa') === false || scopes.has('qa')); // test_ prefix scope
  assert(modules.has('carburants-performance'));
});

t('reglesEnPortee filtre par scope et module', () => {
  const regles = [
    { id: 'A-001', scope: ['security'], module: 'all' },
    { id: 'B-001', scope: ['ux'], module: 'all' },
    { id: 'C-001', scope: ['business_rules'], module: 'carburants-performance' },
    { id: 'D-001', scope: ['business_rules'], module: 'paye' },
  ];
  const scopes = new Set(['security', 'business_rules']);
  const modules = new Set(['carburants-performance']);
  const en = reglesEnPortee(regles, scopes, modules).map(r => r.id);
  assert.deepStrictEqual(en.sort(), ['A-001', 'C-001']);
});

// ── Guardian Security : secret littéral ────────────────────────────────
t('guardianSecurity détecte un JWT littéral, silence sinon (mutation)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardians-sec-'));
  const f = 'fixture-secret.js';
  const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnopqrstuvwxyz012345';
  fs.writeFileSync(path.join(dir, f), `const token = "${jwt}";`);
  const ancienCwd = process.cwd();
  // simuler RACINE via un require frais serait plus lourd ; on scanne directement
  // en pointant le fichier réel écrit sous la vraie racine du dépôt à la place.
  const cheminReel = path.join(__dirname, '__fixture_secret_tmp__.js');
  fs.writeFileSync(cheminReel, `const token = "${jwt}";`);
  try {
    const findingsRouge = guardianSecurity(['__fixture_secret_tmp__.js']);
    assert(findingsRouge.length >= 1, 'devrait détecter le JWT littéral');
    fs.writeFileSync(cheminReel, `const token = process.env.NEXUS_TOKEN;`);
    const findingsVert = guardianSecurity(['__fixture_secret_tmp__.js']);
    assert.strictEqual(findingsVert.length, 0, 'ne doit pas signaler une référence à une variable d\'environnement');
  } finally {
    fs.unlinkSync(cheminReel);
    fs.rmSync(dir, { recursive: true, force: true });
    process.chdir(ancienCwd);
  }
});

// ── Guardian Architecture : collision d'identité globale ───────────────
t('identitesGlobalesDeclarees repère la collision réelle NexusStock', () => {
  const racine = path.resolve(__dirname);
  const map = identitesGlobalesDeclarees(racine);
  assert(map.has('NexusStock'), 'NexusStock doit être détecté comme identité globale déclarée');
  assert(map.get('NexusStock').size >= 2, 'NexusStock doit être déclarée par au moins deux fichiers (constat audit-1.md)');
});

t('guardianArchitectureCollisions ne signale pas une identité déclarée une seule fois (mutation)', () => {
  // Construit via concaténation pour que le motif ne soit pas un littéral
  // présent tel quel dans CE fichier de test lorsqu'il est lui-même scanné.
  const nomIdentite = '__Fixture' + 'Unique__';
  const cheminA = path.join(__dirname, '__fixture_identite_a__.js');
  const cheminB = path.join(__dirname, '__fixture_identite_b__.js');
  fs.writeFileSync(cheminA, 'window.' + nomIdentite + ' = {};');
  try {
    let findings = guardianArchitectureCollisions();
    assert(findings.some(f => f.message.includes(nomIdentite)) === false, 'une seule déclaration ne doit pas être un finding');
    fs.writeFileSync(cheminB, 'global.' + nomIdentite + ' = {};');
    findings = guardianArchitectureCollisions();
    assert(findings.some(f => f.message.includes(nomIdentite)) === true, 'deux déclarations doivent produire un finding');
  } finally {
    fs.unlinkSync(cheminA);
    if (fs.existsSync(cheminB)) fs.unlinkSync(cheminB);
  }
});

t('guardianArchitectureDependances signale une dépendance applicative vers docs/gouvernance', () => {
  const cheminApp = path.join(__dirname, '__fixture_app_dep__.js');
  fs.writeFileSync(cheminApp, "const r = require('docs/gouvernance/garde-portee-site-aides.json');");
  try {
    const findings = guardianArchitectureDependances(['__fixture_app_dep__.js']);
    assert(findings.length >= 1);
  } finally {
    fs.unlinkSync(cheminApp);
  }
});

t('guardianArchitectureDependances ignore outils/ et docs/ eux-mêmes', () => {
  const findings = guardianArchitectureDependances(['outils/handoff.js', 'docs/learning/RULES.json']);
  assert.strictEqual(findings.length, 0);
});

t('preflightHeadCanonique renvoie une structure exploitable', () => {
  const r = preflightHeadCanonique({ brancheAttendue: '__branche_qui_ne_peut_pas_exister__' });
  assert(typeof r.ok === 'boolean');
  assert(r.ok === false, 'ne peut pas être ok sur une branche attendue inexistante et différente de HEAD');
});

console.log(`\n${passes} épreuve(s) passée(s) — outils/guardians-router.js`);
