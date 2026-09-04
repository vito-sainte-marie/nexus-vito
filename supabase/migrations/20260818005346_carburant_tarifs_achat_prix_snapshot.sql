-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260818005346 · carburant_tarifs_achat_prix_snapshot
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Cahier "NEXUS Carburants — Vocabulaire & intégration du prix d'achat"
-- (17/08/2026, cadrage développeur). §4/§9 : table de tarifs d'achat de
-- référence, versionnée par période, indépendante du parcours employé.
-- §5 : chaque réception résout et fige (snapshot) le tarif actif au
-- moment de sa création — jamais recalculé rétroactivement. §6 : un
-- override manager reste possible, motivé et audité, sans jamais modifier
-- le tarif de référence du mois.

create table carburant_tarifs_achat (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  carburant text not null check (carburant in ('go','sp95','gnr')),
  date_effet date not null,
  date_fin date,
  prix_achat_par_litre numeric not null check (prix_achat_par_litre >= 0),
  prix_vente_par_litre numeric check (prix_vente_par_litre is null or prix_vente_par_litre >= 0),
  source_type text not null default 'saisie_manager' check (source_type in ('facture_fournisseur','bareme','saisie_manager','autre')),
  source_reference text,
  created_by uuid,
  created_at timestamptz not null default now()
);

comment on table carburant_tarifs_achat is 'Tarif d''achat de référence par carburant et période tarifaire (cahier Vocabulaire & Prix d''achat, 17/08/2026). Le tarif actif à une date = le plus récent avec date_effet <= date. Une modification crée une nouvelle ligne, ne réécrit jamais les snapshots déjà posés sur des réceptions (Article 11).';

create index idx_carburant_tarifs_achat_resolution on carburant_tarifs_achat(site, carburant, date_effet desc);

alter table carburant_tarifs_achat enable row level security;

create policy select_carburant_tarifs_achat on carburant_tarifs_achat for select
  using (
    site = (select current_employee_site_id())
    or (
      (select je_suis_createur())
      and exists (select 1 from sites s where s.site_id = carburant_tarifs_achat.site and s.acces_createur_autorise = true)
    )
  );

create policy insert_carburant_tarifs_achat on carburant_tarifs_achat for insert
  with check (
    (select current_employee_role()) in ('manager','gerant')
    and site = (select current_employee_site_id())
  );

create policy update_carburant_tarifs_achat on carburant_tarifs_achat for update
  using (
    (select current_employee_role()) in ('manager','gerant')
    and site = (select current_employee_site_id())
  );

-- §5/§6 : snapshot + override sur la ligne de réception déjà posée
-- (Sprint C8, cout_achat_par_litre/cout_saisi_par/cout_saisi_le déjà
-- existants et réutilisés comme valeur/auteur/date effectifs — une seule
-- vérité consommée par le moteur CMP, Article 11). Nouvelles colonnes :
-- provenance (tarif résolu vs override) et traçabilité de l'override.
alter table carburant_reception_visite_lignes
  add column prix_achat_source_id uuid references carburant_tarifs_achat(id),
  add column prix_achat_override boolean not null default false,
  add column prix_achat_override_motif text;

comment on column carburant_reception_visite_lignes.prix_achat_source_id is 'Tarif carburant_tarifs_achat résolu et figé (snapshot) à la création de cette ligne. NULL si override manager ou si aucun tarif actif n''existait (cout_achat_par_litre reste NULL dans ce dernier cas — jamais 0,00 par défaut).';
comment on column carburant_reception_visite_lignes.prix_achat_override is 'true si le prix appliqué à cette ligne est un prix spécifique saisi par un manager (§6 du cahier), plutôt que le tarif de référence du mois résolu automatiquement.';
comment on column carburant_reception_visite_lignes.prix_achat_override_motif is 'Motif obligatoire de l''override (facture différente, avoir/rectification fournisseur, changement exceptionnel, autre) — jamais un override sans motif.';

-- §5 : résolution + snapshot automatique à la création de la ligne,
-- avant que l'employé ne quitte le parcours (jamais une ressaisie
-- demandée, jamais un montant recalculé plus tard). Ne s'exécute que si
-- l'appelant n'a pas déjà posé de cout_achat_par_litre (laisse la place à
-- un override explicite fait au même instant, cas futur).
create or replace function carburant_resoudre_prix_achat_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date;
  v_tarif carburant_tarifs_achat%rowtype;
begin
  if new.cout_achat_par_litre is not null then
    return new;
  end if;

  select date_visite into v_date from carburant_reception_visites where id = new.visite_id;
  if v_date is null then
    return new;
  end if;

  select * into v_tarif from carburant_tarifs_achat
    where site = new.site and carburant = new.carburant and date_effet <= v_date
    order by date_effet desc, created_at desc
    limit 1;

  if v_tarif.id is not null then
    new.cout_achat_par_litre := v_tarif.prix_achat_par_litre;
    new.prix_achat_source_id := v_tarif.id;
    new.cout_saisi_par := 'Tarif actif (auto)';
    new.cout_saisi_le := now();
  end if;

  return new;
end;
$$;

create trigger trg_carburant_resoudre_prix_achat_snapshot
  before insert on carburant_reception_visite_lignes
  for each row execute function carburant_resoudre_prix_achat_snapshot();
