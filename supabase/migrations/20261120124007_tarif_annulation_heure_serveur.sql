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
