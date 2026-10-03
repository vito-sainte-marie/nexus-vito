---
protocol: nexus-handoff/2
kind: request
lot_id: FDJ-VAGUE1-REPRISE-20261003
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7 production=2f27e5c
  - id: candidat
    classe: VERIFIED
    valeur: 9ffee7e rebuild/fdj-62-20260922 CI 37162731719 success
  - id: empreinte
    classe: VERIFIED
    valeur: 289 d234cb72bcea36d4de22373aa555f284b0f7491abd1b59b314b528265fce78cb
---
# Demande — résultats des gestes 1-2-3 de `decision-1.md` ; une écriture Test à arbitrer

## 1. Ce qui a été fait et mesuré

### Geste 1 : isolation Test sur le candidat FDJ — FAIT

- Le candidat est `9ffee7e`, poussé en fast-forward sur `rebuild/fdj-62-20260922` (`2bc7b39..9ffee7e`), sans force.
  - C'est une fusion, de parents `2f27e5c` (production) et `fe4e9a2` (#62).
  - Les 7 fichiers d'isolation arrivent sous leur forme prouvée par #65.
  - Le delta métier FDJ n'est pas touché.
  - Seul conflit : les constantes d'empreinte, re-mesurées (voir geste 2).
- CI : le run 37162731719 « non-régression » est vert.
- Alias servi : `https://rebuild-fdj-62-20260922.nexus-test-ddf.pages.dev/`.
  - `nexus-build.js` donne le commit `9ffee7e`, environnement `test`.
  - `nexus-config.js` vise la base Test `udljdqxerrbbbajxubfn`.
  - L'isolation est effective, et la page d'accueil s'exécute sans erreur console.
- Suite locale : 233/240. Les 7 échecs sont identiques à ceux de `production` seule en local (inventaire ×4, pilotage_qualite_receptions, reception_moteur, reception_v1_dom). Ils exigent l'arbre construit. Aucun échec nouveau.

### Geste 2 : essai à blanc, recette, empreinte — PARTIEL

- **Essai à blanc** des 12 migrations `20260916220000` → `20260916221100` sur le vrai schéma Test.
  - Une seule transaction, `ON_ERROR_STOP`, puis `rollback`.
  - Les 12 passent, et 42 fonctions `fdj_` existent dans la transaction.
  - Deux NOTICE seulement, sans erreur :
    - trigger `fdj_caisse_evenements_pas_de_modification` absent (« skipping ») ;
    - index sur `idempotency_key` déjà présent.
  - Après rollback, `schema_migrations` vaut toujours 292 : rien n'est resté.
- **Empreinte** re-mesurée depuis `git archive HEAD` : **289 / `d234cb72bcea36d4de22373aa555f284b0f7491abd1b59b314b528265fce78cb`**. Elle est inscrite dans le candidat.
- **Recette navigateur (Cas 1 à 4) : NON EXÉCUTÉE.**
  - Test n'a aucune des 12 migrations FDJ : 292 migrations, max `20261003190000`.
  - Les écrans FDJ du candidat appelleraient des fonctions absentes, et une recette dans cet état ne mesurerait rien.

### Geste 3 : re-mesure Production des six écarts `a_regulariser` — FAIT (lecture seule)

- Statuts aujourd'hui :

  | statut | 03/10 | dossier du 17/09 |
  |---|---|---|
  | conforme | 82 | 55 |
  | valide_avec_ecart | 18 | 18 |
  | a_regulariser | **10** | 6 |
  | regularise | 3 | 3 |

- **Cinq des six sont intacts** : `160559c5` (+14), `ce8c7ebd` (−1), `1c3b12b0` (−1), `806a27b2` (−3), `4b8b987f` (−37).
  - Tous sont `a_regulariser`, avec 0 régularisation, validés par `188ddf1f`.
- **`2e79513a` est passé `conforme`.**
  - Une entrée `correction_manager` de `fdj_audit_log` le trace : 17/09 20:04:46, acteur `21fb5e59`, motif `erreur_comptage`.
  - Le seul changement est le jeu `6491ade1`, dont le stock final passe de 28 à 30. L'écart passe donc de −2 à 0.
  - `ecart_origine` garde −2.
  - C'est une correction de recomptage tracée, postérieure à la mesure du dossier. Ce n'est pas une régularisation silencieuse.
- **Cinq nouveaux `a_regulariser`** sont apparus depuis le dossier : `d1c22da2`, `a5c84d38`, `540111d6`, `656204ff`, `7757e1e7`.
  - Site `vito-sainte-marie`, motif `non_explique`.
  - Ce sont des écarts réels du terrain, à traiter par un manager. Ils ne relèvent pas de ce lot.
- `schema_migrations` Production vaut 281 (max `20261003120000`). Aucune écriture n'a été faite.

## 2. Ce qui bloque, et pourquoi je ne le fais pas seul

La recette du geste 2 exige les 12 migrations FDJ **appliquées durablement sur nexus-test**. C'est une écriture sur une ressource partagée, et `decision-1` ne la nomme pas : il nomme un essai à blanc. Elle a de plus deux effets que l'arbitre doit voir :

1. **Test diverge du rail.**
   - Le rail ne porte pas ces 12 migrations.
   - Les épreuves de manifeste et d'empreinte du rail mesureraient une base qui en a 12 de plus que le dépôt.
2. **Elle est à sens unique en pratique.**
   - Défaire 12 migrations FDJ sur Test exige un script inverse qui n'existe pas.
   - `reconstruire-base-test.sh` n'est pas une porte, comme l'a déjà constaté un refus antérieur.

L'essai à blanc établit qu'elles **s'appliquent** sans erreur sur le schéma réel. Il n'établit pas leur comportement à l'écran.

## 3. Arbitrage demandé

- **A.** Appliquer les 12 migrations `20260916220000` → `20260916221100` sur nexus-test, dans une transaction unique, puis exécuter la recette Cas 1 à 5 sur l'alias `9ffee7e`. J'accepte et je consigne la divergence Test/rail.
- **B.** Ne pas écrire sur Test. La recette attend que les migrations FDJ entrent par le rail, puis le flux normal les applique.
- **C.** Autre voie désignée par l'arbitre, par exemple une base Test jetable dédiée.

Recommandation : **A**. C'est le seul moyen de juger les Cas 1 à 4 sans toucher Production. La divergence est bornée (12 fichiers, tous dans le dépôt sur `9ffee7e`) et se résorbe quand le lot atteint le rail.

Rien n'a été fusionné, déployé ni écrit en Production.
