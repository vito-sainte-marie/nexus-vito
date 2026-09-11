# SITE-EXPLICITE-1-STATIC-SITE-GUARD — ADR-0001 devient un invariant

Exécuté le 06/09/2026. Code de gouvernance uniquement : **aucune policy
modifiée, aucune migration métier, aucune correction.**

## 1. Ce que la garde analyse — et pourquoi pas la base vivante

`outils/garde-portee-site.js` rejoue le **DDL des policies des 253 migrations
versionnées**, dans l'ordre, et reconstitue l'état final. Aucun secret, aucun
réseau, reproductible en CI — ce que l'arbitrage désignait comme préférable.

Le prix de ce choix est une grammaire bornée : `create`, `drop`, `alter
policy`. **Quand elle ne comprend pas, elle répond `UNKNOWN` et ne conclut
jamais `SAFE`.**

## 2. Ce qu'elle sait reconnaître

Trois formes de contrôle de portée, toutes **observées dans le code réel** :

| Forme | Exemple |
|---|---|
| fonction de site | `site_id = current_employee_site_id()` |
| sous-requête employé | `site_id IN (SELECT e.site_id FROM employees e WHERE e.id = auth.uid())` |
| jointure de portée | `... JOIN employees e ON e.site_id = m.site_id ...` |

La troisième a été **apprise à la calibration** : la garde accusait
`advisor_message_evidence` de ne pas contrôler la portée alors qu'elle le fait
par jointure. Une garde qui ignore une manière d'écrire une règle produit des
accusations, pas des constats — c'est l'erreur qu'elle est censée éviter.

Deux règles de prudence, exigées par l'arbitrage et vérifiées par test :

- **refuser tout n'est jamais `SAFE`** — `false` interdit, il ne contrôle pas
  la portée, et une policy élargie demain ne protégerait plus rien ;
- **la branche créateur ne conclut pas** — capacité transverse assumée, ni
  sûre ni vulnérable au sens de l'ADR : elle est signalée pour relecture.

## 3. Résultats sur l'état actuel

| Classe | Policies |
|---|---:|
| `SAFE` | **183** |
| `VULNERABLE` | **3** |
| `UNKNOWN` | 27 |
| `NOT_APPLICABLE` | 152 |
| Incohérences entre faces | 1 |
| DDL non compris | **0** |

365 policies analysées, 162 tables à portée site.

### Les trois VULNERABLE — nouvelles occurrences du motif ADR-0001

| Table | Policy | Face | Contrôle effectif |
|---|---|---|---|
| `progression_badge_awards` | `employee_own_badge_insert` | INSERT | `employee_id = auth.uid()` |
| `progression_points_ledger` | `employee_own_points_insert` | INSERT | `employee_id = auth.uid()` |
| `inventaire_quart_employes` | `update_inventaire_quart_employes` | UPDATE | `employee_id = auth.uid() OR role IN (manager, gerant)` |

Vérifiées contre la base : `progression_badge_awards.site_id` et
`progression_points_ledger.site_id` sont **`NOT NULL` sans défaut**. Un
employé fournit donc le site, et **rien ne le contrôle** — il peut inscrire un
badge ou des points sur un autre commerce.

`inventaire_quart_employes` n'a pas de colonne site : sa portée est
**indirecte**, portée par `quart_id → inventaire_quarts.site`. Son `INSERT` la
contrôle, son `UPDATE` non. C'est l'incohérence de faces détectée, et c'est
exactement le cas « identité plus précise » que l'ADR prévoit.

**Aucune n'est corrigée.** Retour Handoff avant toute correction.

### Les 27 UNKNOWN

Ce ne sont pas des défauts : ce sont les endroits où la garde refuse de
conclure. Majoritairement des policies `FOR ALL` dont le contrôle ne
mentionne ni acteur ni portée — souvent des tables de configuration écrites
par `service_role`. Elles demandent une relecture humaine, pas une correction
automatique.

## 4. Calibration contre la base vivante

Faite une fois, hors CI, pour vérifier que le modèle statique correspond au
réel. Les six occurrences historiques d'ADR-0001 ressortent **`SAFE`** dans le
rejeu **et** dans la base — elles servent désormais de corpus de régression
permanent.

Deux défauts d'analyse ont été trouvés et corrigés à cette occasion :

1. `ON "public"."table"` capturait `public` comme nom de table — 30 policies
   mal rattachées ;
2. les identifiants entre guillemets d'un dump cassaient la reconnaissance des
   formes — 24 `UNKNOWN` de trop.

Les deux poussaient vers `UNKNOWN`, donc du bon côté ; mais une garde trop
bruyante n'est pas lue, et une garde qu'on ne lit pas ne garde rien.

## 5. Registre des dérogations

`docs/gouvernance/garde-portee-site-derogations.json` — **vide à ce jour**.
Chaque écart futur devra être nommé, motivé, daté et attribué ; une entrée
incomplète fait échouer la garde. Aucune exclusion silencieuse n'est possible.

## 6. Mode CI — non bloquante, délibérément

La garde rapporte dans la CI mais **n'arrête pas le build** : l'arbitrage
conditionne son activation à la revue de ses résultats par les trois
Guardians, revue qui est proposée dans ce lot et non encore arbitrée.

Son **test propre**, lui, est bloquant, puisqu'il vit dans la suite. La garde
peut donc se taire ; elle ne peut pas mentir sans qu'on le voie.

Coût mesuré : moins d'une seconde, aucune dépendance réseau.

**Désactivation** : retirer l'étape du workflow. Le fichier reste, sans effet.

## 7. Ce que cette garde ne prouve pas

- Elle protège **un** invariant, pas « la sécurité RLS ».
- Elle lit les **migrations**, pas la base : une modification appliquée hors
  migration lui échapperait.
- Les 27 `UNKNOWN` ne sont ni sûrs ni vulnérables : ils sont **non conclus**.
- Les preuves comportementales adversariales restent nécessaires.
