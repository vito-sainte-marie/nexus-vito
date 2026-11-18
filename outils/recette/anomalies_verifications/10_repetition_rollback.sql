-- NEXUS Scanner tarifaire : REPETITION de la migration 20261118120000 en transaction, puis ROLLBACK. Cible : Test (les comptes de recette nexus-station-test et site-fantome-test y existent).
-- Aucun commit. Une seule piece : controle 73, controle 40, migration telle quelle, 33 cas, comptes des deux tables, rollback.
-- A jouer ensuite : 20_verifier_rien_ne_reste.sql. Identites de recette creees DANS la transaction (auth.users puis employees, ids 00000000-0000-4000-8000-0000000e00xx), annulees par le rollback.
-- Tous les appels de la preuve passent par tente()/val() : un echec est note KO, il n'arrete pas la transaction. Sortie : UN seul select final (JSON), puis rollback.
begin;
create temp table ctl (n serial, nom text, detail jsonb) on commit drop;

create temp table c73 as
with r(registre, actives, total, empreinte) as (
  select 'tarif_familles', count(*) filter (where annule_le is null), count(*), md5(coalesce(string_agg(concat_ws('|', id, cle, libelle, remplace_id, annule_le), ';' order by id), '')) from tarif_familles where site = 'vito-sainte-marie'
  union all select 'tarif_rattachements', count(*) filter (where annule_le is null), count(*), md5(coalesce(string_agg(concat_ws('|', id, cle, famille_code, remplace_id, annule_le), ';' order by id), '')) from tarif_rattachements where site = 'vito-sainte-marie'
  union all select 'tarif_seuils', count(*) filter (where annule_le is null), count(*), md5(coalesce(string_agg(concat_ws('|', id, cle, minimum, statut_minimum, cible, statut_cible, remplace_id, annule_le), ';' order by id), '')) from tarif_seuils where site = 'vito-sainte-marie'
  union all select 'tarif_reglages', count(*) filter (where annule_le is null), count(*), md5(coalesce(string_agg(concat_ws('|', id, cle, valeur, remplace_id, annule_le), ';' order by id), '')) from tarif_reglages where site = 'vito-sainte-marie'
  union all select 'tarif_exceptions', count(*) filter (where annule_le is null), count(*), md5(coalesce(string_agg(concat_ws('|', id, cle, type, statut, cond_prix_ttc, cond_tolerance_cout, cond_cout_reference, remplace_id, annule_le), ';' order by id), '')) from tarif_exceptions where site = 'vito-sainte-marie'
  union all select 'tarif_prix_decides', count(*) filter (where annule_le is null), count(*), md5(coalesce(string_agg(concat_ws('|', id, cle, nature, prix_ttc, decide_le, remplace_id, annule_le), ';' order by id), '')) from tarif_prix_decides where site = 'vito-sainte-marie' and coalesce(article, '') not like 'RECETTE T3 %'
  union all select 'tarif_prix_application', count(*) filter (where annule_le is null), count(*), md5(coalesce(string_agg(concat_ws('|', id, prix_decide_id, evenement, date_effet, annule_le), ';' order by id), '')) from tarif_prix_application where site = 'vito-sainte-marie'
  union all select 'tarif_regimes_prix', count(*) filter (where annule_le is null), count(*), md5(coalesce(string_agg(concat_ws('|', id, cle, regime, remplace_id, annule_le), ';' order by id), '')) from tarif_regimes_prix where site = 'vito-sainte-marie'
  union all select 'tarif_controles_reglementaires', count(*) filter (where annule_le is null), count(*), md5(coalesce(string_agg(concat_ws('|', id, cle, etat, remplace_id, annule_le), ';' order by id), '')) from tarif_controles_reglementaires where site = 'vito-sainte-marie'
  union all select 'tarif_decisions', count(*) filter (where annule_le is null), count(*), md5(coalesce(string_agg(concat_ws('|', id, cle, decision, prix_ttc_retenu, photo::text, annule_le), ';' order by id), '')) from tarif_decisions where site = 'vito-sainte-marie' and coalesce(article, '') not like 'RECETTE T3 %'
)
select registre, actives, total, empreinte from r
union all select 'TOTAL', sum(actives), sum(total), md5(string_agg(empreinte, '' order by registre)) from r
order by 1;

-- Controle 73, avant
insert into ctl(nom, detail) select 'controle73_avant', jsonb_agg(to_jsonb(c) order by registre) from pg_temp.c73 c;
insert into ctl(nom, detail) select 'controle73_avant_verdict', to_jsonb(q) from (select 'CONTROLE 73 : TOTAL attendu 130 / 138 / 1752f6f440c7777399d6b0040c86438e' as controle,
  case when (select count(*) from pg_temp.c73 where registre='TOTAL' and actives=130 and total=138 and empreinte='1752f6f440c7777399d6b0040c86438e')=1 then 'OK identique' else 'KO different' end as verdict) q;
-- Controle 40, avant
insert into ctl(nom, detail) select 'controle40_avant', to_jsonb(q) from (select 'CONTROLE 40 : ' || 'avant' as controle, (select count(*) from products) as products_lignes,
  (select md5(coalesce(string_agg(t::text, '|' order by t::text), '')) from products t) as products_empreinte,
  (select count(*) from stock_releves) as stock_releves_lignes,
  (select md5(coalesce(string_agg(t::text, '|' order by t::text), '')) from stock_releves t) as stock_releves_empreinte) q;

-- ===== Migration 20261118120000, contenu tel quel (prérequis neutres compris) =====
-- NEXUS Scanner, anomalies tarifaires : vérifications et réévaluations (PROJET, NON EXÉCUTÉ).
-- Dépend des migrations T2 (20261117020430, 020652, 020851, 021059) et du journal 20261117161325. Cible : Test uniquement, après GO écrit.
-- Production non concernée. Additive : deux tables d'ajout seul, deux fonctions SECURITY INVOKER. Aucune donnée existante modifiée.
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

-- ===== Preuve : 33 cas =====
create temp table journal (n serial, cas text, attendu text, obtenu text, ok boolean) on commit drop;
grant all on journal to public; grant all on sequence journal_n_seq to public;
create temp table ids (k text, v text) on commit drop;
grant all on ids to public;

-- Identites de recette creees dans la transaction (rollback). Colonnes obligatoires lues sur Test : auth.users(id), employees(id, username, nom, role ; actif, est_createur, site_id, compte_test ont un defaut).
insert into auth.users(id, aud, role, email) select ('00000000-0000-4000-8000-0000000e00' || k)::uuid, 'authenticated', 'authenticated', 'recette-' || k || '@invalid.test'
from (values ('01'),('02'),('03'),('04'),('05'),('06'),('07')) t(k);
insert into employees(id, username, nom, role, actif, est_createur, site_id, compte_test)
select ('00000000-0000-4000-8000-0000000e00' || k)::uuid, 'recette-ano-' || k, 'Recette ' || k, r, a, c, s, true
from (values ('01','gerant',true,false,'site-fantome-test'), ('02','manager',true,false,'site-fantome-test'), ('03','manager',true,false,'site-fantome-test'),
  ('04','pompiste',true,false,'site-fantome-test'), ('05','gerant',true,true,'site-fantome-test'), ('06','manager',false,false,'site-fantome-test'),
  ('07','manager',true,false,'nexus-station-test')) t(k,r,a,c,s);
insert into ids(k, v) values ('gA','00000000-0000-4000-8000-0000000e0001'),('mA','00000000-0000-4000-8000-0000000e0002'),('mA2','00000000-0000-4000-8000-0000000e0003'),
  ('pA','00000000-0000-4000-8000-0000000e0004'),('cA','00000000-0000-4000-8000-0000000e0005'),('iA','00000000-0000-4000-8000-0000000e0006'),('mB','00000000-0000-4000-8000-0000000e0007');

create function pg_temp.u(p_k text) returns uuid language sql as $$ select v::uuid from pg_temp.ids where k = p_k $$;
grant execute on function pg_temp.u(text) to public;
create function pg_temp.note(p_cas text, p_attendu text, p_obtenu text) returns void language sql as $$
  insert into pg_temp.journal(cas, attendu, obtenu, ok) values (p_cas, p_attendu, p_obtenu, position(p_attendu in coalesce(p_obtenu,'')) > 0);
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
create function pg_temp.js(p_art text, p_batch text, p_hash text, p_cause text default 'S1', p_extra text default '') returns text language sql as $$
  select format('[{"article":"%s","code_barres":"","cause":"%s","empreinte":"e-%s","fichier_hash":"%s","date_releve":"2026-11-10","gravite":3.5,"niveau":"moyen","valeurs":{"a":1},"import_batch_id":"%s","moteur_version":"politique-tarifaire-t2-v2"%s}]', p_art, p_cause, p_art, p_hash, p_batch, p_extra);
$$;
grant execute on function pg_temp.js(text,text,text,text,text) to public;
create function pg_temp.marque(p_js text) returns text language sql as $$ select format('select o_id::text, o_deja::text from tarif_marquer_verifie(%L::jsonb)', p_js); $$;
grant execute on function pg_temp.marque(text) to public;
create function pg_temp.reeval(p_js text) returns text language sql as $$ select format('select o_id::text, o_deja::text from tarif_enregistrer_reevaluations(%L::jsonb)', p_js); $$;
grant execute on function pg_temp.reeval(text) to public;
create function pg_temp.rj(p_etat text, p_hash text, p_date text, p_cause text, p_grav text) returns text language sql as $$
  select format('[{"verification_id":"%s","article":"essai-1","code_barres":"","cause":"%s","etat":"%s","fichier_hash":"%s","date_releve":"%s","empreinte":"e-essai-1","gravite":%s,"valeurs":{"a":1}}]', (select v from pg_temp.ids where k='v1'), p_cause, p_etat, p_hash, p_date, p_grav);
$$;
grant execute on function pg_temp.rj(text,text,text,text,text) to public;

-- Lots synthetiques, dans la transaction seulement (rolled back).
insert into import_batches(id, site, intention, fichier_hash) values
  ('00000000-0000-4000-8000-00000000f001', 'site-fantome-test', 'stock_theorique', 'H1'),
  ('00000000-0000-4000-8000-00000000f002', 'site-fantome-test', 'stock_theorique', null),
  ('00000000-0000-4000-8000-00000000f003', 'nexus-station-test', 'stock_theorique', 'H1'),
  ('00000000-0000-4000-8000-00000000f004', 'site-fantome-test', 'stock_theorique', 'H2');

select pg_temp.note('00 comptes de recette trouves (7 attendus)', '7', (select count(*)::text from employees where id::text like '00000000-0000-4000-8000-0000000e00%' and compte_test));

select pg_temp.comme('authenticated', pg_temp.u('mA'));
select pg_temp.note('01 manager marque', 'ok n=1', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-1','00000000-0000-4000-8000-00000000f001','H1'))));
select pg_temp.note('02 idempotence : o_deja vrai', 't', pg_temp.val(format('select o_deja::text from tarif_marquer_verifie(%L::jsonb)', pg_temp.js('essai-1','00000000-0000-4000-8000-00000000f001','H1'))));
select pg_temp.note('03 une seule ligne apres repetition', '1', pg_temp.val($q$select count(*)::text from tarif_anomalies_verifications where article='essai-1'$q$));
select pg_temp.note('03a marque l article dedie sur le premier fichier (o_deja faux)', 'f', pg_temp.val(format('select o_deja::text from tarif_marquer_verifie(%L::jsonb)', pg_temp.js('essai-h','00000000-0000-4000-8000-00000000f001','H1'))));
select pg_temp.note('03b meme empreinte, autre fichier importe : nouvelle ligne (o_deja faux)', 'f', pg_temp.val(format('select o_deja::text from tarif_marquer_verifie(%L::jsonb)', pg_temp.js('essai-h','00000000-0000-4000-8000-00000000f004','H2'))));
select pg_temp.note('03c l historique garde les deux verifications', '2', pg_temp.val($q$select count(*)::text from tarif_anomalies_verifications where article='essai-h'$q$));
select pg_temp.note('03d meme empreinte, meme fichier que la nouvelle : o_deja vrai', 't', pg_temp.val(format('select o_deja::text from tarif_marquer_verifie(%L::jsonb)', pg_temp.js('essai-h','00000000-0000-4000-8000-00000000f004','H2'))));
select pg_temp.note('03e toujours deux lignes', '2', pg_temp.val($q$select count(*)::text from tarif_anomalies_verifications where article='essai-h'$q$));
select pg_temp.note('04 site transmis refuse', 'tarif_verif_champ_inconnu', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-2','00000000-0000-4000-8000-00000000f001','H1','S1',',"site":"nexus-station-test"'))));
select pg_temp.note('05 lot d''un autre site refuse', 'tarif_verif_lot_import', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-3','00000000-0000-4000-8000-00000000f003','H1'))));
select pg_temp.note('06 empreinte de fichier differente du lot refusee', 'tarif_verif_lot_import', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-4','00000000-0000-4000-8000-00000000f001','H2'))));
select pg_temp.note('07 lot sans hash accepte un hash passe', 'ok n=1', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-5','00000000-0000-4000-8000-00000000f002','H2'))));
select pg_temp.note('08 manager lit les lots de son site', '2', pg_temp.val($q$select count(*)::text from import_batches where id in ('00000000-0000-4000-8000-00000000f001','00000000-0000-4000-8000-00000000f002')$q$));
select pg_temp.note('09 manager ne voit pas le lot d''un autre site', '0', pg_temp.val($q$select count(*)::text from import_batches where id='00000000-0000-4000-8000-00000000f003'$q$));
select pg_temp.note('10 gravite relue en base', '3.5', pg_temp.val($q$select gravite::text from tarif_anomalies_verifications where article='essai-1'$q$));
select pg_temp.note('31 commentaire de 501 caracteres refuse', 'tarif_verif_commentaire_trop_long', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-c1','00000000-0000-4000-8000-00000000f001','H1','S1',',"commentaire":"' || repeat('x',501) || '"'))));
select pg_temp.note('32 commentaire de 500 caracteres accepte', 'ok n=1', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-c2','00000000-0000-4000-8000-00000000f001','H1','S1',',"commentaire":"' || repeat('x',500) || '"'))));
select pg_temp.note('33 motif d''annulation de 501 caracteres refuse par la base', 'tarif_anom_verif_motif_long', pg_temp.tente(format($q$update tarif_anomalies_verifications set annule_le=now(), annule_par=%L, motif_annulation=repeat('y',501) where article='essai-c2'$q$, pg_temp.u('mA'))));
reset role;
insert into ids(k, v) select 'v1', id::text from tarif_anomalies_verifications where article='essai-1';
select pg_temp.comme('authenticated', pg_temp.u('mA'));
select pg_temp.note('11 reevaluation persistante', 'ok n=1', pg_temp.tente(pg_temp.reeval(pg_temp.rj('persistante','H2','2026-11-17','S1','3.5'))));
select pg_temp.note('12 reevaluation idempotente', 't', pg_temp.val(format('select o_deja::text from tarif_enregistrer_reevaluations(%L::jsonb)', pg_temp.rj('persistante','H2','2026-11-17','S1','3.5'))));
select pg_temp.note('13 reevaluation incoherente (cause)', 'tarif_reeval_incoherente', pg_temp.tente(pg_temp.reeval(pg_temp.rj('aggravee','H3','2026-11-18','S2','4'))));
select pg_temp.note('14 DELETE refuse', 'permission denied', pg_temp.tente('delete from tarif_anomalies_verifications'));
select pg_temp.note('15 modification de la gravite refusee', 'permission denied', pg_temp.tente('update tarif_anomalies_verifications set gravite = 0'));
reset role;

select pg_temp.comme('authenticated', pg_temp.u('gA'));
select pg_temp.note('16 gerant marque', 'ok n=1', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-6','00000000-0000-4000-8000-00000000f001','H1'))));
select pg_temp.note('17 gerant annule une saisie du manager', 'ok n=1', pg_temp.tente(format($q$update tarif_anomalies_verifications set annule_le=now(), annule_par=%L, motif_annulation='essai' where article='essai-5'$q$, pg_temp.u('gA'))));
reset role;

select pg_temp.comme('authenticated', pg_temp.u('mA2'));
select pg_temp.note('18 autre manager : annulation d''autrui refusee', 'ok n=0', pg_temp.tente(format($q$update tarif_anomalies_verifications set annule_le=now(), annule_par=%L, motif_annulation='essai' where article='essai-1'$q$, pg_temp.u('mA2'))));
reset role;

select pg_temp.comme('authenticated', pg_temp.u('mA'));
select pg_temp.note('19 manager annule sa propre saisie', 'ok n=1', pg_temp.tente(format($q$update tarif_anomalies_verifications set annule_le=now(), annule_par=%L, motif_annulation='essai' where article='essai-1'$q$, pg_temp.u('mA'))));
select pg_temp.note('20 manager ne peut pas annuler la saisie du gerant', 'ok n=0', pg_temp.tente(format($q$update tarif_anomalies_verifications set annule_le=now(), annule_par=%L, motif_annulation='essai' where article='essai-6'$q$, pg_temp.u('mA'))));
reset role;

select pg_temp.comme('authenticated', pg_temp.u('mB'));
select pg_temp.note('21 manager B ne voit aucune verification du site A', '0', pg_temp.val($q$select count(*)::text from tarif_anomalies_verifications where site='site-fantome-test'$q$));
select pg_temp.note('22 manager B ne peut pas citer un lot du site A', 'tarif_verif_lot_import', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-7','00000000-0000-4000-8000-00000000f001','H1'))));
select pg_temp.note('23 manager B ne reevalue pas une verification du site A', 'tarif_reeval_', pg_temp.tente(pg_temp.reeval(pg_temp.rj('persistante','H9','2026-11-18','S1','3.5'))));
select pg_temp.note('24 manager B marque sur son site', 'ok n=1', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-8','00000000-0000-4000-8000-00000000f003','H1'))));
reset role;

select pg_temp.comme('authenticated', pg_temp.u('pA'));
select pg_temp.note('25 pompiste refuse', 'tarif_verif_reservee_manager_gerant', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-9','00000000-0000-4000-8000-00000000f001','H1'))));
reset role;
select pg_temp.comme('authenticated', pg_temp.u('cA'));
select pg_temp.note('26 createur refuse', 'tarif_verif_createur_lecture_seule', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-10','00000000-0000-4000-8000-00000000f001','H1'))));
reset role;
select pg_temp.comme('authenticated', pg_temp.u('iA'));
select pg_temp.note('27 compte desactive refuse', 'tarif_verif_compte', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-11','00000000-0000-4000-8000-00000000f001','H1'))));
reset role;
select pg_temp.comme('anon', null);
select pg_temp.note('28 anon refuse', 'permission denied', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-12','00000000-0000-4000-8000-00000000f001','H1'))));
reset role;
select pg_temp.comme('authenticated', null);
select pg_temp.note('29 sans session refuse', 'tarif_verif_session_absente', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-13','00000000-0000-4000-8000-00000000f001','H1'))));
reset role;

reset role;
select pg_temp.note('30 FK inter-sites refusee', 'foreign key', pg_temp.tente(format($q$insert into tarif_anomalies_reevaluations(site, saisi_par, article, code_barres, verification_id, etat, fichier_hash, date_releve, empreinte, gravite, valeurs) values ('nexus-station-test',%L,'essai-1','',%L,'persistante','HX','2026-11-18','e',1,'{}')$q$, (select v from pg_temp.ids where k='mB'), (select v from pg_temp.ids where k='v1'))));
reset role;

create temp table c73b as
with r(registre, actives, total, empreinte) as (
  select 'tarif_familles', count(*) filter (where annule_le is null), count(*), md5(coalesce(string_agg(concat_ws('|', id, cle, libelle, remplace_id, annule_le), ';' order by id), '')) from tarif_familles where site = 'vito-sainte-marie'
  union all select 'tarif_rattachements', count(*) filter (where annule_le is null), count(*), md5(coalesce(string_agg(concat_ws('|', id, cle, famille_code, remplace_id, annule_le), ';' order by id), '')) from tarif_rattachements where site = 'vito-sainte-marie'
  union all select 'tarif_seuils', count(*) filter (where annule_le is null), count(*), md5(coalesce(string_agg(concat_ws('|', id, cle, minimum, statut_minimum, cible, statut_cible, remplace_id, annule_le), ';' order by id), '')) from tarif_seuils where site = 'vito-sainte-marie'
  union all select 'tarif_reglages', count(*) filter (where annule_le is null), count(*), md5(coalesce(string_agg(concat_ws('|', id, cle, valeur, remplace_id, annule_le), ';' order by id), '')) from tarif_reglages where site = 'vito-sainte-marie'
  union all select 'tarif_exceptions', count(*) filter (where annule_le is null), count(*), md5(coalesce(string_agg(concat_ws('|', id, cle, type, statut, cond_prix_ttc, cond_tolerance_cout, cond_cout_reference, remplace_id, annule_le), ';' order by id), '')) from tarif_exceptions where site = 'vito-sainte-marie'
  union all select 'tarif_prix_decides', count(*) filter (where annule_le is null), count(*), md5(coalesce(string_agg(concat_ws('|', id, cle, nature, prix_ttc, decide_le, remplace_id, annule_le), ';' order by id), '')) from tarif_prix_decides where site = 'vito-sainte-marie' and coalesce(article, '') not like 'RECETTE T3 %'
  union all select 'tarif_prix_application', count(*) filter (where annule_le is null), count(*), md5(coalesce(string_agg(concat_ws('|', id, prix_decide_id, evenement, date_effet, annule_le), ';' order by id), '')) from tarif_prix_application where site = 'vito-sainte-marie'
  union all select 'tarif_regimes_prix', count(*) filter (where annule_le is null), count(*), md5(coalesce(string_agg(concat_ws('|', id, cle, regime, remplace_id, annule_le), ';' order by id), '')) from tarif_regimes_prix where site = 'vito-sainte-marie'
  union all select 'tarif_controles_reglementaires', count(*) filter (where annule_le is null), count(*), md5(coalesce(string_agg(concat_ws('|', id, cle, etat, remplace_id, annule_le), ';' order by id), '')) from tarif_controles_reglementaires where site = 'vito-sainte-marie'
  union all select 'tarif_decisions', count(*) filter (where annule_le is null), count(*), md5(coalesce(string_agg(concat_ws('|', id, cle, decision, prix_ttc_retenu, photo::text, annule_le), ';' order by id), '')) from tarif_decisions where site = 'vito-sainte-marie' and coalesce(article, '') not like 'RECETTE T3 %'
)
select registre, actives, total, empreinte from r
union all select 'TOTAL', sum(actives), sum(total), md5(string_agg(empreinte, '' order by registre)) from r
order by 1;

insert into ctl(nom, detail) select 'controle73_fin', jsonb_agg(to_jsonb(c) order by registre) from pg_temp.c73b c;
insert into ctl(nom, detail) select 'controle73_fin_verdict', to_jsonb(q) from (select case when (select string_agg(registre||actives||total||empreinte,'|' order by registre) from pg_temp.c73) = (select string_agg(registre||actives||total||empreinte,'|' order by registre) from pg_temp.c73b) then 'OK identique a l''avant' else 'KO different de l''avant' end as verdict) q;
insert into ctl(nom, detail) select 'controle40_fin', to_jsonb(q) from (select (select count(*) from products) as products_lignes,
  (select md5(coalesce(string_agg(t::text, '|' order by t::text), '')) from products t) as products_empreinte,
  (select count(*) from stock_releves) as stock_releves_lignes,
  (select md5(coalesce(string_agg(t::text, '|' order by t::text), '')) from stock_releves t) as stock_releves_empreinte) q;
insert into ctl(nom, detail) select 'comptes_deux_tables_avant_rollback', to_jsonb(q) from (select (select count(*) from tarif_anomalies_verifications) as verifications, (select count(*) from tarif_anomalies_reevaluations) as reevaluations) q;

-- Sortie unique : tout le journal en JSON, puis rollback.
select jsonb_pretty(jsonb_build_object(
  'bilan', (select count(*) filter (where ok) || '/' || count(*) || ' ok, ' || count(*) filter (where not ok) || ' KO' from journal),
  'cas', (select jsonb_agg(jsonb_build_object('n', n, 'cas', cas, 'attendu', attendu, 'obtenu', left(obtenu, 120), 'verdict', case when ok then 'ok' else 'KO' end) order by n) from journal),
  'controles', (select jsonb_object_agg(nom, detail) from ctl))) as preuve_anomalies_json;
rollback;
