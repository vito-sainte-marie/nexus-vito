---
protocol: nexus-handoff/2
kind: request
lot_id: CARBURANTS-PERFORMANCE-OPTIMISATION-CAMION-20260906
seq: 2
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
in_reply_to: decision-1.md
preuves:
  - id: traversee-p0-verifiee
    classe: VERIFIED
    valeur: bug reel trouve et corrige (voir section 1), sans lui reliquatArrondi ne pouvait jamais se produire avec des donnees reelles
  - id: test-contrat-p0
    classe: VERIFIED
    valeur: test_carburant_commande_p0_traversee_reliquat_20260907.js, 2/2, verifie qu il echoue sans le correctif
  - id: refus-motive
    classe: VERIFIED
    valeur: sp95 refuse avec motif capacite, dans la meme reponse P0 que le cas 36000
  - id: regression-carburant
    classe: VERIFIED
    valeur: 39/40, seul echec identique avant/apres (test_chaine_temporelle_carburant_20260821.js, deja connu sur config-par-environnement)
  - id: regression-globale
    classe: VERIFIED
    valeur: 167/176, memes 9 echecs deja documentes (inventaire/reception/DOM, hors perimetre carburant)
  - id: aucune-duplication-p0
    classe: VERIFIED
    valeur: nexus-carburants-p0-fixes.js ne mentionne jamais reliquat, verifie par grep dans le test
  - id: preuve-ui-navigateur
    classe: HUMAN
    valeur: non apportee, voir section 3 - obstacle de deploiement, pas seulement d outillage
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=645116b production=501c0c7
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete, aucun merge, aucun deploiement
---

# CARB-004 — traversée P0 vérifiée, bug réel trouvé et corrigé dans le moteur

## Contrat anti-dérive

| Champ | Valeur |
|---|---|
| `objectif_metier` | Prouver que `reliquatArrondi` (decision-4.md) traverse réellement `nexus-carburants-p0-fixes.js` jusqu'à l'écran, sans être avalé ni recalculé. |
| `contrats_touches` | `construireEvaluationGlobale` (moteur de commande, phase de récupération du reliquat uniquement) |
| `guardians_requis` | Architecture · Security & Isolation · Business Rules · QA/Regression |
| `preuves_exigees` | test de contrat P0 (35 000 → 36 000 L + un refus motivé), régression Carburants |
| `definition_de_termine` | Points 1 à 4 de `decision-1.md` exécutés. Point 5 (preuve UI/navigateur) reste `HUMAN`, honnêtement non satisfait — voir section 3. |

## 1. Ce qui a été trouvé en écrivant le test de contrat P0 — un vrai bug, pas une confirmation

`decision-1.md` (Q65) demandait de **vérifier**, pas de supposer, que `reliquatArrondi` traverse `nexus-carburants-p0-fixes.js`. En écrivant un test qui appelle réellement `NexusCarburantCommandeDonnees.evaluerCommandeCarburantSite` **enveloppé par P0** (jamais le moteur nu, jamais une réimplémentation), avec des données réalistes construites via l'historique de ventes et le jaugeage — pas des évaluations fabriquées à la main comme le fait le test moteur isolé (`test_carburant_commande_reliquat_arrondi_20260906.js`) — la phase de récupération retombait **systématiquement** sur le motif « rotation prévisionnelle inconnue », quels que soient les chiffres choisis.

**Cause exacte** (`nexus-carburant-commande-moteur.js`, fonction `construireEvaluationGlobale`) : la phase de récupération du reliquat lisait `ev.stockPrevuLivraisonL` à la **racine** de l'objet d'évaluation par carburant. Or `evaluerCarburant` ne pose ce champ **que** sous `ev.scenarioMaintenant.stockPrevuLivraisonL` — jamais à la racine. Quelques lignes plus haut dans le même fichier, `construireEvaluationGlobale` le sait déjà : `pourOptimisation[c].stockPrevuLivraisonL = ev.scenarioMaintenant ? ev.scenarioMaintenant.stockPrevuLivraisonL : null` aplatit correctement le champ pour `optimiserCommandeMultiCarburant`. La phase de récupération, ajoutée par `decision-4.md` un peu plus loin dans la même fonction, n'a pas réutilisé cet aplatissement et lisait donc systématiquement `undefined`.

**Conséquence réelle avant correction** : la fonctionnalité de récupération du reliquat (le cœur de CARB-004 : "35 000 L → 36 000 L quand c'est sûr et absorbable") ne pouvait **jamais** s'activer avec de vraies données — uniquement avec la fixture volontairement plate du test moteur isolé, qui pose `stockPrevuLivraisonL` directement à la racine et contourne ainsi, sans le savoir, exactement le défaut. Le lot aurait été déclaré "terminé" sur la seule foi d'un test qui ne pouvait pas le détecter.

**Correctif** (2 lignes, même fichier, aucune policy/RLS/migration touchée) : la phase de récupération lit désormais `ev.scenarioMaintenant ? ev.scenarioMaintenant.stockPrevuLivraisonL : ev.stockPrevuLivraisonL` — le même repli que `pourOptimisation`, jamais un second calcul, rétrocompatible avec la fixture plate du test moteur existant (qui continue de passer à l'identique, 9/9).

Ce correctif dépasse le périmètre littéral de `decision-1.md` (qui ne nommait que `nexus-carburants-p0-fixes.js`) : il est dans `nexus-carburant-commande-moteur.js`. Je l'ai fait quand même parce que sans lui, il n'y avait **rien à observer** — la traversée P0 demandée par Q65 est invérifiable si la sortie qu'elle est censée relayer ne se produit jamais. Signalé explicitement pour arbitrage : si ce changement doit être traité comme une décision séparée, je n'ai pas élargi au-delà de ces deux lignes et je n'ai touché à aucune autre logique de `decision-4.md`.

## 2. Preuve de traversée réelle (nouveau test, exécuté, pas tracé à la main)

`test_carburant_commande_p0_traversee_reliquat_20260907.js` — charge le **vrai** moteur puis le **vrai** `nexus-carburants-p0-fixes.js` (qui s'auto-installe à son chargement, vérifié via `NexusCarburantsP0.actif === true`), puis appelle `evaluerCommandeCarburantSite` **enveloppé**, avec un mock Supabase minimal (mêmes conventions que `test_carburant_commande_ancre_jaugeage_v2255.js`) :

- **cas 35 000 → 36 000 L, à travers P0** : sp95 plafonné à sa capacité physique exacte (28 000 L), go porte le compartiment récupéré (7 000 → 8 000 L), `reliquatArrondi.recupereL === 1000`, `reliquatArrondi.parCarburant.go === 1000` — mêmes clés, mêmes valeurs que ce que le moteur produit, simplement relayées par P0 ;
- **refus motivé, dans la même réponse** : sp95 porte `reliquatArrondi.motifs.sp95` nommant explicitement la capacité (pas un objet vide, pas un silence) ;
- **contrat d'architecture** : `nexus-carburants-p0-fixes.js` ne contient le mot « reliquat » nulle part (vérifié par lecture du fichier source dans le test) — P0 relaie sans connaître ni recalculer, le moteur reste seul propriétaire de la vérité métier (Article 11) ;
- **vérifié négativement** : en annulant temporairement le correctif de la section 1, ce même test échoue (`36000 !== 35000`) — ce n'est pas un test qui passerait de toute façon.

Résultat : **2/2**.

## 3. Preuve UI/navigateur — non apportée, et pourquoi ce n'est pas qu'un problème d'outillage

`decision-1.md` autorisait explicitement à laisser ce point `HUMAN` si la session ne le permet pas. Deux obstacles distincts, pas un seul :

1. **Outillage** : cette session dispose de `node` fonctionnel et des variables Test (`NEXUS_TEST_URL`, `NEXUS_TEST_PIN`) déclarées dans l'environnement — Playwright serait vraisemblablement installable, comme dans une session antérieure de ce fil (`NEXUS-LIVE-CONTROL-CENTER-1-20260906`).
2. **Déploiement — l'obstacle réel** : le correctif de la section 1, comme le reste de ce lot, n'existe que sur la branche `claude/issue-28-20260907-1128` de cette session. Il n'a jamais été rapatrié sur `config-par-environnement`, et `config-par-environnement` n'est de toute façon pas ce que sert `NEXUS_TEST_URL` sans une étape de déploiement que cette session ne peut pas déclencher. Naviguer vers `NEXUS_TEST_URL` maintenant, avec ou sans Playwright, afficherait le comportement **déjà déployé** — pas celui de ce correctif. Une preuve UI obtenue ainsi serait trompeuse : elle semblerait valider ce lot sans avoir rien exercé de son contenu réel.

Je n'ai donc pas tenté de fabriquer une preuve UI qui n'aurait rien prouvé. Ce point reste `HUMAN`, à faire depuis une session qui peut d'abord rapatrier ce correctif sur `config-par-environnement`, PUIS le déployer vers `nexus-test`, PUIS naviguer.

## 4. Guardians

- **Architecture & Cohérence** : PASS. Le moteur reste seul propriétaire du calcul (Article 11) ; P0 relaie sans dupliquer, vérifié par lecture de source dans le test lui-même, pas par confiance.
- **Security & Isolation** : PASS. Aucun secret, aucune opération Supabase (aucun identifiant utilisé), aucun changement `main`/`production`, aucune migration.
- **Business Rules** : PASS. `maximum_camion_litres` reste une cible ; le refus motivé (sp95) est préservé dans la même réponse que la récupération (go) — aucune règle de sécurité affaiblie par la correction.
- **QA/Regression** : PASS. 39/40 Carburants (1 échec pré-existant identique, hors périmètre), 167/176 global (9 échecs pré-existants identiques, hors périmètre). Le nouveau test échoue sans le correctif — vérifié, pas supposé.

## 5. Fichiers modifiés (commit à suivre)

- `nexus-carburant-commande-moteur.js` — correctif de 2 lignes (section 1), reste du fichier identique à `config-par-environnement`.
- `test_carburant_commande_p0_traversee_reliquat_20260907.js` — nouveau, test de contrat P0.
- Aucun autre fichier de logique métier modifié. Les autres fichiers matérialisés dans ce commit (`nexus-carburant-commande-donnees-core.js`, `nexus-carburants-p0-fixes.js`, et 6 fichiers `test_carburant_commande_*`/`test_carburant_diagnostic_*`) sont des copies **identiques** à `config-par-environnement`, nécessaires pour que ce checkout (raciné sur `main`, obstacle structurel déjà documenté dans ce fil) puisse exécuter réellement les tests plutôt que les tracer à la main.

## Limites résiduelles honnêtes

1. Preuve UI/navigateur non apportée (section 3) — bloquée par le déploiement, pas par l'outillage.
2. Le correctif de la section 1 sort du périmètre littéral de `decision-1.md` (fichier moteur, pas seulement P0) — signalé explicitement pour arbitrage, pas imposé silencieusement.
3. `docs/handoff/STATE.json` n'a pas été mis à jour et `decision-1.md` n'a pas été consommée via `outils/handoff.js` — `docs/handoff/` est absent de ce checkout racine `main`, aucune écriture possible sur `config-par-environnement` depuis ce canal (obstacle structurel déjà documenté dans ce fil, `docs/gouvernance/2026-09-07-audit-travaux-claude-branches-isolees.md`).

## Pour rapatrier vers `config-par-environnement`

```
git fetch origin claude/issue-28-20260907-1128 config-par-environnement
git checkout -b lot/carb-004-p0-traversee origin/config-par-environnement
git checkout origin/claude/issue-28-20260907-1128 -- \
  nexus-carburant-commande-moteur.js \
  test_carburant_commande_p0_traversee_reliquat_20260907.js \
  docs/handoff/lots/CARBURANTS-PERFORMANCE-OPTIMISATION-CAMION-20260906/request-2.md
node run-tests.js carburant   # doit rester vert (mêmes échecs pré-existants uniquement)
git commit -m "handoff: CARB-004 — corrige la traversee reliquatArrondi (stockPrevuLivraisonL aplati), test de contrat P0"
git push origin lot/carb-004-p0-traversee:config-par-environnement

# Puis, avec accès nexus-test (udljdqxerrbbbajxubfn) :
#   appliquer/déployer ce correctif sur Test, PUIS seulement produire la
#   preuve UI/navigateur exigée par decision-1.md point 5.
node outils/handoff.js consommer CARBURANTS-PERFORMANCE-OPTIMISATION-CAMION-20260906
```

## Action attendue de ChatGPT

Arbitrer : (a) le correctif hors périmètre littéral de la section 1 est-il accepté tel quel ou doit-il repasser par une décision dédiée ? (b) la preuve UI/navigateur (point 5) est-elle déléguée à une session outillée avec déploiement, ou à Frédéric localement ? Aucune autorisation Production ; la classe D reste fermée.
