// STATIC-GUARD-FINDINGS — les trois occurrences trouvées par la garde.
//
// Elles n'avaient été vues par personne en six lots de recherche manuelle.
// C'est l'argument de l'instrument : une ADR dit où regarder, une garde
// regarde.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const RACINE = __dirname;
const SQL = fs.readFileSync(path.join(RACINE, 'supabase', 'migrations',
  '20260906080000_garde_portee_findings.sql'), 'utf8');

function policy(nom) {
  const i = SQL.indexOf(`create policy ${nom} on`);
  assert.ok(i !== -1, `policy ${nom} introuvable`);
  const j = SQL.indexOf('comment on policy', i);
  return SQL.slice(i, j === -1 ? SQL.length : j);
}

let passes = 0;
function verifier(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

verifier('les deux tables de progression contrôlent auteur ET site', () => {
  for (const p of ['employee_own_badge_insert', 'employee_own_points_insert']) {
    const c = policy(p);
    assert.ok(/employee_id = \(select auth\.uid\(\)\)/.test(c), `${p} : l’auteur reste contrôlé`);
    assert.ok(/site_id = \(select public\.current_employee_site_id\(\)\)/.test(c), `${p} : le site est ajouté`);
  }
});

verifier('inventaire_quart_employes garde une portée INDIRECTE', () => {
  // La consigne était explicite : ne pas ajouter de colonne site si la portée
  // par quart_id est le contrat normal. La correction protège le contrat, elle
  // n'uniformise pas le schéma.
  const c = policy('update_inventaire_quart_employes');
  assert.ok(/from public\.inventaire_quarts q/.test(c),
    'la portée doit passer par le quart, pas par une colonne site ajoutée');
  assert.ok(!/add column|alter table/i.test(SQL),
    'aucune colonne site ne doit être ajoutée à cette table');
});

verifier('le with check interdit le rattachement à un quart d’un autre site', () => {
  // `using` borne les lignes visibles ; `with check` contrôle la NOUVELLE
  // valeur de quart_id. Sans lui, un update pouvait déplacer la ligne vers le
  // quart d'un autre commerce — les deux ne disent pas la même chose.
  const c = policy('update_inventaire_quart_employes');
  const iUsing = c.indexOf('using (');
  const iCheck = c.indexOf('with check (');
  assert.ok(iUsing !== -1 && iCheck !== -1, 'les deux clauses doivent exister');
  assert.ok(/inventaire_quarts/.test(c.slice(iCheck)),
    'le with check doit recouper le quart, sinon la nouvelle valeur n’est pas contrôlée');
});

verifier('les acteurs légitimes sont conservés', () => {
  const c = policy('update_inventaire_quart_employes');
  assert.ok(/employee_id = \(select auth\.uid\(\)\)/.test(c), 'l’employé garde sa ligne');
  assert.ok(/= any \(array\['manager','gerant'\]\)/.test(c),
    'le manager garde la réouverture de clôture sur son commerce');
});

verifier('aucun privilège élargi, aucune donnée réattribuée', () => {
  const sansCommentaires = SQL.replace(/--.*$/gm, '');
  assert.ok(!/\binsert into public\.|\bupdate public\.\w+ set|\bdelete from public\./i.test(sansCommentaires),
    'aucune écriture de données dans cette migration');
  assert.ok(!/je_suis_createur/.test(SQL), 'aucune branche créateur ajoutée');
  assert.ok(!/drop default/i.test(SQL), 'aucun default retiré');
});

verifier('la migration s’arrête si une portée manque', () => {
  assert.ok(/raise exception 'STATIC-GUARD-FINDINGS interrompu/.test(SQL));
  assert.ok(/update_inventaire_quart_employes \(with check\)/.test(SQL),
    'le contrôle doit vérifier les DEUX clauses de la policy indirecte');
});

verifier('la garde statique ne signale plus aucune VULNERABLE', () => {
  const { analyser } = require('./outils/garde-portee-site');
  const { resultats, incoherences } = analyser(RACINE);
  const vulnerables = resultats.filter(r => r.classeEffective === 'VULNERABLE');
  assert.deepStrictEqual(vulnerables.map(v => `${v.table}.${v.policy}`), [],
    'les trois occurrences doivent avoir disparu du rapport');
  assert.deepStrictEqual(incoherences.map(i => i.table), [],
    'l’incohérence de faces d’inventaire_quart_employes doit être résolue');
});

console.log(`\n${passes} vérifications passées — les trois occurrences sont fermées.`);
