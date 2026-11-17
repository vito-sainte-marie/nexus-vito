-- Retour arrière T2, cas 2 : environnement CONTENANT des données tarifaires (PROJET, NON EXÉCUTÉ, GO distinct requis).
-- Ne détruit aucune ligne. 1) copie les dix registres dans un schéma d'archive daté, 2) vérifie les comptes ligne à ligne,
-- 3) retire tout accès aux registres et à l'archive pour anon, authenticated et service_role, 4) supprime les vues,
-- ce qui débranche NEXUS Scanner. Les tables et leurs déclencheurs restent en place, inaccessibles hors postgres.
-- Leur suppression définitive fera l'objet d'une décision séparée, archive vérifiée.
begin;
-- GARDE PROJET TEST (obligatoire, en tête de transaction). Identité vérifiée : l'identifiant système du cluster
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
do $$
declare
  arch text := 'archive_tarif_t2_' || to_char(now() at time zone 'America/Martinique', 'YYYYMMDD_HH24MI');
  t text; n_src bigint; n_arc bigint;
begin
  if exists (select 1 from pg_namespace where nspname = arch) then
    raise exception 'archive % déjà présente : relancer une minute plus tard', arch;
  end if;
  execute format('create schema %I', arch);
  execute format('revoke all on schema %I from public, anon, authenticated, service_role', arch);
  foreach t in array array['tarif_familles','tarif_rattachements','tarif_seuils','tarif_reglages','tarif_exceptions','tarif_prix_decides',
                           'tarif_prix_application','tarif_regimes_prix','tarif_controles_reglementaires','tarif_decisions'] loop
    execute format('create table %I.%I as table public.%I', arch, t, t);
    execute format('select count(*) from public.%I', t) into n_src;
    execute format('select count(*) from %I.%I', arch, t) into n_arc;
    if n_src <> n_arc then
      raise exception 'archive incomplète pour % : % lignes en source, % archivées', t, n_src, n_arc;
    end if;
    execute format('revoke all on %I.%I from public, anon, authenticated, service_role', arch, t);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role', t);
    raise notice 'archivé % : % lignes', t, n_arc;
  end loop;
  execute format('comment on schema %I is %L', arch, 'Archive des registres tarifaires T2 avant retour arrière. Ne pas modifier.');
end $$;
drop view if exists v_tarif_incoherences, v_tarif_exceptions_effectives, v_tarif_prix_application_actifs,
  v_tarif_familles_actifs, v_tarif_rattachements_actifs, v_tarif_seuils_actifs, v_tarif_reglages_actifs, v_tarif_exceptions_actifs,
  v_tarif_prix_decides_actifs, v_tarif_regimes_prix_actifs, v_tarif_controles_reglementaires_actifs;
commit;
