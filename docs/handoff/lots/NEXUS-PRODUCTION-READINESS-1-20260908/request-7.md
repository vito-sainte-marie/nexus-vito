---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-PRODUCTION-READINESS-1-20260908
seq: 7
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=10c65d0 production=501c0c7
  - id: reconciliation
    classe: VERIFIED
    valeur: decision-6 deja consommee proprement, verifier conforme sans rattrapage
  - id: preuves-anterieures-auditees
    classe: DECLARED
    valeur: relues, non rejouees, aucun acces reseau/gh depuis ce canal
  - id: cause-isolee-pointage
    classe: VERIFIED
    valeur: pointage_actif=false sur nexus-station-test, verrou NEXUS-Pointage-v1.html:507
  - id: correctif-teste
    classe: VERIFIED
    valeur: test_pointage_desactive_recette_20260910.js 6/6, mutation negative reelle
  - id: regression-recette
    classe: VERIFIED
    valeur: test_recette_navigateur_test_20260907.js 53/53 inchange
  - id: regression-globale
    classe: VERIFIED
    valeur: 245/254, 9 echecs historiques identiques, 0 regression
  - id: guardians
    classe: VERIFIED
    valeur: guardians-router 1 finding connu NexusStock ARCH-002, verifier-apprentissage conforme, guardian-qa 0 finding
  - id: employe-b
    classe: DECLARED
    valeur: aucun scenario, cadrage produit distinct 2026-09-09, non code ici
  - id: recette-reelle-post-correctif
    classe: NOT_APPLICABLE
    valeur: aucun acces navigateur/Supabase Test depuis ce canal
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete, aucun merge, aucun deploiement
---
# Cause isolée sur le scénario employé (pointage) — défaut de fixture/recette, corrigé

## 1. Réconciliation du rail — rien à rattraper cette fois

Ce checkout démarre exactement au HEAD canonique cité par le réveil
(`d7ffee32040c57d2e6d360e5559139df0b9a0c9e`), confirmé ancêtre de
`origin/config-par-environnement`. `docs/handoff/STATE.json` porte déjà, pour
`NEXUS-PRODUCTION-READINESS-1-20260908` :

```
statut            : DECISION_CONSOMMEE
derniere_decision : decision-6.md
commit_decision   : c3ba2a7f73c84be8fc3dce7b6817331a8db6c0b2
```

commit identique à celui cité dans le réveil. `node outils/handoff.js verifier`
est conforme (29 lots, 10 avertissements préexistants, 0 nouvelle erreur) —
première fois dans ce lot qu'aucune réconciliation (`enregistrer-lot`,
`rattraper-demande`) n'était nécessaire avant de poursuivre.

## 2. Audit des preuves déjà documentées — pas rejouées

`preuve-repetition-executee-1.md` (run `34360255750`) et
`preuve-recette-navigateur-1.md` (runs `34378108761` et `34379171491`) ont été
relues, pas rejouées : ce canal n'a ni accès réseau vers `nexus-test`, ni `gh`
fonctionnel (`gh auth status` requiert une approbation qu'aucun humain ne peut
donner dans ce run automatisé — confirmé une nouvelle fois). Elles restent
internement cohérentes avec le code actuel :
- `preuve-repetition-executee-1.md` documente une reconstruction réelle depuis
  zéro (262 migrations, 4 défauts trouvés et corrigés) et le calcul Carburants
  identique avant/après — propriété que ce type de répétition doit établir ;
- `preuve-recette-navigateur-1.md` documente la preuve UI Carburants et les
  deux preuves d'accès Live comme satisfaites, plus la prise de poste employé
  (y compris quart déjà ouvert) le 09/09/2026 — cohérent avec le code présent
  dans ce checkout.

Aucune de ces preuves n'a donc été rejouée ; ce n'était ni nécessaire ni
possible depuis ce canal.

## 3. Recette navigateur restante — cause isolée, corrigée (défaut de fixture/recette)

Les trois derniers commits du HEAD canonique (`cc6c9ae`, `fceaa13`, `28bcfb8`,
09/09/2026 en soirée) documentaient une enquête inachevée : l'invitation à
l'inventaire restait « NON JUGÉE » parce que le pointage d'arrivée n'était
jamais franchi par la recette, et le dernier commit se terminait
explicitement sur « CAUSE NON ISOLÉE ».

**Cause isolée par lecture de code, confirmée par recoupement de deux sources
indépendantes :**

- `NEXUS-Pointage-v1.html:507-513` affiche un verrou défensif — « Le pointage
  est désactivé sur ce site. » — et **ne rend jamais** `#photoInput-arrivee`
  quand `station_config.pointage_actif === false`. C'est exactement le
  symptôme observé (« champ photo d'arrivée absent »).
- `nexus-station-test` a `pointage_actif=false` depuis le 07/09/2026 (réveil
  de cette issue, 2026-09-07T00:36:00Z, autorisation explicite de Frédéric :
  « le pointage est désormais désactivé côté nexus-test pour
  nexus-station-test »), précisément pour simplifier la navigation des trois
  profils de recette.

Ce verrou est un comportement **voulu** (16/08/2026, demande de Frédéric —
« mets une option dans les paramètres station pour activer ou non le pointage
des employés »), pas un défaut de release. Le défaut est dans la **recette** :
`franchirPointageArrivee` a été écrite (09/09/2026) sur l'hypothèse que
`nexus-auth.js` impose toujours la séquence pointage → accueil — vraie
seulement quand `pointage_actif` n'est pas `false`, ce qu'elle ne vérifiait
jamais.

**Classification demandée par le réveil :**
- **Défaut de release : NON.** Le verrou et sa désactivation sont tous deux
  des comportements demandés et déjà autorisés par Frédéric à des dates
  distinctes.
- **Défaut de fixture/recette : OUI.** `franchirPointageArrivee` attendait
  indéfiniment un champ qui ne devait pas exister, au lieu de reconnaître une
  dispense légitime.
- **Simple instrumentation : les trois commits précédents (cc6c9ae, fceaa13,
  28bcfb8)**, qui ont permis d'observer le symptôme sans l'expliquer.

**Correctif appliqué** (`outils/recette-navigateur-test.js`) : nouvelle
fonction pure exportée `pointageDesactive(texteEcran)`, consultée **avant**
l'attente de `#photoInput-arrivee`. Si le verrou est détecté, le pointage est
traité comme non requis (`{ franchi: true, motif: null, desactive: true }`)
plutôt que comme un échec après 20 s d'attente vaine. Le rapport imprimé
distingue désormais explicitement « non requis — pointage désactivé sur ce
site » de « franchi avec succès », pour ne jamais confondre les deux preuves.

**Preuves réellement exécutées** (`node`, pas de trace manuelle) :
- Nouveau `test_pointage_desactive_recette_20260910.js` — **6/6**, dont :
  le libellé réel extrait de `NEXUS-Pointage-v1.html` (pas recopié à la main)
  est reconnu ; un écran de formulaire normal n'est jamais confondu avec le
  verrou ; observation vide/absente ne plante jamais ; **mutation négative
  réelle** — le correctif retiré du fichier, rejoué contre la même épreuve,
  est bien détecté comme manquant ; le rapport distingue les deux issues.
- `test_recette_navigateur_test_20260907.js` (existant) — **53/53**, inchangé.
- `node run-tests.js` → **245/254**, les 9 échecs strictement identiques à la
  liste historique tolérée (inventaire/réception/DOM), **0 régression**.
- `node outils/guardians-router.js` sur le diff réel → 1 finding, la collision
  `NexusStock` déjà connue et tracée (`ARCH-002`, non bloquante par arbitrage
  Q73/Q74) — **0 nouveau finding**.
- `node outils/verifier-apprentissage.js` → conforme, 20 règles.
- `node outils/guardian-qa.js` → 0 finding, 254 épreuves analysées.
- `node outils/handoff.js verifier` → conforme après dépôt.

**Ce qui reste, honnêtement** : ce correctif n'a pas pu être **rejoué contre
un vrai navigateur/`nexus-test`** depuis ce canal (aucun accès Playwright ni
Supabase Test ici) — seule la logique est prouvée par test unitaire et
mutation négative. La preuve « Invitation à l'inventaire sur l'accueil »
reste donc `NON JUGÉE` **jusqu'à un nouveau run CI** sur `config-par-environnement`
qui exécute réellement la recette avec ce correctif.

## 4. Employé B — classé, pas corrigé

`NEXUS_TEST_EMPLOYEE_B_PIN` existe et reste inutilisé : **aucun défaut**, ni
de release ni de recette. `docs/plans/2026-09-09-experience-employe-cadrage.md`
(cadrage produit de Frédéric, 09/09/2026) documente explicitement que le
second employé attend un scénario dédié, et que « aucune ligne de code
n'accompagne ce document, volontairement » — l'ordre des gestes par rôle est
un arbitrage produit encore ouvert (§8 du cadrage), distinct de ce lot de
readiness Production. Rien n'a été codé pour Employé B ici : l'injecter sans
scénario aurait fabriqué une preuve vide, exactement ce que le fichier lui-même
interdit.

## 5. Pourquoi le package n'est pas encore complet pour les re-mesures Production

Le correctif de ce tour est déterministe et prouvé en logique, mais **pas
encore confirmé par une exécution réelle** de la recette sur `nexus-test`. Le
publier comme « invitation à l'inventaire satisfaite » sans ce run serait
fabriquer une preuve — exactement ce que le protocole interdit. Il manque donc
un geste Orchestrator, pas un arbitrage Frédéric :

1. intégrer ce correctif sur `config-par-environnement` (ce canal ne peut
   pousser que sur sa propre branche) ;
2. obtenir un run CI réel sur cette branche (push normal — la recette
   navigateur y tourne déjà, hors `workflow_dispatch` de répétition
   destructive) et lire son verdict sur l'invitation à l'inventaire ;
3. si ce verdict est satisfait, le package est complet pour les re-mesures
   Production SELECT-only et la préparation de la gate finale — sinon,
   revenir avec la nouvelle observation.

Aucune décision fondatrice n'est nécessaire pour ces trois points.

## Invariants respectés

Aucun changement `main`/`production`, aucune écriture ni migration Supabase
Production ou Test, aucun secret créé/rotationné/exposé, aucun fichier
`.github/workflows/*` créé ou modifié, aucune ressource facturable nouvelle,
aucune donnée personnelle Production. Migration 21 reste exclue de la release
Production, inchangée. `Prêt pour Production` non revendiqué.
