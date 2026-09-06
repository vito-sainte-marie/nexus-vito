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
const fs = require('fs');
const path = require('path');
const { classer, controleEffectif, extraireClause, extraireRoles, appelsInconnus, analyser } = require('./outils/garde-portee-site');

const SITE = new Set(['t']);
// Les épreuves unitaires lisent LE registre réel : une garde testée avec une
// configuration différente de celle qu'elle exécute ne prouve pas grand-chose.
const AIDES = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'docs', 'gouvernance', 'garde-portee-site-aides.json'), 'utf8')
).aides.map(a => a.nom);
const p = (cmd, using, withCheck) => ({ table: 't', policy: 'p', cmd, using, withCheck });
const classe = (cmd, using, withCheck, tables = SITE) => classer(p(cmd, using, withCheck), tables, AIDES).classe;

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

verifier('l’aide nommée de portée est reconnue', () => {
  // Quatrième forme, apprise au tri des UNKNOWN : 22 policies utilisaient
  // `nexus_clients_ecriture_ok(site)`, une aide qui vérifie rôle ET site.
  // La garde n'y voyait qu'un appel de fonction inconnu.
  assert.strictEqual(classe('insert', null, 'nexus_clients_ecriture_ok(site)'), 'SAFE');
});

verifier('une policy réservée à service_role est hors identité utilisateur', () => {
  // La clause TO est une frontière de confiance, pas un détail. Ce n'est pas
  // une absolution : le contrôle est déplacé vers qui détient la clé de
  // service, et le tri doit le documenter.
  const { classer } = require('./outils/garde-portee-site');
  const p = { table: 't', policy: 'p', cmd: 'all', using: 'true', withCheck: 'true', roles: ['service_role'] };
  assert.strictEqual(classer(p, SITE, AIDES).classe, 'NOT_APPLICABLE');
  const q = { ...p, roles: ['authenticated'] };
  assert.notStrictEqual(classer(q, SITE, AIDES).classe, 'NOT_APPLICABLE',
    'une policy ouverte à authenticated ne bénéficie pas de cette frontière');
});

verifier('un test de sécurité doit distinguer 42501 des erreurs de contrainte', () => {
  // Exigence issue du faux signal P3/P5 : une écriture qui échoue en 23502
  // (colonne obligatoire absente) n'a rien prouvé sur la RLS. Un test qui
  // conclut « sécurité OK » sur un refus de contrainte ment dans les deux
  // sens. Cette épreuve garde la règle dans le corpus de la garde.
  const REFUS_RLS = '42501';
  const NON_CONCLUANTS = ['23502', '23503', '23514', '22P02'];
  assert.ok(!NON_CONCLUANTS.includes(REFUS_RLS),
    'seul 42501 atteste un refus de politique');
  for (const code of NON_CONCLUANTS) {
    assert.notStrictEqual(code, REFUS_RLS,
      `${code} est une erreur de schéma ou de donnée : la RLS n’a pas été atteinte`);
  }
});

verifier('une aide NON déclarée au registre rend UNKNOWN, jamais SAFE', () => {
  // Sans cette règle, chaque refactorisation qui encapsule un contrôle dans
  // une nouvelle fonction rendrait la garde un peu plus aveugle sans que
  // personne ne s'en aperçoive.
  const { classer } = require('./outils/garde-portee-site');
  const p = { table: 't', policy: 'p', cmd: 'insert', using: null,
              withCheck: 'ma_nouvelle_aide(site_id)' };
  const r = classer(p, SITE, ['nexus_clients_ecriture_ok']);
  assert.strictEqual(r.classe, 'UNKNOWN');
  // Vérifier la classe ne suffit pas : UNKNOWN est aussi la réponse par
  // défaut quand rien ne correspond. Le motif doit NOMMER l'aide inconnue,
  // sinon la garde ne dit pas ce qu'elle a vu.
  assert.ok(/aide non déclarée au registre : ma_nouvelle_aide/.test(r.motif),
    'le motif doit nommer l’aide inconnue, sinon UNKNOWN ne distingue rien : ' + r.motif);
  assert.strictEqual(classer(p, SITE, ['ma_nouvelle_aide']).classe, 'SAFE');
});

verifier('la clause TO est réellement extraite du DDL', () => {
  // Lacune trouvée par mutation : j'éprouvais `classer` en lui passant des
  // rôles à la main, donc jamais l'ANALYSEUR qui les lit. Retirer l'extraction
  // ne faisait échouer aucun test.
  assert.deepStrictEqual(extraireRoles('for all to service_role using (true)'), ['service_role']);
  assert.deepStrictEqual(extraireRoles('for insert to authenticated with check (a)'), ['authenticated']);
  assert.deepStrictEqual(extraireRoles('for update using (a)'), [],
    'sans clause TO, aucun rôle ne doit être inventé');

  // Et surtout : que l'analyseur la CÂBLE réellement. Tester la fonction sans
  // son branchement laissait passer sa suppression pure et simple.
  const { rejouerMigrations } = require('./outils/garde-portee-site');
  const { policies } = rejouerMigrations(path.join(__dirname, 'supabase', 'migrations'));
  assert.ok(policies.some(p => Array.isArray(p.roles) && p.roles.length),
    'le rejeu doit renseigner les rôles d’au moins une policy — sinon la clause TO n’est pas lue');
});

verifier('un appel inconnu est repéré quelle que soit la branche', () => {
  // Seconde lacune : ma mutation ne visait qu'une des deux sorties du
  // classement. L'invariant doit tenir des deux côtés.
  assert.deepStrictEqual(appelsInconnus('ma_nouvelle_aide(site_id)', []), ['ma_nouvelle_aide']);
  assert.deepStrictEqual(appelsInconnus('site_id = current_employee_site_id()', ['current_employee_site_id']), []);
  assert.deepStrictEqual(appelsInconnus('a and (b or c)', []), [],
    'les mots-clés SQL ne sont pas des appels de fonction');
});

verifier('une aide déclarée SANS preuve fait échouer la lecture du registre', () => {
  // Le registre exige une preuve du contrat : une aide qu'on déclare sûre
  // sans rien pour l'étayer ne vaut pas mieux qu'une aide inconnue.
  const registre = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'docs', 'gouvernance', 'garde-portee-site-aides.json'), 'utf8'));
  assert.ok(registre.aides.length >= 3, 'le registre doit être peuplé');
  for (const a of registre.aides) {
    assert.ok(a.preuve && a.preuve.trim(), `l’aide ${a.nom} doit porter une preuve de son contrat`);
    assert.ok(a.contrat && a.portee_controlee, `l’aide ${a.nom} doit décrire ce qu’elle contrôle`);
  }
});

verifier('chaque dérogation nomme un humain', () => {
  // `autorise_par` ne peut pas être un agent : une dérogation qu'un outil
  // s'accorde lui-même est une exclusion silencieuse.
  const registre = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'docs', 'gouvernance', 'garde-portee-site-derogations.json'), 'utf8'));
  for (const d of registre.derogations) {
    for (const champ of ['table', 'policy', 'classe_attendue', 'motif', 'autorise_par', 'le']) {
      assert.ok(d[champ], `dérogation ${d.policy || '(sans nom)'} : ${champ} manquant`);
    }
    assert.ok(/Frédéric/.test(d.autorise_par),
      `la dérogation ${d.policy} doit être autorisée par un humain nommé`);
  }
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
