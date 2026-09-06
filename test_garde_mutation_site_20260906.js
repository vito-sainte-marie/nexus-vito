// MUTATION-SITE-GUARD — une ligne créée ne change plus de commerce.
//
// La matrice UPDATE a prouvé deux chemins ouverts : un manager déplaçait une
// règle Advisor vers un autre site, un employé ordinaire déplaçait son propre
// instantané. Troisième occurrence d'un même motif, après `mission_progress` :
// on contrôle l'auteur et on oublie le lieu.
//
// Ce test garde les propriétés structurelles. Le comportement est prouvé en
// base réelle et consigné dans la fiche du sous-lot.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const RACINE = __dirname;
const SQL = fs.readFileSync(path.join(RACINE, 'supabase', 'migrations',
  '20260906040000_garde_mutation_site.sql'), 'utf8');

function policy(nom) {
  const i = SQL.indexOf(`create policy ${nom} on`);
  assert.ok(i !== -1, `policy ${nom} introuvable`);
  const j = SQL.indexOf('comment on policy', i);
  return SQL.slice(i, j === -1 ? SQL.length : j);
}

let passes = 0;
function verifier(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

verifier('les trois mutations contrôlent le site', () => {
  for (const p of ['manager_update_advisor_rules', 'manager_delete_advisor_rules',
                   'employee_own_snapshot_update']) {
    assert.ok(/current_employee_site_id/.test(policy(p)), `${p} doit contrôler le site`);
  }
});

verifier('le contrôle de rôle existant est conservé', () => {
  // La consigne était de fermer la mutation inter-site « en conservant le
  // contrôle de rôle » : ajouter le site ne doit pas retirer le rôle.
  for (const p of ['manager_update_advisor_rules', 'manager_delete_advisor_rules']) {
    assert.ok(/current_employee_role\(\)\) = any \(array\['manager','gerant'\]\)/.test(policy(p)),
      `${p} doit continuer d’exiger manager ou gérant`);
  }
  assert.ok(/auth\.uid\(\)/.test(policy('employee_own_snapshot_update')),
    'le snapshot doit continuer d’exiger l’auteur');
});

verifier('le with check est écrit, pas laissé au repli sur using', () => {
  // PostgreSQL applique bien `using` à la nouvelle ligne quand `with check`
  // est absent — mais s'appuyer sur ce repli est ce qui a rendu la faiblesse
  // invisible à la relecture.
  for (const p of ['manager_update_advisor_rules', 'employee_own_snapshot_update']) {
    assert.ok(/with check/.test(policy(p)), `${p} doit écrire son with check`);
  }
});

verifier('la portée d’une règle Advisor est immuable', () => {
  assert.ok(/new\.site_id is distinct from old\.site_id/.test(SQL),
    'le trigger doit comparer l’ancienne et la nouvelle portée');
  assert.ok(/create trigger nexus_portee_advisor_immuable\s+before update of site_id/.test(SQL),
    'le trigger doit être BEFORE UPDATE OF site_id');
  assert.ok(/globale/.test(SQL), 'le message doit nommer la portée globale');
});

verifier('une règle globale sort du périmètre du manager sans clause spéciale', () => {
  // `site_id = current_employee_site_id()` est faux quand site_id est null :
  // aucune clause supplémentaire n'est nécessaire, et surtout aucun `null`
  // ne peut être confondu avec « autorisé ».
  const p = policy('manager_update_advisor_rules');
  assert.ok(!/is null/.test(p),
    'aucune clause ne doit rattraper le null : la comparaison le fait déjà, fail-closed');
});

verifier('aucune policy INSERT n’est touchée', () => {
  // Elles présentent la même faiblesse, mais sont hors du périmètre autorisé :
  // signalées au Handoff, pas corrigées ici.
  assert.ok(!/for insert/.test(SQL), 'ce lot ne modifie aucune policy d’insertion');
});

verifier('aucune donnée n’est réattribuée', () => {
  assert.ok(!/^\s*update public\.advisor_rules set/mi.test(SQL.replace(/--.*$/gm, '')),
    'aucune ligne existante ne doit être déplacée pour satisfaire la nouvelle policy');
});

verifier('la migration s’arrête si une garde manque', () => {
  assert.ok(/raise exception 'MUTATION-SITE-GUARD interrompu/.test(SQL));
  assert.ok(/trigger de portée absent/.test(SQL),
    'le contrôle doit vérifier aussi la présence du trigger');
});

console.log(`\n${passes} vérifications passées — une ligne créée ne change plus de commerce.`);
