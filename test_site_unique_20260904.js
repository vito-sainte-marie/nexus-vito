// NEXUS — A2 : une ligne, un site (04/09/2026).
//
// Découverte pendant la recette NAVIGATEUR, après trois passes de contrôles
// SQL qui ne l'avaient pas vue — elles portaient sur des tables à colonne de
// site unique. L'écran de Prise de poste écrivait `shifts.site` ;
// `shifts.site_id`, jamais renseigné, prenait son DÉFAUT : l'identifiant du
// site de PRODUCTION. Et la politique d'insertion ne vérifiait aucun des deux.
//
// La preuve contre une vraie base est dans `outils/verifier-site-unique.sql`,
// hors de cette suite qui n'ouvre aucune connexion réseau. Ici on garde ce qui
// se vérifie sans base : que le correctif dit bien ce qu'il fait, et que
// l'application n'a pas de moyen d'y échapper.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const RACINE = __dirname;
let ok = 0;
function verifier(libelle, condition) {
  console.log(`${condition ? 'OK  ' : 'ÉCHEC'} — ${libelle}`);
  assert.ok(condition, libelle);
  ok++;
}

const migrations = fs.readdirSync(path.join(RACINE, 'supabase', 'migrations'));
const fichier = migrations.find(m => m.includes('site_unique_shifts_mission_catalog'));
verifier('migration présente', !!fichier);
const M = fs.readFileSync(path.join(RACINE, 'supabase', 'migrations', fichier), 'utf8');

// ── Les trois verrous, chacun suffisant seul ────────────────────────────
for (const table of ['shifts', 'mission_catalog']) {
  verifier(`${table} : contrainte site = site_id`,
    new RegExp(`add constraint ${table}_site_unique check \\(site = site_id\\)`).test(M));
  verifier(`${table} : le défaut de production est retiré sur les deux colonnes`,
    new RegExp(`alter table public\\.${table}\\s+alter column site\\s+drop default`).test(M) &&
    new RegExp(`alter table public\\.${table}\\s+alter column site_id drop default`).test(M));
  verifier(`${table} : déclencheur posé avant insert ET update`,
    new RegExp(`create trigger ${table}_site_unique\\s+before insert or update on public\\.${table}`).test(M));
}

verifier('le site vient du compte, pas de la charge utile',
  /v_reference := public\.current_employee_site_id\(\)/.test(M));
verifier('une valeur divergente fournie par le client est refusée, pas réécrite',
  /is distinct from v_reference/.test(M) && /Écriture refusée : site/.test(M));
verifier('la RLS d’insertion vérifie enfin le site',
  /create policy employee_own_shifts_insert[\s\S]*site_id = \(select public\.current_employee_site_id\(\)\)/.test(M));
verifier('la RLS d’insertion vérifie aussi l’égalité des deux colonnes',
  /create policy employee_own_shifts_insert[\s\S]*and site = site_id/.test(M));
verifier('la RLS d’insertion conserve les contrôles d’origine (employé et rôle)',
  /employee_id = \(select auth\.uid\(\)\)/.test(M) && /current_employee_role\(\)/.test(M));
verifier('les lignes déjà incohérentes sont réparées avant la contrainte',
  M.indexOf('update public.shifts') < M.indexOf('add constraint shifts_site_unique') &&
  M.indexOf('update public.mission_catalog') < M.indexOf('add constraint mission_catalog_site_unique'));
verifier('la migration ne supprime pas la colonne `site` (le code déployé l’écrit encore)',
  !/drop column site/i.test(M));

// ── Le test de régression rejouable existe et couvre ce qui compte ──────
const T = fs.readFileSync(path.join(RACINE, 'outils', 'verifier-site-unique.sql'), 'utf8');
verifier('test rejouable présent', T.length > 0);
verifier('le test refuse de s’exécuter sur une base ressemblant à la production',
  /REFUS : des employés sont rattachés/.test(T));
verifier('le test se termine par un rollback', /\nrollback;/.test(T));
verifier('le test couvre un employé non-manager',
  /CAISSIER_A/.test(T) && /caissiere/.test(T));
verifier('le test couvre la lecture manager', /le manager ne voit pas le service de son équipe/.test(T));
verifier('le test couvre l’isolation croisée A ↔ B', /le caissier B voit le service du caissier A/.test(T));
verifier('le test couvre la réinitialisation de scénario',
  /la réinitialisation ne supprimerait pas ce service/.test(T));

// ── L'écran : un seul INSERT, et il ne choisit plus le site tout seul ───
const PDP = fs.readFileSync(path.join(RACINE, 'NEXUS-Prise-De-Poste-v1.html'), 'utf8');
verifier('un seul INSERT sur shifts dans toute l’application',
  fs.readdirSync(RACINE)
    .filter(f => (f.endsWith('.html') || f.endsWith('.js')) && !f.startsWith('test_'))
    .reduce((n, f) => n + (fs.readFileSync(path.join(RACINE, f), 'utf8')
      .match(/from\('shifts'\)[\s\S]{0,200}?\.insert\(/g) || []).length, 0) === 1);
verifier('cet INSERT reste inchangé — le correctif est en base, pas dans l’écran',
  /from\('shifts'\)\.insert\(\{[\s\S]*?site: employeeCourant\.site_id/.test(PDP));

console.log(`\n${ok} vérifications passées.`);
