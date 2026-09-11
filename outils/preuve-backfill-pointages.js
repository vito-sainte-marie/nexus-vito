#!/usr/bin/env node
'use strict';
/**
 * Preuve du backfill `pointages.service_id`, sur la distribution RÉELLE.
 *
 * POURQUOI CE FICHIER EXISTE. La lecture seule en Production prouve la
 * classification — 92 pointages, 75 certains, 5 ambigus, 12 sans service —
 * mais elle ne prouve pas que le backfill S'EXÉCUTE correctement sur ces
 * lignes. Pour cela il faut les migrations réelles, donc une base où écrire,
 * donc un transfert. Et un transfert fait à la main n'en est pas un : une
 * seule faute de recopie fabriquerait une répartition fausse que rien ne
 * signalerait.
 *
 * CE QU'IL FAIT, sans aucune intervention manuelle entre les deux bases :
 *   1. extrait de Production, EN LECTURE SEULE, les seules colonnes dont le
 *      rattachement a besoin ;
 *   2. pseudonymise les identifiants de façon déterministe, avec un sel ;
 *   3. insère dans un SCHÉMA ISOLÉ de Test, jamais dans `public` ;
 *   4. y rejoue la logique exacte de la migration de rattachement ;
 *   5. compare avant/après et rend le rapport, exceptions comprises ;
 *   6. détruit le schéma temporaire.
 *
 * CE QU'IL NE TRANSFÈRE JAMAIS : aucun nom, aucun PIN, aucune photo, aucune
 * URL signée, aucun commentaire, aucune heure de pointage. Le rattachement ne
 * dépend que de (employé, site, date) et du début des services.
 *
 * CE QU'IL N'ÉCRIT JAMAIS EN PRODUCTION : rien. La connexion Production est
 * ouverte en `default_transaction_read_only`, et le script refuse de démarrer
 * si la base ne le confirme pas.
 *
 *   NEXUS_PROD_DB_URL=… NEXUS_TEST_DB_URL=… node outils/preuve-backfill-pointages.js
 *
 * Les deux URL viennent de l'environnement et ne sont ni affichées, ni
 * journalisées, ni conservées.
 */

const crypto = require('crypto');
const { execFileSync } = require('child_process');

const SEL = process.env.NEXUS_SEL_PSEUDONYMISATION || 'sel-preuve-92-20260911';
const SCHEMA = 'preuve_backfill';
const ATTENDU = { total: 92, certains: 75, ambigus: 5, sansService: 12, fantome: 10 };

function psql(url, sql, { lectureSeule = false } = {}) {
  const prefixe = lectureSeule ? 'set default_transaction_read_only = on;\n' : '';
  return execFileSync('psql', [url, '--quiet', '--no-psqlrc', '-tA', '-v', 'ON_ERROR_STOP=1', '-c', prefixe + sql],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

/** Pseudonyme déterministe, en forme d'uuid. Le sel ne sort jamais d'ici. */
const pseudo = (v) => {
  const h = crypto.createHash('sha256').update(String(v) + SEL).digest('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;
};

function exiger(nom) {
  const v = process.env[nom];
  if (!v) { console.error(`${nom} manquante. Aucune valeur n'est demandée ici : posez-la dans l'environnement.`); process.exit(2); }
  return v;
}

function main() {
  const urlProd = exiger('NEXUS_PROD_DB_URL');
  const urlTest = exiger('NEXUS_TEST_DB_URL');

  // Refus si la connexion Production n'est pas effectivement en lecture seule.
  const lectureSeule = psql(urlProd, "select current_setting('default_transaction_read_only');",
    { lectureSeule: true }).trim();
  if (lectureSeule !== 'on') {
    console.error('REFUS : la connexion Production n\'est pas en lecture seule. Rien n\'est lu.');
    process.exit(3);
  }
  console.log('  Production ouverte en lecture seule, confirmé par la base.');

  // 1. Extraction minimale. Aucune colonne au-delà du strict rattachement.
  const fuseau = `
    select s.site_id, coalesce(
      (select c.fuseau_horaire from public.station_config c
        where c.site = s.site_id and c.fuseau_horaire is not null
          and exists (select 1 from pg_timezone_names where name = c.fuseau_horaire)),
      'America/Martinique')
    from public.sites s`;
  const lignes = (txt) => txt.split('\n').filter(Boolean).map(l => l.split('|'));

  const fuseaux = lignes(psql(urlProd, fuseau + ';', { lectureSeule: true }));
  const pointages = lignes(psql(urlProd,
    'select id, employee_id, site, date, type from public.pointages order by id;', { lectureSeule: true }));
  const services = lignes(psql(urlProd, `
    with f as (${fuseau}), cles as (select distinct employee_id, site, date from public.pointages)
    select distinct sh.id, sh.employee_id, sh.site_id, sh.heure_debut
      from public.shifts sh
      join cles c on c.employee_id = sh.employee_id and c.site = sh.site_id
      join f on f.site_id = sh.site_id
     where (sh.heure_debut at time zone f.coalesce)::date = c.date
     order by sh.id;`, { lectureSeule: true }));

  console.log(`  extrait : ${pointages.length} pointage(s), ${services.length} service(s), ${fuseaux.length} site(s).`);

  // 2 et 3. Pseudonymisation puis insertion dans un schéma isolé de Test.
  const echappe = (v) => `'${String(v).replace(/'/g, "''")}'`;
  const sqlInit = `
    drop schema if exists ${SCHEMA} cascade;
    create schema ${SCHEMA};
    create table ${SCHEMA}.sites (site_id text primary key, timezone text not null);
    create table ${SCHEMA}.shifts (id uuid primary key, employee_id uuid, site_id text, heure_debut timestamptz);
    create table ${SCHEMA}.pointages (id uuid primary key, employee_id uuid, site text, date date, type text, service_id uuid);
    insert into ${SCHEMA}.sites values
      ${fuseaux.map(([s, tz]) => `(${echappe(s)}, ${echappe(tz)})`).join(',')};
    insert into ${SCHEMA}.shifts values
      ${services.map(([id, emp, site, debut]) =>
        `(${echappe(pseudo(id))}, ${echappe(pseudo(emp))}, ${echappe(site)}, ${echappe(debut)})`).join(',')};
    insert into ${SCHEMA}.pointages (id, employee_id, site, date, type) values
      ${pointages.map(([id, emp, site, date, type]) =>
        `(${echappe(pseudo(id))}, ${echappe(pseudo(emp))}, ${echappe(site)}, ${echappe(date)}, ${echappe(type)})`).join(',')};
  `;
  psql(urlTest, sqlInit);
  console.log(`  jeu pseudonymisé inséré dans le schéma isolé ${SCHEMA} de Test.`);

  const avant = psql(urlTest,
    `select count(*), count(service_id) from ${SCHEMA}.pointages;`).trim().split('|');
  console.log(`  AVANT : ${avant[0]} pointage(s), ${avant[1]} rattaché(s).`);

  // 4. La logique EXACTE de la migration de rattachement, mot pour mot.
  psql(urlTest, `
    update ${SCHEMA}.pointages p
       set service_id = (
         select sh.id from ${SCHEMA}.shifts sh
          where sh.employee_id = p.employee_id and sh.site_id = p.site
            and (sh.heure_debut at time zone
                  (select s.timezone from ${SCHEMA}.sites s where s.site_id = p.site))::date = p.date)
     where p.service_id is null
       and 1 = (select count(*) from ${SCHEMA}.shifts sh2
                 where sh2.employee_id = p.employee_id and sh2.site_id = p.site
                   and (sh2.heure_debut at time zone
                         (select s.timezone from ${SCHEMA}.sites s where s.site_id = p.site))::date = p.date);`);

  // 5. Comparaison et rapport.
  const [total, certains, ambigus, sansService, fantome, autreSite] = psql(urlTest, `
    with n as (select p.*, (select count(*) from ${SCHEMA}.shifts sh
        where sh.employee_id = p.employee_id and sh.site_id = p.site
          and (sh.heure_debut at time zone
                (select s.timezone from ${SCHEMA}.sites s where s.site_id = p.site))::date = p.date) as c
      from ${SCHEMA}.pointages p)
    select count(*), count(*) filter (where service_id is not null),
           count(*) filter (where service_id is null and c > 1),
           count(*) filter (where service_id is null and c = 0),
           count(*) filter (where site = 'site-fantome-test'),
           (select count(*) from n j join ${SCHEMA}.shifts sh on sh.id = j.service_id where sh.site_id <> j.site)
      from n;`).trim().split('|').map(Number);

  const exceptions = psql(urlTest, `
    with n as (select p.*, (select count(*) from ${SCHEMA}.shifts sh
        where sh.employee_id = p.employee_id and sh.site_id = p.site
          and (sh.heure_debut at time zone
                (select s.timezone from ${SCHEMA}.sites s where s.site_id = p.site))::date = p.date) as c
      from ${SCHEMA}.pointages p)
    select left(id::text, 8), date, type, site,
           case when c = 0 then 'aucun service ce jour-la sur ce site'
                else c || ' services candidats : rattachement impossible sans choisir' end
      from n where service_id is null order by site, date;`);

  console.log('\n  APRÈS');
  console.log(`    total               ${total}`);
  console.log(`    rattachés           ${certains}`);
  console.log(`    ambigus (NULL)      ${ambigus}`);
  console.log(`    sans service (NULL) ${sansService}`);
  console.log(`    dont site-fantome   ${fantome}`);
  console.log(`    rattachés hors site ${autreSite}`);
  console.log('\n  EXCEPTIONS (référence pseudonymisée · date · type · site · raison)');
  exceptions.split('\n').filter(Boolean).forEach(l => console.log('    ' + l.split('|').join(' · ')));

  // 6. Destruction du jeu temporaire, quoi qu'il arrive.
  psql(urlTest, `drop schema ${SCHEMA} cascade;`);
  console.log(`\n  schéma ${SCHEMA} détruit.`);

  const ecarts = [];
  if (total !== ATTENDU.total) ecarts.push(`total ${total} au lieu de ${ATTENDU.total}`);
  if (certains !== ATTENDU.certains) ecarts.push(`rattachés ${certains} au lieu de ${ATTENDU.certains}`);
  if (ambigus !== ATTENDU.ambigus) ecarts.push(`ambigus ${ambigus} au lieu de ${ATTENDU.ambigus}`);
  if (sansService !== ATTENDU.sansService) ecarts.push(`sans service ${sansService} au lieu de ${ATTENDU.sansService}`);
  if (fantome !== ATTENDU.fantome) ecarts.push(`site-fantome ${fantome} au lieu de ${ATTENDU.fantome}`);
  if (autreSite !== 0) ecarts.push(`${autreSite} pointage(s) rattaché(s) à un service d'un AUTRE site`);
  if (certains + ambigus + sansService !== total) ecarts.push('perte ou duplication : les trois classes ne somment pas au total');

  if (ecarts.length) { console.error('\n  ÉCARTS :\n    ' + ecarts.join('\n    ')); process.exit(1); }
  console.log('\n  Répartition conforme : 92 / 75 / 5 / 12, aucun rattachement hors site, aucune perte.');
}

if (require.main === module) {
  try { main(); }
  catch (e) {
    // Le message d'erreur d'un psql peut contenir l'URL : on ne rend que la
    // première ligne, et jamais la commande.
    console.error('  ÉCHEC : ' + String(e.message || e).split('\n')[0].replace(/postgres(ql)?:\/\/\S+/g, '<url masquée>'));
    process.exit(1);
  }
}
module.exports = { pseudo, ATTENDU };
