---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-PRODUCTION-READINESS-1-20260908
seq: 3
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=10c65d0 production=501c0c7
  - id: rail-reconcilie
    classe: VERIFIED
    valeur: enregistrer-lot integre selectivement, decision-3 Philosophie consommee 90276b4, decision-2 Readiness consommee e364b781, handoff.js verifier conforme
  - id: outil-enregistrer-lot
    classe: VERIFIED
    valeur: test_handoff_enregistrer_lot 7 sur 7, test_handoff_v2 53 sur 53
  - id: comparateur-advisor
    classe: VERIFIED
    valeur: comparaison-seed-referentiel-advisor.sql, aucun verbe d ecriture, valeurs recopiees de la migration
  - id: manifeste-migrations
    classe: VERIFIED
    valeur: 16 incluses, 4 exclues Test-CI, migration 21 bloquee-exclue faute de migration Production dediee
  - id: plan-preprod
    classe: DECLARED
    valeur: conception uniquement, statut INCONNU-NON_CONSTRUIT assume
  - id: plan-rollback
    classe: VERIFIED
    valeur: rollback code-donnees distingues, fenetre de deploiement documentee fail-closed
  - id: procedure-release
    classe: VERIFIED
    valeur: 11 etapes, gate humaine etape 8 non automatisable
  - id: criteres-pret-production
    classe: VERIFIED
    valeur: dix criteres decision-2 implementes, gate humaine separee de PRET_POUR_PRODUCTION, test 27 sur 27
  - id: regression-globale
    classe: VERIFIED
    valeur: 228 sur 237, 9 echecs historiques identiques, 0 regression
  - id: guardians
    classe: VERIFIED
    valeur: guardians-router 0 finding, verifier-apprentissage conforme 20 regles
  - id: mesure-production-lecture-seule
    classe: NOT_APPLICABLE
    valeur: deja deposee canoniquement par l Orchestrator, aucun acces Production depuis ce canal
  - id: preprod-construit
    classe: NOT_APPLICABLE
    valeur: non construit dans ce lot, conception seulement
  - id: repetition-migrations-recette
    classe: NOT_APPLICABLE
    valeur: necessite PREPROD ou acces equivalent hors Production, non disponible ici
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete, aucun merge, aucun deploiement
---
# Exécution de `decision-2.md` — comparateur Advisor, manifeste Test/CI, plans PREPROD/rollback/release, critères corrigés

## 1. Rail Handoff réconcilié sur le HEAD réellement canonique

Ce checkout démarrait exactement au HEAD attendu (`e364b781`, identique à
`origin/config-par-environnement` et au commit de `decision-2.md`) — aucun
obstacle de racine `main` cette fois. Deux réconciliations faites, dans
l'ordre où le registre les exigeait :

1. `decision-3.md` de `NEXUS-PHILOSOPHIE-LANGAGE-AUDIT-1-20260908` (verdict
   `APPROVED`, `closes: true`, déposée directement par Frédéric Bragance)
   était en attente de consommation. Consommée (`handoff.js consommer`,
   commit `90276b4`).
2. `NEXUS-PRODUCTION-READINESS-1-20260908` lui-même restait
   `LOT_HORS_REGISTRE` : `request-1.md`/`decision-1.md`/`request-2.md`/
   `decision-2.md`/`mesures-production-lecture-seule-1.md` existent déjà sur
   `config-par-environnement` (déposés directement), mais `STATE.json.lots`
   ne le savait pas — ce qui bloquait `verifier`/`consommer` pour tout le
   registre, pas seulement ce lot.

Le correctif `enregistrer-lot` de la branche précédente
(`claude/issue-28-20260909-0100`, jamais intégrée) a été **comparé fichier
par fichier** puis intégré **sélectivement**, sans merge global : seul
`outils/handoff.js` (diff vérifié identique à celui de cette branche) et
`test_handoff_enregistrer_lot_20260909.js` ont été repris. Rien d'autre de
cette branche n'a été fusionné aveuglément — les fichiers de fond
(inventaire, manifeste, comparateur, plans, critères) ont été relus un par
un et adaptés à l'état canonique actuel (§3-§7 ci-dessous), pas copiés tels
quels.

`enregistrer-lot NEXUS-PRODUCTION-READINESS-1-20260908` a rejoué les mêmes
contrôles d'enveloppe que `verifier` avant d'inscrire le lot (aucune
tolérance nouvelle), puis `decision-2.md` a été consommée (commit `e364b781`,
exactement le commit cité par le réveil). `handoff.js verifier` conforme
avant et après (29 lots, 10 avertissements tous préexistants, 0 nouvelle
erreur). Miroirs régénérés.

**Preuves** : `test_handoff_enregistrer_lot_20260909.js` 7/7,
`test_handoff_v2_20260905.js` 53/53 (repassé au vert — il échouait sur le
registre réel avant réconciliation, à cause du même défaut `LOT_HORS_REGISTRE`).

## 2. Comparateur read-only du référentiel Advisor (decision-2.md §3)

`comparaison-seed-referentiel-advisor.sql` : requête strictement `SELECT`,
vérifiée **sans aucun verbe d'écriture** (`insert`/`update`/`delete`/`drop`/
`alter`/`truncate`/`grant`/`revoke` — recherche explicite, zéro occurrence).
Reprend à l'identique les `VALUES` des deux inserts de
`20260905161500_seed_referentiel_advisor.sql` (6 gabarits `nexus_language_templates`
+ 31 règles `advisor_rules`), compare champ par champ aux tables réelles via
`LEFT JOIN`, distingue `COMPLETEE` (code absent) / `ECRASEE` (au moins un
champ divergent, liste exacte des champs) / `IDENTIQUE` (no-op), et un résumé
chiffré. Exécutable par l'Orchestrator via l'accès Production existant, sans
fournir de secret à Claude — conforme à la condition posée. **Ne suppose
aucun résultat** : le point d'attention n°1 de `inventaire-migrations-1.md`
reste `INCONNU` tant que cette requête n'a pas été exécutée.

## 3. Fermeture de dépendances des migrations Test/CI (decision-2.md §4)

`manifeste-migrations-production-1.md` : décision Orchestrator déterministe
appliquée, pas une gate fondateur. **16 migrations incluses**, **4 exclues
par défaut** (#16, #18, #19, #20 — chacune scopée Test/CI par son propre
en-tête, aucune dépendance Production démontrée ne les exige). **Migration
#21 classée BLOQUÉE/EXCLUE** : elle altère `nexus_live_events`, créée
**uniquement** par la migration Test-only #18 — aucune migration Production
dédiée n'existe pour cette table dans ce dépôt. Deux conditions de
déblocage explicites posées (migration Production dédiée avec RLS revue, ou
besoin Production démontré pour NEXUS Live) ; aucune tranchée ici, fail
closed. Aucune migration exécutée, aucune écriture Production.

## 4. Plan PREPROD anonymisé (decision-2.md §5)

`plan-preprod-anonymise-1.md` : conception uniquement, aucun dump Production
lu. Recensement des champs porteurs de donnée personnelle (lecture de
schéma), principe de mapping déterministe HMAC (clé éphémère, jamais
committée), traitement différencié texte structuré (substitution) vs texte
libre (remplacement générique — une retouche manuelle est explicitement
écartée comme risque d'oubli), dates et montants métier jamais altérés
(cohérence temporelle et valeur de test préservées). Trois éléments listés
comme manquants pour une preuve de confidentialité réelle (script
déterministe, épreuve automatisée de détection, revue humaine). **Statut
assumé : `INCONNU / NON CONSTRUIT`** — pas fabriqué à la hâte sans accès
Production pour le valider.

## 5. Réparation en avant / rollback (decision-2.md §6)

`plan-reparation-rollback-1.md` : rollback CODE (DDL/fonction, réversible
migration par migration) distingué du rollback DONNÉES (seules #3, #5, #6
écrivent des données existantes). Pour chacune des trois : ce qui doit être
dumpé AVANT exécution, si un rollback donnée est seulement théoriquement
possible ou réellement praticable, et pourquoi la réparation en avant reste
préférée pour #6 (principe déjà tranché par Frédéric, repris sans le
rouvrir). Fenêtre de déploiement : mesure du 08/09 reprise comme point de
référence (16 `en_cours`, 13 concernés par #6), avec critère fail-closed
explicite pour la prochaine mesure (variation > facteur 2 à expliquer avant
d'exécuter #6).

## 6. Procédure canonique de release (au-delà de decision-2.md, support à la gate finale)

`procedure-release-production-1.md` : 11 étapes séquentielles, de la
fixation de la candidate à la vérification post-application. Étape 8 (gate
humaine explicite de Frédéric) marquée **non automatisable par construction**
— aucune étape antérieure, même toutes vertes, ne vaut autorisation.

## 7. Critères `Prêt pour Production` — corrigés, pas seulement repris (decision-2.md §7)

`nexus-live-criteres-production.js` : la version préparée sur la branche
précédente ne couvrait que 7 critères consolidés et **fusionnait la gate
humaine dans le calcul de `PRET_POUR_PRODUCTION`** — ce qui contredit le
texte même de `decision-2.md` (« Prêt pour Production signifie seulement que
la release peut être soumise à Frédéric ») : avec cette fusion,
`PRET_POUR_PRODUCTION` ne pouvait jamais être atteint AVANT que Frédéric
n'ait déjà tranché, ce qui viderait le verdict de son usage prévu. Corrigé
avant dépôt, pas après coup :

- les **dix critères exacts** de `decision-2.md` §7 sont maintenant
  implémentés un par un (`candidate_immuable_identifiee`,
  `ci_et_guardians_conformes`, `rail_handoff_conforme`,
  `manifeste_migrations_a_jour`, `impacts_production_mesures_horodates`,
  `aucun_impact_dml_inconnu`, `preprod_anonymise_ou_equivalent`,
  `repetition_migrations_recette_reussie`,
  `plan_reparation_rollback_documente`, `fenetre_deploiement_confirmee`,
  `aucun_blocage_non_resolu`) ;
- `gate_humaine_frederic` et `autorisation_production` sont calculés **à
  part** : `PRET_POUR_PRODUCTION` n'exige que les dix critères ;
  `autorisation_production: AUTORISEE` exige en plus la gate, jamais l'un
  sans l'autre.

Module pur, aucun accès réseau/Supabase/secret — ne mesure rien lui-même,
compose un verdict fail-closed à partir de faits fournis par l'appelant.
Testé par `test_nexus_live_criteres_production_20260909.js`, réécrit pour
cette forme corrigée : **27/27**, incluant une épreuve qui retire chacun des
dix critères isolément (aucun ne doit pouvoir manquer sans empêcher
`PRET_POUR_PRODUCTION`) et une mutation négative documentée. Non câblé dans
`nexus-live-projection.js` (fichier vivant, en évolution active par
Frédéric, ~800 lignes non revues) — livré autonome et testé, prêt à être
consommé dès qu'une session dispose du temps de revue nécessaire.

Pour la candidate actuelle, les dix critères et la gate restent `INCONNU`
dans ce canal : aucun fait ne leur a été fourni ici (pas de CI observée sur
cette candidate précise depuis ce canal, PREPROD non construit, migrations
non rejouées) — verdict `INCONNU`, `autorisation_production: NON_AUTORISEE`.

## Preuves mesurées dans cette session

- `handoff.js verifier` : conforme avant et après chaque étape, 0 nouvelle
  erreur.
- `test_handoff_enregistrer_lot_20260909.js` : 7/7.
- `test_handoff_v2_20260905.js` : 53/53 (repassé au vert par la
  réconciliation du §1).
- `test_nexus_live_criteres_production_20260909.js` : 27/27.
- `node run-tests.js` (suite complète) : **228/237**, les 9 échecs
  strictement identiques à la liste historique tolérée par la CI
  (inventaire/réception/DOM, sans lien avec ce lot) — 0 régression.
- `outils/guardians-router.js` : 0 finding.
- `outils/verifier-apprentissage.js` : conforme, 20 règles, aucun doublon,
  aucune récurrence non promue.

## Ce que ce lot ne fait toujours pas — honnêtement

- **Aucune mesure Production nouvelle** n'a été faite depuis ce canal :
  celles déjà déposées dans `mesures-production-lecture-seule-1.md`
  (canonique, par l'Orchestrator) sont réutilisées telles quelles, jamais
  revérifiées par cette session qui n'a elle-même aucun accès Production.
- **PREPROD n'est pas construit** — seule sa conception existe.
- **Aucune répétition de migration/recette** n'a eu lieu hors Production
  (nécessiterait PREPROD ou un équivalent, indisponible ici).
- Le comparateur Advisor n'a pas été exécuté (aucun accès Production dans ce
  canal) — il est prêt à l'être par l'Orchestrator.

## Pourquoi un humain doit-il intervenir ici ?

Aucune décision de fondateur n'est nécessaire à ce stade : le manifeste
Test/CI applique un principe déjà canonique (isolation Test/Production),
sans laisser de choix produit réel ouvert. Le package de readiness n'est
**pas encore complet** pour la gate finale (PREPROD non construit,
répétition non faite, comparateur Advisor non exécuté, mesure Production non
fraîche à ce point) — ce retour documente une progression, pas une demande
d'arbitrage. Prochain réveil utile : une fois qu'une session dispose d'un
accès Production en lecture pour exécuter le comparateur Advisor, ou pour
construire/éprouver PREPROD.
