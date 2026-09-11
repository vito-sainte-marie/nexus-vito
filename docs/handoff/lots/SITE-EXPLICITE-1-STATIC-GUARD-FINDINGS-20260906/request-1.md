---
protocol: nexus-handoff/2
kind: request
lot_id: SITE-EXPLICITE-1-STATIC-GUARD-FINDINGS-20260906
seq: 1
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=501c0c7 production=501c0c7
  - id: trois-occurrences-fermees
    classe: VERIFIED
    valeur: garde VULNERABLE 3 vers 0, incoherences 1 vers 0
  - id: chemins-illegitimes
    classe: VERIFIED
    valeur: 5 refus 42501 sous identites reelles
  - id: chemins-legitimes
    classe: VERIFIED
    valeur: badge, points et reouverture manager acceptes
  - id: portee-indirecte-preservee
    classe: VERIFIED
    valeur: aucune colonne site ajoutee a inventaire_quart_employes
  - id: with-check-distinct-du-using
    classe: VERIFIED
    valeur: la nouvelle valeur de quart_id est controlee
  - id: aucun-elargissement
    classe: VERIFIED
    valeur: acteurs conserves, aucune donnee ecrite par la migration
  - id: suite
    classe: VERIFIED
    valeur: 192/201
  - id: unknown-non-tries
    classe: HUMAN
    valeur: 27 inchanges, lot distinct
  - id: garde-non-bloquante
    classe: DECLARED
    valeur: activation soumise au tri des UNKNOWN
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete, aucun merge, aucun deploiement
---

# SITE-EXPLICITE-1-STATIC-GUARD-FINDINGS — les trois occurrences sont fermées

## Contrat anti-dérive

| Champ | Valeur |
|---|---|
| `objectif_metier` | Qu'un employé ne puisse pas inscrire sa progression sur un autre commerce, ni rattacher un comptage au quart d'un autre. |
| `gain_attendu` | **Sécurité** — trois chemins fermés, dont deux touchant la reconnaissance des employés. |
| `contrats_touches` | 3 policies (`progression_badge_awards`, `progression_points_ledger`, `inventaire_quart_employes`) |
| `guardians_requis` | Architecture · Security & Isolation · QA / Regression |
| `preuves_exigees` | contrats métier · policies avant/après · chemins illégitimes et légitimes · sortie de la garde |
| `definition_de_termine` | Trois fermées, garde à zéro VULNERABLE, retour Handoff. **Atteinte.** |

## Résumé

**La garde statique ne signale plus aucune `VULNERABLE` ni aucune
incohérence.** `SAFE` passe de 183 à **186**.

## 1. Contrats métier — deux natures différentes

### `progression_badge_awards` et `progression_points_ledger`

Contrat lu dans `NEXUS-Progression-v1.html` : l'employé inscrit **son** badge
et **ses** points, sur **son** site. L'écriture est explicitement exclue de la
vue manager (`if (!vueManager …)`) — aucun chemin manager n'insère.

`site_id` y est **`NOT NULL` sans défaut** : le client fournissait donc le
site, et **rien ne le vérifiait**. Un employé pouvait inscrire un badge ou des
points sur un autre commerce — de la reconnaissance, et potentiellement de la
rémunération, portée au mauvais endroit.

### `inventaire_quart_employes` — portée indirecte, préservée

Cette table **n'a pas de colonne site**, et la consigne était explicite : ne
pas lui en ajouter si la portée par `quart_id → inventaire_quarts.site` est le
contrat normal. **C'est le contrat.** La correction protège le contrat, elle
n'uniformise pas le schéma.

Son `INSERT` contrôlait déjà cette portée. Son `UPDATE` ne contrôlait que
l'acteur — d'où deux conséquences : un manager d'un autre commerce pouvait
modifier la ligne, et surtout **un `update` pouvait rattacher la ligne au
quart d'un autre site** en changeant `quart_id`.

Les deux clauses sont nécessaires et **ne disent pas la même chose** : le
`using` borne les lignes visibles, le `with check` contrôle la **nouvelle**
valeur de `quart_id`. C'est lui qui interdit le déplacement.

## 2. Policies avant / après

| Policy | Avant | Après |
|---|---|---|
| `employee_own_badge_insert` | `employee_id` seul | auteur **+ site** |
| `employee_own_points_insert` | `employee_id` seul | auteur **+ site** |
| `update_inventaire_quart_employes` | `employee_id` **ou** rôle manager | **portée du quart** ET (auteur **ou** rôle), `using` **et** `with check` |

## 3. Preuves — identités réelles, transactions annulées

```
P1 badge sur un AUTRE site            : REFUSE [42501]
P2 badge pour un AUTRE employe        : REFUSE [42501]
P4 points sur un AUTRE site           : REFUSE [42501]
P6 badge complet, AUTRE site          : REFUSE [42501]
I1 rattacher au quart d un AUTRE site : REFUSE [42501]

P3 LEGITIME son badge, son site       : ACCEPTE
P5 LEGITIME ses points, son site      : ACCEPTE
I2 LEGITIME manager rouvre une cloture: 1 modifiee
```

**Une correction de mes propres preuves** : P3 et P5 ont d'abord échoué en
`23502` — une colonne obligatoire manquait à mes lignes de test, pas un refus
RLS. Rejouées complètes, elles passent. Un `23502` lu comme un refus de
sécurité aurait fait conclure à une régression inexistante.

## 4. Sortie de la garde après correction

| Classe | Avant | Après |
|---|---:|---:|
| `SAFE` | 183 | **186** |
| **`VULNERABLE`** | **3** | **0** |
| `UNKNOWN` | 27 | 27 |
| Incohérences | 1 | **0** |

Les 27 `UNKNOWN` sont **inchangés** : leur tri est un lot distinct, et je n'y
ai pas touché.

## 5. Aucun élargissement

Les acteurs légitimes sont conservés partout, y compris la réouverture de
clôture par le manager sur son commerce. Aucune branche créateur ajoutée,
aucun default retiré, aucune donnée réattribuée — la migration ne contient
aucune écriture de données, et un test le vérifie.

## Avis des Guardians

### Security & Isolation Guardian

Trois chemins fermés. Les deux tables de progression méritent d'être
distinguées : elles portent de la **reconnaissance**, pas de l'exploitation.
Un badge ou des points inscrits sur le mauvais commerce faussent une
évaluation d'employé — le préjudice est humain avant d'être technique.

**Avis : je ne connais plus de policy de mutation vulnérable** sur les tables
analysées. Les 27 `UNKNOWN` restent des questions ouvertes, pas des
absolutions.

### Architecture Guardian

Le cas `inventaire_quart_employes` est le plus instructif du chantier : la
tentation était d'ajouter une colonne `site` pour uniformiser. La consigne l'a
interdit, et elle avait raison — la portée par le quart **est** le contrat, et
l'ajouter aurait créé deux sources de vérité pour la même information, donc un
risque de divergence.

**Avis : la distinction `using` / `with check` doit entrer dans l'ADR.** Elle a
été redécouverte trois fois ; la nommer une bonne fois éviterait la quatrième.

### QA / Regression Guardian

La garde a trouvé ces trois cas, la correction les ferme, et la garde le
confirme : c'est la première boucle complète **instrument → constat →
correction → vérification** du chantier.

**Réserves** : les 27 `UNKNOWN` restent non triés ; la garde demeure non
bloquante ; les preuves vivent en transaction annulée.

Je relève aussi que mes propres preuves P3/P5 ont d'abord donné un faux
signal de régression — un `23502` n'est pas un refus de sécurité. Un test qui
ne distingue pas ses codes d'erreur ment dans les deux sens.

## Preuves

- Migration `20260906080000_garde_portee_findings.sql`, **Test uniquement**.
- 5 refus `42501`, 3 chemins légitimes acceptés, sous identités réelles.
- `test_garde_portee_findings_20260906.js` — 7 vérifications, dont une qui
  exige que la garde ne signale **plus aucune** `VULNERABLE`.
- Garde : `VULNERABLE 3 → 0`, incohérences `1 → 0`, `SAFE 183 → 186`.
- Suite `192/201`, mêmes 9 échecs historiques.
- `main` et `production` : `501c0c7` — preuve calculée par l'outillage.

## Rollback

Migration inverse rétablissant les trois policies. **Aucune donnée touchée** :
retour complet.

## Risques / anomalies

1. **27 `UNKNOWN` non triés** — prochaine étape obligatoire avant activation
   bloquante et avant la classe D.
2. **La garde reste non bloquante.**
3. **Portée indirecte** : `inventaire_quart_employes` dépend de la justesse de
   `inventaire_quarts.site`. La chaîne est correcte, mais elle est **plus
   longue** qu'un contrôle direct — donc plus fragile à un changement de
   schéma.

## Questions pour arbitrage

**Q53 — Enchaîner sur le tri des 27 `UNKNOWN` ?** Recommandation : **oui,
immédiatement**. C'est la dernière condition avant l'activation bloquante, et
un `UNKNOWN` qui dure est une question qu'on a cessé de se poser.

**Q54 — Ajouter la distinction `using` / `with check` à ADR-0001 ?**
Recommandation : **oui**. Elle a été redécouverte trois fois — sur
`mission_progress`, `apprentissage_snapshots`, puis ici. La nommer coûte un
paragraphe et évite la quatrième.

## Action attendue de ChatGPT

Arbitrer Q53 et Q54 pour le `LOT_ID`
**SITE-EXPLICITE-1-STATIC-GUARD-FINDINGS-20260906**. **La classe D reste
fermée ; aucune extension n'est demandée.**
