---
protocol: nexus-handoff/2
kind: request
lot_id: FDJ-CARNETS-LEDGER-AUDIT-1-20261004
seq: 7
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7 production=30544c9
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7-production=30544c9-rail=fc533fc-inchangees
  - id: decision-6-deposee-consommee
    classe: VERIFIED
    valeur: commit-0837cb2-depot-3abc038-consommation
  - id: commits-applicatifs-identifies
    classe: VERIFIED
    valeur: 7e41b3b-b445860-exclusions-handoff-only-point-zero-confirmees
  - id: moteur-ledger-compatible-production
    classe: VERIFIED
    valeur: nexus-fdj-moteur.js-lignes-234-237-identiques-acbf3f4-patch-applicable
  - id: manager-employe-incompatibles-production
    classe: VERIFIED
    valeur: 8-fonctions-deja-migrees-PR62-rpc-jeton-frais-contexte-patch-absent
  - id: plafonds-langage-hors-lot
    classe: VERIFIED
    valeur: fichier-absent-de-production-git-cat-file-e-echoue
  - id: cherry-pick-teste-refuse
    classe: VERIFIED
    valeur: git-cherry-pick-no-commit-7e41b3b-approbation-indisponible
  - id: fusion-production
    classe: NOT_APPLICABLE
    valeur: stop-sans-fusion-point-3-du-go
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-ecriture-aucun-merge-aucune-migration
---
# STOP sans fusion — production a divergé du rail dans la zone même du correctif

Réponse à `decision-6.md` (`APPROVED_WITH_CONDITIONS`, `closes: false`, en
réponse à `request-6.md`) — GO explicite de Frédéric Bragance dans l'issue
#28 (05/10/2026) : « ARBITRAGE HUMAIN — GO FUSION FDJ VERS PRODUCTION ».

## Verdict

**STOP — aucune fusion effectuée.** Le point 3 du GO l'exige explicitement :
« Si Production a bougé ou si le diff contient un élément non
attribuable/ambigu, STOP sans fusion. » C'est exactement le cas constaté
ici, pour une raison plus profonde qu'un simple déplacement de SHA.

## 0. Ce qui a été vérifié avant tout code

- `origin/production` = `30544c9af7ebf83d8ec1ba3882418252380036f1` — identique
  au SHA cité dans le GO. `origin/handoff-continuite-20260920` =
  `fc533fc726fcf972caba57c7e1e2eae0cb9afe95` — identique au SHA du rail cité,
  et identique au `HEAD` de cette session. Aucun des deux pointeurs n'a
  bougé depuis `request-6.md`.
- Décision `decision-6.md` déposée et consommée via `outils/handoff.js`
  (commits `0837cb2`, `3abc038`) — étape 1 du GO, faite.
- Commits applicatifs exacts du lot déjà qualifié, identifiés par lecture
  de `request-1.md` §0 et par `git log` : **`7e41b3b`** (correction
  `soldesCarnetsAvecReference`/`soldesCarnetsParJeu` + câblage RPC des 6
  écritures manager hors quart avec jeton stable) et **`b445860`**
  (fermeture de la dette §8 — jeton stable sur les 2 écritures employé +
  `creerActivationReconstitueeCorrectionManager`). Exclus d'emblée,
  conformément aux interdictions du GO et confirmé par lecture de
  `--name-status` des deux commits : `docs/handoff/lots/FDJ-CARNETS-LEDGER-AUDIT-1-20261004/decision-2.md`,
  `audit-production-lecture-seule-1.sql`, `spec-point-zero-inventaire-fdj.md`
  (Handoff-only / Point Zéro) — `production` ne porte d'ailleurs même pas
  ce répertoire de lot (`git cat-file -e origin/production:docs/handoff/lots/FDJ-CARNETS-LEDGER-AUDIT-1-20261004`
  échoue : absent).

## 1. La découverte qui bloque la fusion : `production` a déjà sa propre correction indépendante, incompatible avec le patch du rail

En comparant, fichier par fichier, le contenu RÉEL de `production` (pas
seulement son SHA de branche) aux hunks exacts de `7e41b3b`/`b445860` :

**`nexus-fdj-moteur.js` — compatible, vérifié ligne à ligne.** Les deux
fonctions touchées (`soldesCarnetsParJeu`, `soldesCarnetsAvecReference`)
sont, dans `production`, **mot pour mot identiques** à l'état d'avant
correctif (`acbf3f4`, parent de `7e41b3b`) : le bloc `else if
(m.type_mouvement === 'correction') { if (m.location_destination_id ===
locations.caisse) s.confies += qte; else if (m.location_destination_id ===
locations.bureau) s.bureau += qte; }` existe en `production` tel quel,
lignes 234-237. **Le bug ledger du §4 de `request-1.md` est donc réellement
présent en Production aujourd'hui**, et le patch s'y appliquerait
proprement.

**`NEXUS-FDJ-Manager-v1.html` / `NEXUS-FDJ-v1.html` — INCOMPATIBLES,
vérifié fonction par fonction.** `production` a reçu, de façon
indépendante du rail, une « Relecture PR #62, point 3 » qui a **déjà**
basculé les 6 écritures manager hors quart vers
`nexusClient.rpc('fdj_enregistrer_mouvement_stock', …)` et les 2 écritures
employé vers `nexusClient.rpc('fdj_activer_carnet', …)` / le même RPC — soit
exactement la bascule serveur que ce lot croyait introduire. La différence
réelle : PR #62 envoie `p_jeton: genererIdempotencyKey()` **directement,
fraîche à chaque appel** ; ce lot envoie un jeton **stable** par intention
(`jetonIntention(etat)` / `jetonsActivationCarnet[gameId]` /
`jetonsActivationImplicite[gameId]` / `jetonsRetourBloque[gameId]`,
conservé jusqu'au succès). Vérifié fonction par fonction dans `production`
(`git show origin/production:<fichier>`, lignes exactes citées) :
`enregistrerReappro` (L3493), `enregistrerRetraitCaisse` (L3667),
`enregistrerReception` (L3961), `validerRapprochement` (L4276),
`enregistrerBlocage` (L4342), `retournerDepuisBloque` (L4366),
`creerActivationImplicite` (L1635), `executerActivationCarnetInterne`
(L1820) — les huit portent déjà le commentaire « Relecture PR #62, point
3 » et le `genererIdempotencyKey()` direct, **pas** l'ancien `.insert()`
direct que `7e41b3b`/`b445860` s'attendent à trouver et à remplacer.

Un cherry-pick de ces deux commits sur `production` ne s'appliquerait donc
**pas** proprement : le contexte attendu par le patch (ancien insert direct)
n'existe plus dans l'arbre réel de `production`. Forcer l'application
produirait soit un échec de patch, soit, si on l'ignorait et qu'on
remplaçait quand même le corps des fonctions, la **suppression silencieuse**
du travail de PR #62 (site/employee_id/émission déjà déduits côté serveur
par deux commandes RPC distinctes et déjà vérifiées en Production) — un
risque bien plus grave que celui que ce lot cherche à fermer.

## 2. Pourquoi ce n'avait jamais été détecté avant ce cycle

Les six requêtes précédentes (`request-1.md` à `request-6.md`) ont toutes
vérifié « `refs-protegees` : `production` inchangé » au sens **SHA de
branche** — exact, mais insuffisant : cela confirme que `production` n'a
pas avancé PENDANT le lot, pas que le patch qualifié contre le rail
s'applique à son contenu RÉEL. `request-1.md §0` compare le candidat
`153de05` au rail (`e64df4f`/`acbf3f4`) — jamais à `production`
directement, parce qu'aucune étape antérieure du cycle de qualification ne
l'exigeait avant ce GO de fusion. `production` et le rail ont divergé
avant même l'ouverture de ce lot (`PR #62` y est déjà intégrée, rien sur le
rail n'en porte trace) : c'est une divergence de fond entre branches, pas
un évènement survenu pendant ce lot.

## 3. Obstacle technique distinct, qui aurait de toute façon empêché l'étape 5

Indépendamment du point 1 : cette session ne dispose d'aucune capacité
d'écriture au-delà de son unique branche désignée
(`claude/issue-28-20261005-0054`). `git cherry-pick`, `git branch
<nouvelle>`, `git worktree add`, `git reset --hard` vers une autre réf —
toutes requièrent une approbation qu'aucun humain ne peut donner dans ce
run automatisé (testé explicitement : `git cherry-pick --no-commit 7e41b3b`
refusé). Aucun mécanisme de fusion vers `production` ni de merge de PR
n'est accessible depuis ce canal. Même si le point 1 n'existait pas, cette
session ne pouvait matériellement pas exécuter l'étape 5 du GO
elle-même — seulement préparer et vérifier.

## Ce qui reste exact et vaut d'être conservé

Le bug ledger du §4 (`nexus-fdj-moteur.js`, routage `'correction'`) est
réellement présent en Production et le patch isolé s'y appliquerait sans
ambiguïté — vérifié ligne à ligne, pas supposé. C'est la seule partie du
lot qualifié qui franchit le test du point 3 sans réserve.

## Recommandation, sans trancher à la place de Frédéric

1. Le bug ledger (`nexus-fdj-moteur.js`) peut faire l'objet d'une promotion
   séparée, minimale, dès qu'une session outillée confirme à nouveau la
   compatibilité au moment de l'exécuter (`production` peut avoir bougé
   depuis ce rapport).
2. La fermeture du gap d'idempotence (jeton stable vs jeton frais) doit
   être **réécrite contre le code réel de `production`** (RPC déjà en
   place via PR #62), pas promue depuis le rail tel quel — ce n'est plus
   un transport de patch, c'est une nouvelle qualification, avec un
   diagnostic déjà fait par ce rapport.
3. `docs/gouvernance/LANGAGE-NEXUS-PLAFONDS.json` n'existe pas du tout dans
   `production` (vérifié : `git cat-file -e` échoue) — c'est un artefact
   d'un autre lot (gouvernance du langage NEXUS), pas du lot FDJ ; à
   exclure de toute promotion FDJ, conformément au point 3 du GO
   (élément non attribuable à ce lot).

## Invariants respectés

Aucun changement `main`/`production` — aucune commande d'écriture n'a été
tentée contre ces refs, aucune branche de transport créée, aucun
cherry-pick appliqué (testé et refusé par l'environnement, voir §3).
Aucune fusion, aucun déploiement, aucune migration, aucune
écriture/réparation Production, aucun Point Zéro, aucun traitement de
l'écart `20261004130000`, aucun secret créé/lu/exposé. `decision-6.md`
déposée et consommée (Handoff uniquement). Le lot reste ouvert
(`closes: false`) : il attend l'arbitrage de Frédéric sur la
recommandation ci-dessus.
