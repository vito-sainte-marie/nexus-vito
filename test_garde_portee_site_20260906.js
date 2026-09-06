// ADR-0001 — la garde statique est elle-même éprouvée avant d'être crue.
//
// Deux fois pendant ce chantier, un classificateur non testé a produit un
// résultat faux : 42 trous imaginaires, puis 5. À sa calibration, cette
// garde-ci en a produit un sixième — `advisor_message_evidence`, dont elle ne
// connaissait pas la forme de contrôle.
//
// Exigence de l'arbitrage : le contrôleur doit être testé par mutation avant
// toute promotion en CI, et savoir répondre UNKNOWN plutôt que de conclure.
'use strict';
const assert = require('assert');
const path = require('path');
const { classer, controleEffectif, extraireClause, analyser } = require('./outils/garde-portee-site');

const SITE = new Set(['t']);
const p = (cmd, using, withCheck) => ({ table: 't', policy: 'p', cmd, using, withCheck });
const classe = (cmd, using, withCheck, tables = SITE) => classer(p(cmd, using, withCheck), tables).classe;

let passes = 0;
function verifier(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

// ── Le corpus exigé par l'arbitrage ─────────────────────────────────────

verifier('policy sûre par fonction de site → SAFE', () => {
  assert.strictEqual(classe('insert', null, 'site_id = current_employee_site_id()'), 'SAFE');
});

verifier('policy sûre par sous-requête employé/site → SAFE', () => {
  assert.strictEqual(
    classe('insert', null, 'site_id IN (SELECT e.site_id FROM employees e WHERE e.id = auth.uid())'),
    'SAFE');
});

verifier('policy vulnérable rôle seul → VULNERABLE', () => {
  assert.strictEqual(classe('update', "current_employee_role() = ANY (ARRAY['manager'])", null), 'VULNERABLE');
});

verifier('policy vulnérable auteur seul → VULNERABLE', () => {
  assert.strictEqual(classe('update', 'employee_id = auth.uid()', null), 'VULNERABLE');
});

verifier('UPDATE avec USING sans WITH CHECK mais garde effective → SAFE', () => {
  // Le piège qui aurait fait compter 42 faux trous : PostgreSQL applique
  // `using` à la nouvelle ligne quand `with check` est absent.
  assert.strictEqual(classe('update', 'site_id = current_employee_site_id()', null), 'SAFE');
});

verifier('donnée globale légitime — la branche créateur ne conclut pas', () => {
  // Une capacité transverse assumée n'est ni sûre ni vulnérable au sens de
  // l'ADR : c'est une décision métier, et la garde demande sa relecture.
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
  // Exigence explicite : ne jamais classer SAFE parce qu'une policy refuse
  // tout. `false` ne contrôle pas la portée, il interdit — ce n'est pas la
  // même garantie, et une policy élargie demain ne protègerait plus rien.
  assert.strictEqual(classe('insert', null, 'false'), 'UNKNOWN');
});

verifier('la jointure de portée est reconnue', () => {
  // Forme apprise à la calibration : la garde l'ignorait et accusait à tort.
  assert.strictEqual(
    classe('insert', null, 'EXISTS (SELECT 1 FROM advisor_messages m JOIN employees e ON e.site_id = m.site_id WHERE e.id = auth.uid())'),
    'SAFE');
});

// ── Contrôle effectif selon la face ─────────────────────────────────────

verifier('le contrôle effectif dépend de la face', () => {
  assert.strictEqual(controleEffectif({ cmd: 'insert', withCheck: 'W', using: 'U' }), 'W');
  assert.strictEqual(controleEffectif({ cmd: 'delete', withCheck: 'W', using: 'U' }), 'U');
  assert.strictEqual(controleEffectif({ cmd: 'update', withCheck: 'W', using: 'U' }), 'W');
  assert.strictEqual(controleEffectif({ cmd: 'update', withCheck: null, using: 'U' }), 'U',
    'sans with check, using s’applique à la nouvelle ligne');
});

verifier('les clauses imbriquées sont extraites entièrement', () => {
  // Une regex paresseuse tronquait `using (a AND (b OR c))` à la première
  // parenthèse fermante, et perdait la moitié de la condition.
  const corps = 'for update using (a AND (b OR c)) with check (d = (select e()))';
  assert.strictEqual(extraireClause(corps, 'using'), 'a AND (b OR c)');
  assert.strictEqual(extraireClause(corps, 'with\\s+check'), 'd = (select e())');
});

// ── Corpus de régression : les six occurrences d'ADR-0001 ───────────────

verifier('les six occurrences d’ADR-0001 ressortent SAFE', () => {
  // Elles sont toutes corrigées ; si l'une redevenait vulnérable, la garde
  // doit le dire. C'est le seul corpus de régression dont on dispose.
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
    assert.ok(r, `${table}.${policy} introuvable dans le rejeu des migrations`);
    assert.strictEqual(r.classe, 'SAFE', `${table}.${policy} devrait être SAFE, trouvé ${r.classe}`);
  }
});

verifier('le rejeu des migrations reste exploitable', () => {
  const { resultats, nonCompris } = analyser(path.resolve(__dirname));
  assert.ok(resultats.length > 300, 'le rejeu doit retrouver l’essentiel des policies');
  assert.strictEqual(nonCompris, 0, 'aucun DDL de policy ne doit rester non compris sans le dire');
  assert.ok(!resultats.some(r => r.table === 'public'),
    'aucune table ne doit s’appeler « public » — ce serait un défaut d’analyse du schéma qualifié');
});

console.log(`\n${passes} vérifications passées — la garde est éprouvée, pas crue sur parole.`);
