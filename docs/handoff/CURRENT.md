<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-HEURES-VERIFY-PAYE-1-20261009/request-13.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-HEURES-VERIFY-PAYE-1-20261009
seq: 13
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=c516322 production=b4ebdcd
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 147-fichiers
---
# Clôture du lot — Q2 arbitrée, PR #107 fusionnée, déployée et recettée en Production

Ce texte se suffit. Demande de verdict de clôture ; elle n'autorise aucun geste supplémentaire.

## Arbitrage de Frédéric : Q2, mois déjà validés

Relayé par Frédéric le 13/10/2026 : **aucun mois clos n'est recalculé.**

- Un changement de règle ne réécrit jamais un mois déjà validé. Le dossier comptable PDF reste régénéré depuis l'instantané figé à la validation du mois.
- Cela confirme la proposition de `request-1.md` (Q2) et clôt la question laissée ouverte par `decision-1.md`.
- Aucun recalcul à la demande n'est ouvert. Si un recalcul devenait nécessaire un jour, ce serait un nouveau lot, avec la condition 5 de la decision-1 (règles de clôture et effets sur les rapports existants) et un GO Production distinct.
- Mesuré : #105 et #107 n'écrivent aucun mois validé et ne rouvrent rien. Octobre 2026 est « en préparation », donc non validé. Les règles du lot ne valent qu'à partir du 01/10/2026 (`renfort_effectif_depuis`). Les mois validés antérieurs n'ont pas été relus.

## Mise en œuvre de #107, conditions de la decision-7

| Condition | État |
|---|---|
| 1. Regrouper Q4 | faite : une synthèse par salarié et par période, sans quantité ni heure, `impactPaye false` |
| 2. Refuser B si l'historique est illisible, épreuves successives et concurrentes | faite : « Historique illisible : modification refusée » ; conflit détecté par `modifie_le` ou 23505 |
| 3. Recette navigateur Q4 sur Test | faite sur l'aperçu `ec69152` : Employé Test B, 7 h conservées, information non bloquante, aucune absence ni retenue, aucun dossier bloqué par Q4 (les 17 points du dossier = 11 présences d'Employé Test A hors planning + 6 paramétrages de rattachement) |
| 4. B présenté comme compris dans les heures retenues | faite : « Dont heures exceptionnelles (saisies par le manager) », tuile « Autres heures exceptionnelles » supprimée |
| 5. CI et intégration sur la tête de `production` | CI verte sur `ec69152`, 0 commit de retard au moment de la fusion |

## GO nominatifs de Frédéric

- Fusion de #107 : donnée le 13/10/2026. Merge commit `b4ebdcd3ea6e6199c223e038d435a50c86c37367` sur `production`. « Tests » vert sur ce commit.
- Déploiement Pages : donné le 13/10/2026. Workflow « Déploiement Production (GitHub Pages) » terminé en succès sur `b4ebdcd`.

## Recette Production, lecture seule (13/10/2026)

URL `https://app.nexusconseil.net/NEXUS-Paye-v1`, Octobre 2026, session connectée. Contenu servi contrôlé avec un paramètre anti-cache : `regrouperPlanningNonRenseigne` dans `nexus-paye-moteur.js`, « Historique illisible » dans `nexus-paye-donnees.js`, « Dont heures exceptionnelles » dans l'écran, ancienne tuile absente. La page de Production n'affiche pas de numéro de commit.

- Angelique (renfort) : 06/10 renfort 7 h, 0 h sup ; jeudi→samedi 8 h de présence (7 h + 1 h sup) ; autres jours 7 h. Total 63 h normales + 4 h sup = 67 h, sans double comptage. Aucune anomalie, aucune absence ni retenue automatique. Heures exceptionnelles : 0.
- **Non exercés en Production** : le cas Q4 (aucun salarié n'a de jour « présence confirmée, planning non renseigné » aujourd'hui) et B (aucune heure exceptionnelle saisie, aucune créée pour la recette). Q4 et B ne sont donc prouvés que par la recette Test et les épreuves.
- Aucune saisie, validation ni écriture n'a été faite.

## Statut réel de Production

- Code : #105, #106 et #107 fusionnés et déployés. `production` est à `b4ebdcd`.
- Aucune migration ni écriture Supabase Production n'a eu lieu pour #107. Les colonnes nécessaires étaient déjà posées.
- Reste dans la base Test, jamais en Production : une ligne `horaire_exceptionnel` de recette (7,5 h, 13/10).
- Limites : suite complète locale non lancée pour #107 ; l'historique des heures exceptionnelles n'a été constaté qu'en base, pas à l'écran.

## Geste demandé

Verdict de clôture du lot `NEXUS-HEURES-VERIFY-PAYE-1-20261009` : Q2, Q4 et B sont arbitrées et mises en œuvre. Aucune autre décision n'est ouverte à ma connaissance. Rien n'est fusionné ni déployé par cette demande.
