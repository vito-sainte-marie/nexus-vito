-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260809190458 · enrichir_fdj_stock_movements_shift_et_methode
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- 09/08/2026, demande de Frédéric : "Carnet ouvert" ne doit plus être un
-- simple compteur de session — chaque mouvement doit pouvoir être
-- reconstruit : "ce carnet a été ouvert pendant le quart X par Y depuis le
-- stock qui lui avait été confié". On rattache donc le mouvement au quart
-- (shift_id) et on trace comment le carnet a été identifié.
alter table public.fdj_stock_movements
  add column shift_id uuid references public.fdj_shifts(id),
  add column methode_identification text not null default 'quantite'
    check (methode_identification in ('quantite', 'scan', 'saisie_manuelle'));

comment on column public.fdj_stock_movements.shift_id is
  'Quart FDJ pendant lequel le mouvement a eu lieu — permet de reconstruire "ce carnet a été ouvert pendant le quart X par Y". Nullable : les mouvements hors quart (réception fournisseur, transfert manager, etc.) n''en ont pas forcément.';
comment on column public.fdj_stock_movements.methode_identification is
  'Comment le mouvement a été identifié : quantite = simple comptage sans identité de carnet (V1, bouton "+ Carnet") ; scan = code-barres/QR lu (V2) ; saisie_manuelle = numéro de carnet tapé à la main (V2).';

create index if not exists idx_fdj_stock_movements_shift_id on public.fdj_stock_movements(shift_id);
