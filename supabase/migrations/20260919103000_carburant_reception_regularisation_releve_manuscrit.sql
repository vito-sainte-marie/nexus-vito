-- NEXUS — Régularisation d'une réception carburant passée (19/09/2026,
-- demande de Frédéric après le cas du 18/09/2026).
--
-- CONTEXTE RÉEL. Le 18/09/2026, la livraison a bien eu lieu (BL enregistré :
-- GO 16 000 L, SP95 12 000 L) et Angélique a bien contrôlé le dépotage sur
-- le terrain — mais elle n'avait momentanément pas accès à son rôle
-- pompiste, donc AUCUNE réception n'a été saisie dans NEXUS. Les jaugeages
-- avant/après ont été relevés À LA MAIN et les preuves papier existent.
-- Il faut pouvoir les intégrer plusieurs jours après, sans jamais laisser
-- croire qu'ils ont été saisis électroniquement le 18/09.
--
-- CE QUI EXISTAIT DÉJÀ ET N'EST PAS RECRÉÉ ICI (audit du 19/09/2026) :
--   - la date réelle de livraison : carburant_reception_visites.date_visite
--     / heure_debut / heure_fin, déjà libres et déjà saisies depuis le champ
--     datetime-local de l'étape "Livraison attendue" ;
--   - la date réelle des mesures terrain : carburant_reception_mesures
--     .jaugeage_avant_le / jaugeage_apres_le (timestamptz) ;
--   - la date de saisie dans NEXUS : created_at (default now(), jamais
--     fourni par le client).
-- Les trois dates du mandat existent donc déjà. Cette migration n'ajoute
-- QUE ce qui manquait vraiment : la PROVENANCE des mesures, et la trace de
-- qui a régularisé, quand, pourquoi, sur quel justificatif, et qui avait
-- fait le contrôle terrain. Aucune table nouvelle, aucun module nouveau,
-- aucune seconde convention de calcul (Article 11).
--
-- CE QUI N'EST PAS TOUCHÉ, VOLONTAIREMENT :
--   - trg_preserver_releve_ouverture_lors_reception (31/08/2026) continue
--     d'annuler tout INSERT et de neutraliser tout UPDATE d'une réception
--     sur carburant_releves : une régularisation ne peut donc PAS ajouter
--     une seconde fois la livraison du 18/09 au stock physique du 19/09 ;
--   - l'arbitrage d'ancre de calcul (chargerDernieresAncresReception +
--     la garde "reception.mesureLe <= instantAncreBase") : une réception
--     antérieure au dernier relevé n'est jamais retenue comme référence.
--     C'est précisément pourquoi une régularisation DOIT porter les
--     horodatages RÉELS du terrain et jamais l'heure de sa saisie.

-- ------------------------------------------------------------------
-- 1) La visite : mode de saisie + traçabilité de la régularisation
-- ------------------------------------------------------------------
alter table public.carburant_reception_visites
  add column if not exists mode_saisie text not null default 'temps_reel',
  add column if not exists regularisation_motif text,
  add column if not exists regularisation_par uuid,
  add column if not exists regularisation_par_nom text,
  add column if not exists regularisation_le timestamptz,
  add column if not exists controle_terrain_par text,
  add column if not exists justificatif_url text;

do $$ begin
  alter table public.carburant_reception_visites
    add constraint carburant_reception_visites_mode_saisie_check
    check (mode_saisie in ('temps_reel', 'regularisation'));
exception when duplicate_object then null; end $$;

-- Check SYMÉTRIQUE, dans les deux sens : une régularisation sans motif,
-- sans auteur ou sans date de régularisation serait une régularisation
-- anonyme ; une réception "temps réel" qui porterait quand même ces
-- champs serait une fiction inverse. NEXUS refuse les deux.
-- regularisation_le >= heure_fin : on ne régularise pas avant d'avoir reçu.
do $$ begin
  alter table public.carburant_reception_visites
    add constraint carburant_reception_visites_regularisation_coherente_check
    check (
      case mode_saisie
        when 'regularisation' then
          regularisation_motif is not null
          and btrim(regularisation_motif) <> ''
          and regularisation_par is not null
          and regularisation_le is not null
          and (heure_fin is null or regularisation_le >= heure_fin)
        else
          regularisation_motif is null
          and regularisation_par is null
          and regularisation_par_nom is null
          and regularisation_le is null
      end
    );
exception when duplicate_object then null; end $$;

comment on column public.carburant_reception_visites.mode_saisie is
  'temps_reel = réception saisie pendant le dépotage (cas normal). regularisation = réception passée intégrée après coup à partir d''un relevé terrain (cas du 18/09/2026). Ne change RIEN au calcul : seul l''affichage et la traçabilité en dépendent. La date réelle de la livraison reste date_visite/heure_debut/heure_fin, la date de saisie NEXUS reste created_at — les deux ne doivent jamais être confondues.';
comment on column public.carburant_reception_visites.regularisation_motif is
  'Pourquoi la réception n''a pas pu être saisie au moment du dépotage. Obligatoire et non vide en mode regularisation.';
comment on column public.carburant_reception_visites.regularisation_par is
  'Employé (manager/gérant) qui a intégré la réception passée dans NEXUS — distinct de employe_id, qui reste la personne ayant reçu la livraison.';
comment on column public.carburant_reception_visites.regularisation_le is
  'Instant de la SAISIE de régularisation. created_at dit la même chose pour une ligne posée d''un seul geste, mais regularisation_le reste la valeur métier explicite, lisible sans connaître la mécanique de la table.';
comment on column public.carburant_reception_visites.controle_terrain_par is
  'Personne qui a réalisé le contrôle et les jaugeages sur le terrain, quand elle n''est pas celle qui saisit (cas du 18/09 : contrôle terrain par la pompiste, saisie par le manager). Texte libre : la personne n''a pas forcément de compte NEXUS actif au moment du contrôle — c''est justement le cas qui a rendu la régularisation nécessaire.';
comment on column public.carburant_reception_visites.justificatif_url is
  'URL signée longue durée du justificatif (relevé manuscrit photographié, BL), dans le bucket privé existant preuves-missions — même infrastructure que les preuves de missions et les photos de pointage, aucun nouveau bucket.';

-- ------------------------------------------------------------------
-- 2) La mesure : sa provenance
-- ------------------------------------------------------------------
alter table public.carburant_reception_mesures
  add column if not exists source text not null default 'saisie_nexus';

do $$ begin
  alter table public.carburant_reception_mesures
    add constraint carburant_reception_mesures_source_check
    check (source in ('saisie_nexus', 'releve_manuscrit'));
exception when duplicate_object then null; end $$;

comment on column public.carburant_reception_mesures.source is
  'D''où vient cette mesure : saisie_nexus = jaugeage saisi dans NEXUS pendant le dépotage ; releve_manuscrit = jaugeage relevé à la main sur le terrain puis recopié depuis le document papier. Les VALEURS sont traitées exactement de la même façon par le moteur (nexus-reception-moteur.js) — la provenance n''est pas une décote, c''est une information de confiance affichée à l''utilisateur.';

-- ------------------------------------------------------------------
-- 3) La garde de rôle — en base, pas seulement dans l'écran
-- ------------------------------------------------------------------
-- Régulariser une réception passée, c'est écrire dans l'histoire : c'est une
-- décision de manager, pas un geste de poste. La policy INSERT des tables de
-- réception est (volontairement) ouverte à tout employé du site pour que le
-- pompiste puisse saisir sa réception du jour ; elle ne teste aucune date.
-- Réserver la régularisation au manager uniquement dans l'écran ne serait
-- donc pas une garde du tout (même dette que le rôle du jour, constatée le
-- 18/09/2026). Elle mord ici.
-- service_role est exempté : c'est le chemin des scripts de recette sur
-- l'environnement de Test, qui n'ont pas d'employé connecté.
create or replace function public.nexus_garde_regularisation_reception()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.mode_saisie is distinct from 'regularisation' then
    return new;
  end if;
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;
  if coalesce(public.current_employee_role(), '') not in ('manager', 'gerant') then
    raise exception 'Regulariser une reception passee est reserve au manager ou au gerant du site'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.nexus_garde_regularisation_reception() from public;

drop trigger if exists trg_garde_regularisation_reception on public.carburant_reception_visites;
create trigger trg_garde_regularisation_reception
before insert or update on public.carburant_reception_visites
for each row
execute function public.nexus_garde_regularisation_reception();
