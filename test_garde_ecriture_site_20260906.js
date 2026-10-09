// 2B-SECURITY-WRITE-GUARD — l'écriture ne peut plus viser un autre site.
//
// La Phase 2A a prouvé, sous identité employé réelle, qu'un pompiste pouvait
// écrire un pointage sur n'importe quel site qu'il nommait : la policy ne
// contrôlait que `employee_id`. Corriger le client n'aurait rien fermé — un
// appel direct à l'API aurait continué de choisir son site.
//
// Ce test garde les propriétés structurelles de la correction. Le
// comportement, lui, est prouvé en base réelle et consigné dans la fiche du
// sous-lot, la suite tournant sans réseau.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const RACINE = __dirname;
const SQL = fs.readFileSync(path.join(RACINE, 'supabase', 'migrations',
  '20260906020000_garde_ecriture_site.sql'), 'utf8');

function policy(nom) {
  const i = SQL.indexOf(`create policy ${nom} on`);
  assert.ok(i !== -1, `policy ${nom} introuvable`);
  const j = SQL.indexOf('comment on policy', i);
  return SQL.slice(i, j === -1 ? SQL.length : j);
}

let passes = 0;
function verifier(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

verifier('les trois tables sont couvertes à l’insertion', () => {
  for (const p of ['insert_own_pointage', 'employee_own_completions_insert', 'employee_own_progress_upsert']) {
    assert.ok(/current_employee_site_id/.test(policy(p)), `${p} doit contrôler le site`);
    assert.ok(/auth\.uid\(\)/.test(policy(p)), `${p} doit continuer de contrôler l’auteur`);
  }
});

verifier('les trois contrats ne sont PAS identiques', () => {
  // La condition majeure de l'arbitrage : l'isolation correcte, pas
  // l'uniformité syntaxique. Si les trois policies devenaient identiques,
  // c'est que le contrat propre à mission_progress aurait été perdu.
  const prog = policy('employee_own_progress_upsert');
  const point = policy('insert_own_pointage');
  assert.ok(/exists \(\s*select 1 from public\.shifts/.test(prog),
    'mission_progress porte un shift_id NOT NULL : sa progression doit être cohérente avec le service');
  assert.ok(!/exists \(/.test(point),
    'pointages n’a pas de service à recouper — lui imposer la même règle serait copier sans comprendre');
});

verifier('la progression doit être cohérente avec SON service', () => {
  const prog = policy('employee_own_progress_upsert');
  assert.ok(/s\.employee_id = mission_progress\.employee_id/.test(prog), 'même employé que le service');
  assert.ok(/s\.site_id = mission_progress\.site_id/.test(prog), 'même site que le service');
});

verifier('la mise à jour de progression ne peut pas déplacer la ligne', () => {
  // Elle n'avait aucun `with check` : une ligne pouvait changer de site après
  // coup, ce qu'aucune policy d'insertion n'aurait rattrapé.
  const maj = policy('employee_own_progress_update');
  assert.ok(/with check/.test(maj), 'l’UPDATE doit porter une condition d’arrivée');
  assert.ok(/current_employee_site_id/.test(maj));
});

verifier('aucune branche d’écriture n’est ouverte au créateur', () => {
  // Sa capacité transverse est une capacité de LECTURE. L'étendre à
  // l'écriture serait une extension de privilège que rien ne demande.
  assert.ok(!/je_suis_createur/.test(SQL),
    'la migration ne doit pas introduire de branche créateur en écriture');
});

verifier('aucun défaut de colonne n’est retiré', () => {
  assert.ok(!/drop default|alter column .* drop/i.test(SQL),
    'le retrait des defaults n’est pas autorisé dans ce sous-lot');
});

verifier('aucune policy n’est affaiblie', () => {
  // Chaque `drop policy` est immédiatement suivi de sa recréation : le
  // registre ne doit jamais rester avec une table sans politique.
  const drops = [...SQL.matchAll(/drop policy if exists (\w+) on ([\w.]+);/g)].map(m => m[1]);
  const creates = [...SQL.matchAll(/create policy (\w+) on/g)].map(m => m[1]);
  assert.deepStrictEqual(drops.sort(), creates.sort(),
    'toute policy retirée doit être recréée dans la même migration');
});

verifier('la migration s’arrête si une policy perd son contrôle de site', () => {
  assert.ok(/raise exception '2B-SECURITY-WRITE-GUARD interrompu/.test(SQL),
    'un contrôle fail-closed doit clore la migration');
  assert.ok(/not like '%current_employee_site_id%'/.test(SQL),
    'le contrôle doit vérifier la présence effective du contrôle de site');
});

verifier('les écritures de classe E déclarent leur site', () => {
  const missions = fs.readFileSync(path.join(RACINE, 'NEXUS-Missions-v1.html'), 'utf8');
  const i = missions.indexOf("from('mission_completions')\n      .insert({");
  assert.ok(i !== -1, 'insertion de complétion introuvable');
  assert.ok(/site_id: SITE_ACTUEL/.test(missions.slice(i, i + 500)),
    'la complétion doit dire son site plutôt que le laisser au défaut');

  const debug = fs.readFileSync(path.join(RACINE, 'NEXUS-Debug-v1.html'), 'utf8');
  assert.ok(/site: p\.site \|\| SITE_ACTUEL/.test(debug),
    'la migration de pointages doit rattacher chaque ligne à un site connu');
});

console.log(`\n${passes} vérifications passées — une écriture ne peut plus choisir son site.`);
