-- Campagne V2, lot C2 (Guardian, commentaires 6880117787 et 6880159725 sur #160) : suivi des ventes pendant la promotion.
-- Deux tables append-only (points de ventes par import, annulations tracées), une vue du point courant
-- (security_invoker) et une RPC de publication atomique (security invoker : la RLS de l'appelant s'applique).
-- Aucune écriture dans `products`, aucune suppression : une correction passe par une annulation tracée.
-- Le chiffre d'affaires est HT, comme la colonne « Prix de vente HT » du fichier importé.

create table if not exists campagne_ventes_points (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  campagne_id uuid not null references campagnes_nexus(id) on delete cascade,
  batch_id uuid not null references import_batches(id),
  article text not null,
  date_debut date not null,
  date_fin date not null,
  quantite numeric not null default 0 check (quantite >= 0),
  ca_ht numeric not null default 0,
  absent_du_fichier boolean not null default false,
  importe_par uuid references employees(id),
  importe_le timestamptz not null default now(),
  constraint campagne_ventes_points_unique unique (batch_id, article),
  constraint campagne_ventes_points_dates check (date_fin >= date_debut)
);
create index if not exists campagne_ventes_points_campagne_idx on campagne_ventes_points (campagne_id, importe_le);

create table if not exists campagne_ventes_annulations (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  batch_id uuid not null references import_batches(id),
  motif text not null check (length(trim(motif)) > 0),
  annule_par uuid references employees(id),
  annule_le timestamptz not null default now(),
  remplace_par_batch_id uuid references import_batches(id),
  constraint campagne_ventes_annulations_unique unique (batch_id)
);

alter table campagne_ventes_points enable row level security;
alter table campagne_ventes_annulations enable row level security;

do $$
declare t text;
begin
  foreach t in array array['campagne_ventes_points','campagne_ventes_annulations'] loop
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='lecture_meme_site') then
      execute format('create policy lecture_meme_site on %I for select using (site = current_employee_site_id())', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='insertion_manager_meme_site') then
      execute format('create policy insertion_manager_meme_site on %I for insert with check (site = current_employee_site_id() and current_employee_role() in (''manager'',''gerant''))', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='createur_lit_si_autorise') then
      execute format('create policy createur_lit_si_autorise on %I for select using (je_suis_createur() and exists (select 1 from sites s where s.site_id = %I.site and s.acces_createur_autorise = true))', t, t);
    end if;
  end loop;
end $$;

revoke all on campagne_ventes_points from anon;
revoke all on campagne_ventes_annulations from anon;
revoke update, delete, truncate, references, trigger on campagne_ventes_points from authenticated;
revoke update, delete, truncate, references, trigger on campagne_ventes_annulations from authenticated;

comment on table campagne_ventes_points is 'Points de ventes cumulées par article, un par import « Actualiser mes ventes ». Append-only : le point qui fait foi est le dernier import valide, jamais une somme.';
comment on table campagne_ventes_annulations is 'Annulation tracée d''un import de suivi des ventes. Un import est valide tant qu''aucune ligne ne le vise.';

-- Point courant : lignes du dernier import valide de chaque promotion (même site, RLS de l'appelant).
create or replace view campagne_ventes_point_courant with (security_invoker = true) as
select p.*
from campagne_ventes_points p
where p.batch_id = (
  select p2.batch_id
  from campagne_ventes_points p2
  where p2.campagne_id = p.campagne_id
    and not exists (select 1 from campagne_ventes_annulations a where a.batch_id = p2.batch_id)
  order by p2.date_fin desc, p2.importe_le desc
  limit 1
);
comment on view campagne_ventes_point_courant is 'Dernier import valide (non annulé) de chaque promotion. Jamais de somme de deux imports.';
revoke all on campagne_ventes_point_courant from anon;
revoke insert, update, delete, truncate, references, trigger on campagne_ventes_point_courant from authenticated;

-- Publication atomique. Écrit uniquement dans campagne_ventes_points (+ statut du batch).
-- Les articles sont comparés sur la désignation canonique (alias déjà appliqué à l'import), sans casse ni espaces de bord.
create or replace function campagne_ventes_publier(p_batch_id uuid, p_date_fin date)
returns table(lignes_publiees integer, articles_ignores text[], articles_absents text[])
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_batch record;
  v_camp record;
  v_dernier date;
  v_nb integer;
  v_ignores text[];
  v_absents text[];
begin
  if current_employee_role() not in ('manager','gerant') then
    raise exception 'Réservé aux managers et gérants.';
  end if;
  select * into v_batch from import_batches where id = p_batch_id;
  if not found then raise exception 'Import introuvable ou non accessible.'; end if;
  if v_batch.site <> current_employee_site_id() then raise exception 'Import d''un autre site.'; end if;
  if v_batch.intention <> 'campagne' or v_batch.campagne_id is null then
    raise exception 'Cet import n''est pas rattaché à une promotion.';
  end if;
  if v_batch.statut <> 'ready' then
    raise exception 'Import non prêt à être publié (statut actuel : %).', v_batch.statut;
  end if;
  select * into v_camp from campagnes_nexus where id = v_batch.campagne_id;
  if not found or v_camp.site <> v_batch.site then raise exception 'Promotion introuvable sur ce site.'; end if;

  if p_date_fin is null then raise exception 'Date de fin des ventes manquante.'; end if;
  if p_date_fin > (current_date - 1) then raise exception 'La date de fin ne peut pas dépasser la veille.'; end if;
  if p_date_fin > v_camp.date_fin then raise exception 'La date de fin ne peut pas dépasser la fin de la promotion.'; end if;
  if p_date_fin < v_camp.date_debut then raise exception 'La date de fin précède le début de la promotion.'; end if;

  select max(p.date_fin) into v_dernier
  from campagne_ventes_points p
  where p.campagne_id = v_camp.id
    and not exists (select 1 from campagne_ventes_annulations a where a.batch_id = p.batch_id);
  if v_dernier is not null and p_date_fin < v_dernier then
    raise exception 'La date de fin précède le dernier import valide (%). Annulez-le d''abord avec un motif.', v_dernier;
  end if;

  with promo as (
    select distinct on (o.article) o.article
    from campagne_objectifs_produits o
    where o.campagne_id = v_camp.id
    order by o.article, o.version desc
  ), fichier as (
    select lower(trim(r.valeurs->>'article')) as cle,
           max(r.valeurs->>'article') as article,
           sum(coalesce(nullif(r.valeurs->>'quantite','')::numeric, 0)) as quantite,
           sum(coalesce(nullif(r.valeurs->>'quantite','')::numeric, 0) * coalesce(nullif(r.valeurs->>'prix_vente','')::numeric, 0)) as ca_ht
    from import_row_results r
    where r.batch_id = p_batch_id and r.statut not in ('rejetee','doublon_fichier')
      and coalesce(trim(r.valeurs->>'article'),'') <> ''
    group by 1
  )
  insert into campagne_ventes_points (site, campagne_id, batch_id, article, date_debut, date_fin, quantite, ca_ht, absent_du_fichier, importe_par)
  select v_batch.site, v_camp.id, p_batch_id, pr.article, v_camp.date_debut, p_date_fin,
         coalesce(f.quantite, 0), coalesce(f.ca_ht, 0), f.cle is null, v_batch.auteur_id
  from promo pr
  left join fichier f on f.cle = lower(trim(pr.article));
  get diagnostics v_nb = row_count;
  if v_nb = 0 then raise exception 'Aucun article de promotion à suivre : validez d''abord les objectifs.'; end if;

  select coalesce(array_agg(f.article order by f.article), '{}') into v_ignores
  from (
    select max(r.valeurs->>'article') as article
    from import_row_results r
    where r.batch_id = p_batch_id and r.statut not in ('rejetee','doublon_fichier')
      and coalesce(trim(r.valeurs->>'article'),'') <> ''
    group by lower(trim(r.valeurs->>'article'))
  ) f
  where not exists (select 1 from campagne_ventes_points p where p.batch_id = p_batch_id and lower(trim(p.article)) = lower(trim(f.article)));

  select coalesce(array_agg(p.article order by p.article), '{}') into v_absents
  from campagne_ventes_points p where p.batch_id = p_batch_id and p.absent_du_fichier;

  update import_batches set statut = 'published', publie_le = now(), periode_debut = v_camp.date_debut, periode_fin = p_date_fin where id = p_batch_id;
  if v_batch.remplace_batch_id is not null then
    update import_batches set statut = 'superseded'
    where id = v_batch.remplace_batch_id and statut = 'published'
      and exists (select 1 from campagne_ventes_points p where p.batch_id = p_batch_id);
  end if;

  return query select v_nb, v_ignores, v_absents;
end;
$$;
comment on function campagne_ventes_publier is 'Publication atomique du suivi des ventes d''une promotion. N''écrit que dans campagne_ventes_points (jamais products). SECURITY INVOKER : RLS de l''appelant.';

revoke all on function campagne_ventes_publier(uuid, date) from public;
revoke all on function campagne_ventes_publier(uuid, date) from anon;
grant execute on function campagne_ventes_publier(uuid, date) to authenticated;
