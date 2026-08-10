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

## 7. NEXUS FDJ — Grattage & tirages (tables `fdj_*`) — nouvelle section, 09/08/2026

Module distinct des sections 1 à 6 (produits d'épicerie/tabac) : la Française des Jeux a son
propre moteur de calcul, **`nexus-fdj-moteur.js`**, seule source de vérité pour les formules
ci-dessous — jamais dupliquées dans `NEXUS-FDJ-v1.html` (écran employé) ni
`NEXUS-FDJ-Manager-v1.html` (écran manager). Définitions imposées par l'audit "Moteur de
clairvoyance manager" (§32) avant de construire toute statistique dessus (Phase B de ce même
audit).

| KPI | Définition | Formule | Source |
|---|---|---|---|
| CA grattage | Chiffre d'affaires grattage d'un quart | Somme, par jeu, de `(stock_initial + appro − stock_final) × prix` | `NexusFdjMoteur.ventesGrattageTotal()` |
| Caisse grattage | Caisse théorique issue du grattage seul | `ventes_grattage_valeur − lots_payes_grattage` | `NexusFdjMoteur.caisseGrattage()` |
| Caisse attendue | Caisse totale que NEXUS attend en fin de quart | `caisse_grattage + caisse_tirages + régularisations` | `NexusFdjMoteur.caisseAttendue()` |
| Écart | Écart de caisse d'un quart | `caisse_réelle − caisse_attendue` | `NexusFdjMoteur.ecartCaisse()` |
| Stock bureau | Carnets non activés physiquement au bureau, pour un jeu | Solde des mouvements (`reception`, `transfert`, `retour`, `blocage`) affectant le bureau, depuis le dernier point zéro (voir plus bas) | `NexusFdjMoteur.soldesCarnetsAvecReference().bureau` |
| Stock caisse non activé | Carnets confiés à la caisse mais pas encore activés, pour un jeu | Transferts vers la caisse − activations − retours/blocages depuis la caisse, depuis le dernier point zéro | `NexusFdjMoteur.soldesCarnetsAvecReference().nonActives` |
| Rotation | Vitesse d'écoulement d'un jeu | Non figée : proxy actuellement disponible = nombre d'activations par jour (`view_fdj_game_daily.nb_activations`), formule d'unité de temps précise à figer en Phase C | *À compléter en Phase C* |
| Autonomie | Nombre de jours de stock restant pour un jeu | Stock disponible (bureau + caisse non activé) ÷ rythme moyen de vente récent | **Non implémenté** — nécessite de combiner l'état stock (JS) et un rythme de vente (SQL), volontairement reporté à la Phase C (voir note "Vérité avant certitude" ci-dessous) |
| Taux conformité | Part des quarts sans écart, sur une période | `nb_quarts_conformes / nb_quarts_controles` (uniquement les quarts dont la caisse n'est plus "provisoire") | `view_fdj_daily_summary` et dérivées |

**Vérité avant certitude :** tant que `tickets_par_carnet` n'est pas connu pour un jeu, ou que
l'historique de ventes est insuffisant, l'autonomie ne doit jamais être affichée comme un chiffre
— uniquement « non calculable ». Même règle pour la rotation tant que la formule n'est pas figée.

### Point zéro du stock (`fdj_stock_references`)

Le stock bureau/caisse n'est pas un compteur stocké : il se recalcule à partir des mouvements
bruts (`fdj_stock_movements`) et du dernier **inventaire de référence validé** (contrôle physique
manager, table `fdj_stock_references` + `fdj_stock_reference_lignes`). Tout mouvement antérieur à
ce point zéro est ignoré pour le calcul physique (il reste dans l'historique/audit) — « à compter
de cet inventaire, seuls les mouvements postérieurs modifient le stock » (demande explicite de
Frédéric, 09/08/2026). Premier point zéro certifié : 09/08/2026, 75 carnets bureau + 17 caisse non
activée = 92 au total, jeu par jeu.

### Vues d'agrégation Phase B (grain quotidien, jamais une nouvelle vérité)

Créées le 09/08/2026 pour préparer la page NEXUS FDJ - Analyse (Phase C) sans recalculer aucune
formule métier — elles assemblent des valeurs déjà validées. Grain quotidien partout : n'importe
quelle période (aujourd'hui, semaine, mois, dates personnalisées) se recompose par somme sur une
plage de dates, sans multiplier les vues par période.

| Vue | Grain | Contenu |
|---|---|---|
| `view_fdj_shift_facts` | 1 ligne / quart | Base commune : quart + caisse + ventes assemblés, jamais recalculés |
| `view_fdj_daily_summary` / `_weekly_summary` / `_monthly_summary` / `_yearly_summary` | jour / semaine ISO / mois / année | CA grattage, tickets vendus, caisse tirages, écart total, quarts conformes — écarts "provisoire" toujours exclus |
| `view_fdj_game_daily_ventes` | jour × jeu | Tickets vendus, CA, nombre de quarts comptés (uniquement quarts validés) |
| `view_fdj_game_daily_mouvements` | jour × jeu | Activations, transferts, réceptions, blocages (comptes ET quantités) — toujours connu, jamais `null` |
| `view_fdj_game_daily` | jour × jeu | Fusion des deux précédentes (FULL OUTER JOIN) — `tickets_vendus`/`ca` restent `null` si aucun comptage validé ce jour-là (à ne jamais confondre avec 0) |
| `view_fdj_price_tier_daily` | jour × palier de prix | Tickets vendus et CA par palier (1 €, 2 €, 3 €, 5 €, 10 €, 15 €), calculés à partir des ventes réelles |
| `view_fdj_employee_daily` | jour × employé | CA, tickets, écarts, toujours avec le nombre de quarts (jamais un classement sans volume) |
| `view_fdj_discrepancy_daily` | jour × motif d'écart | Occurrences et montant des écarts validés, pour retrouver une cause récurrente sans recompter la caisse |

**Choix délibéré — pas de `view_fdj_stock_state` :** contrairement à la suggestion de l'audit,
l'état du stock (bureau/caisse/activé) n'a pas été dupliqué en vue SQL. Ce calcul dépend du point
zéro et vit déjà, testé, dans `NexusFdjMoteur.soldesCarnetsAvecReference()` — le réécrire en SQL
créerait exactement le risque que l'Article 11 interdit (deux formules pour la même vérité,
vouées à diverger). La page Analyse (Phase C) doit continuer à appeler cette fonction JS pour
tout ce qui touche à l'état du stock.

### Conseiller FDJ (Phase D, 09/08/2026)

`NexusFdjMoteur.calculerCandidatsFdj()` reprend les règles déterministes (rupture/vigilance de
stock, écarts de caisse validés, recul/progression de CA) déjà exposées dans l'onglet Vue
d'ensemble et l'onglet Conseiller de `NEXUS-FDJ-Analyse-v1.html` — une seule implémentation,
consommée aussi par `NexusConseiller.normaliserFdj()` pour rejoindre le tri fusionné de
`NEXUS-Brief-v1.html` (moteur `fdj`, non validable, résolution constatée directement dans l'écran
FDJ concerné plutôt que via `journal_decisions`).

### NEXUS Coach x FDJ Pilotage (Phase 1, 09/08/2026)

Micro-coaching quotidien **par employé** — un conseil maximum par jour, choisi selon la
hiérarchie stricte de l'audit "Coach x FDJ Pilotage" (§5) : 1) risque de contrôle actif,
2) action obligatoire/procédure sensible, 3) stock susceptible de bloquer la vente, 4) axe de
progression individuel documenté, 5) opportunité commerciale, 6) conseil général de procédure en
repli. Distinct du Conseiller FDJ ci-dessus : celui-ci alimente Brief/FDJ-Analyse avec plusieurs
signaux pour le manager, Coach n'en retient qu'un seul pour l'employé lui-même — même principe
Article 11 que partout ailleurs (« la détection ne doit pas vivre dans Coach, elle doit vivre
dans le moteur FDJ Pilotage » — audit §2), donc **`nexus-coach-fdj-moteur.js`** est le seul
endroit où les règles sont évaluées ; aucune copie prévue dans un futur écran employé/manager.

| Table | Rôle |
|---|---|
| `coach_rules` | Catalogue des règles (`rule_id`, `priority` = tier 1 à 6, `minimum_sample`, `cooldown_days`, `message_template_id`, `active`) |
| `coach_daily_recommendations` | La recommandation retenue pour un employé et un jour donnés — `unique(site, employee_id, date)` impose au niveau base la règle « jamais plus d'un conseil par jour » (audit §26), pas seulement côté application |
| `coach_recommendation_events` | Historique d'interaction (`shown`/`acknowledged`/`dismissed`/`completed`) — jamais une note de performance |

Règles V1 (12, dans la fourchette 10-15 recommandée par l'audit §27) :

| rule_id | Tier | Famille | Condition |
|---|---|---|---|
| `fdj_activation_chain` | 1 | Sécurité/conformité | Une activation a été tracée sans transfert de carnet correspondant (réutilise `fdj_alertes` existante) |
| `fdj_report_missing` | 2 | Rigueur de saisie | Un quart récent reste en brouillon, jamais clôturé |
| `fdj_report_late` | 2 | Rigueur de saisie | Clôture en retard sur ≥ 50 % des derniers quarts mesurés (échantillon ≥ 5) |
| `fdj_correction_recurrente` | 2 | Rigueur de saisie | Correction de comptage sur ≥ 40 % des derniers quarts (échantillon ≥ 5) |
| `fdj_stock_rupture_risk` | 3 | Stock | Un jeu n'a plus de carnet non activé en caisse |
| `fdj_stock_reserve_faible` | 3 | Stock | Un jeu n'a plus qu'un carnet non activé et peu de réserve au bureau |
| `fdj_regularite_levier` | 4 | Progression | Taux de conformité ≥ 95 % sur ≥ 10 quarts contrôlés — passer au levier commercial |
| `fdj_palier_sous_represente` | 5 | Vente | Un palier de prix pèse < 60 % de son poids site, sur ≥ 10 ventes |
| `fdj_jour_faible` | 5 | Heures/jours forts | CA moyen du jour ≤ 80 % de la moyenne personnelle, sur ≥ 8 occurrences |
| `fdj_jour_fort` | 5 | Heures/jours forts | CA moyen du jour ≥ 120 % de la moyenne personnelle, sur ≥ 8 occurrences |
| `fdj_relation_client_opportunite` | 5 | Relation client | Jour historiquement actif **au niveau du site** et stock du plus petit palier sain (jamais une intuition — deux faits mesurés) |
| `fdj_conseil_general` | 6 | — | Repli si aucune règle personnalisée n'est fiable — toujours identifié comme générique |

**Étapes suivantes (non commencées) :** brancher les données réelles (fdj_shifts,
fdj_shift_counts, vues Phase B) pour construire l'objet `faits` attendu par
`NexusCoachFdj.evaluerReglesCoach()`, puis l'écran employé « Conseil du jour », la synthèse
manager, et la remontée vers Brief (audit §27, items 10 à 13) — dans cet ordre, comme prévu par
l'audit lui-même.

---

## Historique des versions

| Version | Date | Changement |
|---|---|---|
| v1 | 07/07/2026 | Création initiale — pipeline Decenium (.xls), formule d'évolution naïve, NEXUS Score composite (jamais implémenté depuis, à notre connaissance) |
| v2 | 08/08/2026 | Réécriture complète des sections Ventes & Marge et Évolution/Comparaison de périodes à partir du code réel. Ajout de la section R2/R3/R4 (absente de la v1). Mise à jour du statut des chantiers ouverts (écart de caisse résolu autrement que prévu). Déclenchée par la découverte, le même jour, que le Centre d'Intelligence NEXUS dupliquait le moteur de détection au lieu d'utiliser `nexus-conseiller.js` — corrigé dans le même lot de travail. Sections Classification/Merchandising non revérifiées, marquées comme héritées. |
| v2.1 | 09/08/2026 | Ajout de la section 7 — NEXUS FDJ (grattage & tirages), déclenché par l'audit "Moteur de clairvoyance manager" qui exige une définition unique par KPI avant de construire les statistiques (Phase B). Documente les formules déjà en production dans `nexus-fdj-moteur.js`, le modèle de point zéro du stock, et les 9 vues d'agrégation créées ce jour. |
| v2.2 | 09/08/2026 | Ajout à la section 7 : Conseiller FDJ (Phase D — `calculerCandidatsFdj`/`normaliserFdj`, remontée Brief) et NEXUS Coach x FDJ Pilotage (Phase 1 — schéma `coach_*` + 12 règles V1 de `nexus-coach-fdj-moteur.js`), déclenchés respectivement par l'audit "Moteur de clairvoyance manager" (§46) et l'audit "Coach x FDJ Pilotage" (§16/§27/§28). |

Prochaine révision suggérée : après vérification des sections héritées (§5) et des deux chantiers
au statut inconnu (§4 — Anomalie stock, Capacité de réassort). Côté FDJ : figer les formules de
rotation et d'autonomie au moment de construire la Phase C (page Analyse).
