-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260810023913 · coach_fdj_view_employee_price_tier
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Coach x FDJ Pilotage — Phase 1, étape "brancher les données" (09/08/2026).
-- Manque identifié : aucune vue Phase B n'a la dimension employé pour les
-- paliers de prix (view_fdj_price_tier_daily est site-wide). La règle
-- fdj_palier_sous_represente compare la répartition par palier d'un
-- employé à celle du site — même filtre exact que
-- view_fdj_game_daily_ventes (statut_caisse <> 'provisoire', ventes_qte
-- connu), simple ajout de la dimension employee_id + palier, aucune
-- formule métier nouvelle (Article 11).
create view public.view_fdj_employee_price_tier_daily as
select s.site, s.date, s.employee_id, g.prix as palier,
  sum(sc.ventes_qte) as tickets_vendus, sum(sc.ventes_valeur) as ca
from public.fdj_shift_counts sc
join public.fdj_shifts s on s.id = sc.shift_id
join public.fdj_cash_controls cc on cc.shift_id = s.id and cc.statut <> 'provisoire'
join public.fdj_games g on g.id = sc.game_id
where sc.ventes_qte is not null and s.employee_id is not null
group by s.site, s.date, s.employee_id, g.prix;

comment on view public.view_fdj_employee_price_tier_daily is 'Coach x FDJ Pilotage — jour × employé × palier de prix, même filtre que view_fdj_game_daily_ventes (quarts contrôlés uniquement) avec la dimension employé en plus. Alimente la règle fdj_palier_sous_represente.';
