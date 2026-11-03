<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/INVENTAIRE-CAISSE-RENFORT-20261102/request-14.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: INVENTAIRE-CAISSE-RENFORT-20261102
seq: 14
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=659af077 production=5751a9b0
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 174-fichiers
---
# INVENTAIRE-CAISSE-RENFORT-20261102 : request-14 — clôture serveur : population C1, `shifts.quart` fait foi, traitement des 5 lignes divergentes

## Branche du lot

BRANCHE_DU_LOT: handoff-continuite-20260920

## Objet

Levée du blocage `DECISION_METIER_NON_ARBITREE` de request-13 (run 41705565737). Frédéric a tranché le 03/11 à 18:13 (commentaire Guardian 6616736762 sur #160). Cette request reprend sa décision, fixe la règle qui en découle et montre, sur Test en lecture seule, comment les 5 lignes divergentes sont traitées. Aucune écriture, aucune migration à ce stade, rien en Production. `closes: false`.

## Décision de Frédéric, citée telle quelle

> « Je confirme le choix 1. Normalement ils sont en droit de clôturer ; pour l'instant ce n'est pas le cas car ils utilisent le papier et l'inventaire n'est pas encore au point. »

Le choix 1 est C1 de request-13. Frédéric n'a exprimé aucune préférence sur le rattachement en cas de divergence. Guardian retient `shifts.quart` (la prise de poste), en cohérence avec sa décision du 03/11 à 12:49 : « la caissière ou le pompiste clôture soit le quart 1 ou 2 en fonction de leurs prises de poste ».

## Règle proposée (A–F de request-11 inchangées)

1. **Population = C1.** Les personnes qui ont compté sur le quart : les lignes `inventaire_quart_employes` du quart. Le quart se clôture dès que toutes ont `a_valide_cloture = true` ; `cloture_le` = la dernière `heure_depart`. Manager, renfort ou caissière sans ligne ne bloquent rien et n'ont rien à clôturer. Population vide : pas de clôture anticipée.
2. **Repli horaire.** Si une personne qui a compté ne clôture pas : clôture automatique à la fin prévue + `closureDelayMinutes` (30 par défaut), `cloture_le` = fin prévue + délai exactement (condition F), avec l'alerte existante pour ses produits non comptés.
3. **Rattachement.** `shifts.quart` fait foi. Une ligne n'entre dans la population d'un quart que si le `quart` de son shift est celui du quart d'inventaire. Aucune donnée n'est déplacée ni modifiée : la règle est une condition de lecture dans la fonction.
4. Le cron ignore tout quart déjà clôturé (B) ; filtrage par site sur chaque lecture et mutation (D) ; garde de statut et unicité de l'alerte conservées (E). Aucune policy, aucun grant, aucune fonction employé.

## Les 5 lignes divergentes sur Test (lecture seule)

Toutes concernent un shift pompiste `quart = matin` rattaché à un quart d'inventaire `soir`. Aucune n'a `a_valide_cloture` ni `heure_depart`.

| Date | Quart `soir` (statut) | Lignes dans ce quart | Shift (statut) | Quart `matin` du jour |
|---|---|---|---|---|
| 18/09 | ouverture_en_cours | 1 | termine | aucun |
| 21/10 | ouvert | 3 | clos_sans_pointage | ouvert |
| 31/10 | ouverture_en_cours | 1 | clos_sans_pointage | ouvert |
| 01/11 | ouvert | 1 | clos_sans_pointage | cloture |
| 02/11 | ouvert | 1 | clos_sans_pointage | cloture |

Effet de la règle `shifts.quart` fait foi :
- **Quart `soir`.** La ligne divergente sort de la population. 21/10 : 2 lignes restent. 18/09, 31/10, 01/11, 02/11 : population vide, donc aucune clôture anticipée, seul le repli horaire joue. Sans la règle, la ligne non validée de ces quarts les aurait bloqués jusqu'au repli, ce qui revient au même résultat ; la différence est qu'elle ne peut pas empêcher la clôture anticipée du 21/10.
- **Quart `matin`.** La ligne n'est pas comptée non plus (le shift est `matin` mais sa ligne pointe sur un autre quart : la règle ne lit que les lignes du quart considéré). Les quarts matin du 01/11 et du 02/11 sont déjà clôturés, donc ignorés par le cron ; ceux du 21/10 et du 31/10 sont `ouvert` et ne sont pas bloqués par ces lignes.
- **Visibilité.** La fonction compte les lignes divergentes et les consigne dans le résultat de la tâche, sans alerte employé ni écran, pour que la donnée ne reste pas invisible.
- Les 5 shifts sont d'anciens pointages (4 `clos_sans_pointage`, 1 `termine`) : aucune personne n'est en service sur ces quarts.

## Ce que je ne fais pas

Aucune lecture Production, aucune donnée corrigée, aucun grant ou policy, aucune fonction employé. La correction des 5 lignes en base (réaffecter le `quart_id`) reste hors périmètre : elle relèverait d'une mutation de données à arbitrer séparément.

## Demande

Arbitrer la règle ci-dessus (C1, `shifts.quart` fait foi, traitement des 5 lignes). Si elle est approuvée, j'écris sur Test seulement : la migration de `run_scheduled_inventory_reviews()`, les épreuves SQL/JS, les mutations de garde, puis la recette GOV-012 avant toute demande de clôture. Les conditions A à F de request-11 s'appliquent sans changement, y compris le retour avec preuve si les droits de réouverture du manager manquent.
