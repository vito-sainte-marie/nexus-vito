---
protocol: nexus-handoff/2
kind: request
lot_id: INVENTAIRE-CAISSE-RENFORT-20261102
seq: 15
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
# INVENTAIRE-CAISSE-RENFORT-20261102 : request-15 — clôture serveur : « prise de poste » fait foi, lecture de la réponse de Frédéric

## Branche du lot

BRANCHE_DU_LOT: handoff-continuite-20260920

## Objet

L'arbitre a bloqué request-14 (run 41729822887, #28 6616911895) sur un seul point : l'autorité de rattachement en cas de divergence entre le quart de la prise de poste (`shifts.quart`) et le quart d'inventaire où la ligne est rangée. Frédéric a répondu le 03/11 à 18:28 (Guardian 6617056409, relancé par 6617222972). Cette request lève ce point. Le reste de request-14 (C1, repli à fin prévue + délai, conditions A à F de request-11) est inchangé. `closes: false`.

## Réponse de Frédéric, citée telle quelle

> « prise de poste »

Question posée, mot pour mot : « quand le quart de la prise de poste et le quart où son inventaire est rangé divergent, pour savoir quand le quart est terminé, on compte l'employé dans lequel des deux ? Prise de poste ou inventaire ? »

Conséquence : `shifts.quart` fait foi. Une ligne n'est comptée que dans le quart de la prise de poste de l'employé. C'est cohérent avec sa décision du 03/11 à 12:49 (la caissière ou le pompiste clôture le quart 1 ou 2 selon sa prise de poste) et avec C1 (le choix 1 qu'il a confirmé à 18:13, Guardian 6616736762).

## Règle (inchangée par rapport à request-14, dont le détail et la mesure Test restent valides)

1. Population = lignes `inventaire_quart_employes` du quart dont le shift a le `quart` de ce quart. Clôture dès que toutes ont `a_valide_cloture = true`, `cloture_le` = dernière `heure_depart`. Population vide : pas de clôture anticipée.
2. Repli : fin prévue + `closureDelayMinutes` (30), `cloture_le` = fin prévue + délai exactement, avec l'alerte des produits non comptés.
3. Aucune donnée corrigée. Les 5 lignes divergentes de Test (18/09, 21/10, 31/10, 01/11, 02/11, anciens pointages, personne en service) sortent de la population du quart `soir` ; la fonction les compte et les consigne dans son résultat.
4. Cron : ignore tout quart déjà clôturé ; filtrage par site partout ; garde de statut et unicité de l'alerte conservées. Aucune policy, aucun grant, aucune fonction employé.

## Suite prévue, Test seulement, après verdict

1. Migration de `run_scheduled_inventory_reviews()`, épreuves SQL/JS, mutations de garde.
2. Étape 3 du fil caisse (`FERMETURE_OUVERTE = true`) sur la clôture individuelle, qui crée la référence d'écart (#169).
3. Recette GOV-012 à deux comptes (Test B caissière, puis un compte pompiste Test), dans les deux ordres et avec le repli à fin + 30.
4. Puis une request de passage en Production avec le texte exact de la migration : le GO écrit de Frédéric pour la migration Production et la fusion sera demandé à ce moment-là.

## Distance avant un inventaire caisse opérationnel à Sainte-Marie

Établi par le rail, sans nouvelle mesure ici :
- **Clôture serveur (cette request)** : règle arbitrée de bout en bout après ce verdict ; migration, épreuves et recette non commencées.
- **L2a, photo Decenium du soir** : non commencé au dernier état écrit au rail (request-2 : import Decenium non éprouvé sur Test). Je ne l'ai pas remesuré aujourd'hui.
- **L4a, défaut A** : porte `SECURITE_RLS_SITE_ID` (decision-1), aucune policy touchée, non ouvert : il exigera un GO de Frédéric.
- **L3, roulement renfort** : non commencé, après L1 et L2.

## Ce que je ne fais pas

Aucune écriture sur Test avant verdict, aucune lecture ni écriture Production, aucun grant ou policy.

## Demande

Approuver la règle ci-dessus avec « prise de poste » (`shifts.quart`) comme autorité de rattachement, et autoriser la migration, les épreuves, l'étape 3 du fil caisse et la recette sur Test.
