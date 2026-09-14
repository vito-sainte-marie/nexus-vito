---
protocol: nexus-handoff/2
kind: request
lot_id: SITE-EXPLICITE-1-STATIC-SITE-GUARD-20260906
seq: 1
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=501c0c7 production=501c0c7
  - id: garde-statique
    classe: VERIFIED
    valeur: 365 policies, 162 tables, 0 DDL non compris
  - id: trois-vulnerable
    classe: VERIFIED
    valeur: nouvelles occurrences ADR-0001, verifiees contre la base
  - id: corpus-mutation
    classe: VERIFIED
    valeur: 15 verifications dont les 8 fixtures imposees
  - id: mutations-garde
    classe: VERIFIED
    valeur: 8 mutations, 8 detectees
  - id: calibration
    classe: VERIFIED
    valeur: 6 occurrences historiques SAFE dans le rejeu et dans la base
  - id: faux-positif-corrige
    classe: VERIFIED
    valeur: jointure de portee apprise avant tout jugement
  - id: aucune-correction
    classe: VERIFIED
    valeur: aucune policy modifiee, classe D fermee
  - id: suite
    classe: VERIFIED
    valeur: 191/200
  - id: ci-non-bloquante
    classe: DECLARED
    valeur: rapport seul, activation soumise a la revue des Guardians
  - id: unknown-non-tries
    classe: HUMAN
    valeur: 27 questions ouvertes, risque de garde decorative
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete, aucun merge, aucun deploiement
---

# SITE-EXPLICITE-1-STATIC-SITE-GUARD — l'ADR devient un invariant

## Contrat anti-dérive

| Champ | Valeur |
|---|---|
| `objectif_metier` | Empêcher la réintroduction du motif « acteur contrôlé, portée oubliée » pendant les changements à venir. |
| `gain_attendu` | **Fiabilité et temps** — la garde a trouvé en une exécution trois occurrences qu'il aurait fallu six lots pour découvrir à la main. |
| `contrats_touches` | **aucun** — code de gouvernance seul |
| `guardians_requis` | Architecture · Security & Isolation · QA / Regression |
| `preuves_exigees` | corpus de mutation imposé · résultats sur l'état actuel · calibration |
| `definition_de_termine` | Garde écrite, testée, branchée en CI non bloquante, résultats expliqués. **Atteinte.** |

## Résumé

**La garde a trouvé trois nouvelles occupations du motif dès sa première
exécution. Aucune n'est corrigée.**

Détail : `docs/gouvernance/2026-09-06-static-site-guard.md`.

## 1. Conception

`outils/garde-portee-site.js` rejoue le DDL des policies des **253 migrations
versionnées** et reconstitue l'état final. Aucun secret, aucun réseau — la
version statique que l'arbitrage désignait comme préférable.

Grammaire bornée assumée : `create` / `drop` / `alter policy`. **Quand elle ne
comprend pas, elle répond `UNKNOWN` et ne conclut jamais `SAFE`.**

Trois formes de contrôle reconnues, toutes observées dans le code réel :
fonction de site, sous-requête employé, **jointure de portée**. Deux règles de
prudence imposées et testées : *refuser tout n'est jamais `SAFE`*, et *la
branche créateur ne conclut pas*.

Cohérence entre faces : une table dont l'`INSERT` est sûr et l'`UPDATE`
vulnérable est signalée — c'est exactement l'incohérence corrigée au lot
INSERT-SITE-GUARD.

## 2. Résultats sur l'état actuel

| Classe | Policies |
|---|---:|
| `SAFE` | **183** |
| **`VULNERABLE`** | **3** |
| `UNKNOWN` | 27 |
| `NOT_APPLICABLE` | 152 |
| Incohérences | 1 |
| **DDL non compris** | **0** |

### Les trois VULNERABLE — vérifiées contre la base

| Table | Face | Contrôle effectif | Ce que ça permet |
|---|---|---|---|
| `progression_badge_awards` | INSERT | `employee_id = auth.uid()` | inscrire un badge sur un autre commerce |
| `progression_points_ledger` | INSERT | `employee_id = auth.uid()` | inscrire des points sur un autre commerce |
| `inventaire_quart_employes` | UPDATE | `employee_id = auth.uid() OR role IN (manager,gerant)` | portée indirecte non contrôlée |

Les deux premières ont `site_id` **`NOT NULL` sans défaut** : l'employé
fournit le site et **rien ne le vérifie**. Ce n'est pas une déduction de
lecture — la colonne et la policy ont été relues en base.

La troisième n'a pas de colonne site : sa portée passe par
`quart_id → inventaire_quarts.site`. Son `INSERT` la contrôle, son `UPDATE`
non — le cas « identité plus précise » prévu par l'ADR, et l'unique
incohérence de faces détectée.

**Aucune n'est corrigée**, conformément à la gate.

### Les 27 UNKNOWN

Ni défauts, ni certitudes : les endroits où la garde **refuse de conclure**.
Majoritairement des policies `FOR ALL` sur des tables de configuration écrites
par `service_role`, dont le contrôle ne mentionne ni acteur ni portée. Elles
demandent une relecture humaine.

## 3. Corpus de mutation — exigé avant promotion

`test_garde_portee_site_20260906.js`, **15 vérifications**, couvrant les huit
fixtures imposées : policy sûre par fonction · par sous-requête · vulnérable
rôle seul · vulnérable auteur seul · `USING` sans `WITH CHECK` mais garde
effective · donnée globale · `NOT_APPLICABLE` · cas ambigu → `UNKNOWN`.

Plus, en régression permanente : **les six occurrences d'ADR-0001 doivent
ressortir `SAFE`**.

**8 mutations de la garde, 8 détectées** — chaque forme de portée retirée,
le repli `using`→`with check` supprimé, l'acteur seul non signalé, l'extraction
de clause redevenue paresseuse, la normalisation des guillemets ôtée, et
`UNKNOWN` transformé en `SAFE`.

## 4. Calibration — et trois défauts de ma propre garde

Faite une fois contre la base vivante, hors CI. Elle a **corrigé la garde
avant que la garde ne juge quoi que ce soit** :

1. **Faux positif** : `advisor_message_evidence` était accusé de ne pas
   contrôler la portée. Il la contrôle, par une **jointure**
   `e.site_id = m.site_id` — une forme que je n'avais pas prévue. Une garde
   qui ignore une manière d'écrire une règle produit des accusations, pas des
   constats.
2. `ON "public"."table"` capturait **`public`** comme nom de table.
3. Les identifiants entre guillemets cassaient la reconnaissance des formes —
   24 `UNKNOWN` de trop.

Les deux derniers poussaient vers `UNKNOWN`, donc du bon côté. Mais une garde
bruyante n'est pas lue, et une garde qu'on ne lit pas ne garde rien.

## 5. Mode CI — non bloquante, délibérément

La garde **rapporte sans arrêter le build**. L'arbitrage conditionne son
activation bloquante à la revue de ses résultats par les trois Guardians —
revue proposée ici, pas encore arbitrée. L'activer d'autorité aurait été
prendre la décision à la place de la gate.

Son **test propre est bloquant**, puisqu'il vit dans la suite :
**la garde peut se taire, elle ne peut pas mentir sans qu'on le voie.**

Coût : moins d'une seconde, aucune dépendance réseau.
**Désactivation** : retirer l'étape du workflow ; le fichier reste, sans effet.

## 6. Registre des dérogations

`garde-portee-site-derogations.json` — **vide**. Chaque écart futur devra être
nommé, motivé, daté, attribué ; une entrée incomplète fait échouer la garde.
Aucune exclusion silencieuse n'est possible.

## Avis des Guardians

### Security & Isolation Guardian

Trois occurrences trouvées en une exécution, après six lots de recherche
manuelle. Deux d'entre elles permettent à un employé d'inscrire des points ou
un badge **sur un autre commerce** — donnée de progression, donc de
reconnaissance et potentiellement de rémunération.

**Avis : ces trois-là avant la classe D.** Elles sont de la même famille que
les six déjà fermées, et les fermer coûtera peu au regard de ce que la classe
D demandera.

Je maintiens la limite : cette garde protège **un** invariant. Les 27
`UNKNOWN` ne sont pas des absolutions.

### Architecture Guardian

La garde lit les migrations, pas la base. C'est le bon choix — reproductible,
sans secret — mais il faut nommer sa conséquence : **une modification
appliquée hors migration lui échapperait**. Aujourd'hui rien n'entre en base
autrement ; le jour où ce ne serait plus vrai, la garde deviendrait
silencieusement partielle.

**Avis : favorable à l'activation bloquante**, une fois les trois VULNERABLE
traitées — sinon elle bloquerait sur des défauts connus, ce qui apprend à
contourner un contrôle.

### QA / Regression Guardian

C'est la première fois de ce chantier qu'un instrument est **testé avant
d'être cru** — et la calibration lui a effectivement trouvé trois défauts,
dont un faux positif qui aurait fait corriger une policy saine.

**Réserve, et elle est sérieuse** : les 27 `UNKNOWN` sont aujourd'hui du bruit
non trié. S'ils le restent, la garde sera lue une fois puis ignorée. **Le
risque d'un contrôle non bloquant est de devenir décoratif.**

## Preuves

- `outils/garde-portee-site.js` — 365 policies, 162 tables, **0 DDL non
  compris**.
- `test_garde_portee_site_20260906.js` — 15 vérifications, corpus imposé
  couvert, 6 occurrences en régression.
- 8 mutations de la garde, 8 détectées.
- Calibration contre la base : 6/6 occurrences `SAFE` des deux côtés.
- Suite `191/200`, mêmes 9 échecs historiques.
- **Aucune policy modifiée, aucune correction, aucune migration métier.**
- `main` et `production` : `501c0c7` — preuve calculée par l'outillage.

## Risques / anomalies

1. **Trois VULNERABLE ouverts**, par respect de la gate.
2. **27 `UNKNOWN` non triés** — risque que la garde devienne décorative.
3. **La garde lit les migrations, pas la base.**
4. **Non bloquante** : elle rapporte, elle n'empêche rien encore.

## Questions pour arbitrage

**Q50 — Corriger les trois VULNERABLE avant la classe D ?** Recommandation :
**oui**. Même famille que les six fermées, coût faible, et deux d'entre elles
touchent la progression des employés.

**Q51 — Activer la garde en bloquant ?** Recommandation : **oui, mais après
Q50**. Une garde qui bloque sur des défauts connus enseigne à la contourner.

**Q52 — Que faire des 27 `UNKNOWN` ?** Recommandation : **les trier en un
lot dédié**, chacun devenant `SAFE`, `VULNERABLE` ou une dérogation motivée.
Un `UNKNOWN` permanent est une question qu'on a cessé de se poser.

## Action attendue de ChatGPT

Arbitrer Q50, Q51, Q52 pour le `LOT_ID`
**SITE-EXPLICITE-1-STATIC-SITE-GUARD-20260906**. **La classe D reste fermée
et aucune correction n'est demandée par cette demande.**
