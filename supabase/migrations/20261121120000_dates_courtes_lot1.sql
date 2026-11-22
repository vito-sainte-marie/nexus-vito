-- NEXUS Dates courtes, lot 1 (v4) : socle de données. Tournées individuelles, relevés, corrections, retraits, démarques comptabilisées,
-- certifications, demandes de correction, correspondances, accès caissier, quantité courante et âge des lignes.
-- Additive : tables d'ajout seul (la tournée change d'état par fonction serveur seulement), fonctions d'aide et d'écriture. Aucune table existante modifiée,
-- aucun droit existant changé, inventaire_* intact. Aucun écran, aucune page. Aucune écriture comptable, aucun lien avec Decenium ni inventaire_mouvements, aucune valeur en euros.
-- Le site n'est jamais un paramètre : il est lu dans la ligne employees de la personne connectée.
-- Rôles réels de employees.role : caissier, pompiste, renfort, manager, gerant, vacataire. Pompiste et vacataire : aucun accès, par construction des fonctions de droits.
-- « Créateur » n'est pas un rôle : employees.est_createur, valable où sites.acces_createur_autorise.
-- Retour arrière : docs/deploiement/retour-arriere-dates-courtes-lot1-20261121.sql (ne retire que les objets de cette migration).

-- Prérequis : la migration s'arrête avant toute écriture si un objet attendu manque ou si l'ancien modèle hebdomadaire est présent.
do $prerequis$
declare v_manque text;
begin
  select string_agg(o, ', ') into v_manque from unnest(array['public.sites', 'public.employees', 'public.products']) as o where to_regclass(o) is null;
  if v_manque is null then
    select string_agg(f, ', ') into v_manque from unnest(array['public.current_employee_role()', 'public.current_employee_site_id()', 'public.je_suis_createur()']) as f where to_regprocedure(f) is null;
  end if;
  if v_manque is not null then
    raise exception 'prerequis_migrations : 20261121120000 : objets absents : %', v_manque;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'dates_courtes_tournees' and column_name = 'origine') then
    raise exception 'prerequis_migrations : 20261121120000 : ancien modele de tournee hebdomadaire present, appliquer d''abord le retour arriere';
  end if;
end $prerequis$;

-- 1. Fonctions d'aide pures.
create or replace function dates_courtes_normaliser_ean(p_ean text) returns text
language plpgsql immutable set search_path = public, pg_temp as $$
declare v_chiffres text; v_corps text; v_somme integer := 0; v_i integer; v_poids integer := 3;
begin
  v_chiffres := regexp_replace(coalesce(p_ean, ''), '[^0-9]', '', 'g');
  if length(v_chiffres) not in (8, 13) then return null; end if;
  v_corps := left(v_chiffres, length(v_chiffres) - 1);
  for v_i in reverse length(v_corps)..1 loop
    v_somme := v_somme + substr(v_corps, v_i, 1)::integer * v_poids;
    v_poids := case v_poids when 3 then 1 else 3 end;
  end loop;
  if ((10 - v_somme % 10) % 10) <> right(v_chiffres, 1)::integer then return null; end if;
  return v_chiffres;
end $$;

create or replace function dates_courtes_normaliser_libelle(p_libelle text) returns text
language sql immutable set search_path = public, pg_temp as $$
  select lower(btrim(regexp_replace(regexp_replace(coalesce(p_libelle, ''), '^\s*[0-9]{1,2}[/.-][0-9]{1,2}([/.-][0-9]{2,4})?\s*[-:]?\s*', ''), '\s+', ' ', 'g')))
$$;

create or replace function dates_courtes_cle_groupe(p_site text, p_ean text, p_libelle text, p_date date) returns text
language sql immutable set search_path = public, pg_temp as $$
  select case when p_ean is not null then p_site || '|E|' || p_ean || '|' || p_date::text
              else p_site || '|L|' || coalesce(p_libelle, '') || '|' || p_date::text end
$$;

-- 2. Tables. Ajout seul : pas de suppression, mise à jour limitée aux colonnes d'annulation. La tournée change d'état par fonction serveur seulement.
create table if not exists dates_courtes_tournees (
  id uuid primary key default gen_random_uuid(),
  site text not null references sites(site_id),
  nom text check (nom is null or char_length(nom) <= 100),
  cle_idempotence text not null check (length(btrim(cle_idempotence)) between 1 and 100),
  saisi_par uuid not null default auth.uid() references employees(id),
  saisi_le timestamptz not null default now(),
  etat text not null default 'EN_COURS' check (etat in ('EN_COURS', 'TERMINEE_A_CERTIFIER', 'CERTIFIEE', 'CORRECTION_DEMANDEE')),
  terminee_par uuid references employees(id),
  terminee_le timestamptz,
  version_empreinte text,
  version_derniere_operation text,
  constraint dates_courtes_tournees_cloture check ((etat = 'EN_COURS' and terminee_par is null and terminee_le is null and version_empreinte is null)
    or (etat <> 'EN_COURS' and terminee_par is not null and terminee_le is not null and version_empreinte is not null)),
  constraint dates_courtes_tournees_idem unique (site, cle_idempotence),
  constraint dates_courtes_tournees_id_site unique (id, site)
);

create table if not exists dates_courtes_releves (
  id uuid primary key default gen_random_uuid(),
  site text not null references sites(site_id),
  ean text, libelle_vu text, libelle_normalise text,
  nom_libre text check (nom_libre is null or char_length(nom_libre) <= 200),
  photo_ref text check (photo_ref is null or char_length(photo_ref) <= 300),
  date_limite date not null check (date_limite between date '2000-01-01' and date '2100-01-01'),
  quantite integer not null check (quantite > 0 and quantite <= 100000),
  provisoire boolean not null default false,
  cle_groupe text not null,
  tournee_id uuid not null,
  heure_geste timestamptz not null,
  recu_le timestamptz not null default now(),
  recu_apres_cloture boolean not null default false,
  rectification boolean not null default false,
  cle_idempotence text not null check (length(btrim(cle_idempotence)) between 1 and 100),
  lien_id uuid,
  saisi_par uuid not null default auth.uid() references employees(id),
  saisi_le timestamptz not null default now(),
  annule_le timestamptz, annule_par uuid references employees(id), motif_annulation text,
  constraint dates_courtes_releves_produit check (ean is not null or libelle_normalise is not null),
  constraint dates_courtes_releves_libelle_long check (libelle_vu is null or char_length(libelle_vu) <= 200),
  constraint dates_courtes_releves_annulation check ((annule_le is null and annule_par is null and motif_annulation is null)
    or (annule_le is not null and annule_par is not null and length(btrim(coalesce(motif_annulation, ''))) > 0)),
  constraint dates_courtes_releves_motif_long check (motif_annulation is null or char_length(motif_annulation) <= 500),
  constraint dates_courtes_releves_tournee_fk foreign key (tournee_id, site) references dates_courtes_tournees (id, site),
  constraint dates_courtes_releves_idem unique (site, cle_idempotence),
  constraint dates_courtes_releves_id_site unique (id, site)
);
create index if not exists dates_courtes_releves_tournee on dates_courtes_releves (site, tournee_id);

create table if not exists dates_courtes_corrections (
  id uuid primary key default gen_random_uuid(),
  site text not null references sites(site_id),
  ean text, libelle_normalise text,
  date_limite date not null check (date_limite between date '2000-01-01' and date '2100-01-01'),
  delta integer not null check (delta <> 0 and abs(delta) <= 100000),
  releve_id uuid,
  motif text check (motif is null or char_length(motif) <= 500),
  cle_groupe text not null,
  tournee_id uuid not null,
  heure_geste timestamptz not null,
  recu_le timestamptz not null default now(),
  recu_apres_cloture boolean not null default false,
  rectification boolean not null default false,
  cle_idempotence text not null check (length(btrim(cle_idempotence)) between 1 and 100),
  lien_id uuid,
  saisi_par uuid not null default auth.uid() references employees(id),
  saisi_le timestamptz not null default now(),
  annule_le timestamptz, annule_par uuid references employees(id), motif_annulation text,
  constraint dates_courtes_corrections_produit check (ean is not null or libelle_normalise is not null),
  constraint dates_courtes_corrections_annulation check ((annule_le is null and annule_par is null and motif_annulation is null)
    or (annule_le is not null and annule_par is not null and length(btrim(coalesce(motif_annulation, ''))) > 0)),
  constraint dates_courtes_corrections_motif_long check (motif_annulation is null or char_length(motif_annulation) <= 500),
  constraint dates_courtes_corrections_releve_fk foreign key (releve_id, site) references dates_courtes_releves (id, site),
  constraint dates_courtes_corrections_tournee_fk foreign key (tournee_id, site) references dates_courtes_tournees (id, site),
  constraint dates_courtes_corrections_idem unique (site, cle_idempotence)
);
create index if not exists dates_courtes_corrections_tournee on dates_courtes_corrections (site, tournee_id);

create table if not exists dates_courtes_retraits (
  id uuid primary key default gen_random_uuid(),
  site text not null references sites(site_id),
  ean text, libelle_normalise text,
  date_limite date not null check (date_limite between date '2000-01-01' and date '2100-01-01'),
  quantite integer not null check (quantite > 0 and quantite <= 100000),
  etat text not null default 'retire_physique' check (etat = 'retire_physique'),
  trouve boolean not null default false,
  releve_id uuid,
  cle_groupe text not null,
  tournee_id uuid not null,
  heure_geste timestamptz not null,
  recu_le timestamptz not null default now(),
  recu_apres_cloture boolean not null default false,
  rectification boolean not null default false,
  cle_idempotence text not null check (length(btrim(cle_idempotence)) between 1 and 100),
  lien_id uuid,
  saisi_par uuid not null default auth.uid() references employees(id),
  saisi_le timestamptz not null default now(),
  annule_le timestamptz, annule_par uuid references employees(id), motif_annulation text,
  constraint dates_courtes_retraits_produit check (ean is not null or libelle_normalise is not null),
  constraint dates_courtes_retraits_annulation check ((annule_le is null and annule_par is null and motif_annulation is null)
    or (annule_le is not null and annule_par is not null and length(btrim(coalesce(motif_annulation, ''))) > 0)),
  constraint dates_courtes_retraits_motif_long check (motif_annulation is null or char_length(motif_annulation) <= 500),
  constraint dates_courtes_retraits_releve_fk foreign key (releve_id, site) references dates_courtes_releves (id, site),
  constraint dates_courtes_retraits_tournee_fk foreign key (tournee_id, site) references dates_courtes_tournees (id, site),
  constraint dates_courtes_retraits_idem unique (site, cle_idempotence),
  constraint dates_courtes_retraits_id_site unique (id, site)
);
create index if not exists dates_courtes_retraits_tournee on dates_courtes_retraits (site, tournee_id);

-- Démarque comptabilisée : état qui suit un retrait physique. Quantité, heure du geste, auteur, motif facultatif, lien vers le retrait et la tournée,
-- clé d'idempotence. Aucune colonne d'euros, aucun lien avec Decenium ni inventaire_mouvements : le lot ne comptabilise rien.
create table if not exists dates_courtes_demarques (
  id uuid primary key default gen_random_uuid(),
  site text not null references sites(site_id),
  retrait_id uuid not null,
  tournee_id uuid not null,
  quantite integer not null check (quantite > 0 and quantite <= 100000),
  motif text check (motif is null or char_length(motif) <= 500),
  heure_geste timestamptz not null,
  recu_le timestamptz not null default now(),
  cle_idempotence text not null check (length(btrim(cle_idempotence)) between 1 and 100),
  saisi_par uuid not null default auth.uid() references employees(id),
  saisi_le timestamptz not null default now(),
  annule_le timestamptz, annule_par uuid references employees(id), motif_annulation text,
  constraint dates_courtes_demarques_annulation check ((annule_le is null and annule_par is null and motif_annulation is null)
    or (annule_le is not null and annule_par is not null and length(btrim(coalesce(motif_annulation, ''))) > 0)),
  constraint dates_courtes_demarques_motif_long check (motif_annulation is null or char_length(motif_annulation) <= 500),
  constraint dates_courtes_demarques_retrait_fk foreign key (retrait_id, site) references dates_courtes_retraits (id, site),
  constraint dates_courtes_demarques_tournee_fk foreign key (tournee_id, site) references dates_courtes_tournees (id, site),
  constraint dates_courtes_demarques_idem unique (site, cle_idempotence)
);
create index if not exists dates_courtes_demarques_retrait on dates_courtes_demarques (site, retrait_id);

create table if not exists dates_courtes_correspondances (
  id uuid primary key default gen_random_uuid(),
  site text not null references sites(site_id),
  type_cle text not null check (type_cle in ('libelle', 'ean')),
  cle_ancienne text not null check (length(btrim(cle_ancienne)) > 0),
  cle_nouvelle text not null check (length(btrim(cle_nouvelle)) > 0),
  saisi_par uuid not null default auth.uid() references employees(id),
  saisi_le timestamptz not null default now(),
  annule_le timestamptz, annule_par uuid references employees(id), motif_annulation text,
  constraint dates_courtes_correspondances_distinctes check (cle_ancienne <> cle_nouvelle),
  constraint dates_courtes_correspondances_annulation check ((annule_le is null and annule_par is null and motif_annulation is null)
    or (annule_le is not null and annule_par is not null and length(btrim(coalesce(motif_annulation, ''))) > 0)),
  constraint dates_courtes_correspondances_motif_long check (motif_annulation is null or char_length(motif_annulation) <= 500)
);
create unique index if not exists dates_courtes_correspondances_active_uq on dates_courtes_correspondances (site, type_cle, cle_ancienne) where annule_le is null;

-- Réglage « accès caissier » : historique en ajout seul, la dernière ligne de la station fait foi. Fermé par défaut (aucune ligne).
create table if not exists dates_courtes_acces_caissier (
  id uuid primary key default gen_random_uuid(),
  site text not null references sites(site_id),
  actif boolean not null,
  saisi_par uuid not null default auth.uid() references employees(id),
  saisi_le timestamptz not null default clock_timestamp()
);
create index if not exists dates_courtes_acces_caissier_site on dates_courtes_acces_caissier (site, saisi_le desc);

-- Certifications : une nouvelle certification s'ajoute, l'ancienne reste tracée. Écrites par fonction serveur seulement.
create table if not exists dates_courtes_certifications (
  id uuid primary key default gen_random_uuid(),
  site text not null references sites(site_id),
  tournee_id uuid not null,
  certifiee_par uuid not null default auth.uid() references employees(id),
  certifiee_le timestamptz not null default now(),
  version_certifiee text not null,
  observations text check (observations is null or char_length(observations) <= 1000),
  statut text not null default 'certifiee' check (statut = 'certifiee'),
  realisateur_identique boolean not null default false,
  cle_idempotence text not null check (length(btrim(cle_idempotence)) between 1 and 100),
  constraint dates_courtes_certifications_tournee_fk foreign key (tournee_id, site) references dates_courtes_tournees (id, site),
  constraint dates_courtes_certifications_idem unique (site, cle_idempotence)
);
create index if not exists dates_courtes_certifications_tournee on dates_courtes_certifications (site, tournee_id);

-- Demandes de correction : relevés visés et motif ; la réponse du renfort est la seule mise à jour, par fonction serveur.
create table if not exists dates_courtes_demandes_correction (
  id uuid primary key default gen_random_uuid(),
  site text not null references sites(site_id),
  tournee_id uuid not null,
  demandee_par uuid not null default auth.uid() references employees(id),
  demandee_le timestamptz not null default now(),
  motif text not null check (length(btrim(motif)) between 1 and 500),
  releves_vises uuid[] not null check (cardinality(releves_vises) >= 1),
  reponse text check (reponse is null or length(btrim(reponse)) between 1 and 500),
  repondue_par uuid references employees(id),
  repondue_le timestamptz,
  cle_idempotence text not null check (length(btrim(cle_idempotence)) between 1 and 100),
  constraint dates_courtes_demandes_reponse check ((reponse is null and repondue_par is null and repondue_le is null)
    or (reponse is not null and repondue_par is not null and repondue_le is not null)),
  constraint dates_courtes_demandes_tournee_fk foreign key (tournee_id, site) references dates_courtes_tournees (id, site),
  constraint dates_courtes_demandes_idem unique (site, cle_idempotence)
);
create index if not exists dates_courtes_demandes_tournee on dates_courtes_demandes_correction (site, tournee_id);

-- 3. Fonctions d'aide de lecture des droits (SECURITY DEFINER : elles ne lisent que la ligne de la personne connectée).
-- Pompiste et vacataire n'apparaissent dans aucune d'elles : refus par construction.
create or replace function dates_courtes_operer() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from employees e where e.id = auth.uid() and e.actif
    and (e.role in ('renfort', 'manager', 'gerant')
      or (e.est_createur and exists (select 1 from sites s where s.site_id = e.site_id and s.acces_createur_autorise))))
$$;

create or replace function dates_courtes_gestion() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from employees e where e.id = auth.uid() and e.actif
    and (e.role in ('manager', 'gerant')
      or (e.est_createur and exists (select 1 from sites s where s.site_id = e.site_id and s.acces_createur_autorise))))
$$;

create or replace function dates_courtes_caissier_autorise() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from employees e where e.id = auth.uid() and e.actif and e.role = 'caissier'
    and coalesce((select a.actif from dates_courtes_acces_caissier a where a.site = e.site_id order by a.saisi_le desc, a.id desc limit 1), false))
$$;

-- 4. Résolution des correspondances (rattachements « même produit que… »), suivies jusqu'à 20 maillons.
create or replace function dates_courtes_resolution(p_site text, p_type text, p_valeur text) returns text
language plpgsql stable set search_path = public, pg_temp as $$
declare v text := p_valeur; v_suivant text; v_i integer;
begin
  for v_i in 1..20 loop
    select c.cle_nouvelle into v_suivant from dates_courtes_correspondances c
      where c.site = p_site and c.type_cle = p_type and c.cle_ancienne = v and c.annule_le is null;
    exit when v_suivant is null;
    v := v_suivant;
  end loop;
  return v;
end $$;

create or replace function dates_courtes_cle_canonique(p_site text, p_ean text, p_libelle text, p_date date) returns text
language sql stable set search_path = public, pg_temp as $$
  select case when p_ean is not null
    then dates_courtes_cle_groupe(p_site, dates_courtes_resolution(p_site, 'ean', p_ean), null, p_date)
    else dates_courtes_cle_groupe(p_site, null, dates_courtes_resolution(p_site, 'libelle', p_libelle), p_date) end
$$;

-- Clé d'article (sans la date) : l'article est la maille du « dernier relevé effectif qui l'emporte ».
create or replace function dates_courtes_cle_article(p_site text, p_ean text, p_libelle text) returns text
language sql stable set search_path = public, pg_temp as $$
  select case when p_ean is not null then p_site || '|E|' || dates_courtes_resolution(p_site, 'ean', p_ean)
              else p_site || '|L|' || coalesce(dates_courtes_resolution(p_site, 'libelle', p_libelle), '') end
$$;

-- Total brut d'un groupe dans une tournée (relevés et corrections, jamais les retraits : un retrait n'appartient pas à la tournée), sans plancher.
-- SECURITY DEFINER pour que le plancher d'une correction soit vérifié sur tous les gestes de la tournée.
-- Appelable seulement depuis un déclencheur : jamais directement par un client.
create or replace function dates_courtes_total_brut(p_site text, p_cle text, p_tournee uuid, p_exclure_table text default null, p_exclure_id uuid default null) returns integer
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_total integer;
begin
  if pg_trigger_depth() = 0 then
    raise exception 'appel_interdit : cette fonction ne s''appelle que depuis un déclencheur' using errcode = 'P0001';
  end if;
  if not exists (select 1 from employees e where e.id = auth.uid() and e.actif and e.site_id = p_site) then
    raise exception 'site_interdit : station différente de celle de la personne connectée' using errcode = 'P0001';
  end if;
  select coalesce((select sum(r.quantite) from dates_courtes_releves r
                    where r.site = p_site and r.tournee_id = p_tournee and r.annule_le is null
                      and not coalesce(p_exclure_table = 'dates_courtes_releves' and r.id = p_exclure_id, false)
                      and dates_courtes_cle_canonique(r.site, r.ean, r.libelle_normalise, r.date_limite) = p_cle), 0)
       + coalesce((select sum(c.delta) from dates_courtes_corrections c
                    where c.site = p_site and c.tournee_id = p_tournee and c.annule_le is null
                      and not coalesce(p_exclure_table = 'dates_courtes_corrections' and c.id = p_exclure_id, false)
                      and dates_courtes_cle_canonique(c.site, c.ean, c.libelle_normalise, c.date_limite) = p_cle), 0)
  into v_total;
  return v_total;
end $$;

-- Porte de la tournée : verrouille la ligne de tournée, vérifie qu'elle appartient à la personne connectée, et dit comment le geste s'y rattache.
-- 'normal' (tournée en cours), 'apres_cloture' (geste fait avant la clôture, reçu après), 'rectification' (geste fait après la clôture, sur une tournée certifiée
-- ou dont une correction a été demandée). Une tournée certifiée repasse à certifier ; l'ancienne certification reste tracée.
-- Appelable seulement depuis un déclencheur.
create or replace function dates_courtes_porte_tournee(p_site text, p_tournee uuid, p_geste timestamptz) returns text
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare t record;
begin
  if pg_trigger_depth() = 0 then
    raise exception 'appel_interdit : cette fonction ne s''appelle que depuis un déclencheur' using errcode = 'P0001';
  end if;
  if not exists (select 1 from employees e where e.id = auth.uid() and e.actif and e.site_id = p_site) then
    raise exception 'site_interdit : station différente de celle de la personne connectée' using errcode = 'P0001';
  end if;
  select * into t from dates_courtes_tournees x where x.id = p_tournee and x.site = p_site for update;
  if not found then
    raise exception 'tournee_inconnue : tournée inconnue pour cette station' using errcode = 'P0001';
  end if;
  if t.saisi_par <> auth.uid() then
    raise exception 'tournee_interdite : on ne saisit que dans sa propre tournée' using errcode = 'P0001';
  end if;
  if t.etat = 'EN_COURS' then return 'normal'; end if;
  if p_geste <= t.terminee_le then
    if t.etat = 'CERTIFIEE' then update dates_courtes_tournees set etat = 'TERMINEE_A_CERTIFIER' where id = p_tournee; end if;
    return 'apres_cloture';
  end if;
  if t.etat = 'TERMINEE_A_CERTIFIER' then
    raise exception 'tournee_terminee : la tournée est terminée, un nouveau geste appelle une demande de correction ou une nouvelle tournée' using errcode = 'P0001';
  end if;
  if t.etat = 'CERTIFIEE' then update dates_courtes_tournees set etat = 'TERMINEE_A_CERTIFIER' where id = p_tournee; end if;
  return 'rectification';
end $$;

-- Une annulation dans une tournée certifiée est une rectification : la tournée repasse à certifier. Appelable seulement depuis un déclencheur.
create or replace function dates_courtes_signaler_modification(p_tournee uuid) returns void
language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  if pg_trigger_depth() = 0 then
    raise exception 'appel_interdit : cette fonction ne s''appelle que depuis un déclencheur' using errcode = 'P0001';
  end if;
  update dates_courtes_tournees t set etat = 'TERMINEE_A_CERTIFIER'
    where t.id = p_tournee and t.etat = 'CERTIFIEE'
      and exists (select 1 from employees e where e.id = auth.uid() and e.actif and e.site_id = t.site);
end $$;

-- Une démarque active sur un retrait empêche son annulation (lecture élargie à toute la station). Appelable seulement depuis un déclencheur.
create or replace function dates_courtes_demarque_active(p_retrait uuid) returns boolean
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if pg_trigger_depth() = 0 then
    raise exception 'appel_interdit : cette fonction ne s''appelle que depuis un déclencheur' using errcode = 'P0001';
  end if;
  return exists (select 1 from dates_courtes_demarques d
    join employees e on e.id = auth.uid() and e.actif and e.site_id = d.site
    where d.retrait_id = p_retrait and d.annule_le is null);
end $$;

-- 5. Déclencheurs : la clé de groupe, l'heure de réception et les marques de rattachement sont posées par le serveur, jamais par le client.
create or replace function dates_courtes_avant_insertion() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_cle text; v_total integer; v_mode text;
begin
  NEW.ean := dates_courtes_normaliser_ean(NEW.ean);
  if TG_TABLE_NAME = 'dates_courtes_releves' then
    NEW.libelle_normalise := nullif(dates_courtes_normaliser_libelle(coalesce(NEW.libelle_vu, NEW.libelle_normalise)), '');
  else
    NEW.libelle_normalise := nullif(dates_courtes_normaliser_libelle(NEW.libelle_normalise), '');
  end if;
  if NEW.ean is null and NEW.libelle_normalise is null then
    raise exception 'produit_requis : un code-barres valide ou un libellé est obligatoire' using errcode = 'P0001';
  end if;
  if NEW.tournee_id is null then
    raise exception 'tournee_requise : la tournée est obligatoire' using errcode = 'P0001';
  end if;
  NEW.heure_geste := coalesce(NEW.heure_geste, now());
  if NEW.heure_geste < now() - interval '45 days' or NEW.heure_geste > now() + interval '5 minutes' then
    raise exception 'heure_geste_hors_bornes : l''heure du geste doit tenir entre 45 jours dans le passé et 5 minutes dans le futur' using errcode = 'P0001';
  end if;
  NEW.recu_le := now();
  NEW.cle_groupe := dates_courtes_cle_groupe(NEW.site, NEW.ean, NEW.libelle_normalise, NEW.date_limite);

  v_mode := dates_courtes_porte_tournee(NEW.site, NEW.tournee_id, NEW.heure_geste);
  NEW.recu_apres_cloture := (v_mode = 'apres_cloture');
  NEW.rectification := (v_mode = 'rectification');

  v_cle := dates_courtes_cle_canonique(NEW.site, NEW.ean, NEW.libelle_normalise, NEW.date_limite);
  perform pg_advisory_xact_lock(hashtextextended(NEW.site || '|' || NEW.tournee_id::text || '|' || v_cle, 0));
  if TG_TABLE_NAME = 'dates_courtes_corrections' then
    if NEW.delta < 0 then
      v_total := dates_courtes_total_brut(NEW.site, v_cle, NEW.tournee_id);
      if v_total + NEW.delta < 0 then
        raise exception 'plancher_zero : la correction ferait passer la quantité sous zéro (quantité actuelle %, correction %)', v_total, NEW.delta using errcode = 'P0001';
      end if;
    end if;
  elsif TG_TABLE_NAME = 'dates_courtes_retraits' then
    -- Un retrait physique diminue la quantité courante de la ligne (article, date) de la station, quelle que soit la tournée où il est saisi.
    -- Verrou par ligne et par station ; plancher vérifié sur la quantité courante. Un trouvé-et-retiré n'est pas dans la liste : il n'est jamais refusé.
    perform pg_advisory_xact_lock(hashtextextended(NEW.site || '|L|' || dates_courtes_cle_article(NEW.site, NEW.ean, NEW.libelle_normalise) || '|' || NEW.date_limite::text, 0));
    if not NEW.trouve then
      v_total := dates_courtes_courant_ligne(NEW.site, dates_courtes_cle_article(NEW.site, NEW.ean, NEW.libelle_normalise), NEW.date_limite);
      if v_total - NEW.quantite < 0 then
        raise exception 'plancher_zero : le retrait ferait passer la quantité courante sous zéro (quantité courante %, retrait %)', v_total, NEW.quantite using errcode = 'P0001';
      end if;
    end if;
  end if;
  return NEW;
end $$;

create or replace function dates_courtes_avant_annulation() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_cle text; v_total integer;
begin
  if OLD.annule_le is null and NEW.annule_le is not null then
    if TG_TABLE_NAME = 'dates_courtes_retraits' and dates_courtes_demarque_active(OLD.id) then
      raise exception 'demarque_existante : une démarque comptabilisée repose sur ce retrait, l''annuler d''abord' using errcode = 'P0001';
    end if;
    if TG_TABLE_NAME in ('dates_courtes_releves', 'dates_courtes_corrections') then
      v_cle := dates_courtes_cle_canonique(OLD.site, OLD.ean, OLD.libelle_normalise, OLD.date_limite);
      perform pg_advisory_xact_lock(hashtextextended(OLD.site || '|' || OLD.tournee_id::text || '|' || v_cle, 0));
      v_total := dates_courtes_total_brut(OLD.site, v_cle, OLD.tournee_id, TG_TABLE_NAME, OLD.id);
      if v_total < 0 then
        raise exception 'plancher_zero : l''annulation ferait passer la quantité sous zéro' using errcode = 'P0001';
      end if;
    end if;
    perform dates_courtes_signaler_modification(OLD.tournee_id);
  end if;
  return NEW;
end $$;

create or replace function dates_courtes_avant_correspondance() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
declare v text := NEW.cle_nouvelle; v_suivant text; v_i integer;
begin
  for v_i in 1..20 loop
    if v = NEW.cle_ancienne then
      raise exception 'cycle_correspondance : ce rattachement créerait une boucle' using errcode = 'P0001';
    end if;
    select c.cle_nouvelle into v_suivant from dates_courtes_correspondances c
      where c.site = NEW.site and c.type_cle = NEW.type_cle and c.cle_ancienne = v and c.annule_le is null;
    exit when v_suivant is null;
    v := v_suivant;
  end loop;
  return NEW;
end $$;

-- Démarque : la quantité cumulée des démarques actives d'un retrait ne dépasse jamais la quantité retirée. Vérifié sous verrou, même en insertion directe.
create or replace function dates_courtes_avant_demarque() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_ret record; v_deja integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(NEW.site || '|retrait|' || NEW.retrait_id::text, 0));
  select x.quantite, x.tournee_id, x.annule_le into v_ret from dates_courtes_retraits x where x.id = NEW.retrait_id and x.site = NEW.site;
  if not found then
    raise exception 'introuvable : retrait inconnu pour cette station' using errcode = 'P0001';
  end if;
  if v_ret.annule_le is not null then
    raise exception 'retrait_annule : ce retrait est annulé' using errcode = 'P0001';
  end if;
  NEW.tournee_id := v_ret.tournee_id;
  NEW.heure_geste := coalesce(NEW.heure_geste, now());
  if NEW.heure_geste < now() - interval '45 days' or NEW.heure_geste > now() + interval '5 minutes' then
    raise exception 'heure_geste_hors_bornes : l''heure du geste doit tenir entre 45 jours dans le passé et 5 minutes dans le futur' using errcode = 'P0001';
  end if;
  NEW.recu_le := now();
  select coalesce(sum(d.quantite), 0) into v_deja from dates_courtes_demarques d where d.retrait_id = NEW.retrait_id and d.site = NEW.site and d.annule_le is null;
  if v_deja + NEW.quantite > v_ret.quantite then
    raise exception 'quantite_superieure_au_retrait : démarque cumulée % pour un retrait de %', v_deja + NEW.quantite, v_ret.quantite using errcode = 'P0001';
  end if;
  return NEW;
end $$;

drop trigger if exists dates_courtes_releves_avant_insertion on dates_courtes_releves;
create trigger dates_courtes_releves_avant_insertion before insert on dates_courtes_releves for each row execute function dates_courtes_avant_insertion();
drop trigger if exists dates_courtes_corrections_avant_insertion on dates_courtes_corrections;
create trigger dates_courtes_corrections_avant_insertion before insert on dates_courtes_corrections for each row execute function dates_courtes_avant_insertion();
drop trigger if exists dates_courtes_retraits_avant_insertion on dates_courtes_retraits;
create trigger dates_courtes_retraits_avant_insertion before insert on dates_courtes_retraits for each row execute function dates_courtes_avant_insertion();
drop trigger if exists dates_courtes_releves_avant_annulation on dates_courtes_releves;
create trigger dates_courtes_releves_avant_annulation before update on dates_courtes_releves for each row execute function dates_courtes_avant_annulation();
drop trigger if exists dates_courtes_corrections_avant_annulation on dates_courtes_corrections;
create trigger dates_courtes_corrections_avant_annulation before update on dates_courtes_corrections for each row execute function dates_courtes_avant_annulation();
drop trigger if exists dates_courtes_retraits_avant_annulation on dates_courtes_retraits;
create trigger dates_courtes_retraits_avant_annulation before update on dates_courtes_retraits for each row execute function dates_courtes_avant_annulation();
drop trigger if exists dates_courtes_correspondances_avant_insertion on dates_courtes_correspondances;
create trigger dates_courtes_correspondances_avant_insertion before insert on dates_courtes_correspondances for each row execute function dates_courtes_avant_correspondance();
drop trigger if exists dates_courtes_demarques_avant_insertion on dates_courtes_demarques;
create trigger dates_courtes_demarques_avant_insertion before insert on dates_courtes_demarques for each row execute function dates_courtes_avant_demarque();

-- 6. Sécurité par ligne : site de la personne connectée, aucun accès anon, aucune suppression, mise à jour limitée aux colonnes d'annulation.
do $$
declare t text;
begin
  foreach t in array array['dates_courtes_tournees', 'dates_courtes_releves', 'dates_courtes_corrections', 'dates_courtes_retraits', 'dates_courtes_demarques',
                           'dates_courtes_correspondances', 'dates_courtes_acces_caissier', 'dates_courtes_certifications', 'dates_courtes_demandes_correction'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists compte_actif_obligatoire on %I', t);
    execute format('create policy compte_actif_obligatoire on %I as restrictive to authenticated using (exists (select 1 from employees e where e.id = (select auth.uid()) and e.actif))', t);
    execute format('revoke all on %I from anon, public, authenticated, service_role', t);
  end loop;
  foreach t in array array['dates_courtes_tournees', 'dates_courtes_releves', 'dates_courtes_corrections', 'dates_courtes_retraits', 'dates_courtes_demarques',
                           'dates_courtes_correspondances', 'dates_courtes_acces_caissier'] loop
    execute format('grant select, insert on %I to authenticated, service_role', t);
  end loop;
  foreach t in array array['dates_courtes_certifications', 'dates_courtes_demandes_correction'] loop
    execute format('grant select on %I to authenticated, service_role', t);
  end loop;
  foreach t in array array['dates_courtes_releves', 'dates_courtes_corrections', 'dates_courtes_retraits', 'dates_courtes_demarques', 'dates_courtes_correspondances'] loop
    execute format('grant update (annule_le, annule_par, motif_annulation) on %I to authenticated, service_role', t);
  end loop;
end $$;

-- Tournées : le réalisateur (renfort, caissier habilité) ne lit que les siennes ; manager, gérant et créateur lisent toute la station.
-- Création par un opérateur ou un caissier habilité, toujours en cours. Aucune mise à jour directe : les changements d'état passent par les fonctions serveur.
drop policy if exists lecture_meme_site on dates_courtes_tournees;
create policy lecture_meme_site on dates_courtes_tournees for select to authenticated using (site = (select current_employee_site_id())
  and ((select dates_courtes_gestion()) or (saisi_par = (select auth.uid()) and ((select dates_courtes_operer()) or (select dates_courtes_caissier_autorise())))));
drop policy if exists insertion_meme_site on dates_courtes_tournees;
create policy insertion_meme_site on dates_courtes_tournees for insert to authenticated with check (site = (select current_employee_site_id())
  and saisi_par = (select auth.uid()) and etat = 'EN_COURS' and ((select dates_courtes_operer()) or (select dates_courtes_caissier_autorise())));

-- Relevés et corrections : même règle de lecture ; insertion par un opérateur ou un caissier habilité dans sa propre tournée (vérifié par le déclencheur).
-- Annulation : opérateurs seulement, la sienne pour un renfort, toute la station pour la gestion.
do $$
declare t text;
begin
  foreach t in array array['dates_courtes_releves', 'dates_courtes_corrections'] loop
    execute format('drop policy if exists lecture_meme_site on %I', t);
    execute format($p$create policy lecture_meme_site on %I for select to authenticated using (site = (select current_employee_site_id())
      and ((select dates_courtes_gestion()) or (saisi_par = (select auth.uid()) and ((select dates_courtes_operer()) or (select dates_courtes_caissier_autorise())))))$p$, t);
    execute format('drop policy if exists insertion_meme_site on %I', t);
    execute format($p$create policy insertion_meme_site on %I for insert to authenticated with check (site = (select current_employee_site_id())
      and saisi_par = (select auth.uid()) and ((select dates_courtes_operer()) or (select dates_courtes_caissier_autorise())))$p$, t);
    execute format('drop policy if exists annulation_meme_site on %I', t);
    execute format($p$create policy annulation_meme_site on %I for update to authenticated
      using (site = (select current_employee_site_id()) and (select dates_courtes_operer()) and ((select dates_courtes_gestion()) or saisi_par = (select auth.uid())) and annule_le is null)
      with check (site = (select current_employee_site_id()) and (select dates_courtes_operer()) and annule_le is not null and annule_par = (select auth.uid()))$p$, t);
  end loop;
end $$;

-- Retraits : opérateurs seulement (le caissier ne confirme aucun retrait).
drop policy if exists lecture_meme_site on dates_courtes_retraits;
create policy lecture_meme_site on dates_courtes_retraits for select to authenticated using (site = (select current_employee_site_id())
  and ((select dates_courtes_gestion()) or (saisi_par = (select auth.uid()) and (select dates_courtes_operer()))));
drop policy if exists insertion_meme_site on dates_courtes_retraits;
create policy insertion_meme_site on dates_courtes_retraits for insert to authenticated with check (site = (select current_employee_site_id()) and saisi_par = (select auth.uid()) and (select dates_courtes_operer()));
drop policy if exists annulation_meme_site on dates_courtes_retraits;
create policy annulation_meme_site on dates_courtes_retraits for update to authenticated
  using (site = (select current_employee_site_id()) and (select dates_courtes_operer()) and ((select dates_courtes_gestion()) or saisi_par = (select auth.uid())) and annule_le is null)
  with check (site = (select current_employee_site_id()) and (select dates_courtes_operer()) and annule_le is not null and annule_par = (select auth.uid()));

-- Démarques : gestion seule (manager, gérant, créateur). Le renfort, le caissier, le pompiste et le vacataire ne lisent ni n'écrivent.
drop policy if exists lecture_gestion_meme_site on dates_courtes_demarques;
create policy lecture_gestion_meme_site on dates_courtes_demarques for select to authenticated using (site = (select current_employee_site_id()) and (select dates_courtes_gestion()));
drop policy if exists insertion_gestion_meme_site on dates_courtes_demarques;
create policy insertion_gestion_meme_site on dates_courtes_demarques for insert to authenticated with check (site = (select current_employee_site_id()) and saisi_par = (select auth.uid()) and (select dates_courtes_gestion()));
drop policy if exists annulation_gestion_meme_site on dates_courtes_demarques;
create policy annulation_gestion_meme_site on dates_courtes_demarques for update to authenticated
  using (site = (select current_employee_site_id()) and (select dates_courtes_gestion()) and annule_le is null)
  with check (site = (select current_employee_site_id()) and (select dates_courtes_gestion()) and annule_le is not null and annule_par = (select auth.uid()));

-- Correspondances : lecture par les opérateurs et le caissier habilité (le groupe se calcule de la même façon pour tous) ; pose et annulation par la gestion.
drop policy if exists lecture_meme_site on dates_courtes_correspondances;
create policy lecture_meme_site on dates_courtes_correspondances for select to authenticated using (site = (select current_employee_site_id())
  and ((select dates_courtes_operer()) or (select dates_courtes_caissier_autorise())));
drop policy if exists insertion_gestion_meme_site on dates_courtes_correspondances;
create policy insertion_gestion_meme_site on dates_courtes_correspondances for insert to authenticated with check (site = (select current_employee_site_id()) and saisi_par = (select auth.uid()) and (select dates_courtes_gestion()));
drop policy if exists annulation_gestion_meme_site on dates_courtes_correspondances;
create policy annulation_gestion_meme_site on dates_courtes_correspondances for update to authenticated
  using (site = (select current_employee_site_id()) and (select dates_courtes_gestion()) and annule_le is null)
  with check (site = (select current_employee_site_id()) and (select dates_courtes_gestion()) and annule_le is not null and annule_par = (select auth.uid()));

-- Accès caissier : lecture par les opérateurs et les caissiers de la station ; activation et fermeture par la gestion seule.
drop policy if exists lecture_meme_site on dates_courtes_acces_caissier;
create policy lecture_meme_site on dates_courtes_acces_caissier for select to authenticated using (site = (select current_employee_site_id())
  and ((select dates_courtes_operer()) or (select current_employee_role()) = 'caissier'));
drop policy if exists insertion_gestion_meme_site on dates_courtes_acces_caissier;
create policy insertion_gestion_meme_site on dates_courtes_acces_caissier for insert to authenticated with check (site = (select current_employee_site_id()) and saisi_par = (select auth.uid()) and (select dates_courtes_gestion()));

-- Certifications et demandes de correction : lecture de la gestion pour toute la station, du réalisateur pour sa propre tournée. Écriture par fonction serveur seulement.
drop policy if exists lecture_meme_site on dates_courtes_certifications;
create policy lecture_meme_site on dates_courtes_certifications for select to authenticated using (site = (select current_employee_site_id())
  and ((select dates_courtes_gestion()) or tournee_id in (select t.id from dates_courtes_tournees t)));
drop policy if exists lecture_meme_site on dates_courtes_demandes_correction;
create policy lecture_meme_site on dates_courtes_demandes_correction for select to authenticated using (site = (select current_employee_site_id())
  and ((select dates_courtes_gestion()) or tournee_id in (select t.id from dates_courtes_tournees t)));

-- 7. Version d'une tournée : empreinte des relevés et corrections consolidés (plancher à zéro par groupe ; les retraits n'en font pas partie) et dernière opération reçue ou annulée.
-- Deux appels sans changement donnent la même version. Lecture de toute la tournée, réservée à sa station.
create or replace function dates_courtes_version_tournee(p_tournee uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_site text; v_emp text; v_der text;
begin
  select t.site into v_site from dates_courtes_tournees t where t.id = p_tournee
    and (dates_courtes_gestion() or t.saisi_par = auth.uid());
  if v_site is null or not exists (select 1 from employees e where e.id = auth.uid() and e.actif and e.site_id = v_site) then
    raise exception 'introuvable : tournée inconnue, ou réservée à la gestion et à son auteur' using errcode = 'P0001';
  end if;
  select md5(coalesce(string_agg(q.cle || '=' || q.s::text, '|' order by q.cle), '')) into v_emp from (
    select dates_courtes_cle_canonique(m.site, m.ean, m.libelle_normalise, m.date_limite) as cle, greatest(0, sum(m.q)) as s
    from (select r.site, r.ean, r.libelle_normalise, r.date_limite, r.quantite as q from dates_courtes_releves r where r.tournee_id = p_tournee and r.annule_le is null
          union all select c.site, c.ean, c.libelle_normalise, c.date_limite, c.delta from dates_courtes_corrections c where c.tournee_id = p_tournee and c.annule_le is null) m
    group by 1) q;
  select y.cle into v_der from (
    select r.cle_idempotence as cle, greatest(r.recu_le, r.annule_le) as h from dates_courtes_releves r where r.tournee_id = p_tournee
    union all select c.cle_idempotence, greatest(c.recu_le, c.annule_le) from dates_courtes_corrections c where c.tournee_id = p_tournee
    union all select x.cle_idempotence, greatest(x.recu_le, x.annule_le) from dates_courtes_retraits x where x.tournee_id = p_tournee) y
    order by y.h desc, y.cle desc limit 1;
  return jsonb_build_object('empreinte', v_emp, 'derniere_operation', coalesce(v_der, ''));
end $$;

-- 8. Quantité courante, par ligne de date limite. Jamais stockée : calculée à la lecture, sur toutes les tournées de la station.
-- Pour chaque article, la tournée qui porte le dernier relevé effectif (heure du geste) l'emporte ; ses relevés et corrections par date donnent la base de chaque ligne.
-- Un retrait physique n'est pas un relevé : il ne désigne jamais la tournée de référence et ne rajeunit jamais une ligne. Il diminue la quantité courante de la ligne
-- (article, date) de la station, quelle que soit la tournée où il est saisi, s'il est de la tournée de référence ou postérieur au relevé de référence.
-- Un retrait (article, date) ne compte que s'il est postérieur ou égal au dernier relevé effectif de cette ligne.
-- Un retrait sur un article jamais relevé ne crée aucune quantité courante. Aucune addition entre tournées.
-- Âge : jours calendaires (fuseau Martinique) depuis le dernier relevé effectif de la ligne, jamais depuis un retrait, une certification ou une clôture.
-- Une ligne née d'une correction seule prend l'heure de son premier geste.
-- etat_age : 7 jours et moins courante, 8 à 14 a_verifier, plus de 14 a_recontroler.
-- echeance : date dépassée avec relevé de 7 jours ou moins a_retirer ; date dépassée avec relevé plus ancien depassee_a_verifier (aucune demande de retrait) ; sinon aucune.
-- Noyau interne, jamais appelable par un client : le site est un paramètre, la garde est dans les fonctions qui l'appellent.
create or replace function dates_courtes_courant_station(p_site text, p_instant timestamptz)
returns table (site text, cle_article text, ean text, libelle_normalise text, date_limite date, quantite integer, tournee_id uuid, tournee_etat text,
               dernier_releve timestamptz, age_jours integer, etat_age text, echeance text, autres_tournees jsonb)
language sql stable security definer set search_path = public, pg_temp as $$
  with rel as (
    select r.site, r.tournee_id, r.id, r.heure_geste, dates_courtes_cle_article(r.site, r.ean, r.libelle_normalise) as art
    from dates_courtes_releves r where r.site = p_site and r.annule_le is null and r.heure_geste <= p_instant
  ), gagnante as (
    select distinct on (x.art) x.art, x.tournee_id, x.heure_geste as ref_heure from rel x order by x.art, x.heure_geste desc, x.id desc
  ), base as (
    select g.art, g.tournee_id, m.date_limite, m.ean, m.libelle_normalise, m.q, m.heure_geste, m.est_releve
    from gagnante g join (
      select dates_courtes_cle_article(r.site, r.ean, r.libelle_normalise) as art, r.tournee_id, r.ean, r.libelle_normalise, r.date_limite,
             r.quantite as q, r.heure_geste, true as est_releve
        from dates_courtes_releves r where r.site = p_site and r.annule_le is null and r.heure_geste <= p_instant
      union all
      select dates_courtes_cle_article(c.site, c.ean, c.libelle_normalise), c.tournee_id, c.ean, c.libelle_normalise, c.date_limite, c.delta, c.heure_geste, false
        from dates_courtes_corrections c where c.site = p_site and c.annule_le is null and c.heure_geste <= p_instant
    ) m on m.art = g.art and m.tournee_id = g.tournee_id
  ), lignes as (
    select b.art, b.tournee_id, b.date_limite, max(b.ean) as ean, max(b.libelle_normalise) as libelle_normalise, sum(b.q) as brut,
           coalesce(max(b.heure_geste) filter (where b.est_releve), min(b.heure_geste)) as dernier
    from base b group by b.art, b.tournee_id, b.date_limite
  ), ages as (
    select l.art, l.tournee_id, l.date_limite, l.ean, l.libelle_normalise, l.dernier,
           greatest(0, l.brut - coalesce((select sum(x.quantite) from dates_courtes_retraits x
                                        where x.site = p_site and x.annule_le is null and x.heure_geste <= p_instant
                                          and x.date_limite = l.date_limite
                                          and dates_courtes_cle_article(x.site, x.ean, x.libelle_normalise) = l.art
                                          and x.heure_geste >= l.dernier), 0))::integer as q,
           ((p_instant at time zone 'America/Martinique')::date - (l.dernier at time zone 'America/Martinique')::date) as age,
           ((p_instant at time zone 'America/Martinique')::date) as aujourdhui
    from lignes l
  )
  select p_site, a.art, a.ean, a.libelle_normalise, a.date_limite, a.q, a.tournee_id, t.etat, a.dernier, a.age,
         case when a.age <= 7 then 'courante' when a.age <= 14 then 'a_verifier' else 'a_recontroler' end,
         case when a.date_limite < a.aujourdhui and a.age <= 7 then 'a_retirer'
              when a.date_limite < a.aujourdhui then 'depassee_a_verifier'
              else 'aucune' end,
         (select jsonb_agg(jsonb_build_object('tournee_id', o.tournee_id, 'nom', t2.nom, 'saisi_par', t2.saisi_par, 'heure', o.h) order by o.h desc)
            from (select x.tournee_id, max(x.heure_geste) as h from rel x where x.art = a.art and x.tournee_id <> a.tournee_id group by x.tournee_id) o
            join dates_courtes_tournees t2 on t2.id = o.tournee_id)
  from ages a join dates_courtes_tournees t on t.id = a.tournee_id
  where a.q > 0
$$;

-- Garde de lecture : opérateurs et caissier habilité seulement, site lu depuis le compte. Pompiste et vacataire refusés.
create or replace function dates_courtes_exiger_lecture() returns text
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_site text;
begin
  if auth.uid() is null then
    raise exception 'non_authentifie : connexion requise' using errcode = 'P0001';
  end if;
  select e.site_id into v_site from employees e where e.id = auth.uid() and e.actif;
  if v_site is null or not (dates_courtes_operer() or dates_courtes_caissier_autorise()) then
    raise exception 'droit_refuse : ce profil ne peut pas lire les quantités courantes de dates courtes' using errcode = 'P0001';
  end if;
  return v_site;
end $$;

-- Quantités courantes de la station de la personne connectée. Même quantité, même tournée de référence et même échéance pour tout profil autorisé.
-- Le détail des autres tournées (autres_tournees) n'est rendu qu'à la gestion.
create or replace function dates_courtes_quantites_courantes(p_instant timestamptz default now())
returns table (site text, cle_article text, ean text, libelle_normalise text, date_limite date, quantite integer, tournee_id uuid, tournee_etat text,
               dernier_releve timestamptz, age_jours integer, etat_age text, echeance text, autres_tournees jsonb)
language sql stable security definer set search_path = public, pg_temp as $$
  select c.site, c.cle_article, c.ean, c.libelle_normalise, c.date_limite, c.quantite, c.tournee_id, c.tournee_etat,
         c.dernier_releve, c.age_jours, c.etat_age, c.echeance,
         case when dates_courtes_gestion() then c.autres_tournees end
  from dates_courtes_courant_station(dates_courtes_exiger_lecture(), p_instant) c
$$;

-- Quantité courante d'une ligne, pour le plancher d'un retrait. Appelable seulement depuis un déclencheur.
create or replace function dates_courtes_courant_ligne(p_site text, p_cle_article text, p_date date) returns integer
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if pg_trigger_depth() = 0 then
    raise exception 'appel_interdit : cette fonction ne s''appelle que depuis un déclencheur' using errcode = 'P0001';
  end if;
  if not exists (select 1 from employees e where e.id = auth.uid() and e.actif and e.site_id = p_site) then
    raise exception 'site_interdit : station différente de celle de la personne connectée' using errcode = 'P0001';
  end if;
  return coalesce((select sum(c.quantite)::integer from dates_courtes_courant_station(p_site, now()) c
                    where c.cle_article = p_cle_article and c.date_limite = p_date), 0);
end $$;

create or replace function dates_courtes_quantite_courante(p_ean text, p_libelle text, p_date date) returns integer
language sql stable security invoker set search_path = public, pg_temp as $$
  select coalesce((select sum(q.quantite)::integer from dates_courtes_quantites_courantes() q
    where q.site = (select current_employee_site_id()) and q.date_limite = p_date
      and q.cle_article = dates_courtes_cle_article((select current_employee_site_id()), dates_courtes_normaliser_ean(p_ean),
            nullif(dates_courtes_normaliser_libelle(p_libelle), ''))), 0)
$$;

-- Marque « provisoire » : un EAN lu absent du catalogue importé de la station. Elle disparaît d'elle-même quand l'EAN apparaît dans un import.
create or replace function dates_courtes_est_provisoire(p_ean text) returns boolean
language sql stable security invoker set search_path = public, pg_temp as $$
  select dates_courtes_normaliser_ean(p_ean) is not null
     and not exists (select 1 from products p where p.site = (select current_employee_site_id())
                       and regexp_replace(coalesce(p.code_barres, ''), '[^0-9]', '', 'g') = dates_courtes_normaliser_ean(p_ean))
$$;

-- 9. Fonction d'écriture : rôle et station relus depuis le compte, clé d'idempotence, heure du geste, verrous, plancher à zéro.
-- La tournée est un paramètre de données (tournee_id) vérifié par le serveur : elle doit être celle de la personne connectée. Le site et le rôle ne se transmettent jamais.
create or replace function dates_courtes_enregistrer(p_operation text, p_cle_idempotence text, p_donnees jsonb) returns jsonb
language plpgsql volatile security invoker set search_path = public, pg_temp as $$
declare
  v_actif boolean; v_role text; v_site text; v_createur boolean;
  v_operer boolean; v_autorise boolean;
  v_permis text[]; v_cle text; v_champ text; v_ids jsonb;
  v_ean text; v_lib text; v_date date; v_date2 date; v_qte integer; v_delta integer; v_geste timestamptz; v_motif text; v_prov boolean;
  v_releve uuid; v_lien uuid := gen_random_uuid(); v_id uuid; v_id2 uuid; v_cible text; v_tournee uuid; v_nom text; v_photo text;
begin
  if auth.uid() is null then
    raise exception 'non_authentifie : connexion requise' using errcode = 'P0001';
  end if;
  select e.actif, e.role, e.site_id, coalesce(e.est_createur, false) into v_actif, v_role, v_site, v_createur from employees e where e.id = auth.uid();
  if not found or not v_actif then
    raise exception 'compte_inactif : compte introuvable ou inactif' using errcode = 'P0001';
  end if;
  v_operer := dates_courtes_operer();
  v_autorise := v_operer or (p_operation in ('releve', 'ajout', 'correction') and dates_courtes_caissier_autorise());
  if not v_autorise then
    raise exception 'droit_refuse : ce profil ne peut pas faire cette opération sur les dates courtes' using errcode = 'P0001';
  end if;
  if p_operation is null or p_operation not in ('releve', 'ajout', 'correction', 'retrait', 'trouve_retire', 'changement_date', 'annulation') then
    raise exception 'operation_inconnue : %', coalesce(p_operation, 'vide') using errcode = 'P0001';
  end if;
  if p_cle_idempotence is null or length(btrim(p_cle_idempotence)) not between 1 and 100 then
    raise exception 'cle_idempotence_requise : clé d''idempotence de 1 à 100 caractères' using errcode = 'P0001';
  end if;
  if position(':' in p_cle_idempotence) > 0 then
    raise exception 'cle_idempotence_invalide : le caractère « : » est réservé au serveur' using errcode = 'P0001';
  end if;
  if p_donnees is null or jsonb_typeof(p_donnees) <> 'object' then
    raise exception 'donnees_invalides : un objet JSON est attendu' using errcode = 'P0001';
  end if;
  v_permis := case p_operation
    when 'releve' then array['tournee_id', 'ean', 'libelle', 'nom_libre', 'photo_ref', 'date_limite', 'quantite', 'heure_geste']
    when 'ajout' then array['tournee_id', 'ean', 'libelle', 'nom_libre', 'photo_ref', 'date_limite', 'quantite', 'heure_geste']
    when 'correction' then array['tournee_id', 'ean', 'libelle', 'date_limite', 'delta', 'releve_id', 'motif', 'heure_geste']
    when 'retrait' then array['tournee_id', 'ean', 'libelle', 'date_limite', 'quantite', 'heure_geste']
    when 'trouve_retire' then array['tournee_id', 'ean', 'libelle', 'date_limite', 'quantite', 'heure_geste']
    when 'changement_date' then array['tournee_id', 'ean', 'libelle', 'ancienne_date', 'nouvelle_date', 'quantite', 'heure_geste', 'motif']
    else array['cible', 'id', 'motif'] end;
  for v_champ in select jsonb_object_keys(p_donnees) loop
    if not (v_champ = any (v_permis)) then
      raise exception 'champ_inconnu : % (le site et le rôle ne se transmettent jamais)', v_champ using errcode = 'P0001';
    end if;
  end loop;
  v_cle := btrim(p_cle_idempotence);
  perform pg_advisory_xact_lock(hashtextextended(v_site || '|idem|' || v_cle, 0));

  begin
    if p_operation = 'annulation' then
      v_cible := p_donnees ->> 'cible'; v_id := (p_donnees ->> 'id')::uuid; v_motif := btrim(coalesce(p_donnees ->> 'motif', ''));
      if v_cible is null or v_cible not in ('releves', 'corrections', 'retraits') then
        raise exception 'cible_inconnue : releves, corrections ou retraits' using errcode = 'P0001';
      end if;
      if not v_operer then
        raise exception 'droit_refuse : l''annulation est réservée aux opérateurs' using errcode = 'P0001';
      end if;
      if length(v_motif) = 0 or char_length(v_motif) > 500 then
        raise exception 'motif_requis : motif d''annulation de 1 à 500 caractères' using errcode = 'P0001';
      end if;
      if exists (select 1 from (select annule_le from dates_courtes_releves where v_cible = 'releves' and id = v_id and site = v_site
                  union all select annule_le from dates_courtes_corrections where v_cible = 'corrections' and id = v_id and site = v_site
                  union all select annule_le from dates_courtes_retraits where v_cible = 'retraits' and id = v_id and site = v_site) q where q.annule_le is not null) then
        return jsonb_build_object('statut', 'deja_annule', 'cible', v_cible, 'id', v_id);
      end if;
      if v_cible = 'releves' then
        update dates_courtes_releves set annule_le = now(), annule_par = auth.uid(), motif_annulation = v_motif where id = v_id and site = v_site and annule_le is null;
      elsif v_cible = 'corrections' then
        update dates_courtes_corrections set annule_le = now(), annule_par = auth.uid(), motif_annulation = v_motif where id = v_id and site = v_site and annule_le is null;
      else
        update dates_courtes_retraits set annule_le = now(), annule_par = auth.uid(), motif_annulation = v_motif where id = v_id and site = v_site and annule_le is null;
      end if;
      if not found then
        raise exception 'introuvable : ligne inconnue pour cette station' using errcode = 'P0001';
      end if;
      return jsonb_build_object('statut', 'annule', 'cible', v_cible, 'id', v_id);
    end if;

    -- Rejouement : une opération déjà reçue renvoie le résultat de la première, sans rien écrire.
    select jsonb_agg(q.ligne) into v_ids from (
      select jsonb_build_object('table', 'releves', 'id', id) as ligne from dates_courtes_releves where site = v_site and (cle_idempotence = v_cle or left(cle_idempotence, length(v_cle) + 1) = v_cle || ':')
      union all select jsonb_build_object('table', 'corrections', 'id', id) from dates_courtes_corrections where site = v_site and (cle_idempotence = v_cle or left(cle_idempotence, length(v_cle) + 1) = v_cle || ':')
      union all select jsonb_build_object('table', 'retraits', 'id', id) from dates_courtes_retraits where site = v_site and (cle_idempotence = v_cle or left(cle_idempotence, length(v_cle) + 1) = v_cle || ':')) q;
    if v_ids is not null then
      return jsonb_build_object('statut', 'deja_enregistre', 'lignes', v_ids);
    end if;

    v_tournee := (p_donnees ->> 'tournee_id')::uuid;
    if v_tournee is null then
      raise exception 'tournee_requise : la tournée est obligatoire' using errcode = 'P0001';
    end if;
    v_lib := p_donnees ->> 'libelle';
    v_nom := nullif(btrim(coalesce(p_donnees ->> 'nom_libre', '')), '');
    v_photo := nullif(btrim(coalesce(p_donnees ->> 'photo_ref', '')), '');
    v_ean := dates_courtes_normaliser_ean(p_donnees ->> 'ean');
    if v_ean is null and length(btrim(coalesce(p_donnees ->> 'ean', ''))) > 0 and nullif(dates_courtes_normaliser_libelle(v_lib), '') is null then
      raise exception 'ean_invalide : code-barres illisible (EAN-8 ou EAN-13 avec clé exacte) et aucun libellé fourni' using errcode = 'P0001';
    end if;
    v_date := (p_donnees ->> coalesce(case when p_operation = 'changement_date' then 'ancienne_date' end, 'date_limite'))::date;
    v_geste := (p_donnees ->> 'heure_geste')::timestamptz;
    v_motif := nullif(btrim(coalesce(p_donnees ->> 'motif', '')), '');
    if v_date is null then
      raise exception 'date_limite_requise : date limite obligatoire' using errcode = 'P0001';
    end if;

    if p_operation in ('releve', 'ajout') then
      v_qte := (p_donnees ->> 'quantite')::integer;
      v_prov := coalesce(dates_courtes_est_provisoire(v_ean), false);
      insert into dates_courtes_releves (site, ean, libelle_vu, nom_libre, photo_ref, date_limite, quantite, provisoire, tournee_id, heure_geste, cle_idempotence)
        values (v_site, v_ean, v_lib, v_nom, v_photo, v_date, v_qte, v_prov, v_tournee, v_geste, v_cle) returning id into v_id;
      v_ids := jsonb_build_array(jsonb_build_object('table', 'releves', 'id', v_id));
    elsif p_operation = 'correction' then
      v_delta := (p_donnees ->> 'delta')::integer;
      v_releve := (p_donnees ->> 'releve_id')::uuid;
      insert into dates_courtes_corrections (site, ean, libelle_normalise, date_limite, delta, releve_id, motif, tournee_id, heure_geste, cle_idempotence)
        values (v_site, v_ean, v_lib, v_date, v_delta, v_releve, v_motif, v_tournee, v_geste, v_cle) returning id into v_id;
      v_ids := jsonb_build_array(jsonb_build_object('table', 'corrections', 'id', v_id));
    elsif p_operation = 'retrait' then
      v_qte := (p_donnees ->> 'quantite')::integer;
      insert into dates_courtes_retraits (site, ean, libelle_normalise, date_limite, quantite, tournee_id, heure_geste, cle_idempotence)
        values (v_site, v_ean, v_lib, v_date, v_qte, v_tournee, v_geste, v_cle) returning id into v_id;
      v_ids := jsonb_build_array(jsonb_build_object('table', 'retraits', 'id', v_id));
    elsif p_operation = 'trouve_retire' then
      -- Trouvé et retiré dans le même geste : un retrait seul, marqué « trouvé ». Ce n'est pas un relevé : il ne désigne aucune tournée de référence,
      -- ne rajeunit aucune ligne et ne crée aucune quantité courante. Sur une ligne relevée il la diminue, sans refus de plancher.
      v_qte := (p_donnees ->> 'quantite')::integer;
      insert into dates_courtes_retraits (site, ean, libelle_normalise, date_limite, quantite, trouve, tournee_id, heure_geste, cle_idempotence)
        values (v_site, v_ean, v_lib, v_date, v_qte, true, v_tournee, v_geste, v_cle) returning id into v_id;
      v_ids := jsonb_build_array(jsonb_build_object('table', 'retraits', 'id', v_id));
    else
      -- Changement de date : moins N sur l'ancien groupe, plus N sur le nouveau, liés entre eux.
      v_qte := (p_donnees ->> 'quantite')::integer;
      v_date2 := (p_donnees ->> 'nouvelle_date')::date;
      if v_qte is null or v_qte <= 0 or v_date2 is null then
        raise exception 'donnees_invalides : quantite positive et nouvelle_date obligatoires' using errcode = 'P0001';
      end if;
      insert into dates_courtes_corrections (site, ean, libelle_normalise, date_limite, delta, motif, tournee_id, heure_geste, cle_idempotence, lien_id)
        values (v_site, v_ean, v_lib, v_date, - v_qte, v_motif, v_tournee, v_geste, v_cle || ':a', v_lien) returning id into v_id;
      insert into dates_courtes_corrections (site, ean, libelle_normalise, date_limite, delta, motif, tournee_id, heure_geste, cle_idempotence, lien_id)
        values (v_site, v_ean, v_lib, v_date2, v_qte, v_motif, v_tournee, v_geste, v_cle || ':b', v_lien) returning id into v_id2;
      v_ids := jsonb_build_array(jsonb_build_object('table', 'corrections', 'id', v_id), jsonb_build_object('table', 'corrections', 'id', v_id2));
    end if;
    return jsonb_build_object('statut', 'cree', 'lignes', v_ids, 'tournee_id', v_tournee);
  exception
    when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow or invalid_datetime_format or null_value_not_allowed or not_null_violation or check_violation then
      raise exception 'valeur_invalide : %', sqlerrm using errcode = 'P0001';
  end;
end $$;

-- 10. Gestes de tournée : créer la sienne, la terminer, la faire certifier, demander et répondre à une correction.
create or replace function dates_courtes_creer_tournee(p_nom text, p_cle_idempotence text) returns jsonb
language plpgsql volatile security invoker set search_path = public, pg_temp as $$
declare v_site text; v_id uuid; v_nom text := nullif(btrim(coalesce(p_nom, '')), ''); v_cle text;
begin
  if auth.uid() is null then raise exception 'non_authentifie : connexion requise' using errcode = 'P0001'; end if;
  if not (dates_courtes_operer() or dates_courtes_caissier_autorise()) then
    raise exception 'droit_refuse : ce profil ne peut pas créer de tournée de dates courtes' using errcode = 'P0001';
  end if;
  if p_cle_idempotence is null or length(btrim(p_cle_idempotence)) not between 1 and 100 then
    raise exception 'cle_idempotence_requise : clé d''idempotence de 1 à 100 caractères' using errcode = 'P0001';
  end if;
  if v_nom is not null and char_length(v_nom) > 100 then
    raise exception 'valeur_invalide : nom de 100 caractères au plus' using errcode = 'P0001';
  end if;
  v_site := current_employee_site_id();
  v_cle := btrim(p_cle_idempotence);
  perform pg_advisory_xact_lock(hashtextextended(v_site || '|tournee|' || v_cle, 0));
  select t.id into v_id from dates_courtes_tournees t where t.site = v_site and t.cle_idempotence = v_cle;
  if found then return jsonb_build_object('statut', 'deja_enregistre', 'tournee_id', v_id); end if;
  begin
    insert into dates_courtes_tournees (site, nom, cle_idempotence) values (v_site, v_nom, v_cle) returning id into v_id;
  exception when unique_violation then
    raise exception 'cle_deja_utilisee : cette clé d''idempotence appartient à une autre tournée' using errcode = 'P0001';
  end;
  return jsonb_build_object('statut', 'cree', 'tournee_id', v_id);
end $$;

-- Terminer : enregistre auteur, heure, empreinte et dernière opération. Terminer deux fois sans changement renvoie la même version.
-- Le blocage tant que le téléphone a des saisies en attente est un contrôle côté appareil (lot 2).
create or replace function dates_courtes_terminer_tournee(p_tournee uuid) returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_site text; t record; v_ver jsonb;
begin
  if auth.uid() is null then raise exception 'non_authentifie : connexion requise' using errcode = 'P0001'; end if;
  if not (dates_courtes_operer() or dates_courtes_caissier_autorise()) then
    raise exception 'droit_refuse : ce profil ne peut pas terminer de tournée de dates courtes' using errcode = 'P0001';
  end if;
  v_site := current_employee_site_id();
  select * into t from dates_courtes_tournees x where x.id = p_tournee and x.site = v_site for update;
  if not found then raise exception 'introuvable : tournée inconnue pour cette station' using errcode = 'P0001'; end if;
  if t.saisi_par <> auth.uid() then
    raise exception 'tournee_interdite : on ne termine que sa propre tournée' using errcode = 'P0001';
  end if;
  v_ver := dates_courtes_version_tournee(p_tournee);
  if t.etat = 'EN_COURS' then
    update dates_courtes_tournees set etat = 'TERMINEE_A_CERTIFIER', terminee_par = auth.uid(), terminee_le = now(),
      version_empreinte = v_ver ->> 'empreinte', version_derniere_operation = v_ver ->> 'derniere_operation' where id = p_tournee;
    return jsonb_build_object('statut', 'terminee', 'etat', 'TERMINEE_A_CERTIFIER', 'version', v_ver);
  elsif t.etat = 'TERMINEE_A_CERTIFIER' then
    if t.version_empreinte is distinct from v_ver ->> 'empreinte' or t.version_derniere_operation is distinct from v_ver ->> 'derniere_operation' then
      update dates_courtes_tournees set version_empreinte = v_ver ->> 'empreinte', version_derniere_operation = v_ver ->> 'derniere_operation' where id = p_tournee;
    end if;
    return jsonb_build_object('statut', 'deja_terminee', 'etat', t.etat, 'version', v_ver);
  end if;
  raise exception 'etat_incompatible : la tournée est déjà % ', t.etat using errcode = 'P0001';
end $$;

-- Certifier : manager, gérant ou créateur. Le manager peut certifier sa propre tournée (marque réalisateur et certificateur identiques).
-- La certification ne déclenche aucune démarque et ne bloque ni la clôture ni l'usage des quantités.
create or replace function dates_courtes_certifier_tournee(p_tournee uuid, p_observations text, p_cle_idempotence text) returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_site text; t record; v_ver jsonb; v_id uuid; v_obs text := nullif(btrim(coalesce(p_observations, '')), ''); v_cle text;
begin
  if auth.uid() is null then raise exception 'non_authentifie : connexion requise' using errcode = 'P0001'; end if;
  if not dates_courtes_gestion() then
    raise exception 'droit_refuse : la certification est réservée au manager, au gérant et au créateur' using errcode = 'P0001';
  end if;
  if p_cle_idempotence is null or length(btrim(p_cle_idempotence)) not between 1 and 100 then
    raise exception 'cle_idempotence_requise : clé d''idempotence de 1 à 100 caractères' using errcode = 'P0001';
  end if;
  if v_obs is not null and char_length(v_obs) > 1000 then
    raise exception 'valeur_invalide : observations de 1000 caractères au plus' using errcode = 'P0001';
  end if;
  v_site := current_employee_site_id();
  v_cle := btrim(p_cle_idempotence);
  perform pg_advisory_xact_lock(hashtextextended(v_site || '|certif|' || v_cle, 0));
  select c.id into v_id from dates_courtes_certifications c where c.site = v_site and c.cle_idempotence = v_cle;
  if found then return jsonb_build_object('statut', 'deja_enregistre', 'id', v_id); end if;
  select * into t from dates_courtes_tournees x where x.id = p_tournee and x.site = v_site for update;
  if not found then raise exception 'introuvable : tournée inconnue pour cette station' using errcode = 'P0001'; end if;
  if t.etat <> 'TERMINEE_A_CERTIFIER' then
    raise exception 'etat_incompatible : seule une tournée terminée à certifier se certifie (état actuel %)', t.etat using errcode = 'P0001';
  end if;
  v_ver := dates_courtes_version_tournee(p_tournee);
  insert into dates_courtes_certifications (site, tournee_id, version_certifiee, observations, realisateur_identique, cle_idempotence)
    values (v_site, p_tournee, (v_ver ->> 'empreinte') || '@' || (v_ver ->> 'derniere_operation'), v_obs, t.saisi_par = auth.uid(), v_cle) returning id into v_id;
  update dates_courtes_tournees set etat = 'CERTIFIEE' where id = p_tournee;
  return jsonb_build_object('statut', 'cree', 'id', v_id, 'realisateur_identique', t.saisi_par = auth.uid(), 'version', v_ver);
end $$;

create or replace function dates_courtes_demander_correction(p_tournee uuid, p_releves uuid[], p_motif text, p_cle_idempotence text) returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_site text; t record; v_id uuid; v_motif text := btrim(coalesce(p_motif, '')); v_cle text; v_n integer;
begin
  if auth.uid() is null then raise exception 'non_authentifie : connexion requise' using errcode = 'P0001'; end if;
  if not dates_courtes_gestion() then
    raise exception 'droit_refuse : la demande de correction est réservée au manager, au gérant et au créateur' using errcode = 'P0001';
  end if;
  if p_cle_idempotence is null or length(btrim(p_cle_idempotence)) not between 1 and 100 then
    raise exception 'cle_idempotence_requise : clé d''idempotence de 1 à 100 caractères' using errcode = 'P0001';
  end if;
  if length(v_motif) = 0 or char_length(v_motif) > 500 then
    raise exception 'motif_requis : motif de 1 à 500 caractères' using errcode = 'P0001';
  end if;
  if p_releves is null or cardinality(p_releves) = 0 then
    raise exception 'releves_requis : au moins un relevé visé' using errcode = 'P0001';
  end if;
  v_site := current_employee_site_id();
  v_cle := btrim(p_cle_idempotence);
  perform pg_advisory_xact_lock(hashtextextended(v_site || '|demande|' || v_cle, 0));
  select d.id into v_id from dates_courtes_demandes_correction d where d.site = v_site and d.cle_idempotence = v_cle;
  if found then return jsonb_build_object('statut', 'deja_enregistre', 'id', v_id); end if;
  select * into t from dates_courtes_tournees x where x.id = p_tournee and x.site = v_site for update;
  if not found then raise exception 'introuvable : tournée inconnue pour cette station' using errcode = 'P0001'; end if;
  if t.etat not in ('TERMINEE_A_CERTIFIER', 'CERTIFIEE') then
    raise exception 'etat_incompatible : une correction se demande sur une tournée terminée ou certifiée (état actuel %)', t.etat using errcode = 'P0001';
  end if;
  select count(distinct x) into v_n from unnest(p_releves) x;
  if (select count(*) from dates_courtes_releves r where r.id = any (p_releves) and r.tournee_id = p_tournee and r.site = v_site) <> v_n then
    raise exception 'releves_invalides : un relevé visé n''appartient pas à cette tournée' using errcode = 'P0001';
  end if;
  insert into dates_courtes_demandes_correction (site, tournee_id, motif, releves_vises, cle_idempotence)
    values (v_site, p_tournee, v_motif, p_releves, v_cle) returning id into v_id;
  update dates_courtes_tournees set etat = 'CORRECTION_DEMANDEE' where id = p_tournee;
  return jsonb_build_object('statut', 'cree', 'id', v_id);
end $$;

-- Réponse du réalisateur : la tournée repasse à certifier.
create or replace function dates_courtes_repondre_correction(p_demande uuid, p_reponse text) returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_site text; d record; t record; v_rep text := btrim(coalesce(p_reponse, '')); v_ver jsonb;
begin
  if auth.uid() is null then raise exception 'non_authentifie : connexion requise' using errcode = 'P0001'; end if;
  if not (dates_courtes_operer() or dates_courtes_caissier_autorise()) then
    raise exception 'droit_refuse : ce profil ne peut pas répondre à une demande de correction' using errcode = 'P0001';
  end if;
  if length(v_rep) = 0 or char_length(v_rep) > 500 then
    raise exception 'reponse_requise : réponse de 1 à 500 caractères' using errcode = 'P0001';
  end if;
  v_site := current_employee_site_id();
  select * into d from dates_courtes_demandes_correction x where x.id = p_demande and x.site = v_site;
  if not found then raise exception 'introuvable : demande inconnue pour cette station' using errcode = 'P0001'; end if;
  select * into t from dates_courtes_tournees x where x.id = d.tournee_id and x.site = v_site for update;
  if t.saisi_par <> auth.uid() then
    raise exception 'tournee_interdite : on ne répond que pour sa propre tournée' using errcode = 'P0001';
  end if;
  if d.reponse is not null then
    return jsonb_build_object('statut', 'deja_repondue', 'id', p_demande);
  end if;
  if t.etat <> 'CORRECTION_DEMANDEE' then
    raise exception 'etat_incompatible : la tournée n''attend pas de réponse (état actuel %)', t.etat using errcode = 'P0001';
  end if;
  v_ver := dates_courtes_version_tournee(d.tournee_id);
  update dates_courtes_demandes_correction set reponse = v_rep, repondue_par = auth.uid(), repondue_le = now() where id = p_demande;
  update dates_courtes_tournees set etat = 'TERMINEE_A_CERTIFIER', version_empreinte = v_ver ->> 'empreinte', version_derniere_operation = v_ver ->> 'derniere_operation' where id = d.tournee_id;
  return jsonb_build_object('statut', 'repondue', 'etat', 'TERMINEE_A_CERTIFIER', 'version', v_ver);
end $$;

-- 11. Démarque comptabilisée : manager, gérant, créateur. Transition seulement depuis un retrait physique ; cumul inférieur ou égal à la quantité retirée.
-- Aucune écriture comptable, aucun lien avec Decenium ni inventaire_mouvements, aucune valeur en euros.
create or replace function dates_courtes_comptabiliser_demarque(p_retrait uuid, p_quantite integer, p_motif text, p_cle_idempotence text, p_heure_geste timestamptz default null) returns jsonb
language plpgsql volatile security invoker set search_path = public, pg_temp as $$
declare v_site text; v_id uuid; v_cle text; v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
begin
  if auth.uid() is null then raise exception 'non_authentifie : connexion requise' using errcode = 'P0001'; end if;
  if not dates_courtes_gestion() then
    raise exception 'droit_refuse : la démarque comptabilisée est réservée au manager, au gérant et au créateur' using errcode = 'P0001';
  end if;
  if p_cle_idempotence is null or length(btrim(p_cle_idempotence)) not between 1 and 100 then
    raise exception 'cle_idempotence_requise : clé d''idempotence de 1 à 100 caractères' using errcode = 'P0001';
  end if;
  if p_quantite is null or p_quantite <= 0 then
    raise exception 'valeur_invalide : quantité positive obligatoire' using errcode = 'P0001';
  end if;
  v_site := current_employee_site_id();
  v_cle := btrim(p_cle_idempotence);
  perform pg_advisory_xact_lock(hashtextextended(v_site || '|demarque|' || v_cle, 0));
  select d.id into v_id from dates_courtes_demarques d where d.site = v_site and d.cle_idempotence = v_cle;
  if found then return jsonb_build_object('statut', 'deja_enregistre', 'id', v_id); end if;
  begin
    insert into dates_courtes_demarques (site, retrait_id, tournee_id, quantite, motif, heure_geste, cle_idempotence)
      values (v_site, p_retrait, gen_random_uuid(), p_quantite, v_motif, p_heure_geste, v_cle) returning id into v_id;
  exception when check_violation then
    raise exception 'valeur_invalide : %', sqlerrm using errcode = 'P0001';
  end;
  return jsonb_build_object('statut', 'cree', 'id', v_id);
end $$;

create or replace function dates_courtes_annuler_demarque(p_id uuid, p_motif text) returns jsonb
language plpgsql volatile security invoker set search_path = public, pg_temp as $$
declare v_motif text := btrim(coalesce(p_motif, ''));
begin
  if auth.uid() is null then raise exception 'non_authentifie : connexion requise' using errcode = 'P0001'; end if;
  if not dates_courtes_gestion() then
    raise exception 'droit_refuse : l''annulation est réservée au manager, au gérant et au créateur' using errcode = 'P0001';
  end if;
  if length(v_motif) = 0 or char_length(v_motif) > 500 then
    raise exception 'motif_requis : motif d''annulation de 1 à 500 caractères' using errcode = 'P0001';
  end if;
  update dates_courtes_demarques set annule_le = now(), annule_par = auth.uid(), motif_annulation = v_motif
    where id = p_id and site = current_employee_site_id() and annule_le is null;
  if not found then raise exception 'introuvable : démarque inconnue ou déjà annulée' using errcode = 'P0001'; end if;
  return jsonb_build_object('statut', 'annule', 'id', p_id);
end $$;

-- 12. Gestes de la gestion : régler l'accès caissier, poser ou annuler un rattachement « même produit que… ».
create or replace function dates_courtes_regler_acces_caissier(p_actif boolean) returns jsonb
language plpgsql volatile security invoker set search_path = public, pg_temp as $$
declare v_site text; v_id uuid;
begin
  if auth.uid() is null then raise exception 'non_authentifie : connexion requise' using errcode = 'P0001'; end if;
  if not dates_courtes_gestion() then
    raise exception 'droit_refuse : le réglage est réservé au manager, au gérant et au créateur' using errcode = 'P0001';
  end if;
  if p_actif is null then raise exception 'valeur_invalide : actif doit être vrai ou faux' using errcode = 'P0001'; end if;
  v_site := current_employee_site_id();
  insert into dates_courtes_acces_caissier (site, actif) values (v_site, p_actif) returning id into v_id;
  return jsonb_build_object('statut', 'cree', 'id', v_id, 'site', v_site, 'actif', p_actif);
end $$;

create or replace function dates_courtes_poser_correspondance(p_type text, p_ancienne text, p_nouvelle text) returns jsonb
language plpgsql volatile security invoker set search_path = public, pg_temp as $$
declare v_site text; v_a text; v_n text; v_id uuid;
begin
  if auth.uid() is null then raise exception 'non_authentifie : connexion requise' using errcode = 'P0001'; end if;
  if not dates_courtes_gestion() then
    raise exception 'droit_refuse : le rattachement est réservé au manager, au gérant et au créateur' using errcode = 'P0001';
  end if;
  if p_type is null or p_type not in ('libelle', 'ean') then raise exception 'type_inconnu : libelle ou ean' using errcode = 'P0001'; end if;
  v_site := current_employee_site_id();
  if p_type = 'ean' then
    v_a := dates_courtes_normaliser_ean(p_ancienne); v_n := dates_courtes_normaliser_ean(p_nouvelle);
  else
    v_a := nullif(dates_courtes_normaliser_libelle(p_ancienne), ''); v_n := nullif(dates_courtes_normaliser_libelle(p_nouvelle), '');
  end if;
  if v_a is null or v_n is null then
    raise exception 'cle_invalide : valeur illisible pour le type %', p_type using errcode = 'P0001';
  end if;
  begin
    insert into dates_courtes_correspondances (site, type_cle, cle_ancienne, cle_nouvelle) values (v_site, p_type, v_a, v_n) returning id into v_id;
  exception
    when unique_violation then raise exception 'deja_rattache : cette ancienne clé a déjà un rattachement actif' using errcode = 'P0001';
    when check_violation then raise exception 'cle_invalide : l''ancienne et la nouvelle clé doivent différer' using errcode = 'P0001';
  end;
  return jsonb_build_object('statut', 'cree', 'id', v_id);
end $$;

create or replace function dates_courtes_annuler_correspondance(p_id uuid, p_motif text) returns jsonb
language plpgsql volatile security invoker set search_path = public, pg_temp as $$
declare v_motif text := btrim(coalesce(p_motif, ''));
begin
  if auth.uid() is null then raise exception 'non_authentifie : connexion requise' using errcode = 'P0001'; end if;
  if not dates_courtes_gestion() then
    raise exception 'droit_refuse : l''annulation est réservée au manager, au gérant et au créateur' using errcode = 'P0001';
  end if;
  if length(v_motif) = 0 or char_length(v_motif) > 500 then
    raise exception 'motif_requis : motif d''annulation de 1 à 500 caractères' using errcode = 'P0001';
  end if;
  update dates_courtes_correspondances set annule_le = now(), annule_par = auth.uid(), motif_annulation = v_motif
    where id = p_id and site = current_employee_site_id() and annule_le is null;
  if not found then raise exception 'introuvable : rattachement inconnu ou déjà annulé' using errcode = 'P0001'; end if;
  return jsonb_build_object('statut', 'annule', 'id', p_id);
end $$;

-- 13. Droits d'exécution : jamais anon, jamais public.
do $$
declare f text;
begin
  foreach f in array array[
    'dates_courtes_normaliser_ean(text)', 'dates_courtes_normaliser_libelle(text)', 'dates_courtes_cle_groupe(text,text,text,date)',
    'dates_courtes_operer()', 'dates_courtes_gestion()', 'dates_courtes_caissier_autorise()',
    'dates_courtes_resolution(text,text,text)', 'dates_courtes_cle_canonique(text,text,text,date)', 'dates_courtes_cle_article(text,text,text)',
    'dates_courtes_total_brut(text,text,uuid,text,uuid)', 'dates_courtes_porte_tournee(text,uuid,timestamptz)',
    'dates_courtes_courant_station(text,timestamptz)', 'dates_courtes_exiger_lecture()', 'dates_courtes_courant_ligne(text,text,date)',
    'dates_courtes_signaler_modification(uuid)', 'dates_courtes_demarque_active(uuid)',
    'dates_courtes_version_tournee(uuid)', 'dates_courtes_quantites_courantes(timestamptz)', 'dates_courtes_quantite_courante(text,text,date)',
    'dates_courtes_est_provisoire(text)', 'dates_courtes_enregistrer(text,text,jsonb)',
    'dates_courtes_creer_tournee(text,text)', 'dates_courtes_terminer_tournee(uuid)', 'dates_courtes_certifier_tournee(uuid,text,text)',
    'dates_courtes_demander_correction(uuid,uuid[],text,text)', 'dates_courtes_repondre_correction(uuid,text)',
    'dates_courtes_comptabiliser_demarque(uuid,integer,text,text,timestamptz)', 'dates_courtes_annuler_demarque(uuid,text)',
    'dates_courtes_regler_acces_caissier(boolean)', 'dates_courtes_poser_correspondance(text,text,text)', 'dates_courtes_annuler_correspondance(uuid,text)',
    'dates_courtes_avant_insertion()', 'dates_courtes_avant_annulation()', 'dates_courtes_avant_correspondance()', 'dates_courtes_avant_demarque()'] loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
    if f not like 'dates_courtes_avant_%' and f <> 'dates_courtes_courant_station(text,timestamptz)' then
      execute format('grant execute on function %s to authenticated', f);
    end if;
  end loop;
end $$;

comment on table dates_courtes_tournees is 'Dates courtes : tournées individuelles. Chaque employé autorisé crée et mène la sienne, plusieurs peuvent être ouvertes dans une station. États EN_COURS, TERMINEE_A_CERTIFIER, CERTIFIEE, CORRECTION_DEMANDEE, changés par fonction serveur seulement.';
comment on table dates_courtes_releves is 'Dates courtes : relevés d''une date limite. Ajout seul, annulation tracée. La clé de groupe, l''heure de réception et les marques de rattachement sont posées par le serveur.';
comment on table dates_courtes_corrections is 'Dates courtes : corrections signées d''un groupe dans une tournée. Ajout seul, annulation tracée. Plancher à zéro vérifié sous verrou.';
comment on table dates_courtes_retraits is 'Dates courtes : retraits physiques confirmés. Ajout seul. Ce n''est ni une vente ni une démarque, ni un relevé. trouve = trouvé et retiré dans le même geste.';
comment on table dates_courtes_demarques is 'Dates courtes : démarque comptabilisée sur un retrait physique. Ajout seul, annulation tracée. Aucune valeur en euros, aucune écriture comptable, aucun lien avec Decenium.';
comment on table dates_courtes_correspondances is 'Dates courtes : rattachements « même produit que… » (libellé ou EAN). Ajout seul, annulation tracée. Historique intact.';
comment on table dates_courtes_acces_caissier is 'Dates courtes : réglage d''accès caissier par station, historique en ajout seul, la dernière ligne fait foi. Fermé par défaut.';
comment on table dates_courtes_certifications is 'Dates courtes : certifications de tournée, en ajout seul. Une nouvelle certification s''ajoute, l''ancienne reste tracée.';
comment on table dates_courtes_demandes_correction is 'Dates courtes : demandes de correction (relevés visés, motif) et réponse du réalisateur. Écrites par fonction serveur seulement.';
comment on function dates_courtes_quantites_courantes(timestamptz) is 'Quantité courante par ligne de date limite : la tournée du dernier relevé effectif l''emporte, jamais d''addition entre tournées ; un retrait diminue la ligne de la station sans désigner de tournée ni rajeunir. Âge depuis le dernier relevé effectif, fuseau Martinique. Station lue depuis le compte, opérateurs et caissier habilité ; détail des autres tournées pour la gestion seule.';
comment on function dates_courtes_enregistrer(text, text, jsonb) is 'Écrit un relevé, une correction, un retrait, un trouvé-et-retiré, un changement de date ou une annulation dans sa propre tournée. Rôle et station relus depuis le compte, idempotent.';
comment on function dates_courtes_total_brut(text, text, uuid, text, uuid) is 'Total brut d''un groupe dans une tournée (relevés et corrections). Réservé aux déclencheurs de plancher.';
comment on function dates_courtes_courant_station(text, timestamptz) is 'Noyau interne du calcul de quantité courante. Aucun droit client.';
comment on function dates_courtes_courant_ligne(text, text, date) is 'Quantité courante d''une ligne pour le plancher d''un retrait. Réservé aux déclencheurs.';
comment on function dates_courtes_comptabiliser_demarque(uuid, integer, text, text, timestamptz) is 'Démarque comptabilisée sur un retrait physique, cumul au plus égal à la quantité retirée. Gestion seule. Aucune écriture comptable.';
