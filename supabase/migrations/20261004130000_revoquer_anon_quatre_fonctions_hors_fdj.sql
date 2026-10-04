-- Lot sécurité anon5 — fermer anon sur quatre fonctions hors FDJ (04/10/2026).
--
-- L'audit de la garde revoke (bb10c7c) a relevé cinq fonctions hors FDJ
-- exécutables par `anon` en Production. Mesuré le 04/10/2026 en lecture seule
-- sur uzhjpqpctpvxytxpxoqz : les cinq sont SECURITY DEFINER, propriété de
-- postgres, avec l'ACL
--   {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}.
-- Les corps et les ACL sont identiques sur nexus-test (md5 de prosrc égaux).
--
-- Cause commune : un `revoke ... from public` seul (ou, pour stats_fondateur,
-- un `GRANT ALL TO anon` explicite de la baseline). Supabase accorde EXECUTE à
-- `anon` et à `authenticated` par des grants nommés qu'un revoke from public
-- ne retire pas.
--
-- 1. _generate_inventory_review_core(text,date,date,text) — AUCUN contrôle
--    d'autorisation : elle calcule les agrégats d'inventaire de n'importe
--    quel `p_site`. Ouverte à anon et à tout authenticated, c'est une lecture
--    inter-site. Ses seuls appelants sont generate_inventory_review() et
--    run_scheduled_inventory_reviews(), toutes deux SECURITY DEFINER
--    propriété de postgres, et le cron `nexus-inventaire-reviews` (postgres).
--    Aucun écran ne l'appelle. Fermée à anon ET à authenticated.
-- 2. generate_inventory_review(text,date,date,text) — refuse hors manager ou
--    gérant du site. RPC des écrans Inventaire Manager et Rapport Direction,
--    en session authentifiée. Fermée à anon.
-- 3. inventaire_enregistrer_transfert_localise(...) — AUTH_REQUISE si
--    auth.uid() est nul, puis contrôle de site et de rôle. RPC de l'écran de
--    transfert de stock. Fermée à anon.
-- 4. stats_fondateur() — refuse hors créateur. RPC de NEXUS-Admin-Sites.
--    Fermée à anon.
--
-- NON MODIFIÉE : nexus_identifiant_de_connexion(text). L'écran de connexion
-- l'appelle AVANT toute authentification ; son grant anon est explicite et
-- voulu (20260904175747_login_non_enumerable).
--
-- Strictement additive : aucune fonction n'est recréée ni supprimée, aucune
-- migration historique n'est modifiée. service_role est conservé partout.
--
-- Garde : test_securite_anon_quatre_fonctions_20261004.js.

-- nexus-acl-intention: public.generate_inventory_review(text,date,date,text) garde authenticated (RPC des écrans Inventaire Manager et Rapport Direction, contrôle manager ou gérant du site dans le corps)
-- nexus-acl-intention: public.inventaire_enregistrer_transfert_localise(text,uuid,uuid,uuid,uuid,numeric,text,numeric,numeric,text) garde authenticated (RPC de l'écran de transfert de stock, AUTH_REQUISE puis contrôle de site et de rôle dans le corps)
-- nexus-acl-intention: public.stats_fondateur() garde authenticated (RPC de NEXUS-Admin-Sites, refus hors créateur dans le corps)

revoke all on function public._generate_inventory_review_core(text, date, date, text) from public;
revoke all on function public._generate_inventory_review_core(text, date, date, text) from anon;
revoke all on function public._generate_inventory_review_core(text, date, date, text) from authenticated;
grant execute on function public._generate_inventory_review_core(text, date, date, text) to service_role;

revoke all on function public.generate_inventory_review(text, date, date, text) from public;
revoke all on function public.generate_inventory_review(text, date, date, text) from anon;
grant execute on function public.generate_inventory_review(text, date, date, text) to authenticated;
grant execute on function public.generate_inventory_review(text, date, date, text) to service_role;

revoke all on function public.inventaire_enregistrer_transfert_localise(text, uuid, uuid, uuid, uuid, numeric, text, numeric, numeric, text) from public;
revoke all on function public.inventaire_enregistrer_transfert_localise(text, uuid, uuid, uuid, uuid, numeric, text, numeric, numeric, text) from anon;
grant execute on function public.inventaire_enregistrer_transfert_localise(text, uuid, uuid, uuid, uuid, numeric, text, numeric, numeric, text) to authenticated;
grant execute on function public.inventaire_enregistrer_transfert_localise(text, uuid, uuid, uuid, uuid, numeric, text, numeric, numeric, text) to service_role;

revoke all on function public.stats_fondateur() from public;
revoke all on function public.stats_fondateur() from anon;
grant execute on function public.stats_fondateur() to authenticated;
grant execute on function public.stats_fondateur() to service_role;
