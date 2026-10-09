-- SITE-EXPLICITE-1 / 2B-SECURITY-WRITE-GUARD (06/09/2026)
--
-- CE QUE LA PHASE 2A A PROUVÉ. Sous l'identité d'un pompiste de
-- `nexus-station-test`, en session réelle :
--
--     insert into pointages (…, site) values (…, 'site-fantome-test') → ACCEPTE
--
-- La politique `insert_own_pointage` ne contrôlait que `employee_id`. Le site
-- n'était vérifié à aucun moment : un employé pouvait écrire un pointage sur
-- n'importe quel site qu'il nommait. Ce n'est pas le défaut de colonne qui
-- décidait — c'était l'absence totale de contrôle.
--
-- C'est pourquoi la policy doit être fermée AVANT le client : corriger l'écran
-- pour qu'il envoie le bon site ne ferme rien si un appel direct à l'API peut
-- toujours en nommer un autre.
--
-- CE QUE CETTE MIGRATION NE FAIT PAS. Aucun défaut de colonne n'est retiré.
-- Aucune politique n'est affaiblie. Aucune branche d'écriture n'est ouverte au
-- profil créateur : sa capacité transverse est une capacité de LECTURE, et
-- l'étendre à l'écriture serait une extension de privilège que rien ne
-- demande.
--
-- TROIS TABLES, TROIS CONTRATS. L'uniformité syntaxique serait une erreur :
-- chaque table a ses écrivains légitimes et sa notion de site.

-- ── 1. pointages ────────────────────────────────────────────────────────
-- Écrivain légitime : l'employé lui-même, et lui seul — aucun chemin manager
-- n'insère de pointage (vérifié dans l'applicatif). La notion de site est
-- donc celle du compte.
--
-- `current_employee_site_id()` renvoie NULL pour un compte authentifié sans
-- ligne `employees` ; la comparaison est alors NULL, donc fausse, donc
-- refusée. Fail-closed sans clause supplémentaire.
drop policy if exists insert_own_pointage on public.pointages;
create policy insert_own_pointage on public.pointages
  for insert to public
  with check (
    employee_id = (select auth.uid())
    and site = (select public.current_employee_site_id())
  );

comment on policy insert_own_pointage on public.pointages is
  '2B-SECURITY-WRITE-GUARD — un employé ne peut pointer que sur SON site. Avant cette migration, seul employee_id était contrôlé : un site arbitraire était accepté (prouvé en Phase 2A, famille F2).';

-- ── 2. mission_completions ──────────────────────────────────────────────
-- Écrivains légitimes : l'employé insère sa complétion ; le manager AJUSTE
-- des points, mais par UPDATE (`manager_ajuste_points`), qui contrôle déjà le
-- site. On ne touche donc qu'à l'INSERT, et on n'ouvre aucune insertion
-- manager qui n'existe pas aujourd'hui.
--
-- Pas de `shift_id` sur cette table : la complétion n'est pas rattachée à un
-- service, le site du compte est la seule référence disponible.
drop policy if exists employee_own_completions_insert on public.mission_completions;
create policy employee_own_completions_insert on public.mission_completions
  for insert to public
  with check (
    employee_id = (select auth.uid())
    and site_id = (select public.current_employee_site_id())
  );

comment on policy employee_own_completions_insert on public.mission_completions is
  '2B-SECURITY-WRITE-GUARD — l''employé ne valide une mission que sur son site. L''ajustement de points par le manager reste un UPDATE distinct, déjà borné au site.';

-- ── 3. mission_progress ─────────────────────────────────────────────────
-- Contrat PLUS FORT que les deux précédents, et c'est la raison de ne pas
-- copier la même règle : `shift_id` est NOT NULL. Une progression est donc
-- toujours rattachée à un service, et un service porte lui-même un employé et
-- un site. Se contenter du site du compte laisserait passer une progression
-- rattachée au service de quelqu'un d'autre.
--
-- On exige donc les trois cohérences ensemble : l'employé est bien l'auteur,
-- le service est bien le sien, et le site déclaré est bien celui du service.
-- L'`exists` est évalué sous la RLS de l'appelant : un service qu'il ne peut
-- pas lire ne peut pas non plus lui servir d'ancrage — fail-closed par
-- construction.
drop policy if exists employee_own_progress_upsert on public.mission_progress;
create policy employee_own_progress_upsert on public.mission_progress
  for insert to public
  with check (
    employee_id = (select auth.uid())
    and site_id = (select public.current_employee_site_id())
    and exists (
      select 1 from public.shifts s
       where s.id = mission_progress.shift_id
         and s.employee_id = mission_progress.employee_id
         and s.site_id = mission_progress.site_id
    )
  );

comment on policy employee_own_progress_upsert on public.mission_progress is
  '2B-SECURITY-WRITE-GUARD — contrat plus strict que pointages et mission_completions : shift_id étant NOT NULL, la progression doit être cohérente avec le service qui la porte — même employé, même site. Le site du compte seul ne suffirait pas.';

-- L'UPDATE de la progression ne contrôlait que l'employé ; sans `with check`,
-- une mise à jour pouvait déplacer la ligne vers un autre site. On aligne la
-- condition d'arrivée sur celle de l'insertion, sans élargir le `using`.
drop policy if exists employee_own_progress_update on public.mission_progress;
create policy employee_own_progress_update on public.mission_progress
  for update to public
  using (employee_id = (select auth.uid()))
  with check (
    employee_id = (select auth.uid())
    and site_id = (select public.current_employee_site_id())
  );

comment on policy employee_own_progress_update on public.mission_progress is
  '2B-SECURITY-WRITE-GUARD — l''UPDATE n''avait aucun with check : une ligne pouvait être déplacée vers un autre site après coup.';

-- ── Contrôle fail-closed ────────────────────────────────────────────────
-- Les quatre politiques doivent exister et mentionner le site. Sans ce
-- contrôle, une faute de frappe dans un nom laisserait la table sans
-- politique d'insertion — donc fermée, mais pour la mauvaise raison, et sans
-- que rien ne le signale.
do $$
declare
  v_manquantes text := '';
  v_nom text; v_table text; v_expr text;
begin
  foreach v_nom in array array[
    'insert_own_pointage','employee_own_completions_insert',
    'employee_own_progress_upsert','employee_own_progress_update'] loop
    select c.relname, coalesce(pg_get_expr(p.polwithcheck, p.polrelid),'')
      into v_table, v_expr
      from pg_policy p join pg_class c on c.oid = p.polrelid
     where p.polname = v_nom;
    if v_table is null then
      v_manquantes := v_manquantes || v_nom || ' (absente) ';
    elsif v_expr not like '%current_employee_site_id%' then
      v_manquantes := v_manquantes || v_nom || ' (sans contrôle de site) ';
    end if;
  end loop;

  if v_manquantes <> '' then
    raise exception '2B-SECURITY-WRITE-GUARD interrompu : %', v_manquantes;
  end if;
end;
$$;
