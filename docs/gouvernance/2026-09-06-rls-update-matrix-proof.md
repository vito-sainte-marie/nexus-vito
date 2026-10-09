# SITE-EXPLICITE-1-RLS-UPDATE-MATRIX-PROOF — mutation après création

Exécutée le 06/09/2026 sur `nexus-test`. **Phase de mesure : aucune policy
modifiée, aucune correction.** Transactions annulées, identités réelles.

Question posée : *une ligne correctement créée peut-elle ensuite être déplacée
vers un autre site ?*

## 0. La sémantique qu'il fallait connaître avant de compter

Premier relevé brut : 55 policies `UPDATE` sur des tables portant un site,
dont **42 sans `WITH CHECK`**. Lu naïvement, cela donnait 42 trous.

**C'est faux.** PostgreSQL applique l'expression `USING` d'une policy `UPDATE`
**également à la nouvelle ligne** lorsque `WITH CHECK` est absent. Une policy
`USING (site = …)` sans `WITH CHECK` contrôle donc bien la destination.

Le vrai critère n'est pas la présence d'un `WITH CHECK`, c'est le **contrôle
effectif** — `coalesce(with_check, using)` — et ce qu'il contient.

**Seconde correction, de mon propre classificateur.** J'ai d'abord cherché
`current_employee_site_id` et trouvé 7 policies « sans contrôle de site ».
Cinq d'entre elles contrôlent le site autrement :
`site_id IN (SELECT e.site_id FROM employees e WHERE e.id = auth.uid())` —
même sémantique, autre écriture. Les compter comme des trous aurait produit
cinq fausses alertes.

## 1. Matrice structurelle — 55 policies `UPDATE`

| Classe | Policies | Dont sans `WITH CHECK` explicite |
|---|---:|---:|
| **A1** — site contrôlé via `current_employee_site_id()` | 47 | 37 |
| **A2** — site contrôlé via sous-requête `employees` | 5 | 4 |
| **B** — branche créateur (`sites`) | 1 | 0 |
| **C** — **aucun contrôle de site** | **2** | 1 |

## 2. Les deux anomalies — confirmées par comportement

| Table | Identité | État initial | Mutation tentée | Attendu | **Observé** | Mécanisme |
|---|---|---|---|---|---|---|
| `advisor_rules` | manager | `site_id = nexus-station-test` | → `site-fantome-test` | refus | **DÉPLACÉE** | `USING` ne teste que le rôle |
| `apprentissage_snapshots` | employé ordinaire | `site_id = nexus-station-test` | → `site-fantome-test` | refus | **DÉPLACÉE** | `USING (employee_id = auth.uid())` |

```
C1 advisor_rules (manager)                     : DEPLACEE vers « site-fantome-test »  ANOMALIE
C2 apprentissage_snapshots (employe ordinaire) : 1 DEPLACEE(S)  ANOMALIE
```

**Aucune n'a été corrigée.**

### Ce que chacune signifie

**`advisor_rules`** — `manager_update_advisor_rules` vérifie uniquement que
l'appelant est `manager` ou `gerant`. **Aucune mention du site.** Un manager de
n'importe quel commerce peut donc réattribuer n'importe quelle règle Advisor à
n'importe quel site. Les 31 règles actuelles sont globales (`site_id IS NULL`),
ce qui limite l'effet aujourd'hui — mais la policy autorise l'inverse.

**`apprentissage_snapshots`** — `USING (employee_id = auth.uid())`, sans autre
condition. **C'est exactement la forme du défaut trouvé sur `mission_progress`
au lot 2B** : l'auteur reste l'auteur, mais le site peut changer. La table est
vide en Test ; la ligne de preuve a été créée puis annulée.

## 3. Contrôles — la garde fonctionne ailleurs

| Table | Identité | Résultat |
|---|---|---|
| `shifts` | manager | **REFUSÉ `42501`** |
| `pointages` | manager | **0 ligne déplacée** |

Deux refus de nature différente, et la distinction mérite d'être notée :
`shifts` refuse **bruyamment** par `WITH CHECK`, `pointages` refuse
**silencieusement** — le `USING` ne rend simplement aucune ligne visible pour
la mise à jour. Les deux protègent ; seul le premier le dit.

## 4. Inventaire `DELETE` — relevé, non ouvert

| Classe | Policies |
|---|---:|
| Site contrôlé | 18 |
| Créateur | 1 |
| **Aucun contrôle de site** | **1** — `advisor_rules.manager_delete_advisor_rules` |

Même table, même cause que l'anomalie C1 : les policies d'`advisor_rules` sont
écrites sur le rôle, jamais sur le site. **Inventorié comme angle mort
résiduel, non traité dans ce lot.**

## 5. Profil créateur

Une seule policy `UPDATE` lui accorde explicitement un droit :
`sites.createur_update_sites`. Toutes les autres tables sont donc
`NOT_APPLICABLE` pour ce profil, conformément à la règle posée — sa capacité
transverse reste à prouver selon son contrat, pas à supposer.

## 6. Ce que cette matrice ne prouve pas

- Le sondage comportemental a porté sur les **deux candidates structurelles**
  et deux contrôles. Les 52 policies de classe A et A2 sont classées par
  **lecture de leur expression**, pas éprouvées une à une.
- Les triggers pouvant modifier le site à l'insu de la policy n'ont pas été
  recherchés.
- Ces preuves vivent en transaction annulée : elles ne protègent contre
  **aucune régression**.
