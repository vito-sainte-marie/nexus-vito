---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-PRODUCTION-READINESS-1-20260908
seq: 11
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=10c65d0 production=d5a8b77
  - id: rail-reconcilie
    classe: VERIFIED
    valeur: decision-9.md consommee, STATE.json/DECISION.md regeneres, handoff.js verifier conforme
  - id: verdict-recalcule
    classe: VERIFIED
    valeur: node outils/evaluer-pret-pour-production.js sur HEAD f5ba864, PRET_POUR_PRODUCTION
  - id: ci-deux-evenements-verts
    classe: VERIFIED
    valeur: gh run list --commit f5ba864, pull_request success et push success
  - id: mesures-fraiches
    classe: DECLARED
    valeur: horodatage 2026-09-10T14:02:14Z, expire 2026-09-11T14:02:00Z
  - id: regression-locale
    classe: VERIFIED
    valeur: node run-tests.js, aucune regression, 9 echecs historiques inchanges
  - id: guardians
    classe: VERIFIED
    valeur: node outils/guardians-router.js, 0 finding
  - id: request-11-branches-non-rapatrie
    classe: DECLARED
    valeur: six branches SUPERSEDEE au SHA exact, commit f5ba864, aucun correctif absent
  - id: gate-humaine
    classe: NOT_APPLICABLE
    valeur: aucune gate formulee, appartient exclusivement a Frederic Bragance
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune ecriture, aucun merge, aucun deploiement
---
# Demande de gate finale Production — spécifique à Frédéric Bragance

Rail Handoff réconcilié dans ce tour : `decision-9.md` (APPROVED, closes:false,
en réponse à `request-10.md`) a été consommée via `node outils/handoff.js
consommer`. `STATE.json` reflète désormais `statut: DECISION_CONSOMMEE`,
`derniere_decision: decision-9.md`. Aucun fichier applicatif touché, aucune
réécriture d'un dépôt du registre.

`request-11.md` cité dans un réveil précédent comme absent de six branches
`claude/issue-28-20260910-*` n'est PAS celui-ci : ces branches sont classées
`SUPERSEDEE` dans `docs/handoff/BRANCHES-CLASSEES.json` (commit `f5ba864`,
21/21 sur la garde `garde-branches-en-rade.js`) et ne portent aucun correctif
absent du candidat. Cette demande est la première `request-11.md` réellement
déposée dans ce répertoire de lot.

## Verdict recalculé sur le HEAD exact

```
node outils/evaluer-pret-pour-production.js
  candidat : f5ba864 (f5ba8641bb8117883cff42a302ba2c64618f7e5a)
  CI       : pull_request:success · push:success   (gh run list --commit f5ba864, mesuré à l'exécution)
  10/10 critères techniques : OK
  VERDICT               : PRET_POUR_PRODUCTION
  gate humaine Frédéric : INCONNU
  autorisation          : NON_AUTORISEE
```

Régression locale : `node run-tests.js` → aucune régression, seuls les 9
échecs historiques connus subsistent. `node outils/guardians-router.js` → 0
finding. `node outils/handoff.js verifier` → conforme (29 lots, 10
avertissements préexistants, 6 dérogations tracées).

**`PRÊT` ne vaut aucune autorisation Production.** Cette demande ne porte que
sur la formulation de la gate ; aucune opération n'est exécutée par ce
retour.

## SHA candidat exact

`f5ba8641bb8117883cff42a302ba2c64618f7e5a`, branche `config-par-environnement`.

## Impacts mesurés (six mesures SELECT-only, projet `uzhjpqpctpvxytxpxoqz`)

- Advisor (`seed_referentiel_advisor`) : 0 ligne créée, 0 ligne changée, 37
  lignes identiques (6 gabarits + 31 règles) ;
- `shifts.site_id` à réaligner : 17 lignes ;
- `mission_catalog.site` à réaligner : 89 lignes ;
- services `en_cours` au moment de la mesure : 21, dont 20 repris par la
  migration #6 (le 21ᵉ reste `en_cours` au sens du prédicat) ;
- écriture en vol au moment du contrôle : 0 ;
- `nexus_live_events` : absente en Production — migration #21 reste exclue de
  cette release (dépendance Test-only jamais promue).

## Fraîcheur des mesures

Horodatage : `2026-09-10T14:02:14Z`. **Expire le 2026-09-11T14:02:00Z.** Si la
gate de Frédéric intervient après cette expiration, les mesures doivent être
rejouées avant toute exécution — ce document ne les prolonge pas.

## Fenêtre de déploiement recommandée

Dimanche à mercredi, 22h00–23h00 heure locale (Martinique) — soit
02h00–03h00 UTC le lendemain —, démarrage juste après `:00`/`:15`/`:30`/`:45`.
Jeudi à samedi écarté (chevauchement avec la fin du quart 2). Choisie parce
que Frédéric est éveillé à cette heure, contrairement à 03h locale qui est
pourtant la plus calme mais sans personne pour constater un incident avant la
prise de poste de 05h45. Durée réelle de la promotion (26 migrations) non
chronométrée — démarrer juste après un top quart d'heure absorbe cette
inconnue. Détail : `mesure-fenetre-deploiement-1.md`.

## Plan de réparation / rollback

Principe déjà tranché par Frédéric : réparation en avant privilégiée,
rollback code distinct du rollback données.

- **Rollback code** (16 migrations du manifeste) : symétrique et déterministe
  pour la quasi-totalité (`DROP TRIGGER`/`DROP POLICY`/`CREATE OR REPLACE
  FUNCTION` vers la version antérieure) — jamais déclenché sans preuve
  mesurée de la régression qu'il corrige.
- **Rollback données**, seulement 3 migrations concernées :
  - **#3** (`site_id`/`site`) : valeur d'origine NON conservée par la
    migration → dump `SELECT` obligatoire AVANT exécution, sinon seule la
    réparation en avant reste possible ;
  - **#5** (Advisor) : `ON CONFLICT DO UPDATE` peut écraser un champ
    divergent → dump des 37 lignes concernées avant exécution (mesuré à 0
    écrasement sur l'état actuel, mais l'écart peut apparaître d'ici la
    gate) ;
  - **#6** (reprise services) : état d'origine reconstituable depuis le
    `WHERE` de la migration elle-même, mais réparation en avant reste
    préférée (un service clôturé à tort se corrige par un nouveau pointage
    manager, pas par une réécriture technique).

Détail complet : `plan-reparation-rollback-1.md`.

## Rappel explicite

`PRÊT POUR PRODUCTION` signifie uniquement que la release peut être soumise à
la décision de Frédéric — cela n'autorise aucune opération. La gate finale,
pour cette release et cet impact précis, reste exclusivement la sienne.
Aucune écriture/migration Supabase Production, aucun push/merge `main`/
`production`, aucun déploiement/rollback Production n'a eu lieu ni n'est
implicitement autorisé par ce document.
