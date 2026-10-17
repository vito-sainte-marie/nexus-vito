-- =====================================================================
-- 20261017130000 — Relevés piste : début Q1 et écart de nuit (TEST SEULEMENT)
--
-- Arbitrages du 17/10/2026 « Moments des relevés piste » et « Tolérance de
-- nuit ». Cette migration ne touche NI politique RLS, NI grant, NI
-- fonction : elle élargit un CHECK et ajoute des colonnes nullables.
--   • moment : ajoute `debut_q1` (comparé à la dernière fin Q2 validée).
--   • carburant_index_valeurs : référence affichée au début de quart
--     (valeur validée du quart précédent + manière dont le pompiste l'a
--     confirmée) et classement de l'écart de nuit, compteur par compteur.
-- Les anomalies ne bloquent rien : elles sont écrites avec la valeur, donc
-- avec l'auteur et l'horodatage (`cree_le`) du relevé, et lisibles par la
-- RLS de lecture existante (site).
-- =====================================================================
begin;

alter table public.carburant_index_releves
  drop constraint carburant_index_releves_moment_check;
alter table public.carburant_index_releves
  add constraint carburant_index_releves_moment_check
  check (moment = any (array['debut_q1','fin_q1','debut_q2','fin_q2']));

alter table public.carburant_index_valeurs
  add column if not exists ref_valeur_sept text
    check (ref_valeur_sept is null or ref_valeur_sept ~ '^[0-9]{7}$'),
  add column if not exists ref_statut text
    check (ref_statut is null or ref_statut in ('confirmee_deux_chiffres','saisie_complete','indisponible')),
  add column if not exists ecart_nuit integer,
  add column if not exists anomalie_nuit text
    check (anomalie_nuit is null or anomalie_nuit in ('conforme','toleree','a_justifier','alerte_prioritaire','diminution'));

do $ctrl$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'carburant_index_releves_moment_check'
                    and pg_get_constraintdef(oid) like '%debut_q1%') then
    raise exception 'CHECK moment sans debut_q1';
  end if;
  if (select count(*) from information_schema.columns
       where table_name = 'carburant_index_valeurs'
         and column_name in ('ref_valeur_sept','ref_statut','ecart_nuit','anomalie_nuit')) <> 4 then
    raise exception 'colonnes d''écart de nuit absentes';
  end if;
end
$ctrl$;
commit;
