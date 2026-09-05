// A3-3 — ce que la migration doit garantir, vérifiable sans réseau.
//
// La preuve de COMPORTEMENT (fuseau invalide refusé, site sans fuseau
// impossible, fonction planifiée à l'heure de chaque site) s'exécute contre
// la base : outils/verifier-fuseau-par-site.sql. Ce test-ci garde les
// propriétés STRUCTURELLES, celles qu'une relecture pressée laisserait
// filer — et surtout celles qui protègent l'histoire des migrations.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const RACINE = __dirname;
const SQL = fs.readFileSync(path.join(RACINE, 'supabase/migrations/20260905131500_fuseau_horaire_par_site.sql'), 'utf8');
const ANCIENNE = 'supabase/migrations/20260803021549_planification_synthese_inventaire.sql';

let passes = 0;
function verifier(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

verifier('la proposition ne vit pas dans supabase/migrations', () => {
  const intruses = fs.readdirSync(path.join(RACINE, 'supabase/migrations'))
    // Motif serré : « final » apparaît légitimement dans des noms de
    // migration réels (…_nettoyage_final_photo_…). On ne cible que les
    // marqueurs de brouillon.
    .filter(f => /^PROPOSITION|-FINAL\.sql$|_proposition/i.test(f));
  assert.deepStrictEqual(intruses, [],
    'un fichier de proposition ne doit jamais côtoyer les migrations réelles');
});

verifier('l’ancienne migration porte toujours son fuseau en dur — elle n’a pas été réécrite', () => {
  const ancien = fs.readFileSync(path.join(RACINE, ANCIENNE), 'utf8');
  assert.ok(/at time zone 'America\/Martinique'/.test(ancien),
    'la migration appliquée a été modifiée : interdit (règle A12)');
});

verifier('la nouvelle redéfinit la fonction sans toucher l’ancienne', () => {
  assert.ok(/create or replace function public\.run_scheduled_inventory_reviews\(\)/.test(SQL));
  assert.ok(!/drop function .*run_scheduled_inventory_reviews/i.test(SQL),
    'la fonction ne doit pas être supprimée puis recréée');
  assert.ok(!/20260803021549/.test(SQL.replace(/^\s*--.*$/gm, '')),
    'aucune instruction ne doit viser l’ancienne migration');
});

verifier('le fuseau est lu par site, dans la boucle', () => {
  const corps = SQL.slice(SQL.indexOf('create or replace function public.run_scheduled_inventory_reviews'));
  const boucle = corps.indexOf('for r in select * from station_config loop');
  const lecture = corps.indexOf('select s.timezone into v_fuseau');
  const calcul = corps.indexOf('now() at time zone v_fuseau');
  assert.ok(boucle !== -1 && lecture !== -1 && calcul !== -1, 'éléments manquants');
  assert.ok(boucle < lecture && lecture < calcul,
    'le fuseau doit être lu APRÈS l’entrée dans la boucle et AVANT le calcul de l’heure');
  assert.ok(!/at time zone 'America\/Martinique'/.test(corps),
    'plus aucun fuseau en dur dans le corps de la fonction');
});

verifier('un site sans fuseau est sauté, jamais traité à l’heure d’un autre', () => {
  const corps = SQL.slice(SQL.indexOf('create or replace function public.run_scheduled_inventory_reviews'));
  assert.ok(/if v_fuseau is null then[\s\S]{0,400}?raise warning[\s\S]{0,300}?continue;/.test(corps),
    'l’absence de fuseau doit provoquer un avertissement puis un saut du site');
});

verifier('la validation IANA est un trigger, pas un CHECK', () => {
  assert.ok(/create or replace function public\.nexus_valider_fuseau_site/.test(SQL));
  assert.ok(/pg_timezone_names/.test(SQL), 'la validation doit s’appuyer sur pg_timezone_names');
  assert.ok(/create trigger nexus_valider_fuseau_site[\s\S]{0,200}?before insert or update of timezone/.test(SQL));
  assert.ok(!/check\s*\([^)]*pg_timezone_names/i.test(SQL),
    'un CHECK ne peut pas interroger une table : ce serait un piège à la relecture');
});

verifier('la migration échoue si un site reste sans fuseau', () => {
  assert.ok(/from public\.sites where timezone is null/.test(SQL));
  assert.ok(/raise exception 'A3-3 :[\s\S]{0,200}?aucune valeur ne sera devinée/.test(SQL),
    'le contrôle final doit nommer les sites manquants et interrompre');
  const controle = SQL.indexOf('aucune valeur ne sera devinée');
  const notNull = SQL.indexOf('alter column timezone set not null');
  assert.ok(controle !== -1 && notNull !== -1 && controle < notNull,
    'le contrôle fail-closed doit précéder le passage en NOT NULL');
});

verifier('aucune valeur par défaut n’est posée sur sites.timezone', () => {
  assert.ok(!/timezone[^;]*default/i.test(SQL.replace(/^\s*--.*$/gm, '')),
    'un défaut sur timezone rétablirait exactement le défaut corrigé');
  assert.ok(/alter table public\.station_config alter column fuseau_horaire drop default/.test(SQL),
    'C1-S2 : le défaut du schéma doit disparaître');
});

verifier('A3-3 ne touche ni aux horaires ni aux cuves', () => {
  const nu = SQL.replace(/^\s*--.*$/gm, '');
  assert.ok(!/alter[^;]*horaires/i.test(nu), 'les horaires appartiennent à A3-5');
  assert.ok(!/alter[^;]*cuves_carburants/i.test(nu), 'les cuves appartiennent à A3-5');
});

verifier('la reprise depuis station_config ne recopie qu’un fuseau IANA réel', () => {
  assert.ok(/update public\.sites s[\s\S]{0,400}?from public\.station_config c[\s\S]{0,400}?exists \(select 1 from pg_timezone_names/.test(SQL),
    'une valeur héritée non valide serait recopiée telle quelle sans ce garde-fou');
});

verifier('chaque site de nexus-test reçoit une décision nommée', () => {
  for (const site of ['vito-sainte-marie', 'nexus-station-test', 'site-fantome-test']) {
    const motif = new RegExp("update public\\.sites set timezone = '[A-Za-z_]+/[A-Za-z_]+'\\s*\\n\\s*where site_id = '" + site + "' and timezone is null;");
    assert.ok(motif.test(SQL), 'décision explicite manquante pour ' + site);
  }
});

verifier('la transaction est explicite', () => {
  assert.ok(/^begin;/m.test(SQL) && /^commit;/m.test(SQL),
    'une migration qui pose NOT NULL doit être tout ou rien');
});

console.log(`\n${passes} vérifications passées — A3-3 tient structurellement.`);
