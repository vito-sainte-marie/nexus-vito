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
