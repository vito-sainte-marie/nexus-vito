# Recette fonctionnelle du moteur tarifaire T2 sur Supabase Test (préparée, NON LANCÉE)

Objet : établir sur le véritable environnement Test ce que la recette des accès n'a pas couvert :
1. le chargement des règles commerciales T1 (arbitrages du 16/11/2026) dans les registres de vito-sainte-marie ;
2. leur relecture par l'adaptateur ;
3. la comparaison des 440 références avec T1 v2 (statut, fiabilité, conformité, alertes, simulations, gains).
Projet Supabase Test uniquement. Production, Decenium : aucune opération. Migrations : aucun rejeu.

## Déroulé

| Étape | Qui | Écriture sur Test | Contenu |
| --- | --- | --- | --- |
| 0 | Frédéric, Terminal | Authentication (1 identité) | Création de `recette-t2-chargement-sm@vito-nexus.local`, mot de passe généré et rangé dans le Trousseau |
| 1 | Claude, script 60 | `employees` (1 ligne) | Liaison : gérant vito-sainte-marie, compte de test, non créateur ; refus si déjà lié |
| 2 | Claude, données de recette | registres T2 (130 lignes) | 24 familles, 51 rattachements (34 par référence), 13 seuils, 4 réglages, 13 exceptions, 21 prix décidés, 1 régime, 3 contrôles. Garde projet Test, saisie sous RLS au nom du compte de chargement, en une transaction |
| 3 | Claude, export 61 | aucune | Lecture des versions actives et des exceptions effectives de vito-sainte-marie (une requête SELECT) |
| 4 | Claude, comparaison | aucune | Adaptateur puis moteur T1 v2 sur les ventes et le stock de T1 ; comparaison des 440 références et des gains |
| 5 | Claude, script 62 | `employees` (1 ligne) | Désactivation du compte de chargement |
| 6 | Frédéric, Terminal | Authentication | Bannissement par l'API d'administration : `bannir_identites_recette.mjs --lot chargement` |

Arrêt au premier écart. Le chargement est atomique : en cas d'erreur, rien n'est écrit ; rejoué, il est refusé en bloc (une seule version
active par clé). Les lignes de la recette des accès sont toutes annulées et n'entrent pas dans l'export.

## Critère de réussite

`comparer_registres_test.js` répond CONFORME : export venant du projet Test, registres complets (comptes attendus ci-dessus),
440 références identiques à T1 v2, gains, statuts et alertes identiques, aucun écart.

## Répétition locale (contrôles 195 à 207)

Socle de Test, quatre migrations, chargement sous RLS, export, adaptateur, moteur : CONFORME, 440/440, gains identiques. Sensibilité : un seuil
Confiserie modifié dans les registres fait apparaître 73 références en écart. Compte de chargement : rejeu du script 60 refusé, chargement
rejoué refusé en bloc, plus aucun chargement possible après désactivation ; avec le vrai Supabase Auth, bannissement du lot « chargement »
refusé tant que le compte est actif, puis conforme. Recette locale complète : 207 OK, 0 échec, stable sur deux passages.

## Décisions à prendre

1. Autorisation d'exécuter les étapes 0 à 6 sur Test.
2. Devenir des 130 lignes chargées après la recette : les conserver actives dans Test comme jeu de référence pour les écrans T3 (recommandé),
   ou les annuler en fin de recette (elles resteraient en base, annulées).

## Limites

- La lecture de l'étape 3 se fait par le rôle postgres (sans RLS), filtrée sur le site ; la lecture sous RLS a été prouvée par la recette des accès.
- Les ventes et le stock restent ceux des exports Decenium de T1 (fichiers), comme en T1 : la recette porte sur les règles lues dans Test.
