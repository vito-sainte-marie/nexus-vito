-- NEXUS Scanner T3 : RETOUR ARRIÈRE de la migration décision-journal sur Supabase Test (PROJET, NON EXÉCUTÉ).
-- Jamais automatique : exécuté seulement sur décision écrite, après constat d'un écart. Production non concernée.
-- Aucune donnée tarifaire supprimée : les liens journal vers prix décidé sont d'abord archivés dans un schéma daté,
-- fermé à anon, authenticated et service_role ; les prix décidés et les lignes de journal restent en place.
-- L'entrée de supabase_migrations reste (historique) ; le retour arrière est consigné dans le compte rendu.
begin;
-- GARDE PROJET TEST (obligatoire, en tête de transaction) : identifiant système du cluster propre au projet Supabase Test
-- udljdqxerrbbbajxubfn, puis sites de recette. Toute autre base, Production comprise, est refusée avant la moindre écriture.
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
declare v_arch text := 'archive_tarif_t3_' || to_char(now() at time zone 'America/Martinique', 'YYYYMMDD_HH24MI');
        n int;
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tarif_decisions' and column_name = 'prix_decide_id') then
    raise exception 'retour_arriere_sans_objet : la migration décision-journal n est pas en place';
  end if;
  execute format('create schema %I', v_arch);
  execute format('create table %I.tarif_decisions_liens as select id, site, prix_decide_id, saisi_le from public.tarif_decisions where prix_decide_id is not null', v_arch);
  get diagnostics n = row_count;
  execute format('revoke all on schema %I from public, anon, authenticated, service_role', v_arch);
  execute format('revoke all on all tables in schema %I from public, anon, authenticated, service_role', v_arch);
  raise notice 'liens archivés dans %.tarif_decisions_liens : %', v_arch, n;
end $$;
drop function if exists public.tarif_enregistrer_decisions(jsonb);
drop trigger if exists tarif_decisions_lien on public.tarif_decisions;
drop function if exists public.tarif_controle_decision_lien();
drop index if exists public.tarif_decisions_prix_decide_uq;
alter table public.tarif_decisions drop constraint if exists tarif_decisions_prix_meme_site_fk;
alter table public.tarif_decisions drop constraint if exists tarif_decisions_lien_prix;
alter table public.tarif_decisions drop column if exists prix_decide_id;
commit;
