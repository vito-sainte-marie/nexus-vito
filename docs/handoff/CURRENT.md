<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/OUTILLAGE-REGULARISATION-20261026/request-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: OUTILLAGE-REGULARISATION-20261026
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=f56edb0d production=f00eda7a
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 166-fichiers
  - id: epreuves-6510a2e3
    classe: VERIFIED
    valeur: test_arbitrage_deja_traite_20261026.js 9/9 vert, mutations M1 et M2 rougissent C1
  - id: epreuves-631f5d00
    classe: VERIFIED
    valeur: test_demande_classe_preuve_20261026.js 3/3 vert, mutation de la garde rougit A
  - id: ci-rail-e251592c
    classe: VERIFIED
    valeur: run Tests 40253407612 success sur e251592c; run 40253522931 success sur 48fea8fd
  - id: tip-rail
    classe: VERIFIED
    valeur: 4828609f
  - id: paires-employe-test-a
    classe: VERIFIED
    valeur: 10 services depuis le 25/10 sur Supabase Test, 5 paires espacees de 1,1 s, une par run Tests du rail; source tests.yml etape Recette navigateur NEXUS Test
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune ecriture ni lecture Production
---
# OUTILLAGE-REGULARISATION-20261026 : régulariser trois correctifs d'outillage faits sans lot, borner `--preuve-action`, expliquer les paires de services d'Employé Test A

*Déposé sur instruction de Frédéric (26/10/2026), PRISE-DE-POSTE-UN-ECRAN-20261025 étant DECISION_CONSOMMEE (decision-3, closes: true) ; aucun lot actif, règle D3 respectée. Cette request sert aussi de test du relais (crédit OpenAI rechargé). Le point 2 n'est pas codé : il attend la décision.*

## 1. Trois commits d'outillage poussés sur le rail hors lot, à régulariser

Ils ont été faits pendant PRISE-DE-POSTE pour lever des incidents, sans demande préalable. Chacun est rejoué ici sur la tête du rail (4828609f).

| Commit | Objet | Épreuve | Mutation |
|---|---|---|---|
| 6510a2e3 | Relais : une demande déjà arbitrée ne repart pas vers l'API (`NO_WORK`, clé = lot + demande, `outils/arbitrage-deja-traite.js`). Cause : le relais hachait le corps intégral du réveil, qui change avec la tête du rail ; réarbitrage, 429, CI rouge (run 40250278774 sur 033ad017). | `test_arbitrage_deja_traite_20261026.js` : 9/9 | M1 (sans l'appel à l'outil) et M2 (sans le NO_WORK) font rougir C1 |
| 631f5d00 | `handoff.js demande` refuse une classe de preuve hors vocabulaire avant toute écriture (`REFUS PREUVE_CLASSE_HORS_VOCABULAIRE`). Cause : request-3 de PRISE-DE-POSTE est partie avec `MEASURED` et a été réécrite après publication (INC-17adb4e168a9). | `test_demande_classe_preuve_20261026.js` : 3/3 | M : sans la garde, MEASURED écrit une demande, A rougit |
| e251592c | Relais : une seule lecture des commentaires dans l'étape (un seul `gh api`, réutilisé pour la marque `nexus-arbitrage`). Correction de 6510a2e3, dont la CI était rouge. | Régression : la CI du rail passe (run 40253407612 sur e251592c, puis 40253522931 sur 48fea8fd, success) | Pas de mutation propre : le correctif ne change pas de comportement, l'inventaire des épreuves est intact |

Limite avouée : la garde de e251592c n'a pas de mutation dédiée. Elle est couverte par la mutation M1/M2 de 6510a2e3 sur le même bloc, pas par une épreuve à elle.

## 2. Proposition : `--preuve-action` n'accepte qu'un commit de la branche du lot

Constat : `consommer --preuve-action` appelle `commitHorsRegistre` (handoff.js ~622), qui vérifie seulement que le commit touche autre chose que le registre. Le 26/10 il a accepté `72216ec1`, fiche d'incident INC-74839140d278, comme preuve de l'action de decision-2, alors que l'action était `246b5765` sur `prise-de-poste-un-ecran-20261025`.

Demandé :
1. `--preuve-action <sha>` refuse (`REFUS PREUVE_ACTION_HORS_BRANCHE_DU_LOT`, avant toute écriture) sauf si le SHA est un ancêtre de `origin/<branche du lot>` (`git merge-base --is-ancestor`) et n'est pas porté par le seul rail. La branche vient de l'enveloppe de la décision, jamais d'un argument.
2. Épreuve rouge puis verte : SHA du rail seul refusé, SHA de la branche du lot accepté, SHA inconnu refusé. Mutation : neutraliser le test d'ascendance fait rougir l'épreuve.
3. Cas voisins à garder verts : lot dont l'action est sur le rail lui-même (branche du lot = rail), consommation `--cloture`, `--prise-en-charge`.
4. Si `origin/<branche>` est introuvable, le refus est explicite (`BRANCHE_DU_LOT_INTROUVABLE`), jamais un passage silencieux.

À arbitrer : le cas « branche du lot = rail » (pas de restriction supplémentaire) vous convient-il ?

## 3. Les paires de services d'Employé Test A : l'outil, et pourquoi deux services

**Outil** : la recette navigateur `outils/recette-navigateur-test.js`, étape « Recette navigateur NEXUS Test » de `.github/workflows/tests.yml` (ligne 1548, condition `NEXUS_REF_EST_LE_RAIL == '1'`), exécutée à chaque run `Tests` poussé sur le rail. Elle se connecte en « Employé Test A » (secrets `NEXUS_TEST_EMPLOYEE_A_*`) sur NEXUS Test.

**Pourquoi deux** : le scénario employé prend le poste deux fois de suite, volontairement. Le commentaire du workflow l'écrit : « prise de poste, puis prise de poste AVEC un quart déjà ouvert, le cas ordinaire de l'équipe que l'index d'unicité pourrait refuser ». La première ouvre un service ; la seconde ouvre le suivant, et le déclencheur `nexus_shifts_avant_insertion` clôt le précédent (`cloture_source = prise_de_poste_suivante`). Le rôle est `caissiere` parce que le scénario clique la première carte de rôle.

**Mesure** (lecture seule, Supabase Test) : dix services d'Employé Test A depuis le 25/10, cinq paires espacées de 1,1 s : 03:13:44/45, 12:23:23/24, 12:51:39/40, 00:19:52/54, 01:20:43/44. Chaque paire coïncide avec la fin d'un run `Tests` du rail (03:14:36, 12:24:15, 12:52:31, 00:20:46, 01:21:34). Le second service de chaque paire reste ouvert jusqu'au run suivant, qui le clôt par `prise_de_poste_suivante` : c'est le cas de `afdfac9a` (ouvert 12:51:40, clos 00:19:52 le 26/10). Le seul service encore `en_cours` est `702ebdfd` (01:20:44). La recette `recette-candidat-65.yml` n'y est pour rien : elle n'a pas tourné depuis le 30/09.

**Conséquence** : le nombre de paires suit le nombre de runs du rail dont la recette arrive jusqu'au scénario employé, soit une paire par run. Ce n'est pas un défaut de la recette, c'est son comportement voulu ; ce qui manque est le nettoyage.

**Proposition, à arbitrer** : en fin de scénario employé, clore par l'écran (pas par SQL) le service laissé ouvert, ou le rattacher à un identifiant de recette repérable. Aucun nettoyage des services existants n'est demandé ; rien n'est supprimé sans votre accord explicite.

## Ce qui ne change pas

Aucune écriture en Production, aucun déploiement, aucune fusion. Le périmètre est `outils/handoff.js`, son épreuve, `.github/workflows/tests.yml` et `docs/learning/`. Pas de changement du protocole `nexus-handoff/2`.

## À arbitrer

1. Ratifier a posteriori 6510a2e3, 631f5d00 et e251592c.
2. Approuver le point 2 (`--preuve-action` borné) et désigner l'exécutant.
3. Choisir pour le point 3 : fin de scénario qui clôt son service, ou statu quo documenté.
