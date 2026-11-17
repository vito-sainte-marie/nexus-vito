# Compte rendu : recette des accès authentifiés T2 sur Supabase Test

17/11/2026, 08 h 19 à 08 h 42 (heure de Martinique). Projet Supabase Test `udljdqxerrbbbajxubfn` uniquement.
Production et Decenium : aucune opération. Migrations T2 : aucun rejeu (4 enregistrées, dernière 20261117021059).

## Autorisations

| Heure | Autorisation |
| --- | --- |
| 08:12 | Aide à la création des comptes de recette dans Test |
| 08:23 | « GO script 40 sur Test pour les quatre comptes recette-t2 » |
| 08:25 | « go sur l'enchainement des preuves jusqu'à fin de recette » |
| 08:35 | « go reprise » (après l'incident de la phase 1) |

## Résultat

| Étape | Résultat | Preuve |
| --- | --- | --- |
| Identités | 4 identités dédiées créées par l'API d'administration depuis le poste de Frédéric, vérifiées dans Test | `preuves/00_identites_creees.json` |
| Script 40 | 4 comptes liés (3 gérants, 1 manager), comptes de test, aucun créateur | `preuves/01_script40.json` |
| Preuve SQL 50 | OK 16 / ECHEC 0, aucune écriture conservée | `preuves/02_preuve_sql_50.json` |
| Phase 1 | OK 17 / ECHEC 0 après reprise | `poste_pilote/http_phase1_20261117-083700.json` |
| Script 42 | Gérant bis désactivé, identité conservée | `preuves/04_reprise_et_script42.json` |
| Phase 2 | OK 6 / ECHEC 0 : le gérant bis, reconnecté, ne lit plus rien (0 ligne), n'écrit plus (403), n'annule plus (0 ligne) ; témoins inchangés | `poste_pilote/http_phase2_20261117-083912.json` |
| Phase 3 | OK 8 / ECHEC 0 : chacun annule ce qu'il a saisi | `poste_pilote/http_phase3_20261117-083912.json` |
| Scripts 41 et 45 | 4 comptes désactivés ; traçabilité conforme, correspondance archivée | `preuves/05_phases2_3_scripts41_45.json` |
| Bannissement | Vérification seule conforme, puis 4 identités bannies, reconnexion refusée (`user_banned`), aucune supprimée ; clé vérifiée : service_role du projet Test | `poste_pilote/bannissement_*_20261117-084139.json` |
| Contrôle final | 0 ligne T2 active, 10 lignes de recette annulées, 4 migrations T2 inchangées | `preuves/06_bannissement_et_controle_final.json` |

Ce que la phase 1 établit, par la vraie connexion Supabase Auth et l'API REST : gérant et manager écrivent ce que leur rôle permet (201) ;
manager refusé pour une famille et pour une exception validée, gérant refusé sur l'autre site (403, 42501) ; manager sans droit d'annuler
une ligne du gérant (0 ligne) ; chaque compte ne voit que son site ; accès anonyme refusé (401).

## Incident

La phase 1 a tourné deux fois. À 08:28, un collage dans le Terminal a laissé `read -s` lire une ligne du bloc ; les lignes suivantes se sont
exécutées et la phase 1 a écrit ses 5 lignes prévues, sans que sa sortie soit vue. À 08:32, la seconde exécution s'est arrêtée au premier cas
(P1-01, refus P0001 : une version active existait déjà) sans rien écrire, et son rapport a écrasé le premier (`poste_pilote/http_phase1.json`).
Traitement autorisé à 08:35 : phase 3 d'annulation (8/8), puis phase 1 propre (17/17). Conséquence : 10 lignes de recette annulées en base au
lieu de 5. Correctif de procédure : rapports à nom horodaté, saisie masquée des clés dans un collage séparé.

## Points résiduels

- 18 sessions des identités bannies restent inscrites dans Supabase Auth : connexion et renouvellement sont refusés ; les jetons déjà émis
  expirent dans l'heure et n'ouvrent aucun registre T2 (comptes désactivés, politique restrictive).
- Les mots de passe de recette restent dans le Trousseau de Frédéric (service `nexus-recette-t2`) ; ils ne servent plus. Suppression possible :
  `security delete-generic-password -s nexus-recette-t2 -a <identifiant>`, quatre fois.
- La clé anon public de Test a été collée dans la conversation : clé publique par nature, sans conséquence.
- Défaut transversal des comptes désactivés hors T2 : dossier de sécurité séparé, inchangé.
