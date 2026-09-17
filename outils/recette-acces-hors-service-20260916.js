// RECETTE — accès d'un employé HORS SERVICE à ses données personnelles.
//
// Mission du 16/09/2026 : « Un employé authentifié doit pouvoir, même hors
// service, ouvrir son espace personnel et consulter ses écarts validés. Cette
// consultation ne doit créer automatiquement aucun service, aucun shift et
// aucun pointage. » Et : « Avant validation, la seule information autorisée
// est : "Contrôle de votre caisse en cours." Cette règle doit être appliquée
// dans la source Supabase, pas seulement masquée dans l'interface. »
//
// CE QUE CETTE RECETTE JOUE. Les DEUX migrations, dans l'ordre exact où la
// Production devra les recevoir :
//   1. 20260914210000_mes_ecarts_caisse_projection_employe.sql
//   2. 20260916210000_mes_ecarts_caisse_masque_le_provisoire.sql
// Elles sont LUES SUR DISQUE et insérées telles quelles : une recette qui
// recopierait le SQL prouverait sa copie, pas la migration.
//
// CE QU'ELLE MESURE, ET OÙ. Chaque corps est `json_agg(t)::text` capturé sous
// `set local role authenticated` et `set local request.jwt.claims` : c'est le
// corps que PostgREST sérialise pour la requête HTTP, produit par le même
// rôle et la même identité. Ce qui n'y figure pas ne peut pas partir sur le
// réseau — c'est la vérification n° 12 de la recette.
//
// CE QU'ELLE NE MESURE PAS. La couche HTTP elle-même : pas d'en-têtes, pas de
// JWT signé. Obtenir un JWT réel exige un mot de passe, et les mots de passe
// sont saisis par Frédéric, jamais par moi. Le cas 14 (navigation mobile) est
// un cas d'écran : il est couvert par le volet front de la recette, pas ici.
//
// LES 15 CAS DE LA MISSION, ET OÙ ILS SONT CONTRÔLÉS :
//    1 employé authentifié sans service actif ............ contrôles 1, 2
//    2 employé authentifié avec service actif ............ contrôle 4
//    3 dernier service datant de la veille ............... contrôle 3
//    4 employé sans aucun service ........................ contrôles 1, 2
//    5 écart validé ...................................... contrôle 7
//    6 contrôle encore provisoire ........................ contrôles 8, 9
//    7 quart tenu seul ................................... contrôle 10
//    8 quart partagé ..................................... contrôle 11
//    9 tentative de consulter un autre employé ........... contrôles 14, 15, 16
//   10 appel sous rôle anon .............................. contrôle 17
//   11 manager consultant un employé ..................... contrôles 18, 19
//   12 vérification de la réponse réseau ................. contrôles 12, 13, 20
//   13 aucun service ni pointage créé ................... contrôle 5
//   14 navigation mobile ................................. volet front
//   15 reconnexion après expiration de session ........... contrôle 6
//
// CONTRE-ÉPREUVE (16/09/2026). Vingt-quatre contrôles verts ne valent que si
// l'on sait ce qui les ferait rougir. Deux mutations ont été jouées sur le SQL
// produit, sans jamais toucher ce fichier (empreinte identique avant/après) :
//
//   M1 — la migration de masquage est retirée du flux, la projection du 14/09
//        reste seule. ROUGE sur 08 (le poste non validé porte son montant),
//        09 (-33.33 dans le corps) et 12 (feuille interdite -33.33). C'est la
//        mesure de ce que la migration du 16/09 apporte, et rien d'autre.
//
//   M2 — un service ouvert est posé AVANT les consultations dites « hors
//        service ». ROUGE sur 01. Sans ce contrôle de décor, « Claire lit hors
//        service » aurait pu être vrai parce qu'un service traînait.
//
// USAGE : node outils/recette-acces-hors-service-20260916.js
//   imprime le SQL complet, à jouer sur le projet de TEST. Tout est dans une
//   transaction qui finit par ROLLBACK : ni le décor, ni les fonctions, ni
//   les politiques, ni les services fabriqués ne survivent.
'use strict';
const fs = require('fs');
const path = require('path');

const MIG = path.join(__dirname, '..', 'supabase', 'migrations');
const PROJECTION = '20260914210000_mes_ecarts_caisse_projection_employe.sql';
const MASQUE     = '20260916210000_mes_ecarts_caisse_masque_le_provisoire.sql';
const lire = f => fs.readFileSync(path.join(MIG, f), 'utf8');

const CLAIRE  = '11111111-1111-4111-8111-111111111111';
const MALIK   = '22222222-2222-4222-8222-222222222222';
const CHEF    = '33333333-3333-4333-8333-333333333333';
const VANESSA = '44444444-4444-4444-8444-444444444444';
const R1 = 'aaaaaaaa-0000-4000-8000-000000000001';
const R2 = 'aaaaaaaa-0000-4000-8000-000000000002';
const R3 = 'aaaaaaaa-0000-4000-8000-000000000003';
const R4 = 'aaaaaaaa-0000-4000-8000-000000000004';
const S1 = 'bbbbbbbb-0000-4000-8000-000000000001';

// Les colonnes que la projection a le DROIT de révéler à Claire sur un poste
// VALIDÉ. Tout le reste de la ligne est réputé interdit. Cette liste est le
// contrat : l'allonger est une décision de confidentialité, et se lit comme
// telle dans un diff.
const AUTORISEES_VALIDE = ['id', 'site', 'date', 'quart', 'ecart_piste',
  'ecart_piste_valide', 'ecart_piste_origine', 'cause_code_piste',
  'valide_le_piste', 'valide_le'];

// Sur un poste NON VALIDÉ, le contrat se resserre de lui-même : le montant,
// son origine et sa cause ne sont plus des colonnes autorisées, ils sont des
// colonnes INTERDITES. C'est toute la migration du 16/09 tenue par une liste.
const AUTORISEES_PROVISOIRE = ['id', 'site', 'date', 'quart',
  'valide_le_piste', 'valide_le'];

const enListe = ids => ids.map(i => `'${i}'`).join(', ');

// Deux CTE jumelles : toutes les feuilles de la ligne brute privée des
// colonnes autorisées, et toutes les feuilles des colonnes autorisées.
// `$.**` descend dans les objets ET dans les tableaux : un UUID au fond d'un
// `employes_*` est une feuille comme une autre.
const feuilles = (nom, ids, cols) => `
${nom}_brutes as (
  select distinct trim(both '"' from v::text) as val
    from public.audits_caisse a,
         lateral jsonb_path_query(
           to_jsonb(a) ${cols.map(c => `- '${c}'`).join(' ')}, '$.**') v
   where a.id in (${enListe(ids)})
     and jsonb_typeof(v) not in ('object', 'array')
     and v::text <> 'null'
),
${nom}_autorisees as (
  select distinct trim(both '"' from v::text) as val
    from public.audits_caisse a,
         lateral jsonb_path_query(
           jsonb_build_object(${cols.map(c => `'${c}', to_jsonb(a) -> '${c}'`).join(', ')}),
           '$.**') v
   where a.id in (${enListe(ids)})
     and jsonb_typeof(v) not in ('object', 'array')
     and v::text <> 'null'
)`;

// Une consultation, telle que l'écran la fait : la projection, rien d'autre.
// L'ordre est imposé, sinon deux corps identiques pourraient différer par
// l'ordre des lignes et le contrôle d'égalité octet pour octet ne voudrait
// plus rien dire.
const consulter = (qui, uid, quoi) => `
set local request.jwt.claims = '{"sub":"${uid}","role":"authenticated"}';
set local role authenticated;
insert into _corps
select '${qui}', '${quoi}', coalesce(json_agg(t)::text, '[]')
  from (select * from public.mes_ecarts_caisse()
         order by date, poste) t;
reset role;`;

const sql = `
-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  RECETTE — accès hors service à ses données personnelles             ║
-- ║  Générée par outils/recette-acces-hors-service-20260916.js           ║
-- ║  À jouer sur le projet de TEST. Se termine par ROLLBACK.             ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Le décor, sur le site de recette, daté en janvier 2027 pour ne heurter
-- aucune ligne existante (unicité site+date+quart) :
--
--   R1  05/01  quart 1  Claire tient la piste, Malik la boutique — VALIDÉE
--                       écart piste -12,50 / boutique -480,00 / total -492,50
--                       validée par Chef, commentaires manager bruts
--   R2  06/01  quart 1  Malik seul sur la piste, -87,30 — VALIDÉE
--                       — Claire ne doit pas voir cette ligne du tout
--   R3  07/01  quart 2  Claire ET Malik sur LA MÊME piste, -5,00 — VALIDÉE
--                       — le vrai poste partagé
--   R4  09/01  quart 1  Claire seule sur la piste, -33,33 — NON VALIDÉE
--                       — le contrôle en cours : le montant n'existe pas
--                         encore pour elle, seule la phrase arbitrée existe
--   Vanessa             aucun audit : l'état vide explicite
--
--   S1                  le service de Claire, fabriqué APRÈS les mesures
--                       hors service, jamais avant.

begin;

create temporary table _corps (
  qui    text,
  quoi   text,
  corps  text
) on commit drop;
grant all on _corps to authenticated;
grant all on _corps to anon;

create temporary table _compteur (
  quand      text,
  n_shifts   bigint,
  n_pointages bigint
) on commit drop;

create temporary table _preuve (
  ordre    int,
  controle text,
  obtenu   text,
  verdict  text
) on commit drop;

insert into public.employees (id, username, nom, role, site_id, actif) values
  ('${CLAIRE}' ,'recette_claire' ,'Claire Recette' ,'caissier','nexus-station-test',true),
  ('${MALIK}'  ,'recette_malik'  ,'Malik Recette'  ,'caissier','nexus-station-test',true),
  ('${CHEF}'   ,'recette_chef'   ,'Chef Recette'   ,'manager' ,'nexus-station-test',true),
  ('${VANESSA}','recette_vanessa','Vanessa Recette','caissier','nexus-station-test',true);

insert into public.audits_caisse
  (id, site, date, quart,
   ecart_piste, ecart_boutique, ecart_total,
   ecart_piste_valide, ecart_boutique_valide,
   ecart_piste_origine, ecart_boutique_origine,
   cause_code_piste, cause_code_boutique,
   employes_piste, employes_boutique,
   employee_id, valide_par, valide_par_piste, valide_par_boutique,
   valide_le, valide_le_piste, valide_le_boutique,
   commentaire, commentaire_validation,
   commentaire_validation_piste, commentaire_validation_boutique,
   statut)
values
  ('${R1}','nexus-station-test','2027-01-05','1',
   -12.50, -480.00, -492.50,
   -10.25, -477.75,
   -12.50, -480.00,
   'ERREUR_RENDU','MANQUE_TICKET',
   '["${CLAIRE}"]'::jsonb, '["${MALIK}"]'::jsonb,
   '${MALIK}','${CHEF}','${CHEF}','${CHEF}',
   '2027-01-08 09:00:00+00','2027-01-08 09:01:00+00','2027-01-08 09:02:00+00',
   'note interne manager sur Malik',
   'commentaire manager brut du quart',
   'commentaire manager brut piste',
   'commentaire manager brut boutique',
   'anomalie'),
  ('${R2}','nexus-station-test','2027-01-06','1',
   -87.30, null, -87.30, null, null, -87.30, null,
   'ERREUR_RENDU', null,
   '["${MALIK}"]'::jsonb, '[]'::jsonb,
   '${MALIK}','${CHEF}','${CHEF}',null,
   '2027-01-08 10:00:00+00','2027-01-08 10:01:00+00',null,
   'note interne manager R2','commentaire manager brut R2',
   'commentaire manager brut piste R2',null,'anomalie'),
  ('${R3}','nexus-station-test','2027-01-07','2',
   -5.00, null, -5.00, null, null, -5.00, null,
   null, null,
   '["${CLAIRE}","${MALIK}"]'::jsonb, '[]'::jsonb,
   '${CHEF}','${CHEF}','${CHEF}',null,
   '2027-01-08 11:00:00+00','2027-01-08 11:01:00+00',null,
   'note interne manager R3','commentaire manager brut R3',
   'commentaire manager brut piste R3',null,'anomalie'),
  -- R4 — LE CAS 6. Le contrôle n'est pas fini : valide_le, valide_le_piste et
  -- valide_le_boutique sont TOUS les trois nuls. Le montant existe en base —
  -- il faut bien que le manager travaille dessus — mais il n'est pas encore
  -- un résultat. Les jetons sont volontairement reconnaissables : s'ils
  -- sortent, la recette les nomme.
  ('${R4}','nexus-station-test','2027-01-09','1',
   -33.33, null, -33.33, null, null, -33.33, null,
   'ECART_PROVISOIRE_SECRET', null,
   '["${CLAIRE}"]'::jsonb, '[]'::jsonb,
   '${CLAIRE}', null, null, null,
   null, null, null,
   'note interne manager R4','commentaire manager brut R4',
   'commentaire manager brut piste R4', null, 'anomalie');

-- ══════════════════════════════════════════════════════════════════════════
-- Étape 1 — les DEUX migrations, dans l'ordre de la Production.
-- Elles sont lues sur disque et jouées telles quelles. La première pose la
-- projection et referme la RLS d'audits_caisse ; la seconde masque tout ce
-- qui n'est pas encore validé.
-- ══════════════════════════════════════════════════════════════════════════

${lire(PROJECTION)}

${lire(MASQUE)}

-- ══════════════════════════════════════════════════════════════════════════
-- Étape 2 — LES CONSULTATIONS HORS SERVICE.
--
-- À cet instant, la table shifts ne contient AUCUN service pour personne :
-- c'est la situation d'un employé qui se connecte le matin, ou le dimanche,
-- ou trois semaines après son dernier poste. Le compteur est relevé avant et
-- après : consulter ne doit rien écrire.
-- ══════════════════════════════════════════════════════════════════════════

insert into _compteur
select 'avant les consultations',
       (select count(*) from public.shifts
         where employee_id in ('${CLAIRE}','${MALIK}','${CHEF}','${VANESSA}')),
       (select count(*) from public.pointages
         where employee_id in ('${CLAIRE}','${MALIK}','${CHEF}','${VANESSA}'));
${consulter('Claire', CLAIRE, 'HORS SERVICE — projection')}
${consulter('Malik', MALIK, 'HORS SERVICE — projection')}
${consulter('Vanessa', VANESSA, 'HORS SERVICE — projection')}
${consulter('Chef', CHEF, 'HORS SERVICE — projection')}

-- Ses lignes brutes, hors service : la RLS doit lui rendre ses postes et rien
-- d'autre. Le contrôle 15 s'appuie dessus pour le cas 9.
set local request.jwt.claims = '{"sub":"${CLAIRE}","role":"authenticated"}';
set local role authenticated;
insert into _corps
select 'Claire', 'HORS SERVICE — lignes brutes visibles',
       coalesce(json_agg(t.id order by t.id)::text, '[]')
  from public.audits_caisse t
 where t.id in ('${R1}','${R2}','${R3}','${R4}');

-- LE CAS 9, joué comme il se joue vraiment : depuis la console du navigateur,
-- l'utilisateur récrit la requête et nomme un autre salarié. La fonction est
-- appelée par EXECUTE pour que l'échec vienne de la base et non d'une erreur
-- de compilation du bloc.
do $do$
declare n integer;
begin
  begin
    execute 'select count(*) from public.mes_ecarts_caisse(''${MALIK}'')' into n;
    insert into _corps values ('Claire', 'TENTATIVE — projection paramétrée',
      'ACCEPTÉ — ' || n || ' ligne(s) rendue(s)');
  exception when others then
    insert into _corps values ('Claire', 'TENTATIVE — projection paramétrée',
      'REFUSÉ — ' || sqlstate || ' ' || sqlerrm);
  end;
end
$do$;
reset role;

-- LE CAS 15 — la session a expiré : le porteur n'a plus de \`sub\`. Le rôle est
-- encore \`authenticated\` (c'est la clé anonyme qui le donne), mais plus
-- personne n'est identifié. La fonction ne doit ni rendre une ligne, ni
-- échouer bruyamment : elle doit rendre le vide.
set local request.jwt.claims = '{"role":"authenticated"}';
set local role authenticated;
insert into _corps
select 'Session expirée', 'PROJECTION', coalesce(json_agg(t)::text, '[]')
  from (select * from public.mes_ecarts_caisse() order by date, poste) t;
reset role;

-- … puis la reconnexion. Le corps doit redevenir exactement celui d'avant.
${consulter('Claire', CLAIRE, 'RECONNEXION — projection')}

-- LE CAS 10 — anon. La garde est éprouvée par une TENTATIVE et non par sa
-- description. Le 16/09/2026, appliquée sur Test, la première migration avait
-- laissé anon=X dans l'ACL : son revoke ne visait que le pseudo-rôle PUBLIC,
-- alors que Supabase accorde EXECUTE à anon par un grant NOMMÉ, via son
-- alter default privileges sur le schéma public. Une garde qu'on décrit sans
-- jamais la heurter n'a pas été vérifiée.
set local role anon;
do $do$
declare n integer;
begin
  begin
    select count(*) into n from public.mes_ecarts_caisse();
    insert into _corps values ('anon', 'TENTATIVE', 'APPEL AUTORISÉ — ' || n || ' ligne(s) rendue(s)');
  exception when insufficient_privilege then
    insert into _corps values ('anon', 'TENTATIVE', 'REFUSÉ — ' || sqlerrm);
  end;
end
$do$;
reset role;

-- Le manager, hors service lui aussi, garde sa vue complète du quart.
set local request.jwt.claims = '{"sub":"${CHEF}","role":"authenticated"}';
set local role authenticated;
insert into _corps
select 'Chef', 'HORS SERVICE — lignes brutes', coalesce(json_agg(t)::text, '[]')
  from (select * from public.audits_caisse
         where id in ('${R1}','${R2}','${R3}','${R4}')) t;
reset role;

insert into _compteur
select 'après les consultations',
       (select count(*) from public.shifts
         where employee_id in ('${CLAIRE}','${MALIK}','${CHEF}','${VANESSA}')),
       (select count(*) from public.pointages
         where employee_id in ('${CLAIRE}','${MALIK}','${CHEF}','${VANESSA}'));

-- ══════════════════════════════════════════════════════════════════════════
-- Étape 3 — LES MÊMES CONSULTATIONS, EN SERVICE.
--
-- Les cas 2 et 3 ne demandent pas « est-ce que ça marche aussi » : ils
-- demandent que le service n'ait AUCUNE influence. La bonne mesure n'est donc
-- pas « le corps est non vide », c'est « le corps est le même, octet pour
-- octet ». Le service est fabriqué ICI, après les mesures hors service, pour
-- qu'aucune d'elles n'ait pu en bénéficier.
-- ══════════════════════════════════════════════════════════════════════════

-- Service de la VEILLE, clos dans les règles (cas 3).
insert into public.shifts
  (id, employee_id, site, site_id, role, quart, heure_debut, heure_fin,
   statut, cloture_source, cloture_le)
values
  ('${S1}','${CLAIRE}','nexus-station-test','nexus-station-test','caissiere','1',
   now() - interval '1 day', now() - interval '18 hours',
   'termine', 'test', now() - interval '18 hours');
${consulter('Claire', CLAIRE, 'SERVICE DE LA VEILLE — projection')}

-- Le même service rouvert : Claire est maintenant EN SERVICE (cas 2).
update public.shifts
   set statut = 'en_cours', heure_fin = null, cloture_source = null,
       cloture_le = null, heure_debut = now() - interval '2 hours'
 where id = '${S1}';
${consulter('Claire', CLAIRE, 'EN SERVICE — projection')}

-- ══════════════════════════════════════════════════════════════════════════
-- Étape 4 — les contrôles.
-- ══════════════════════════════════════════════════════════════════════════

create temporary view _claire as
  select corps from _corps where qui = 'Claire' and quoi = 'HORS SERVICE — projection';

-- 1 — le décor est bien celui qu'on prétend : aucun service, pour personne.
-- Sans ce contrôle, « Claire lit hors service » pourrait être vrai parce
-- qu'un service traînait.
insert into _preuve
select 1, 'CAS 1 & 4 — aucun service n''existe au moment des consultations',
       'shifts=' || n_shifts || ' pointages=' || n_pointages,
       case when n_shifts = 0 and n_pointages = 0 then 'OK' else 'ÉCHEC (décor faux)' end
  from _compteur where quand = 'avant les consultations';

-- 2 — LA PREUVE D'ACCÈS HORS SERVICE. Claire, sans le moindre service,
-- reçoit ses 3 postes : R1 piste, R3 piste, R4 piste.
insert into _preuve
select 2, 'CAS 1 & 4 — hors service, Claire reçoit ses 3 postes',
       (select string_agg(p.date || '/' || p.poste, ' ' order by p.date)
          from json_to_recordset((select corps from _claire)::json)
               as p(date text, poste text)),
       case when (select count(*) from json_array_elements((select corps from _claire)::json)) = 3
            then 'OK' else 'ÉCHEC' end;

-- 3 & 4 — LE SERVICE N'A AUCUNE INFLUENCE. Égalité octet pour octet, pas
-- « non vide » : un corps appauvri en service passerait un « non vide ».
insert into _preuve
select 3, 'CAS 3 — dernier service datant de la veille : corps identique, octet pour octet',
       'longueur=' || length(v.corps) || ' identique=' || (v.corps = h.corps)::text,
       case when v.corps = h.corps then 'OK' else 'ÉCHEC' end
  from _corps v, _claire h
 where v.qui = 'Claire' and v.quoi = 'SERVICE DE LA VEILLE — projection';

insert into _preuve
select 4, 'CAS 2 — service en cours : corps identique, octet pour octet',
       'longueur=' || length(s.corps) || ' identique=' || (s.corps = h.corps)::text,
       case when s.corps = h.corps then 'OK' else 'ÉCHEC' end
  from _corps s, _claire h
 where s.qui = 'Claire' and s.quoi = 'EN SERVICE — projection';

-- 5 — LE CAS 13. Onze consultations, quatre identités, une session expirée,
-- une tentative anon : aucune ligne de shifts, aucune ligne de pointages.
insert into _preuve
select 5, 'CAS 13 — consulter ne crée ni service ni pointage',
       'shifts ' || a.n_shifts || '→' || b.n_shifts ||
       ' ; pointages ' || a.n_pointages || '→' || b.n_pointages,
       case when a.n_shifts = b.n_shifts and a.n_pointages = b.n_pointages
            then 'OK' else 'ÉCHEC' end
  from _compteur a, _compteur b
 where a.quand = 'avant les consultations' and b.quand = 'après les consultations';

-- 6 — LE CAS 15. Sans \`sub\`, la projection rend le vide, sans erreur ; et la
-- reconnexion rend exactement le corps d'avant.
insert into _preuve
select 6, 'CAS 15 — session expirée : corps vide ; reconnexion : corps identique',
       'expirée=' || e.corps || ' ; reconnexion identique=' || (r.corps = h.corps)::text,
       case when e.corps = '[]' and r.corps = h.corps then 'OK' else 'ÉCHEC' end
  from (select corps from _corps where qui = 'Session expirée') e,
       (select corps from _corps where qui = 'Claire' and quoi = 'RECONNEXION — projection') r,
       _claire h;

-- 7 — LE CAS 5. Un écart validé se voit, entièrement : montant, montant
-- retenu, montant d'origine, cause, date de validation.
insert into _preuve
select 7, 'CAS 5 — le poste validé du 05/01 porte son écart complet',
       concat_ws(' ', 'ecart=' || coalesce(p.ecart, 'NULL'),
                      'valide=' || coalesce(p.ecart_valide, 'NULL'),
                      'origine=' || coalesce(p.ecart_origine, 'NULL'),
                      'cause=' || coalesce(p.cause_code, 'NULL'),
                      'valide_le=' || coalesce(left(p.valide_le, 10), 'NULL')),
       case when p.ecart = '-12.50' and p.ecart_valide = '-10.25'
             and p.ecart_origine = '-12.50' and p.cause_code = 'ERREUR_RENDU'
             and p.valide_le is not null
            then 'OK' else 'ÉCHEC' end
  from json_to_recordset((select corps from _claire)::json)
       as p(date text, ecart text, ecart_valide text, ecart_origine text,
            cause_code text, valide_le text)
 where p.date = '2027-01-05';

-- 8 — LE CAS 6. Le poste encore en contrôle est PRÉSENT — l'écran doit
-- pouvoir dire « Contrôle de votre caisse en cours. » et le rattacher à une
-- date et à un poste — mais il ne porte AUCUN montant, AUCUNE origine,
-- AUCUNE cause. Les quatre champs sont contrôlés ensemble : un seul qui
-- resterait rempli suffirait à livrer le chiffre.
insert into _preuve
select 8, 'CAS 6 — le poste non validé est présent, sans montant ni origine ni cause',
       concat_ws(' ', 'quart=' || coalesce(p.quart, 'NULL'),
                      'poste=' || coalesce(p.poste, 'NULL'),
                      'ecart=' || coalesce(p.ecart, 'NULL'),
                      'valide=' || coalesce(p.ecart_valide, 'NULL'),
                      'origine=' || coalesce(p.ecart_origine, 'NULL'),
                      'cause=' || coalesce(p.cause_code, 'NULL'),
                      'valide_le=' || coalesce(p.valide_le, 'NULL')),
       case when p.quart = '1' and p.poste = 'piste'
             and p.ecart is null and p.ecart_valide is null
             and p.ecart_origine is null and p.cause_code is null
             and p.valide_le is null
            then 'OK' else 'ÉCHEC' end
  from json_to_recordset((select corps from _claire)::json)
       as p(date text, quart text, poste text, ecart text, ecart_valide text,
            ecart_origine text, cause_code text, valide_le text)
 where p.date = '2027-01-09';

-- 9 — LE CAS 6, par l'autre bout : les jetons du provisoire ne sont nulle
-- part dans le corps. Un champ vidé mais recopié ailleurs serait vu ici.
insert into _preuve
select 9, 'CAS 6 — aucun jeton du contrôle en cours dans le corps',
       coalesce(string_agg(j.jeton, ' | '), '(aucun)'),
       case when count(*) = 0 then 'OK' else 'ÉCHEC' end
  from (values ('-33.33'), ('ECART_PROVISOIRE_SECRET'),
               ('commentaire manager brut R4'), ('note interne manager R4')
       ) as j(jeton)
 where exists (select 1 from _claire c where position(j.jeton in c.corps) > 0);

-- 10 & 11 — LES CAS 7 ET 8. Le binôme piste + boutique n'est PAS un poste
-- partagé : deux postes, deux responsabilités. Seule R3, où Claire et Malik
-- tiennent LA MÊME piste, l'est.
insert into _preuve
select 10, 'CAS 7 — le 05/01, Claire tient son poste seule',
       'partage=' || p.poste_partage || ' detenteurs=' || p.nb_detenteurs,
       case when p.poste_partage = false and p.nb_detenteurs = 1 then 'OK' else 'ÉCHEC' end
  from json_to_recordset((select corps from _claire)::json)
       as p(date text, poste_partage boolean, nb_detenteurs int)
 where p.date = '2027-01-05';

insert into _preuve
select 11, 'CAS 8 — le 07/01, le poste est partagé, sans dire avec qui',
       'partage=' || p.poste_partage || ' detenteurs=' || p.nb_detenteurs
       || ' ecart=' || coalesce(p.ecart, 'NULL'),
       case when p.poste_partage = true and p.nb_detenteurs = 2
             and p.ecart = '-5.00'
            then 'OK' else 'ÉCHEC' end
  from json_to_recordset((select corps from _claire)::json)
       as p(date text, poste_partage boolean, nb_detenteurs int, ecart text)
 where p.date = '2027-01-07';

-- 12 — LE CAS 12, contrôle exhaustif. On ne nomme pas les champs suspects :
-- on prend TOUTES les feuilles des lignes brutes, on retire celles que les
-- colonnes autorisées portent légitimement, et on exige que l'intersection
-- avec les feuilles du corps soit vide. Le contrat est plus étroit sur R4
-- que sur R1 et R3 : c'est la migration du 16/09 rendue mesurable.
-- La comparaison est une ÉGALITÉ de feuille, pas une sous-chaîne : le
-- contrôle 13 couvre l'autre moitié, celle des valeurs noyées dans du texte.
with ${feuilles('v', [R1, R3], AUTORISEES_VALIDE)},
${feuilles('p', [R4], AUTORISEES_PROVISOIRE)},
feuilles_corps as (
  select distinct trim(both '"' from v::text) as val
    from _claire c, lateral jsonb_path_query(c.corps::jsonb, '$.**') v
   where jsonb_typeof(v) not in ('object', 'array')
     and v::text <> 'null'
),
-- Son propre identifiant n'est pas la donnée d'un collègue. Il vit dans
-- \`employes_piste\`, donc dans les feuilles interdites ; il est écarté ici,
-- explicitement, pour que l'exception se voie.
interdites as (
  (select val from v_brutes where val <> '${CLAIRE}'
    except select val from v_autorisees)
  union
  (select val from p_brutes where val <> '${CLAIRE}'
    except select val from p_autorisees)
)
insert into _preuve
select 12, 'CAS 12 — aucune feuille interdite des lignes brutes ne figure dans le corps',
       coalesce(string_agg(i.val, ' | '), '(aucune)'),
       case when count(*) = 0 then 'OK' else 'ÉCHEC' end
  from interdites i
 where i.val in (select val from feuilles_corps);

-- 13 — l'autre moitié du cas 12 : une valeur peut être NOYÉE dans une chaîne
-- plutôt que portée par une feuille à elle. Balayage en sous-chaîne des
-- jetons à fort signal.
insert into _preuve
select 13, 'CAS 12 — aucun jeton sensible en sous-chaîne dans le corps',
       coalesce(string_agg(j.jeton, ' | '), '(aucun)'),
       case when count(*) = 0 then 'OK' else 'ÉCHEC' end
  from (values
    ('${MALIK}'), ('${CHEF}'), ('${VANESSA}'),
    ('commentaire manager brut'), ('note interne manager'),
    ('-492.50'), ('-480.00'), ('-477.75'), ('-87.30'), ('MANQUE_TICKET')
  ) as j(jeton)
 where exists (select 1 from _claire c where position(j.jeton in c.corps) > 0);

-- 14 — LE CAS 9, première moitié : il n'existe aucune façon de NOMMER un
-- autre salarié, parce que la fonction ne prend aucun argument et qu'il n'en
-- existe aucune surcharge.
insert into _preuve
select 14, 'CAS 9 — la projection n''a aucun paramètre et aucune surcharge',
       coalesce(string_agg(p.oid::regprocedure::text, ' | '), '(aucune)'),
       case when count(*) = 1 and bool_and(p.pronargs = 0) then 'OK' else 'ÉCHEC' end
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'mes_ecarts_caisse';

-- 15 — LE CAS 9, seconde moitié : la tentative RÉELLE. Réécrire la requête
-- dans la console du navigateur ne rend rien.
insert into _preuve
select 15, 'CAS 9 — nommer un collègue dans l''appel est refusé par la base',
       corps,
       case when corps like 'REFUSÉ%' then 'OK' else 'ÉCHEC' end
  from _corps where qui = 'Claire' and quoi = 'TENTATIVE — projection paramétrée';

-- 16 — LE CAS 9, troisième moitié : en attaquant la table DIRECTEMENT, comme
-- le ferait un appel PostgREST réécrit dans la console, Claire ne lit plus
-- RIEN — pas même ses propres lignes. La politique posée par la migration du
-- 14/09 ne laisse \`audits_caisse\` qu'aux managers, aux gérants et au créateur
-- autorisé : la projection est devenue la seule voie de lecture d'un employé,
-- et c'est précisément ce qui rend le masquage du provisoire incontournable.
-- Ce \`[]\` ne peut pas venir d'une table vide : le contrôle 18 montre le
-- manager lisant les 4 mêmes lignes dans la même transaction.
insert into _preuve
select 16, 'CAS 9 — en direct sur la table, Claire ne lit aucune ligne, pas même les siennes',
       corps,
       case when corps = '[]' then 'OK' else 'ÉCHEC' end
  from _corps where qui = 'Claire' and quoi = 'HORS SERVICE — lignes brutes visibles';

-- 17 — LE CAS 10.
insert into _preuve
select 17, 'CAS 10 — anon ne peut pas appeler la projection (tentative réelle)',
       corps || ' ; has_function_privilege=' ||
       has_function_privilege('anon', 'public.mes_ecarts_caisse()', 'execute')::text,
       case when corps like 'REFUSÉ%'
             and not has_function_privilege('anon', 'public.mes_ecarts_caisse()', 'execute')
            then 'OK' else 'ÉCHEC' end
  from _corps where qui = 'anon' and quoi = 'TENTATIVE';

-- 18 & 19 — LE CAS 11. Le manager garde sa vue complète du quart, identités
-- et commentaires compris : c'est le contrôle qui empêche de « réussir » en
-- fermant tout le monde dehors. Mais la projection reste PERSONNELLE : elle
-- ne lui rend pas les postes d'un employé, parce qu'elle ne rend jamais que
-- les postes de celui qui appelle.
insert into _preuve
select 18, 'CAS 11 — le manager garde les 4 lignes brutes, identités comprises',
       (select count(*) from json_array_elements(corps::json))::text || ' ligne(s)',
       case when (select count(*) from json_array_elements(corps::json)) = 4
             and corps like '%${MALIK}%' and corps like '%${CHEF}%'
             and corps like '%commentaire manager brut%'
             and corps like '%-33.33%'
            then 'OK' else 'ÉCHEC' end
  from _corps where qui = 'Chef' and quoi = 'HORS SERVICE — lignes brutes';

insert into _preuve
select 19, 'CAS 11 — la projection ne rend au manager que ses propres postes (aucun)',
       corps,
       case when corps = '[]' then 'OK' else 'ÉCHEC' end
  from _corps where qui = 'Chef' and quoi = 'HORS SERVICE — projection';

-- 20 — LE CAS 12, la clé du contrat. Le corps ne porte que les 12 colonnes de
-- la projection : une colonne ajoutée demain fait échouer ce contrôle.
insert into _preuve
select 20, 'CAS 12 — le corps ne porte aucune clé hors du contrat de la projection',
       coalesce(string_agg(distinct k, ', '), '(aucune)'),
       case when count(*) = 0 then 'OK' else 'ÉCHEC' end
  from _claire c,
       lateral json_array_elements(c.corps::json) e,
       lateral json_object_keys(e) k
 where k not in ('audit_id','site','date','quart','poste','ecart','ecart_valide',
                 'ecart_origine','cause_code','valide_le','poste_partage','nb_detenteurs');

-- 21 — la garde de la fonction elle-même, lue dans le catalogue et non dans
-- le fichier : security definer, search_path vidé, et AUCUNE lecture de
-- shifts ni de pointages. C'est la raison pour laquelle le service ne peut
-- pas influer : il n'est pas dans la question.
insert into _preuve
select 21, 'SOURCE — security definer, search_path vidé, ne lit ni shifts ni pointages',
       'secdef=' || p.prosecdef || ' config=' || coalesce(array_to_string(p.proconfig, ','), 'NULL')
       || ' shifts=' || (p.prosrc like '%shifts%')::text
       || ' pointages=' || (p.prosrc like '%pointages%')::text,
       case when p.prosecdef
             and p.proconfig @> array['search_path=""']
             and p.prosrc not like '%shifts%'
             and p.prosrc not like '%pointages%'
            then 'OK' else 'ÉCHEC' end
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'mes_ecarts_caisse';

-- 22 — une recette qui ne montre RIEN passe la plupart des contrôles
-- ci-dessus. Celle-ci exige que Claire reçoive bien ses deux écarts validés,
-- et que Malik reçoive les siens sans jamais recevoir ceux de Claire.
insert into _preuve
select 22, 'CONTRE-ÉPREUVE — Claire reçoit ses deux écarts validés (-12.50 et -5.00)',
       (select corps from _claire),
       case when (select corps from _claire) like '%-12.50%'
             and (select corps from _claire) like '%-5.00%'
            then 'OK' else 'ÉCHEC' end;

insert into _preuve
select 23, 'CONTRE-ÉPREUVE — Malik reçoit ses 3 postes et jamais l''écart de Claire',
       corps,
       case when corps like '%-480.00%' and corps like '%-87.30%'
             and corps not like '%-12.50%'
             and (select count(*) from json_array_elements(corps::json)) = 3
            then 'OK' else 'ÉCHEC' end
  from _corps where qui = 'Malik' and quoi = 'HORS SERVICE — projection';

insert into _preuve
select 24, 'CONTRE-ÉPREUVE — Vanessa, sans audit, reçoit un corps vide et non un zéro simulé',
       corps,
       case when corps = '[]' then 'OK' else 'ÉCHEC' end
  from _corps where qui = 'Vanessa' and quoi = 'HORS SERVICE — projection';

-- Un seul relevé, détail puis conclusion : un exécuteur qui ne rend que le
-- dernier résultat rendrait sinon la conclusion sans ce qui la fonde.
select lpad(ordre::text, 2, '0') as ordre, controle, verdict, obtenu
  from _preuve
union all
select 'TOTAL',
       count(*)::text || ' contrôle(s)',
       case when count(*) filter (where verdict like 'ÉCHEC%') = 0
            then 'RECETTE TENUE' else 'RECETTE NON TENUE' end,
       count(*) filter (where verdict like 'ÉCHEC%')::text || ' échec(s)'
  from _preuve
 order by 1;


rollback;
`;

process.stdout.write(sql);
