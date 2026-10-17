<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/JOURNAL-PISTE-20261017/request-2.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: JOURNAL-PISTE-20261017
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=ff19b8a0 production=8e8b7ba2
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 157-fichiers
  - id: arbitrages-frederic
    classe: HUMAN
    valeur: GO ouverture du lot du 17/10/2026 ; echelle confirmee (+1 = 1 L) le 17/10/2026 ; pas de GO migration, permissions ni Production
  - id: migration-sql
    classe: VERIFIED
    valeur: supabase/migrations/20261017140000_journal_piste_config_alertes_qualifications.sql integree au corps (non executee)
  - id: preuve-rls
    classe: DECLARED
    valeur: supabase/preuves/preuve-journal-piste-rls-test.sql integree au corps ; ecrite, non rejouee
---
# JOURNAL PISTE — SQL exact et preuves de sécurité rejouables (TEST exclusivement, rien exécuté)

Suite de decision-1 (e9498783, APPROVED_WITH_CONDITIONS). **Aucun SQL n'a été exécuté** : ni migration, ni grant, ni planification. Cette demande soumet le SQL exact et la preuve rejouable, comme l'exigeait l'ACTION_NEXT. Périmètre : Supabase Test (`udljdqxerrbbbajxubfn`). Pas de GO migration, permissions ou Production ; aucune fusion, aucun déploiement.

## Preuve des conditions de decision-1

1. **Aucun SQL exécuté avant nouvel arbitrage** — tenue : la seule interaction avec Test depuis decision-1 est en lecture (`pg_available_extensions`, `information_schema.columns`, `select distinct` sur `shifts`). Elle a montré que `pg_cron` 1.6.4 et `pg_net` sont installés sur Test, et que `shifts.quart` vaut `matin`/`soir` (et non `quart1`/`quart2`) ; la migration a été corrigée en conséquence (correspondance `quart1→matin`, `quart2→soir`).
2. **Contenu exigé** — présent ci-dessous : migration complète (§A), RLS, révocations et grants (dans la migration), les trois fonctions appelables par un client avec `search_path` fixé et contrôle fail-closed, le mécanisme de planification et ses permissions (§C), les preuves rejouables avant/après (§B).
3. **Site dérivé de l'identité de l'appelant** — voir §D : aucune fonction appelable par un client ne prend un `site` faisant autorité.
4. **Test exclusivement, sans fusion ni Production** — tenue.
5. **Échelle physique** — confirmée par Frédéric le 17/10/2026 : « +1 correspond à un litre » (`litresParUnite = 1`, consigné dans la configuration initiale v1 avec auteur et date, mode « déclaration en chat »). Précision du même jour : le litrage Verify (pupitre/master) est la référence, la différence d'index n'en est qu'un recoupement approximatif ; ce lot ne calcule aucun total de litres ni de ventes et ne compare pas à Verify.

## §D. La contradiction apparente du paramètre `site`

decision-1 relevait qu'une fonction `evaluer_controles_piste(site, date)` prenait un `site` alors que le site doit venir de l'appelant. Résolution dans le SQL :
- `enregistrer_config_piste(p_config, p_motif)` : **aucun paramètre site** ; le site est `current_employee_site_id()`, refus si `auth.uid()` est nul ou si `piste_manager_du_site(site)` est faux.
- `qualifier_alerte_piste(p_alerte_id, p_choix, p_commentaire, p_remplace_id)` : **aucun paramètre site** ; le site vient de l'alerte, puis est **vérifié** contre l'appelant (`piste_manager_du_site`) ; un autre site est refusé.
- `evaluer_controles_piste()` : **sans paramètre** ; site de l'appelant, aujourd'hui et hier.
- La seule fonction à paramètre `site`, `piste_evaluer_site(text, date)`, et `evaluer_tous_sites_piste()` sont **internes** : `revoke all … from public, anon, authenticated`, exécutées par pg_cron en propriétaire. Elles ne font autorité pour aucun client.

## §C. Planification et permissions

`pg_cron` (déjà installé sur Test) : `cron.schedule('nexus-journal-piste', '*/5 * * * *', 'select public.evaluer_tous_sites_piste();')`, précédé d'un `unschedule` du même nom pour l'idempotence. Le job s'exécute avec le rôle qui l'a créé (propriétaire de la migration) ; `evaluer_tous_sites_piste()` n'est exécutable par aucun rôle client. Idempotence : clé unique `(site, type, evenement)` ; résolution automatique à l'arrivée d'un relevé final ; un brouillon ne résout rien. Retour arrière : `cron.unschedule('nexus-journal-piste')`.

## Conditions proposées pour le GO suivant

Test seulement ; `execute_sql` (jamais `apply_migration`), une transaction, `lock_timeout='2s'`, tampon `schema_migrations` ; preuve §B rejouée **avant** (les tables n'existent pas : la preuve doit échouer proprement) et **après** (tous les cas OK) ; retour arrière : `cron.unschedule`, `drop function` des fonctions, `drop table` des trois tables, `alter table carburant_index_releves drop column config_snapshot` (tables neuves, aucune donnée à préserver) ; toute évolution ultérieure des permissions repasse par le Handoff ; aucune fusion ni Production sans arbitrage et GO distincts.

## Ce qui n'est pas prouvé

- La migration et la preuve §B n'ont **jamais été jouées** (rien n'est exécuté sans décision). Les noms de colonnes de `employees`/`sites` utilisés pour créer les acteurs fictifs de la preuve sont à mesurer sur Test avant exécution ; un écart de colonne fera échouer la preuve, jamais passer.
- La condition `pg_cron` est vérifiée en lecture (installé) mais pas l'exécution du job.
- Aucun test navigateur ni iOS.

## Décision demandée

Examiner le SQL exact (§A) et la preuve (§B) et dire s'ils suffisent pour autoriser l'exécution **sur Test seulement**, ou lister les corrections.

## §A. Migration exacte — `supabase/migrations/20261017140000_journal_piste_config_alertes_qualifications.sql`

```sql
-- =====================================================================
-- 20261017140000 — Journal Piste : configuration, alertes, qualifications
-- (TEST SEULEMENT — NON APPLIQUÉE, en attente de l'arbitrage du SQL exact)
--
-- Lot JOURNAL-PISTE-20261017, request-2. Conditions de decision-1 respectées :
--   • le site n'est JAMAIS un paramètre qui fait autorité : les deux fonctions
--     appelables par un utilisateur (`enregistrer_config_piste`,
--     `qualifier_alerte_piste`) et `evaluer_controles_piste()` le déduisent de
--     l'identité de l'appelant (current_employee_site_id()). Les seules
--     fonctions qui reçoivent un site en paramètre (`piste_evaluer_site`,
--     `evaluer_tous_sites_piste`) ne sont exécutables par NI anon NI
--     authenticated : seul le propriétaire (tâche planifiée) les appelle.
--   • aucun UPDATE/DELETE/TRUNCATE pour un utilisateur, ni sur les trois tables
--     ni via la RLS : triggers d'immutabilité en plus des grants.
--   • fail-closed : donnée absente, photographie de configuration différente,
--     relevés finaux contradictoires, fuseau invalide => « non contrôlé » ou
--     « comparaison impossible », jamais « conforme ».
--   • aucun index n'est modifié, aucune vente n'est calculée.
-- Échelle : litresParUnite = 1 (« +1 correspond à un litre », Frédéric,
-- 17/10/2026, déclaration en chat) — consignée dans la configuration initiale.
-- =====================================================================
begin;
set local lock_timeout = '2s';

-- ---------------------------------------------------------------------
-- 1. Habilitation unique (réutilise les helpers existants, fail-closed)
-- ---------------------------------------------------------------------
create or replace function public.piste_manager_du_site(p_site text)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $$
  select p_site is not null
     and p_site = public.current_employee_site_id()
     and public.current_employee_role() = any (array['manager', 'gerant']);
$$;
comment on function public.piste_manager_du_site(text) is
  'Vrai seulement si l''appelant est manager ou gérant ET que p_site est SON site. Sert à la RLS de lecture ; ne confère aucune autorité sur un autre site.';
revoke all on function public.piste_manager_du_site(text) from public, anon;
grant execute on function public.piste_manager_du_site(text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. carburant_index_config : versions append-only
-- ---------------------------------------------------------------------
create table public.carburant_index_config (
  id uuid primary key default gen_random_uuid(),
  site text not null references public.sites(site_id),
  version integer not null check (version >= 1),
  config jsonb not null,
  avant jsonb,
  motif text,
  modifie_par uuid references public.employees(id),
  modifie_le timestamptz not null default now(),
  constraint carburant_index_config_site_version_key unique (site, version)
);
comment on table public.carburant_index_config is
  'Configuration des compteurs piste, une ligne par version (append-only). La version courante est la plus récente ; pas de date d''effet future. Écrite uniquement par enregistrer_config_piste().';

-- ---------------------------------------------------------------------
-- 3. carburant_index_alertes : une ligne par événement et par cause
-- ---------------------------------------------------------------------
create table public.carburant_index_alertes (
  id uuid primary key default gen_random_uuid(),
  site text not null references public.sites(site_id),
  type text not null check (type in ('passation', 'nuit', 'releve_manquant')),
  evenement text not null,
  niveau text not null check (niveau in ('orange', 'rouge')),
  statut text not null default 'ouverte' check (statut in ('ouverte', 'resolue_auto', 'qualifiee')),
  constat jsonb not null,
  raison_cloture text,
  ouverte_le timestamptz not null default now(),
  cloturee_le timestamptz,
  constraint carburant_index_alertes_site_type_evenement_key unique (site, type, evenement)
);
comment on table public.carburant_index_alertes is
  'Une alerte par (site, type, événement) : l''évaluation est idempotente. Le constat liste les compteurs concernés ; jamais une alerte par compteur. Écrite uniquement par piste_evaluer_site() et qualifier_alerte_piste().';

-- ---------------------------------------------------------------------
-- 4. carburant_index_qualifications : append-only, correction = nouvelle ligne
-- ---------------------------------------------------------------------
create table public.carburant_index_qualifications (
  id uuid primary key default gen_random_uuid(),
  alerte_id uuid not null references public.carburant_index_alertes(id),
  site text not null,
  choix text not null check (choix in ('erreur_lecture', 'mouvement_confirme', 'cause_inconnue')),
  commentaire text,
  qualifie_par uuid not null references public.employees(id),
  qualifie_le timestamptz not null default now(),
  remplace_id uuid references public.carburant_index_qualifications(id)
);
create unique index carburant_index_qualifications_un_remplacement
  on public.carburant_index_qualifications (remplace_id) where remplace_id is not null;
create index idx_carburant_index_qualifications_alerte
  on public.carburant_index_qualifications (alerte_id, qualifie_le desc);
comment on table public.carburant_index_qualifications is
  'Décision humaine (manager/gérant) sur une alerte. « mouvement_confirme » = déclaration du manager, pas un fait vérifié. Append-only : corriger une qualification = en insérer une qui remplace la précédente. Ne modifie jamais un index.';

-- Le site d'une qualification est hérité de l'alerte, jamais fourni.
create or replace function public.piste_qualification_heriter_site()
 returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  select a.site into new.site from public.carburant_index_alertes a where a.id = new.alerte_id;
  if new.site is null then raise exception 'ALERTE_INTROUVABLE' using errcode = 'P0001'; end if;
  return new;
end;
$$;
revoke all on function public.piste_qualification_heriter_site() from public, anon, authenticated;
create trigger carburant_index_qualifications_site before insert on public.carburant_index_qualifications
  for each row execute function public.piste_qualification_heriter_site();

-- Immutabilité : config et qualifications ne changent jamais ; une alerte ne
-- change ni son identité ni son constat d'origine (statut/clôture/niveau/constat
-- à jour seulement, par les fonctions).
create or replace function public.piste_interdire_modification()
 returns trigger language plpgsql set search_path to 'public'
as $$
begin
  raise exception 'APPEND_ONLY % %', tg_table_name, tg_op using errcode = 'P0001';
end;
$$;
revoke all on function public.piste_interdire_modification() from public, anon, authenticated;
create trigger carburant_index_config_immuable before update or delete on public.carburant_index_config
  for each row execute function public.piste_interdire_modification();
create trigger carburant_index_qualifications_immuable before update or delete on public.carburant_index_qualifications
  for each row execute function public.piste_interdire_modification();

create or replace function public.piste_alerte_garde_identite()
 returns trigger language plpgsql set search_path to 'public'
as $$
begin
  if tg_op = 'DELETE' then raise exception 'APPEND_ONLY carburant_index_alertes DELETE' using errcode = 'P0001'; end if;
  if new.id <> old.id or new.site <> old.site or new.type <> old.type
     or new.evenement <> old.evenement or new.ouverte_le <> old.ouverte_le then
    raise exception 'IDENTITE_ALERTE_IMMUABLE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.piste_alerte_garde_identite() from public, anon, authenticated;
create trigger carburant_index_alertes_identite before update or delete on public.carburant_index_alertes
  for each row execute function public.piste_alerte_garde_identite();

-- ---------------------------------------------------------------------
-- 5. RLS : lecture manager/gérant du site, aucune écriture directe
-- ---------------------------------------------------------------------
alter table public.carburant_index_config enable row level security;
alter table public.carburant_index_alertes enable row level security;
alter table public.carburant_index_qualifications enable row level security;

create policy select_carburant_index_config on public.carburant_index_config
  for select to authenticated using ((select public.piste_manager_du_site(site)));
create policy select_carburant_index_alertes on public.carburant_index_alertes
  for select to authenticated using ((select public.piste_manager_du_site(site)));
create policy select_carburant_index_qualifications on public.carburant_index_qualifications
  for select to authenticated using ((select public.piste_manager_du_site(site)));
-- Volontairement aucune policy INSERT/UPDATE/DELETE : seules les fonctions
-- SECURITY DEFINER ci-dessous écrivent.

-- Fermeture explicite (default privileges Supabase : anon reçoit tout sur une table neuve).
revoke all on public.carburant_index_config, public.carburant_index_alertes,
  public.carburant_index_qualifications from public, anon, authenticated;
grant select on public.carburant_index_config, public.carburant_index_alertes,
  public.carburant_index_qualifications to authenticated;

-- ---------------------------------------------------------------------
-- 6. Photographie de configuration, posée par le serveur avec le relevé
-- ---------------------------------------------------------------------
alter table public.carburant_index_releves add column config_snapshot jsonb;
comment on column public.carburant_index_releves.config_snapshot is
  'Photographie immuable de la configuration piste courante {version, config} au moment de l''insertion du relevé. Posée par le serveur (un client ne peut pas la fournir) ; NULL = relevé antérieur à la configuration versionnée (jamais comparé).';

create or replace function public.piste_releve_photographier()
 returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  new.config_snapshot := (
    select jsonb_build_object('version', c.version, 'config', c.config)
      from public.carburant_index_config c
     where c.site = new.site order by c.version desc limit 1);
  return new;
end;
$$;
revoke all on function public.piste_releve_photographier() from public, anon, authenticated;
create trigger carburant_index_releves_photographie before insert on public.carburant_index_releves
  for each row execute function public.piste_releve_photographier();

create or replace function public.piste_releve_snapshot_immuable()
 returns trigger language plpgsql set search_path to 'public'
as $$
begin
  if new.config_snapshot is distinct from old.config_snapshot then
    raise exception 'SNAPSHOT_IMMUABLE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.piste_releve_snapshot_immuable() from public, anon, authenticated;
create trigger carburant_index_releves_snapshot_immuable before update on public.carburant_index_releves
  for each row execute function public.piste_releve_snapshot_immuable();

-- ---------------------------------------------------------------------
-- 7. enregistrer_config_piste : site déduit de l'appelant
-- ---------------------------------------------------------------------
create or replace function public.enregistrer_config_piste(p_config jsonb, p_motif text default null)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_site text := public.current_employee_site_id();
  v_avant jsonb;
  v_version integer;
begin
  if auth.uid() is null or not public.piste_manager_du_site(v_site) then
    raise exception 'ROLE_NON_AUTORISE' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_config) <> 'object'
     or jsonb_typeof(p_config -> 'pompes') <> 'object'
     or jsonb_typeof(p_config -> 'chiffres') <> 'object'
     or coalesce((p_config ->> 'litresParUnite')::numeric, 0) <= 0
     or coalesce((p_config ->> 'toleranceL')::numeric, -1) < 0
     or coalesce((p_config ->> 'seuilL')::numeric, 0) <= coalesce((p_config ->> 'toleranceL')::numeric, 1e9)
     or coalesce((p_config ->> 'delaiReleveManquantMin')::int, 0) not between 1 and 240 then
    raise exception 'CONFIG_INVALIDE' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext('config_piste:' || v_site));
  select c.config, c.version into v_avant, v_version
    from public.carburant_index_config c where c.site = v_site order by c.version desc limit 1;

  insert into public.carburant_index_config (site, version, config, avant, motif, modifie_par)
  values (v_site, coalesce(v_version, 0) + 1, p_config, v_avant, nullif(btrim(p_motif), ''), auth.uid())
  returning version into v_version;
  return v_version;
end;
$$;
comment on function public.enregistrer_config_piste(jsonb, text) is
  'Insère une nouvelle version de configuration pour LE SITE DE L''APPELANT (manager/gérant). Aucun paramètre site. Conserve l''avant et le motif.';
revoke all on function public.enregistrer_config_piste(jsonb, text) from public, anon;
grant execute on function public.enregistrer_config_piste(jsonb, text) to authenticated;

-- ---------------------------------------------------------------------
-- 8. qualifier_alerte_piste : le site vient de l'alerte, vérifié contre l'appelant
-- ---------------------------------------------------------------------
create or replace function public.qualifier_alerte_piste(
  p_alerte_id uuid, p_choix text, p_commentaire text default null, p_remplace_id uuid default null)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_alerte public.carburant_index_alertes%rowtype;
  v_id uuid;
begin
  select * into v_alerte from public.carburant_index_alertes where id = p_alerte_id for update;
  if v_alerte.id is null then raise exception 'ALERTE_INTROUVABLE' using errcode = 'P0001'; end if;
  if auth.uid() is null or not public.piste_manager_du_site(v_alerte.site) then
    raise exception 'ROLE_NON_AUTORISE' using errcode = 'P0001';
  end if;
  if p_choix is null or p_choix not in ('erreur_lecture', 'mouvement_confirme', 'cause_inconnue') then
    raise exception 'CHOIX_INVALIDE' using errcode = 'P0001';
  end if;
  if v_alerte.statut = 'resolue_auto' then
    raise exception 'ALERTE_DEJA_RESOLUE' using errcode = 'P0001';
  end if;
  if p_remplace_id is not null and not exists (
       select 1 from public.carburant_index_qualifications q
        where q.id = p_remplace_id and q.alerte_id = p_alerte_id) then
    raise exception 'REMPLACEMENT_INVALIDE' using errcode = 'P0001';
  end if;

  insert into public.carburant_index_qualifications (alerte_id, choix, commentaire, qualifie_par, remplace_id)
  values (p_alerte_id, p_choix, nullif(btrim(p_commentaire), ''), auth.uid(), p_remplace_id)
  returning id into v_id;
  update public.carburant_index_alertes set statut = 'qualifiee' where id = p_alerte_id;
  return v_id;
end;
$$;
comment on function public.qualifier_alerte_piste(uuid, text, text, uuid) is
  'Enregistre la décision du manager/gérant du site de l''alerte (append-only, correction = remplace_id). Le site n''est pas un paramètre. Ne modifie aucun index.';
revoke all on function public.qualifier_alerte_piste(uuid, text, text, uuid) from public, anon;
grant execute on function public.qualifier_alerte_piste(uuid, text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 9. Évaluation des contrôles (idempotente)
-- ---------------------------------------------------------------------
-- Relevé final d'un moment : {etat: aucun|conflit|ok, snapshot, vals}.
create or replace function public.piste_releve_final(p_site text, p_date date, p_moment text)
 returns jsonb
 language plpgsql stable set search_path to 'public'
as $$
declare
  v_n int; v_distincts int; v_snap jsonb; v_vals jsonb;
begin
  with r as (
    select re.config_snapshot as snap,
           (select jsonb_object_agg(v.pompe || '-' || v.produit, v.valeur_sept_chiffres)
              from public.carburant_index_valeurs v where v.releve_id = re.id) as vals
      from public.carburant_index_releves re
     where re.site = p_site and re.date = p_date and re.moment = p_moment and re.statut = 'final')
  select count(*), count(distinct (coalesce(snap::text, '') || coalesce(vals::text, ''))),
         (array_agg(snap))[1], (array_agg(vals))[1]
    into v_n, v_distincts, v_snap, v_vals from r;
  if v_n = 0 then return jsonb_build_object('etat', 'aucun'); end if;
  if v_distincts > 1 then return jsonb_build_object('etat', 'conflit'); end if;
  return jsonb_build_object('etat', 'ok', 'snapshot', v_snap, 'vals', v_vals);
end;
$$;
revoke all on function public.piste_releve_final(text, date, text) from public, anon, authenticated;

-- Comparaison de deux relevés finaux (équivalent SQL de comparerPassation).
-- Retourne {etat, raison, lignes[]} avec etat in conforme|tolere|anomalie|non_controle|impossible.
create or replace function public.piste_comparer(p_a jsonb, p_b jsonb)
 returns jsonb
 language plpgsql immutable set search_path to 'public'
as $$
declare
  v_cfg jsonb; v_echelle numeric; v_tol numeric; v_seuil numeric;
  v_p text; v_prod text; v_clef text; v_a text; v_b text; v_ecart numeric;
  v_lignes jsonb := '[]'::jsonb; v_manque boolean := false; v_anom boolean := false; v_tole boolean := false;
  v_etat text;
begin
  if p_a ->> 'etat' <> 'ok' or p_b ->> 'etat' <> 'ok' then
    return jsonb_build_object('etat', 'non_controle',
      'raison', case when p_a ->> 'etat' = 'conflit' or p_b ->> 'etat' = 'conflit'
                     then 'Relevés finaux contradictoires pour un même moment.'
                     else 'Donnée manquante : un des deux relevés n''est pas enregistré dans NEXUS.' end,
      'lignes', v_lignes);
  end if;
  if p_a -> 'snapshot' is null or p_b -> 'snapshot' is null
     or jsonb_typeof(p_a -> 'snapshot') = 'null' or jsonb_typeof(p_b -> 'snapshot') = 'null' then
    return jsonb_build_object('etat', 'non_controle',
      'raison', 'Relevé antérieur à la configuration versionnée : configuration d''origine non photographiée.', 'lignes', v_lignes);
  end if;
  v_cfg := p_b -> 'snapshot' -> 'config';
  if (p_a -> 'snapshot' -> 'config' -> 'pompes', p_a -> 'snapshot' -> 'config' -> 'chiffres', p_a -> 'snapshot' -> 'config' -> 'litresParUnite')
     is distinct from (v_cfg -> 'pompes', v_cfg -> 'chiffres', v_cfg -> 'litresParUnite') then
    return jsonb_build_object('etat', 'impossible',
      'raison', 'Comparaison impossible : la configuration des compteurs a changé entre les deux relevés.', 'lignes', v_lignes);
  end if;
  v_echelle := (v_cfg ->> 'litresParUnite')::numeric;
  if v_echelle is null or v_echelle <= 0 then
    return jsonb_build_object('etat', 'impossible', 'raison', 'Comparaison impossible : unité de mesure non confirmée.', 'lignes', v_lignes);
  end if;
  v_tol := (v_cfg ->> 'toleranceL')::numeric; v_seuil := (v_cfg ->> 'seuilL')::numeric;

  for v_p in select jsonb_object_keys(v_cfg -> 'pompes') order by 1 loop
    if coalesce((v_cfg -> 'pompes' -> v_p ->> 'enService')::boolean, false) is not true then continue; end if;
    foreach v_prod in array array[v_cfg -> 'pompes' -> v_p ->> 'gauche', v_cfg -> 'pompes' -> v_p ->> 'droite'] loop
      v_clef := v_p || '-' || v_prod;
      v_a := p_a -> 'vals' ->> v_clef; v_b := p_b -> 'vals' ->> v_clef;
      if v_a is null or v_b is null or v_a !~ '^[0-9]+$' or v_b !~ '^[0-9]+$' then
        v_manque := true;
        v_lignes := v_lignes || jsonb_build_object('clef', v_clef, 'etat', 'non_controle');
        continue;
      end if;
      v_ecart := (v_b::numeric - v_a::numeric) * v_echelle;
      v_etat := case when abs(v_ecart) = 0 then 'conforme' when abs(v_ecart) >= v_seuil then 'anomalie' else 'tolere' end;
      if v_etat = 'anomalie' then v_anom := true; elsif v_etat = 'tolere' then v_tole := true; end if;
      v_lignes := v_lignes || jsonb_build_object('clef', v_clef, 'ecartL', v_ecart, 'etat', v_etat);
    end loop;
  end loop;
  if v_manque then
    return jsonb_build_object('etat', 'non_controle', 'raison', 'Donnée manquante : au moins un compteur n''a pas de valeur.', 'lignes', v_lignes);
  end if;
  return jsonb_build_object('etat', case when v_anom then 'anomalie' when v_tole then 'tolere' else 'conforme' end, 'lignes', v_lignes);
end;
$$;
revoke all on function public.piste_comparer(jsonb, jsonb) from public, anon, authenticated;

-- Ouvre, met à jour ou résout UNE alerte (idempotent sur la clé unique).
create or replace function public.piste_poser_alerte(
  p_site text, p_type text, p_evenement text, p_niveau text, p_present boolean, p_constat jsonb, p_raison text)
 returns void
 language plpgsql security definer set search_path to 'public'
as $$
begin
  if p_present then
    insert into public.carburant_index_alertes (site, type, evenement, niveau, constat)
    values (p_site, p_type, p_evenement, p_niveau, p_constat)
    on conflict (site, type, evenement) do update
      set constat = excluded.constat, niveau = excluded.niveau,
          statut = case when carburant_index_alertes.statut = 'resolue_auto' then 'ouverte' else carburant_index_alertes.statut end,
          cloturee_le = case when carburant_index_alertes.statut = 'resolue_auto' then null else carburant_index_alertes.cloturee_le end,
          raison_cloture = case when carburant_index_alertes.statut = 'resolue_auto' then null else carburant_index_alertes.raison_cloture end;
  else
    update public.carburant_index_alertes
       set statut = 'resolue_auto', cloturee_le = now(), raison_cloture = p_raison
     where site = p_site and type = p_type and evenement = p_evenement and statut in ('ouverte', 'qualifiee');
  end if;
end;
$$;
revoke all on function public.piste_poser_alerte(text, text, text, text, boolean, jsonb, text) from public, anon, authenticated;

-- Évalue un site pour une date de référence. Site en paramètre => NON exécutable
-- par un utilisateur ; appelée seulement par la tâche planifiée ou par
-- evaluer_controles_piste() qui impose le site de l'appelant.
create or replace function public.piste_evaluer_site(p_site text, p_date date)
 returns void
 language plpgsql security definer set search_path to 'public'
as $$
declare
  v_tz text; v_cfg jsonb; v_delai int; v_res jsonb; v_present boolean;
  v_q text; v_moment text; v_deb time; v_fin time; v_echeance timestamptz; v_ev text;
  v_a jsonb; v_b jsonb;
begin
  select s.timezone into v_tz from public.sites s where s.site_id = p_site;
  if v_tz is null or btrim(v_tz) = '' or not exists (select 1 from pg_timezone_names where name = v_tz) then
    return; -- fail-closed : pas de fuseau, pas d'horloge, aucun verdict.
  end if;

  -- Passation (fin Q1 -> début Q2, orange) et nuit (fin Q2 de la veille -> début Q1, rouge).
  v_a := public.piste_releve_final(p_site, p_date, 'fin_q1');
  v_b := public.piste_releve_final(p_site, p_date, 'debut_q2');
  v_res := public.piste_comparer(v_a, v_b);
  v_present := v_res ->> 'etat' = 'anomalie';
  perform public.piste_poser_alerte(p_site, 'passation', p_date::text, 'orange', v_present, v_res, 'Recalcul sur relevés finaux : plus d''écart.');

  v_a := public.piste_releve_final(p_site, p_date - 1, 'fin_q2');
  v_b := public.piste_releve_final(p_site, p_date, 'debut_q1');
  v_res := public.piste_comparer(v_a, v_b);
  v_present := v_res ->> 'etat' = 'anomalie';
  perform public.piste_poser_alerte(p_site, 'nuit', p_date::text, 'rouge', v_present, v_res, 'Recalcul sur relevés finaux : plus d''écart.');

  -- Relevé de fin manquant : fin de quart (calculer_horaires_quart, moteur unique)
  -- + délai de la configuration courante, au fuseau du site.
  select c.config into v_cfg from public.carburant_index_config c where c.site = p_site order by c.version desc limit 1;
  if v_cfg is null then return; end if;
  v_delai := (v_cfg ->> 'delaiReleveManquantMin')::int;
  if v_delai is null then return; end if;

  foreach v_q in array array['quart1', 'quart2'] loop
    v_moment := case v_q when 'quart1' then 'fin_q1' else 'fin_q2' end;
    select h.heure_debut, h.heure_fin into v_deb, v_fin from public.calculer_horaires_quart(p_site, v_q, p_date) h;
    if v_fin is null then continue; end if;
    if not exists (select 1 from public.shifts sh
                    where sh.site = p_site and sh.role = 'pompiste'
                      and sh.quart = case v_q when 'quart1' then 'matin' else 'soir' end
                      and (sh.heure_debut at time zone v_tz)::date = p_date) then
      continue; -- pas de pompiste ce quart-là : aucun relevé attendu.
    end if;
    v_echeance := ((p_date + case when v_fin <= v_deb then 1 else 0 end)::timestamp + v_fin) at time zone v_tz
                  + make_interval(mins => v_delai);
    v_ev := v_moment || ':' || p_date::text;
    v_present := now() >= v_echeance
                 and public.piste_releve_final(p_site, p_date, v_moment) ->> 'etat' = 'aucun';
    perform public.piste_poser_alerte(p_site, 'releve_manquant', v_ev, 'rouge', v_present,
      jsonb_build_object('moment', v_moment, 'quart', v_q, 'echeance', v_echeance,
                         'message', 'Relevé de fin non enregistré dans NEXUS'),
      'Relevé final enregistré.');
  end loop;
end;
$$;
revoke all on function public.piste_evaluer_site(text, date) from public, anon, authenticated;

-- Appel manager : site déduit de l'appelant, deux jours (aujourd'hui et hier, fuseau du site).
create or replace function public.evaluer_controles_piste()
 returns void
 language plpgsql security definer set search_path to 'public'
as $$
declare
  v_site text := public.current_employee_site_id();
  v_tz text; v_jour date;
begin
  if auth.uid() is null or not public.piste_manager_du_site(v_site) then
    raise exception 'ROLE_NON_AUTORISE' using errcode = 'P0001';
  end if;
  select s.timezone into v_tz from public.sites s where s.site_id = v_site;
  if v_tz is null or not exists (select 1 from pg_timezone_names where name = v_tz) then return; end if;
  v_jour := (now() at time zone v_tz)::date;
  perform public.piste_evaluer_site(v_site, v_jour);
  perform public.piste_evaluer_site(v_site, v_jour - 1);
end;
$$;
comment on function public.evaluer_controles_piste() is
  'Réévalue les contrôles du site de l''appelant (manager/gérant), sans paramètre. Idempotent.';
revoke all on function public.evaluer_controles_piste() from public, anon;
grant execute on function public.evaluer_controles_piste() to authenticated;

-- Tâche planifiée : tous les sites, indépendante de l'ouverture du Journal.
create or replace function public.evaluer_tous_sites_piste()
 returns void
 language plpgsql security definer set search_path to 'public'
as $$
declare
  r record; v_jour date;
begin
  for r in select distinct c.site, s.timezone from public.carburant_index_config c
             join public.sites s on s.site_id = c.site loop
    if r.timezone is null or not exists (select 1 from pg_timezone_names where name = r.timezone) then continue; end if;
    v_jour := (now() at time zone r.timezone)::date;
    perform public.piste_evaluer_site(r.site, v_jour);
    perform public.piste_evaluer_site(r.site, v_jour - 1);
  end loop;
end;
$$;
revoke all on function public.evaluer_tous_sites_piste() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 10. Configuration initiale du site de Test + planification
-- ---------------------------------------------------------------------
insert into public.carburant_index_config (site, version, config, avant, motif, modifie_par)
select s.site_id, 1,
  jsonb_build_object(
    'litresParUnite', 1, 'toleranceL', 9, 'seuilL', 10, 'delaiReleveManquantMin', 30,
    'pompes', jsonb_build_object(
      '1', jsonb_build_object('gauche', 'GO', 'droite', 'SP', 'enService', true),
      '2', jsonb_build_object('gauche', 'SP', 'droite', 'GO', 'enService', true),
      '3', jsonb_build_object('gauche', 'GO', 'droite', 'SP', 'enService', true),
      '4', jsonb_build_object('gauche', 'SP', 'droite', 'GO', 'enService', true)),
    'chiffres', jsonb_build_object('mecanique', 7, 'decenium', 6),
    'ordreRecopie', jsonb_build_array('SP', 'GO'),
    'gnr', jsonb_build_object('enService', false, 'indexFige', '1191213'),
    'echelleConfirmee', jsonb_build_object('par', 'Frédéric Bragance', 'le', '2026-10-17',
                                            'mode', 'déclaration en chat : +1 correspond à un litre')),
  null, 'Configuration initiale (cahier des charges du 17/10/2026)', null
from public.sites s where s.site_id = 'vito-sainte-marie';

do $planif$
begin
  if exists (select 1 from cron.job where jobname = 'nexus-journal-piste') then
    perform cron.unschedule('nexus-journal-piste');
  end if;
  perform cron.schedule('nexus-journal-piste', '*/5 * * * *', 'select public.evaluer_tous_sites_piste();');
end
$planif$;

-- ---------------------------------------------------------------------
-- 11. Postconditions (la migration échoue, donc rien n'est appliqué, si elles ne tiennent pas)
-- ---------------------------------------------------------------------
do $ctrl$
begin
  if (select count(*) from pg_class where relname in
        ('carburant_index_config', 'carburant_index_alertes', 'carburant_index_qualifications')
        and relrowsecurity) <> 3 then raise exception 'RLS absente'; end if;
  if exists (select 1 from information_schema.role_table_grants
              where table_name in ('carburant_index_config', 'carburant_index_alertes', 'carburant_index_qualifications')
                and ((grantee = 'anon') or (grantee = 'authenticated' and privilege_type <> 'SELECT')
                     or grantee = 'PUBLIC')) then raise exception 'grant illicite'; end if;
  if has_function_privilege('anon', 'public.evaluer_controles_piste()', 'execute')
     or has_function_privilege('authenticated', 'public.piste_evaluer_site(text,date)', 'execute')
     or has_function_privilege('authenticated', 'public.evaluer_tous_sites_piste()', 'execute')
     or has_function_privilege('anon', 'public.enregistrer_config_piste(jsonb,text)', 'execute')
     or has_function_privilege('anon', 'public.qualifier_alerte_piste(uuid,text,text,uuid)', 'execute')
  then raise exception 'EXECUTE illicite'; end if;
end
$ctrl$;
commit;
```

## §B. Preuve rejouable — `supabase/preuves/preuve-journal-piste-rls-test.sql` (transaction annulée)

```sql
-- =====================================================================
-- Preuve rejouable — Journal Piste (TEST SEULEMENT)
-- À jouer APRÈS la migration 20261017140000, en une transaction ANNULÉE
-- (rollback final) : aucune donnée ne subsiste. Rejouable avant (les tables
-- n'existent pas : le bloc 0 le constate) et après.
-- Chaque cas affiche  CAS n | attendu | obtenu | OK/KO ; un KO fait échouer.
-- Les acteurs sont créés dans la transaction (employés fictifs, annulés).
-- =====================================================================
begin;
set local lock_timeout = '2s';
create temp table resultats (cas text, attendu text, obtenu text) on commit drop;
grant all on resultats to anon, authenticated;

-- Acteurs fictifs : deux sites, un manager par site, un gérant, un pompiste.
-- (adapter les colonnes à employees si le schéma Test diffère ; c'est le seul
-- point de la preuve qui dépend d'un fait à mesurer sur Test avant exécution.)
insert into public.sites (site_id, timezone) values ('preuve-a', 'America/Martinique'), ('preuve-b', 'America/Martinique')
  on conflict do nothing;
insert into public.employees (id, site, role, prenom, nom, actif) values
  ('00000000-0000-0000-0000-0000000000a1', 'preuve-a', 'manager', 'MgrA', 'Preuve', true),
  ('00000000-0000-0000-0000-0000000000a2', 'preuve-a', 'gerant',  'GerA', 'Preuve', true),
  ('00000000-0000-0000-0000-0000000000a3', 'preuve-a', 'pompiste', 'PompA', 'Preuve', true),
  ('00000000-0000-0000-0000-0000000000b1', 'preuve-b', 'manager', 'MgrB', 'Preuve', true);

-- Une configuration et une alerte de preuve, posées en tant que propriétaire.
insert into public.carburant_index_config (site, version, config) values
  ('preuve-a', 1, '{"litresParUnite":1,"toleranceL":9,"seuilL":10,"delaiReleveManquantMin":30,"pompes":{},"chiffres":{}}');
insert into public.carburant_index_alertes (id, site, type, evenement, niveau, constat) values
  ('00000000-0000-0000-0000-00000000aaaa', 'preuve-a', 'passation', '2026-10-17', 'orange', '{}');

-- Helper : joue une instruction sous un rôle/identité, consigne OK si elle
-- lève (refus attendu) ou si elle aboutit (autorisation attendue).
create or replace function pg_temp.jouer(p_cas text, p_role text, p_uid text, p_sql text, p_attendu text)
returns void language plpgsql as $$
declare v_obtenu text := 'autorise'; v_n bigint;
begin
  execute format('set local role %I', p_role);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', p_role)::text, true);
  begin
    execute p_sql;
  exception when others then v_obtenu := 'refuse';
  end;
  execute 'reset role';
  insert into resultats values (p_cas, p_attendu, v_obtenu);
end $$;
grant execute on function pg_temp.jouer(text, text, text, text, text) to public;

-- ---- LECTURE (RLS) ------------------------------------------------
-- Compte visible par acteur (0 = rien de visible ; l'erreur compte comme refus).
create or replace function pg_temp.voir(p_cas text, p_role text, p_uid text, p_attendu_n bigint)
returns void language plpgsql as $$
declare v_n bigint; v_obtenu text;
begin
  execute format('set local role %I', p_role);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', p_role)::text, true);
  begin
    select count(*) into v_n from public.carburant_index_alertes;
    v_obtenu := v_n::text;
  exception when others then v_obtenu := '0';
  end;
  execute 'reset role';
  insert into resultats values (p_cas, p_attendu_n::text, v_obtenu);
end $$;
select pg_temp.voir('L1 anon ne lit pas',                  'anon',          '00000000-0000-0000-0000-000000000000', 0);
select pg_temp.voir('L2 pompiste ne lit pas',              'authenticated', '00000000-0000-0000-0000-0000000000a3', 0);
select pg_temp.voir('L3 manager d''un autre site ne lit pas','authenticated', '00000000-0000-0000-0000-0000000000b1', 0);
select pg_temp.voir('L4 manager du site lit',              'authenticated', '00000000-0000-0000-0000-0000000000a1', 1);
select pg_temp.voir('L5 gérant du site lit',               'authenticated', '00000000-0000-0000-0000-0000000000a2', 1);

-- ---- ÉCRITURE DIRECTE : toujours refusée, pour tous les rôles clients ---------
do $$
declare r record; t text;
begin
  for r in select * from (values
      ('anon','00000000-0000-0000-0000-000000000000'),
      ('authenticated','00000000-0000-0000-0000-0000000000a3'),
      ('authenticated','00000000-0000-0000-0000-0000000000b1'),
      ('authenticated','00000000-0000-0000-0000-0000000000a1'),
      ('authenticated','00000000-0000-0000-0000-0000000000a2')) v(role, uid) loop
    foreach t in array array['carburant_index_config','carburant_index_alertes','carburant_index_qualifications'] loop
      perform pg_temp.jouer('W '||r.role||' '||right(r.uid,2)||' INSERT '||t, r.role, r.uid,
        format('insert into public.%I (site) values (''preuve-a'')', t), 'refuse');
      perform pg_temp.jouer('W '||r.role||' '||right(r.uid,2)||' UPDATE '||t, r.role, r.uid,
        format('update public.%I set site = site', t), 'refuse');
      perform pg_temp.jouer('W '||r.role||' '||right(r.uid,2)||' DELETE '||t, r.role, r.uid,
        format('delete from public.%I', t), 'refuse');
      perform pg_temp.jouer('W '||r.role||' '||right(r.uid,2)||' TRUNCATE '||t, r.role, r.uid,
        format('truncate public.%I', t), 'refuse');
    end loop;
  end loop;
end $$;

-- ---- FONCTIONS : refus et autorisations --------------------------------------
-- enregistrer_config_piste : site de l'appelant seulement
select pg_temp.jouer('F1 anon enregistre config', 'anon', '00000000-0000-0000-0000-000000000000',
  $q$select public.enregistrer_config_piste('{}'::jsonb)$q$, 'refuse');
select pg_temp.jouer('F2 pompiste enregistre config', 'authenticated', '00000000-0000-0000-0000-0000000000a3',
  $q$select public.enregistrer_config_piste('{"litresParUnite":1}'::jsonb)$q$, 'refuse');
select pg_temp.jouer('F3 manager config invalide refusée', 'authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$select public.enregistrer_config_piste('{"litresParUnite":0}'::jsonb)$q$, 'refuse');
select pg_temp.jouer('F4 manager du site enregistre config valide', 'authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$select public.enregistrer_config_piste('{"litresParUnite":1,"toleranceL":9,"seuilL":10,"delaiReleveManquantMin":30,"pompes":{},"chiffres":{}}'::jsonb, 'preuve')$q$, 'autorise');
-- La version posée par F4 doit porter le site de l'appelant (preuve-a), jamais un autre.
select pg_temp.jouer('F5 version posée sur le site de l''appelant', 'authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$do $i$ begin if (select site from public.carburant_index_config order by modifie_le desc limit 1) <> 'preuve-a' then raise exception 'mauvais site'; end if; end $i$$q$, 'autorise');

-- qualifier_alerte_piste : le site vient de l'alerte, vérifié contre l'appelant
select pg_temp.jouer('Q1 anon qualifie', 'anon', '00000000-0000-0000-0000-000000000000',
  $q$select public.qualifier_alerte_piste('00000000-0000-0000-0000-00000000aaaa', 'cause_inconnue')$q$, 'refuse');
select pg_temp.jouer('Q2 pompiste qualifie', 'authenticated', '00000000-0000-0000-0000-0000000000a3',
  $q$select public.qualifier_alerte_piste('00000000-0000-0000-0000-00000000aaaa', 'cause_inconnue')$q$, 'refuse');
select pg_temp.jouer('Q3 manager d''un autre site qualifie', 'authenticated', '00000000-0000-0000-0000-0000000000b1',
  $q$select public.qualifier_alerte_piste('00000000-0000-0000-0000-00000000aaaa', 'cause_inconnue')$q$, 'refuse');
select pg_temp.jouer('Q4 choix hors liste', 'authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$select public.qualifier_alerte_piste('00000000-0000-0000-0000-00000000aaaa', 'au_hasard')$q$, 'refuse');
select pg_temp.jouer('Q5 manager du site qualifie', 'authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$select public.qualifier_alerte_piste('00000000-0000-0000-0000-00000000aaaa', 'erreur_lecture', 'preuve')$q$, 'autorise');
select pg_temp.jouer('Q6 gérant du site corrige (remplace)', 'authenticated', '00000000-0000-0000-0000-0000000000a2',
  $q$select public.qualifier_alerte_piste('00000000-0000-0000-0000-00000000aaaa', 'cause_inconnue', 'correction',
       (select id from public.carburant_index_qualifications order by qualifie_le desc limit 1))$q$, 'autorise');

-- Fonctions à paramètre site : exécutables par personne côté client.
select pg_temp.jouer('E1 manager appelle piste_evaluer_site(site)', 'authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$select public.piste_evaluer_site('preuve-a', current_date)$q$, 'refuse');
select pg_temp.jouer('E2 manager appelle piste_evaluer_site(autre site)', 'authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$select public.piste_evaluer_site('preuve-b', current_date)$q$, 'refuse');
select pg_temp.jouer('E3 anon appelle evaluer_tous_sites_piste', 'anon', '00000000-0000-0000-0000-000000000000',
  $q$select public.evaluer_tous_sites_piste()$q$, 'refuse');
select pg_temp.jouer('E4 manager appelle evaluer_tous_sites_piste', 'authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$select public.evaluer_tous_sites_piste()$q$, 'refuse');
select pg_temp.jouer('E5 anon appelle evaluer_controles_piste', 'anon', '00000000-0000-0000-0000-000000000000',
  $q$select public.evaluer_controles_piste()$q$, 'refuse');
select pg_temp.jouer('E6 pompiste appelle evaluer_controles_piste', 'authenticated', '00000000-0000-0000-0000-0000000000a3',
  $q$select public.evaluer_controles_piste()$q$, 'refuse');
select pg_temp.jouer('E7 manager appelle evaluer_controles_piste (son site)', 'authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$select public.evaluer_controles_piste()$q$, 'autorise');

-- Immuabilité même pour le propriétaire (triggers) : une version, une qualification, l'identité d'une alerte.
select pg_temp.jouer('I1 UPDATE config (propriétaire)', current_user, '00000000-0000-0000-0000-0000000000a1',
  $q$update public.carburant_index_config set motif = 'x'$q$, 'refuse');
select pg_temp.jouer('I2 DELETE qualification (propriétaire)', current_user, '00000000-0000-0000-0000-0000000000a1',
  $q$delete from public.carburant_index_qualifications$q$, 'refuse');
select pg_temp.jouer('I3 changer le site d''une alerte (propriétaire)', current_user, '00000000-0000-0000-0000-0000000000a1',
  $q$update public.carburant_index_alertes set site = 'preuve-b'$q$, 'refuse');

-- Photographie : un client ne peut pas imposer ni modifier config_snapshot.
select pg_temp.jouer('S1 UPDATE config_snapshot d''un relevé (propriétaire)', current_user, '00000000-0000-0000-0000-0000000000a1',
  $q$update public.carburant_index_releves set config_snapshot = '{"x":1}' where config_snapshot is null and false or id in (select id from public.carburant_index_releves limit 1)$q$, 'refuse');

-- Postconditions de privilèges (mesurées, pas supposées).
insert into resultats
select 'P1 grants anon/PUBLIC sur les 3 tables', '0',
  (select count(*) from information_schema.role_table_grants
    where table_name in ('carburant_index_config','carburant_index_alertes','carburant_index_qualifications')
      and grantee in ('anon','PUBLIC'))::text;
insert into resultats
select 'P2 grants authenticated autres que SELECT', '0',
  (select count(*) from information_schema.role_table_grants
    where table_name in ('carburant_index_config','carburant_index_alertes','carburant_index_qualifications')
      and grantee = 'authenticated' and privilege_type <> 'SELECT')::text;
insert into resultats
select 'P3 RLS active sur les 3 tables', '3',
  (select count(*) from pg_class where relname in ('carburant_index_config','carburant_index_alertes','carburant_index_qualifications') and relrowsecurity)::text;
insert into resultats
select 'P4 fonctions SECURITY DEFINER sans search_path fixé', '0',
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and p.proname in ('enregistrer_config_piste','qualifier_alerte_piste','evaluer_controles_piste','evaluer_tous_sites_piste',
                        'piste_evaluer_site','piste_poser_alerte','piste_manager_du_site','piste_releve_photographier',
                        'piste_qualification_heriter_site')
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%'))::text;
insert into resultats
select 'P5 EXECUTE anon sur les fonctions Journal Piste', '0',
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like any (array['%_piste','piste_%','%_piste_%'])
      and has_function_privilege('anon', p.oid, 'execute'))::text;

-- Verdict : tout écart attendu/obtenu fait échouer la preuve.
select cas, attendu, obtenu, case when attendu = obtenu then 'OK' else 'KO' end as verdict from resultats order by cas;
do $$ begin
  if exists (select 1 from resultats where attendu <> obtenu) then raise exception 'PREUVE KO — voir les lignes KO ci-dessus'; end if;
end $$;
rollback;
```
