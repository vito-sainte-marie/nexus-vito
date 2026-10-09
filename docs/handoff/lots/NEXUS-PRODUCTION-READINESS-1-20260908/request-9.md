---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-PRODUCTION-READINESS-1-20260908
seq: 9
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=10c65d0 production=d5a8b77
  - id: reconciliation-branche-c14b817
    classe: VERIFIED
    valeur: diff limite a docs/handoff, aucun fichier applicatif, gh run list reverifie identique
  - id: fermeture-defaut-12
    classe: VERIFIED
    valeur: test_handoff_v2 vert sur pull_request 34508020759 et push 34508015447 du candidat e6c7948, releu par gh run view
  - id: non-fermeture-defaut-7
    classe: VERIFIED
    valeur: test_security_jamais_invoque_si_url vert sur les deux runs du candidat, point de non-reproduction de plus, cause non isolee inchangee
  - id: isolation-defaut-13-secret-runner
    classe: VERIFIED
    valeur: secretsManquants aurait court-circuite avant tout login ; log montre un login Playwright reellement tente puis timeout, donc secret present et non vide
  - id: isolation-defaut-13-code-inchange
    classe: VERIFIED
    valeur: git diff 4f26a37..e6c7948 sur recette-navigateur-test.js/nexus-auth.js/NEXUS-App-v1.html/supabase = zero difference
  - id: verdict-recalcule
    classe: VERIFIED
    valeur: node outils/evaluer-pret-pour-production.js --sha e6c7948 reexecute dans cette session : ci_et_guardians_conformes BLOQUE, VERDICT NON_PRET
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete, aucun merge, aucun deploiement
---
# Réconciliation §7/§12, isolation du défaut 13 par élimination — la CI n'est toujours pas verte sur le candidat

## Ce qui était demandé

Repartir du HEAD canonique `e6c7948`, réconcilier factuellement le contenu
déjà préparé sur une branche non intégrée (`claude/issue-28-20260910-1828`,
commit `c14b817`) avec l'état réellement intégré, republier par
`nexus-handoff/2` si nécessaire, et surtout isoler le défaut 13 — compte
Manager Test, fixture/recette, disponibilité du secret dans le runner, ou
défaut applicatif — sans lire ni exposer aucun secret.

## Réconciliation — rien n'a bougé depuis, revérifié indépendamment

`c14b817` (branche non fusionnable citée dans le réveil) ne touche que des
fichiers Handoff — `blocages-ouverts-1.md`, `faits-pret-pour-production.json`,
`STATE.json`, `CURRENT.md` — et un `request-9.md` jamais canonisé. Son
diagnostic (§12 fermé, §7 point de non-reproduction, §13 ouvert) a été
**revérifié dans cette session, indépendamment**, pas simplement recopié :

- `gh run list --commit e6c7948769c8e1aa6a2690d1c6e5b782f56f7ea9` → toujours
  exactement deux runs, `pull_request 34508020759` (`success`) et
  `push 34508015447` (`failure`) — identiques à ceux déjà cités.
- `gh run list --branch config-par-environnement --limit 10` → aucun run
  postérieur à ces deux-là. Aucune information nouvelle n'est apparue depuis
  la rédaction du brouillon.
- `gh run view --job 102974863530 --log` (job unique du run `push`) →
  confirme la même seule étape en échec, « Recette navigateur NEXUS Test »,
  avec le même message exact : « Connexion refusée : toujours sur l'écran de
  login 30 s après validation. […] Prénom ou code PIN incorrect. »
- `node outils/evaluer-pret-pour-production.js --sha e6c7948769c8e1aa6a2690d1c6e5b782f56f7ea9`
  (réexécuté dans cette session, pas cité) → `ci_et_guardians_conformes
  BLOQUE`, `VERDICT NON_PRET`, `run(s) en échec : push 34508015447`.

Le contenu réconcilié (§12 fermé, §7 inchangé, §13 ouvert) est donc republié
tel quel, avec une isolation supplémentaire au §13 ci-dessous — pas une
réécriture de l'historique, un enrichissement du même constat.

## §12 — FERMÉ

`test_handoff_v2_20260905.js` (l'étape « Suite de non-régression et
verdict ») est verte dans les deux runs du candidat. Le défaut spécifique
(refus d'une décision déjà consommée sans message identifiable) ne s'est
reproduit dans aucun des deux événements sur `e6c7948`. Fermé sur cette
base : cause toujours non isolée, mais non reproduite sur ce SHA.

## §7 — reste OUVERT

`test_security_jamais_invoque_si_url_20260910.js` est également vert dans
les deux runs — un point de non-reproduction de plus, pas une preuve
d'absence. Conformément au mandat (« ne corrige rien par analogie »), §7
reste ouvert, statut inchangé.

## Défaut 13 — isolé par élimination, sans lire aucun secret

Le run `push` du candidat lui-même échoue à la dernière étape connectée,
après 46 étapes vertes (suite complète, Protocole Handoff v2, sept
Guardians, garde PREPROD, semis Supabase Test, publication du journal Live).
Symptôme identique au défaut 11 déjà fermé (même point d'entrée, `Manager
Test`, même message « Prénom ou code PIN incorrect »), réapparu une heure et
demie plus tard sur le candidat lui-même.

**Isolation demandée entre quatre causes — trois écartées par des faits :**

1. **Disponibilité du secret dans le runner — ÉCARTÉE.**
   `outils/recette-navigateur-test.js` court-circuite `executer()` *avant*
   toute tentative de connexion si un secret requis (`NEXUS_TEST_MANAGER_PIN`
   inclus) est absent ou vide, avec le message distinct et non bloquant
   « Recette navigateur Test non exécutée — absents du runner : … »
   (dégradation ENV-003). Le log du run montre un login Playwright
   réellement tenté puis un timeout à 30 s — pas ce message précoce. La
   valeur était donc présente et non vide dans ce runner, sans qu'aucune
   valeur n'ait été lue : seul le chemin de code emprunté (jusqu'à la
   tentative réelle, pas le court-circuit) l'établit.

2. **Défaut de la fixture/recette (script) — ÉCARTÉE.**
   `git diff 4f26a3723b77…e6c7948769c8…` sur `outils/recette-navigateur-test.js`,
   `nexus-auth.js`, `NEXUS-App-v1.html` et tout `supabase/` : **zéro
   différence** entre le dernier run `push` connecté vert (`4f26a37`,
   15 h 55) et le candidat (`e6c7948`, 17 h 24). Le script qui a réussi à
   15 h 55 est, au caractère près, celui qui échoue à 17 h 24.

3. **Défaut applicatif (écran de connexion) — ÉCARTÉE par le même diff.**
   Aucun fichier touchant l'authentification n'a changé entre le dernier
   succès et cet échec. Un code inchangé ne peut pas expliquer un écart de
   comportement sans changement externe.

4. **Compte Manager Test / PIN sur Supabase Test — seule cause candidate
   restante, non confirmée sans lecture de secret.** Par élimination des
   trois précédentes, et par similarité exacte avec le mécanisme déjà
   observé et refermé pour le défaut 11 (résolu uniquement par réalignement
   humain du PIN, retry vert sans aucun changement de code), la cause la
   plus probable est un désaccord entre le secret GitHub
   `NEXUS_TEST_MANAGER_PIN` et le code PIN réellement actif pour `Manager
   Test` sur Supabase Auth **Test**. Le confirmer demanderait de lire ou de
   faire rejouer une valeur de secret — gate humaine, non franchie ici.

**Ce que ceci N'est PAS** : une décision de fondateur. C'est une opération de
recette Test — alimenter/corriger la base de recette Test — déjà
pré-autorisée (§1 des pré-autorisations, `CLAUDE.md`). Transmis ici comme
blocage externe précis (vérifier/réaligner `NEXUS_TEST_MANAGER_PIN`), pas
comme arbitrage métier.

## Conséquence pour la gate

`ci_et_guardians_conformes` reste **BLOQUE** sur le candidat courant — plus
pour §7/§12 (non reproduits sur ce SHA), mais pour le défaut 13, avec quatre
causes candidates réduites à une par élimination factuelle. Le verdict global
reste **NON_PRET**. Je ne demande PAS la préparation de la gate finale : ce
critère technique n'est pas objectivement satisfait.

## Fichiers modifiés

- `docs/handoff/lots/NEXUS-PRODUCTION-READINESS-1-20260908/blocages-ouverts-1.md` — §12 fermé, §7 point de non-reproduction, §13 ouvert avec isolation par élimination des quatre causes candidates.
- `docs/handoff/lots/NEXUS-PRODUCTION-READINESS-1-20260908/faits-pret-pour-production.json` — `aucunBlocageNonResolu.preuve` mise à jour en conséquence.

## Invariants respectés

Aucun changement `main`/`production`, aucune écriture ni migration Supabase
Production ou Test, aucun secret/PIN/service_role lu, rotationné ou exposé,
aucun fichier applicatif touché, aucune nouvelle architecture. Migration 21
reste exclue de la release Production, inchangée.
