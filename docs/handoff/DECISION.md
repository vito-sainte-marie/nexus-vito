<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/decision-11.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 11
author: NEXUS Orchestrator
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-20.md
---
# Décision — `request-20.md` : preuve comportementale 23502 fermée, verdict `PRET_POUR_AUTORISATION_PRODUCTION`

## Verdict

`APPROVED_WITH_CONDITIONS`, `closes: false`. Verdict de gate : **`PRET_POUR_AUTORISATION_PRODUCTION`**.

`request-20.md` rendait `NO_GO_GATE_PRODUCTION` pour une seule raison : la preuve comportementale
réelle (épreuve SQL `outils/epreuve-station-config-upsert-fuseau-horaire-23502-20261002.sql`
exécutée sur `nexus-test`) était hors de portée de son canal. Cette preuve est désormais produite
par la CI du rail, sous l'identité réelle `nexus_ci_recette` (`nobypassrls`). Le motif du
`NO_GO` est donc levé. Le reste de `request-20.md` (correctif, test statique, non-régression) n'est
pas contredit.

Ce verdict n'est pas un `GO` Production. Il signifie : le dossier est complet et peut être présenté
à Frédéric pour une autorisation Production explicite et séparée. **STOP avant toute Production.**

## 1. Identité exacte de ce qui est qualifié

| Élément | Valeur |
|---|---|
| Rail | `handoff-continuite-20260920` |
| SHA qualifié (code + migrations) | `9b7f110b099e657caf7871719b034cd012ce3b95` |
| Run Tests | `37144900921` (événement `push`, conclusion `success`) |
| Job | `non-regression`, id `111266710239` |
| Étape request-20 | « Épreuve station_config 23502 (request-20) — INSERT et ON CONFLICT sous ROLLBACK », `success`, démarrée 2026-10-03T18:38:59Z |
| Étape bornage | « Bornage de l'écriture de recette sur station_config (SEC-023) », `success` |
| Refs protégées | `production` = `adee9bb` (inchangée) ; `main` = `d6093b7` (commit humain du 02/10/2026 18:19 -04:00, « fix(ci): aligner Claude sur le contrat NEXUS Test… », antérieur à ce tour et sans lien avec lui) |

Le commit qui dépose cette décision ne touche que `docs/handoff/`. Il ne modifie ni le code ni les
migrations qualifiés à `9b7f110`. Le SHA à autoriser reste `9b7f110` (ou tout descendant dont
l'arbre hors `docs/handoff/` est identique, ce qui se prouve par le SHA d'arbre et pas par le
message de commit).

## 2. Résultat exigé, mesuré dans le journal du job `111266710239`

| Exigence de la mission | Résultat | Preuve dans le journal |
|---|---|---|
| INSERT site neuf | **PASS** | `REQUEST-20 CAS-1 — INSERT site neuf` : `nexus-test-repro-23502-neuf`, `fuseau_horaire` vide (NULL), `a_un_prix = t` |
| INSERT … ON CONFLICT site existant | **PASS** | `REQUEST-20 CAS-2 — INSERT ... ON CONFLICT site existant` : `nexus-test-repro-23502-existant`, `fuseau_horaire = America/Martinique` (valeur existante **non écrasée**), `a_un_prix = t` |
| SQLSTATE 23502 | **absent** | La garde ancrée `^(psql:…: )?ERROR: +23502:` ne trouve rien. `ON_ERROR_STOP=1` passe. |
| ROLLBACK | **confirmé** | Trois `ROLLBACK`, un par partie, puis `REQUEST-20 : ÉPREUVE MENÉE À TERME — les deux cas ont été joués, puis annulés.` |
| Aucune donnée synthétique persistante | **confirmé** | NOTICE `REQUEST-20 : aucune ligne synthétique résiduelle (0 sur les deux identifiants).` Contre-mesure indépendante, en lecture seule après le run, depuis le poste : `count(*) … where site like 'nexus-test-repro-23502-%'` = **0**. |
| Preuve effectivement exécutée | **oui** | `NEXUS_EPREUVE_23502_FAITE: 1` est propagé à toutes les étapes suivantes. Une épreuve sautée aurait écrit `0`. |

Le bornage SEC-023 est prouvé dans le même job, sous la même identité :

- `BORNAGE-000` à `BORNAGE-006` sont tous `OK`.
- L'identité est `nexus_ci_recette`, soumise à la RLS.
- Le rôle n'a ni DELETE, ni TRUNCATE, ni REFERENCES, ni TRIGGER.
- Cinq colonnes sont ouvertes à l'insertion, pas une sixième.
- Une insertion sur `nexus-station-test` est refusée (42501).
- Une mise à jour sur `nexus-station-test` touche 0 ligne.
- Les deux identifiants synthétiques sont écrivables (contre-témoin).
- Aucun résidu ne reste.

## 3. La capacité d'écriture Test : ce qui a été accordé, et rien de plus

Autorisation humaine verbatim (Frédéric Bragance, 03/10/2026) : « Frédéric autorise une capacité
d'écriture TEST strictement minimale permettant à l'épreuve request-20 d'exécuter ses deux cas
synthétiques sur public.station_config. »

Trois migrations Test/CI successives. Chacune rejoue la précédente et ajoute une seule chose, et
chacune a été rendue nécessaire par un 42501 mesuré, pas supposé :

1. **`20261003170000`**
   - Accorde au rôle l'INSERT de cinq colonnes et l'UPDATE de trois colonnes.
   - Ajoute trois politiques bornées à `nexus-test-repro-23502-neuf` / `-existant`.
2. **`20261003180000`**
   - Accorde SELECT sur `horaires` et `updated_at`.
   - Motif : `excluded.*` est une lecture (run `37143142272`, `aclchk.c:2843`).
3. **`20261003190000`**
   - Accorde `EXECUTE` sur `planning_mappage_est_valide(jsonb)`.
   - Motif : la contrainte CHECK de `station_config` appelle cette fonction, et c'est le rôle qui
     écrit qui doit pouvoir l'exécuter.
   - Le run `37144900921` qui suit cette migration est vert : aucun autre droit ne manquait.

Les trois ont été appliquées sur `nexus-test` (`udljdqxerrbbbajxubfn`) par Frédéric, avec le véhicule
audité `outils/appliquer-migration-ecriture-bornee-station-config-test-a-executer-par-frederic.sh` :

- Pré-vol conforme : base `postgres`, identité `postgres`, propriétaire de la table, rôle présent.
- Verdict final : `ECRITURE_BORNEE_APPLIQUEE`, `EXECUTE_MAPPAGE_PRESENT`, estampille `20261003190000` présente.

Les trois sont **exclues de Production** (le rôle `nexus_ci_recette` n'y existe pas). Le manifeste
`docs/handoff/MANIFESTE-MIGRATIONS-PRODUCTION-COURANT.md` les classe **EXCLUE — Test/CI** par des
addenda datés, en append-only.

Rien n'a été accordé sur `nexus-station-test` ni sur un site réel, et rien en Production. Il n'y a
eu ni élargissement général de `nexus_ci_recette`, ni force, ni skip.

## 4. Non-régression du même run

- `run-tests.js` : **289/298**. « Aucune régression : seuls les 9 échecs connus subsistent. » Ce
  sont les mêmes 9 que dans `docs/qa/ECHECS-CONNUS.json` ; aucun nouveau rouge n'a été reclassé.
- `garde-portee-site.js`, qui est consultative (`|| true`) :
  - Bilan : `VULNERABLE 0`, `UNKNOWN 5`.
  - Les deux UNKNOWN `station_config.ecriture_recette_23502_insert/update` figuraient déjà au run
    précédent `37144179897` (rail `65854d0`). Ils ne sont donc pas nouveaux.
  - Ce sont des politiques Test/CI bornées par une liste littérale d'identifiants synthétiques.
    BORNAGE-003/004 prouvent leur portée.
  - Je les trace en P3, sans blocage.
- Avertissements du run : `branches-en-rade` (66 branches non rapatriées, dette connue, P3) et la
  dépréciation Node 20 des actions (P4). Aucun n'a de lien causal avec request-20.

## 5. Ce qui est autorisable, et à quelle condition (objet du GO Production à venir)

Le correctif qualifié est **`20261002000000_station_config_fuseau_horaire_nullable`**, accompagné du code
de `9b7f110`, qui ne transporte jamais `fuseau_horaire` (`NEXUS-App-v1.html::rappelSauvegarderPrix`).

Ordre imposé : **migration d'abord, code ensuite.** Le code envoie un payload sans
`fuseau_horaire`, ce qui provoquerait un 23502 sur une base où la colonne serait encore `NOT NULL`.

Sur Test, la colonne est nullable : l'estampille hors-bande `20261002233051` est présente, et
`attnotnull = f` a été mesuré ce jour en lecture seule. C'est cet état que l'épreuve a prouvé.

## 6. Anomalies nommées séparément (aucune ne bloque ce verdict)

- **P1 — `20261003120000_station_config_horaires_nullable` n'est pas appliquée sur Test.**
  - Mesuré ce jour en lecture seule : pas d'estampille, et `horaires.attnotnull = t`.
  - L'épreuve request-20 transporte `horaires` dans ses deux cas. Elle **ne prouve donc rien** sur
    cette migration.
  - Le code de `9b7f110` n'en dépend pas : il transporte toujours `horaires` (39 occurrences de
    `horairesUpsert` dans `NEXUS-Parametres-Station-v1.html`, mesurées à `9b7f110`). Il n'y a donc pas de risque causal sur le déploiement du correctif fuseau.
  - Elle doit être **exclue du périmètre de l'autorisation Production**, ou prouvée sur Test avant.
    Ce n'est pas un rouge de request-20. C'est une limite de ce que la preuve couvre.
- **P2 — Véhicule Production.** Le véhicule de migration Production reste à confronter au standard
  du 01/10 (« une cible Production se mesure, jamais ne se compose ») au moment du GO. Sont visés :
  - la sélection de la base ;
  - le refus du pooler ;
  - la comparaison des deux sondes.

  Ce point est nommé, pas traité ici.
- **P3** — les UNKNOWN de la garde de portée et `branches-en-rade`, voir §4.
- **P4** — la dépréciation Node 20 dans les actions.

## 7. Suite

1. Aucun `request-21` pour ce même objectif : request-20 est répondue par la présente.
2. Le prochain geste appartient à Frédéric seul : une autorisation Production explicite et séparée,
   qui désigne le SHA `9b7f110` et la migration `20261002000000`, et exclut `20261003120000` ainsi
   que les trois migrations Test/CI.
3. Fusionner et déployer sont deux gestes distincts, dont chacun exige son propre GO.

## Interdits respectés

Aucune Production : ni requête, ni merge, ni déploiement, ni migration, ni écriture. Aucun droit
n'a été accordé sur un site réel ou sur `nexus-station-test`, et `nexus_ci_recette` n'a pas été
élargi en général. Il n'y a eu ni force ni skip, et aucun nouveau rouge n'a été reclassé en dette.
Aucun secret n'a été exposé.
