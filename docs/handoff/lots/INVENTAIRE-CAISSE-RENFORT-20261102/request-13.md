---
protocol: nexus-handoff/2
kind: request
lot_id: INVENTAIRE-CAISSE-RENFORT-20261102
seq: 13
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
# INVENTAIRE-CAISSE-RENFORT-20261102 : request-13 — clôture serveur : la correspondance shifts↔quarts sur Test contredit la condition C telle qu'écrite

## Branche du lot

BRANCHE_DU_LOT: handoff-continuite-20260920

## Objet

Exécution de l'ACTION_NEXT de l'arbitrage de request-11 (APPROVED_WITH_CONDITIONS) : correspondance exacte shifts↔quarts, établie en lecture seule sur Test (`udljdqxerrbbbajxubfn`), capacité SUPABASE_TEST_LECTURE. Aucune écriture, aucune migration, rien en Production. Je m'arrête avant d'écrire la migration parce que la population de la condition C, appliquée à la lettre, ne peut jamais déclencher de clôture anticipée. `closes: false`.

## Ce que la lecture établit

Clé de rattachement testée : même site, même `quart` (matin/soir), même date locale de `heure_debut` (fuseau du site). Contrainte d'unicité `inventaire_quarts(site, date, quart)` : un seul quart par clé, donc la clé désigne bien un quart. Aucun shift sans `quart`, sans site ou avec un `quart` hors matin/soir.

1. **Population rattachée = presque tout du bruit sans ligne employé.** Sur les shifts rattachés à un quart : caissière `clos_sans_pointage` 86, dont 1 seul avec une ligne `inventaire_quart_employes` ; caissière `en_cours` 2 (1 ligne) ; pompiste `clos_sans_pointage` 14 (11 lignes) ; pompiste `termine` 3 (0 ligne) ; pompiste `en_cours` 1 (1 ligne). Ex. le 02/11 matin : 17 shifts rattachés, 1 ligne employé. Selon la condition C (« une ligne employé manquante bloque la clôture anticipée »), ces quarts ne se clôtureraient jamais avant l'heure de repli. La règle ne mord donc jamais : elle revient au repli horaire seul.
2. **Le `quart` du shift et celui de la ligne employé divergent** : 5 lignes (21/10, 18/09, 31/10, 01/11, 02/11) rattachent un shift pompiste `quart = matin` à un quart `soir`. Dans ces cas la clé (site, date, quart du shift) et la ligne employé donnent deux réponses opposées. Il faut dire laquelle fait foi.
3. **Renfort** : 2 shifts renfort (soir), aucune ligne employé, donc aucun rattachement à un quart par `inventaire_quart_employes`. Ils tombent dans le cas « sans quart attribuable » (à exclure) alors que la condition C les voulait inclus « s'ils sont rattachés à ce quart ». Par le seul `shifts.quart`, ils seraient rattachés au soir. Les deux lectures ne coïncident pas.
4. **Manager** : 7 shifts `clos_sans_pointage`, aucune ligne employé. À exclure explicitement de la population si on la prend par `shifts`.
5. **Quarts sans ligne employé** : 1 (30/10 ouverture_en_cours). Population vide → aucune clôture anticipée, conformément à la condition C.

## Propositions soumises à l'arbitre (A–F inchangées)

C1 (recommandée). **Population = les lignes `inventaire_quart_employes` du quart** (donc les personnes réellement entrées dans l'inventaire), pas les shifts de la journée. Chaque ligne doit avoir `a_valide_cloture = true` et `heure_depart` non nul. Un renfort inscrit à ce quart a une ligne : il est inclus. Un shift sans ligne (clos sans pointage, manager, renfort jamais entré) n'est pas dans la population : il n'a pas participé à l'inventaire. Population vide → pas de clôture anticipée.
C2. Si l'arbitre tient à partir des `shifts` : restreindre aux statuts `en_cours` et `termine` et aux rôles pompiste, caissière, renfort ; chaque shift ainsi retenu doit avoir sa ligne. Les 3 pompistes `termine` sans ligne bloqueraient alors leur quart.

Dans les deux cas, trancher le point 2 : la ligne employé fait foi pour le rattachement, le `quart` du shift est ignoré.

## Ce que je ne fais pas

Aucune migration écrite ni appliquée, aucun changement de policy, grant ou fonction employé, aucune lecture Production. La fonction `run_scheduled_inventory_reviews()` de Test n'est pas touchée (lue seulement).

## Demande

Arbitrer C1 ou C2 et le point 2 (qui fait foi pour le rattachement). Après quoi j'écris la migration (Test seulement), les épreuves SQL/JS, les mutations de garde et la recette GOV-012.
