---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-PRODUCTION-READINESS-1-20260908
seq: 10
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=10c65d0 production=d5a8b77
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=10c65d0_production=d5a8b77
  - id: integration-request-9
    classe: VERIFIED
    valeur: fast-forward_e6c7948_vers_6a928421_diff_limite_a_docs_handoff
  - id: retry-34508015447-confirme
    classe: VERIFIED
    valeur: job_103019056699_log_borne_meme_symptome
  - id: troisieme-reproduction-6a928421
    classe: VERIFIED
    valeur: run_34521983568_push_echec_meme_etape
  - id: causes-ecartees-revalidees
    classe: VERIFIED
    valeur: diff_applicatif_nul_secretsManquants_non_declenche
  - id: hypothese-frequence-non-confirmee
    classe: DECLARED
    valeur: 27_runs_push_aujourdhui_rate_limit_non_exclu_non_prouve
  - id: verdict-recalcule
    classe: VERIFIED
    valeur: ci_et_guardians_conformes_BLOQUE_verdict_NON_PRET
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune_requete_aucun_merge_aucun_deploiement
---
# Défaut 13 confirmé reproductible trois fois, sur deux commits distincts — même conclusion, cause toujours externe

## Ce qui était demandé

Observer la relance du job échoué de `34508015447` (job `103019056699`)
jusqu'à son verdict, distinguer les causes sans lire de secret, vérifier
l'absence de mutation concurrente de l'identité Auth `Manager Test`, et
rendre un verdict Readiness. Le brouillon déjà préparé sur une branche non
intégrée (`claude/issue-28-20260910-1914`, commit `6a928421`, republiant
`request-9.md`) a été intégré sur `config-par-environnement` au tout début de
cette session, par fast-forward simple, diff strictement limité à
`docs/handoff/` — aucun fichier applicatif, vérifié (`git diff e6c7948..6a92842
-- ':!docs/handoff'` vide).

## Retry de `34508015447` — échec identique, confirmé indépendamment

Job `103019056699` relu via `gh run view --log-failed` (log borné, aucune
valeur de secret, seulement les noms de variable masqués `***`) : même
symptôme exact que le job initial et que le défaut 11 déjà fermé — connexion
`Manager Test`, 30 s sur l'écran de login, « Prénom ou code PIN incorrect. »
Version servie confirmée `e6c7948769c8e1aa6a2690d1c6e5b782f56f7ea9`, exactement
le candidat attendu.

## Troisième reproduction, sur le commit fraîchement intégré — la cause n'est pas un blip

L'intégration de `request-9.md` déclenche mécaniquement un nouveau run `push`
sur `config-par-environnement` (`34521983568`, commit `6a928421`, celui-là
même qui vient d'être intégré). Observé jusqu'au verdict dans cette session :
**échec identique**, même étape, même message, version servie confirmée
`6a928421c458d5b108f74c996f2812691848ff8d`. Log relu, borné, aucun secret.

Trois échecs consécutifs — job initial de `34508015447`, sa relance
`103019056699`, et `34521983568` sur un commit qui ne touche que des fichiers
`docs/handoff/` — sur deux SHA distincts dont le diff applicatif est nul.
**Ce n'est plus une occurrence isolée : c'est un état stable.** L'hypothèse
d'un incident transitoire (comme celui refermé pour le défaut 11, où une
seule relance avait suffi) ne tient plus. Les quatre causes déjà écartées par
élimination dans `request-9.md` (secret absent du runner, défaut de script,
défaut applicatif) restent écartées pour les mêmes raisons, revérifiées sur
ces deux nouveaux runs : mêmes fichiers inchangés, même chemin de code
atteint (tentative réelle puis timeout, jamais le court-circuit précoce de
`secretsManquants()`).

## Hypothèse supplémentaire posée, non confirmée — fréquence des tentatives de connexion CI

Mission point 4 (« workflows concurrents ») : aucune mutation applicative
identifiée. Une observation chiffrée nouvelle, à verser au dossier sans
trancher : **27 runs `push` du workflow `Tests` sur `config-par-environnement`
rien qu'aujourd'hui** (10/09/2026, avant celui-ci), dont la majorité exécute
réellement l'étape de connexion (deux tentatives `signInWithPassword` par run
non dégradé — `Manager Test` puis `Créateur Test`). Un volume de cet ordre est
compatible avec un plafond de limitation de débit de Supabase Auth atteint sur
l'identité `Manager Test` précisément — ce qui produirait exactement le même
symptôme générique côté écran (`NEXUS-Login-v1.html` fusionne délibérément
tout `authError` renvoyé par `signInWithPassword` dans le même message REFUS,
qu'il s'agisse d'un PIN erroné, d'un compte désactivé ou d'un rejet de débit :
seule une exception réseau produit un message distinct, et ce n'est pas ce qui
est observé ici). **Non confirmée** : la distinguer du désalignement de PIN
déjà retenu demanderait de lire le journal Auth de Supabase Test, hors de
portée sans secret depuis ce canal. Les deux causes ne s'excluent pas et
appellent la même vérification humaine.

## Défaut 13 — statut inchangé : blocage externe, geste humain unique

Cause la plus probable inchangée par rapport à `request-9.md` : désaccord
entre `NEXUS_TEST_MANAGER_PIN` (secret GitHub) et le code PIN réellement actif
pour `Manager Test` sur Supabase Auth Test — éventuellement aggravé ou masqué
par un plafond de débit atteint après ~27 tentatives dans la journée. Les deux
se vérifient par le même geste, déjà pré-autorisé (§1 `CLAUDE.md`, alimenter/
corriger la base de recette Test) : ouvrir le tableau de bord Supabase Test,
confirmer que `Manager Test` n'est ni verrouillé ni rate-limited, et si besoin
réaligner le PIN comme cela avait déjà résolu le défaut 11.

**Ce que ceci n'est pas** : une décision de fondateur, ni un correctif de code
applicable depuis ce canal — aucun fichier de recette ou d'authentification
n'est en cause, revérifié deux fois de plus dans cette session.

## Verdict Readiness

`ci_et_guardians_conformes` reste **BLOQUÉ** sur le candidat courant
(`6a928421c458d5b108f74c996f2812691848ff8d`, désormais HEAD de
`config-par-environnement`) : run `push` `34521983568` en échec sur l'étape
« Recette navigateur NEXUS Test ». Verdict global : **NON_PRET**. `PRÊT` ne
vaudrait de toute façon jamais autorisation Production — la gate finale reste
entièrement celle de Frédéric.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase (aucun
identifiant disponible depuis ce canal), aucune promotion Production, aucun
secret/PIN/service_role lu, affiché ou exposé — seuls des noms de variables
masqués (`***`) et des messages d'écran ont été lus. Migration 21 reste
exclue de la release Production, inchangée. Aucun fichier applicatif touché.
