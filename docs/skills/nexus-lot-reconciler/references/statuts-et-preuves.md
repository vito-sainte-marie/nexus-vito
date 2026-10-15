# Statuts, preuves et codes d'anomalie

## Statut déclaré et statut constaté

Le **statut déclaré** est celui de `docs/handoff/STATE.json`. Au 14/10/2026, il ne prend en pratique que deux valeurs (`DECISION_CONSOMMEE`, `ATTENTE_DECISION`) : il dit que la dernière décision a été lue, pas que le lot est livré. Consommer une décision, c'est la prendre en charge, pas l'avoir exécutée.

Le **statut constaté** est celui que le skill établit à partir des preuves :

| Statut constaté | Sens | Preuve minimale |
| --- | --- | --- |
| `ATTENTE_DECISION` | une demande n'a reçu aucune décision en réponse (`in_reply_to`) | fichiers du lot |
| `ATTENTE_AUTORISATION` | la suite requiert une capacité sensible et attend Frédéric | contrat de la dernière décision |
| `EN_COURS` | la dernière décision demande une suite (`CLOSES:false`, ou `CLOSES:true` avec une action réelle) | contrat ou frontmatter |
| `CLOS_DECLARE` | l'arbitre a clos le lot, sans action restante (ou action de pure matérialisation) | contrat |
| `LIVRE_TEST` | le résultat fonctionne en Test | niveau B au moins, preuve Test |
| `DEPLOYE_PRODUCTION` | le résultat est servi en Production | niveau A, preuve Production |
| `CLOS_PROUVE` | clos et critères d'acceptation prouvés | niveau A |
| `REMPLACE` | supplanté par un autre lot ou une PR qui couvre tous ses critères | `evaluerRemplacement` |
| `ABANDONNE` | abandon décidé et tracé | décision explicite |
| `INDETERMINE` | les sources ne permettent pas de conclure | niveau D |

Le registre brut ne s'appuie que sur le Handoff : il ne va pas au-delà de `CLOS_DECLARE`. `LIVRE_TEST`, `DEPLOYE_PRODUCTION` et `CLOS_PROUVE` demandent l'audit d'un domaine.

## Écarts (section 5 du cahier des charges)

Les catégories d'anomalie décrivent l'écart entre déclaré et constaté : fantôme (en attente mais atteint et prouvé), doublon, remplacé, partiel (reliquat explicite), bloqué (blocage exact nommé), orphelin (branche ou PR sans demande), déployé non clos, clos à tort, obsolète (démontré, jamais supposé).

## Niveaux de preuve

| Niveau | Sens |
| --- | --- |
| A | code, tests, intégration, environnement cible et critères d'acceptation cohérents |
| B | développement et tests vérifiés ; validation fonctionnelle ou déploiement à confirmer |
| C | une PR, un commentaire ou un rapport affirme que c'est fini, sans preuve suffisante |
| D | sources insuffisantes ou inaccessibles |

Le niveau A s'évalue sur l'objectif réel du lot : pour un lot de conception, la Production n'est pas un critère. Un niveau A n'autorise jamais à lui seul un geste Production.

## Codes d'anomalie du script

Chaque anomalie porte une **portée** : `a_traiter`, `historique` (fichier antérieur à la règle, ou lot clos) ou `info`.

| Code | Contrôle | Règle datée |
| --- | --- | --- |
| H02_DECISION_NON_CONSOMMEE | `STATE.json` ne pointe pas la dernière décision du dossier | |
| H03_CONTRAT_ABSENT | dernière décision sans `NEXT_ACTION_CONTRACT` | 08/10/2026 |
| H04_EXECUTANT_HORS_REGISTRE | `EXECUTANT_NEXT` absent de `CAPACITES-CANAL.json` | registre fermé le 14/10/2026 |
| H05_CAPACITE_HORS_REGISTRE | `CAPACITE_REQUISE` absente du registre | idem |
| H06_CLOTURE_AVEC_ACTION | `CLOSES:true` avec une action réelle ; `H06_CLOTURE_MATERIALISATION` (info) si l'action ne fait que matérialiser | |
| H07_REARBITRAGE | plusieurs décisions pour une même demande | |
| H08_DOSSIER_SANS_REGISTRE | dossier de lot sans entrée `STATE.json`, hors `artefacts_hors_registre` (lu dans `STATE.json`) | |
| H09_REGISTRE_SANS_DOSSIER | entrée `STATE.json` sans dossier (hors legacy v1) | |
| H10_CONSOMMEE_MAIS_DEMANDE_EN_VOL | `DECISION_CONSOMMEE` alors qu'une demande attend une décision | |
| H11_SUITE_SANS_ACTION | `CLOSES:false` sans `ACTION_NEXT` | |
| H12_CONDITIONS_SANS_SECTION_DE_PREUVE | demande après `APPROVED_WITH_CONDITIONS` sans « ## Preuve des conditions de decision-N » | 10/10/2026 |
| H13_LOT_ACTIF_SANS_DOSSIER | `lot_actif` ne correspond à aucun dossier | |
| H14_DEMANDES_SANS_REPONSE_DEPASSEES | demandes jamais arbitrées, dépassées par une demande plus récente arbitrée (info) | |

Pièges déjà rencontrés : les décisions ont leur propre numérotation (decision-8 peut répondre à request-13) ; un historique git tronqué donne de fausses dates ; une branche intégrée au rail par copie ou avance rapide n'a pas de PR fusionnée.
