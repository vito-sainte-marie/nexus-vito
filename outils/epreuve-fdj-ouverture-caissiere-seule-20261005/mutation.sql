-- Contre-témoin : on restaure la fonction de 20260916220500 (liste noire
-- « manager » seule, celle de l'incident) puis on rejoue les scénarios.
-- Attendu : P, R, V, I et K rougissent ; M, C et ACL restent verts.
\i /mig/20260916220500_fdj_commande_ouverture_quart.sql
\i scenarios.sql
