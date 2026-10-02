---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 20
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=aaa26e5 production=adee9bb
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=aaa26e5-production=adee9bb-inchanges
  - id: ancestralite-6f92ad1
    classe: VERIFIED
    valeur: git-merge-base-is-ancestor-confirme-HEAD-217f6f4
  - id: rapatriement
    classe: VERIFIED
    valeur: rapatrier-vers-rail-RIEN_A_RAPATRIER
  - id: station-config-23502-statique
    classe: VERIFIED
    valeur: test_station_config_upsert_fuseau_horaire_23502_20261002.js-9-9
  - id: non-regression
    classe: VERIFIED
    valeur: run-tests-js-286-295-9-echecs-connus-identiques
  - id: handoff-verifier
    classe: VERIFIED
    valeur: 32-lots-15-avertissements-11-derogations-0-nouvelle-erreur
  - id: guardians
    classe: VERIFIED
    valeur: guardians-router-0-finding-apprentissage-conforme-guardian-qa-0-finding
  - id: epreuve-sql-vehicule
    classe: VERIFIED
    valeur: outils-epreuve-station-config-upsert-fuseau-horaire-23502-20261002-sql-relu-correct
  - id: preuve-comportementale-sql-reelle
    classe: NOT_APPLICABLE
    valeur: blocage-reseau-supabase-reconfirme-curl-gh-git-fetch-tous-refuses-approbation-non-accordable
  - id: workflow-dispatch-cablage
    classe: NOT_APPLICABLE
    valeur: edition-github-workflows-hors-permission-de-ce-canal
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement-aucune-migration
---
# Reprise 02/10/2026 (20:07) — confirmation du blocage externe réel sur la preuve comportementale SQL 23502, verdict `NO_GO_GATE_PRODUCTION`

Déposée en réponse au réveil du 02/10/2026 (issue #28, commentaire `6547953436` →
suivi par un second réveil identifié `NEXUS_BASE_BRANCH=handoff-continuite-20260920`,
« FERMER LES DEUX DERNIÈRES PREUVES TEST »). Ce document ne rejoue pas ce que
`request-19.md` a déjà établi : il vérifie que rien n'a changé, confirme
l'impossibilité structurelle de produire la preuve comportementale réelle depuis
ce canal, et rend le verdict demandé par la mission en cas de blocage externe
confirmé après diagnostic (mission §7).

## 1. Rapatriement (mission §1) — RIEN À TRANSPORTER, déjà confirmé

`HEAD` de ce checkout (`claude/issue-28-20261002-2007`) est **exactement**
`217f6f45652e408631acfaebc98fe71a6567149f` = `origin/handoff-continuite-20260920`.
`node outils/rapatrier-vers-rail.js` :

```
[NO_WORK] rapatriement-claude-vers-rail (RIEN_A_RAPATRIER) — « claude/issue-28-20261002-2007 »
est exactement le rail : il n'y a rien à transporter.
```

`request-19.md` et tout son contenu (correctif `6f92ad1`, épreuve SQL, manifeste
migration, test statique) sont donc déjà sur le rail canonique — aucun artefact
parasite introduit, aucune copie à faire.

`node outils/handoff.js verifier` → **conforme** : 32 lots, 15 avertissements,
11 dérogations — tous préexistants, **0 nouvelle erreur**.

## 2. Diagnostic du blocage réseau/Supabase — confirmé à nouveau, pas supposé

Trois tentatives réelles et distinctes dans cette session, chacune refusée pour
la même raison structurelle (« approbation requise, non accordable dans ce run
automatisé ») :

```
$ curl -sS --max-time 5 -o /dev/null -w "%{http_code}" https://api.github.com
→ This command requires approval
$ gh --version
→ This command requires approval
$ git fetch origin handoff-continuite-20260920
→ This command requires approval
```

Aucun identifiant Supabase Test n'est par ailleurs présent dans cet environnement
(vérifié par test booléen de présence, sans lire ni journaliser de valeur) :
`NEXUS_TEST_DB_URL`, `NEXUS_TEST_DB_URL_WRITE`, `SUPABASE_TEST_DB_URL_WRITE`,
`NEXUS_TEST_DB_PASSWORD` sont tous **absents**. Seul `NEXUS_TEST_URL` (l'URL
applicative, pas une connexion base) est présent — insuffisant pour exécuter
`psql` contre `nexus-test`.

**Conclusion sans ambiguïté** : ce canal (`issue_comment` sur `claude.yml`,
`permissions: contents: read`) ne peut matériellement exécuter ni une connexion
réseau sortante, ni une commande `gh`/`git fetch`, ni une session `psql`. C'est
la même limite structurelle documentée à chaque réveil de ce fil depuis le
06/09/2026 — reconfirmée ici, pas supposée par continuité.

## 3. L'épreuve SQL déjà préparée — relue, jugée correcte, aucune correction nécessaire

`outils/epreuve-station-config-upsert-fuseau-horaire-23502-20261002.sql` relu
intégralement : couvre bien le chemin INSERT (site neuf, aucune ligne
`station_config` existante) et le chemin conflit réel (site déjà configuré,
`on conflict (site) do update`), avec le payload exact de
`NEXUS-App-v1.html::rappelSauvegarderPrix` (jamais `fuseau_horaire`), AVANT
(23502 attendu dans les deux chemins) puis APRÈS (succès attendu, valeur
existante non écrasée), chaque partie sous sa propre transaction avec
`rollback` systématique — aucune ligne fabriquée ne survit. **Le véhicule est
correct : aucune correction n'était nécessaire.** Le seul obstacle est
l'absence d'accès pour l'exécuter (§2), pas un défaut du script.

## 4. Re-vérifications locales — toutes identiques à `request-19.md`, rien n'a dérivé

| Vérification | Résultat ce tour | Référence `request-19.md` |
|---|---|---|
| Ancêtralité `6f92ad1` → HEAD | confirmée (`git merge-base --is-ancestor`) | identique |
| Ancêtralité SHA testé `8546749` → HEAD | confirmée | identique |
| `test_station_config_upsert_fuseau_horaire_23502_20261002.js` | 9/9 | 9/9 |
| `node run-tests.js` | **286/295**, mêmes 9 échecs connus | 286/295 |
| `node outils/handoff.js verifier` | conforme, 0 nouvelle erreur | conforme |
| `node outils/guardians-router.js` | 0 finding (diff de ce tour) | 1 finding préexistant (NexusStock, diff différent) — aucun nouveau finding dans les deux cas |
| `node outils/verifier-apprentissage.js` | conforme, 21 règles | conforme, 21 règles |
| `node outils/guardian-qa.js` | 295 épreuves, 0 finding | identique |
| `origin/main` / `origin/production` | `aaa26e5` / `adee9bb` — inchangés | identique |

Aucune régression, aucune dérive depuis la qualification précédente. Le SHA
du rail (`217f6f4`) n'a pas changé depuis `request-19.md` : aucune nouvelle CI
n'a donc à être déclenchée (mission §5) — les runs déjà cités (`37017566149`,
`37038754613`) restent les preuves CI valides pour ce même HEAD, et je ne peux
ni les relire directement (§2) ni en déclencher de nouveaux depuis ce canal.

## 5. Ce qui reste réellement fermé vs ouvert

**Fermé** : rapatriement (§1), ancêtralité du correctif, disparition statique du
23502 sur les 15+ points d'upsert du dépôt, non-régression, registre Handoff et
Guardians conformes, véhicule de preuve SQL jugé correct.

**Toujours ouvert, et qui le restera depuis ce canal** : la preuve comportementale
réelle en base `nexus-test` (exécution de l'épreuve SQL ci-dessus, BEFORE 23502
reproduit / AFTER succès, sous rollback). Ce n'est pas un test qui échoue — c'est
une étape qu'aucun mécanisme accessible depuis ce canal ne peut exécuter :
pas de réseau, pas d'identifiant, pas de permission d'édition sur
`.github/workflows/*.yml` pour y câbler un nouveau step. Le diagnostic + la
tentative de correction exigés par la mission (§7) ont été refaits dans cette
session même (§2) et aboutissent au même blocage externe, confirmé, pas
contourné.

## 6. Verdict

**`NO_GO_GATE_PRODUCTION`.**

Pas parce qu'un résultat serait rouge, mais parce que la preuve exigée par la
mission (« Ne te contente pas du test statique 9/9 ni d'une CI générique ») est
structurellement hors de portée de ce canal, et que je ne fabrique pas une
preuve que je ne peux pas produire. Ce verdict **révise** le
`PRET_POUR_HANDOFF_PRODUCTION (qualifié)` de `request-19.md` : cette mission
a explicitement demandé un niveau de preuve plus strict, et le gap documenté
en `request-19.md` §5 reste un gap réel, pas une réserve qu'on peut lever par
relecture.

### Geste minimal requis pour fermer ce point

Un seul des deux suffit :

1. **Exécution directe** — depuis un poste/session disposant d'un accès réel à
   `nexus-test` (identifiants déjà existants, aucun nouveau secret requis) :
   `psql "$NEXUS_TEST_DB_URL" -f outils/epreuve-station-config-upsert-fuseau-horaire-23502-20261002.sql`,
   puis reporter le résultat exact de chaque `select` (PARTIE B) et confirmer
   l'échec 23502 attendu en PARTIE A. Aucune ligne n'est laissée en base
   (rollback systématique) — répétable sans effet de bord.
2. **Câblage CI** — une session/un humain disposant du droit d'éditer
   `.github/workflows/*.yml` (hors permission de ce canal) ajoute un step
   `workflow_dispatch`-only sur `handoff-continuite-20260920`, réutilisant la
   connexion déjà résolue par l'étape existante « Préparer la connexion
   PostgreSQL Test en écriture » (même secret, aucun nouveau), qui exécute ce
   même fichier et échoue si la PARTIE A ne reproduit plus le 23502 ou si la
   PARTIE B échoue.

Dans les deux cas : aucune donnée personnelle, aucune nouvelle ressource
facturable, aucun secret créé/exposé, migration `20261002000000` déjà présente
sur le rail et déjà qualifiée comme triviale/réversible (`request-19.md` §8).

## Interdictions respectées dans cette session

Aucune fusion, aucun déploiement, aucune migration ni écriture Supabase (Test
ou Production), aucune promotion Production, aucun secret lu ou exposé, aucun
fichier `.github/workflows/*` modifié, aucune reclassification d'une nouvelle
erreur en dette connue (les 9 échecs listés sont ceux déjà documentés, revérifiés
à l'identique), aucune autorisation Production implicite ou suggérée.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune
promotion Production, aucun secret créé/lu/exposé, aucun fichier
`.github/workflows/*` modifié, aucune preuve fabriquée pour un point que ce
canal ne peut pas vérifier.
