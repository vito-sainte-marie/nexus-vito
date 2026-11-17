-- Retour arrière T2, cas 1 : BASE JETABLE ou projet Test SANS donnée tarifaire (PROJET, NON EXÉCUTÉ).
-- Supprime vues, déclencheurs, fonctions et tables T2. Refuse de s'exécuter si une seule ligne existe dans un registre :
-- dans ce cas, utiliser retour_arriere_avec_donnees_t2.sql. Ne touche à aucune table existante (produits_appel, etc.).
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
declare t text; n bigint; total bigint := 0;
begin
  foreach t in array array['tarif_familles','tarif_rattachements','tarif_seuils','tarif_reglages','tarif_exceptions','tarif_prix_decides',
                           'tarif_prix_application','tarif_regimes_prix','tarif_controles_reglementaires','tarif_decisions'] loop
    if to_regclass('public.' || t) is not null then
      execute format('select count(*) from public.%I', t) into n;   -- exécuté par postgres (BYPASSRLS) : compte tous les sites
      total := total + n;
    end if;
  end loop;
  if total > 0 then
    raise exception 'retour_arriere_refuse : % ligne(s) dans les registres T2, utiliser retour_arriere_avec_donnees_t2.sql', total;
  end if;
end $$;
drop view if exists v_tarif_incoherences, v_tarif_exceptions_effectives, v_tarif_prix_application_actifs,
  v_tarif_familles_actifs, v_tarif_rattachements_actifs, v_tarif_seuils_actifs, v_tarif_reglages_actifs, v_tarif_exceptions_actifs,
  v_tarif_prix_decides_actifs, v_tarif_regimes_prix_actifs, v_tarif_controles_reglementaires_actifs;
drop table if exists tarif_decisions, tarif_prix_application, tarif_controles_reglementaires, tarif_regimes_prix, tarif_prix_decides,
  tarif_exceptions, tarif_reglages, tarif_seuils, tarif_rattachements, tarif_familles;
drop function if exists tarif_controle_version(), tarif_controle_retrogradation(), tarif_controle_famille(), tarif_controle_application(),
  tarif_statut_exception(uuid), tarif_etat_controle(uuid), tarif_cle_reference(text, text);
commit;
