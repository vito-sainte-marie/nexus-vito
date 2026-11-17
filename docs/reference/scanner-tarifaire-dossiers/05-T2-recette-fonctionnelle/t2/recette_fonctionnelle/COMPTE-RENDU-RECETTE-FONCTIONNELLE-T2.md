# Compte rendu : recette fonctionnelle du moteur tarifaire T2 sur Supabase Test

17/11/2026, 10 h 02 à 10 h 24 (heure de Martinique). Autorisation : « GO recette fonctionnelle T2 sur Test, étapes 0 à 6 » (10 h 02).
Projet Supabase Test uniquement. Production et Decenium : aucune opération. Migrations T2 : aucun rejeu.

| Étape | Résultat |
| --- | --- |
| 0. Identité de chargement | Créée par le gérant depuis son Terminal (HTTP 200), vérifiée dans Test |
| 1. Script 60 | Compte de chargement lié : gérant vito-sainte-marie, compte de test, non créateur |
| 2. Chargement des règles T1 | 130 lignes sous RLS, toutes par le compte de chargement, aucun autre site touché |
| 3. Export 61 | Registres actifs de vito-sainte-marie relus dans Test (export horodaté 14:17:57 UTC, projet Test vérifié) |
| 4. Adaptateur, moteur, comparaison | CONFORME : 440/440 références identiques à T1 v2 ; gains, statuts et alertes identiques ; 0 écart |
| 5. Script 62 | Compte de chargement désactivé, 130 lignes conservées actives |
| 6. Bannissement | Vérification seule conforme ; identité bannie, reconnexion refusée ; aucune suppression |
| Contrôle final | 5 comptes de recette désactivés et bannis ; 130 lignes actives sur vito-sainte-marie, 0 sur les autres sites ; 0 incohérence ; 4 migrations T2 inchangées ; « Manager test » intact |

Conclusion : les règles commerciales T1 chargées dans les registres de Test, relues par l'adaptateur, produisent exactement le résultat
de T1 v2 sur les 440 références de Sainte-Marie. Aucun incident.

Décision en attente (gérant) : maintien actif des 130 lignes comme jeu de référence de Test pour les écrans T3, ou annulation.
Limites : les ventes et le stock sont ceux des exports Decenium de T1 (fichiers) ; la relecture de l'étape 3 s'est faite par le rôle postgres,
filtrée sur le site (la lecture sous RLS est prouvée par la recette des accès).
