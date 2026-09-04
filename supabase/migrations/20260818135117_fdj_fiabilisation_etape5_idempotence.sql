-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260818135117 · fdj_fiabilisation_etape5_idempotence
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- FDJ Fiabilisation Étape 5 (18/08/2026, cahier NEXUS_FDJ_Audit_Fiabilisation_Chaine_Quarts.pdf,
-- §9/§12/§13 "Idempotence des activations et appro tickets" — P0).
-- "Une activation = un evenement = un appro. Le moteur peut etre rejoue 100
-- fois sans creer 100 appro." Le cahier demande un idempotency_key sur
-- l'activation ; comme il n'existe pas de table Appro séparée dans NEXUS
-- (l'appro est soit une ligne fdj_stock_movements, soit le compteur dérivé
-- fdj_shift_counts.appro incrémenté à l'activation), la clé est posée
-- directement sur fdj_stock_movements.

alter table public.fdj_stock_movements
  add column if not exists idempotency_key uuid null;

comment on column public.fdj_stock_movements.idempotency_key is
  'FDJ Fiabilisation Étape 5 : clé générée côté client UNE SEULE FOIS par
  tentative d''écriture (même convention que NEXUS-Carburant-Reception-v1.html
  / genererIdempotencyKey) — un rejeu réseau de la même tentative porte la
  même clé et se heurte à fdj_stock_movements_idempotency_key_uniq (code
  Postgres 23505), traité côté client comme un succès idempotent, jamais
  comme une erreur. NULL pour les écritures manager déjà protégées par un
  autre garde-fou (bouton désactivé) — la clé n''est obligatoire que pour
  l''activation employé (executerActivationCarnet), seul point d''écriture
  sans aucune protection avant cette étape.';

create unique index if not exists fdj_stock_movements_idempotency_key_uniq
  on public.fdj_stock_movements (idempotency_key)
  where idempotency_key is not null;

-- Incrément atomique de fdj_shift_counts.appro — remplace le
-- lire-puis-écrire côté client (incrementerApproAutomatique), qui perdait un
-- incrément quand deux activations du même jeu/quart étaient concurrentes
-- (deux onglets, ou l'exception + l'activation normale). L'incrément se fait
-- désormais entièrement côté base, dans la même transaction que l'upsert.
create or replace function public.fdj_incrementer_appro_shift_count(
  p_site text,
  p_shift_id uuid,
  p_game_id uuid,
  p_delta numeric
) returns numeric
language plpgsql
security invoker
as $$
declare
  v_nouvel_appro numeric;
begin
  insert into public.fdj_shift_counts (site, shift_id, game_id, appro, updated_at)
  values (p_site, p_shift_id, p_game_id, p_delta, now())
  on conflict (shift_id, game_id) do update
    set appro = coalesce(public.fdj_shift_counts.appro, 0) + excluded.appro,
        updated_at = now()
  returning appro into v_nouvel_appro;
  return v_nouvel_appro;
end;
$$;

comment on function public.fdj_incrementer_appro_shift_count is
  'FDJ Fiabilisation Étape 5 : incrément atomique de fdj_shift_counts.appro
  pour une activation de carnet (Article 5 — ne jamais fabriquer/perdre une
  valeur par une race lire-puis-écrire côté client). security invoker : émis
  avec les droits de l''appelant, donc soumis aux mêmes policies RLS
  update_fdj_shift_counts/insert_fdj_shift_counts qu''un upsert classique —
  aucun contournement de la sécurité au niveau ligne.';
