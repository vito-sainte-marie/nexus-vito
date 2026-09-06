// INSERT-SITE-GUARD — on ne crée pas une portée qu'on ne pourrait administrer.
//
// Après MUTATION-SITE-GUARD, deux policies d'INSERT restaient plus permissives
// que leurs faces UPDATE : un manager pouvait CRÉER une règle globale —
// influençant tous les commerces — qu'il n'avait plus le droit de modifier ni
// de supprimer. Créer était devenu plus facile qu'administrer.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const RACINE = __dirname;
const SQL = fs.readFileSync(path.join(RACINE, 'supabase', 'migrations',
  '20260906060000_garde_insertion_site.sql'), 'utf8');
const MUTATION = fs.readFileSync(path.join(RACINE, 'supabase', 'migrations',
  '20260906040000_garde_mutation_site.sql'), 'utf8');

function policy(sql, nom) {
  const i = sql.indexOf(`create policy ${nom} on`);
  assert.ok(i !== -1, `policy ${nom} introuvable`);
  const j = sql.indexOf('comment on policy', i);
  return sql.slice(i, j === -1 ? sql.length : j);
}

let passes = 0;
function verifier(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

verifier('les deux insertions contrôlent le site', () => {
  for (const p of ['manager_insert_advisor_rules', 'employee_own_snapshot_upsert']) {
    assert.ok(/current_employee_site_id/.test(policy(SQL, p)), `${p} doit contrôler le site`);
  }
});

verifier('l’identité de l’acteur reste contrôlée', () => {
  assert.ok(/current_employee_role\(\)\) = any \(array\['manager','gerant'\]\)/.test(
    policy(SQL, 'manager_insert_advisor_rules')), 'le rôle reste exigé');
  assert.ok(/employee_id = \(select auth\.uid\(\)\)/.test(
    policy(SQL, 'employee_own_snapshot_upsert')), 'l’auteur reste exigé');
});

verifier('créer et administrer obéissent au MÊME contrat', () => {
  // Le défaut fermé ici : créer était plus permissif qu'administrer. Si les
  // deux faces divergeaient à nouveau, on pourrait créer une portée qu'on ne
  // peut plus modifier — exactement l'incohérence d'origine.
  const insert = policy(SQL, 'manager_insert_advisor_rules');
  const update = policy(MUTATION, 'manager_update_advisor_rules');
  for (const motif of [/current_employee_role/, /current_employee_site_id/]) {
    assert.ok(motif.test(insert) && motif.test(update),
      'INSERT et UPDATE doivent exiger les mêmes conditions de portée');
  }
});

verifier('une règle globale ne peut pas être créée par un manager', () => {
  // Aucune clause `is null` : la comparaison au site est fausse pour un null,
  // donc la règle globale est exclue sans qu'on ait à la nommer — et aucun
  // null ne peut être confondu avec « autorisé ».
  const p = policy(SQL, 'manager_insert_advisor_rules');
  assert.ok(!/is null/.test(p),
    'aucune clause ne doit rattraper le null : la comparaison le fait déjà, fail-closed');
});

verifier('aucune policy UPDATE ou DELETE n’est retouchée', () => {
  assert.ok(!/for update|for delete/.test(SQL),
    'ce lot ne ferme que les insertions ; les autres faces sont déjà closes');
});

verifier('aucune donnée n’est réattribuée', () => {
  const sansCommentaires = SQL.replace(/--.*$/gm, '');
  assert.ok(!/\bupdate public\./i.test(sansCommentaires) && !/\bdelete from public\./i.test(sansCommentaires),
    'aucune ligne existante ne doit être modifiée pour satisfaire la nouvelle policy');
});

verifier('le contrôle final relit AUSSI les policies du lot précédent', () => {
  // Si l'une des trois faces fermées au lot précédent était perdue, cette
  // migration doit s'arrêter — une garde ne vaut que si elle vérifie
  // l'ensemble, pas seulement ce qu'elle vient d'écrire.
  for (const p of ['manager_update_advisor_rules', 'manager_delete_advisor_rules',
                   'employee_own_snapshot_update']) {
    assert.ok(SQL.includes(p), `${p} doit figurer dans le contrôle fail-closed`);
  }
  assert.ok(/raise exception 'INSERT-SITE-GUARD interrompu/.test(SQL));
});

verifier('ADR-0001 est acceptée et recense ses occurrences', () => {
  const adr = fs.readFileSync(path.join(RACINE, 'docs', 'adr',
    '0001-portee-site-des-mutations.md'), 'utf8');
  assert.ok(/\*\*État\*\* : \*\*ACCEPTÉE\*\*/.test(adr), 'l’ADR doit être acceptée');
  for (const occ of ['mission_progress', 'advisor_rules', 'apprentissage_snapshots']) {
    assert.ok(adr.includes(occ), `l’ADR doit référencer ${occ}`);
  }
  assert.ok(/règle écrite, pas une garantie/.test(adr),
    'l’ADR doit dire qu’elle ne ferme pas le risque de régression tant que la garde statique n’existe pas');
});

console.log(`\n${passes} vérifications passées — créer n’est plus plus permissif qu’administrer.`);
