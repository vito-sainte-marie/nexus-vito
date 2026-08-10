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

**Définition canonique : « CA FDJ » (10/08/2026, retour de Frédéric)** — le tableau ci-dessus
définit « CA grattage » au grain d'un quart. L'indicateur affiché partout dans l'app sous le nom
**« CA FDJ »** (Vue d'ensemble, Rapports, Brief) est une notion différente, à grain période, et doit
avoir une seule définition écrite ici pour ne jamais diverger d'un écran à l'autre :

> **CA FDJ (période) = `ca_grattage` + `caisse_tirages`**, sommés sur la période sélectionnée à
> partir de `view_fdj_daily_summary` (champs déjà validés, jamais recalculés — `sommerChamps(...,
> CHAMPS_SUMMARY)` dans `NEXUS-FDJ-Analyse-v1.html`).

Ce n'est PAS : les mises engagées par les clients, les encaissements bruts de caisse, ni une
« recette nette » après reversement FDJ — c'est la somme du chiffre d'affaires grattage (tel que
défini dans le tableau ci-dessus) et de la caisse tirages déclarée. Tout écran ou export qui
affiche « CA FDJ » doit utiliser exactement cette somme — ne jamais improviser une variante (ex.
grattage seul, ou avec une pondération différente) sous le même libellé, pour éviter qu'un jour
Brief annonce un chiffre et Pilotage un autre pour une définition légèrement différente du même nom
(Article 11, "une seule vérité").

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

**Étape 2 — données réelles branchées (09/08/2026) :** `nexus-coach-fdj-donnees.js` assemble
l'objet `faits` à partir des tables réelles et orchestre `obtenirRecommandationDuJour()`, idempotent
(une recommandation déjà générée pour un employé/jour n'est jamais recalculée — audit §3). Nouvelle
vue **`view_fdj_employee_price_tier_daily`** (jour × employé × palier, même filtre que
`view_fdj_game_daily_ventes` avec la dimension employé en plus) : aucune vue Phase B n'avait cette
dimension, nécessaire à `fdj_palier_sous_represente`.

**Limite honnête assumée — proxy de « retard de clôture » :** NEXUS ne stocke aujourd'hui aucune
heure de fin de quart théorique. `fdj_report_late` utilise donc un indicateur binaire grossier mais
vérifiable (quart clôturé un autre jour calendaire que sa date de service = « en retard »), pas un
nombre de minutes réel malgré le nom du champ `clotureRetardMin`. À corriger si NEXUS ajoute un jour
une heure de fin de quart planifiée — un seul endroit à changer (`chargerShiftsRecentsAvecCloture`).

**Vérifié de bout en bout (09/08/2026)** contre les données réelles du site (employé avec 3 quarts
validés) : assemblage des faits + sélection + construction du message, avec repli correct sur le
conseil général — l'échantillon actuel (3 quarts) est sous tous les seuils `minimum_sample` des
règles statistiques, NEXUS ne conclut donc rien de personnalisé, comme prévu par « vérité avant
certitude ».

**Étape 3 — écran employé (09/08/2026) :** `NEXUS-Coach-FDJ-v1.html`, volontairement léger (audit
§11) — titre, une phrase d'action, accordéon « Pourquoi ce conseil ? », bouton non contraignant
« Je l'applique aujourd'hui », aucun tableau. Le conseil général de repli est visuellement
identifié comme tel (audit §2), jamais confondu avec un conseil personnalisé.

**RLS resserrée (audit §21) :** la politique initiale de `coach_daily_recommendations` /
`coach_recommendation_events` ne scopait que par site, comme la plupart des tables `fdj_*` — trop
large ici, un conseil personnalisé étant plus sensible qu'un mouvement de stock. Corrigée pour
n'autoriser la lecture qu'à l'employé concerné (`employee_id = auth.uid()`, vrai dans ce projet où
`employees.id = auth.uid()`) ou à un manager/gérant du site — jamais un autre employé.

**Étape 4 — synthèse manager (09/08/2026) :** l'audit nomme explicitement cet écran « Écran manager
dans FDJ Pilotage » (§12) — ajouté dans l'onglet **Conseiller** de `NEXUS-FDJ-Analyse-v1.html`
(pas un nouvel onglet), sous la section « Coaching équipe ». Lit `coach_daily_recommendations` déjà
écrites côté employé — aucune règle recalculée. Affiche le thème dominant de la période, le nombre
de collaborateurs concernés, la répartition par famille (`NexusCoachFdj.FAMILLE_PAR_REGLE`,
classification partagée : sécurité/rigueur/stock/progression/vente/général), une évolution vs la
période de comparaison (une seule comparaison, jamais présentée comme une tendance confirmée — même
discipline que le Conseiller FDJ), et un détail par employé **replié par défaut** (audit §12 : « Le
manager ne doit pas lire les 10 conseils un par un »).

**Étape 5 — remontée Brief (09/08/2026) :** `NexusCoachFdj.calculerCandidatsCoachEquipe()` reprend
le tableau situation → restitution de l'audit §13, à partir de `coach_daily_recommendations` déjà
écrites (aucune règle recalculée dans Brief — "Brief doit être alimenté par le même moteur de
règles de FDJ Pilotage, pas par une logique recodée dans Brief") :

| Situation | Restitution |
|---|---|
| Tout conforme | Aucune carte |
| Règle sécurité/rigueur signalée ≥ 3 fois sur la période | Carte rouge — risque de contrôle récurrent |
| Même règle chez ≥ 3 collaborateurs | Carte orange — axe équipe à travailler |
| Signaux sécurité/rigueur en baisse ≥ 50 % vs la période précédente (base ≥ 3) | Carte verte — progrès équipe |

Normalisé via `NexusConseiller.normaliserCoach()` (moteur `coach`, distinct du moteur `fdj` du
Conseiller — deux sources différentes, jamais mélangées), non validable, rejoint le tri fusionné de
`NEXUS-Brief-v1.html` aux côtés des 8 autres moteurs. Les 4 situations et la garde anti-doublon
(une règle déjà couverte par la carte rouge n'ouvre pas aussi une carte orange) sont testées.

**Étape 6 — export PDF (09-10/08/2026, audit §23, §27 item 14) :** nouvel onglet **Rapports / Export**
dans `NEXUS-FDJ-Analyse-v1.html`, activé (retiré de la liste des onglets désactivés). « Sélection par
dates ou numéro de semaine, hebdomadaire / mensuel / annuel » (§23) : déjà couverte par le sélecteur
de période universel de la page (§8) — aucun second sélecteur construit.

Première version (09/08/2026) : génération PDF via `window.print()` + feuille `@media print`.
**Revue le lendemain (10/08/2026)** à la demande explicite de Frédéric, après avoir signalé un vrai
risque : les PWA iOS en mode standalone (`display: standalone`, le mode configuré dans
`site.webmanifest` de NEXUS) ont un bug WebKit documenté de longue date où l'aperçu d'impression ne
s'affiche pas correctement (bouton de sélection d'imprimante grisé) — `window.print()` n'est donc pas
fiable dans l'usage réel attendu (NEXUS installé sur l'écran d'accueil). Remplacé par un **moteur PDF
applicatif** (`nexus-pdf-moteur.js`, voir section 8) qui compose lui-même le document à partir des
données, jamais une "photo" de l'écran.

Contenu du rapport — réutilise strictement les fonctions déjà en place ailleurs sur la page, jamais
une troisième version des mêmes règles (Article 11) : synthèse (CA, évolution, jeu moteur, palier
moteur, jour le plus performant, jour à booster, taux de conformité, écart caisse cumulé) ; analyse
des ventes (courbe CA en image + Top jeux + répartition du CA par palier 1/2/3/5/10/15 €) ;
performance équipe (Top vendeurs, même seuil minimum de quarts que l'onglet Équipe) ; stock &
activations (ruptures/vigilance via `etatLigneStock()`, activations sur la période) ; conseil NEXUS
(synthèse Coach FDJ équipe, Étape 4) ; décisions recommandées (`candidatsFdjPeriode()`, Phase D).

**Mention « données provisoires » (§23) :** dès qu'au moins un quart de la période n'a pas encore
été contrôlé par un manager (`nb_quarts_controles < nb_quarts` — même signal que le taux de quarts
conformes affiché ailleurs sur la page, aucun nouveau seuil inventé), le rapport l'indique.

**Refonte "1 page A4" (10/08/2026)** à la demande explicite de Frédéric, après avoir testé la
première version multi-page pdf-lib : « Le moteur PDF ne doit pas essayer d'imprimer l'intégralité
des données disponibles : il doit sélectionner et hiérarchiser les informations réellement utiles
au pilotage. » `construireRapportPdf()` réécrit intégralement pour utiliser
`NexusPdfMoteur.ConstructeurRapportUnePage` (voir section 8) — zones fixes, jamais de deuxième page,
quelle que soit la quantité de données. Composition (toute la logique métier reste dans cette page,
le moteur reste générique) :

- **En-tête (20mm)** : app + période + site (+ mention "données provisoires" si applicable).
- **KPI (25mm)** : CA FDJ, Évolution, Quarts conformes, Écart caisse — 4 cartes.
- **Ce qu'il faut savoir (30mm)** : 5 points maximum (jeu moteur, palier moteur, jour le plus fort,
  jour à booster, point de vigilance).
- **Graphique (45mm)** : courbe CA réduite (canvas Chart.js repensé en 1200×260, ratio proche de la
  zone finale, pour ne pas être redessinée en bande étroite après réduction).
- **Ventes / mix produits (55mm, 2 colonnes)** : Top jeux (5 max, `tableauCompact`) à gauche,
  répartition par palier en mini-barres horizontales (`barresHorizontales`) à droite.
- **Équipe & Stock (45mm, 2 colonnes)** : à gauche, `choisirReferenceEquipe()` — UN SEUL vendeur
  "référence" (celui avec le CA/quart le plus élevé parmi les employés ayant atteint le seuil de 3
  quarts contrôlés, même seuil que l'onglet Équipe), les autres affichés sans classement ("vérité
  avant certitude" — comparer sur un échantillon de 1-2 quarts serait trompeur). À droite,
  `choisirJeuxPrioritaires()` — parmi les jeux en vigilance, ceux qui vendent bien (présents dans le
  Top jeux) sont mis en avant en priorité (rotation forte + stock bas = plus urgent qu'un jeu qui ne
  se vend pas), repli sur les 4 premiers si aucune intersection ; jamais la liste complète (renvoi
  vers FDJ Pilotage pour le détail).
- **Conseil & décisions (50mm, sous-divisé)** : `construireTexteConseilRapport()` compose un texte
  ≤ 250 caractères à partir des vraies données (palier/jeu moteur, thème Coach dominant si la place
  le permet — jamais un texte générique) ; décisions recommandées plafonnées à 3, marqueur carré
  coloré par urgence (rang 1 = critique/rouge, rang 2 = important/ambre, rang ≥ 3 =
  observation/jaune) — jamais d'emoji (non représentables par la police standard, cf. correctifs
  WinAnsi ci-dessous).
- **Pied de page (7mm)** : mention "données provisoires" si applicable, sinon la signature standard
  "vérité avant certitude, jamais une prédiction" + date/heure de génération.

`topJeux` n'est plus plafonné à 8 dans `assemblerDonneesRapportFdj()` (retiré le `.slice(0, 8)`) :
la donnée reste complète, seule la présentation (`max: 5` côté composition) plafonne — sinon le
compteur "+ N autres" du Top jeux aurait été faux au-delà de 8 jeux vendus.

**Diffusion du PDF généré :** `NexusPdfMoteur.partagerOuTelechargerPdf()` — Web Share API avec
fichier en priorité (fonctionne sur iOS Safari 15+ et Android Chrome, y compris en PWA standalone),
repli sur un téléchargement direct du Blob, et en tout dernier recours seulement l'ouverture dans un
nouvel onglet. Jamais `window.print()`.

**Étape suivante (non commencée, audit §27, item 15) :** mesure d'utilité et suppression des règles
peu pertinentes — nécessite plusieurs semaines d'usage réel, pas un chantier à un coup.

---

## 8. NEXUS PDF Moteur — export PDF applicatif partagé (`nexus-pdf-moteur.js`, 10/08/2026)

Décision explicite de Frédéric (10/08/2026) : NEXUS n'utilise plus `window.print()` comme moteur
principal d'export PDF, pour aucun module. À la place, `nexus-pdf-moteur.js` construit de vrais
fichiers PDF (Blob) à partir de DONNÉES fournies par la page appelante — jamais une "photo" de ce
qui est affiché à l'écran. Bibliothèque : **pdf-lib** (CDN cdnjs, licence MIT, aucune dépendance
payante), chargée avant ce script.

**Portée volontairement générique** — ce fichier ne connaît rien à FDJ, à Coach, ni à aucun module
métier NEXUS (Article 11, "une seule vérité" : les chiffres viennent toujours du moteur métier du
module concerné, ce fichier ne fait que les mettre en page). Il expose :
- `NexusPdfMoteur.creerRapport({ titre, auteur, sujet, entete })` — crée un document A4 + polices
  Helvetica/Helvetica-Bold embarquées + un `ConstructeurRapport` prêt à l'emploi ;
- `ConstructeurRapport` — primitives de mise en page avec **pagination automatique** (chaque ajout
  vérifie l'espace vertical restant et insère une nouvelle page si nécessaire, jamais un contenu
  tronqué) : `titre()`, `sousTitre()`, `bandeau()` (alerte pleine largeur), `sectionTitre()`,
  `paragraphe()` (retour à la ligne automatique — pdf-lib n'en fait aucun nativement), `ligneCle()`
  (ligne clé/valeur), `encadre()` (bloc à bordure colorée), `tableau()` (colonnes proportionnelles,
  pagination ligne par ligne), `image()` (embarque un PNG — typiquement un graphique Chart.js exporté
  via `chart.toBase64Image()` — mis à l'échelle en conservant les proportions via `scaleToFit`),
  `piedDePageToutesPages()` (numérotation "Page X / Y" appliquée rétroactivement à toutes les pages) ;
- `NexusPdfMoteur.finaliser(constructeur)` — renvoie les octets du PDF (`Uint8Array`) ;
- `NexusPdfMoteur.webShareDisponible()` — la Web Share API (avec fichiers) existe-t-elle sur cet
  appareil ? Sert à n'afficher un bouton "Partager" que s'il a une chance de fonctionner ;
- `NexusPdfMoteur.partagerPdf(bytes, nomFichier, { titre, texte })` — partage direct via la Web
  Share API, sans aucun repli automatique — à appeler depuis un geste utilisateur (clic) le plus
  directement possible, certains navigateurs (Safari) exigeant que l'appel reste proche du geste ;
  retourne `'partage' | 'annule' | 'echec' | 'indisponible'` ;
- `NexusPdfMoteur.telechargerPdf(bytes, nomFichier)` — téléchargement direct du Blob (lien
  `<a download>`), avec repli sur l'ouverture dans un nouvel onglet si même ça échoue ;
- `NexusPdfMoteur.partagerOuTelechargerPdf(bytes, nomFichier, { titre, texte })` — combine les deux
  ci-dessus en un seul appel (partage puis repli téléchargement) pour un module qui veut un bouton
  unique plutôt qu'une UI à deux actions.

Chaque module NEXUS (FDJ Pilotage, Coach, et à terme Verify, Inventaire, Brief, rapports manager…)
compose SON rapport avec ces primitives dans SA propre page — la composition métier (quelles
sections, quelles données) ne vit jamais dans ce fichier générique. Premier module câblé :
`NEXUS-FDJ-Analyse-v1.html` (`assemblerDonneesRapportFdj()` / `construireRapportPdf()` /
`lancerGenerationRapport()` / `afficherActionsRapportPret()`, voir section 7, Étape 6). Depuis le
10/08/2026, la génération (bouton "Générer mon rapport") et la diffusion (boutons "Partager le PDF"
/ "Ouvrir le PDF", affichés une fois le PDF prêt) sont deux étapes séparées plutôt qu'un
enchaînement automatique — le clic sur "Partager" reste un geste direct de l'utilisateur sur un
fichier déjà construit.

### `ConstructeurRapportUnePage` — rapport "synthèse dirigeante" tenant toujours sur 1 page A4

Ajouté le 10/08/2026, à la demande explicite de Frédéric : « Le moteur PDF ne doit pas essayer
d'imprimer l'intégralité des données disponibles : il doit sélectionner et hiérarchiser les
informations réellement utiles au pilotage. » Contrairement à `ConstructeurRapport` (pagination
automatique, texte qui coule librement — pour des rapports détaillés multi-pages), ce constructeur
utilise des **zones de hauteur fixe** allouées une seule fois à la construction, en millimètres,
converties en points PDF (`NexusPdfMoteur.MM`) :

```
ZONES_1P = { entete: 20mm, kpi: 25mm, synthese: 30mm, graphique: 45mm,
             ventes: 55mm, equipe: 45mm, decisions: 50mm, piedDePage: 7mm }
// total ≈ 277mm = hauteur utile d'un A4 (297mm) avec 10mm de marge en haut et en bas.
```

La page ne s'allonge jamais : c'est au module appelant de plafonner ce qu'il envoie à chaque
primitive (`max`), et chaque primitive plafonne aussi défensivement en interne — au-delà du
plafond, elle peut afficher une ligne de renvoi ("+ N autres — texte fourni par l'appelant") plutôt
que de déborder. `creerRapportUnePage()` crée le document + la seule page ; `allouerZone(hauteurPt)`
avance un curseur vertical unique et renvoie les bornes du bloc ; `diviserColonnes(zone)` scinde une
zone en deux colonnes côte à côte ; `diviserLignes(zone, [h1, h2, …])` sous-divise une zone en
tranches empilées (ex. Conseil NEXUS + Décisions dans la même zone "decisions"). Primitives de
contenu : `entete`, `ligneKpi` (2 à 4 cartes), `listePoints` (liste à puces plafonnée), `graphique`
(image PNG réduite à la zone), `tableauCompact` (mini-tableau plafonné), `barresHorizontales`
(mini-graphique à barres, ex. répartition par palier), `listeEquipe` (1 "référence" + reste sans
classement), `stockCondense` (ruptures + N à surveiller, jamais la liste complète), `conseil`
(encadré, texte plafonné en caractères via `tronquerCaracteres`), `decisions` (max plafonné,
marqueur carré coloré par urgence — jamais d'emoji, non représentables par la police standard),
`piedDePage`. Toujours générique (Article 11) : aucune de ces primitives ne connaît FDJ, Verify,
Inventaire ou Brief — seules les DONNÉES envoyées changent d'un module à l'autre, jamais la classe.

Le filtre WinAnsi (`assainirWinAnsi()`, voir "Correctif critique #2" ci-dessous) a été factorisé en
UNE fonction module-level utilisée par `ConstructeurRapport` ET `ConstructeurRapportUnePage` — une
seule correction possible, dans un seul endroit, pour toutes les classes de rapport présentes et
futures (demande explicite de Frédéric du 10/08/2026 : « une seule correction, dans un moteur
commun, pas une par module »).

Premier rapport recomposé avec cette classe : `NEXUS-FDJ-Analyse-v1.html`, `construireRapportPdf()`
(voir section 7, Étape 6 — remplace intégralement la version multi-page du 10/08/2026 matin).

**Correctif critique (10/08/2026) — caractères non supportés par la police standard :** premier
test réel de Frédéric (Safari normal, pas PWA standalone) : génération en échec. Cause identifiée
par grep sur les moteurs métier : `LABEL_REGLE_COACH.fdj_regularite_levier` ("… → levier
commercial") contient une flèche Unicode, et les badges `ETAT_FDJ`/`ETAT_COACH` de
`nexus-conseiller.js` utilisés ailleurs dans l'app contiennent des emoji (🔴/🟡/📈) — la police
standard Helvetica (encodage WinAnsi) ne sait représenter ni l'un ni l'autre, et pdf-lib lève une
exception à `drawText()` dès qu'elle en rencontre un, faisant échouer TOUT le rapport pour un seul
caractère fautif. `ConstructeurRapport` filtre désormais chaque texte via `_assainir()` avant tout
`drawText()` — défensif par construction, puisque ce moteur générique ne contrôle pas à l'avance le
texte métier que chaque module lui donne.

**Correctif critique #2 (10/08/2026) — `getCharacterSet()` insuffisant en conditions réelles :**
la première version de `_assainir()` (v2.9 ci-dessus) déterminait le jeu de caractères filtrable via
`PDFFont.getCharacterSet()`, calculé une fois par police à la construction. Ça passait tous les
tests mockés, mais Frédéric a retesté sur iPhone et obtenu la MÊME exception,
`WinAnsi cannot encode "→" (0x2192)` — donc `getCharacterSet()` ne bloquait pas réellement la
flèche en conditions réelles. Hypothèse retenue : pour les 14 polices standard (Helvetica,
Helvetica-Bold) embarquées via l'énum `StandardFonts` — donc sans fichier de police réel à
introspecter — `getCharacterSet()` n'est pas fiable. Correctif : abandon total de l'introspection
runtime, remplacée par une table WinAnsiEncoding (Windows-1252, PDF spec Appendix D.2) codée EN DUR
dans `nexus-pdf-moteur.js` (constante `JEU_WINANSI` : ASCII imprimable 0x20-0x7E + Latin-1
0xA0-0xFF + les ~27 codes de ponctuation "intelligente" WinAnsi). C'est un standard figé et
immuable, donc une table fixe est fiable par construction, indépendamment de tout comportement
interne de pdf-lib. `ConstructeurRapport._jeuCarPolice`/`_jeuCarPoliceGrasse` pointent maintenant
directement vers cette table (identique pour la police normale et grasse, l'encodage WinAnsi ne
variant pas avec la graisse). Reproduit et vérifié par régression (texte avec flèche + emoji → plus
d'exception, texte utile conservé, caractères non supportés retirés proprement) — cette fois le mock
de test ne fournit même plus de `getCharacterSet()` du tout, pour prouver que le nouveau chemin de
code ne l'appelle plus jamais.

**Vérifié (10/08/2026)** sans accès npm dans le bac à sable (registre bloqué, 403) : un mock minimal
de `pdf-lib` (juste assez d'API pour exécuter réellement `nexus-pdf-moteur.js`) a permis de composer
un rapport complet (tableau de 40 lignes, image, plusieurs encadrés) et de vérifier par assertions
que la pagination automatique se déclenche correctement (3 pages), qu'aucun élément ne déborde sous
le bas d'une page, et que le pied de page numéroté est appliqué à chaque page — y compris après le
correctif WinAnsi (retest de non-régression). `partagerPdf`/`telechargerPdf`/`partagerOuTelechargerPdf`
vérifiés séparément sur 10 scénarios (succès, annulation, échec avec repli, absence de Web Share
API, fichier refusé par `canShare()`, chaque fonction granulaire isolément). L'algorithme de retour
à la ligne (`decouperEnLignes`) vérifié sur 4 cas. Toutes les signatures pdf-lib utilisées
(`embedFont`, `embedPng`, `drawText`/`drawRectangle`/`drawLine`/`drawImage`, `widthOfTextAtSize`,
`getCharacterSet`, `scaleToFit`, `save`) confirmées contre la documentation officielle
pdf-lib.js.org. Toujours **aucun test d'intégration avec la vraie bibliothèque pdf-lib** (pas
d'accès npm ici, uniquement des mocks) — la confirmation définitive reste le prochain test réel de
Frédéric sur son iPhone après ce correctif.

---

## Historique des versions

| Version | Date | Changement |
|---|---|---|
| v1 | 07/07/2026 | Création initiale — pipeline Decenium (.xls), formule d'évolution naïve, NEXUS Score composite (jamais implémenté depuis, à notre connaissance) |
| v2 | 08/08/2026 | Réécriture complète des sections Ventes & Marge et Évolution/Comparaison de périodes à partir du code réel. Ajout de la section R2/R3/R4 (absente de la v1). Mise à jour du statut des chantiers ouverts (écart de caisse résolu autrement que prévu). Déclenchée par la découverte, le même jour, que le Centre d'Intelligence NEXUS dupliquait le moteur de détection au lieu d'utiliser `nexus-conseiller.js` — corrigé dans le même lot de travail. Sections Classification/Merchandising non revérifiées, marquées comme héritées. |
| v2.1 | 09/08/2026 | Ajout de la section 7 — NEXUS FDJ (grattage & tirages), déclenché par l'audit "Moteur de clairvoyance manager" qui exige une définition unique par KPI avant de construire les statistiques (Phase B). Documente les formules déjà en production dans `nexus-fdj-moteur.js`, le modèle de point zéro du stock, et les 9 vues d'agrégation créées ce jour. |
| v2.2 | 09/08/2026 | Ajout à la section 7 : Conseiller FDJ (Phase D — `calculerCandidatsFdj`/`normaliserFdj`, remontée Brief) et NEXUS Coach x FDJ Pilotage (Phase 1 — schéma `coach_*` + 12 règles V1 de `nexus-coach-fdj-moteur.js`), déclenchés respectivement par l'audit "Moteur de clairvoyance manager" (§46) et l'audit "Coach x FDJ Pilotage" (§16/§27/§28). |
| v2.3 | 09/08/2026 | Coach x FDJ Pilotage, étape "brancher les données" (audit §27, item 10) : `nexus-coach-fdj-donnees.js` (chargeurs réels + orchestration idempotente), nouvelle vue `view_fdj_employee_price_tier_daily`, limite honnête documentée sur le proxy de retard de clôture, vérification de bout en bout contre les données réelles du site. |
| v2.4 | 09/08/2026 | Coach x FDJ Pilotage, étape "écran employé" (audit §27, item 11) : `NEXUS-Coach-FDJ-v1.html` (Conseil du jour), navigation wirée (sidebar, Explorer, recherche), et resserrement de la RLS `coach_daily_recommendations`/`coach_recommendation_events` pour respecter l'audit §21 (un employé ne voit que son propre conseil). |
| v2.5 | 09/08/2026 | Coach x FDJ Pilotage, étape "écran manager" (audit §27, item 12 / §12) : section "Coaching équipe" ajoutée à l'onglet Conseiller de `NEXUS-FDJ-Analyse-v1.html`, nouvelle classification `NexusCoachFdj.FAMILLE_PAR_REGLE` (sécurité/rigueur/stock/progression/vente/général) partagée pour toute synthèse future. |
| v2.6 | 09/08/2026 | Coach x FDJ Pilotage, étape "remontée Brief" (audit §27, item 13 / §13) : `NexusCoachFdj.calculerCandidatsCoachEquipe()` (3 règles : risque récurrent/axe équipe/progrès équipe), `NexusConseiller.normaliserCoach()`, moteur `coach` ajouté au tri fusionné de `NEXUS-Brief-v1.html`. `LABEL_REGLE_COACH` relocalisé dans le moteur partagé (retiré du doublon local de FDJ-Analyse). |
| v2.7 | 09/08/2026 | Coach x FDJ Pilotage, étape "export PDF" (audit §27, item 14 / §23) : nouvel onglet Rapports / Export dans `NEXUS-FDJ-Analyse-v1.html`, `window.print()` + feuille `@media print` dédiée (aucune dépendance ajoutée), réutilise le sélecteur de période universel existant, le résumé manager, le graphique CA, `candidatsFdjPeriode()` et la synthèse Coaching équipe déjà construits. Bandeau "données provisoires" quand des quarts de la période ne sont pas encore contrôlés. |
| v2.8 | 10/08/2026 | Remplacement de `window.print()` par un vrai moteur PDF applicatif, à la demande de Frédéric, après signalement du bug WebKit documenté (aperçu d'impression cassé en PWA standalone iOS). Nouveau fichier générique `nexus-pdf-moteur.js` (section 8, pdf-lib, pagination automatique, Web Share API + repli téléchargement) réutilisable par tout NEXUS, pas seulement FDJ. `NEXUS-FDJ-Analyse-v1.html` recomposé pour l'utiliser (`assemblerDonneesRapportFdj`/`construireEtDiffuserRapportPdf`), avec en plus Top jeux, répartition par palier et Top vendeurs qui n'étaient pas dans la V1 window.print(). |
| v2.9 | 10/08/2026 | Corrections suite au premier test réel de Frédéric (Safari normal, pas PWA) : (1) bug bloquant identifié — un texte métier contenant une flèche Unicode ou un emoji (ex. `LABEL_REGLE_COACH.fdj_regularite_levier`, badges `ETAT_FDJ`/`ETAT_COACH` de `nexus-conseiller.js`) fait planter pdf-lib (police standard WinAnsi, n'encode pas ces caractères) — `nexus-pdf-moteur.js` filtre désormais tout caractère non supporté par la police embarquée avant chaque `drawText()` (`ConstructeurRapport._assainir`, basé sur `PDFFont.getCharacterSet()`) ; (2) `NEXUS-FDJ-Analyse-v1.html` renommé "FDJ Pilotage" à l'affichage (titre, eyebrow, footer, navigation) — "Analyse" évoquait un tableau de statistiques, "Pilotage" résume comprendre → décider → agir ; fichier et références internes inchangés ; (3) flux PDF séparé en deux étapes (`construireRapportPdf` puis `afficherActionsRapportPret`) — "Générer mon rapport" construit le PDF, puis "Partager le PDF" / "Ouvrir le PDF" apparaissent séparément (bouton Partager absent si `NexusPdfMoteur.webShareDisponible()` est faux) ; `nexus-pdf-moteur.js` décomposé en `partagerPdf`/`telechargerPdf` réutilisables séparément (`partagerOuTelechargerPdf` conservé, recompose les deux) ; (4) affichage "Taux de quarts conformes" corrigé en deux lignes distinctes (couverture du contrôle vs qualité du résultat) dans Vue d'ensemble, Rapports et le PDF ; (5) définition canonique de "CA FDJ" (période) écrite dans la section 7 ; (6) onglet "Rapports / Export" renommé "Rapports", scroll-snap ajouté à la barre d'onglets (un onglet ne doit plus rester affiché à moitié coupé au bord de l'écran). |
| v2.10 | 10/08/2026 | Deuxième bug bloquant trouvé au test réel suivant (message d'erreur "Cannot access 'chart' before initialization", visible grâce au détail technique ajouté en v2.9) : `genererImageGraphiqueCa()` lisait la variable fermée `chart` dans `animation.onComplete`, or Chart.js peut appeler ce callback de façon SYNCHRONE avec `duration: 0` — donc avant la fin de l'affectation `const chart = new Chart(...)` (zone morte temporelle). Corrigé en utilisant l'objet `chart` fourni en argument par Chart.js à `onComplete` (`{ chart, currentStep, initial, numSteps }`, documenté pour cet usage précis) plutôt que la variable fermée. Reproduit puis vérifié corrigé par un test simulant un `onComplete` synchrone. |
| v2.11 | 10/08/2026 | Troisième bug bloquant trouvé au test réel suivant : MÊME symptôme que le correctif v2.9 (`WinAnsi cannot encode "→" (0x2192)`), preuve que le filtre basé sur `PDFFont.getCharacterSet()` ne fonctionnait pas réellement — seulement en mock. Remplacé par une table WinAnsiEncoding codée en dur (`JEU_WINANSI` dans `nexus-pdf-moteur.js`, standard figé PDF spec Appendix D.2), qui ne dépend plus d'aucune introspection runtime de pdf-lib. Voir "Correctif critique #2" ci-dessus. Leçon retenue : sans accès à la vraie bibliothèque pdf-lib dans le bac à sable, les mocks ne peuvent pas valider des hypothèses sur le comportement exact d'une dépendance tierce — seul le test réel de Frédéric fait foi pour ce type de bug. |
| v2.12 | 10/08/2026 | Refonte "1 page A4" du rapport FDJ, à la demande explicite de Frédéric : le rapport ne doit plus jamais dépasser une page, quelle que soit la période. Nouvelle classe générique `NexusPdfMoteur.ConstructeurRapportUnePage` (section 8) dans `nexus-pdf-moteur.js` — zones de hauteur fixe (`ZONES_1P`), colonnes, primitives plafonnées (`ligneKpi`, `listePoints`, `tableauCompact`, `barresHorizontales`, `listeEquipe`, `stockCondense`, `conseil`, `decisions`) — explicitement générique et réutilisable par tout futur module NEXUS voulant un rapport 1 page (Verify, Inventaire, Brief, rapports mensuels/annuels), pas seulement FDJ. Le filtre WinAnsi (`assainirWinAnsi`) a été factorisé en une fonction unique partagée par `ConstructeurRapport` et `ConstructeurRapportUnePage` — une seule correction possible pour toutes les classes. `NEXUS-FDJ-Analyse-v1.html` : `construireRapportPdf()` entièrement recomposé (voir section 7, Étape 6) avec sélection/hiérarchisation des données (Top 5 jeux, 4 employés max avec logique "1 référence + vérité avant certitude" pour le reste, 3 décisions max, conseil ≤ 250 caractères, stock condensé avec renvoi vers FDJ Pilotage pour le détail complet) plutôt qu'une reproduction exhaustive des données. Canvas du graphique CA repensé (1200×260) pour un rendu correct une fois réduit à ~45mm de hauteur. Vérifié par mocks (aucune exception, une seule page créée, logique de référence équipe et de jeux prioritaires testée sur données réalistes) — la confirmation définitive reste, comme toujours pour ce module, le prochain test réel de Frédéric. |

Prochaine révision suggérée : après vérification des sections héritées (§5) et des deux chantiers
au statut inconnu (§4 — Anomalie stock, Capacité de réassort). Côté FDJ : figer les formules de
rotation et d'autonomie au moment de construire la Phase C (page Analyse).
