# NEXUS Data Dictionary — v2

Programme NEXUS — Station pilote Vito Sainte-Marie Usine
Date de création : 08/08/2026 · Statut : Version de travail, à valider
Remplace : NEXUS Data Dictionary v1 (07/07/2026)

## Pourquoi cette v2

La v1 a été rédigée le 07/07/2026, en Sprint 1, avant que l'architecture actuelle n'existe : elle
décrit un pipeline Decenium (.xls) et une formule d'évolution naïve (`(N+1 − N) / N`), sans la
logique de périodes comparables ni les règles de détection qui tournent aujourd'hui en
production. Un audit du code réel (08/08/2026, à la demande de Frédéric, dans l'esprit de
l'Article 11 de la Constitution NEXUS — « une seule vérité ») a montré que cet écart n'était pas
que documentaire : le Centre d'Intelligence NEXUS avait sa propre copie du moteur de détection,
avec un comportement réellement différent du Cockpit sur les périodes en cours d'import
(corrigé le même jour, voir historique des versions).

Cette v2 documente les formules et sources **telles qu'elles existent réellement dans le code**
au 08/08/2026, vérifiées fichier par fichier plutôt que reconstruites de mémoire. Elle garde le
principe fondateur de la v1 : **aucune métrique n'entre dans un écran NEXUS sans avoir une ligne
ici avec une définition, une formule, une source et une fréquence.**

Les entrées non revérifiées depuis la v1 (classification ABC, facing, prix imposé, fidélisation)
sont marquées **🔵 Hérité v1, non revérifié** — pas relues ligne à ligne cette fois-ci, donc à
prendre avec la même prudence qu'avant, pas comme validées à nouveau.

---

## 1. Ventes & Marge (table `products`)

| Terme | Définition | Formule | Source actuelle | Fréquence |
|---|---|---|---|---|
| `quantite` | Quantité d'unités vendues sur la période | Colonne mappée depuis le fichier importé (synonymes reconnus : qte, quantite, qty, stock actuel) | `NEXUS-Import-v1.html` — import flexible par mapping de colonnes (CSV/XLS, plus de dépendance à un format Decenium unique) | Par période d'export |
| `prix_achat` (PMA) | Prix moyen d'achat de l'unité | Colonne mappée (synonymes : pma, pa ht, prix achat, cout, cost) | Import flexible | Par période d'export |
| `prix_vente` (PU HT) | Prix unitaire de vente HT | Colonne mappée (synonymes : pu ht, pv ht, prix vente, prix, pvht) | Import flexible | Par période d'export |
| `ca` | Chiffre d'affaires HT généré par une référence sur la période | `quantite × prix_vente`, arrondi à 2 décimales | Calculé au moment de l'import (`NEXUS-Import-v1.html`), stocké en base — pas recalculé à la volée ensuite | Au moment de l'import |
| `marge` | Marge totale générée par une référence sur la période | `quantite × (prix_vente − prix_achat)`, arrondi à 2 décimales | Calculé au moment de l'import, stocké en base | Au moment de l'import |
| Marge % | Taux de marge sur CA | `marge / ca` (si `ca > 0`, sinon 0) | Calculé à l'affichage (NEXUS-Produits-v1.html et autres) | À chaque affichage |
| `categorie` | Rayon d'appartenance de la référence | Colonne mappée, avec une correction automatique : si le nom de l'article contient « CBD », la catégorie devient « CBD » même si le fichier source la range dans « Tabac » (le CBD n'est pas réglementé comme le tabac, marge ~50 % contre ~14 %) | `corrigerCategorie()` dans `NEXUS-Import-v1.html` | Au moment de l'import |
| `code_barres` | Identifiant produit | Colonne mappée (synonymes : code barres, ean, codebarre), espaces retirés | Import flexible | Au moment de l'import |
| `site` | Station propriétaire de la ligne | Renseigné par l'employé qui importe | Import | Au moment de l'import |
| `periode_debut` / `periode_fin` | Bornes de la période couverte par l'import | Saisies par le manager lors de l'import — **un mauvais choix de dates double silencieusement le CA et la marge partout dans l'app** (avertissement explicite dans le code d'Import) | Import | Au moment de l'import |

**Note honnête (non résolue) :** une colonne TVA est détectée par le mapping d'import mais n'est
actuellement stockée nulle part dans `products` — à clarifier si elle doit l'être avant d'en faire
un usage quelconque.

---

## 2. Comparaison de périodes & Évolution — réécrit intégralement depuis la v1

C'est le changement le plus important par rapport à la v1. L'ancienne formule
(`(Valeur N+1 − Valeur N) / Valeur N`, comparant simplement les deux périodes les plus récentes)
a été identifiée comme buguée le 23/07/2026 : elle fabrique une évolution fausse dès que les deux
périodes se chevauchent, ou n'ont pas une durée comparable (ex. comparer un trimestre complet à
un mois entamé). Le correctif est centralisé dans **`nexus-periodes.js`**, seule source de
vérité, utilisée aujourd'hui par Rayon, Cockpit, Produits, Centre d'Intelligence NEXUS et
`nexus-conseiller.js`.

| Terme | Définition | Formule | Source actuelle | Fréquence |
|---|---|---|---|---|
| Période affichée | La période la plus récente présente dans les données — sert aux indicateurs « instantanés » (CA du moment, contribution au rayon), même si elle est encore en cours | La période dont `periode_debut`/`periode_fin` est la plus récente | `NexusPeriodes.analyserPeriodes()` | Recalculé à chaque chargement d'écran |
| Paire comparable | Les deux périodes consécutives les plus récentes valables pour un calcul d'évolution | Une paire (actuelle, précédente) est valable seulement si elles ne se chevauchent pas ET si l'écart de durée entre les deux est ≤ 20 % | `NexusPeriodes.analyserPeriodes()` (fonction `paireValide`) | idem |
| `periodeEnCours` | Indique si la période affichée est trop récente/incomplète pour faire elle-même partie de la paire comparable | `true` si la période affichée ≠ la période « actuelle » de la paire comparable | `NexusPeriodes.analyserPeriodes()` | idem |
| Évolution (produit) | Variation du CA d'un article entre la paire comparable actuelle et précédente | `(ca_paire_actuelle − ca_paire_précédente) / ca_paire_précédente` — retourne `null` (pas 0 ou un chiffre inventé) si la base précédente est nulle ou absente | `NexusConseiller.calculerCandidatsProduits()` (Cockpit, Produits, CIN) | Recalculé à chaque chargement |
| Évolution (rayon) | Variation du CA total d'une catégorie entre la paire comparable actuelle et précédente | Même formule, agrégée par `categorie` au lieu d'être par article | `NEXUS-Rayon-v1.html` (`construireRayons()`) | Recalculé à chaque chargement |

**Vérifié le 08/08/2026 :** Produits, Rayon et Cockpit utilisent aujourd'hui exactement la même
mécanique via `nexus-periodes.js` — c'est un des deux points explicitement demandés par
Frédéric pour cette v2, et il n'y a plus d'écart constaté entre ces trois écrans (deux correctifs
antérieurs, les 23/07 et 24/07/2026, avaient déjà aligné Produits sur Rayon). Rayon et Produits
comparent à des granularités différentes (rayon vs. article) — c'est un choix voulu, pas un bug,
puisque les deux écrans répondent à des questions différentes.

---

## 3. Contribution & règles de détection R2/R3/R4 — nouvelle section (absente de la v1)

Source unique : **`nexus-conseiller.js`**, fonction `calculerCandidatsProduits()`. Utilisée par
NEXUS-Cockpit-v2.html, NEXUS-Produits-v1.html et NEXUS-Centre-Intelligence-v1.html (branché sur
cette source commune le 08/08/2026 — voir historique des versions).

| Terme | Définition | Formule | Seuil |
|---|---|---|---|
| Contribution | Poids d'une référence dans le CA de son rayon, sur la période affichée | `ca_produit / ca_total_du_rayon` (sur la période affichée, pas la paire comparable) | — |
| R4-RENFORT-A | Référence à contribution structurellement forte | `contribution ≥ 15 %` ET `ca > 0` | 15 % |
| R3-HAUSSE | Référence en forte progression | `évolution ≥ 20 %` (sur la paire comparable) | 20 % |
| R2-BAISSE | Référence en repli à vérifier | `évolution ≤ -30 %` (sur la paire comparable) | -30 % |

**Honnêteté assumée par construction (Article 5 de la Constitution NEXUS) :** R2-BAISSE ne
conclut jamais à une vraie tendance — NEXUS n'a aujourd'hui aucune donnée de stock pour
distinguer une vraie baisse de ventes d'une rupture de stock non détectée, donc le texte affiché
reste toujours une demande de vérification terrain, jamais une affirmation.

Le geste concret recommandé pour chaque règle dépend du type de rayon (`typeActionPourCategorie()`
dans `nexus-conseiller.js` : facing / stock / support / production / comptoir / présentoir) — un
gaz stocké en cage ou une carte prépayée dématérialisée ne se gèrent pas comme une bière en
linéaire.

---

## 4. Chantiers ouverts — mise à jour du statut de la v1

| Terme | Statut v1 (07/07/2026) | Statut vérifié le 08/08/2026 |
|---|---|---|
| Rupture de stock | Bloqué — aucune donnée de stock | Toujours non résolu par un connecteur automatique. `NEXUS-Scanner-Stock-v1.html` apporte une réponse partielle à partir de relevés de stock **importés manuellement**, pas d'un flux temps réel. |
| Rotation | Bloqué — nécessite un stock moyen | Toujours non résolu de la même façon. Même limite que ci-dessus (Scanner Stock, relevés manuels). |
| Anomalie stock (stock théorique vs réel) | Bloqué — nécessite Digital Twin | Non revérifié cette session — statut inconnu, à confirmer. |
| Écart de caisse | Bloqué — « donnée détenue par Decenium, pas encore intégrée » | **Résolu, mais différemment que prévu.** NEXUS n'a pas attendu un connecteur Decenium : `NEXUS-Verify-v1.html` calcule les écarts à partir d'un rapport de recettes importé/saisi et des dépôts caisse par zone, tracés dans `audits_caisse` ; `NEXUS-Centre-Intelligence-v1.html` en tire un suivi mensuel cumulé (`caisse_sante_historique`). Ce n'est pas Decenium qui a fourni la donnée — NEXUS l'a construite lui-même côté saisie manager. |
| Capacité de réassort | Bloqué — aucune donnée de cadence | Non revérifié cette session — statut inconnu, à confirmer. |

---

## 5. Classification & Merchandising — 🔵 Hérité v1, non revérifié

Les entrées suivantes n'ont pas été relues dans le code cette session-ci — reprises telles
quelles depuis la v1, à vérifier avant de s'y fier de nouveau : Classification ABC, % Contribution
CA (au sens v1, différent de la contribution R4 ci-dessus qui se limite au rayon), Facing, Règle
de facing par classe, Recommandation NEXUS-xxx, Canal de vente, Prix imposé, Fidélisation/retour
client.

---

## 6. Sources de données

| Source | Statut | Ce qu'elle fournit aujourd'hui |
|---|---|---|
| Import flexible (CSV/XLS, mapping de colonnes) | ✅ Actif | Ventes, PMA, PU HT, catégorie, code-barres, par référence et par période — remplace le format Decenium unique de la v1 |
| `nexus-periodes.js` | ✅ Actif | Source unique de la comparaison de périodes (période affichée, paire comparable, `periodeEnCours`) |
| `nexus-conseiller.js` | ✅ Actif | Source unique du moteur R2/R3/R4, de la contribution, et de la fusion cross-moteurs du Conseiller NEXUS |
| Audits de caisse manuels (`audits_caisse`) | ✅ Actif | Écarts de caisse, sans connecteur externe |
| Connecteur automatique caisse/stock (Decenium ou équivalent) | ❌ Toujours pas construit | — |

---

## Historique des versions

| Version | Date | Changement |
|---|---|---|
| v1 | 07/07/2026 | Création initiale — pipeline Decenium (.xls), formule d'évolution naïve, NEXUS Score composite (jamais implémenté depuis, à notre connaissance) |
| v2 | 08/08/2026 | Réécriture complète des sections Ventes & Marge et Évolution/Comparaison de périodes à partir du code réel. Ajout de la section R2/R3/R4 (absente de la v1). Mise à jour du statut des chantiers ouverts (écart de caisse résolu autrement que prévu). Déclenchée par la découverte, le même jour, que le Centre d'Intelligence NEXUS dupliquait le moteur de détection au lieu d'utiliser `nexus-conseiller.js` — corrigé dans le même lot de travail. Sections Classification/Merchandising non revérifiées, marquées comme héritées. |

Prochaine révision suggérée : après vérification des sections héritées (§5) et des deux chantiers
au statut inconnu (§4 — Anomalie stock, Capacité de réassort).
