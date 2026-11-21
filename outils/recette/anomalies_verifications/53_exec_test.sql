-- NEXUS Scanner tarifaire : script AUTONOME de l'epreuve 53 pour Test (projet udljdqxerrbbbajxubfn). UNE seule transaction, rien ne subsiste.
-- Ordre : 1) garde du projet, 2) les trois migrations 20261118120000, 20261120124007, 20261121100000 (texte identique aux fichiers de supabase/migrations, verifie par test_script_53_autonome.js),
--         3) le corps de 53_annulation_createur.sql, 4) le `raise exception 'RAPPORT_53 ...'` final qui defait TOUT, migrations comprises.
-- Test n'a pas les tables tarifaires en permanence : les migrations ne vivent que dans cette transaction. Le script ne cree rien de durable.
-- Aucune ecriture hors transaction. Comptes et lots fictifs (articles « essai-c... »). Production : jamais.
begin;
do $garde_projet$
begin
  if (select system_identifier from pg_control_system()) is distinct from 7678069749886157684 then
    raise exception 'garde_projet_test : ce n est pas le projet Supabase Test udljdqxerrbbbajxubfn : rien n est applique';
  end if;
end $garde_projet$;
-- >>> DEBUT migration 20261118120000_tarif_anomalies_verifications.sql
-- NEXUS Scanner, anomalies tarifaires : vérifications et réévaluations, applicable après les migrations T2 et le journal des décisions.
-- Dépend des migrations T2 (20261117020430, 020652, 020851, 021059) et du journal 20261117161325.
-- Additive : deux tables d'ajout seul, deux fonctions SECURITY INVOKER. Aucune donnée existante modifiée.
-- Aucune écriture Decenium. Le site n'est jamais un paramètre : il est lu dans la ligne employees de la personne connectée.
-- Retour arrière : docs/deploiement/retour-arriere-tarif-anomalies-verifications-20261118.sql (ne retire que ces quatre objets).

-- Prérequis : la migration s'arrête avant toute écriture si un objet attendu manque (aucune identité de projet n'est supposée).
do $prerequis$
declare v_manque text;
begin
  select string_agg(o, ', ') into v_manque from unnest(array['public.sites', 'public.employees', 'public.import_batches', 'public.tarif_familles', 'public.tarif_rattachements', 'public.tarif_seuils', 'public.tarif_reglages', 'public.tarif_exceptions', 'public.tarif_prix_decides', 'public.tarif_prix_application', 'public.tarif_regimes_prix', 'public.tarif_controles_reglementaires', 'public.tarif_decisions']) as o where to_regclass(o) is null;
  if v_manque is not null then
    raise exception 'prerequis_migrations : 20261118120000 (appliquer 20261117020430 à 20261117161325 avant) : objets absents : %', v_manque;
  end if;
end $prerequis$;

do $$ begin
  if to_regclass('public.tarif_decisions') is null or to_regprocedure('public.tarif_enregistrer_decisions(jsonb)') is null
     or not exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'compte_actif_obligatoire') then
    raise exception 'ordre_migrations : appliquer les migrations T2 et le journal des décisions avant 20261118120000';
  end if;
end $$;

-- 1. Vérifications : « ✓ Marquer comme vérifié ». Ajout seul ; l'annulation est tracée (qui, quand, pourquoi).
create table if not exists tarif_anomalies_verifications (
  id uuid primary key default gen_random_uuid(),
  site text not null references sites(site_id),
  article text, code_barres text,
  cause text not null check (cause in ('S1','S2','S3','S4','S5','S6','S7')),
  empreinte text not null check (length(btrim(empreinte)) > 0),
  fichier_hash text not null check (length(btrim(fichier_hash)) > 0),
  date_releve date,
  -- Traçabilité : ce que le moteur a constaté au moment de la vérification (gravité comprise : le cycle de vie la compare à la suivante).
  gravite numeric not null check (gravite >= 0),
  niveau text,
  valeurs jsonb not null check (jsonb_typeof(valeurs) = 'object'),
  periode_debut date, periode_fin date,
  import_batch_id uuid not null references import_batches(id),
  moteur_version text not null check (length(btrim(moteur_version)) > 0),
  commentaire text,
  saisi_par uuid not null default auth.uid() references employees(id),
  saisi_le timestamptz not null default now(),
  annule_le timestamptz, annule_par uuid references employees(id), motif_annulation text,
  cle text generated always as (tarif_cle_reference(code_barres, article)) stored,
  constraint tarif_anom_verif_cible check (tarif_cle_reference(code_barres, article) is not null),
  constraint tarif_anom_verif_annulation check ((annule_le is null and annule_par is null and motif_annulation is null)
    or (annule_le is not null and annule_par is not null and length(btrim(coalesce(motif_annulation, ''))) > 0)),
  constraint tarif_anom_verif_commentaire_long check (commentaire is null or char_length(commentaire) <= 500),
  constraint tarif_anom_verif_motif_long check (motif_annulation is null or char_length(motif_annulation) <= 500),
  constraint tarif_anom_verif_id_site unique (id, site)
);
-- Idempotence : une seule vérification active par site, référence, cause, empreinte et fichier importé. Une nouvelle vérification sur un nouvel import crée donc une nouvelle ligne (l'historique garde les deux).
create unique index if not exists tarif_anom_verif_active_uq on tarif_anomalies_verifications (site, cle, cause, empreinte, fichier_hash) where annule_le is null;
create index if not exists tarif_anom_verif_site_cle on tarif_anomalies_verifications (site, cle);

-- 2. Réévaluations : ce que le moteur constate à un nouvel import pour une anomalie déjà vérifiée. Ajout seul.
create table if not exists tarif_anomalies_reevaluations (
  id uuid primary key default gen_random_uuid(),
  site text not null references sites(site_id),
  article text, code_barres text,
  verification_id uuid not null,
  etat text not null check (etat in ('persistante','aggravee','resolue')),
  fichier_hash text not null check (length(btrim(fichier_hash)) > 0),
  date_releve date,
  empreinte text,
  gravite numeric check (gravite >= 0),
  valeurs jsonb check (valeurs is null or jsonb_typeof(valeurs) = 'object'),
  saisi_par uuid not null default auth.uid() references employees(id),
  saisi_le timestamptz not null default now(),
  annule_le timestamptz, annule_par uuid references employees(id), motif_annulation text,
  cle text generated always as (tarif_cle_reference(code_barres, article)) stored,
  constraint tarif_anom_reeval_cible check (tarif_cle_reference(code_barres, article) is not null),
  constraint tarif_anom_reeval_verif_fk foreign key (verification_id, site) references tarif_anomalies_verifications (id, site),
  constraint tarif_anom_reeval_annulation check ((annule_le is null and annule_par is null and motif_annulation is null)
    or (annule_le is not null and annule_par is not null and length(btrim(coalesce(motif_annulation, ''))) > 0)),
  constraint tarif_anom_reeval_motif_long check (motif_annulation is null or char_length(motif_annulation) <= 500)
);
create unique index if not exists tarif_anom_reeval_active_uq on tarif_anomalies_reevaluations (verification_id, fichier_hash) where annule_le is null;

comment on table tarif_anomalies_verifications is 'Anomalies tarifaires marquées vérifiées par un manager ou le gérant. Ajout seul, annulation tracée. Ne modifie aucun prix ni aucune donnée Decenium.';
comment on table tarif_anomalies_reevaluations is 'Résultat d une réévaluation à un nouvel import pour une vérification existante. Ajout seul, annulation tracée.';

-- 3. RLS : lecture manager et gérant du site (créateur seulement si le site l'autorise) ; écriture manager et gérant du site.
--    Annulation : gérant, ou manager pour ce qu'il a saisi. Aucun DELETE ni TRUNCATE ; UPDATE limité aux colonnes d'annulation.
do $$
declare
  t text;
  lecture text := '(site = (select current_employee_site_id()) and (select current_employee_role()) in (''manager'',''gerant''))
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = %I.site and s.acces_createur_autorise))';
  manager text := 'site = (select current_employee_site_id()) and (select current_employee_role()) in (''manager'',''gerant'')';
  gerant text := 'site = (select current_employee_site_id()) and (select current_employee_role()) = ''gerant''';
begin
  foreach t in array array['tarif_anomalies_verifications','tarif_anomalies_reevaluations'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists lecture_meme_site on %I', t);
    execute format('create policy lecture_meme_site on %I for select to authenticated using (%s)', t, format(lecture, t));
    execute format('drop policy if exists insertion_roles_meme_site on %I', t);
    execute format('create policy insertion_roles_meme_site on %I for insert to authenticated with check ((%s) and saisi_par = (select auth.uid()) and annule_le is null)', t, manager);
    execute format('drop policy if exists annulation_roles_meme_site on %I', t);
    execute format('create policy annulation_roles_meme_site on %I for update to authenticated using (((%s) or (%s and saisi_par = (select auth.uid()))) and annule_le is null) with check (annule_le is not null and annule_par = (select auth.uid()))', t, gerant, manager);
    execute format('drop policy if exists compte_actif_obligatoire on %I', t);
    execute format('create policy compte_actif_obligatoire on %I as restrictive for all to authenticated
      using (exists (select 1 from employees e where e.id = (select auth.uid()) and e.actif))
      with check (exists (select 1 from employees e where e.id = (select auth.uid()) and e.actif))', t);
    execute format('revoke all on %I from anon, public, authenticated, service_role', t);
    execute format('grant select, insert on %I to authenticated, service_role', t);
    execute format('grant update (annule_le, annule_par, motif_annulation) on %I to authenticated, service_role', t);
  end loop;
end $$;

-- Le lot d'import cité par une vérification doit appartenir au site de la personne (import_batches n'a pas de clé (id, site) : politique restrictive).
drop policy if exists lot_import_meme_site on tarif_anomalies_verifications;
create policy lot_import_meme_site on tarif_anomalies_verifications as restrictive for insert to authenticated
  with check (exists (select 1 from import_batches b where b.id = import_batch_id and b.site = tarif_anomalies_verifications.site));

-- 4. Marquer des anomalies comme vérifiées, par lot, tout ou rien. SECURITY INVOKER : la RLS s'applique à chaque insertion.
--    Champs admis par ligne, et aucun autre (le site est refusé) : article, code_barres, cause, empreinte, fichier_hash, date_releve, commentaire,
--    gravite, niveau, valeurs, periode_debut, periode_fin, import_batch_id, moteur_version (traçabilité du constat).
--    Idempotent : une vérification active identique n'est pas dupliquée, son identifiant est rendu avec o_deja = true.
create or replace function tarif_marquer_verifie(p_lignes jsonb)
returns table (o_id uuid, o_cle text, o_deja boolean)
language plpgsql volatile security invoker set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_emp record;
  l jsonb;
  v_cle text;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'tarif_verif_session_absente : aucune personne connectée' using errcode = 'P0001';
  end if;
  select e.actif, e.role, e.site_id, e.est_createur into v_emp from employees e where e.id = v_uid;
  if not found then raise exception 'tarif_verif_compte_illisible : fiche employé introuvable' using errcode = 'P0001'; end if;
  if not v_emp.actif then raise exception 'tarif_verif_compte_inactif : compte désactivé' using errcode = 'P0001'; end if;
  if v_emp.est_createur then raise exception 'tarif_verif_createur_lecture_seule : le créateur ne vérifie pas' using errcode = 'P0001'; end if;
  if v_emp.role is null or v_emp.role not in ('manager','gerant') then
    raise exception 'tarif_verif_reservee_manager_gerant : réservé au manager et au gérant' using errcode = 'P0001';
  end if;
  if p_lignes is null or jsonb_typeof(p_lignes) <> 'array' or jsonb_array_length(p_lignes) not between 1 and 200 then
    raise exception 'tarif_verif_lot_invalide : de 1 à 200 anomalies par appel' using errcode = 'P0001';
  end if;
  for l in select value from jsonb_array_elements(p_lignes) loop
    if jsonb_typeof(l) <> 'object' or exists (select 1 from jsonb_object_keys(l) k where k not in
         ('article','code_barres','cause','empreinte','fichier_hash','date_releve','commentaire',
          'gravite','niveau','valeurs','periode_debut','periode_fin','import_batch_id','moteur_version')) then
      raise exception 'tarif_verif_champ_inconnu : champ non admis (le site n est jamais transmis)' using errcode = 'P0001';
    end if;
    v_cle := tarif_cle_reference(l->>'code_barres', l->>'article');
    if v_cle is null then raise exception 'tarif_verif_reference_absente : code-barres ou libellé obligatoire' using errcode = 'P0001'; end if;
    if (l->>'import_batch_id') is null or not exists (select 1 from import_batches b
         where b.id = (l->>'import_batch_id')::uuid and b.site = v_emp.site_id and (b.fichier_hash is null or b.fichier_hash = l->>'fichier_hash')) then
      raise exception 'tarif_verif_lot_import_incoherent : le lot d import doit exister, appartenir au site et porter ce fichier_hash' using errcode = 'P0001';
    end if;
    if char_length(btrim(coalesce(l->>'commentaire',''))) > 500 then
      raise exception 'tarif_verif_commentaire_trop_long : le commentaire est limité à 500 caractères' using errcode = 'P0001';
    end if;
    select v.id into v_id from tarif_anomalies_verifications v
      where v.site = v_emp.site_id and v.cle = v_cle and v.cause = l->>'cause' and v.empreinte = l->>'empreinte' and v.fichier_hash = l->>'fichier_hash' and v.annule_le is null;
    if v_id is not null then
      o_id := v_id; o_cle := v_cle; o_deja := true; return next;
    else
      insert into tarif_anomalies_verifications (site, article, code_barres, cause, empreinte, fichier_hash, date_releve, commentaire,
              gravite, niveau, valeurs, periode_debut, periode_fin, import_batch_id, moteur_version)
      values (v_emp.site_id, l->>'article', l->>'code_barres', l->>'cause', l->>'empreinte', l->>'fichier_hash',
              nullif(l->>'date_releve','')::date, nullif(btrim(l->>'commentaire'),''),
              (l->>'gravite')::numeric, nullif(l->>'niveau',''), l->'valeurs', nullif(l->>'periode_debut','')::date,
              nullif(l->>'periode_fin','')::date, (l->>'import_batch_id')::uuid, l->>'moteur_version')
      returning id into v_id;
      o_id := v_id; o_cle := v_cle; o_deja := false; return next;
    end if;
  end loop;
end $$;
revoke all on function tarif_marquer_verifie(jsonb) from public, anon, authenticated, service_role;
grant execute on function tarif_marquer_verifie(jsonb) to authenticated;

-- 5. Enregistrer les réévaluations d'un nouvel import. Idempotent par (vérification, fichier_hash).
--    Champs admis : verification_id, article, code_barres, etat, fichier_hash, date_releve, empreinte, gravite, valeurs.
--    La clé et la cause de la ligne doivent correspondre à la vérification citée, sinon tarif_reeval_incoherente.
create or replace function tarif_enregistrer_reevaluations(p_lignes jsonb)
returns table (o_id uuid, o_deja boolean)
language plpgsql volatile security invoker set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_emp record;
  l jsonb;
  v_id uuid;
  v_ver record;
begin
  if v_uid is null then
    raise exception 'tarif_reeval_session_absente : aucune personne connectée' using errcode = 'P0001';
  end if;
  select e.actif, e.role, e.site_id, e.est_createur into v_emp from employees e where e.id = v_uid;
  if not found then raise exception 'tarif_reeval_compte_illisible : fiche employé introuvable' using errcode = 'P0001'; end if;
  if not v_emp.actif then raise exception 'tarif_reeval_compte_inactif : compte désactivé' using errcode = 'P0001'; end if;
  if v_emp.est_createur then raise exception 'tarif_reeval_createur_lecture_seule : le créateur n enregistre pas' using errcode = 'P0001'; end if;
  if v_emp.role is null or v_emp.role not in ('manager','gerant') then
    raise exception 'tarif_reeval_reservee_manager_gerant : réservé au manager et au gérant' using errcode = 'P0001';
  end if;
  if p_lignes is null or jsonb_typeof(p_lignes) <> 'array' or jsonb_array_length(p_lignes) not between 1 and 200 then
    raise exception 'tarif_reeval_lot_invalide : de 1 à 200 réévaluations par appel' using errcode = 'P0001';
  end if;
  for l in select value from jsonb_array_elements(p_lignes) loop
    if jsonb_typeof(l) <> 'object' or exists (select 1 from jsonb_object_keys(l) k where k not in
         ('verification_id','article','code_barres','etat','fichier_hash','date_releve','empreinte','gravite','valeurs','cause')) then
      raise exception 'tarif_reeval_champ_inconnu : champ non admis (le site n est jamais transmis)' using errcode = 'P0001';
    end if;
    select v.cle, v.cause into v_ver from tarif_anomalies_verifications v
      where v.id = (l->>'verification_id')::uuid and v.site = v_emp.site_id;
    if not found or v_ver.cle is distinct from tarif_cle_reference(l->>'code_barres', l->>'article')
       or (l ? 'cause' and v_ver.cause is distinct from l->>'cause') then
      raise exception 'tarif_reeval_incoherente : la référence ou la cause ne correspond pas à la vérification citée' using errcode = 'P0001';
    end if;
    select r.id into v_id from tarif_anomalies_reevaluations r
      where r.verification_id = (l->>'verification_id')::uuid and r.fichier_hash = l->>'fichier_hash' and r.annule_le is null;
    if v_id is not null then
      o_id := v_id; o_deja := true; return next;
    else
      -- La clé étrangère composée (verification_id, site) interdit une vérification d'un autre site.
      insert into tarif_anomalies_reevaluations (site, article, code_barres, verification_id, etat, fichier_hash, date_releve, empreinte, gravite, valeurs)
      values (v_emp.site_id, l->>'article', l->>'code_barres', (l->>'verification_id')::uuid, l->>'etat', l->>'fichier_hash',
              nullif(l->>'date_releve','')::date, l->>'empreinte', (l->>'gravite')::numeric, l->'valeurs')
      returning id into v_id;
      o_id := v_id; o_deja := false; return next;
    end if;
  end loop;
end $$;
revoke all on function tarif_enregistrer_reevaluations(jsonb) from public, anon, authenticated, service_role;
grant execute on function tarif_enregistrer_reevaluations(jsonb) to authenticated;
comment on function tarif_marquer_verifie(jsonb) is 'Marque des anomalies tarifaires comme vérifiées, par lot, tout ou rien, idempotent. SECURITY INVOKER : RLS appliquée. Manager ou gérant actif, non créateur, site du compte.';
comment on function tarif_enregistrer_reevaluations(jsonb) is 'Enregistre les réévaluations d un nouvel import, idempotent par vérification et fichier. SECURITY INVOKER.';
-- <<< FIN migration 20261118120000_tarif_anomalies_verifications.sql
-- >>> DEBUT migration 20261120124007_tarif_annulation_heure_serveur.sql
-- NEXUS Scanner tarifaire : l'heure d'annulation d'une vérification ou d'une réévaluation est fixée par le serveur.
-- Avant : l'écran envoyait annule_le avec l'horloge de l'appareil (une ligne de Production du 20/11/2026 porte ainsi
-- l'heure du téléphone). Après : au passage de annule_le de null à une valeur, le serveur écrit now(), quelle que soit
-- la valeur reçue. Une ligne déjà annulée n'est pas modifiable (les policies RLS le refusent déjà) : le déclencheur n'y touche pas.
-- Aucun changement de colonne, de contrainte, de policy RLS ou de droit de table. Aucune donnée existante n'est modifiée.
-- Idempotente : create or replace function, drop trigger if exists puis create trigger.

do $prerequis$
declare v_manque text;
begin
  select string_agg(o, ', ') into v_manque
  from unnest(array['public.tarif_anomalies_verifications', 'public.tarif_anomalies_reevaluations']) as o
  where to_regclass(o) is null;
  if v_manque is not null then
    raise exception 'prerequis_migrations : 20261120100000_tarif_annulation_heure_serveur : objets absents : % (appliquer d abord 20261118120000)', v_manque;
  end if;
end $prerequis$;

create or replace function public.tarif_annulation_heure_serveur()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
begin
  -- Première annulation : l'heure est celle du serveur, pas celle de l'appareil.
  if old.annule_le is null and new.annule_le is not null then
    new.annule_le := now();
  end if;
  -- old.annule_le non nul : ligne figée, rien n'est changé ici (la RLS refuse déjà la modification).
  return new;
end
$fn$;

revoke execute on function public.tarif_annulation_heure_serveur() from public, anon, authenticated;

drop trigger if exists tarif_verif_annulation_heure_serveur on public.tarif_anomalies_verifications;
create trigger tarif_verif_annulation_heure_serveur
  before update of annule_le, annule_par, motif_annulation on public.tarif_anomalies_verifications
  for each row execute function public.tarif_annulation_heure_serveur();

drop trigger if exists tarif_reeval_annulation_heure_serveur on public.tarif_anomalies_reevaluations;
create trigger tarif_reeval_annulation_heure_serveur
  before update of annule_le, annule_par, motif_annulation on public.tarif_anomalies_reevaluations
  for each row execute function public.tarif_annulation_heure_serveur();
-- <<< FIN migration 20261120124007_tarif_annulation_heure_serveur.sql
-- >>> DEBUT migration 20261121100000_tarif_annulation_createur.sql
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
-- <<< FIN migration 20261121100000_tarif_annulation_createur.sql
-- >>> DEBUT corps de 53_annulation_createur.sql
do $garde_recette$
declare v_sysid bigint := (select system_identifier from pg_control_system());
begin
  if v_sysid is distinct from 7678069749886157684 then
    raise exception 'garde_projet_test : identifiant systeme % : ce n est pas le projet Supabase Test udljdqxerrbbbajxubfn', v_sysid;
  end if;
  if (select count(*) from public.sites where site_id in ('site-fantome-test', 'nexus-station-test')) <> 2 then
    raise exception 'garde_projet_test : sites de recette absents';
  end if;
  if to_regclass('public.tarif_anomalies_verifications') is null or to_regclass('public.tarif_anomalies_reevaluations') is null
     or to_regprocedure('public.tarif_marquer_verifie(jsonb)') is null or to_regprocedure('public.tarif_enregistrer_reevaluations(jsonb)') is null then
    raise exception 'prerequis : la migration 20261118120000 n est pas appliquee sur ce projet';
  end if;
  if to_regprocedure('public.tarif_annulation_heure_serveur()') is null then
    raise exception 'prerequis : la migration 20261120100000 n est pas appliquee sur ce projet';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and policyname = 'annulation_roles_meme_site'
        and tablename in ('tarif_anomalies_verifications', 'tarif_anomalies_reevaluations') and qual like '%je_suis_createur%') <> 2 then
    raise exception 'prerequis : la migration 20261121100000 n est pas appliquee sur ce projet (politique d annulation sans branche createur)';
  end if;
end $garde_recette$;

create temp table journal (n serial, cas text, attendu text, obtenu text, ok boolean) on commit drop;
grant all on journal to public; grant all on sequence journal_n_seq to public;
create temp table ids (k text, v text) on commit drop;
grant all on ids to public;

insert into auth.users(id, aud, role, email) select ('00000000-0000-4000-8000-0000000e02' || k)::uuid, 'authenticated', 'authenticated', 'recette-cycle-' || k || '@invalid.test'
from (values ('01'),('02'),('03'),('04'),('05'),('06'),('07'),('08')) t(k);
insert into employees(id, username, nom, role, actif, est_createur, site_id, compte_test)
select ('00000000-0000-4000-8000-0000000e02' || k)::uuid, 'recette-cycle-' || k, 'Recette cycle ' || k, r, a, c, s, true
from (values ('01','gerant',true,false,'site-fantome-test'), ('02','manager',true,false,'site-fantome-test'), ('03','manager',true,false,'site-fantome-test'),
  ('04','pompiste',true,false,'site-fantome-test'), ('05','caissier',true,true,'site-fantome-test'), ('06','manager',false,false,'site-fantome-test'),
  ('07','manager',true,false,'nexus-station-test'), ('08','caissier',true,false,'site-fantome-test')) t(k,r,a,c,s);
insert into ids(k, v) values ('gA','00000000-0000-4000-8000-0000000e0201'),('mA','00000000-0000-4000-8000-0000000e0202'),('mA2','00000000-0000-4000-8000-0000000e0203'),
  ('pA','00000000-0000-4000-8000-0000000e0204'),('cA','00000000-0000-4000-8000-0000000e0205'),('iA','00000000-0000-4000-8000-0000000e0206'),
  ('mB','00000000-0000-4000-8000-0000000e0207'),('kA','00000000-0000-4000-8000-0000000e0208');

create function pg_temp.u(p_k text) returns uuid language sql as $$ select v::uuid from pg_temp.ids where k = p_k $$;
grant execute on function pg_temp.u(text) to public;
-- note : l'attendu peut proposer deux formes séparées par « ~ » (la première qui figure dans l'obtenu suffit).
create function pg_temp.note(p_cas text, p_attendu text, p_obtenu text) returns void language sql as $$
  insert into pg_temp.journal(cas, attendu, obtenu, ok) values (p_cas, p_attendu,  p_obtenu,
    exists (select 1 from unnest(string_to_array(p_attendu, '~')) a where position(a in coalesce(p_obtenu,'')) > 0));
$$;
grant execute on function pg_temp.note(text, text, text) to public;
create function pg_temp.comme(p_role text, p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', case when p_uid is null then json_build_object('role', p_role)::text else json_build_object('sub', p_uid, 'role', p_role)::text end, true);
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  perform set_config('request.jwt.claim.role', p_role, true);
  execute format('set local role %I', p_role);
end $$;
grant execute on function pg_temp.comme(text, uuid) to public;
create function pg_temp.tente(p_sql text) returns text language plpgsql as $$
declare n bigint;
begin execute p_sql; get diagnostics n = row_count; return 'ok n=' || n;
exception when others then return sqlstate || ' ' || sqlerrm; end $$;
grant execute on function pg_temp.tente(text) to public;
create function pg_temp.val(p_sql text) returns text language plpgsql as $$
declare r text;
begin execute p_sql into r; return r; exception when others then return sqlstate || ' ' || sqlerrm; end $$;
grant execute on function pg_temp.val(text) to public;
create function pg_temp.js(p_art text, p_batch text, p_hash text, p_extra text default '') returns text language sql as $$
  select format('[{"article":"%s","code_barres":"","cause":"S1","empreinte":"e-%s","fichier_hash":"%s","date_releve":"2026-11-10","gravite":3.5,"niveau":"moyen","valeurs":{"a":1},"import_batch_id":"%s","moteur_version":"politique-tarifaire-t2-v2"%s}]', p_art, p_art, p_hash, p_batch, p_extra)
$$;
grant execute on function pg_temp.js(text,text,text,text) to public;
create function pg_temp.marque(p_js text) returns text language sql as $$ select format('select o_id::text, o_deja::text from tarif_marquer_verifie(%L::jsonb)', p_js); $$;
grant execute on function pg_temp.marque(text) to public;
create function pg_temp.reeval(p_js text) returns text language sql as $$ select format('select o_id::text, o_deja::text from tarif_enregistrer_reevaluations(%L::jsonb)', p_js); $$;
grant execute on function pg_temp.reeval(text) to public;
-- rj2 : réévaluation d'une vérification désignée par sa clé dans ids (généralise rj du script 10).
create function pg_temp.rj2(p_vkey text, p_art text, p_etat text, p_hash text, p_date text, p_grav text) returns text language sql as $$
  select format('[{"verification_id":"%s","article":"%s","code_barres":"","cause":"S1","etat":"%s","fichier_hash":"%s","date_releve":"%s","empreinte":"e-%s","gravite":%s,"valeurs":{"a":1}}]', (select v from pg_temp.ids where k=p_vkey), p_art, p_etat, p_hash, p_date, p_art, p_grav);
$$;
grant execute on function pg_temp.rj2(text,text,text,text,text,text) to public;

insert into import_batches(id, site, intention, fichier_hash) values
  ('00000000-0000-4000-8000-00000000f101', 'site-fantome-test', 'stock_theorique', 'H1'),
  ('00000000-0000-4000-8000-00000000f102', 'site-fantome-test', 'stock_theorique', 'H2'),
  ('00000000-0000-4000-8000-00000000f103', 'nexus-station-test', 'stock_theorique', 'H1'),
  ('00000000-0000-4000-8000-00000000f105', 'site-fantome-test', 'stock_theorique', 'H3');


update sites set acces_createur_autorise = true where site_id = 'site-fantome-test';
update sites set acces_createur_autorise = false where site_id = 'nexus-station-test';

select pg_temp.note('C00 comptes de recette trouves (8 attendus)', '8', (select count(*)::text from employees where id::text like '00000000-0000-4000-8000-0000000e02%' and compte_test));
select pg_temp.note('C00 deux politiques d annulation avec branche createur', '2', (select count(*)::text from pg_policies where policyname = 'annulation_roles_meme_site' and qual like '%je_suis_createur%'));

-- C01 : un manager marque, le createur annule sa saisie. L'heure est fixee par le serveur, annule_par est le createur.
select pg_temp.comme('authenticated', pg_temp.u('mA'));
select pg_temp.note('C01 mA marque essai-c1', 'ok n=1', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-c1','00000000-0000-4000-8000-00000000f101','H1'))));
reset role;
select pg_temp.comme('authenticated', pg_temp.u('cA'));
select pg_temp.note('C01 le createur annule la saisie du manager', 'ok n=1', pg_temp.tente(format($q$update tarif_anomalies_verifications set annule_le='2000-01-01 00:00:00+00', annule_par=%L, motif_annulation='essai createur' where article='essai-c1'$q$, pg_temp.u('cA'))));
select pg_temp.note('C01 annule_le = now() de la transaction', 'true', pg_temp.val($q$select (annule_le = now())::text from tarif_anomalies_verifications where article='essai-c1'$q$));
select pg_temp.note('C01 annule_par est le createur', 'true', pg_temp.val(format($q$select (annule_par = %L::uuid)::text from tarif_anomalies_verifications where article='essai-c1'$q$, pg_temp.u('cA'))));
reset role;

-- C02 : le createur annule aussi la saisie d'un gerant.
select pg_temp.comme('authenticated', pg_temp.u('gA'));
select pg_temp.note('C02 gA marque essai-c2', 'ok n=1', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-c2','00000000-0000-4000-8000-00000000f101','H1'))));
reset role;
select pg_temp.comme('authenticated', pg_temp.u('cA'));
select pg_temp.note('C02 le createur annule la saisie du gerant', 'ok n=1', pg_temp.tente(format($q$update tarif_anomalies_verifications set annule_le=now(), annule_par=%L, motif_annulation='essai createur' where article='essai-c2'$q$, pg_temp.u('cA'))));
reset role;

-- C03 : le createur ne verifie toujours pas (l'RPC garde son refus).
select pg_temp.comme('authenticated', pg_temp.u('cA'));
select pg_temp.note('C03 le createur ne marque pas verifie', 'tarif_verif_createur_lecture_seule', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-c3','00000000-0000-4000-8000-00000000f101','H1'))));
select pg_temp.note('C03 aucune verification creee par le createur', '0', pg_temp.val($q$select count(*)::text from tarif_anomalies_verifications where article='essai-c3'$q$));
reset role;

-- C04 : site sans acces createur autorise : 0 ligne (nexus-station-test a le drapeau a faux).
select pg_temp.comme('authenticated', pg_temp.u('mB'));
select pg_temp.note('C04 mB marque essai-c4 sur l autre site', 'ok n=1', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-c4','00000000-0000-4000-8000-00000000f103','H1'))));
reset role;
select pg_temp.comme('authenticated', pg_temp.u('cA'));
select pg_temp.note('C04 le createur n annule pas sur un site sans acces createur autorise (0 ligne)', 'ok n=0', pg_temp.tente(format($q$update tarif_anomalies_verifications set annule_le=now(), annule_par=%L, motif_annulation='essai' where article='essai-c4'$q$, pg_temp.u('cA'))));
reset role;

-- C05 : une ligne deja annulee n'est pas reprise.
select pg_temp.comme('authenticated', pg_temp.u('cA'));
select pg_temp.note('C05 le createur ne reprend pas une ligne deja annulee (0 ligne)', 'ok n=0', pg_temp.tente(format($q$update tarif_anomalies_verifications set annule_le=now(), annule_par=%L, motif_annulation='autre' where article='essai-c1'$q$, pg_temp.u('cA'))));
reset role;

-- C06 : une autre colonne que les trois d'annulation reste interdite (privilege de colonne).
select pg_temp.comme('authenticated', pg_temp.u('mA'));
select pg_temp.note('C06 mA marque essai-c6', 'ok n=1', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-c6','00000000-0000-4000-8000-00000000f101','H1'))));
reset role;
select pg_temp.comme('authenticated', pg_temp.u('cA'));
select pg_temp.note('C06 le createur ne modifie pas une autre colonne', '42501', pg_temp.tente($q$update tarif_anomalies_verifications set article='essai-c6-bis' where article='essai-c6'$q$));
reset role;

-- C07 : drapeau coupe sur le site : le createur n'annule plus rien.
update sites set acces_createur_autorise = false where site_id = 'site-fantome-test';
select pg_temp.comme('authenticated', pg_temp.u('cA'));
select pg_temp.note('C07 drapeau coupe : le createur n annule pas (0 ligne)', 'ok n=0', pg_temp.tente(format($q$update tarif_anomalies_verifications set annule_le=now(), annule_par=%L, motif_annulation='essai' where article='essai-c6'$q$, pg_temp.u('cA'))));
reset role;
update sites set acces_createur_autorise = true where site_id = 'site-fantome-test';

-- C08 : reevaluations, meme comportement que les verifications.
select pg_temp.comme('authenticated', pg_temp.u('mA'));
select pg_temp.note('C08 mA marque essai-c8', 'ok n=1', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-c8','00000000-0000-4000-8000-00000000f101','H1'))));
reset role;
insert into ids(k, v) select 'v8', id::text from tarif_anomalies_verifications where article='essai-c8';
select pg_temp.comme('authenticated', pg_temp.u('mA'));
select pg_temp.note('C08 mA enregistre une reevaluation (hash H2)', 'ok n=1', pg_temp.tente(pg_temp.reeval(pg_temp.rj2('v8','essai-c8','persistante','H2','2026-11-17','3.5'))));
reset role;
select pg_temp.comme('authenticated', pg_temp.u('cA'));
select pg_temp.note('C08 le createur annule la reevaluation', 'ok n=1', pg_temp.tente(format($q$update tarif_anomalies_reevaluations set annule_le='2000-01-01 00:00:00+00', annule_par=%L, motif_annulation='essai createur' where article='essai-c8' and fichier_hash='H2'$q$, pg_temp.u('cA'))));
select pg_temp.note('C08 annule_le = now() de la transaction', 'true', pg_temp.val($q$select (annule_le = now())::text from tarif_anomalies_reevaluations where article='essai-c8' and fichier_hash='H2'$q$));
reset role;

-- C09 : annule_par doit etre le createur lui-meme (pas celui d'un autre) ; un motif vide reste refuse.
select pg_temp.comme('authenticated', pg_temp.u('mA'));
select pg_temp.note('C09 mA marque essai-c9', 'ok n=1', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-c9','00000000-0000-4000-8000-00000000f102','H2'))));
reset role;
select pg_temp.comme('authenticated', pg_temp.u('cA'));
select pg_temp.note('C09 le createur ne signe pas au nom d un autre', '42501', pg_temp.tente(format($q$update tarif_anomalies_verifications set annule_le=now(), annule_par=%L, motif_annulation='essai' where article='essai-c9'$q$, pg_temp.u('mA'))));
select pg_temp.note('C09 motif vide refuse pour le createur', '23514', pg_temp.tente(format($q$update tarif_anomalies_verifications set annule_le=now(), annule_par=%L, motif_annulation='   ' where article='essai-c9'$q$, pg_temp.u('cA'))));
reset role;

-- C10 : droits des autres roles inchanges. Autre manager, pompiste, caissier non createur : 0 ligne ; le gerant annule.
select pg_temp.comme('authenticated', pg_temp.u('mA2'));
select pg_temp.note('C10 un autre manager n annule pas la saisie de mA (0 ligne)', 'ok n=0', pg_temp.tente(format($q$update tarif_anomalies_verifications set annule_le=now(), annule_par=%L, motif_annulation='essai' where article='essai-c9'$q$, pg_temp.u('mA2'))));
reset role;
select pg_temp.comme('authenticated', pg_temp.u('pA'));
select pg_temp.note('C10 le pompiste n annule pas (0 ligne)', 'ok n=0', pg_temp.tente(format($q$update tarif_anomalies_verifications set annule_le=now(), annule_par=%L, motif_annulation='essai' where article='essai-c9'$q$, pg_temp.u('pA'))));
reset role;
select pg_temp.comme('authenticated', pg_temp.u('kA'));
select pg_temp.note('C10 le caissier non createur n annule pas (0 ligne)', 'ok n=0', pg_temp.tente(format($q$update tarif_anomalies_verifications set annule_le=now(), annule_par=%L, motif_annulation='essai' where article='essai-c9'$q$, pg_temp.u('kA'))));
reset role;
select pg_temp.comme('authenticated', pg_temp.u('gA'));
select pg_temp.note('C10 le gerant annule la saisie de mA', 'ok n=1', pg_temp.tente(format($q$update tarif_anomalies_verifications set annule_le=now(), annule_par=%L, motif_annulation='essai' where article='essai-c9'$q$, pg_temp.u('gA'))));
reset role;

do $rapport$
declare v_json text;
begin
  select jsonb_pretty(jsonb_build_object(
    'bilan', (select count(*) filter (where ok) || '/' || count(*) || ' ok, ' || count(*) filter (where not ok) || ' KO' from journal),
    'assertions', (select jsonb_object_agg(a, v) from (select left(cas, 3) as a, case when bool_and(ok) then 'ok' else 'KO' end as v from journal group by left(cas, 3)) s),
    'cas', (select jsonb_agg(jsonb_build_object('n', n, 'cas', cas, 'attendu', attendu, 'obtenu', left(obtenu, 120), 'verdict', case when ok then 'ok' else 'KO' end) order by n) from journal)))
  into v_json;
  raise exception 'RAPPORT_53 %', v_json;
end $rapport$;
rollback;
