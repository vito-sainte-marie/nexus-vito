// Preuve réseau : ce que la réponse contient VRAIMENT, champ par champ.
//
// Le NO-GO du 14/09/2026 a refusé la preuve précédente pour une raison
// précise : elle contrôlait l'identifiant principal de la ligne partagée, et
// concluait. Un identifiant de collègue peut vivre ailleurs — dans
// `employee_id`, dans `valide_par_piste`, dans un tableau `employes_*`, dans
// un commentaire libre. Contrôler un champ et conclure sur la ligne, c'est
// exactement l'erreur que NEXUS reproche aux tableaux de bord verts.
//
// Cette preuve ne choisit donc pas les champs à inspecter. Elle prend la
// ligne brute, en RETIRE les colonnes que la projection a le droit de
// révéler, aplatit tout le reste — objets, tableaux, feuilles imbriquées —
// et exige que rien de ce qui subsiste ne se retrouve dans la réponse.
// Une colonne ajoutée demain à `audits_caisse` est couverte le jour où elle
// apparaît, sans que personne ait à y penser.
//
// POURQUOI UN SCRIPT ET PAS UN .sql. La preuve doit jouer EXACTEMENT le SQL
// de la migration, pas une copie. Une copie diverge, et une preuve qui diverge
// de ce qu'elle prouve est pire qu'aucune preuve. Ce script lit donc la
// migration sous preuve sur disque et l'insère telle quelle dans la
// transaction. L'état de départ, lui, ne vient d'aucun fichier : le hotfix RLS
// du 14/09 a été appliqué hors bande et n'a jamais été régularisé au dépôt.
// L'étape 1 recopie donc la policy relevée en Production le 16/09/2026, en le
// disant à l'endroit où elle est écrite.
//
// CE QU'ELLE MESURE, ET OÙ. Le corps capturé est `json_agg(t)::text` sous
// `set local role authenticated` et `set local request.jwt.claims` : c'est le
// corps que PostgREST sérialise pour la requête HTTP, produit par le même
// rôle et la même identité. Ce qui n'y figure pas ne peut pas partir sur le
// réseau.
//
// CE QU'ELLE NE MESURE PAS. Elle ne joue pas la couche HTTP elle-même : pas
// d'en-têtes, pas de JWT signé. Obtenir un JWT réel exige un mot de passe, et
// les mots de passe sont saisis par Frédéric, jamais par moi.
//
// USAGE : node outils/preuve-projection-mes-ecarts-caisse.js
//   imprime le SQL complet, à jouer sur le projet de TEST. Tout est dans une
//   transaction qui finit par ROLLBACK : ni le décor, ni les fonctions, ni
//   les politiques ne survivent.
'use strict';
const fs = require('fs');
const path = require('path');

const MIG = path.join(__dirname, '..', 'supabase', 'migrations');
const PROJECTION = '20260914210000_mes_ecarts_caisse_projection_employe.sql';
const lire = f => fs.readFileSync(path.join(MIG, f), 'utf8');

const CLAIRE  = '11111111-1111-4111-8111-111111111111';
const MALIK   = '22222222-2222-4222-8222-222222222222';
const CHEF    = '33333333-3333-4333-8333-333333333333';
const VANESSA = '44444444-4444-4444-8444-444444444444';
const R1 = 'aaaaaaaa-0000-4000-8000-000000000001';
const R2 = 'aaaaaaaa-0000-4000-8000-000000000002';
const R3 = 'aaaaaaaa-0000-4000-8000-000000000003';

// Les colonnes que la projection a le DROIT de révéler à Claire, côté piste.
// Tout le reste de la ligne est réputé interdit. Cette liste est le contrat :
// l'allonger est une décision de confidentialité, et se lit comme telle dans
// un diff.
const AUTORISEES = ['id', 'site', 'date', 'quart', 'ecart_piste',
  'ecart_piste_valide', 'ecart_piste_origine', 'cause_code_piste',
  'valide_le_piste', 'valide_le'];

const sql = `
-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  PREUVE — la projection par poste ne renvoie rien d'un collègue      ║
-- ║  Générée par outils/preuve-projection-mes-ecarts-caisse.js           ║
-- ║  À jouer sur le projet de TEST. Se termine par ROLLBACK.             ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Le décor, sur le site de recette, daté en janvier 2027 pour ne heurter
-- aucune ligne existante (unicité site+date+quart) :
--
--   R1  05/01  quart 1  Claire tient la piste, Malik la boutique
--                       — le binôme normal : deux postes, deux responsabilités
--                       écart piste -12,50 / écart boutique -480,00 / total -492,50
--                       validé par Chef, commentaires manager bruts, créée par Malik
--   R2  06/01  quart 1  Malik seul sur la piste, -87,30
--                       — Claire ne doit pas voir cette ligne du tout
--   R3  07/01  quart 2  Claire ET Malik sur LA MÊME piste, -5,00
--                       — le vrai poste partagé, hors cumul personnel
--   Vanessa             aucun audit : l'état vide explicite

begin;

create temporary table _corps (
  qui    text,
  quoi   text,
  corps  text
) on commit drop;
grant all on _corps to authenticated;
grant all on _corps to anon;

create temporary table _preuve (
  ordre    int,
  controle text,
  obtenu   text,
  verdict  text
) on commit drop;

insert into public.employees (id, username, nom, role, site_id, actif) values
  ('${CLAIRE}' ,'preuve_claire' ,'Claire Preuve' ,'caissier','nexus-station-test',true),
  ('${MALIK}'  ,'preuve_malik'  ,'Malik Preuve'  ,'caissier','nexus-station-test',true),
  ('${CHEF}'   ,'preuve_chef'   ,'Chef Preuve'   ,'manager' ,'nexus-station-test',true),
  ('${VANESSA}','preuve_vanessa','Vanessa Preuve','caissier','nexus-station-test',true);

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
   'commentaire manager brut piste R3',null,'anomalie');

-- ══════════════════════════════════════════════════════════════════════════
-- Étape 1 — on met Test à l'état de la Production d'aujourd'hui.
-- Le hotfix RLS du 14/09 est appliqué en Production ; Test ne l'a pas. Sans
-- lui, la mesure AVANT dirait « fuite » pour une raison déjà corrigée, et la
-- preuve prouverait un problème qui n'existe plus.
--
-- POURQUOI CETTE POLICY EST ÉCRITE ICI ET NON LUE DANS UN FICHIER. Le hotfix
-- du 14/09 a été appliqué hors bande et sa régularisation au dépôt a été
-- refusée : aucun fichier de supabase/migrations/ ne le décrit, et lire un
-- fichier absent ferait tomber la preuve au lieu de la jouer. L'expression
-- ci-dessous n'est donc pas une reconstitution de mémoire : c'est la valeur
-- relevée le 16/09/2026 sur le projet de Production (uzhjpqpctpvxytxpxoqz)
-- par pg_get_expr(polqual, polrelid), recopiée telle quelle. Elle se
-- revérifie en une requête, et le jour où elle cessera de correspondre, c'est
-- la Production qui aura bougé — pas cette preuve.
-- ══════════════════════════════════════════════════════════════════════════

drop policy if exists select_audits_caisse on public.audits_caisse;

create policy select_audits_caisse on public.audits_caisse
  for select to authenticated
  using (
    (
      site = (select public.current_employee_site_id())
      and (
        (select public.current_employee_role()) in ('manager', 'gerant')
        or public.audits_caisse.employes_piste ? ((select auth.uid()))::text
        or public.audits_caisse.employes_boutique ? ((select auth.uid()))::text
      )
    )
    or (
      (select public.je_suis_createur())
      and exists (
        select 1 from public.sites s
         where s.site_id = audits_caisse.site
           and s.acces_createur_autorise = true
      )
    )
  );

-- ══════════════════════════════════════════════════════════════════════════
-- Étape 2 — AVANT la projection : ce que Claire reçoit aujourd'hui.
-- ══════════════════════════════════════════════════════════════════════════

set local request.jwt.claims = '{"sub":"${CLAIRE}","role":"authenticated"}';
set local role authenticated;
insert into _corps
select 'Claire', 'AVANT — lignes brutes',
       coalesce(json_agg(t)::text, '[]')
  from (select * from public.audits_caisse
         where id in ('${R1}','${R2}','${R3}')) t;
reset role;

-- ══════════════════════════════════════════════════════════════════════════
-- Étape 3 — la migration sous preuve.
-- ══════════════════════════════════════════════════════════════════════════

${lire(PROJECTION)}

-- ══════════════════════════════════════════════════════════════════════════
-- Étape 4 — APRÈS : les quatre regards.
-- ══════════════════════════════════════════════════════════════════════════

set local request.jwt.claims = '{"sub":"${CLAIRE}","role":"authenticated"}';
set local role authenticated;
insert into _corps
select 'Claire', 'APRÈS — projection', coalesce(json_agg(t)::text, '[]')
  from public.mes_ecarts_caisse() t;
insert into _corps
select 'Claire', 'APRÈS — lignes brutes', coalesce(json_agg(t)::text, '[]')
  from (select * from public.audits_caisse
         where id in ('${R1}','${R2}','${R3}')) t;
reset role;

set local request.jwt.claims = '{"sub":"${MALIK}","role":"authenticated"}';
set local role authenticated;
insert into _corps
select 'Malik', 'APRÈS — projection', coalesce(json_agg(t)::text, '[]')
  from public.mes_ecarts_caisse() t;
reset role;

set local request.jwt.claims = '{"sub":"${VANESSA}","role":"authenticated"}';
set local role authenticated;
insert into _corps
select 'Vanessa', 'APRÈS — projection', coalesce(json_agg(t)::text, '[]')
  from public.mes_ecarts_caisse() t;
reset role;

set local request.jwt.claims = '{"sub":"${CHEF}","role":"authenticated"}';
set local role authenticated;
insert into _corps
select 'Chef', 'APRÈS — lignes brutes', coalesce(json_agg(t)::text, '[]')
  from (select * from public.audits_caisse
         where id in ('${R1}','${R2}','${R3}')) t;
reset role;

-- ══════════════════════════════════════════════════════════════════════════
-- Étape 5 — les contrôles.
-- ══════════════════════════════════════════════════════════════════════════

-- Le corps de Claire après bascule, une bonne fois.
create temporary view _claire as
  select corps from _corps where qui = 'Claire' and quoi = 'APRÈS — projection';

-- 1 & 2 — la fuite AVANT existe bien. Sans ces deux mesures, une preuve
-- toute verte ne dirait pas si elle mesure une fermeture ou un décor vide.
insert into _preuve
select 1, 'AVANT — le corps brut de Claire contient l''UUID de Malik',
       case when c.corps like '%${MALIK}%' then 'contient' else 'absent' end,
       case when c.corps like '%${MALIK}%' then 'OK (fuite confirmée)' else 'ÉCHEC (décor faux)' end
  from _corps c where c.qui = 'Claire' and c.quoi = 'AVANT — lignes brutes';

insert into _preuve
select 2, 'AVANT — le corps brut de Claire contient validateur, commentaire manager et écart du quart',
       concat_ws(' / ',
         case when corps like '%${CHEF}%' then 'valide_par' end,
         case when corps like '%commentaire manager brut%' then 'commentaire' end,
         case when corps like '%-492.50%' then 'ecart_total' end,
         case when corps like '%-480.00%' then 'écart du poste non tenu' end),
       case when corps like '%${CHEF}%' and corps like '%commentaire manager brut%'
             and corps like '%-492.50%' and corps like '%-480.00%'
            then 'OK (fuite confirmée)' else 'ÉCHEC (décor faux)' end
  from _corps where qui = 'Claire' and quoi = 'AVANT — lignes brutes';

-- 3 — l'accès direct est refermé.
insert into _preuve
select 3, 'APRÈS — Claire ne lit plus aucune ligne brute',
       corps,
       case when corps = '[]' then 'OK' else 'ÉCHEC' end
  from _corps where qui = 'Claire' and quoi = 'APRÈS — lignes brutes';

-- 4 — elle reçoit ses deux postes, et seulement eux.
insert into _preuve
select 4, 'APRÈS — Claire reçoit exactement ses 2 postes tenus (R1 piste, R3 piste)',
       (select string_agg(p.quart || '/' || p.poste || '=' || p.ecart, ' ' order by p.quart)
          from json_to_recordset((select corps from _claire)::json)
               as p(quart text, poste text, ecart text)),
       case when (select count(*) from json_array_elements((select corps from _claire)::json)) = 2
            then 'OK' else 'ÉCHEC' end;


-- 5 — LE contrôle exhaustif, celui que le NO-GO du 14/09 exigeait.
-- On ne nomme pas les champs suspects : on prend TOUTES les feuilles de la
-- ligne brute, on retire celles que les colonnes autorisées portent
-- légitimement, et on exige que l'intersection avec les feuilles du corps de
-- Claire soit vide. \`$.**\` descend dans les objets ET dans les tableaux :
-- un UUID au fond d'un \`employes_*\` est une feuille comme une autre.
-- La comparaison est une ÉGALITÉ de feuille, pas une sous-chaîne : sans quoi
-- un \`0.00\` par défaut quelque part signalerait le \`-10.00\` de Claire.
-- Le contrôle 6 couvre l'autre moitié, celle des valeurs noyées dans du texte.
with feuilles_brutes as (
  select distinct trim(both '"' from v::text) as val
    from public.audits_caisse a,
         lateral jsonb_path_query(
           to_jsonb(a) ${AUTORISEES.map(c => `- '${c}'`).join(' ')}, '$.**') v
   where a.id in ('${R1}','${R3}')
     and jsonb_typeof(v) not in ('object', 'array')
     and v::text <> 'null'
),
feuilles_autorisees as (
  select distinct trim(both '"' from v::text) as val
    from public.audits_caisse a,
         lateral jsonb_path_query(
           jsonb_build_object(${AUTORISEES.map(c => `'${c}', to_jsonb(a) -> '${c}'`).join(', ')}),
           '$.**') v
   where a.id in ('${R1}','${R3}')
     and jsonb_typeof(v) not in ('object', 'array')
     and v::text <> 'null'
),
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
  select val from feuilles_brutes
   where val <> '${CLAIRE}'
  except select val from feuilles_autorisees
)
insert into _preuve
select 5, 'APRÈS — aucune feuille interdite de la ligne brute ne figure dans le corps de Claire',
       coalesce(string_agg(i.val, ' | '), '(aucune)'),
       case when count(*) = 0 then 'OK' else 'ÉCHEC' end
  from interdites i
 where i.val in (select val from feuilles_corps);

-- 6 — l'autre moitié : une valeur peut être NOYÉE dans une chaîne plutôt que
-- portée par une feuille à elle. Balayage en sous-chaîne des jetons à fort
-- signal — les quatre identités du décor, les commentaires manager bruts,
-- l'écart du quart et celui du poste que Claire n'a pas tenu.
insert into _preuve
select 6, 'APRÈS — aucun jeton sensible en sous-chaîne dans le corps de Claire',
       coalesce(string_agg(j.jeton, ' | '), '(aucun)'),
       case when count(*) = 0 then 'OK' else 'ÉCHEC' end
  from (values
    ('${MALIK}'), ('${CHEF}'), ('${VANESSA}'),
    ('commentaire manager brut'), ('note interne manager'),
    ('-492.50'), ('-480.00'), ('-477.75'), ('-87.30'), ('MANQUE_TICKET')
  ) as j(jeton)
 where exists (select 1 from _claire c where position(j.jeton in c.corps) > 0);

-- 7 — le corps ne porte que les 12 colonnes de la projection. Une colonne
-- ajoutée demain à la fonction fait échouer ce contrôle : on ne révèle pas
-- un champ de plus sans qu'une preuve le dise.
insert into _preuve
select 7, 'APRÈS — le corps ne porte aucune clé hors du contrat de la projection',
       coalesce(string_agg(distinct k, ', '), '(aucune)'),
       case when count(*) = 0 then 'OK' else 'ÉCHEC' end
  from _claire c,
       lateral json_array_elements(c.corps::json) e,
       lateral json_object_keys(e) k
 where k not in ('audit_id','site','date','quart','poste','ecart','ecart_valide',
                 'ecart_origine','cause_code','valide_le','poste_partage','nb_detenteurs');

-- 8 — une preuve qui ne montre RIEN passe tous les contrôles ci-dessus.
-- Celui-ci exige que Claire reçoive bien ses propres écarts.
insert into _preuve
select 8, 'APRÈS — Claire reçoit bien ses deux écarts à elle (-12.50 et -5.00)',
       (select corps from _claire),
       case when (select corps from _claire) like '%-12.50%'
             and (select corps from _claire) like '%-5.00%'
            then 'OK' else 'ÉCHEC' end;

-- 9 — l'arbitrage métier. Le binôme piste + boutique n'est PAS un poste
-- partagé : deux postes distincts, deux responsabilités distinctes. Seule
-- R3, où Claire et Malik tiennent LA MÊME piste, l'est.
insert into _preuve
select 9, 'APRÈS — R1 piste = poste tenu seul ; R3 piste = poste partagé',
       string_agg(p.quart || '/' || p.poste || ' partage=' || p.poste_partage
                  || ' detenteurs=' || p.nb_detenteurs, ' ; ' order by p.quart),
       case when bool_and(case when p.quart = '1' then p.poste_partage = false and p.nb_detenteurs = 1
                               when p.quart = '2' then p.poste_partage = true  and p.nb_detenteurs = 2 end)
            then 'OK' else 'ÉCHEC' end
  from json_to_recordset((select corps from _claire)::json)
       as p(quart text, poste text, poste_partage boolean, nb_detenteurs int);

-- 10 — Vanessa. Un employé sans audit reçoit un corps VIDE, pas une ligne
-- fabriquée à zéro : l'écran doit pouvoir dire « rien à mesurer » et non
-- « résultat parfait ».
insert into _preuve
select 10, 'APRÈS — Vanessa, sans audit, reçoit un corps vide et non un zéro simulé',
       corps,
       case when corps = '[]' then 'OK' else 'ÉCHEC' end
  from _corps where qui = 'Vanessa' and quoi = 'APRÈS — projection';

-- 11 — la symétrie. Ce qui est caché à Claire l'est pour la même raison chez
-- Malik : la fonction ne prend aucun paramètre d'identité.
insert into _preuve
select 11, 'APRÈS — Malik reçoit ses 3 postes et jamais l''écart piste de Claire',
       corps,
       case when corps like '%-480.00%' and corps like '%-87.30%'
             and corps not like '%-12.50%'
             and (select count(*) from json_array_elements(corps::json)) = 3
            then 'OK' else 'ÉCHEC' end
  from _corps where qui = 'Malik' and quoi = 'APRÈS — projection';

-- 12 — rien n'est cassé côté manager : il garde la représentation complète,
-- identités comprises. C'est le contrôle qui empêche de « réussir » en
-- fermant tout le monde dehors.
insert into _preuve
select 12, 'APRÈS — le manager garde les 3 lignes brutes, identités comprises',
       (select count(*) from json_array_elements(corps::json))::text || ' ligne(s)',
       case when (select count(*) from json_array_elements(corps::json)) = 3
             and corps like '%${MALIK}%' and corps like '%${CHEF}%'
             and corps like '%commentaire manager brut%'
            then 'OK' else 'ÉCHEC' end
  from _corps where qui = 'Chef' and quoi = 'APRÈS — lignes brutes';

-- 13 — la garde de privilège, éprouvée par une TENTATIVE et non par sa
-- description. Le 16/09/2026, appliquée sur Test, cette migration a laissé
-- anon=X dans l'ACL : son revoke ne visait que le pseudo-rôle PUBLIC, alors
-- que Supabase accorde EXECUTE a anon par un grant NOMME, via son
-- alter default privileges sur le schéma public. Aucune donnée n'est jamais
-- partie — le corps refuse de lui-même — mais la fonction était appelable
-- sans aucun compte. Ce controle prend le role anon et essaie vraiment :
-- une garde qu'on décrit sans jamais la heurter n'a pas été vérifiée.
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

insert into _preuve
select 13, 'APRÈS — anon ne peut pas appeler la projection (tentative réelle)',
       corps || ' ; has_function_privilege=' ||
       has_function_privilege('anon', 'public.mes_ecarts_caisse()', 'execute')::text,
       case when corps like 'REFUSÉ%'
             and not has_function_privilege('anon', 'public.mes_ecarts_caisse()', 'execute')
            then 'OK' else 'ÉCHEC' end
  from _corps where qui = 'anon' and quoi = 'TENTATIVE';

-- Un seul relevé, détail puis conclusion : un exécuteur qui ne rend que le
-- dernier résultat rendrait sinon la conclusion sans ce qui la fonde.
select lpad(ordre::text, 2, '0') as ordre, controle, verdict, obtenu
  from _preuve
union all
select 'TOTAL',
       count(*)::text || ' contrôle(s)',
       case when count(*) filter (where verdict like 'ÉCHEC%') = 0
            then 'PREUVE TENUE' else 'PREUVE NON TENUE' end,
       count(*) filter (where verdict like 'ÉCHEC%')::text || ' échec(s)'
  from _preuve
 order by 1;


rollback;
`;

process.stdout.write(sql);
