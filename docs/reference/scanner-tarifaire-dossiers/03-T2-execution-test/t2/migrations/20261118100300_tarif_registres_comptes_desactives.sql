-- NEXUS Scanner, politique tarifaire T2 : blocage des comptes désactivés (PROJET, NON EXÉCUTÉ).
-- Dépend de 20261118100000, 100100 et 100200. Cible : Test uniquement, après GO écrit. Production non concernée.
--
-- Constat (catalogue de Test relu le 16/11/2026) : current_employee_role() et current_employee_site_id() ne lisent pas
-- employees.actif. Aucune politique, aucun déclencheur, aucun hook d'authentification et aucune fonction Edge ne le
-- lisent à leur place. Un compte désactivé dont la session reste valide garde donc son rôle sur les registres T2.
--
-- Correction isolée : une politique RESTRICTIVE par registre, combinée en ET avec les politiques existantes.
-- Elle ne peut que retirer un accès, jamais en ajouter. Aucune fonction nouvelle, aucun SECURITY DEFINER :
-- la personne lit sa propre ligne employees, ce que la politique select_employees lui permet déjà.
-- Les fonctions d'aide partagées par NEXUS ne sont pas modifiées (hors périmètre T2).
-- Ordre obligatoire : cette migration passe en DERNIER. Elle vérifie que les trois précédentes sont en place.

-- GARDE PROJET TEST : première instruction de la migration, avant toute modification de la base. Identité vérifiée : l'identifiant système du cluster
-- PostgreSQL, fixé à sa création et propre au projet Supabase Test udljdqxerrbbbajxubfn (relu le 16/11/2026).
-- Toute autre base, Production comprise, est refusée avant la moindre écriture. Seconde vérification : sites de recette.
do $garde$
declare v_sysid bigint := (select system_identifier from pg_control_system());
begin
  if v_sysid is distinct from 7678069749886157684 then
    raise exception 'garde_projet_test : identifiant système % : ce n est pas le projet Supabase Test udljdqxerrbbbajxubfn', v_sysid;
  end if;
  if (select count(*) from public.sites where site_id in ('site-fantome-test', 'nexus-station-test')) <> 2 then
    raise exception 'garde_projet_test : sites de recette absents';
  end if;
end $garde$;

do $$ begin
  if (select count(*) from pg_tables where schemaname = 'public' and tablename like 'tarif\_%') <> 10
     or to_regprocedure('public.tarif_controle_retrogradation()') is null
     or to_regclass('public.v_tarif_incoherences') is null then
    raise exception 'ordre_migrations : appliquer 20261118100000, 100100 et 100200 avant 20261118100300';
  end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array['tarif_familles','tarif_rattachements','tarif_seuils','tarif_reglages','tarif_exceptions','tarif_prix_decides',
                           'tarif_prix_application','tarif_regimes_prix','tarif_controles_reglementaires','tarif_decisions'] loop
    execute format('drop policy if exists compte_actif_obligatoire on %I', t);
    execute format('create policy compte_actif_obligatoire on %I as restrictive for all to authenticated
      using (exists (select 1 from employees e where e.id = (select auth.uid()) and e.actif))
      with check (exists (select 1 from employees e where e.id = (select auth.uid()) and e.actif))', t);
  end loop;
end $$;

-- La vue des exceptions effectives reprend produits_appel, dont la politique de lecture ignore aussi employees.actif.
-- Même définition que 20261118100200, avec la seule condition de compte actif sur la branche produits_appel.
create or replace view v_tarif_exceptions_effectives with (security_invoker = true) as
with registre as (
  select e.site, e.article, e.code_barres, e.cle, e.type, e.statut, e.motif, e.cond_prix_ttc, e.cond_tolerance_cout, e.cond_cout_reference,
         e.id, e.saisi_le, lower(regexp_replace(btrim(coalesce(e.article, '')), '\s+', ' ', 'g')) as libelle_norm
  from v_tarif_exceptions_actifs e
),
appel as (
  select pa.site, pa.article, pa.id, pa.ajoute_le, s.timezone, lower(regexp_replace(btrim(pa.article), '\s+', ' ', 'g')) as libelle_norm
  from produits_appel pa join sites s on s.site_id = pa.site
  -- produits_appel est une table NEXUS existante, lisible par tout employé du site, actif ou non :
  -- la vue tarifaire ne la reprend que pour un compte actif (ou pour un rôle technique hors authenticated).
  where (select current_user) <> 'authenticated'
     or exists (select 1 from employees e where e.id = (select auth.uid()) and e.actif)
),
candidats as (
  -- priorité 1 : décision du gérant
  select r.site, r.article, r.code_barres, r.cle, r.type, r.statut, r.motif, r.cond_prix_ttc, r.cond_tolerance_cout, r.cond_cout_reference,
         'tarif_exceptions'::text as source, r.id as source_id, r.saisi_le, 1 as priorite, null::text as en_attente
  from registre r where r.statut in ('validee', 'levee')
  union all
  -- priorité 2 : produit d'appel enregistré, non couvert par une décision du gérant
  select a.site, a.article, null, tarif_cle_reference(null, a.article), 'produit_appel', 'validee',
         'enregistré dans produits_appel le ' || to_char(a.ajoute_le at time zone a.timezone, 'DD/MM/YYYY'),
         null::numeric, null::numeric, null::numeric, 'produits_appel', a.id, a.ajoute_le, 2,
         (select string_agg(r.statut || ' du ' || to_char(r.saisi_le at time zone a.timezone, 'DD/MM/YYYY'), ', ')
            from registre r where r.site = a.site and r.statut in ('candidate', 'refusee')
              and (r.libelle_norm = a.libelle_norm or r.cle = tarif_cle_reference(null, a.article)))
  from appel a
  where not exists (select 1 from registre r where r.site = a.site and r.statut in ('validee', 'levee')
                      and (r.libelle_norm = a.libelle_norm or r.cle = tarif_cle_reference(null, a.article)))
  union all
  -- priorité 3 : candidature ou refus sans produit d'appel enregistré
  select r.site, r.article, r.code_barres, r.cle, r.type, r.statut, r.motif, r.cond_prix_ttc, r.cond_tolerance_cout, r.cond_cout_reference,
         'tarif_exceptions', r.id, r.saisi_le, 3, null
  from registre r
  where r.statut in ('candidate', 'refusee')
    and not exists (select 1 from appel a where a.site = r.site and (r.libelle_norm = a.libelle_norm or r.cle = tarif_cle_reference(null, a.article)))
)
select site, article, code_barres, cle, type, statut, motif, cond_prix_ttc, cond_tolerance_cout, cond_cout_reference, source, source_id, saisi_le,
       en_attente as candidature_ou_refus_sans_effet
from candidats;
revoke all on v_tarif_exceptions_effectives from anon, public, authenticated, service_role;
grant select on v_tarif_exceptions_effectives to authenticated, service_role;

