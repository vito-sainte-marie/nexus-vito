-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260902174541 · carburant_ventilation_contexte
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

create table if not exists public.carburant_ventilation_contexte (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  date date not null,
  calcul_id uuid not null,
  fenetre_debut timestamptz,
  fenetre_fin timestamptz,
  quart_date date not null,
  quart text not null check (quart in ('1','2')),
  nature text not null check (nature in ('reel','estime_chevauchement','estime_absent')),
  fraction numeric not null check (fraction >= 0 and fraction <= 1),
  volume_go numeric,
  volume_sp95 numeric,
  volume_gnr numeric,
  methode text,
  estimable boolean not null default true,
  cree_le timestamptz not null default now()
);

comment on table public.carburant_ventilation_contexte is
'Journal du contexte de ventilation d''une fenêtre de contrôle carburant (doctrine Frédéric, 02/09/2026) : une ligne par quart entrant dans la fenêtre, avec sa nature — mesuré, estimé parce qu''à cheval sur une borne, ou estimé parce qu''absent — la fraction de durée retenue et le volume estimé. Append-only : aucune policy UPDATE ni DELETE, chaque recalcul écrit un nouveau calcul_id plutôt que de réécrire. N''EST JAMAIS UNE VÉRITÉ MÉTIER : une part estimée consignée ici ne doit pas devenir un écart dans carburant_controles, qui reste réservé aux comparaisons entièrement mesurées.';

comment on column public.carburant_ventilation_contexte.calcul_id is
'Regroupe les lignes d''un même calcul de fenêtre. Un recalcul crée un nouveau calcul_id — l''ancien reste, pour pouvoir répondre plus tard à "sur quoi reposait ce chiffre ce jour-là".';

comment on column public.carburant_ventilation_contexte.nature is
'reel = quart saisi et entièrement dans la fenêtre, repris tel quel. estime_chevauchement = quart saisi mais coupé par une borne (ex. livraison en plein quart) — jamais résolu par plus de saisie, un litrage agrégé ne se ventile pas. estime_absent = aucune ligne pour ce quart — remplacé dès que le quart réel est intégré.';

comment on column public.carburant_ventilation_contexte.estimable is
'false quand aucune moyenne historique n''existait pour ce créneau : la ligne trace alors une absence assumée, jamais un zéro fabriqué.';

create index if not exists idx_cvc_site_date on public.carburant_ventilation_contexte (site, date desc);
create index if not exists idx_cvc_calcul on public.carburant_ventilation_contexte (site, calcul_id);

alter table public.carburant_ventilation_contexte enable row level security;

create policy select_carburant_ventilation_contexte
  on public.carburant_ventilation_contexte for select
  using (
    site = (select current_employee_site_id())
    or ((select je_suis_createur()) and exists (
      select 1 from sites s
      where s.site_id = carburant_ventilation_contexte.site
        and s.acces_createur_autorise = true))
  );

create policy ecriture_manager_meme_site
  on public.carburant_ventilation_contexte for insert
  with check (
    (select current_employee_role()) = any (array['manager','gerant'])
    and site = (select current_employee_site_id())
  );
