---
protocol: nexus-handoff/2
kind: request
lot_id: SITE-EXPLICITE-1-RLS-UPDATE-MATRIX-PROOF-20260906
seq: 1
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=501c0c7 production=501c0c7
  - id: matrice-update
    classe: VERIFIED
    valeur: 55 policies classees, 20 DELETE inventoriees
  - id: anomalies-confirmees
    classe: VERIFIED
    valeur: 2 lignes reellement deplacees vers un autre site
  - id: controles-negatifs
    classe: VERIFIED
    valeur: shifts refuse 42501, pointages 0 ligne deplacee
  - id: semantique-with-check
    classe: VERIFIED
    valeur: USING sert de WITH CHECK - 42 faux trous ecartes
  - id: classificateur-corrige
    classe: VERIFIED
    valeur: 5 fausses alertes ecartees avant publication
  - id: aucune-correction
    classe: VERIFIED
    valeur: aucune policy modifiee, classe D non ouverte
  - id: suite
    classe: VERIFIED
    valeur: 188/197
  - id: policies-classe-a
    classe: HUMAN
    valeur: 52 classees par lecture, non eprouvees
  - id: triggers-modifiant-le-site
    classe: HUMAN
    valeur: non recherches
  - id: createur
    classe: NOT_APPLICABLE
    valeur: une seule policy UPDATE lui accorde un droit
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete, aucun merge, aucun deploiement
---

# SITE-EXPLICITE-1-RLS-UPDATE-MATRIX-PROOF — deux anomalies, non corrigées

## Contrat anti-dérive

| Champ | Valeur |
|---|---|
| `objectif_metier` | Savoir si une ligne correctement créée peut ensuite être déplacée vers un autre site. |
| `gain_attendu` | **Sécurité** — l'unique défaut réel de la campagne était de cette forme ; il en restait deux, inconnus jusqu'ici. |
| `contrats_touches` | **aucun** — phase de mesure |
| `guardians_requis` | Architecture · Security & Isolation · QA / Regression |
| `preuves_exigees` | matrice table / opération / identité / état initial / mutation / attendu / observé / mécanisme |
| `definition_de_termine` | Matrice produite, anomalies remontées **sans correction**, retour Handoff. **Atteinte.** |

## Résumé

**Deux anomalies découvertes, confirmées par comportement, et non corrigées.**

```
C1 advisor_rules (manager)                     : DEPLACEE vers « site-fantome-test »  ANOMALIE
C2 apprentissage_snapshots (employe ordinaire) : 1 DEPLACEE(S)  ANOMALIE
```

Détail dans `docs/gouvernance/2026-09-06-rls-update-matrix-proof.md`.

## 1. Deux corrections de méthode, avant tout constat

**a) La sémantique de `WITH CHECK`.** Premier relevé : 55 policies `UPDATE`,
dont **42 sans `WITH CHECK`**. Lu naïvement : 42 trous. **C'est faux** —
PostgreSQL applique l'expression `USING` d'une policy `UPDATE` **aussi à la
nouvelle ligne** quand `WITH CHECK` est absent. Le bon critère est le contrôle
*effectif*, `coalesce(with_check, using)`.

**b) Mon classificateur.** J'ai ensuite cherché `current_employee_site_id` et
trouvé 7 policies « sans contrôle de site ». **Cinq le contrôlent autrement** :
`site_id IN (SELECT e.site_id FROM employees …)` — même sémantique, autre
écriture. Les compter aurait produit cinq fausses alertes.

Sans ces deux corrections, ce rapport aurait annoncé 42 trous là où il y en a
**deux**.

## 2. Matrice structurelle — 55 policies `UPDATE`

| Classe | Policies |
|---|---:|
| **A1** — site contrôlé via la fonction | 47 |
| **A2** — site contrôlé via sous-requête `employees` | 5 |
| **B** — branche créateur | 1 |
| **C** — **aucun contrôle de site** | **2** |

## 3. Les deux anomalies

| Table | Identité | État initial | Mutation | Attendu | **Observé** | Mécanisme |
|---|---|---|---|---|---|---|
| `advisor_rules` | manager | `nexus-station-test` | → autre site | refus | **DÉPLACÉE** | `USING` ne teste que le rôle |
| `apprentissage_snapshots` | employé ordinaire | `nexus-station-test` | → autre site | refus | **DÉPLACÉE** | `USING (employee_id = auth.uid())` |

**`advisor_rules`** — la policy vérifie uniquement que l'appelant est manager
ou gérant, sans aucune mention du site. Un manager de n'importe quel commerce
peut réattribuer n'importe quelle règle Advisor à n'importe quel site. Les 31
règles sont aujourd'hui globales, ce qui **limite l'effet sans fermer le
chemin**.

**`apprentissage_snapshots`** — `USING (employee_id = auth.uid())` seul. C'est
**exactement la forme du défaut trouvé sur `mission_progress`** : l'auteur
reste l'auteur, le site peut changer. Le même défaut existait donc à deux
endroits ; le premier a été trouvé par hasard, le second par cette matrice.

## 4. Contrôles — la garde tient ailleurs

| Table | Identité | Résultat |
|---|---|---|
| `shifts` | manager | **REFUSÉ `42501`** |
| `pointages` | manager | **0 ligne déplacée** |

Deux refus de nature différente : `shifts` refuse **bruyamment** par
`WITH CHECK`, `pointages` **silencieusement** — le `USING` ne rend aucune ligne
visible. Les deux protègent ; seul le premier le dit. C'est la même asymétrie
qui a rendu les refus silencieux d'`UPDATE` si difficiles à voir tout au long
de cette campagne.

## 5. Inventaire `DELETE` — relevé, non ouvert

| Classe | Policies |
|---|---:|
| Site contrôlé | 18 |
| Créateur | 1 |
| **Aucun contrôle de site** | **1** — `advisor_rules.manager_delete_advisor_rules` |

Même table et même cause que C1 : les policies d'`advisor_rules` sont écrites
sur le rôle, jamais sur le site. **Inventorié comme angle mort résiduel.**

## 6. Profil créateur

Une seule policy `UPDATE` lui accorde explicitement un droit —
`sites.createur_update_sites`. Toutes les autres tables sont donc
`NOT_APPLICABLE`, conformément à la règle : sa capacité transverse reste à
prouver, pas à supposer.

## Avis des Guardians

### Security & Isolation Guardian

**Deux chemins de mutation inter-site sont ouverts**, et l'un d'eux est
accessible à un employé ordinaire. Ce n'est pas une hypothèse de lecture : les
deux lignes ont réellement changé de site.

La gravité diffère. `apprentissage_snapshots` est vide et ne porte pas de
donnée d'exploitation. `advisor_rules` porte le **référentiel de décision** de
l'Advisor : une règle déplacée changerait ce que NEXUS recommande à une autre
station. Et la même table a **aussi** un `DELETE` sans contrôle de site.

**Avis : `advisor_rules` d'abord.** Et je maintiens la règle — la correction
devra ajouter le site, jamais retirer le contrôle de rôle.

### Architecture Guardian

Le même défaut à deux endroits, écrit deux fois de la même manière, est un
signe : ce n'est pas un oubli isolé mais **un motif** — « je contrôle l'auteur
et j'oublie le lieu ». Trois occurrences connues désormais, dont
`mission_progress` déjà corrigée.

**Avis : la correction devra viser le motif, pas les deux lignes.** Une ADR
formulant « toute policy de mutation contrôle l'auteur *et* le site » serait
plus utile que deux migrations ponctuelles.

Je note aussi que les policies d'`advisor_rules` raisonnent sur le rôle là où
tout le reste du système raisonne sur le site — une divergence de style qui a
produit deux défauts sur la même table.

### QA / Regression Guardian

Cette matrice a trouvé en une passe ce qu'une relecture n'avait pas vu en
plusieurs lots. Elle valide l'ordre décidé : sonder les `UPDATE` **avant**
d'ouvrir la classe D.

**Réserve, et elle porte sur moi** : mes deux erreurs de classification
auraient produit un rapport faux — 42 trous imaginaires, puis 5. Le fait que
je les aie corrigées avant publication ne rend pas la méthode fiable ; cela
montre qu'un classificateur non éprouvé ne doit pas être cru. **Ce
classificateur n'a pas de test.**

Les 52 policies de classe A et A2 sont classées **par lecture**, pas
éprouvées. Je ne les déclare pas sûres.

## Preuves

- 55 policies `UPDATE` classées ; 20 policies `DELETE` inventoriées.
- 2 anomalies **confirmées par comportement**, identités réelles, transaction
  annulée.
- 2 contrôles négatifs : `shifts` refusé `42501`, `pointages` 0 ligne.
- **Aucune policy modifiée, aucune correction, aucune donnée persistée.**
- Suite `188/197`, mêmes 9 échecs historiques.
- `main` et `production` : `501c0c7` — preuve calculée par l'outillage.

## Risques / anomalies

1. **Deux chemins de mutation inter-site restent ouverts** à cette heure,
   par respect de la gate. C'est un risque assumé le temps de l'arbitrage.
2. **52 policies classées par lecture**, non éprouvées.
3. **Mon classificateur n'a pas de test**, alors qu'il s'est trompé deux fois.
4. **Les triggers pouvant modifier le site** à l'insu d'une policy n'ont pas
   été recherchés.

## Questions pour arbitrage

**Q43 — Corriger les deux anomalies ?** Recommandation : **oui, dans un
sous-lot dédié**, `advisor_rules` en premier — elle porte le référentiel de
décision et cumule un `UPDATE` **et** un `DELETE` sans contrôle de site.

**Q44 — Une ADR plutôt que deux migrations ?** Recommandation : **les deux**.
L'ADR « toute policy de mutation contrôle l'auteur *et* le site » empêche la
quatrième occurrence ; les migrations ferment les deux existantes. La première
sans les secondes ne protège rien.

**Q45 — Faut-il éprouver les 52 policies de classe A ?** Recommandation :
**non par sondage exhaustif**, mais **oui par un contrôle CI** qui vérifie que
toute policy de mutation sur une table à site mentionne le site. C'est un test
statique, il tient dans la suite, et il aurait trouvé les deux anomalies.

## Action attendue de ChatGPT

Arbitrer Q43, Q44, Q45 pour le `LOT_ID`
**SITE-EXPLICITE-1-RLS-UPDATE-MATRIX-PROOF-20260906**. **Aucune correction
n'est demandée ni effectuée par cette demande, et la classe D n'est pas
ouverte.**
