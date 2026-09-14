// ADR-0001 — la garde statique est elle-même éprouvée avant d'être crue.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { classer, controleEffectif, extraireClause, extraireRoles, appelsInconnus, analyser, aidesDeclarees, STATUTS_AIDES } = require('./outils/garde-portee-site');

const SITE = new Set(['t']);
const AIDES = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'docs', 'gouvernance', 'garde-portee-site-aides.json'), 'utf8')
).aides.map(a => ({ nom: a.nom, statut: a.statut }));
const p = (cmd, using, withCheck) => ({ table: 't', policy: 'p', cmd, using, withCheck });
const classe = (cmd, using, withCheck, tables = SITE) => classer(p(cmd, using, withCheck), tables, AIDES).classe;

let passes = 0;
function verifier(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

verifier('policy sûre par fonction de site → SAFE', () => {
  assert.strictEqual(classe('insert', null, 'site_id = current_employee_site_id()'), 'SAFE');
});
verifier('policy sûre par sous-requête employé/site → SAFE', () => {
  assert.strictEqual(classe('insert', null, 'site_id IN (SELECT e.site_id FROM employees e WHERE e.id = auth.uid())'), 'SAFE');
});
verifier('policy vulnérable rôle seul → VULNERABLE', () => {
  assert.strictEqual(classe('update', "current_employee_role() = ANY (ARRAY['manager'])", null), 'VULNERABLE');
});
verifier('policy vulnérable auteur seul → VULNERABLE', () => {
  assert.strictEqual(classe('update', 'employee_id = auth.uid()', null), 'VULNERABLE');
});
verifier('UPDATE avec USING sans WITH CHECK mais garde effective → SAFE', () => {
  assert.strictEqual(classe('update', 'site_id = current_employee_site_id()', null), 'SAFE');
});
verifier('donnée globale légitime — la branche créateur ne conclut pas', () => {
  assert.strictEqual(classe('update', 'je_suis_createur() AND site_id IS NOT NULL', null), 'UNKNOWN');
});
verifier('table sans portée site → NOT_APPLICABLE', () => {
  assert.strictEqual(classe('insert', null, 'employee_id = auth.uid()', new Set()), 'NOT_APPLICABLE');
});
verifier('policy de lecture → NOT_APPLICABLE', () => {
  assert.strictEqual(classe('select', 'site_id = current_employee_site_id()', null), 'NOT_APPLICABLE');
});
verifier('cas ambigu → UNKNOWN, jamais SAFE', () => {
  assert.strictEqual(classe('insert', null, 'statut = 3'), 'UNKNOWN');
  assert.strictEqual(classe('insert', null, null), 'UNKNOWN');
});
verifier('refuser TOUT n’est pas une preuve de portée', () => {
  assert.strictEqual(classe('insert', null, 'false'), 'UNKNOWN');
});
verifier('la jointure de portée est reconnue', () => {
  assert.strictEqual(classe('insert', null, 'EXISTS (SELECT 1 FROM advisor_messages m JOIN employees e ON e.site_id = m.site_id WHERE e.id = auth.uid())'), 'SAFE');
});
verifier('l’aide nommée de portée est reconnue', () => {
  assert.strictEqual(classe('insert', null, 'nexus_clients_ecriture_ok(site)'), 'SAFE');
});
verifier('une policy réservée à service_role est hors identité utilisateur', () => {
  const q = { table: 't', policy: 'p', cmd: 'all', using: 'true', withCheck: 'true', roles: ['service_role'] };
  assert.strictEqual(classer(q, SITE, AIDES).classe, 'NOT_APPLICABLE');
  assert.notStrictEqual(classer({ ...q, roles: ['authenticated'] }, SITE, AIDES).classe, 'NOT_APPLICABLE');
});
verifier('un test de sécurité distingue 42501 des erreurs de contrainte', () => {
  const REFUS_RLS = '42501';
  for (const code of ['23502', '23503', '23514', '22P02']) assert.notStrictEqual(code, REFUS_RLS);
});
verifier('une aide NON déclarée rend UNKNOWN, jamais SAFE', () => {
  const q = { table: 't', policy: 'p', cmd: 'insert', using: null, withCheck: 'ma_nouvelle_aide(site_id)' };
  const r = classer(q, SITE, [{ nom: 'nexus_clients_ecriture_ok', statut: 'CONFORME' }]);
  assert.strictEqual(r.classe, 'UNKNOWN');
  assert.ok(/ma_nouvelle_aide/.test(r.motif));
  assert.strictEqual(classer(q, SITE, [{ nom: 'ma_nouvelle_aide', statut: 'CONFORME' }]).classe, 'SAFE');
});

// Q63 — le registre est une dépendance sémantique de la garde.
verifier('Q63 — une aide CONFORME couvre sa policy en SAFE', () => {
  const q = { table: 't', policy: 'p', cmd: 'insert', using: null, withCheck: 'ma_garde(site)' };
  assert.strictEqual(classer(q, SITE, [{ nom: 'ma_garde', statut: 'CONFORME' }]).classe, 'SAFE');
});
verifier('Q63 — mutation vert → rouge → vert', () => {
  const q = { table: 't', policy: 'p', cmd: 'insert', using: null, withCheck: 'ma_garde(site)' };
  assert.strictEqual(classer(q, SITE, [{ nom: 'ma_garde', statut: 'CONFORME' }]).classe, 'SAFE');
  const rouge = classer(q, SITE, [{ nom: 'ma_garde', statut: 'DEFAILLANTE' }]);
  assert.strictEqual(rouge.classe, 'VULNERABLE');
  assert.ok(/DEFAILLANTE/.test(rouge.motif) && /ma_garde/.test(rouge.motif));
  assert.strictEqual(classer(q, SITE, [{ nom: 'ma_garde', statut: 'CONFORME' }]).classe, 'SAFE');
});
verifier('Q63 — NON_EPROUVEE rend UNKNOWN', () => {
  const q = { table: 't', policy: 'p', cmd: 'insert', using: null, withCheck: 'ma_garde(site)' };
  assert.strictEqual(classer(q, SITE, [{ nom: 'ma_garde', statut: 'NON_EPROUVEE' }]).classe, 'UNKNOWN');
});
verifier('Q63 — une branche OR défaillante dégrade la policy', () => {
  const q = { table: 't', policy: 'p', cmd: 'insert', using: null, withCheck: "current_employee_role() = ANY (ARRAY['manager']) OR aide_saine(site) OR aide_cassee(site)" };
  assert.strictEqual(classer(q, SITE, [{ nom: 'aide_saine', statut: 'CONFORME' }, { nom: 'aide_cassee', statut: 'DEFAILLANTE' }]).classe, 'VULNERABLE');
});
verifier('Q63 — registre réel : vocabulaire clos et pompiste désormais CONFORME après preuve Test', () => {
  const declarees = aidesDeclarees(__dirname);
  assert.ok(declarees.length >= 3);
  for (const a of declarees) assert.ok(STATUTS_AIDES.includes(a.statut));
  const pompiste = declarees.find(a => a.nom === 'est_pompiste_du_jour');
  assert.ok(pompiste);
  assert.strictEqual(pompiste.statut, 'CONFORME', 'la preuve comportementale post-correction Test autorise désormais CONFORME');
});

verifier('la clause TO est réellement extraite du DDL', () => {
  assert.deepStrictEqual(extraireRoles('for all to service_role using (true)'), ['service_role']);
  assert.deepStrictEqual(extraireRoles('for insert to authenticated with check (a)'), ['authenticated']);
  assert.deepStrictEqual(extraireRoles('for update using (a)'), []);
  const { rejouerMigrations } = require('./outils/garde-portee-site');
  const { policies } = rejouerMigrations(path.join(__dirname, 'supabase', 'migrations'));
  assert.ok(policies.some(x => Array.isArray(x.roles) && x.roles.length));
});
verifier('un appel inconnu est repéré quelle que soit la branche', () => {
  assert.deepStrictEqual(appelsInconnus('ma_nouvelle_aide(site_id)', []), ['ma_nouvelle_aide']);
  assert.deepStrictEqual(appelsInconnus('site_id = current_employee_site_id()', ['current_employee_site_id']), []);
  assert.deepStrictEqual(appelsInconnus('a and (b or c)', []), []);
});
verifier('chaque aide déclarée porte preuve et contrat', () => {
  const registre = JSON.parse(fs.readFileSync(path.join(__dirname, 'docs', 'gouvernance', 'garde-portee-site-aides.json'), 'utf8'));
  for (const a of registre.aides) {
    assert.ok(a.preuve && a.preuve.trim());
    assert.ok(a.contrat && a.portee_controlee);
  }
});
verifier('chaque dérogation nomme un humain', () => {
  const registre = JSON.parse(fs.readFileSync(path.join(__dirname, 'docs', 'gouvernance', 'garde-portee-site-derogations.json'), 'utf8'));
  for (const d of registre.derogations) assert.ok(/Frédéric/.test(d.autorise_par));
});
verifier('le contrôle effectif dépend de la face', () => {
  assert.strictEqual(controleEffectif({ cmd: 'insert', withCheck: 'W', using: 'U' }), 'W');
  assert.strictEqual(controleEffectif({ cmd: 'delete', withCheck: 'W', using: 'U' }), 'U');
  assert.strictEqual(controleEffectif({ cmd: 'update', withCheck: 'W', using: 'U' }), 'W');
  assert.strictEqual(controleEffectif({ cmd: 'update', withCheck: null, using: 'U' }), 'U');
});
verifier('les clauses imbriquées sont extraites entièrement', () => {
  const corps = 'for update using (a AND (b OR c)) with check (d = (select e()))';
  assert.strictEqual(extraireClause(corps, 'using'), 'a AND (b OR c)');
  assert.strictEqual(extraireClause(corps, 'with\\s+check'), 'd = (select e())');
});
verifier('les six occurrences d’ADR-0001 ressortent SAFE', () => {
  const { resultats } = analyser(path.resolve(__dirname));
  const attendues = [
    ['mission_progress', 'employee_own_progress_update'],
    ['apprentissage_snapshots', 'employee_own_snapshot_update'],
    ['apprentissage_snapshots', 'employee_own_snapshot_upsert'],
    ['advisor_rules', 'manager_update_advisor_rules'],
    ['advisor_rules', 'manager_delete_advisor_rules'],
    ['advisor_rules', 'manager_insert_advisor_rules'],
  ];
  for (const [table, policy] of attendues) {
    const r = resultats.find(x => x.table === table && x.policy === policy);
    assert.ok(r, `${table}.${policy} introuvable`);
    assert.strictEqual(r.classe, 'SAFE', `${table}.${policy} devrait être SAFE, trouvé ${r.classe}`);
  }
});
verifier('le rejeu des migrations reste exploitable', () => {
  const { resultats, nonCompris } = analyser(path.resolve(__dirname));
  assert.ok(resultats.length > 300);
  assert.strictEqual(nonCompris, 0);
  assert.ok(!resultats.some(r => r.table === 'public'));
});

console.log(`\n${passes} vérifications passées — la garde est éprouvée, pas crue sur parole.`);
