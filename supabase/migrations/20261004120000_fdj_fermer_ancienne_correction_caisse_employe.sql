-- FDJ Vague 1 — fermer l'ancienne porte de correction employé (04/10/2026).
--
-- La Vague 1 (20260916220600) remplace fdj_corriger_caisse_employe() par
-- fdj_corriger_caisse_confirmee(), qui refuse une caisse validée
-- (`caisse_validee`). Mais elle laissait l'ancienne exécutable : sa seule
-- révocation, en 20260901225945, vise PUBLIC, et Supabase accorde EXECUTE à
-- `anon` et à `authenticated` par des grants nommés qu'un revoke from public
-- ne retire pas.
--
-- Mesuré sur nexus-test le 03/10/2026 (recette serveur de decision-2, en
-- transaction annulée) : un employé appelant l'ancienne fonction APRÈS la
-- validation du manager
--   - dévalidait la caisse (statut `provisoire`, valide_par conservé) ;
--   - écrasait motif_ecart_texte, le motif interne du manager ;
--   - et continuait de lire `validee` dans fdj_ma_caisse.
-- C'est exactement le défaut que la vague annonce fermer (§5.1 du dossier).
--
-- Aucun écran ne l'appelle (git grep sur *.js et *.html à 9ffee7e) : la
-- fermer ne casse rien de servi. La fonction n'est pas supprimée, pour que la
-- migration reste strictement additive et sans effet sur une dépendance non
-- inventoriée. service_role la garde pour un usage d'administration.
--
-- Garde : test_fdj_ancienne_correction_fermee_20261004.js.

revoke all on function public.fdj_corriger_caisse_employe(uuid, numeric, text, text) from public;
revoke all on function public.fdj_corriger_caisse_employe(uuid, numeric, text, text) from anon;
revoke all on function public.fdj_corriger_caisse_employe(uuid, numeric, text, text) from authenticated;
grant execute on function public.fdj_corriger_caisse_employe(uuid, numeric, text, text) to service_role;
