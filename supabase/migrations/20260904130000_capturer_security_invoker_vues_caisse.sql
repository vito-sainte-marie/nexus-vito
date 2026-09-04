-- Capturer une dérive de production jamais tracée (04/09/2026).
--
-- Découverte en comparant, définition par définition, la production à la
-- base reconstruite : `v_caisse_ecart_non_justifie` et
-- `v_caisse_ecart_recurrent` sont en `security_invoker = true` en
-- production, mais en `security definer` dans toute base rebâtie depuis les
-- migrations. Les définitions SQL, elles, sont rigoureusement identiques
-- (même empreinte MD5) : seule l'option de sécurité diffère.
--
-- Autrement dit, quelqu'un a resserré ces deux vues directement en base
-- sans jamais l'inscrire dans une migration. La production était donc PLUS
-- sûre que le dépôt — et un environnement reconstruit depuis le dépôt
-- aurait silencieusement régressé sur deux vues d'écarts de caisse.
--
-- C'est exactement le type de dérive que la nouvelle règle interdit : toute
-- modification permanente faite par SQL direct doit devenir une migration
-- versionnée. On la capture ici plutôt que de la laisser vivre hors du
-- dépôt.
--
-- Idempotente : `alter view ... set` est sans effet si l'option est déjà
-- posée.

alter view public.v_caisse_ecart_non_justifie set (security_invoker = true);
alter view public.v_caisse_ecart_recurrent    set (security_invoker = true);
