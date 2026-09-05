# NEXUS Handoff — DECISION

LOT_ID: S-4-LECTEURS-SERVICE-COURANT-20260905
DECISION: APPROVED_CLOSED
AUTHOR: ChatGPT
BRANCH: config-par-environnement

## Décision

S-4 est **fermé**.

Les preuves produites démontrent que la définition du service courant est désormais unifiée et que les anciennes heuristiques dangereuses ont été retirées du chemin de décision. Les lecteurs qui consomment un service actif passent par la primitive commune `nexusServiceCourant(employee)`, fondée sur `employee_id + site_id + statut = 'en_cours'`, sans fallback temporel ou historique.

Le commit de référence déclaré pour S-4 est `ca9cf92`, génération `020995cd6b06`, `coherent = true`, CI verte, avec uniquement les 9 échecs historiques connus.

## Arbitrages

### Q4 — preuves navigateur RLS restantes

Décision : **option (c) pour fermer S-4, avec obligation (a) avant fermeture du bloqueur 1**.

Les preuves 9 et 10 de la décision précédente validaient surtout le comportement transactionnel de S-2/S-3 sous une vraie session employé. Elles ne remettent pas en cause la correction des lecteurs de S-4, déjà démontrée par les preuves de lecture, d'isolation et de redirection.

Elles ne sont cependant **pas abandonnées**. Avant de fermer le bloqueur 1 « cycle de vie et traçabilité des services », il faudra obligatoirement effectuer un rejeu réel sous session **Employé Test A** (ou autre compte test équivalent non déjà consommé ce jour) :

1. prise de poste réelle ;
2. pointage arrivée si requis par le parcours ;
3. départ réel avec preuve/photo selon le flux normal ;
4. vérification que S-2 ferme le shift sous RLS réel ;
5. vérification qu'aucun service courant ne subsiste après départ ;
6. nouvelle prise de poste réelle pour exercer S-3 ;
7. contrôle de cohérence pointage/shift et absence de refus silencieux ;
8. confirmation que les branches `ROW_COUNT` ne laissent jamais une écriture partielle incohérente.

Cette preuve est déplacée à la **gate de fermeture du bloqueur 1**, après S-5, afin de rejouer le parcours complet une seule fois.

### Q5 — artefact « retard 558 min »

Décision : **consigner comme dette, ne pas corriger dans S-4**.

La valeur provient d'une donnée historique figée avant l'assainissement S-1 et n'est pas recalculée ensuite par conception. Elle ne constitue pas une régression S-4 et ne doit pas élargir le bloqueur actuel.

Créer/maintenir une dette explicite du type :

`A18 — cohérence des données historiques de pointage / heure_debut_quart héritées avant assainissement des shifts`

Cette dette devra préciser qu'aucune correction rétroactive ne doit être appliquée sans règle métier validée, afin de ne pas réécrire artificiellement l'historique.

## Conditions de clôture S-4

Considérées comme satisfaites :

- primitive commune créée ;
- filtre `employee_id + site_id + statut='en_cours'` ;
- suppression de la fenêtre 24 h comme définition du service courant ;
- suppression des bornes journalières du chemin de décision du service courant ;
- `nexus-auth` aligné sur le vrai service actif ;
- `Missions:397` conservé uniquement comme historique comparable et explicitement nommé ;
- aucun fallback vers un shift clos ;
- anomalie multi-`en_cours` signalée techniquement ;
- isolation inter-site prouvée ;
- aucune écriture production ;
- `main` et `production` inchangés.

## Interdictions

- Ne jamais modifier `main` ou `production` sans autorisation humaine explicite.
- Ne jamais interpréter cette décision comme une autorisation de production.
- Ne pas supprimer l'obligation de rejeu RLS réel avant fermeture du bloqueur 1.
- Ne pas corriger rétroactivement l'artefact « retard 558 min » dans ce lot.
- Ne pas rouvrir les dettes A17 latérales dans S-5.

## Prochaine gate

Claude peut maintenant commencer **S-5** : écrire le véritable `shift_id` NEXUS dans `inventaire_quart_employes` là où le contrat métier l'exige.

Important : les 13 colonnes `shift_id` FDJ restent hors périmètre S-5 car elles réfèrent au concept distinct `fdj_shifts`. `audits_caisse` reste également hors périmètre, puisqu'il n'a pas de colonne `shift_id`.

Avant d'écrire S-5, faire le diagnostic ciblé des chemins d'écriture `inventaire_quart_employes` et proposer le contrat exact dans `docs/handoff/CURRENT.md` avec un **nouveau LOT_ID S-5**, puis attendre arbitrage.

## Règle de consommation

Claude ne doit consommer cette décision que si le `LOT_ID` correspond exactement à celui de `docs/handoff/CURRENT.md`.
