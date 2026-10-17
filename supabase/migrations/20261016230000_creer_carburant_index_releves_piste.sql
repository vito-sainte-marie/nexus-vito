-- NEXUS — Parcours Pompiste : relevés d'index Tokheim (16/10/2026)
-- Lot Handoff FAST-TRACK-POMPISTE-RELEVES-PISTE-20261016, decision-3.md
-- (brief intégral de Frédéric, GO TEST). Premier incrément autorisé :
-- la persistance, avant toute implémentation d'écran qui en dépend
-- (condition posée par decision-1.md du même lot).
--
-- Appliquée sur `nexus-test` UNIQUEMENT. Aucun geste sur Production : voir
-- l'addendum « Proposée incluse dans une future release Production » de
-- docs/handoff/MANIFESTE-MIGRATIONS-PRODUCTION-COURANT.md.
--
-- Principe fondamental du brief, rappelé parce qu'il contraint tout le
-- schéma : NEXUS est un carnet numérique d'aide au relevé et à la recopie.
-- Il ne calcule aucune vente, ne modifie aucune donnée Decenium et ne
-- prétend pas vérifier ce qui a été réellement saisi dans Decenium. Rien
-- ici ne touche carburant_releves (jaugeage des cuves, domaine déjà
-- existant), nexus-carburant-moteur.js (théorique/écart), ni shifts (lu
-- seul, jamais modifié).
--
-- Ce que CETTE migration ne fait PAS (périmètre explicitement posé par la
-- demande/decision, à ne pas combler par hypothèse) :
--   - aucune conversion 7→6 chiffres calculée en base : le dépôt stocke la
--     valeur observée (7 chiffres, authoritative) et la présentation
--     Decenium (6 chiffres) que l'application doit fournir et justifier ;
--     la logique de conversion elle-même reste à écrire côté applicatif ;
--   - aucune comparaison "index inférieur au relevé précédent" ni "écart >
--     4000 L" : ce sont des contrôles métier inter-déclarations, à écrire
--     dans un module applicatif, pas dans cette persistance ;
--   - aucune donnée de seed (le dernier index GNR connu 1191213 n'est écrit
--     par aucune ligne ici : le semer sur `nexus-station-test` est un geste
--     distinct, sous la pré-autorisation 1 de CLAUDE.md, qui exige un accès
--     réel à la base — absent du canal qui a écrit ce fichier) ;
--   - aucune remise en service du GNR (arbitrage §5 de request-4.md :
--     explicitement hors périmètre de ce lot) ; la table de statut existe
--     pour l'historiser quand ce périmètre sera ouvert, sans RPC dédiée.

-- ============================================================
-- 1. La déclaration : une par (site, date, moment, auteur)
-- ============================================================
create table if not exists carburant_index_releves (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  date date not null,
  quart_id uuid references shifts(id) on delete set null,
  moment text not null check (moment in ('fin_q1', 'debut_q2', 'fin_q2')),
  statut text not null default 'brouillon' check (statut in ('brouillon', 'final')),
  auteur uuid not null references employees(id),
  cree_le timestamptz not null default now(),
  finalise_le timestamptz,
  constraint carburant_index_releves_site_date_moment_auteur_key
    unique (site, date, moment, auteur)
);

comment on table carburant_index_releves is
  'Une déclaration de relevé des huit index Tokheim, par pompiste et par moment (fin_q1, debut_q2, fin_q2). Deux déclarations du même moment par deux auteurs différents restent deux lignes distinctes, même identiques en valeur (brief §10 : chacune garde son auteur). Jamais supprimée (append-only, aucune policy DELETE).';
comment on column carburant_index_releves.quart_id is
  'Référence en lecture au quart réel (shifts). Ne sert jamais à déduire des heures ni à alimenter NEXUS Paye — association seulement (brief §3).';

alter table carburant_index_releves enable row level security;

create policy select_carburant_index_releves on carburant_index_releves
  for select using (
    site = (select current_employee_site_id())
    or (
      (select je_suis_createur())
      and exists (
        select 1 from sites s
        where s.site_id = carburant_index_releves.site and s.acces_createur_autorise = true
      )
    )
  );

create policy ecriture_pompiste_ou_manager on carburant_index_releves
  for insert
  with check (
    site = (select current_employee_site_id())
    and auteur = auth.uid()
    and (
      (select current_employee_role()) = any (array['manager', 'gerant'])
      or est_pompiste_du_jour(site)
    )
  );

-- Un pompiste ne corrige que SA déclaration tant qu'elle est un brouillon
-- (reprise après interruption, brief §9) ; au-delà, seule une régularisation
-- manager est recevable (brief §10 : "Réserver les éventuelles
-- régularisations aux droits appropriés"), quel que soit le statut.
create policy modification_pompiste_brouillon_ou_manager on carburant_index_releves
  for update
  using (
    site = (select current_employee_site_id())
    and (
      (select current_employee_role()) = any (array['manager', 'gerant'])
      or (est_pompiste_du_jour(site) and auteur = auth.uid() and statut = 'brouillon')
    )
  )
  with check (
    site = (select current_employee_site_id())
    and (
      (select current_employee_role()) = any (array['manager', 'gerant'])
      or (est_pompiste_du_jour(site) and auteur = auth.uid())
    )
  );
-- Volontairement aucune policy DELETE : une déclaration ne se supprime
-- jamais, même brouillon (même discipline que carburant_releve_versions).

create index if not exists idx_carburant_index_releves_site_date
  on carburant_index_releves (site, date desc);

-- ============================================================
-- 2. Les huit index d'une déclaration (4 pompes × 2 produits)
-- ============================================================
create table if not exists carburant_index_valeurs (
  id uuid primary key default gen_random_uuid(),
  releve_id uuid not null references carburant_index_releves(id) on delete cascade,
  site text not null,
  pompe smallint not null check (pompe between 1 and 4),
  produit text not null check (produit in ('GO', 'SP')),
  valeur_sept_chiffres text not null check (valeur_sept_chiffres ~ '^[0-9]{7}$'),
  valeur_decenium text not null check (valeur_decenium ~ '^[0-9]{6}$'),
  troncature_sans_perte boolean not null,
  recopiee boolean not null default false,
  recopiee_le timestamptz,
  recopiee_par uuid references employees(id),
  cree_le timestamptz not null default now(),
  constraint carburant_index_valeurs_releve_pompe_produit_key
    unique (releve_id, pompe, produit)
);

comment on table carburant_index_valeurs is
  'Les 8 index observés (7 chiffres, valeur authoritative) + leur présentation Decenium (6 chiffres, fournie par l''appelant, jamais recalculée ici) pour une déclaration. troncature_sans_perte est vrai seulement quand le chiffre abandonné était un zéro non significatif (brief §1 : "sécuriser la présentation à six chiffres, sans supprimer aveuglément un chiffre significatif") — faux sinon, et l''application doit alors signaler l''anomalie plutôt que recopier silencieusement. Aucune policy UPDATE : toute correction passe par carburant_index_corriger_valeur(), seule voie qui trace carburant_index_corrections et annule recopiee (brief §8). Aucune policy DELETE.';

-- Le site n'est jamais fourni par l'appelant : il est hérité de la
-- déclaration parente, pour qu'aucune valeur ne puisse être rattachée à un
-- site différent du sien par un site fourni à la main.
create or replace function public.carburant_index_valeurs_heriter_site()
 returns trigger
 language plpgsql
as $$
begin
  select site into strict new.site from carburant_index_releves where id = new.releve_id;
  return new;
end;
$$;

create trigger carburant_index_valeurs_heriter_site
  before insert on carburant_index_valeurs
  for each row execute function public.carburant_index_valeurs_heriter_site();

alter table carburant_index_valeurs enable row level security;

create policy select_carburant_index_valeurs on carburant_index_valeurs
  for select using (
    site = (select current_employee_site_id())
    or (
      (select je_suis_createur())
      and exists (
        select 1 from sites s
        where s.site_id = carburant_index_valeurs.site and s.acces_createur_autorise = true
      )
    )
  );

create policy ecriture_pompiste_ou_manager on carburant_index_valeurs
  for insert
  with check (
    site = (select current_employee_site_id())
    and exists (
      select 1 from carburant_index_releves r
      where r.id = releve_id
        and r.site = (select current_employee_site_id())
        and (
          (select current_employee_role()) = any (array['manager', 'gerant'])
          or (est_pompiste_du_jour(r.site) and r.auteur = auth.uid())
        )
    )
  );
-- Volontairement aucune policy UPDATE ni DELETE : voir le commentaire de
-- table. L'absence de policy garantit l'append-only au niveau base (même
-- principe que carburant_releve_versions).

create index if not exists idx_carburant_index_valeurs_releve
  on carburant_index_valeurs (releve_id);
create index if not exists idx_carburant_index_valeurs_site
  on carburant_index_valeurs (site);

-- ============================================================
-- 3. Trace append-only de chaque correction d'un index déjà saisi
-- ============================================================
create table if not exists carburant_index_corrections (
  id uuid primary key default gen_random_uuid(),
  valeur_id uuid not null references carburant_index_valeurs(id) on delete cascade,
  site text not null,
  valeur_avant text not null,
  valeur_apres text not null,
  motif text not null check (motif <> ''),
  confirmation_exceptionnelle boolean not null default false,
  auteur uuid not null references employees(id),
  cree_le timestamptz not null default now()
);

comment on table carburant_index_corrections is
  'Preuve append-only de chaque correction d''un index (brief §6 : "ne pas écraser l''historique") — jamais réécrite ni supprimée. Écrite exclusivement par carburant_index_corriger_valeur(), jamais par un INSERT direct applicatif.';

create or replace function public.carburant_index_corrections_heriter_site()
 returns trigger
 language plpgsql
as $$
begin
  select site into strict new.site from carburant_index_valeurs where id = new.valeur_id;
  return new;
end;
$$;

create trigger carburant_index_corrections_heriter_site
  before insert on carburant_index_corrections
  for each row execute function public.carburant_index_corrections_heriter_site();

alter table carburant_index_corrections enable row level security;

create policy select_carburant_index_corrections on carburant_index_corrections
  for select using (
    site = (select current_employee_site_id())
    or (
      (select je_suis_createur())
      and exists (
        select 1 from sites s
        where s.site_id = carburant_index_corrections.site and s.acces_createur_autorise = true
      )
    )
  );
-- Aucune policy INSERT/UPDATE/DELETE pour authenticated : la seule écriture
-- passe par carburant_index_corriger_valeur(), SECURITY DEFINER ci-dessous,
-- qui porte son propre contrôle d'autorisation et ne dépend donc pas d'une
-- policy sur cette table.

-- ============================================================
-- 4. RPC : corriger un index déjà saisi (trace + annule la recopie)
-- ============================================================
create or replace function public.carburant_index_corriger_valeur(
  p_valeur_id uuid,
  p_nouvelle_valeur_sept_chiffres text,
  p_nouvelle_valeur_decenium text,
  p_troncature_sans_perte boolean,
  p_motif text,
  p_confirmation_exceptionnelle boolean default false
)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_site text;
  v_releve_auteur uuid;
  v_valeur_avant text;
begin
  if p_motif is null or btrim(p_motif) = '' then
    raise exception 'MOTIF_REQUIS' using errcode = 'P0001';
  end if;
  if p_nouvelle_valeur_sept_chiffres !~ '^[0-9]{7}$' then
    raise exception 'VALEUR_SEPT_CHIFFRES_INVALIDE' using errcode = 'P0001';
  end if;
  if p_nouvelle_valeur_decenium !~ '^[0-9]{6}$' then
    raise exception 'VALEUR_DECENIUM_INVALIDE' using errcode = 'P0001';
  end if;

  select v.site, r.auteur, v.valeur_sept_chiffres
    into v_site, v_releve_auteur, v_valeur_avant
    from carburant_index_valeurs v
    join carburant_index_releves r on r.id = v.releve_id
    where v.id = p_valeur_id;

  if v_site is null then
    raise exception 'VALEUR_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_site <> current_employee_site_id() then
    raise exception 'AUTRE_SITE' using errcode = 'P0001';
  end if;
  if not (
    current_employee_role() = any (array['manager', 'gerant'])
    or (est_pompiste_du_jour(v_site) and v_releve_auteur = auth.uid())
  ) then
    raise exception 'ROLE_NON_AUTORISE' using errcode = 'P0001';
  end if;

  update carburant_index_valeurs
    set valeur_sept_chiffres = p_nouvelle_valeur_sept_chiffres,
        valeur_decenium = p_nouvelle_valeur_decenium,
        troncature_sans_perte = p_troncature_sans_perte,
        recopiee = false,
        recopiee_le = null,
        recopiee_par = null
    where id = p_valeur_id;

  insert into carburant_index_corrections (
    valeur_id, valeur_avant, valeur_apres, motif, confirmation_exceptionnelle, auteur
  ) values (
    p_valeur_id, v_valeur_avant, p_nouvelle_valeur_sept_chiffres, p_motif, p_confirmation_exceptionnelle, auth.uid()
  );
end;
$$;

comment on function public.carburant_index_corriger_valeur(uuid, text, text, boolean, text, boolean) is
  'Seule voie de correction d''un index déjà saisi : SECURITY DEFINER, contrôle le site et le rôle dans son corps (comme est_pompiste_du_jour), met à jour la valeur courante, annule systématiquement recopiee (brief §8) et pose la trace dans carburant_index_corrections. Aucune policy UPDATE sur la table ne contourne cette fonction.';

-- nexus-acl-intention: public.carburant_index_corriger_valeur(uuid, text, text, boolean, text, boolean) garde authenticated (RPC appelée par l'écran de relevé/correction du pompiste ou du manager, contrôle de site et de rôle dans le corps)
revoke all on function public.carburant_index_corriger_valeur(uuid, text, text, boolean, text, boolean) from public, anon;
grant execute on function public.carburant_index_corriger_valeur(uuid, text, text, boolean, text, boolean) to authenticated;

-- ============================================================
-- 5. RPC : marquer/démarquer un index comme recopié dans Decenium
-- ============================================================
create or replace function public.carburant_index_marquer_recopiee(
  p_valeur_id uuid,
  p_recopiee boolean
)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_site text;
  v_releve_auteur uuid;
begin
  select v.site, r.auteur into v_site, v_releve_auteur
    from carburant_index_valeurs v
    join carburant_index_releves r on r.id = v.releve_id
    where v.id = p_valeur_id;

  if v_site is null then
    raise exception 'VALEUR_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_site <> current_employee_site_id() then
    raise exception 'AUTRE_SITE' using errcode = 'P0001';
  end if;
  if not (
    current_employee_role() = any (array['manager', 'gerant'])
    or (est_pompiste_du_jour(v_site) and v_releve_auteur = auth.uid())
  ) then
    raise exception 'ROLE_NON_AUTORISE' using errcode = 'P0001';
  end if;

  update carburant_index_valeurs
    set recopiee = p_recopiee,
        recopiee_le = case when p_recopiee then now() else null end,
        recopiee_par = case when p_recopiee then auth.uid() else null end
    where id = p_valeur_id;
end;
$$;

comment on function public.carburant_index_marquer_recopiee(uuid, boolean) is
  'Coche/décoche "recopiée" (aide de progression seulement, brief §8 : "ne prouve pas que Decenium a reçu la bonne valeur"). SECURITY DEFINER, même contrôle que carburant_index_corriger_valeur().';

-- nexus-acl-intention: public.carburant_index_marquer_recopiee(uuid, boolean) garde authenticated (RPC appelée par l'écran de recopie Decenium du pompiste ou du manager, contrôle de site et de rôle dans le corps)
revoke all on function public.carburant_index_marquer_recopiee(uuid, boolean) from public, anon;
grant execute on function public.carburant_index_marquer_recopiee(uuid, boolean) to authenticated;

-- ============================================================
-- 6. GNR hors service : état de référence, append-only
-- ============================================================
create table if not exists carburant_gnr_statuts (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  statut text not null check (statut in ('hors_service', 'en_service')),
  index_reference text not null check (index_reference ~ '^[0-9]{1,7}$'),
  motif text,
  auteur uuid references employees(id),
  cree_le timestamptz not null default now()
);

comment on table carburant_gnr_statuts is
  'Historique append-only du statut GNR par site (brief §7). Le statut courant d''un site est sa ligne la plus récente (cree_le desc) ; jamais de UPDATE/DELETE. Aucune ligne ici ne doit être interprétée comme un relevé physique réalisé par un employé (brief §7 : l''index de référence hors service n''est pas un nouveau relevé). Aucune donnée n''est semée par cette migration : voir l''en-tête du fichier.';

alter table carburant_gnr_statuts enable row level security;

create policy select_carburant_gnr_statuts on carburant_gnr_statuts
  for select using (
    site = (select current_employee_site_id())
    or (
      (select je_suis_createur())
      and exists (
        select 1 from sites s
        where s.site_id = carburant_gnr_statuts.site and s.acces_createur_autorise = true
      )
    )
  );

-- Changement de statut réservé au manager/gérant (remise en service hors
-- périmètre de ce lot, cf. en-tête ; cette policy n'a donc, pour l'instant,
-- aucun écran qui l'exerce).
create policy ecriture_manager_meme_site on carburant_gnr_statuts
  for insert
  with check (
    site = (select current_employee_site_id())
    and (select current_employee_role()) = any (array['manager', 'gerant'])
  );
-- Volontairement aucune policy UPDATE/DELETE : append-only.

create index if not exists idx_carburant_gnr_statuts_site_date
  on carburant_gnr_statuts (site, cree_le desc);
