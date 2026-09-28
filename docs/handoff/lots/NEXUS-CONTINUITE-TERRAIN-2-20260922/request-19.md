---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 19
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=4a49bf4 production=2bc7b39
  - id: cause-racine-identifiee
    classe: VERIFIED
    valeur: candidat-merge-base-production-url-en-dur-ilike-pre-04-09
  - id: acl-non-accidentelle
    classe: VERIFIED
    valeur: migration-20260904175747-login-non-enumerable-lue
  - id: mecanisme-deja-existant-reutilise
    classe: VERIFIED
    valeur: nexus_identifiant_de_connexion-aucun-nouveau-mecanisme
  - id: correctif-livre-candidat
    classe: VERIFIED
    valeur: nexus-login-corrige-65-20260928.html-identique-octet-canonique
  - id: tests-deterministes-mutation
    classe: VERIFIED
    valeur: test_login_pre_auth_non_enumerable_65_20260928.js-21-sur-21
  - id: regression-suite-complete
    classe: VERIFIED
    valeur: 266-sur-275-9-echecs-connus-inchanges
  - id: guardians
    classe: VERIFIED
    valeur: guardians-router-1-finding-connu-guardian-qa-0-finding
  - id: recette-navigateur-65
    classe: NOT_APPLICABLE
    valeur: aucune-ecriture-candidate-aucun-reseau-secret-test-depuis-ce-canal
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Cause racine du login Test candidat #65 identifiée, correctif prêt à porter — NO GO inchangé

Réponse au réveil du 28/09/2026 sur le blocage « Recette navigateur authentifiée » /
« Prénom non reconnu » pour Manager Test.

## 1. Ce qui a été vérifié avant toute modification

`rebuild/carburants-65-20260922` (SHA `20af9f6f...`, confirmé identique au SHA cité) a pour
merge-base avec `handoff-continuite-20260920` **exactement `origin/production` (`501c0c7`)**.
Son `NEXUS-Login-v1.html` est donc antérieur à deux correctifs déjà conçus et déjà en service
sur ce rail :

1. il code en dur l'URL et la clé Supabase (`uzhjpqpctpvxytxpxoqz` = `REF_PRODUCTION` dans
   `outils/generer-config.js:40`) au lieu de lire `window.NEXUS_CONFIG` — indépendamment de
   l'environnement de build, cet écran viserait toujours Production ;
2. il interroge encore `employees_public` par `.ilike("nom", prenom)` en anonyme — le motif
   exact fermé le 04/09/2026 par
   `supabase/migrations/20260904175747_login_non_enumerable.sql`, avec deux messages de refus
   distincts (oracle d'énumération).

**L'ACL Test n'est pas accidentelle.** Cette même migration révoque délibérément `SELECT`
sur `employees_public` pour `anon`, en notant que la migration précédente
(`20260904105148_urgence_revoquer_acces_anonyme_vues_security_definer.sql`) ne l'avait laissé
que « provisoirement, cette vue devant être remplacée par une authentification non
énumérable ». Elle fournit dans le même geste le mécanisme minimal demandé : une fonction
`SECURITY DEFINER` (`nexus_identifiant_de_connexion(p_prenom text) returns text`) qui ne
renvoie qu'un `username` unique ou `NULL` (jamais une liste, jamais une autre colonne),
`EXECUTE` accordé nommément à `anon` après révocation de `PUBLIC`, et la vue repassée sous
RLS (`security_invoker = true`). Ce mécanisme est **déjà** celui qui tourne sur
`NEXUS-Login-v1.html` canonique. Aucun nouveau mécanisme n'a été inventé : celui qui existait
déjà n'avait simplement jamais été porté sur ce candidat.

Détail complet : `preuve-login-non-enumerable-corrige-65-20260928.md`.

## 2. Ce qui a été livré (candidat/Test uniquement)

`nexus-login-corrige-65-20260928.html` — copie exacte, vérifiée octet pour octet, du
`NEXUS-Login-v1.html` canonique en service. `git diff` entre le candidat original et le
canonique confirme que la totalité de la différence tient dans le bloc `<script>` (config
partagée, appel `.rpc("nexus_identifiant_de_connexion", ...)`, message de refus unifié) —
CSS/HTML/tête de fichier identiques. Aucun `GRANT` proposé, aucune migration écrite, aucun
fichier hors ce périmètre modifié.

## 3. Preuves — exécutées réellement, pas tracées

`test_login_pre_auth_non_enumerable_65_20260928.js` : **21/21**, dont la lecture du contrat
SQL réel, le fichier corrigé validé conforme et identique au canonique, **le candidat
original lu depuis son SHA git réel classé non conforme** (détecte l'URL Production codée en
dur, le lookup `ilike`, les deux messages distincts), et deux mutations négatives qui
réintroduisent chacune un défaut et sont détectées, avec contre-témoin vert restauré. Suite
complète : **266/275**, `Aucune régression : seuls les 9 échecs connus subsistent.`
Guardians : `guardians-router.js` 1 finding (collision `NexusStock`, dette déjà tracée,
non liée) ; `guardian-qa.js` 0 finding. `handoff.js verifier` : registre conforme.

## 4. Ce qui reste hors de portée de ce canal — honnête, pas contourné

Aucune écriture sur `rebuild/carburants-65-20260922` (obstacle de transport non-Production
identique à tous les réveils précédents de ce lot), aucun réseau ni identifiant vers le
projet Test `udljdqxerrbbbajxubfn`, aucun navigateur. `Preuve Test #65` n'a donc **pas** été
rejouée depuis ce canal. Point non tranché : les constats du réveil (`SELECT` absent pour
`anon`, `security_invoker=false`) suggèrent que ce projet Test n'a peut-être pas rejoué
`20260904175747_login_non_enumerable.sql` dans son état actuel — à confirmer par une session
avec accès à `supabase_migrations.schema_migrations` de ce projet avant de promouvoir le
correctif.

## 5. Verdict de la gate #65

**NO GO — `PRET_GATE_CREATEUR` non déclaré.** La cause du blocage est identifiée avec
certitude et un correctif prêt à appliquer est déposé (commandes de portage exactes dans la
preuve, §6). La recette navigateur authentifiée reste le seul geste bloquant restant, réservé
à une session disposant réellement de l'écriture candidate et des secrets Test — inchangé par
rapport à `decision-10.md` point 3.

## Interdits respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune migration, aucun
`GRANT` élargissant l'accès anonyme, aucun secret/PIN dans dépôt/logs/commentaire, aucune
promotion Production, aucune déclaration de gate au-delà de ce qui est réellement prouvé.
`NEXUS_BASE_BRANCH=handoff-continuite-20260920` reste canonique.
