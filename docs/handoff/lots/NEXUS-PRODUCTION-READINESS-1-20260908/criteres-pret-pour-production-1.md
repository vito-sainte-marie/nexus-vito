# Critères « Prêt pour Production » — NEXUS Live

Implémentés dans `nexus-live-criteres-production.js` (module pur, testé par
`test_nexus_live_criteres_production_20260909.js`, 27/27, mutation négative
vérifiée). Résumé exécutable de `procedure-release-production-1.md` et
traduction directe des dix critères listés par `decision-2.md` §7 de ce lot.

## Les dix critères de `PRET_POUR_PRODUCTION`, fail-closed

| Critère | OK quand | BLOQUE quand | INCONNU quand |
|---|---|---|---|
| `candidate_immuable_identifiee` | un SHA valide (7 à 40 caractères hexadécimaux) est fourni | — (un SHA absent ne « bloque » rien en soi, il rend le fait inconnu) | SHA absent ou mal formé |
| `ci_et_guardians_conformes` | CI verte **et** Guardians requis conformes, les deux fournis | l'un des deux est explicitement faux | l'un des deux (ou les deux) non fourni — l'autre vrai ne compense jamais |
| `rail_handoff_conforme` | `handoff.js verifier` conforme | non conforme | fait non fourni |
| `manifeste_migrations_a_jour` | toutes les migrations classées (incluse/exclue/bloquée) | migration non classée trouvée | fait non fourni |
| `impacts_production_mesures_horodates` | horodatage de la dernière mesure Production ≤ 24h avant l'évaluation | horodatage > 24h | absent, illisible, ou dans le futur |
| `aucun_impact_dml_inconnu` | chaque migration DML (comparateur Advisor inclus) a un impact chiffré, plus aucun `INCONNU` | un impact DML reste explicitement non chiffrable | fait non fourni |
| `preprod_anonymise_ou_equivalent` | PREPROD anonymisé construit et prouvé, ou répétition équivalente conforme avec preuve de confidentialité | la construction a échoué une preuve de confidentialité | non construit — état actuel de ce lot, voir `plan-preprod-anonymise-1.md` |
| `repetition_migrations_recette_reussie` | migrations + recette rejouées hors Production avec succès | échec constaté lors d'une répétition | non encore rejouées |
| `plan_reparation_rollback_documente` | le plan existe et couvre chaque migration DML (voir `plan-reparation-rollback-1.md`) | plan absent ou incomplet sur une migration DML | fait non fourni |
| `fenetre_deploiement_confirmee` | activité mesurée fraîchement et documentée comme sûre | fenêtre jugée à risque | fait non fourni |
| `aucun_blocage_non_resolu` | aucun blocage sécurité/architecture/données ouvert et pertinent pour cette release | un blocage connu reste ouvert | fait non fourni |

**Un seul critère `BLOQUE` interdit `PRET_POUR_PRODUCTION`**, quel que soit
l'état des autres. **Un seul critère `INCONNU` (et aucun `BLOQUE`) donne un
verdict global `INCONNU`**, jamais `PRET_POUR_PRODUCTION` par défaut. Le
verdict `PRET_POUR_PRODUCTION` exige les dix critères à `OK` simultanément —
**sans la gate humaine**, volontairement (voir ci-dessous).

## Pourquoi la gate humaine n'est PAS un onzième critère de `PRET_POUR_PRODUCTION`

`decision-2.md` §7 le dit explicitement : « `Prêt pour Production` signifie
seulement que la release **peut être soumise** à Frédéric. Cela n'autorise
jamais Production. » Si la gate humaine était l'un des dix critères,
`PRET_POUR_PRODUCTION` ne pourrait jamais être atteint AVANT que Frédéric
n'ait déjà tranché — ce qui viderait le verdict de son sens : il ne pourrait
plus jamais servir à lui soumettre quoi que ce soit, seulement à confirmer
après coup une décision déjà prise ailleurs.

Le module calcule donc `gate_humaine_frederic` et `autorisation_production`
**séparément** de `verdict` :

- `gate_humaine_frederic` : `OK` seulement si un objet nomme explicitement la
  release (SHA) évaluée, `autorise: true`, et un `impact` précis. Absent →
  `INCONNU`. Nommant une AUTRE release → `BLOQUE`, jamais confondu avec une
  autorisation antérieure. C'est la traduction directe de l'invariant NEXUS :
  « aucune promotion en Production — aucune décision de recette n'y
  équivaut » et « la gate finale reste Frédéric, pour une release précise et
  un impact précis ».
- `autorisation_production` : `AUTORISEE` **seulement si** `verdict ===
  PRET_POUR_PRODUCTION` **ET** `gate_humaine_frederic === OK` simultanément.
  Jamais l'un sans l'autre, jamais déduit d'un seul des deux.

## État actuel pour la candidate `ba1eed0e833c354f556128dc0ee4b0619725ed1a`

Les dix critères sont **INCONNU** au moment de ce lot : aucun fait n'a été
fourni à ce module depuis ce canal (ni CI sur cette candidate précise
constatée depuis ici, ni PREPROD construit, ni répétition de migrations
rejouée). `gate_humaine_frederic` est également `INCONNU` — aucune gate n'a
été formulée sous cette forme. Verdict et autorisation sont donc `INCONNU` /
`NON_AUTORISEE`, cohérent avec le fait qu'aucune promotion n'a été demandée
ni autorisée dans ce lot.

**Précision sur `preprod_anonymise_ou_equivalent` (09/09/2026)** : ce lot a
identifié `nexus-test` comme la répétition équivalente cherchée en premier
par `decision-3.md` avant tout PREPROD construit depuis un dump Production —
voir `plan-repetition-preprod-test-1.md`. Ce projet ne contient par
construction aucune donnée personnelle (comptes `compte_test=true`
uniquement), ce qui ferme ce critère sans anonymisation à condition que la
reconstruction (`outils/reconstruire-base-test.sh`) et la recette associée
soient réellement rejouées et réussies — pas seulement proposées. Tant que
cette exécution n'a pas eu lieu, le critère reste `INCONNU`, jamais `OK` par
anticipation.

## Intégration à NEXUS Live — non faite dans ce lot, par précaution

`nexus-live-projection.js` (le calcul du verdict global de l'écran Live,
`Normal`/`Vigilance`/`Intervention`) est un fichier vivant, modifié
directement par Frédéric dans les heures précédant ce lot. Plutôt que d'y
insérer un nouveau champ sans revue approfondie de ses ~800 lignes et de
risquer une régression sur un écran déjà en évolution active, ce module a
été livré **autonome et testé**, prêt à être consommé par
`nexus-live-projection.js` (ou directement par un futur événement Live de
type `readiness`) dès qu'une session dispose du temps de revue nécessaire
pour l'y brancher sans perturber le calcul existant. C'est un choix de
prudence, pas un abandon de la demande : le calcul existe, est testé, et ne
peut par construction jamais annoncer `PRET_POUR_PRODUCTION` ni
`autorisation_production: AUTORISEE` sans preuve.
