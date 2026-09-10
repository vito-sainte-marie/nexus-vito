# Blocages ouverts — liste pour l'arbitrage `aucun_blocage_non_resolu`

**10/09/2026.** Dernier critère du lot qui ne se mesure pas : il se **déclare**.
Ce document liste ce qui est ouvert et donne mon avis sur la pertinence de
chaque point **pour cette release**. La déclaration reste celle de Frédéric.

Tout ce qui suit a été relevé aujourd'hui en exécutant les gardes, pas de
mémoire.

---

## Ce qui touche DIRECTEMENT la release

### 1 · Cinq branches en rade — **le seul point que je considère bloquant**

`outils/garde-branches-en-rade.js` : **5 branches sur 36** portent du travail
absent de `config-par-environnement` et ne sont classées nulle part.

| branche | commits | objet |
|---|---|---|
| `claude/issue-28-20260909-1054` | 1 | connexion directe échouant sur les runners |
| `claude/issue-28-20260909-1213` | 1 | trousseau exigé malgré une URL fournie |
| `claude/issue-28-20260909-1455` | 1 | même correctif, autre variante |
| `claude/issue-28-20260909-1735` | 3 | publication de `request-6` |
| `claude/issue-28-20260909-2038` | 2 | publication de `request-7` |

**Pourquoi c'est le seul que je qualifie de bloquant.** Le critère
`candidate_immuable_identifiee` désigne un SHA. Si l'une de ces branches porte
un correctif qui devrait être dans la release, **le candidat est incomplet et
personne ne le sait**. Les trois premières traitent du même défaut de trousseau
que j'ai corrigé de mon côté — il est probable qu'elles fassent doublon, mais
« probable » n'est pas « vérifié ».

**Ce qu'il faut :** rapatrier, ou inscrire leur sort dans
`docs/handoff/BRANCHES-CLASSEES.json`. Les deux ferment le point ; l'ignorer ne
le ferme pas.

### 2 · Horaires de Production non corrigés

Le quart 1 finit trente minutes trop tôt en base (12:45 / 13:45 au lieu de
13:15 / 14:15), et le quart 2 à 20:05 / 22:05 au lieu de 20:10 / 22:10. La
correction est écrite et prête
(`outils/correction-horaires-production-a-executer-par-frederic.sql`), **non
appliquée** : écrire dans `station_config` de Production est une opération
Production.

**Mon avis : à appliquer AVANT la release, pas pendant.** Ce n'est pas une
migration, c'est une donnée de configuration. Mélanger les deux dans la même
fenêtre rendrait un incident inattribuable.

---

## Ce qui est ouvert et que je ne considère PAS bloquant pour cette release

### 3 · ARCH-002 — `NexusStock`

Un finding connu du routeur Guardians, **déjà tracé et arbitré non bloquant**
(`CURRENT.md`, `request-7.md`). Rien de nouveau aujourd'hui. Hors du périmètre
des 26 migrations.

### 4 · Guardian Bible — 9 findings sur 625 replis examinés

Des `|| 0` qui fabriquent un zéro là où la valeur est inconnue, dans
`NEXUS-Capital`, `NEXUS-Centre-Intelligence`, `NEXUS-Debug-Createur`,
`NEXUS-Parametres-Station` et `nexus-carburant-demarrage-mois`.

**Aucun de ces fichiers n'est touché par la release.** Ce sont des écrans
manager ou de mise au point, pas le parcours employé. Préexistants, non
aggravés.

### 5 · QA-007 — neuf épreuves inertes

Motifs établis hier, quatre familles, **aucun défaut applicatif**. Deux
concernent le module Réception carburant, qui tourne donc sans épreuve vivante.

**Non bloquant pour cette release** — la Réception n'est pas dans le périmètre
des 26 migrations. Mais c'est une dette de couverture réelle, à traiter après.

### 6 · LANG-003 — 1 481 tirets cadratins

Le plafond tient, aucun ajout aujourd'hui, la garde est bloquante en CI. La
dette de réécriture reste entière, sans effet sur la release.

---

## Ce qui est ouvert et qui n'est pas un blocage, mais une décision en attente

Ces points sont nés de la conception du parcours employé. Aucun n'empêche la
release ; tous attendent un arbitrage.

- **Le placement temporel des 23 missions du pompiste** — 136 missions sur 138
  n'ont pas de `time_window`.
- **Le renfort comme troisième quart** — implémenté côté exécution, mais le
  vocabulaire `matin` / `soir` reste celui de trois tables Inventaire.
- **La transmission au quart suivant** — n'existe dans aucun modèle.
- **Les 17 services restés ouverts** en Production. La migration de reprise les
  clôturera en `clos_sans_pointage`. Ce n'est pas un blocage : c'est
  précisément ce que la release vient traiter, et son impact est chiffré dans
  le rapport de répétition.

---

## FERMÉ le 10/09/2026

**Les cinq branches sont classées au SHA exact**, sur arbitrage Orchestrator
relayé par Frédéric Bragance. `garde-branches-en-rade` rend désormais
« aucune », et son épreuve passe 21/21.

| branche | tête | sort |
|---|---|---|
| `…0909-1054` | `e9262da` | **A_REPRENDRE** → Backlog `ARCH-006` |
| `…0909-1213` | `ad2e4c8` | **INTEGREE** |
| `…0909-1455` | `28bf9d3` | **INTEGREE** |
| `…0909-1735` | `2453d98` | **SUPERSEDEE** |
| `…0909-2038` | `73a8c40` | **INTEGREE** |

Aucune fusion globale : rapatriement sélectif de la commande
`handoff.js rattraper-demande` et de quatre épreuves, toutes exécutées sur le
HEAD canonique. `outils/resoudre-connexion-test.sh` est écarté de cette
release et suivi en `ARCH-006`.

**`aucun_blocage_non_resolu` peut être déclaré OK.** Les points 3 à 6 ci-dessus
restent ouverts, connus, hors périmètre, et n'empêchent rien.

### Ce que ce classement a révélé au passage

La branche `2038` portait une **cinquième épreuve** que ma première comparaison
avait manquée : `test_security_jamais_invoque_si_url_20260909.js`. Elle vérifie
que `security` n'est jamais **invoqué** quand l'URL est fournie — propriété plus
forte que « le script ne plante pas », car un trousseau verrouillé peut demander
une confirmation interactive et bloquer un script qui n'en avait pas besoin.

Ma comparaison du 10/09 ne regardait que les trois branches « trousseau » et
n'avait pas ouvert les deux branches « handoff ». **Une comparaison bornée à ce
qu'on croit chercher manque ce qu'on ne cherchait pas.**

Les points 3 à 6 sont ouverts, connus, hors périmètre, et n'empêchent rien.

**Deux limites à cette liste.** Elle est datée du 10/09/2026 et reflète les
gardes exécutées ce jour. Et elle ne couvre que ce que les gardes savent voir :
un blocage que rien n'instrumente n'y figure pas — c'est une raison de plus pour
que la déclaration finale soit humaine.

---

## ROUVERT le 10/09/2026, en préparant la gate

`aucun_blocage_non_resolu` était déclarable OK ce matin. **Il ne l'est plus.**
Deux défauts sont apparus en mesurant au lieu de déclarer — c'est-à-dire en
faisant exactement ce que la re-mesure finale demandait.

### 7 · La CI n'est pas verte sur le candidat — **cause non isolée**

Le SHA `ea561f6` porte **deux exécutions de la même suite** :

| run | événement | verdict |
|---|---|---|
| 34485844362 | `pull_request` | **success** |
| 34485839396 | `push` | **failure** |

Une seule épreuve sépare les deux : `test_security_jamais_invoque_si_url_20260910.js`,
au premier contrôle — « `reconstruire-base-test.sh` : URL fournie ⇒ security
JAMAIS invoqué ». Le marqueur d'invocation existait, donc `security` a bien été
atteint alors qu'une URL était fournie.

**Observation brute** conservée. **Reproduction : impossible ici.** L'épreuve
passe 7/7 sur macOS, et elle passe sur le run `pull_request` du *même SHA*.
Une occurrence, pas deux.

**Hypothèses examinées.**

- *Le correctif aurait disparu du script* — **écartée** : `security` n'apparaît
  qu'une fois dans `reconstruire-base-test.sh` (ligne 62), sous le garde
  `if [ -n "${NEXUS_TEST_DB_URL:-}" ]`, et la mutation négative de l'épreuve
  démontre qu'un appel inconditionnel serait détecté.
- *Interférence par le fichier partagé `PREPROD-CYCLE.json`* (défaut 8
  ci-dessous) — **écartée par lecture** : le script ne lit jamais ce fichier,
  et rien ne s'exécute entre la ligne 27 et la ligne 59 qui puisse appeler
  `security`.
- *`psql` absent en local, présent sur le runner* — **écartée** : `psql` est
  présent sur les deux, et le seul appel à `security` précède toute connexion.
- *Collision de chemin sur le marqueur* — non écartée, mais le chemin porte
  déjà `Date.now()` et `Math.random()`.

**Cause non isolée.** Je n'écris pas de correctif sur une hypothèse : corriger
sans cause, c'est déplacer le défaut. L'épreuve a été **instrumentée** — son
message d'échec porte désormais le contenu du marqueur, le code de sortie,
`stdout` et `stderr`. Le contrôle lui-même est inchangé : l'instrumentation
n'est pas la correction. La prochaine occurrence dira ce que celle-ci a tu.

**Conséquence pour la gate, et c'est le point qui compte.** Un run `push` rouge
sur le SHA candidat suffit à retirer le vert, même si le run `pull_request` du
même SHA est vert. `ci_et_guardians_conformes` est donc **BLOQUE**, et le
verdict global `NON_PRET`. Ce n'était pas visible tant que le verdict était
raconté plutôt que calculé.

### 8 · La suite corrompt un fichier suivi du dépôt — **démontré, deux fois**

`docs/handoff/PREPROD-CYCLE.json` ressort **modifié** après `node run-tests.js` :
`cycles` est vidé et l'entrée réelle est perdue.

**Reproduit deux fois de suite**, et l'artefact était déjà présent dans l'arbre
de travail avant que je le cherche.

**Cause démontrée.** Six épreuves sauvegardent ce même fichier, le remplacent
par une version vide, lancent un script, puis le restaurent — et le lanceur
exécute les fichiers **en parallèle** (4 en CI, 8 en local). Deux épreuves qui
se chevauchent : la seconde sauvegarde la version *déjà vidée* par la première,
et sa restauration écrase la restauration correcte. La dernière restauration
gagne, et ce n'est pas nécessairement l'originale.

**Non corrigé, volontairement.** Réparer demande de sortir ce fichier de
l'arbre de travail pour les six épreuves — donc de toucher six fichiers et le
chemin qu'un outil partagé lit. Ce n'est pas un geste à poser dans l'heure qui
précède une gate de Production. Le défaut est réel, tracé, et sans effet
démontré sur le défaut 7. **L'arbitrage revient à Frédéric** : corriger avant
la release, ou après.

**Ce que ce défaut coûte aujourd'hui :** un `git status` sale après chaque
exécution de la suite, et le risque de committer un journal PREPROD vidé sans
s'en apercevoir.
