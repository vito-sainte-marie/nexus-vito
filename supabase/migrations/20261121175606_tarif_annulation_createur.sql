-- NEXUS Scanner tarifaire : le compte créateur peut ANNULER une vérification (ou une réévaluation), mais ne vérifie toujours pas.
-- Décision du pilote du 21/11/2026. Avant : seule la policy annulation_roles_meme_site existait (gérant du site, ou manager pour sa propre saisie),
-- donc le créateur voyait une vérification sans pouvoir l'annuler. Après : une troisième branche l'autorise.
-- Choix de périmètre : la branche utilise le même test que la lecture (je_suis_createur() et sites.acces_createur_autorise pour le site de la ligne).
-- Le créateur n'annule donc que ce qu'il peut lire, sur les sites qui l'autorisent, et jamais ailleurs.
-- Inchangé : insertion (le créateur ne vérifie pas ; tarif_marquer_verifie refuse toujours avec tarif_verif_createur_lecture_seule),
-- using annule_le is null, with check annule_le is not null et annule_par = auth.uid(), UPDATE limité aux trois colonnes d'annulation,
-- heure d'annulation fixée par le serveur (déclencheur 20261120124007), motif obligatoire (contrainte de table), aucun DELETE.
-- Aucune donnée existante n'est modifiée. Idempotente : drop policy if exists puis create policy.

do $prerequis$
declare v_manque text;
begin
  select string_agg(o, ', ') into v_manque
  from unnest(array['public.tarif_anomalies_verifications', 'public.tarif_anomalies_reevaluations']) as o
  where to_regclass(o) is null;
  if v_manque is not null then
    raise exception 'prerequis_migrations : 20261121100000_tarif_annulation_createur : objets absents : % (appliquer d abord 20261118120000)', v_manque;
  end if;
  if to_regprocedure('public.je_suis_createur()') is null or to_regprocedure('public.tarif_annulation_heure_serveur()') is null then
    raise exception 'prerequis_migrations : 20261121100000_tarif_annulation_createur : je_suis_createur ou le declencheur d heure serveur absent (appliquer d abord 20261120124007)';
  end if;
end $prerequis$;

do $$
declare
  t text;
  manager text := 'site = (select current_employee_site_id()) and (select current_employee_role()) in (''manager'',''gerant'')';
  gerant text := 'site = (select current_employee_site_id()) and (select current_employee_role()) = ''gerant''';
  createur text := '(select je_suis_createur()) and exists (select 1 from sites s where s.site_id = %I.site and s.acces_createur_autorise)';
begin
  foreach t in array array['tarif_anomalies_verifications','tarif_anomalies_reevaluations'] loop
    execute format('drop policy if exists annulation_roles_meme_site on %I', t);
    execute format('create policy annulation_roles_meme_site on %I for update to authenticated using (((%s) or (%s and saisi_par = (select auth.uid())) or (%s)) and annule_le is null) with check (annule_le is not null and annule_par = (select auth.uid()))',
      t, gerant, manager, format(createur, t));
  end loop;
end $$;
