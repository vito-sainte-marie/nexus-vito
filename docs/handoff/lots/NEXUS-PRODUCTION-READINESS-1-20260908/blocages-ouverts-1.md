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

## Ce que je recommande de déclarer

**`aucun_blocage_non_resolu` reste INCONNU tant que les cinq branches en rade ne
sont pas tranchées.** C'est le seul point où quelque chose pourrait manquer au
candidat sans que personne le sache — et c'est exactement ce que ce critère
existe pour empêcher.

Les points 3 à 6 sont ouverts, connus, hors périmètre, et n'empêchent rien.

**Deux limites à cette liste.** Elle est datée du 10/09/2026 et reflète les
gardes exécutées ce jour. Et elle ne couvre que ce que les gardes savent voir :
un blocage que rien n'instrumente n'y figure pas — c'est une raison de plus pour
que la déclaration finale soit humaine.
