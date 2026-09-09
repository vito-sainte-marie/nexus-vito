# Critères « Prêt pour Production » — NEXUS Live

Implémentés dans `nexus-live-criteres-production.js` (module pur, testé par
`test_nexus_live_criteres_production_20260909.js`, 14/14, mutation négative
vérifiée). Résume exécutable de `procedure-release-production-1.md`.

## Les sept critères, fail-closed

| Critère | OK quand | BLOQUE quand | INCONNU quand |
|---|---|---|---|
| `ci_verte_sur_candidate` | CI verte sur le commit exact de la candidate | CI rouge | fait non fourni |
| `rail_handoff_conforme` | `handoff.js verifier` conforme | non conforme | fait non fourni |
| `manifeste_migrations_a_jour` | toutes les migrations classées | migration non classée trouvée | fait non fourni |
| `mesures_production_fraiches` | horodatage ≤ 24h avant l'évaluation | horodatage > 24h | absent, illisible, ou dans le futur |
| `fenetre_deploiement_confirmee` | activité mesurée et documentée | fenêtre jugée à risque | fait non fourni |
| `sauvegardes_prealables` | exports `SELECT` de #3/#5/#6 faits | non faits | fait non fourni |
| `gate_humaine_frederic` | `autorise: true`, nommant la release exacte et un impact précis | absente, refusée, ou nommant une AUTRE release | présente mais incomplète (pas d'impact nommé) |

**Un seul critère `BLOQUE` interdit `PRET_POUR_PRODUCTION`**, quel que soit
l'état des autres. **Un seul critère `INCONNU` (et aucun `BLOQUE`) donne un
verdict global `INCONNU`**, jamais `PRET_POUR_PRODUCTION` par défaut. Le
verdict `PRET_POUR_PRODUCTION` exige les sept critères à `OK` simultanément.

## Pourquoi la gate humaine ne peut jamais être déduite

`gate_humaine_frederic` exige un objet nommant explicitement la release
(SHA) qu'elle autorise. Si ce SHA ne correspond pas exactement à la
candidate évaluée, le critère est `BLOQUE` — jamais confondu avec une
autorisation antérieure sur une autre release. C'est la traduction directe
de l'invariant NEXUS : « aucune promotion en Production — aucune décision de
recette n'y équivaut » et « la gate finale reste Frédéric, pour une release
précise et un impact précis ».

## État actuel pour la candidate `ba1eed0e833c354f556128dc0ee4b0619725ed1a`

Tous les sept critères sont **INCONNU** au moment de ce lot : aucun fait n'a
été fourni à ce module depuis ce canal (ni CI sur cette candidate précise
constatée depuis ici, ni mesure Production de moins de 24h au moment de
l'écriture, ni gate humaine formulée sous cette forme). Le verdict est donc
**INCONNU**, jamais `PRET_POUR_PRODUCTION` — cohérent avec le fait qu'aucune
promotion n'a été demandée ni autorisée dans ce lot.

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
peut par construction jamais annoncer `PRET_POUR_PRODUCTION` sans preuve.
