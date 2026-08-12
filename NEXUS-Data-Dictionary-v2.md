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

### Historique importé (`fdj_imported_history`, 10/08/2026)

À la demande de Frédéric, import ponctuel du tableur Google Sheets "CAISSE JOURNALIERE FDJ 2026"
(feuille SUIVI HEBDO FDJ, source du suivi papier avant le démarrage de NEXUS FDJ le 07/08/2026) :
442 lignes (221 jours × 2 quarts), du 01/01/2026 au 09/08/2026, dans la table `fdj_imported_history`
(site, date, quart, `data` jsonb, `source_label`). Le `data` jsonb reprend les 8 champs financiers du
tableur (`ventes_grattage`, `lots_payes_grattage`, `caisse_grattage`, `caisse_loto`, `total_attendu`,
`caisse_reelle`, `regularisation`, `ecart`) plus, pour les 7 dates de juillet où le tableur détaillait
un écart par employé (feuille ECART DE CAISSE), `ecart_par_employe_jour`/`ecart_par_employe_note`
attachés à la ligne quart 1 uniquement (évite toute ambiguïté de double-comptage entre quarts). Toutes
les lignes portent désormais `data->>'statut' = 'verifie'` (demande explicite de Frédéric, 10/08/2026 :
"mets le statut vérifié car c'est le cas").

**Fusion dans les vues FDJ Pilotage (10/08/2026) :** plutôt que de dupliquer une logique d'agrégation
en JS (Article 11 — une seule vérité), `view_fdj_shift_facts` — la vue de base dont dépendent
`view_fdj_daily_summary`/`_weekly_summary`/`_monthly_summary`/`_yearly_summary`,
`view_fdj_discrepancy_daily` et `view_fdj_employee_daily` — a été recomposée en `UNION ALL` d'une
partie native (inchangée) et d'une partie tirée de `fdj_imported_history`, exclue automatiquement pour
tout `(site, date, quart)` déjà présent nativement dans `fdj_shifts` (`WHERE NOT EXISTS` — la saisie
NEXUS native, plus riche, garde toujours priorité ; 6 quarts natifs des 7-9/08/2026 recouvrent 6
lignes importées, exclues sans doublon). Conséquence : FDJ Pilotage (Vue d'ensemble, Ventes, Jours &
quarts, Contrôle & écarts, Historique) et le rapport PDF (mensuel/annuel) couvrent désormais tout
2026 sans aucun changement de code JS — ils lisaient déjà exclusivement ces vues.

Limites honnêtes, documentées plutôt que masquées : les lignes importées n'ont ni détail par jeu
(`fdj_shift_counts` n'existe que pour les quarts saisis dans NEXUS) ni employé rattaché
(`employee_id` = NULL — `view_fdj_employee_daily` filtre déjà `WHERE employee_id IS NOT NULL`, donc
aucune ligne importée n'y apparaît, jamais de mauvaise attribution) ni motif d'écart (`motif_ecart` =
NULL, déjà affiché "Motif non précisé" par l'écran existant). Les onglets Jeux, Équipe et Stock
restent donc strictement natifs — c'est voulu : mieux vaut une absence honnête qu'une donnée
fabriquée. `statut_caisse` des lignes importées vaut `conforme` si écart = 0, sinon
`valide_avec_ecart` (jamais `provisoire`), donc incluses par tous les filtres existants
`WHERE statut_caisse <> 'provisoire'`.

### Paramétrage FDJ par site (`fdj_site_settings`, 10/08/2026) — fondations

Suite à l'audit développeur "NEXUS FDJ — Paramétrage autonome & multi-site" (document fourni par
Frédéric, 09/08/2026) dont le principe directeur est : *"le développeur construit le moteur, le
manager administre le métier — aucun changement normal d'exploitation ne doit nécessiter une
modification du code."* Premier lot ("fondations", étapes 1-2 de l'ordre de développement recommandé
par l'audit) : formaliser un schéma de configuration par site et éliminer les dernières constantes
JS identifiées comme identiques pour tous les sites alors qu'elles devraient être un réglage local.

**Table `fdj_site_settings`** — une ligne par site (`site` en clé primaire, RLS scopée par
`current_employee_site_id()` comme `fdj_games`/`fdj_locations`) :
- `profil_stock` (`reserve_centrale`/`direct_caisse`/`multi_caisse`/`avance`, audit §4/§8) —
  informationnel pour l'instant, aucun écran ni règle moteur ne le lit encore. Posé maintenant pour
  ne pas re-designer le schéma à l'étape suivante (écran "Paramètres FDJ").
- `nombre_quarts`, `horaire_bascule_quart2_repli` (audit §13) — l'horaire de bascule quart 1 → quart
  2 reste d'abord lu depuis `station_config.horaires.quart2.normal` (partagé avec Inventaire) ;
  cette colonne ne sert que de repli FDJ si `station_config` est vide, remplaçant l'ancienne
  constante `HORAIRE_DEFAUT_DEBUT_QUART2 = '12:40'` de `NEXUS-FDJ-v1.html`.
- `seuil_caisse_vert`, `seuil_caisse_rouge`, `validation_manager_obligatoire` (audit §14) — posés
  pour la suite (aucun statut de caisse "à contrôler" à seuil n'existe encore dans le flux natif
  aujourd'hui ; le manager choisit directement le statut, ce n'était donc pas une constante à
  éliminer mais une fonctionnalité qui reste à construire).
- `seuil_min_quarts_moyenne` (audit §15) — remplace la constante JS `SEUIL_MIN_QUARTS = 3`, dupliquée
  à deux endroits de `NEXUS-FDJ-Analyse-v1.html` (onglet Équipe et Top vendeurs du rapport PDF).
- `coach_actif`, `coach_seuil_risque_recurrent`, `coach_seuil_axe_equipe`, `coach_seuil_progres_base`,
  `coach_seuil_progres_baisse` (audit §17) — remplacent les 4 constantes JS de
  `nexus-coach-fdj-moteur.js` (`SEUIL_RISQUE_RECURRENT`, `SEUIL_AXE_EQUIPE`, `SEUIL_PROGRES_BASE`,
  `SEUIL_PROGRES_BAISSE`) utilisées par `calculerCandidatsCoachEquipe()`.

**Aucun changement de comportement à la création de cette table** : les valeurs par défaut des
colonnes reproduisent exactement les anciennes constantes, et une ligne absente retombe sur les
mêmes valeurs côté JS (`{ horaire_bascule_quart2_repli: '12:40' }`, `{ seuil_min_quarts_moyenne: 3 }`,
`NexusCoachFdj.SEUILS_COACH_EQUIPE_DEFAUT`).

**Respect d'Article 11 dans `nexus-coach-fdj-moteur.js`** : ce fichier reste une bibliothèque de
fonctions pures, sans aucun accès Supabase (principe déjà en place pour `nexus-fdj-moteur.js`).
`calculerCandidatsCoachEquipe(donnees, seuils)` reçoit donc les seuils en second paramètre optionnel
(fusionnés avec `SEUILS_COACH_EQUIPE_DEFAUT` si absents) plutôt que de lire `fdj_site_settings`
elle-même ; c'est l'appelant (`NEXUS-Brief-v1.html`, seul appelant existant) qui charge
`fdj_site_settings` et transmet les 4 valeurs.

**Pas encore construit** (étapes suivantes de l'audit, hors périmètre de ce lot) : écran manager pour
éditer ces réglages (modification par SQL uniquement pour l'instant), profil de stock réellement
consommé par le moteur, statut de caisse "à contrôler" basé sur `seuil_caisse_vert`/`seuil_caisse_rouge`,
versionnage/audit des modifications (`fdj_config_versions`), duplication de site, assistant de mise
en service.

Vérifié : migration appliquée et RLS relue (`select`/`update` scopées par site, écriture large
réservée à `service_role`), `node --check` sur les 4 scripts extraits modifiés
(`NEXUS-FDJ-v1.html`, `NEXUS-FDJ-Analyse-v1.html`, `NEXUS-Brief-v1.html`, `nexus-coach-fdj-moteur.js`),
et les 4 tests de composition existants (`test_fdj_composition.js`, `test_fdj_granularite.js`,
`test_brief_composition.js`, plus le test WinAnsi non concerné) toujours verts — le second paramètre
de `calculerCandidatsCoachEquipe` étant optionnel, aucun appel existant n'est cassé.

### Écran manager "Paramètres FDJ" (`NEXUS-FDJ-Parametres-v1.html`, 10/08/2026) — étape 3

Suite directe des fondations ci-dessus (étape 3 de l'ordre de développement recommandé par l'audit :
*"Construire Parametres FDJ - Organisation, Catalogue, Emplacements"*). Premier écran permettant à un
manager de configurer FDJ sans passer par SQL — jusqu'ici, `fdj_site_settings` (fondations), `fdj_games`
et `fdj_locations` n'étaient modifiables que par requête directe.

**3 onglets**, même schéma "onglets + `.param-ligne`" que `NEXUS-Parametres-Inventaire-v1.html` :
- **Organisation** — édite `fdj_site_settings` ligne par ligne (`upsert` sur un seul champ à la fois,
  `onConflict: 'site'`, badge "✓ Enregistré"). Regroupé en 4 blocs : identité du site (profil de
  stock, nombre de quarts, horaire de repli quart 2), Pilotage (`seuil_min_quarts_moyenne`), Contrôle
  de caisse (`seuil_caisse_vert`/`seuil_caisse_rouge`/`validation_manager_obligatoire`), Coach FDJ
  (`coach_actif` + les 4 seuils branchés en v2.20). Chaque bloc porte une note honnête sur ce qui est
  déjà consommé par un calcul (seuil min. quarts, 4 seuils Coach) et ce qui ne l'est pas encore
  (profil de stock, seuils de caisse, `coach_actif`) — jamais laisser croire qu'un réglage agit avant
  que le moteur ne le lise réellement (principe déjà appliqué à `parametres_inventaire`).
- **Catalogue des jeux** — liste `fdj_games` (nom, prix, `calc`), une ligne cliquable ouvre un panneau
  d'édition (prix, tickets/carnet, ordre d'affichage, EAN13, actif) avec sauvegarde au `change` (une
  colonne à la fois, `UPDATE ... WHERE id=`). "+ Nouveau jeu" ajoute un jeu (`tickets_par_carnet` reste
  `NULL` si non renseigné — jamais forcé, conformément à la règle de conditionnement de l'audit §9).
  Aucun jeu n'est jamais supprimé, seulement désactivé (`actif=false`, affiché avec 🚫 dans la liste).
- **Emplacements** — même principe sur `fdj_locations` (nom, type parmi bureau/caisse/zone
  bloquée/autre, ordre d'affichage, actif).

**Navigation** : rejoint le groupe "Administrer" de la barre latérale bureau (`nexus-desktop.js`), le
tiroir "Explorer NEXUS" et la recherche globale (`NEXUS-App-v1.html`, même convention que Paramètres
Inventaire), plus un lien direct "⚙️ Paramètres FDJ →" en bas de `NEXUS-FDJ-Manager-v1.html` (même
discipline que Contrôle inventaire → Paramètres Inventaire : l'écran opérationnel reste centré sur "que
dois-je traiter maintenant ?", un seul lien suffit vers la configuration).

**Pas encore construit** (étapes suivantes de l'audit) : onglet Stock & mouvements (profil de stock
réellement consommé), écran "Tester ma configuration", versionnage/rollback des paramètres,
duplication de site, assistant de mise en service guidé.

Vérifié : `node --check` du script extrait OK ; réutilise exclusivement les tables et policies RLS déjà
vérifiées (fondations, `fdj_games`/`fdj_locations` déjà scopées par `current_employee_site_id()`) ;
gate manager + forfait Professional identique aux autres écrans FDJ.

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

### Nouvelle primitive `paragraphe()` (10/08/2026)

Ajoutée à `ConstructeurRapportUnePage` pour les modules dont le contenu naturel est du texte libre
plutôt qu'une liste structurée (ex. la synthèse exécutive de Brief, ou un repli textuel quand un
module n'a pas de série chronologique à graphiquer). Signature :
`paragraphe(zone, { titre, texte, taille=9, interligne=12.5, couleur })`. Découpe le texte via
`decouperEnLignes()` (même algorithme que `ConstructeurRapport`), calcule combien de lignes tiennent
dans la hauteur de la zone (`Math.floor((y - zone.yBas) / interligne)`), et tronque proprement avec
une ellipse sur la dernière ligne visible si le texte dépasse — jamais de débordement hors zone,
cohérent avec le principe "zones fixes" de `ConstructeurRapportUnePage`.

### Rapports PDF Verify, Inventaire, Brief — implantés le 10/08/2026

À la demande explicite de Frédéric (« cree les futurs modules, rapport a telecharger en pdf pour
Verify, Inventaire, Brief, rapports mensuels/annuels et implante les dans nexus »), les trois
modules qui n'avaient encore aucun export PDF ont été câblés sur `ConstructeurRapportUnePage`, avec
le même schéma d'intégration que FDJ Pilotage (bouton "Générer mon rapport" → `construireRapportPdf…()`
→ "Partager le PDF" / "Ouvrir le PDF" / "Régénérer"). Aucune de ces intégrations n'ajoute de logique
de calcul dans le moteur PDF générique (Article 11) — chaque module compose SON rapport à partir de
DONNÉES qu'il possédait déjà ou, pour Verify, qu'il a dû assembler pour la première fois.

- **`NEXUS-Brief-v1.html`** — le rapport réutilise directement l'objet `BRIEF` déjà construit pour
  l'affichage à l'écran (`construireBrief()`), sans aucun recalcul : indice NEXUS, gain/risque
  potentiel, synthèse exécutive (`paragraphe`), boussole 5 axes (Commerce/Marge/Opérations/
  Équipe/Risques, en repli de la zone "graphique" faute de série chronologique disponible pour ce
  module), forces du moment et points à surveiller, décisions prioritaires (max 3).
- **`NEXUS-Verify-v1.html`** — Verify n'avait aucune notion d'agrégation par période avant ce jour
  (seulement des audits ponctuels par quart) : nouvel onglet "Rapport" avec sélecteur de période
  (7 jours / 30 jours / mois en cours / mois précédent / année en cours), et nouvelle fonction
  `assemblerDonneesRapportVerify(debut, fin)` qui interroge `audits_caisse` sur la période et calcule
  taux de conformité, écart cumulé (somme des `ecartMax = max(|ecart_piste|, |ecart_boutique|)` par
  audit — pas `ecart_total`, qui est une somme signée pouvant masquer deux anomalies réelles qui
  s'annulent), répartition par gravité, jour le plus à risque, composante la plus touchée
  (Piste/Boutique), et liste des audits anormaux sans commentaire justificatif ("à justifier").
  Réutilise `classifierEcart()`/`GRAVITE_ORDRE` déjà en production — ne réinvente jamais la formule
  d'écart (Article 11).
- **`NEXUS-Inventaire-Manager-v1.html`** — le rapport réutilise `dernierCtx` (le contexte déjà chargé
  par `chargerReviewPeriode()` pour l'affichage de la vue période — RPC `generate_inventory_review`),
  sans nouvelle requête : comptages/écarts/démarque estimée, catégorie la plus instable, produits
  récurrents, écarts ouverts triés par gravité, et décompte des décisions de la période par type de
  résolution (validée/recomptage/erreur de saisie/démarque/explication). Disponible uniquement en
  vue période (semaine/mois/personnalisée), pas en vue jour.

Les trois rapports ont été vérifiés par mock (composition complète contre le vrai
`nexus-pdf-moteur.js`, avec des données réalistes) : une seule page produite, aucune exception, tri
et logique métier corrects. Comme pour FDJ, la confirmation définitive reste le prochain test réel
de Frédéric — aucun de ces trois rapports n'a encore été généré sur un vrai appareil.

### FDJ Pilotage — contenu adapté à la granularité de la période (10/08/2026)

Jusqu'ici, le rapport FDJ gardait le même gabarit (jour le plus performant / jour à booster,
graphique quotidien) quelle que soit la période choisie — y compris pour un mois ou une année
entière, où un empilement de points quotidiens devient illisible. Conformément à la demande de
Frédéric (« Hebdomadaire : jours... Mensuel : semaines, tendances... Annuel : mois, saisonnalité... »),
`assemblerDonneesRapportFdj()` classe désormais la période via `classifierTypePeriode(type, debut, fin)`
(`'hebdomadaire' | 'mensuel' | 'annuel'`, basé sur `periodeActuelle.type` — `mois`/`mois_precedent` →
mensuel, `annee`/`annee_precedente` → annuel, `personnalise` classé par nombre de jours couverts :
>64j → annuel, >10j → mensuel, sinon hebdomadaire), puis agrège les données quotidiennes en
conséquence : `regrouperParSemaine()` (via le numéro de semaine ISO déjà utilisé ailleurs dans le
fichier) pour un rapport mensuel, `regrouperParMois()` pour un rapport annuel. Le KPI "jour le plus
performant / jour à booster" devient "semaine..." ou "mois..." selon le cas (`LABELS_UNITE_FORTE`/
`LABELS_UNITE_BOOSTER`, indexés par `labelUnite`), et la légende du graphique CA s'ajuste de même
("évolution quotidienne" / "par semaine" / "par mois"). Vérifié par test dédié : classification
correcte sur les 6 cas (mois, année précédente, semaine, personnalisé 90j/20j/5j), regroupement
correct d'une année complète en 12 mois et d'un mois en 5-6 semaines ISO.

---

## 9. Message pré-comptage — Inventaire & FDJ (10/08/2026)

À la demande de Frédéric — dans la philosophie NEXUS, "à condition de ne pas transformer l'inventaire
en succession de messages moralisateurs" : un court message pédagogique s'affiche désormais **une
seule fois par session de comptage**, juste avant le premier comptage (validation du stock de départ),
sur `NEXUS-Inventaire-v1.html` (onglet Ouverture) et `NEXUS-FDJ-v1.html` (Valider mon stock de départ).
Il explique la CONSÉQUENCE d'un mauvais comptage plutôt que de simplement demander de "bien compter" :

> 🎯 Un comptage juste fait gagner du temps à toute l'équipe.
> Une erreur fausse les écarts, déclenche des contrôles inutiles et peut masquer une perte réelle.
> **Comptez le réel, ne recopiez jamais le stock précédent.**
>
> [✓ Je commence mon inventaire]

**Règle non négociable, rappelée explicitement par Frédéric** : aucun chiffre financier inventé
(jamais un "cela vous a coûté 35 €" que NEXUS ne peut pas démontrer). Le message ne parle que de
conséquence qualitative (écarts, contrôles, temps, risque de perte) — jamais d'un montant précis tant
que NEXUS ne dispose pas des éléments pour le calculer réellement.

**Mécanique "une fois par session"** : les deux écrans ont déjà une notion de session de comptage
(`inventaire_quart_employes` pour Inventaire, `fdj_shifts` pour FDJ — même logique que
`a_valide_ouverture`/`ouverture_validee`). La fonction `demarrerOuverture()`, jusque-là le point
d'entrée direct du comptage, devient une garde : elle affiche le message (marqué vu en localStorage,
clé dérivée de l'id de session — même convention que `nexus_pointage_tentative_en_cours` dans
`NEXUS-Pointage-v1.html`) si non encore vu pour CETTE session, sinon appelle directement l'ancienne
logique désormais renommée `demarrerOuvertureComptage()`. Aucun autre comportement du comptage n'est
modifié — pure insertion en amont.

**Volontairement pas encore fait** (lot séparé, à la demande de Frédéric) : le message adaptatif dont
le ton varie selon les anomalies réellement constatées récemment (ex. "erreurs de ressaisie
fréquentes" → message plus insistant type "comptez chaque produit physiquement" ; "derniers
comptages fiables" → message de reconnaissance plutôt que de vigilance). Cela demandera une détection
d'historique par employé (ex. fréquence des `inventaire_alertes`/`fdj_alertes` de type "stock initial
modifié" sur les dernières sessions) — non construite dans ce lot, volontairement livré d'abord avec
le message fixe pour valider l'usage réel avant d'ajouter de la logique adaptative.

Vérifié : `node --check` des deux scripts extraits, seul appelant de `demarrerOuverture()` dans chaque
fichier est l'écouteur de clic existant (aucun `await` sur son retour, donc la conversion de fonction
`async` vers synchrone-avec-branche-asynchrone ne casse rien).

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
| v2.13 | 10/08/2026 | Rapports PDF implantés pour Verify, Inventaire et Brief (demande explicite de Frédéric), tous sur `ConstructeurRapportUnePage` : Brief réutilise l'objet `BRIEF` déjà construit sans recalcul ; Inventaire réutilise `dernierCtx` (contexte déjà chargé par `chargerReviewPeriode`) sans nouvelle requête ; Verify, qui n'avait aucune agrégation par période avant ce jour, gagne un nouvel onglet "Rapport" et `assemblerDonneesRapportVerify()` (écart cumulé sur `ecartMax = max(\|ecart_piste\|, \|ecart_boutique\|)`, réutilise `classifierEcart()` existant). Nouvelle primitive `paragraphe()` sur `ConstructeurRapportUnePage` pour le texte libre borné. FDJ Pilotage : le contenu du rapport (pas seulement les dates) s'adapte désormais à la granularité de la période — jours pour l'hebdomadaire, semaines pour le mensuel, mois pour l'annuel (`classifierTypePeriode`, `regrouperParSemaine`, `regrouperParMois`). Vue bureau de FDJ Pilotage vérifiée déjà active, aucun changement nécessaire. Les trois nouveaux rapports et l'adaptation FDJ sont vérifiés par mocks uniquement (aucun accès pdf-lib réel dans le bac à sable) — confirmation définitive au prochain test réel de Frédéric. |
| v2.14 | 10/08/2026 | Deux bugs bloquants trouvés au premier test réel du rapport Brief (photo iPhone) : (1) la colonne "FORCES DU MOMENT" débordait visuellement sur "À SURVEILLER" — cause : `listePoints()` (et les autres primitives à une seule ligne : `tableauCompact`, `barresHorizontales`, `listeEquipe`, `stockCondense`, `decisions`, `entete`, `ligneKpi`) dessinait le texte fourni sans jamais vérifier qu'il tienne dans la largeur de sa zone/colonne — un texte trop long débordait donc dans la zone voisine et s'y superposait visuellement. Corrigé une seule fois dans le moteur commun (Article 11) : nouvelle méthode `_tronquerLargeur(texte, taille, largeurMax, gras)` sur `ConstructeurRapportUnePage`, mesure la largeur réelle avec `police.widthOfTextAtSize()` et coupe avec ellipse — appliquée à toutes les primitives à ligne unique de la classe, plus jamais seulement à `listePoints`. (2) la colonne "À SURVEILLER" affichait littéralement "null :" pour certains points — cause : `NEXUS-Brief-v1.html` mappait `w.article` (souvent `null` : les candidats Tempo/Advisor/Caisse/Rappel n'ont pas d'article associé) au lieu de reprendre les champs déjà utilisés par l'affichage à l'écran (`w.action`/`w.pourquoi`, toujours renseignés par les fonctions `normaliser*()` de `nexus-conseiller.js` quel que soit le moteur d'origine). Corrigé en alignant le mapping du PDF sur celui de `renderWatchlist()`. Vérifié par un test dédié reconstituant le cas réel (bullets longs + candidats sans article) contre le vrai `nexus-pdf-moteur.js` : 0 dépassement de colonne, aucun texte "null"/"undefined" ; les 6 tests de composition existants (FDJ/Verify/Inventaire/Brief/1-page/WinAnsi) repassent sans régression après le durcissement des primitives. Confirmation définitive : prochain test réel de Frédéric sur le rapport Brief régénéré. |
| v2.15 | 10/08/2026 | Quatre bugs trouvés au test réel suivant, portant cette fois sur les 4 rapports (Inventaire, Brief, FDJ Pilotage, Verify — photos iPhone) : (1) la plage de dates de l'en-tête affichait "10/08/2026  16/08/2026" (juste un espace, aucun séparateur visible) sur Inventaire/FDJ/Verify — cause : le gabarit construit la plage avec une flèche Unicode (`${debut} → ${fin}`), non représentable en WinAnsi, que `assainirWinAnsi()` supprimait silencieusement sans rien laisser à sa place (même famille de caractère que le bug historique v2.9/v2.11, mais cette fois dans une donnée de mise en page plutôt qu'un libellé métier). Corrigé une seule fois dans le moteur commun : `assainirWinAnsi()` remplace maintenant les caractères Unicode "structurants" (flèches →/←/⇒/⇐) par un tiret ASCII avant filtrage, au lieu de les supprimer — les emoji restent supprimés sans remplacement (purement décoratifs, aucun sens perdu). (2) Sur Brief (boussole 5 axes) et Verify (répartition par gravité), `barresHorizontales()` tronquait des libellés comme "Opérations" ou "À surveiller" en "Opéra…"/"À sur…" illisibles — cause : la largeur de la colonne libellé était fixée en dur à 34pt, dimensionnée à l'origine pour des libellés courts (paliers FDJ "1 €"/"5 €") et jamais adaptée aux autres appelants. Corrigé en calculant la largeur de colonne à partir du libellé le plus long réellement affiché (mesuré via `widthOfTextAtSize`), plafonnée à 42% de la largeur de la zone. (3) FDJ Pilotage : le KPI "Évolution" affichait la phrase "Comparaison indisponible" tronquée en "Comparaison in…" (police 15 grasse, carte KPI trop étroite pour une phrase) — corrigé en gardant une valeur courte ("—") dans la case principale et en déplaçant l'explication vers le `detail` (police 7.5, plus de place). (4) Inventaire : le tableau "Écarts ouverts" affichait littéralement "Produit" (identique au titre de la colonne juste au-dessus) pour une alerte dont le produit lié n'a pas pu être chargé — le texte de repli existant ailleurs dans le fichier (`'Produit'`) est réutilisé tel quel un peu partout dans l'app pour ce cas, mais entre en collision visuelle spécifiquement dans un tableau à en-têtes ; changé en `'Produit non identifié'` pour ce tableau précis, sans toucher aux autres usages du même repli dans le fichier. Vérifié par un test dédié (plage de dates avec flèche, libellés longs de boussole, KPI à valeur longue) plus les 7 tests de composition existants, tous verts sans régression. Confirmation définitive : prochain test réel de Frédéric sur les 4 rapports régénérés. |
| v2.16 | 10/08/2026 | Import de l'historique FDJ 2026 (tableur Google Sheets "CAISSE JOURNALIERE FDJ 2026") dans la nouvelle table peuplée `fdj_imported_history` (442 lignes, 01/01→09/08/2026, écart par employé sur 7 dates de juillet où le tableur le détaillait), à la demande de Frédéric ("mettons en pause le parametrage fdj un instant"). Toutes les lignes marquées `data->>'statut'='verifie'` (demande explicite du même jour). Fusionné ensuite dans `view_fdj_shift_facts` (UNION ALL native ∪ importé, dédupliqué par `(site,date,quart)`, native toujours prioritaire) — voir section 7, "Historique importé" — pour que FDJ Pilotage (tous onglets sauf Jeux/Équipe/Stock, qui restent honnêtement natifs faute de détail par jeu/employé dans le tableur) et le rapport PDF couvrent 2026 sans aucun changement JS, migration Supabase pure (`blend_fdj_imported_history_into_shift_facts`), aucun fichier applicatif modifié, aucun zip nécessaire pour ce lot. Vérifié par requêtes directes : total vues (444 = 436 importées + 8 natives, dont 1 site de test), somme annuelle (CA grattage 261 367,00 €, écart cumulé -159,83 €, conforme à l'extraction source), agrégats mensuels plausibles (~60 quarts/mois), et 4 spot-checks de valeurs individuelles contre le tableur source. |
| v2.17 | 10/08/2026 | Onglet Jeux de FDJ Pilotage : demande de Frédéric de ne jamais laisser la liste vide/clairsemée silencieusement quand la période sélectionnée déborde sur l'historique importé (sans détail par jeu). `NEXUS-FDJ-Analyse-v1.html` garde exactement les jours natifs disponibles dans `view_fdj_game_daily` (jamais de donnée inventée pour les jours importés) et ajoute désormais une phrase explicite au-dessus du Top 10 (`champ-note`) quand la période contient au moins un jour sans détail par jeu : nombre de jours natifs sur le total de la période, date de démarrage réelle du suivi par jeu (`chargerPremiereDateSuiviJeu()`, `MIN(date)` de `fdj_shifts`, jamais codée en dur), et rappel que le CA global de ces jours reste visible dans Vue d'ensemble/Ventes. Vérifié par `node --check` du script extrait et par requête directe confirmant 4 jours natifs avec détail par jeu (07→10/08/2026, 15 à 29 jeux comptés par jour). Aucun autre fichier touché, aucun zip nécessaire (changement JS pur, pas de nouvelle dépendance). |
| v2.18 | 10/08/2026 | Ajout de "Caisse réelle totale" (somme du montant physiquement compté, grattage + loto, filtrée sur les quarts déjà contrôlés) — demande explicite de Frédéric, capture d'écran du tableur à l'appui : c'est cette valeur, pas le CA théorique, qu'il compare au dépôt réel pour déduire les commissions FDJ ("il faut que cette ligne puisse apparaître"). Nouvelle colonne `caisse_reelle_totale` (`sum(caisse_reelle) FILTER (WHERE statut_caisse <> 'provisoire')`, ajoutée en dernière position pour ne casser aucune vue dépendante) sur les 4 vues de synthèse `view_fdj_daily/weekly/monthly/yearly_summary` — fonctionne aussi bien sur les jours natifs que sur l'historique importé grâce à la fusion v2.16. Propagée dans `CHAMPS_SUMMARY`, affichée dans la carte de l'onglet Ventes (ligne "Caisse réelle totale" avec sa note d'usage) et comme 5ᵉ KPI du rapport PDF (`construireRapportPdf`, `ligneKpi` générique sur le nombre de cartes, aucun changement dans `nexus-pdf-moteur.js`). Vérifié par requête directe sur la semaine du 03→09/08/2026 : CA grattage 9185 €, caisse loto 5190,15 €, écart 6,10 €, caisse réelle totale 8698,25 € — identiques aux "TOTAUX semaine" du tableur source à l'euro près. `node --check` du script extrait OK ; les tests de composition PDF existants (`test_fdj_composition.js`, `test_fdj_granularite.js`) repassent sans régression (`ligneKpi` déjà générique sur le nombre de cartes, non modifié). |
| v2.22 | 10/08/2026 | Message pré-comptage (`NEXUS-Inventaire-v1.html` + `NEXUS-FDJ-v1.html`) : texte pédagogique fixe affiché une seule fois par session de comptage, juste avant le premier comptage, expliquant la conséquence d'une erreur plutôt qu'un simple rappel — jamais de chiffre financier inventé. `demarrerOuverture()` devient une garde devant `demarrerOuvertureComptage()`. Voir section 9. Le message adaptatif selon les anomalies récentes est un lot séparé, non construit ici. |
| v2.21 | 10/08/2026 | Étape 3 de l'audit "Paramétrage FDJ" : nouvel écran manager `NEXUS-FDJ-Parametres-v1.html` (onglets Organisation/Catalogue des jeux/Emplacements) permettant d'éditer `fdj_site_settings`, `fdj_games` et `fdj_locations` sans SQL. Navigation wirée (sidebar bureau, Explorer NEXUS, recherche, lien direct depuis Contrôle FDJ). Voir section 7, "Écran manager Paramètres FDJ". Reste à construire : Stock & mouvements, test de configuration, versionnage, duplication de site. |
| v2.20 | 10/08/2026 | Premier lot ("fondations") de l'audit "NEXUS FDJ — Paramétrage autonome & multi-site" fourni par Frédéric : nouvelle table `fdj_site_settings` (une ligne par site, RLS scopée `current_employee_site_id()`) regroupant profil de stock, quarts/horaire de repli, seuils de caisse, `seuil_min_quarts_moyenne` et 4 seuils Coach. Élimination des constantes JS jusque-là identiques pour tous les sites : `HORAIRE_DEFAUT_DEBUT_QUART2` (`NEXUS-FDJ-v1.html`), `SEUIL_MIN_QUARTS` (`NEXUS-FDJ-Analyse-v1.html`, 2 occurrences), et les 4 seuils de `calculerCandidatsCoachEquipe()` dans `nexus-coach-fdj-moteur.js` — devenus un second paramètre optionnel (`seuils`) plutôt que des constantes internes, pour préserver Article 11 (moteur sans accès Supabase) ; `NEXUS-Brief-v1.html` charge désormais `fdj_site_settings` et les transmet. Aucun changement de comportement (mêmes valeurs par défaut qu'avant). Voir section 7, "Paramétrage FDJ par site". Reste à construire : écran manager, statut caisse "à contrôler", versionnage, duplication de site — étapes suivantes du même audit. |
| v2.19 | 10/08/2026 | Mise en évidence de "Caisse réelle totale" (demande de Frédéric, "encadré ou d'une autre couleur") : côté écran, sortie de la carte résumé neutre de l'onglet Ventes vers un nouvel encadré dédié (`.caisse-reelle-box`, teinte + bordure cyan, valeur en 20px/800), placé juste après ; côté rapport PDF, le 5ᵉ KPI "Caisse réelle" reçoit `couleurValeur: COULEUR.cyan` (seule carte colorée par défaut, indépendamment du signe, pour qu'elle saute aux yeux au milieu des 4 autres) — même traitement visuel (cyan) qu'à l'écran, sans dupliquer de logique de couleur. Vérifié : `node --check` du script extrait OK, `test_fdj_composition.js`/`test_fdj_granularite.js` toujours verts (`ligneKpi`/`COULEUR.cyan` déjà génériques, `nexus-pdf-moteur.js` non modifié). |
| v2.23 | 10/08/2026 | Renommage des deux Indice NEXUS (décision de Frédéric suite au doc `NEXUS-Brief-V2-Architecture-v1.md`, qui avait identifié la coexistence de 2 formules sous le même nom générique comme une violation d'Article 11 à trancher : garder les deux formules distinctes plutôt que les unifier, mais leur donner un nom propre à chacune plutôt qu'un nom générique commun). "Indice Marge" (2 facteurs — marge + évolution du CA, `nexus-indice.js`, `calculerIndiceNexus()`) : affiché sur l'État global de l'accueil (`NEXUS-App-v1.html`, libellé `INDICE MARGE`) et dans le domaine "Résultats" du Radar du Manager (`NEXUS-Radar-Manager-v1.html`). "Indice Boussole" (moyenne des 5 axes Commerce/Marge/Opérations/Équipe/Risques) : affiché en tête de `NEXUS-Brief-v1.html` (écran + PDF). Avant ce renommage, les deux portaient le même libellé "Indice NEXUS" — la distinction n'existait que dans une infobulle qu'il fallait ouvrir pour la découvrir ; elle est désormais lisible directement dans le libellé affiché. Aucun changement de calcul, uniquement du libellé et des textes explicatifs. Contexte complet : ce renommage a émergé pendant l'audit du chantier "nouvel accueil" (vision du 10/08/2026 sur la première impression NEXUS) — l'audit a découvert que le concept d'accueil du 24/07/2026 (`NEXUS-Refonte-Accueil-Note-Conception.md`) était déjà construit et même dépassé dans `NEXUS-App-v1.html` (Conseiller en tête, État global avec indice + synthèse + domaines, KPI "Aujourd'hui", "Outils principaux", "Explorer NEXUS" = Niveau 4 replié) — donc rien à construire côté accueil, seul ce renommage restait un écart réel avec Brief NEXUS. `node --check` OK sur les 3 fichiers modifiés (`NEXUS-App-v1.html`, `NEXUS-Radar-Manager-v1.html`, `NEXUS-Brief-v1.html`). |

| v2.24 | 10/08/2026 | Correctif signalé par Frédéric : "le bouton dans Brief 'Accepter cette décision' ne fonctionne pas." Diagnostic en base (Supabase) avant toute correction — 5 écritures réussies dans `journal_decisions` sous son propre compte dans les minutes précédentes, RLS et contraintes de la table saines : l'écriture réseau fonctionnait réellement. Cause réelle, confirmée avec Frédéric ("après rechargement") : `enregistrerJournalDecision()` réussit, mais rien ne le montre avant la fin du rechargement complet du Brief (`rafraichir()` → `construireBrief()`, plusieurs appels réseau séquentiels) — le clic semblait sans effet, et un rechargement de page pendant ce délai pouvait laisser voir la décision encore présente. Correctif : confirmation optimiste immédiate sur `NEXUS-Brief-v1.html` — au clic, le bouton change de texte ("✓ Décision acceptée" / "✓ Marqué comme fait") et la carte se grise (`.decision-card.valide-optimiste`) avant même la fin de l'écriture réseau, avec retour à l'état initial si l'écriture échoue réellement (erreur affichée). Appliqué identiquement aux deux boutons de décision (`.decision-valider` et `.decision-fait`). Aucun changement de logique d'exclusion (`VALIDEES_SITE`, déjà correcte) — uniquement un défaut de retour visuel. Vérifié : `node --check` du script extrait OK. |
| v2.25 | 10/08/2026 | Demande de Frédéric : "dans FDJ, il faut que tu me donnes la possibilité de mettre le symbole -, car parfois la caisse tirage peut être négative." Le champ `caisse_tirages` (rapport journalier temps réel) n'avait déjà aucun plancher côté moteur (`NexusFdjMoteur.caisseAttendue()` additionne algébriquement, jamais de `Math.max(0, ...)`) — le blocage était uniquement le clavier numérique mobile déclenché par `inputmode="decimal"`, qui n'affiche pas systématiquement la touche "-" selon le téléphone/navigateur. Ajout d'un bouton dédié "±" à gauche du champ "Caisse tirages", sur `NEXUS-FDJ-v1.html` (saisie employé, phase Tirages) et `NEXUS-FDJ-Manager-v1.html` (correction manager) : inverse le signe de la valeur déjà saisie, indépendant du clavier virtuel, donc fiable sur tout appareil. Le bouton se colore en rouge (`.btn-signe.actif`) quand la valeur est négative, pour rester visible même une fois le clavier refermé. Aucun changement du moteur ni de la table `fdj_reports` — uniquement la saisie. Vérifié : `node --check` du script extrait OK sur les deux fichiers. |
| v2.26 | 10/08/2026 | Refonte "Porte NEXUS" de `NEXUS-App-v1.html`, V1 (restructuration, à la demande détaillée de Frédéric — document `NEXUS-App-Porte-NEXUS-v1.md`) : APP arrête d'annoncer sa propre structure interne pour se concentrer sur donner envie d'entrer dans NEXUS. Retrait des numéros de section (1 à 5) et du libellé "Le Conseiller" — le "Bonjour {prénom}, N décisions méritent votre attention aujourd'hui" déjà écrit dans `renderConseillerHome()` sert désormais lui-même de phrase d'accueil de la page (CSS desktop réajustée en conséquence pour garder l'alignement des deux colonnes, `.app-top-row .conseiller-card{margin-top:44px}`). Nouveau bloc "Que voulez-vous faire ?" (4 cartes : Améliorer mes résultats / Garder le contrôle / Faire progresser mon équipe / Savoir quoi faire maintenant) — jamais un nom de module, toujours un problème ; 3 cartes renvoient vers "Comprendre NEXUS" (déjà un point d'entrée par intention complet, pas reconstruit), la 4ᵉ directement vers Brief NEXUS (`data-brief-nexus="1"`, verrouillage cohérent avec le reste du menu si le site n'y a pas accès). `NEXUS-Documentation-v1.html` gagne un lien profond `?intention=xxx` (lit l'URL, déclenche le clic du chip correspondant) pour que la carte "Faire progresser mon équipe" atterrisse directement sur le parcours "piloter-equipe" plutôt que sur la liste des 6 objectifs — les deux autres cartes restent volontairement génériques (chacune recouvre 2 intentions différentes, pas de présélection forcée). "Vos outils principaux" renommé "Vos raccourcis" (contenu inchangé — la version réellement personnalisée par usage réel est un chantier séparé, aucune donnée de fréquentation n'existe aujourd'hui, voir décision 2 du document). Recherche reformulée en intention : label "Que cherchez-vous à faire ?", placeholders "contrôler une caisse, comprendre ma marge, voir mes stocks…" (manager) / "pointer mon arrivée, voir mes missions, ma progression…" (employé) — données `PAGES_INDEX` inchangées (déjà rédigées en langage d'utilité). Décisions volontairement NON traitées dans ce lot (V2, document séparé) : moteur diagnostic partagé (mini-carte "Votre entreprise aujourd'hui" résumant vraiment Brief NEXUS au lieu du calcul séparé actuel de l'État global/Indice Marge) et fusion de l'état "nouveau prospect" avec `NEXUS-Onboarding-Decouverte-v1.md`. `node --check` OK sur `NEXUS-App-v1.html` et `NEXUS-Documentation-v1.html`. |

| v2.27 | 10/08/2026 | Refonte "Porte NEXUS" V2 (suite de v2.26, document `NEXUS-App-Porte-NEXUS-v1.md`, décision 3 — "Brief devient la vérité du diagnostic dirigeant. APP en affiche uniquement un résumé"). Nouveau fichier `nexus-boussole-moteur.js` : extraction des fonctions pures de statut/score par axe Boussole (`statutCommerce`, `statutValeur`, `statutEquipe`, `statutRisques`, `scoreDepuisEvolution`, `scoreDepuisMarge`, `scoreOperations`, `scoreRisques`, `couleurAxe`, `genererBoussoleSVG`, plus `SEUIL_ECART_OPERATIONS_EUR`/`SEUIL_MIN_POINTAGES_EQUIPE`), jusque-là dupliquées à l'identique (mêmes seuils, "promesse" documentée par commentaire mais jamais garantie par le code) dans `NEXUS-Brief-v1.html` ET `NEXUS-App-v1.html`. Les deux fichiers consomment désormais le même moteur (Article 11) — zéro changement de comportement, vérifié par comparaison ligne à ligne des fonctions avant extraction. `NEXUS-App-v1.html` : la carte "Le Conseiller" (décisions détaillées, validables directement) et "État global" (Indice Marge + 5 domaines, calcul propre à APP) sont remplacées par une seule carte compacte "Votre entreprise aujourd'hui" (`renderEntrepriseAujourdhui`) — une phrase de synthèse, 4 badges emoji Commerce/Marge/Opérations/Équipe (statuts identiques à ceux de Brief NEXUS, aucun score numérique concurrent de l'Indice Boussole), le nombre de décisions en attente, et un lien "Voir mon Brief →" (`data-brief-nexus="1"`) vers Brief NEXUS pour le détail complet. Conséquences du retrait : `validerDecisionHome()`, `priorItemComplet/Court()`, `renderConseillerHome()`, `verbeActionAleatoire()` et l'affichage de l'Indice Marge sur l'accueil sont supprimés (plus aucun appelant) ; `chargerStockSanteHome()`/`statutStock()` retirés avec l'appel réseau associé (résultat qui ne servait plus qu'à l'ancien "État global") ; le domaine Stock n'apparaît plus dans le résumé d'accueil (reste accessible via "Garder le contrôle" → Scanner Stock). Limite connue, documentée volontairement plutôt que cachée : un site sans Brief NEXUS inclus (`sites.brief_nexus_inclus = false`) perd toute possibilité d'agir sur une décision directement dans NEXUS, faute d'écran de repli — situation aujourd'hui purement théorique (vérifié en base : les deux sites existants ont `brief_nexus_inclus = true`) mais à surveiller à la création d'un nouveau site sans cette option. Vérifié : `node --check` OK sur `nexus-boussole-moteur.js`, `NEXUS-Brief-v1.html`, `NEXUS-App-v1.html` ; recherche exhaustive de références orphelines aux id/fonctions retirés (un écouteur `indiceLegendeToggle` aurait levé une exception au chargement, corrigé). |

| v2.28 | 10/08/2026 | Nouveau module NEXUS Carburants — né d'une observation de Frédéric ("mon problème n'est pas d'avoir trop peu de données, c'est l'inverse : je dois ressaisir, recouper, comparer d'un tableau à l'autre") qui décrivait sa routine matinale réelle (Carburants → FDJ → Caisse veille → Inventaire). Audit du code confirmant que Carburants était le SEUL des 4 domaines sans aucune trace dans NEXUS (Verify capture déjà le litrage vendu par carburant pour la remise en cuve, Tempo l'affiche en lecture seule, mais rien ne suit le stock physique ni l'écart). Frédéric a fourni son fichier réel ("Variation carburant 2026.xlsx") : structure confirmée (Gasoil sur deux cuves physiques distinctes 20000 L + 10000 L, additionnées ; SP95 et GNR sur une cuve chacun) et écart(%) = écart / ventes (ratio, formule Excel H=ROUND(G/F,2)) repris à l'identique. Écart DÉLIBÉRÉ avec la formule Excel du théorique, décision explicite de Frédéric après démonstration chiffrée sur son propre fichier : Excel chaîne THEORIQUE(jour N) = THEORIQUE(jour N-1) + LIVRAISON - VENTES, jamais recalé sur une vraie mesure — dérive constatée dès le premier jour du fichier (écart SP95 déjà à -575 L le 1ᵉʳ mars, dérivant lentement jusqu'à -900/-1000 L en juillet, un chiffre quasi constant qui ne dit plus rien du jour présent). NEXUS recale désormais le théorique chaque jour sur le dernier STOCK RÉEL mesuré (pas sur le théorique de la veille) : l'écart repart de zéro à chaque relevé physique. Nouvelle table `carburant_releves` (site, date, stock_reel_go_cuve1/cuve2/sp95/gnr, livraison_*, mouvement_*, motif, commentaire, saisi_par ; unique (site,date) ; RLS identique au patron `audits_caisse` — select site+créateur autorisé, insert/update manager même site). Nouveau moteur `nexus-carburant-moteur.js` (stockReelGoTotal, sommerVentesPeriode, calculerTheorique/Ecart/EcartRatio, statutCarburant, calculerCarburant) — consomme le litrage déjà saisi dans `audits_caisse.litrage_gazole/sp95/gnr` (NEXUS Verify) via une somme sur la période depuis le dernier relevé, jamais ressaisi. Nouvel écran manager `NEXUS-Carburants-v1.html` : jaugeage à l'ouverture (3 carburants, 4 cuves), livraison et mouvement exceptionnel optionnels, théorique/écart/statut recalculés en direct à la saisie, bandeau explicite rappelant que les ventes viennent déjà de Verify. Navigation : ajouté au groupe "Exécuter" (juste après Verify) dans `NEXUS-App-v1.html` (nav-item + `PAGES_INDEX`) et `nexus-desktop.js` (sidebar bureau). Aucun forfait requis (même traitement que Verify, cœur opérationnel non premium). Vérifié : `node --check` OK sur les 3 fichiers modifiés/créés ; moteur testé en isolation contre des cas simulés et contre la structure réelle du fichier Excel de Frédéric (mars/juillet/août 2026) ; contraintes et RLS de `carburant_releves` vérifiées directement en base. Non construit dans ce lot (périmètre volontairement limité à Carburants seul, décision de Frédéric — "je ne veux pas qu'on s'éparpille") : le "Parcours du manager" (checklist matinale unifiée Carburants/FDJ/Caisse/Inventaire) et l'intégration de Carburants comme 5ᵉ/6ᵉ axe dans "Votre entreprise aujourd'hui" (v2.27) — les deux visions restent valides mais attendent que Carburants ait produit plusieurs semaines de données réelles. |
| v2.29 | 10/08/2026 | Premier bout-en-bout de "Rapport NEXUS" (nouveau deliverable distinct de Brief NEXUS, décrit par le document "cadrage développeur" uploadé par Frédéric le 10/08/2026 : rapport multi-pages, période calendaire choisie par le manager, comparée à une référence, 12 chapitres à terme). Frédéric a choisi de construire d'abord "2 chapitres bout-en-bout" (Chapitre 1 Synthèse dirigeant + Chapitre 2 Santé de l'entreprise) pour prouver l'architecture complète (sélection de période, cascade de sources honnête, PDF multi-pages) avant de généraliser aux 10 autres chapitres. Constat préalable, déterminant pour la conception : aucune source de CA/marge ne couvre aujourd'hui "n'importe quelle période depuis n'importe quand" — `products` (table déjà utilisée par `nexus-periodes.js`) a de la profondeur (depuis janvier 2026) mais seulement 4 blocs d'import irréguliers non calendaires ; `current_normalized_sales` (vue sur `normalized_sales`, granulaire par transaction, seule source à porter CA ET marge ensemble) ne remonte qu'à fin juillet 2026 (1021 lignes, 31/07→11/08) ; `audits_caisse` (vente_piste+vente_boutique, quotidien) remonte à mi-juillet (46 lignes, 18/07→10/08) mais n'a pas de marge. Frédéric a validé (AskUserQuestion, "Cascade + honnêteté") le principe suivant, dans l'esprit "vérité avant certitude" déjà appliqué partout dans NEXUS : chaque métrique essaie ses sources dans l'ordre de fiabilité décroissante et s'arrête à la première qui couvre la période demandée ; si aucune ne couvre, NEXUS affiche explicitement "données insuffisantes" plutôt que de fabriquer un chiffre ou de recalculer sur un découpage différent de celui demandé. Comme `normalized_sales`/`audits_caisse` s'enrichissent chaque jour, la couverture des périodes récentes s'élargira d'elle-même, sans changement de code. SECOND CONSTAT, trouvé en vérifiant les vraies données AVANT livraison (même discipline que le bug de formule Carburants, v2.28) : `current_normalized_sales`, malgré son architecture idéale sur le papier (seule source avec CA ET marge par ligne), sous-estime massivement le CA réel une fois comparée jour par jour à `audits_caisse` — ex. 31/07/2026 : 565 € contre 10 479 € le même jour, un facteur ~18 ; ~96 lignes/jour de façon quasi constante, plutôt le signe d'un jeu de données de démonstration (probablement lié à la couche API normalisée livrée fin juillet) que d'une capture continue des ventes réelles. Conséquence, tranchée sans repasser par Frédéric (cohérente avec le principe "vérité avant certitude" déjà validé, pas une nouvelle décision de fond) : `normalized_sales` est retirée de la cascade CA (qui devient `audits_caisse` → `products` uniquement) et conservée uniquement pour la marge, mais son résultat y est étiqueté `confiance:'derive'` (pas `'reel'`) avec `couvertureIncertaine:true` — le taux de marge peut rester indicatif même si l'échantillon est partiel, mais ne doit jamais être présenté avec la même confiance qu'une mesure complète ; l'écran et le PDF affichent la mention "échantillon partiel des ventes, taux indicatif" partout où ce taux apparaît. Quatre nouveaux fichiers, tous purs sauf le chargeur Supabase (Article 11) : (1) `nexus-periodes.js` étendu (additif, aucune fonction existante modifiée) avec `resoudrePeriodeCalendaire(type, dateAncrage, bornesLibres)` (semaine/mois/trimestre/année/dates libres → {debut,fin,label}) et `resoudrePeriodesReference(periode)` (résout la ou les référence(s) à essayer dans l'ordre — ex. mois → [mois précédent, même mois année précédente] — reprenant la table du cadrage développeur §3) ; (2) `nexus-rapport-donnees.js` (nouveau, colle Supabase) : `chargerCaPeriode` (cascade `audits_caisse` → `products`), `chargerMargePeriode` (cascade `normalized_sales` [dérivé, couverture incertaine] → `products`), `chargerAvecRepli` (essaie une liste de périodes de référence, s'arrête à la première disponible), `chargerDecisionsPeriode` (journal_decisions filtré sur la période) ; (3) `nexus-rapport-moteur.js` (nouveau, pur) : `construireChapitreSynthese`/`construireChapitreSante`, réutilisés à l'identique par l'écran ET le PDF (jamais deux calculs séparés du même rapport) — Chapitre 2 volontairement limité en V1 aux axes Commerce et Marge (les deux seuls scopés par période calendaire aujourd'hui), Opérations et Équipe listés honnêtement comme "non couverts (V1)" plutôt que masqués ou improvisés ; (4) `NEXUS-Rapport-v1.html` (nouvel écran manager) : sélecteur de période (5 boutons + dates libres), rendu à l'écran des deux chapitres avec badges RÉEL/DÉRIVÉ (confiance de la source effectivement utilisée), et export PDF multi-pages via `NexusPdfMoteur.ConstructeurRapport` (première utilisation de cette classe — jusqu'ici seule `ConstructeurRapportUnePage` avait des appelants — car un rapport de plusieurs chapitres avec tableau de décisions n'a pas vocation à tenir sur une page unique, à la différence de Brief). Navigation : ajouté au groupe "Piloter", juste après Brief NEXUS, dans `NEXUS-App-v1.html` (nav-item + `PAGES_INDEX`) et `nexus-desktop.js` (sidebar bureau). Vérifié : `node --check` OK sur les 4 fichiers ; `resoudrePeriodeCalendaire`/`resoudrePeriodesReference` testés unitairement (semaine/mois/trimestre/année/libre, y compris les cas de bascule d'année pour janvier/T1) contre des dates réelles ; `nexus-rapport-moteur.js` testé unitairement (cas disponible et cas "données insuffisantes") ; profondeur réelle des 3 tables sources vérifiée par requête directe en base. Non construit dans ce lot (périmètre volontairement limité à 2 chapitres, décision de Frédéric) : les 10 autres chapitres du cadrage développeur, les axes Opérations/Équipe de la Boussole période-scopés, le vocabulaire financier à 5 niveaux (Valeur générée/perdue/à sécuriser/exposée/Potentiel), la boucle Décision→Action→Mesure→Apprentissage, et la navigation interactive "clic vers preuve". |

| v2.30 | 10/08/2026 | Raccourcis configurables — demande de Frédéric ("permets de changer les raccourcis dans paramètres station"), issue de sa vision "Parcours du manager" du même jour. Avant ce lot, "Vos raccourcis" sur `NEXUS-App-v1.html` était une liste FIXE de 4 outils (Cockpit/Verify/Tempo/Produits) codée en dur dans `renderOutilsGrid`. Nouveau fichier `nexus-raccourcis-catalogue.js` (Article 11, "une seule vérité") : catalogue de ~18 outils proposables (`RACCOURCIS_CATALOGUE`, label/icône ou emoji/description statique/forfait requis le cas échéant), `RACCOURCIS_DEFAUT` (les 4 historiques, utilisés tant qu'un site n'a rien configuré) et `MAX_RACCOURCIS` (4) — partagé à l'identique par `NEXUS-App-v1.html` (rendu) et `NEXUS-Parametres-Station-v1.html` (sélecteur), jamais deux listes séparées. Nouvelle colonne `station_config.raccourcis` (jsonb, nullable — migration `ajouter_raccourcis_station_config`) : tableau de noms de fichiers .html, NULL = non configuré. `NEXUS-App-v1.html` : `chargerRaccourcisHome()` lit cette colonne en parallèle du reste des données manager (`Promise.all` de `initPosteManager`) et la transmet à `renderOutilsGrid`, qui retombe sur `RACCOURCIS_DEFAUT` si rien n'est configuré ou si une entrée choisie ne correspond plus à rien du catalogue (page renommée) — jamais un écran vide ni un lien cassé. Seuls Cockpit/Verify/Tempo/Produits gardent une description "vivante" recalculée à partir des données du jour (`descriptionRaccourci`) ; les autres raccourcis affichent la description statique du catalogue. `NEXUS-Parametres-Station-v1.html` : nouvelle carte "Vos raccourcis" (cases à cocher, plafonnées à 4, désactivées visuellement une fois le plafond atteint), filtrée par le forfait réel du site (`NexusForfait.chargerForfait`) — un site Essential ne se voit jamais proposer un raccourci vers un outil Professional qu'il ne peut de toute façon pas ouvrir, même logique que le verrouillage de menu existant. Bouton "Revenir à la sélection par défaut" remet `raccourcis` à NULL plutôt que de réécrire la liste historique en dur (si celle-ci change un jour, la remise à zéro reste correcte sans modification). Limite connue, documentée volontairement : le catalogue ne vérifie pas `sites.brief_nexus_inclus` pour Brief NEXUS/Rapport NEXUS — un site sans Brief NEXUS inclus pourrait en théorie choisir ces raccourcis (ils resteraient protégés par leur propre garde interne, `nexusRequireBriefNexus`, donc jamais un accès réel non autorisé — seulement un raccourci qui redirigerait). Vérifié : `node --check` OK sur les 3 fichiers ; `station_config.raccourcis` confirmé NULL sur les deux sites réels (donc comportement par défaut inchangé tant que personne n'a configuré ses raccourcis) ; catalogue relu champ par champ contre `PAGES_INDEX` pour cohérence des libellés/descriptions. |

| v2.31 | 11/08/2026 | Simplification de l'accueil `NEXUS-App-v1.html` — demande de Frédéric ("simplifie l'écran en enlevant à retenir aujourd'hui et aujourd'hui"). Retrait des deux sections "À retenir aujourd'hui" (`retenirGrid` — 3 cartes Opportunité/Attention/Action immédiate) et "Aujourd'hui" (`kpiGrid` — chips Missions/Rappels/Contrôle inventaire/Missions à valider/Décisions validées/Résultats Équipe), jugées redondantes avec la carte "Votre entreprise aujourd'hui" (v2.27) et "Vos raccourcis" (v2.30) juste au-dessus/en-dessous. Suppression complète, pas seulement visuelle — même discipline que v2.27 ("les conséquences du retrait") : `renderARetenir()`, `renderKpiGrid()` et leurs helpers `detailDecisionsSemaine()`/`detailResultatsEquipe()` supprimés (plus aucun appelant) ; chargeurs devenus orphelins supprimés : `chargerDecisionsSemaine()` (+ `debutSemaineISO()`, qui n'avait pas d'autre appelant), `chargerMissionsRestantesHome()`, `chargerAlertesInventaireHome()`, `chargerMissionsAValiderHome()` ; leurs entrées retirées du `Promise.all`/de la destructuration de `initPosteManager()` ; CSS orpheline retirée (`.retenir-grid`/`.retenir-card`/`.retenir-tag`/`.retenir-titre`/`.retenir-detail`/`.retenir-vide`, `.kpi-grid`/`.kpi-chip*`, y compris la règle bureau `body.nexus-desktop .kpi-grid`). Conservé à dessein : `chargerDomainesRadarHome()` (toujours utilisé par `renderEntrepriseAujourdhui` pour `equipeScore`/`totalPointages` — seul son champ `employesASurveiller`, qui n'alimentait que le KPI grid retiré, n'est plus consommé) et `compterRappelsUrgents()` (encore appelée pour le badge "Urgent" du menu, appel indépendant de l'accueil). Aucun changement de comportement ailleurs dans l'app. Vérifié : `node --check` OK sur le script extrait ; recherche exhaustive (`grep`) confirmant l'absence de toute référence résiduelle aux id/fonctions/classes retirés hors du commentaire explicatif laissé dans le HTML. |

| v2.32 | 11/08/2026 | NEXUS Carburants Pilotage — Phase 1 (Contrôle + Performance + Brief) de la montée en puissance en 6 familles d'intelligence proposée par Frédéric (message détaillé du 11/08/2026), les Phases 2 (autonomie stock/livraisons) et 3 (couche économique — marge, effet stock/prix, choisie avec valorisation CMP) restant à construire séparément. Constat préalable, vérifié en base avant de coder : `audits_caisse` capture déjà `prix_gazole/prix_sp95/prix_gnr` par quart depuis le 18/07/2026 — le "prix de vente daté" nécessaire à la Phase 3 existe donc déjà, sans nouvelle saisie ; en revanche `carburant_releves` est vide (aucun relevé saisi depuis la création de l'écran), donc le contrôle quotidien n'aura de contenu réel qu'une fois Frédéric passé à l'usage régulier du Relevé du jour — affiché honnêtement comme tel plutôt que masqué. `nexus-carburant-moteur.js` étendu (additif, Article 11, aucune fonction existante modifiée) : `calculerMixCarburant` (répartition % par carburant, carburant sans donnée exclu du total plutôt que traité comme 0), `calculerEvolutionVolume`, `identifierProduitMoteur` (le carburant qui pèse le plus dans le volume), `decomposerEvolution` (contribution de chaque carburant au delta total entre deux périodes) et `identifierMoteurEvolution` (le carburant qui explique le plus le mouvement — DISTINCT du produit moteur, conformément à l'exemple donné par Frédéric : le plus gros volume n'est pas forcément celui qui fait progresser/reculer l'activité) — vérifiées par tests unitaires reproduisant exactement son exemple chiffré (GO −1850 L, SP95 +310 L, GNR −60 L → total −1600 L, moteur d'évolution = GO). Nouveau fichier `nexus-carburant-donnees.js` (colle Supabase, Article 11) : `chargerVentesPeriode` (litrage Verify sur une période + mesure de couverture nbQuartsAvecLitrage/nbQuartsTotal, jamais présentée comme 100 % par défaut) et `chargerControleJour` (reproduit à l'identique la chaîne de calcul déjà utilisée par `NEXUS-Carburants-v1.html` — dernier relevé réel → ventes captées depuis ce relevé → théorique/écart/statut — jamais une deuxième formule pour la même question). Nouvel écran manager `NEXUS-Carburants-Pilotage-v1.html` : Contrôle du jour (statut par carburant, lecture seule), Volumes & performance (litres par carburant + total, évolution vs référence résolue par `nexus-periodes.js` — même moteur que Rapport NEXUS), Mix carburant (barres de répartition), Moteur & progression (produit moteur, moteur d'évolution, phrase de synthèse générée par `construireSyntheseEvolution` sur le modèle "La baisse de la période provient principalement du GO. Le SP95 compense partiellement le recul."). Distinct de `NEXUS-Carburants-v1.html` (Relevé du jour, écran opérationnel de saisie) — même séparation que FDJ/FDJ Pilotage : Relevé collecte, moteur calcule, Pilotage comprend. Piège découvert et corrigé AVANT livraison (vérification contre les données réelles du site, même discipline que les bugs Carburants/normalized_sales des lots précédents) : comparer une période CALENDAIRE en cours (ex. "cette semaine" un mardi, seulement 2 jours de données) à une référence complète fabrique une évolution massivement fausse (testé avec les vraies données : -91,6 % artificiel) — corrigé pour le résumé Brief en comparant deux fenêtres GLISSANTES de durée égale (7 derniers jours vs 7 jours précédents, même convention que `chargerCandidatsFdj` déjà dans ce fichier), et pour Carburants Pilotage (qui garde le choix explicite de période calendaire du manager, cohérent avec Rapport NEXUS) par un avertissement explicite "période en cours" affiché dès que la période sélectionnée n'est pas terminée, plutôt qu'un chiffre silencieusement trompeur. Cette même caractéristique (période calendaire en cours comparée sans avertissement) existe aussi dans Rapport NEXUS (`nexus-periodes.js`, `resoudrePeriodeCalendaire`/`resoudrePeriodesReference`) — non corrigée dans ce lot, à traiter séparément si Frédéric le souhaite. Résumé Brief NEXUS (`renderCarburants`, carte autonome — PAS intégrée au classement cross-moteurs des 3 décisions prioritaires, sur le modèle donné par Frédéric) : statut du jour (le pire des 3 carburants), écart(s) à mentionner, volume des 7 derniers jours glissants et son évolution, produit moteur, lien vers Carburants Pilotage. Navigation : "Carburants Pilotage" ajouté juste après "Carburants" dans `NEXUS-App-v1.html` (nav-item + `PAGES_INDEX`), `nexus-desktop.js` (sidebar bureau) et `nexus-raccourcis-catalogue.js` (raccourcis configurables) ; lien croisé ajouté dans `NEXUS-Carburants-v1.html` vers Pilotage. Vérifié : `node --check` OK sur les 6 fichiers touchés/créés ; fonctions du moteur testées unitairement (mix, évolution, décomposition, cas sans donnée) ; comparaison rolling-7-jours vérifiée par requête directe contre les vraies données du site (33 087 L sur les 7 derniers jours vs 39 007 L sur les 7 précédents, soit -15,2 %, un chiffre plausible — contre le -91,6 % artificiel de la version calendaire initiale) ; `carburant_releves` confirmé vide en base (0 ligne), donc le Contrôle du jour affichera honnêtement "aucun relevé" jusqu'au premier usage réel de l'écran. |

| v2.33 | 11/08/2026 | Raffinements de l'accueil `NEXUS-App-v1.html`, retours de Frédéric après relecture de la refonte "Porte NEXUS" V2 ("je considère cette architecture comme presque validée... les principaux travaux restants sont désormais des raffinements"). (1) "Votre entreprise aujourd'hui" passe de 4 à 6 axes : Carburants et FDJ rejoignent Commerce/Marge/Opérations/Équipe — Carburants réutilise `chargerStatutCarburantsHome()` (même chaîne que Carburants Pilotage/Brief, `NexusCarburantDonnees.chargerControleJour` + pire statut des 3 carburants, Article 11), FDJ réutilise le même compteur `fdj_alertes` non vues que le point rouge de la sidebar (`nexus-desktop.js`) — aucun des deux n'est un second calcul inventé pour l'occasion. `.entreprise-axes` passe d'un flex-wrap (retombait sur un nombre de lignes imprévisible) à une grille CSS fixe 3 colonnes × 2 lignes, jamais une seule ligne illisible sur mobile comme demandé explicitement. (2) Le libellé "décisions méritent votre attention" devient "sujets méritent votre attention" dès que le Conseiller cross-moteurs inclut un signal Advisor (le seul des 4 moteurs consultés ici — Produits/Marge/Tempo/Advisor — à produire un texte libre "sans geste concret associé", selon la propre documentation de Brief NEXUS) ; reste "décisions" quand les 3 items affichés sont tous des moteurs à action concrète — condition réelle (`candidatsConseiller.some(c => c.moteur === 'advisor')`), pas un simple renommage uniforme. (3) Header resserré d'environ 15-20 % de hauteur verticale (`padding` du `.header` 34px→24px en haut, logo 60px→50px, `.header-statut-row` et `.subtitle` resserrés, espace avant "Votre entreprise aujourd'hui" réduit) — rien retiré, uniquement les marges. (4) Placeholder de recherche ("contrôler une caisse, comprendre ma marge, voir mes stocks…") déjà conforme à la demande depuis la refonte v2.26 — vérifié, aucun changement nécessaire. (5) "Explorer NEXUS" laissé tel quel, conformément à la demande de Frédéric. (6) Raccourcis ordonnés par urgence du jour à l'AFFICHAGE uniquement (`trierParUrgenceDuJour()`) — ne modifie jamais `station_config.raccourcis` (les favoris du manager restent identiques), recalcule seulement l'ordre visuel à partir de signaux déjà chargés pour d'autres cartes de cette même page (`controlesVerify`, `statutCarburants`, `alertesFdjNonVues`, `nbPriorites`, `jourARenforcerTempo`) ; à urgence égale, tri stable qui préserve l'ordre choisi par le manager. Limite assumée : seuls 5 raccourcis du catalogue (~18 au total) ont un signal d'urgence défini pour l'instant (Verify, Carburants, Carburants Pilotage, Contrôle FDJ, Produits, Tempo) — les autres restent à urgence 0, ni pénalisés ni avancés. Vérifié : `node --check` OK sur le script extrait ; `fdj_alertes` (0 alerte non vue) et `carburant_releves` (vide) confirmés en base, donc FDJ affichera 🟢 Sous contrôle et Carburants ⚫ Données insuffisantes tant qu'aucun relevé n'est saisi — comportement honnête, pas une erreur. |

| v2.34 | 11/08/2026 | Mini-fiches interactives sur les 6 axes de "Votre entreprise aujourd'hui" (`NEXUS-App-v1.html`) — demande de Frédéric après usage réel des 6 axes livrés en v2.33 : "elles sont visuellement assez présentes pour que l'utilisateur ait naturellement envie de les toucher. Si elles ne font rien, on perd une occasion." Architecture explicitement voulue par Frédéric, en 3 profondeurs : la carte = "Comment va mon entreprise ?", les 6 axes = "Dans quel domaine ?", le clic = "Pourquoi ?" (mini-fiche intermédiaire), le moteur spécialisé = "Montrez-moi tout." Les 6 pastilles (`<span>` → `<button>`) sont désormais entièrement cliquables (toute la cellule, pas seulement le texte), avec effet de pression discret (`.entreprise-axe:hover/.actif`) et un chevron (`›` fermé / `⌄` ouvert) — jamais une navigation immédiate : le clic ouvre un panneau inline `#entrepriseFiche` (statut coloré, phrase "pourquoi" courte, lien "Voir X →" vers le moteur spécialisé), en accordéon (recliquer sur l'axe ouvert referme la fiche). `nexus-carburant-moteur.js` étendu (additif, Article 11) : `statutGlobalControle(parCarburant)` (pire statut des 3 carburants) et `texteControleJour(parCarburant, aucunReleve)` (phrase du jour, ex. "GO : écart de -186 L. SP95 et GNR sous contrôle.") — extraits pour que la mini-fiche Carburants de l'accueil, la carte Carburants de Brief NEXUS et Carburants Pilotage ne construisent plus jamais séparément la même phrase (avant ce lot, `renderCarburants()` dans `NEXUS-Brief-v1.html` et le futur code APP auraient dupliqué la même logique — extraction faite avant la divergence, même discipline que `nexus-boussole-moteur.js` en v2.27). `NEXUS-Brief-v1.html` : `renderCarburants()` refactoré pour appeler ces deux fonctions au lieu de sa propre copie locale de `ORDRE_GRAVITE_CARBURANT`/`ligneEcarts` — zéro changement de texte affiché, vérifié par tests unitaires reproduisant les phrases déjà validées. `NEXUS-App-v1.html` : `chargerStatutCarburantsHome()` retourne désormais `{ statut, detail, parCarburant, aucunReleve }` (au lieu du seul statut) pour que la mini-fiche affiche la phrase du jour sans second aller-retour réseau ; `construireAxes()` (nouvelle fonction) assemble les 6 fiches — Carburants via `NexusCarburantMoteur.texteControleJour`, Commerce/Marge/Opérations/Équipe avec un texte "detail" repris mot pour mot des AXES de `construireBrief()` dans `NEXUS-Brief-v1.html` (même phrase qu'affichée dans Brief, pour que la mini-fiche APP et Brief ne racontent jamais deux histoires différentes du même chiffre), FDJ à partir du compteur `alertesFdjNonVues` déjà chargé. Cibles/liens par axe : Carburants → Carburants Pilotage, Commerce → Produits, Marge → Scanner ("Comprendre pourquoi →"), FDJ → FDJ Pilotage, Opérations → Verify, Équipe → Résultats Équipe. Changement demandé par Frédéric sur la légende : `EMOJI_STATUT_AXE['Données insuffisantes']` passe de ⚫ à ⚪ (le noir se lisait comme "en panne", alors que "Données insuffisantes" signifie seulement que NEXUS n'a pas encore assez de mesures) — légende désormais 🟢 Sous contrôle / 🟠 À surveiller / 🔴 À corriger / ⚪ Données insuffisantes. Page laissée "exactement comme elle est aujourd'hui" par ailleurs, conformément à la demande explicite de Frédéric — aucun autre élément de l'accueil modifié. Vérifié : `node --check` OK sur les scripts extraits de `NEXUS-App-v1.html` et `NEXUS-Brief-v1.html` ; `statutGlobalControle`/`texteControleJour` testés unitairement (aucun relevé, cas mixte reproduisant l'exemple de Frédéric, cas tout sous contrôle) ; relecture de `construireAxes()` confirmant que chaque phrase "detail" ne recalcule rien de nouveau, uniquement des données déjà chargées par `initPosteManager()`. |

| v2.35 | 11/08/2026 | Brief NEXUS V3 + Rapport NEXUS — refonte pilotée par l'audit stratégique "Brief & Rapport" uploadé par Frédéric (23 pages, document `NEXUS_Audit_Strategique_Brief_Rapport_Direction.pdf`), qui proposait un modèle "secteurs" transversal remplaçant la Boussole à 5 axes. Trois choix tranchés par Frédéric (AskUserQuestion) avant construction : (1) "Secteurs configurables" — bâtir l'architecture multi-métier générique dès maintenant, pas seulement les 6 secteurs station-service en dur ; (2) filtrer les décisions de Brief au niveau stratégique (règle de granularité de l'audit) ; (3) étendre ce lot à Brief ET Rapport NEXUS. Deux nouveaux fichiers : `nexus-secteurs-catalogue.js` (`SECTEURS_CATALOGUE` — 6 entrées station-service id/label/icône/cible ; `SECTEURS_PRESET_METIER` — 4 presets métier, boulangerie/restaurant/commerce_detail documentés mais sans constructeur réel faute de client ; `secteursActifsSite(site)` — résout `site.secteurs` ou retombe sur le preset de `site.type_commerce`) et `nexus-secteurs-moteur.js` (constructeurs purs par secteur — Carburants/Commerce/Marge/FDJ/Opérations/Équipe — assemblant des valeurs déjà calculées ailleurs, jamais recalculées ici, conformément à l'Article 11 ; `estDecisionStrategique(candidatBrut)` implémente la règle de granularité de l'audit : un candidat est stratégique s'il est déjà transversal (`!article` — caisse/stock/tempo/fdj/coach/rappel/advisor), ou si sa `contribution >= 0.15` (seuil déjà utilisé par R4-RENFORT-A), ou si son `impact_eur >= 500` (nouveau seuil `SEUIL_IMPACT_STRATEGIQUE_EUR`, documenté comme réglable) — appliqué sur les candidats bruts avant normalisation, uniquement dans Brief NEXUS, jamais dans `nexus-conseiller.js` lui-même (Cockpit/Produits continuent de voir chaque référence) ; `construireVerdictDirection`/`construireCeQuiAChange`/`construireFreins`/`construireLectureDirecteur` produisent les Blocs A/C/E/F du Brief V3). Nouvelle migration Supabase `ajouter_secteurs_configurables_sites` : colonnes `sites.type_commerce` (text, défaut `'station-service'`) et `sites.secteurs` (jsonb, NULL = utilise le preset par défaut) — vérifiée en base, les deux sites existants confirmés `type_commerce='station-service'`/`secteurs=NULL` (comportement inchangé tant que rien n'est configuré). `NEXUS-Brief-v1.html` recomposé autour des 6 secteurs (remplace la Boussole à 5 axes "Commerce/Marge/Opérations/Équipe/Risques") : l'ancien axe autonome "Risques" est retiré et ses signaux (critiques caisse, alertes inventaire ouvertes, risque de stock) rejoignent le tableau `risques[]` du secteur Opérations plutôt que de disparaître ; nouveaux blocs affichés "Ce qui a changé" (max 3), "Ce qui freine la performance" (max 3, triés du pire au moins grave), "Lecture du directeur d'exploitation" (4 règles déterministes + repli honnête si aucune ne matche) ; "Forces du moment" fusionne les forces spécifiques déjà calculées avec les forces remontées par chaque secteur, plafonné à 3 ; "Décisions de direction" (renommé depuis "Décisions recommandées") n'affiche plus que les décisions Produits/Marge jugées stratégiques par le filtre de granularité. `chargerCandidatsFdj()` change de forme de retour (`array` → `{candidats, resume}`, les deux branches de retour anticipé mises à jour) pour exposer au moteur de secteurs les agrégats déjà chargés (CA grattage, évolution, jeu moteur, écarts) sans nouvel appel réseau. `NEXUS-Rapport-v1.html` / `nexus-rapport-moteur.js` : Chapitre 2 "Santé de l'entreprise" étendu à Carburants et FDJ (`construireChapitreSante(chapitreSynthese, extra)`, second paramètre additif, rétrocompatible) — nouveaux chargeurs période-scopés locaux `chargerCarburantsPeriode`/`chargerFdjPeriode` (délibérément séparés du constructeur de secteur `construireSecteurCarburants` de Brief, qui répond à "aujourd'hui" et non à une période arbitraire passée), réutilisant les primitives pures déjà existantes de `nexus-carburant-moteur.js` (`calculerMixCarburant`/`calculerEvolutionVolume`/`identifierProduitMoteur`) et le patron générique `NexusRapportDonnees.chargerAvecRepli` déjà en place pour Commerce/Marge. Opérations et Équipe restent listés honnêtement dans `axesNonCouverts` ("Non couvert (V1)"), pas encore scopés par période. Vérifié : `node --check` OK sur les 5 fichiers modifiés/créés pris ensemble (`NEXUS-Brief-v1.html`, `NEXUS-Rapport-v1.html`, `nexus-rapport-moteur.js`, `nexus-secteurs-catalogue.js`, `nexus-secteurs-moteur.js`) ; tests unitaires sur `nexus-secteurs-moteur.js` (règle de granularité sur 3 cas incluant le cas limite "petit montant sans contribution" correctement écarté, les 6 secteurs construits avec statuts/valeurs plausibles sur données simulées réalistes, Blocs A/C/E/F produisant un texte français cohérent) ; migration vérifiée par lecture directe des deux sites réels en base. Volontairement non construit dans ce lot (phases ultérieures de l'audit, non demandées explicitement) : généralisation du "contrat de secteur" complet de l'Annexe A, comparaisons N-1/moyenne mobile, moteur de suggestions de développement, boucle de décisions apprenantes. |

| v2.36 | 11/08/2026 | RAPPORT NEXUS DE DIRECTION — refonte demandée par Frédéric après usage du PDF v2.35 : « Brief NEXUS à l'écran doit rester synthétique. Mais le rapport PDF généré depuis Brief NEXUS ne doit surtout pas être limité à une page A4 [...] Le PDF doit devenir un véritable rapport de direction [...] 8 à 20 pages [...] sans jamais remplir artificiellement. » Vision fournie par Frédéric en 18 sections (Couverture, Synthèse exécutive, Tableau de bord économique, Trajectoire, Commerce, Produits moteurs/à potentiel, Marge, Carburants, FDJ, Opérations, Équipe, Risques, Ce qui va bien, Ce qui doit progresser, Projection, Suggestions de développement, Décisions + effets observés, Priorités + signature). Décision de scope (AskUserQuestion) : architecture complète des 18 sections dès ce lot, chaque section affichant honnêtement "Donnée insuffisante" plutôt que d'être inventée ou omise quand la profondeur manque (Article 5) ; PDF Brief étendu de 1 à 2-3 pages (pas transformé en rapport complet).

Cartographie préalable (agent Explore, lecture seule) ayant tranché plusieurs points avant de coder : `NEXUS-Rayon-v1.html` (agrégation CA/marge par catégorie) était absent du dossier connecté — restauré depuis la version la plus aboutie trouvée dans `uploads` (celle qui consomme déjà `nexus-periodes.js`) ; aucune donnée de panier moyen/nombre de tickets n'existe nulle part dans NEXUS (confirmé absent, jamais approximé) ; aucune donnée N-1 n'existe pour ce site (créé courant 2026) — recherchée dynamiquement plutôt que supposée absente à vie ; `products` ne permet pas de regroupement par mois calendaire natif (blocs d'import irréguliers) ; les fonctions de classification d'écart de caisse (Verify) et d'agrégation inventaire (RPC `generate_inventory_review`) existaient déjà mais dans des fichiers non partagés.

Deux extractions Article 11 avant construction (même discipline que `nexus-boussole-moteur.js`/v2.27) : `nexus-rayon-moteur.js` (nouveau — `construireRayonsDepuisLignes(rows)` et `classerRayons(rayons)` extraits de `construireRayons()` dans `NEXUS-Rayon-v1.html`, qui devient un simple appelant réseau) et `nexus-verify-moteur.js` (nouveau — `classifierEcart`/`GRAVITE_ORDRE`/`STATUT_LABEL`/`agregerAudits` extraits de `NEXUS-Verify-v1.html`, même traitement). `nexus-periodes.js` étendu (additif) : `regrouperParMoisCalendaire(rows)` — regroupe `products` par mois calendaire en rattachant chaque bloc d'import au mois de son `periode_debut` (méthode documentée en commentaire, pas de répartition au prorata qui simulerait une fausse précision journalière), signale les blocs à cheval sur deux mois (`blocsPartiels`).

Deux nouveaux fichiers portent l'essentiel du lot : `nexus-rapport-direction-donnees.js` (colle Supabase, Article 11) — `chargerCommerceCategories` (products complet du site → `NexusRayonMoteur`), `chargerOperationsPeriode` (agrège `audits_caisse` via `NexusVerifyMoteur.agregerAudits` + appelle le RPC `generate_inventory_review` déjà utilisé par Inventaire Manager, mapping type de période → type de synthèse documenté comme limite connue pour trimestre/année/libre), `chargerEquipePeriode` (nouveau chargeur RÉELLEMENT scopé par période sur `pointages`/`mission_assignments` — contrairement à `chargerDomaineEquipe`/`chargerDomainesRadarHome`, confirmés par la cartographie comme "tout l'historique", jamais filtrés par date), `chargerTrajectoire` (products complet → `regrouperParMoisCalendaire`). Et `nexus-rapport-direction-moteur.js` (pur, ~600 lignes) — un constructeur par section (`construireCouverture`, `construireSyntheseExecutive`, `construireTableauDeBord`, `construireTrajectoire`, `construireChapitreCommerce`, `construireProduitsMoteurs`, `construireChapitreMarge`, `construireChapitreCarburants`, `construireChapitreFdj`, `construireChapitreOperations`, `construireChapitreEquipe`, `construireChapitreRisques`, `construireForces`, `construireAmeliorer`, `construireProjection`, `construireSuggestions`, `construireDecisionsChapitre`, `construirePriorites`, `construireSignature`) plus un orchestrateur `construireRapportDirection(input)`. Choix de fond documentés en commentaire à chaque fois qu'une section de la vision de Frédéric dépasse les données réellement disponibles aujourd'hui, plutôt que d'improviser : "Produits à potentiel" utilise une heuristique modeste (produits à marge élevée d'un rayon absents de son propre top-ventes) faute d'un moteur de détection croissance+marge scopé sur une période arbitraire ; "Marge — explication de la variation" se limite à la contribution par catégorie (le classement moteurs/neutres/destructeurs de `classerRayons`) faute de décomposition effet CA/mix/prix d'achat/prix de vente au niveau article ; "Carburants — stock et économie" restent explicitement non couverts (chantiers Carburants Phase 2/3, non commencés) ; "Décisions — effets observés" affiche systématiquement l'absence de boucle avant/après (confirmée inexistante par la cartographie, `journal_decisions` n'a aucune colonne de résultat a posteriori) plutôt qu'un chiffre inventé ; "Projection" ne calcule un scénario rythme-actuel que si la période sélectionnée est réellement en cours (comparaison à la date du jour), sinon "non applicable — période déjà terminée" ; le scénario N-1 reste toujours "donnée insuffisante" (recherché dynamiquement dans `regrouperParMoisCalendaire`, jamais trouvé tant que le site n'a pas 2027).

`nexus-pdf-moteur.js` étendu : nouvelle méthode `ConstructeurRapport.pageDeGarde({titre, nomEntreprise, periodeBornes, accroche, sousAccroche, mentionBas})` — couverture premium centrée, sans bandeau d'en-tête, sans aucun KPI. Corrigé au passage un bug réel trouvé en écrivant cette méthode : le constructeur de `ConstructeurRapport` créait déjà une première page AVEC bandeau avant même l'appel à `pageDeGarde()`, ce qui aurait laissé une page vide inutile en tête de chaque rapport — corrigé en faisant en sorte que la toute première page ne porte jamais le bandeau par défaut (`_nouvellePage({sansBandeau:true})`), que `pageDeGarde()` réutilise directement plutôt que d'en recréer une.

`NEXUS-Rapport-v1.html` : `genererPdf()` entièrement recomposé pour produire les 18 sections via `NexusRapportDirectionMoteur.construireRapportDirection()` (chargé en parallèle de `chargerEtRendre()`, aucun second calcul de CA/marge/carburants/FDJ déjà connus par `CHAPITRE1`/`CHAPITRE2`) ; `chargerCarburantsPeriode`/`chargerFdjPeriode` (locaux au fichier) étendus additivement pour exposer les données déjà chargées mais pas encore remontées (`ventes` bruts pour la décomposition par carburant, `jeuxTop5` au lieu du seul jeu moteur) ; nouveau chargeur `NOM_ENTREPRISE` (table `sites`). L'écran (`render()`) reste volontairement inchangé — aperçu synthétique Chapitre 1/2 — avec une note explicite indiquant que le PDF est désormais le document complet, pour ne jamais laisser croire que l'écran et le PDF racontent la même profondeur.

`NEXUS-Brief-v1.html` : `construireRapportPdf()` migré de `ConstructeurRapportUnePage` (1 page stricte) vers `ConstructeurRapport` (pagination automatique) — même contenu déjà curaté par `construireBrief()` (3 forces max, 3 items watchlist max, 3 décisions max), simplement plus de place pour respirer ; page de garde via `pageDeGarde()`. Aucun changement du volume de contenu affiché à l'écran ni de la logique de sélection des forces/watchlist/décisions.

Vérifié : `node --check` sur les 4 nouveaux fichiers + les 4 fichiers HTML modifiés, pris ensemble. Tests unitaires : `NexusRayonMoteur`/`classerRayons` (catégorisation moteurs/neutres/destructeurs sur données simulées) ; `NexusRapportDirectionMoteur.construireRapportDirection` exécuté sur un cas "données riches" (tous les chapitres alimentés) ET un cas "données pauvres" (site fantôme, tout indisponible) — chaque section produit un texte honnête dans les deux cas, aucune exception. Génération PDF bout-en-bout simulée avec un mock pdf-lib (`mock_pdflib.js`, réutilisé des lots précédents) sur les deux mêmes cas : le rapport "données riches" produit **17 pages** (dans la fourchette 8-20 demandée, sans remplissage artificiel — la longueur découle uniquement des sections réellement alimentées), le PDF Brief étendu produit 2 pages sur un jeu de données réaliste. Non construit dans ce lot (chantiers ultérieurs, non demandés explicitement) : décomposition marge effet CA/mix/prix, Carburants Phase 2/3 (stock, économie), moteur de suggestions plus riche, boucle décisions→effets mesurés, régularisation du mapping RPC inventaire pour trimestre/année/libre. |

| v2.37 | 11/08/2026 | CENTRALISATION DES CALCULS REDONDANTS — deuxième audit stratégique uploadé par Frédéric, `NEXUS_Audit_Philosophie_Architecture_2026.pdf` (fidélité philosophique, architecture, risques ERP, granularité méthodologique), distinct de l'audit Brief/Rapport de la v2.35. Aucune instruction texte n'accompagnait l'upload — synthèse des constats proposée à Frédéric, qui a choisi (AskUserQuestion) de continuer par la priorité "Centraliser les calculs redondants + Data Dictionary" parmi les 7 recommandées par l'audit, plutôt que la dé-Vito-isation du cœur ou le refactoring des pages monolithiques (non traités dans ce lot). Cartographie préalable (agent Explore, lecture seule, sur les ~50 pages HTML et ~25 moteurs partagés) ayant confirmé 11 duplications concrètes de logique métier malgré la discipline Article 11 déjà appliquée à de nombreuses reprises dans les lots précédents — signe que la discipline doit rester un exercice continu, pas un one-shot. Trois duplications d'impact FORT corrigées dans ce lot (celles où une divergence de seuil ou de texte aurait pu induire le manager en erreur en lui montrant des priorités différentes selon l'écran) ; les duplications d'impact MOYEN/FAIBLE restantes (variantes de formatage `fmtPct`/`fmtEuros`/`fmtDateFr`/`fmtL`, formule d'évolution triviale réécrite dans `NEXUS-FDJ-Analyse-v1.html` et `NEXUS-Capital-v1.html::calculerDelta`) sont documentées ci-dessous comme dette identifiée mais non traitée, pour rester honnête sur ce qui a réellement été fait (Article 5) plutôt que de prétendre à une centralisation totale.

(1) Moteur R2/R3/R4 (Produits/CA) : `NEXUS-Missions-v1.html::construirePlansAction()` et `NEXUS-Capital-v1.html::chargerOpportunitesNonAppliquees()` recopiaient intégralement les seuils (0.15/0.20/-0.30), le texte `LANGAGE_ACTION`/`typeActionPourCategorie` et la fabrication des `candidate_id` `LIVE-R4-`/`LIVE-R3-`/`LIVE-R2-`, en parallèle de `NexusConseiller.calculerCandidatsProduits()` (source unique déjà utilisée par Cockpit/Brief/App/Centre d'Intelligence). Les deux pages appellent désormais directement cette fonction. Différence de comportement assumée et documentée dans le code : la copie locale de Missions désactivait R2/R3 dès que la période la plus récente était encore en cours (`periodeEnCours`), alors que le moteur partagé les évalue toujours sur la dernière paire de périodes déjà validée par `NexusPeriodes.analyserPeriodes`, indépendamment d'une période plus récente encore incomplète — comportement déjà en vigueur partout ailleurs ; Missions s'y aligne plutôt que l'inverse. `NEXUS-Produits-v1.html` avait déjà migré `LANGAGE_ACTION`/`typeActionPourCategorie` en v précédente mais recopiait encore les 3 seuils numériques deux fois (annotation ligne par ligne + `calculerStatutSimplifie`) : `nexus-conseiller.js` expose désormais `SEUIL_CONTRIBUTION_FORTE`/`SEUIL_HAUSSE`/`SEUIL_BAISSE`, utilisés en interne par `calculerCandidatsProduits()` elle-même et par Produits aux deux endroits.

(2) Candidat NEXUS Tempo pour le Conseiller : `NEXUS-App-v1.html::construireCandidatTempoHome()` et `NEXUS-Brief-v1.html::construireCandidatTempo()` étaient deux copies quasi identiques (Brief commentait explicitement "repris à l'identique de ... App-v1.html"), et une divergence réelle s'était déjà glissée entre elles — la copie Brief ne construisait jamais le bloc `opportunites` (jour en progression / jour à renforcer), contrairement à App-v1 : un manager lisant sa décision Tempo depuis Brief voyait donc moins d'information que depuis l'accueil, sans raison. `nexus-tempo.js` gagne deux fonctions pures, `calculerConstatTempo(auditsCaisseRows, productsRows, estProduitAppelFn)` (pipeline agrégation → valorisation boutique → classement → seuils de confiance, y compris le seuil `-10 %` désormais `SEUILS.SEUIL_CONSTAT_TEMPO` au lieu d'une constante locale recopiée dans les deux pages) et `construireCandidatTempo(constatTempo)` (construction Décision → Pourquoi → Impact → Preuves → Limites, version complète avec `opportunites`). Les deux pages ne gardent que leur propre requête Supabase (glue, légitimement locale) et appellent ces fonctions pour tout le reste — Brief affiche désormais le même niveau de détail que l'accueil.

(3) "Succès à féliciter" (produit à la plus forte progression sur la paire de périodes comparables, base ≥ 50 € pour ne pas célébrer un pourcentage gonflé par un tout petit chiffre de départ) : `NEXUS-Cockpit-v2.html` (variable `MEILLEUR_SUCCES`, avec en prime `PRODUITS_EN_BAISSE`, calculés dans la même boucle) et `NEXUS-Brief-v1.html` (variable `meilleurSucces`, commentée "même détection que MEILLEUR_SUCCES du Cockpit") réimplémentaient la même boucle sur `rowsPaireActuelle`/`rowsPairePrecedente`. Nouvelle fonction pure `NexusConseiller.analyserEvolutionsPaire(rowsPaireActuelle, rowsPairePrecedente, options)`, retournant `{meilleurSucces, produitsEnBaisse}` en une seule passe — Cockpit consomme les deux champs, Brief ne garde que `meilleurSucces` (le second n'a jamais été affiché côté Brief).

Vérifié : `node --check` sur les 8 fichiers touchés (`nexus-conseiller.js`, `nexus-tempo.js`, `NEXUS-Missions-v1.html`, `NEXUS-Capital-v1.html`, `NEXUS-Produits-v1.html`, `NEXUS-App-v1.html`, `NEXUS-Brief-v1.html`, `NEXUS-Cockpit-v2.html`). Tests unitaires exécutés en Node sur les moteurs modifiés (pas seulement une relecture) : `NexusConseiller.calculerCandidatsProduits` re-testé sur un jeu de lignes synthétique couvrant les 3 règles simultanément (R4/R3/R2 tous déclenchés, seuils exposés vérifiés égaux à 0.15/0.20/-0.30) ; `NexusConseiller.analyserEvolutionsPaire` vérifié sur le même jeu (meilleur succès et produit en baisse corrects) ; `NexusTempo.calculerConstatTempo`/`construireCandidatTempo` exécutés sur 5 semaines d'`audits_caisse` synthétiques avec un jeudi valorisé plus haut et un vendredi gonflé par un produit d'appel — le candidat produit reproduit exactement l'exemple travaillé par Frédéric (jeudi retenu, "pourquoi pas le vendredi" explicité) ET confirme que le champ `opportunites`, absent du bug historique de Brief, est désormais bien présent.

Dette documentée, non traitée dans ce lot (impact jugé MOYEN/FAIBLE par la cartographie, à reprendre si Frédéric le souhaite) : trois variantes visuellement divergentes de `fmtPct` coexistent (`Tempo/App/Brief/Campagne` avec signe+virgule, `Rayon/Produits` sans signe avec point, `Verify/FDJ-Analyse` via `toLocaleString`) — une même variation peut donc s'afficher différemment selon l'écran, sans qu'aucun moteur de formatage commun n'existe encore ; `fmtEuros` (`NEXUS-Inventaire-Manager-v1.html`) et `fmtDate`/`fmtDateFr` (`NEXUS-Import-v1.html`) restent des implémentations locales isolées ; `fmtL` (litrage) dupliqué à l'identique entre `NEXUS-Carburants-v1.html` et `NEXUS-Carburants-Pilotage-v1.html` sans export dédié dans `nexus-carburant-moteur.js` ; la formule d'évolution `(actuel-precedent)/precedent` est réécrite localement dans `NEXUS-FDJ-Analyse-v1.html::evolution()` (page qui ne charge pas `nexus-periodes.js`) et une troisième fois dans `NEXUS-Capital-v1.html::calculerDelta()`, plutôt que d'utiliser `NexusPeriodes.evolutionAgregee`. Priorités de l'audit également non traitées dans ce lot, à trancher séparément avec Frédéric : dé-Vito-isation du cœur (aucune dépendance résiduelle au site pilote), durcissement du repli métier silencieux vers `'station-service'` dans `secteursActifsSite()`, refactoring des pages monolithiques (APP/Inventaire Manager/FDJ Analyse/Brief/Cockpit), audit systématique anti-risque-ERP module par module. |

| v2.38 | 11/08/2026 | DÉ-VITO-ISATION DU CŒUR — suite immédiate de la v2.37, demande explicite de Frédéric ("de vito isation du coeur") parmi les priorités restantes de l'audit "philosophie/architecture". Cartographie (grep exhaustif sur les ~50 pages HTML + moteurs partagés) : 118 occurrences du littéral `'vito-sainte-marie'` dans 44 fichiers, réductibles à 3 formes strictement uniformes — (A) `employee.site_id || 'vito-sainte-marie'` / `employeeCourant.site_id || 'vito-sainte-marie'` (89 occurrences, 25 fichiers) : repli silencieux vers le site pilote dès que `site_id` serait absent d'un employé authentifié ; (B) `let SITE_ACTUEL/SITE_ID/SITE_HOME/siteId = 'vito-sainte-marie';` (24 occurrences, 24 fichiers) : valeur de placeholder avant connexion, documentée dans plusieurs fichiers par le commentaire "écrasé par employee.site_id une fois connecté" — donc jamais réellement utilisée en pratique, mais un piège textuel si l'écrasement était un jour oublié ; (C) `.eq('site', site || 'vito-sainte-marie')` / `.eq('site', siteId || 'vito-sainte-marie')` (2 occurrences, `NEXUS-Inventaire-v1.html` et `NEXUS-Inventaire-Manager-v1.html`) : même repli via une variable locale intermédiaire. Deux occurrences volontairement laissées en l'état (`NEXUS-API-v1.html` et sa copie) : exemple de payload JSON dans la documentation de l'API, texte illustratif sans logique — un exemple concret plutôt qu'un placeholder générique n'est pas un risque. Non traité dans ce lot, périmètre distinct explicitement signalé par l'audit et par Frédéric lors du choix de priorité (v2.37) : le texte de marque cosmétique "Vito Sainte-Marie (Usine)" dans les `<footer>`/en-têtes d'une trentaine de pages (aucun risque de routage — juste un nom affiché, déjà partiellement dynamique sur l'accueil via `chargerMarqueSite()`), le repli `station-service` de `secteursActifsSite()`, les commentaires de code mentionnant le tarif réel de Vito dans `NEXUS-Capital-v1.html`.

Correctif racine (Article 11 — un seul point d'entrée authentifié pour toute la suite) dans `nexus-auth.js::nexusRequireAuth()` : nouvelle garde immédiatement après le chargement de l'employé — `if (!employee.site_id) { ...déconnexion, redirection vers login avec `?erreur=site_manquant`, return null }`. Avant ce correctif, un compte employé mal configuré (site_id NULL) aurait silencieusement vu et modifié les données de Vito Sainte-Marie via les 89 replis Pattern A ; désormais, `nexusRequireAuth()` ne renvoie jamais un employé sans site_id, donc toute page authentifiée peut lire `employee.site_id` directement, sans jamais avoir besoin (ni le droit) de deviner un site par défaut. Le repli local resté dans `nexus-auth.js::nexusPointageArriveeManquant()` (`const siteId = employee.site_id || 'vito-sainte-marie'`) devient `const siteId = employee.site_id` pour la même raison.

Sweep mécanique sur les 42 fichiers restants (44 fichiers cartographiés moins les 2 exemples de documentation laissés en l'état) : Pattern A supprimé partout (`X.site_id || 'vito-sainte-marie'` → `X.site_id`, sûr désormais que `nexusRequireAuth()` garantit `site_id`) ; Pattern B remplacé par `let VAR = null;` avec commentaire explicite ("jamais 'vito-sainte-marie' par défaut — toujours écrasé par employee.site_id après nexusRequireAuth()") plutôt qu'un simple retrait, pour que l'intention reste visible à la prochaine lecture ; Pattern C corrigé sur les 2 occurrences identifiées. Incident de méthode rencontré et corrigé pendant ce lot : un premier script d'automatisation du remplacement du Pattern B contenait une erreur de groupe d'expression régulière qui vidait le nom de variable (`let    = null;` au lieu de `let siteId = null;`) sur les fichiers traités avant qu'une erreur d'écriture sur `NEXUS-Rayon-v1.html` n'interrompe le script — 11 fichiers concernés, détectés par une recherche systématique (`grep -rn "let\s*= null;"`) et corrigés un par un avec le nom de variable exact retrouvé dans la cartographie initiale, avant de relancer un script corrigé pour le reste. Signalé ici en toute transparence (Article 5 — vérité avant certitude) : la vérification post-hoc (voir ci-dessous) est ce qui a permis de détecter et corriger cette erreur avant livraison, pas une absence d'erreur en cours de route.

Vérifié : recherche exhaustive confirmant zéro occurrence restante de `'vito-sainte-marie'` en dehors des 2 exemples de documentation assumés et des commentaires explicatifs ajoutés par ce lot ; recherche exhaustive confirmant zéro repli `.site_id ||` restant et zéro déclaration `let` à nom de variable vide ; `node --check` exécuté sur la totalité des 42 fichiers HTML (scripts extraits) et les 2 fichiers JS touchés (`nexus-auth.js`, `nexus-desktop.js`), zéro erreur de syntaxe. Non vérifié en conditions réelles faute d'un second site actif en base à ce jour (le seul moyen de tester réellement le nouveau blocage "site_id manquant" serait un compte employé délibérément mal configuré) — comportement validé par lecture de code et par le fait que `employee.site_id` est une colonne déjà renseignée pour tous les employés réels existants (aucun changement de comportement observable pour Vito Sainte-Marie elle-même). |

| v2.39 | 11/08/2026 | DURCISSEMENT DU REPLI MÉTIER SILENCIEUX — troisième et dernier des trois chantiers déférés lors du choix de priorité de la v2.37, demandé explicitement par Frédéric ("durcissement du repli metier silencieux") après la v2.38. Cible : `nexus-secteurs-catalogue.js::secteursActifsSite(site)`, seule fonction qui décide quels secteurs (Carburants, Commerce, Marge, FDJ, Opérations, Équipe) apparaissent dans Brief NEXUS. Avant correctif, elle retombait TOUJOURS et silencieusement sur le preset `station-service` dès que `site` était absent (site non chargé, erreur réseau, `site_id` invalide) ou que `type_commerce` était vide/inconnu — un manager d'un site mal configuré aurait vu les 6 secteurs d'une station-service sans jamais savoir que NEXUS avait deviné à sa place (violation directe de l'Article 5, "vérité avant certitude"). Pire : un `type_commerce` reconnu mais pas encore réellement outillé (ex. `boulangerie`, dont les presets sont documentés dans `SECTEURS_PRESET_METIER` mais dont aucun secteur n'a de constructeur dans `nexus-secteurs-moteur.js` ni d'entrée dans `SECTEURS_CATALOGUE`) produisait une liste vide sans jamais passer par le repli station-service — un Brief NEXUS silencieusement sans aucun secteur, sans explication à l'écran.

Correctif : `secteursActifsSite()` retourne désormais toujours `{ secteurs, statut, typeCommerce }` — jamais un simple tableau — avec 3 statuts explicites : `'ok'` (configuration reconnue et intégralement outillée), `'non_configure'` (site absent ou `type_commerce` non renseigné), `'metier_non_outille'` (`type_commerce` reconnu, ou secteurs personnalisés fournis, mais au moins un des secteurs demandés n'a pas d'entrée dans `SECTEURS_CATALOGUE`). Aucun des deux derniers statuts ne retombe plus sur station-service ; c'est à l'appelant d'afficher explicitement "configuration métier incomplète" plutôt que de laisser croire à une mesure réelle. Bug trouvé en testant ce correctif (Article 5 — transparence sur les erreurs de méthode, même auto-détectées) : la première version utilisait `if (!secteurs.length)` pour détecter un métier non outillé — mais le preset `boulangerie` (`['production', 'vente_boutique', 'marge', 'matieres_premieres', 'pertes_invendus', 'equipe']`) partage 2 de ses 6 ids avec le catalogue station-service (`marge`, `equipe`), donc le filtre produisait un tableau non vide de 2 secteurs et la fonction retournait `statut: 'ok'` — un Brief boulangerie aurait affiché 2 secteurs sur 6 comme si la configuration était complète, sans jamais signaler les 4 secteurs manquants. Corrigé en exigeant une couverture INTÉGRALE (`secteurs.length !== ids.length` ⇒ `'metier_non_outille'`) plutôt qu'un simple "au moins un secteur trouvé".

Câblage dans `NEXUS-Brief-v1.html` : le placeholder `SITE_SECTEURS_CONFIG = { type_commerce: 'station-service', secteurs: null }` (qui masquait le bug en pratique tant qu'aucun site non-station-service n'existait) est remplacé par `{ type_commerce: null, secteurs: null }` — plus aucune valeur par défaut suggérant un métier avant que le site réel ne soit chargé. `construireBrief()` vérifie `secteursCheck.statut` en toute première ligne, avant les ~15 requêtes réseau habituelles, et retourne `{ configurationIncomplete: { statut, typeCommerce } }` sans rien calculer si le statut n'est pas `'ok'` — le résultat du même appel est réutilisé pour construire les secteurs plus bas (`NexusSecteursMoteur.construireSecteurs(secteursCheck.secteurs, ...)`), jamais un second appel à `secteursActifsSite()` (Article 11). `renderBrief()` vérifie `BRIEF.configurationIncomplete` avant toute lecture de `BRIEF.axes`/`BRIEF.decisions`/etc. (qui n'existent pas dans ce cas) et remplace l'écran entier par une notice honnête différenciée : "type de commerce non configuré, contactez l'administrateur" si `'non_configure'`, ou "configuré pour le métier « X », mais NEXUS ne dispose pas encore des moteurs de calcul pour ce métier" si `'metier_non_outille'` — pattern de dégradation pleine page déjà établi ailleurs dans le code (`document.body.innerHTML` remplacé + `return` anticipé) plutôt qu'un rendu partiel qui risquerait de planter ou d'induire en erreur. `nexus-secteurs-moteur.js` : commentaire mis à jour au-dessus de `construireSecteurs()` pour refléter la nouvelle forme de retour de `secteursActifsSite()` (l'appelant doit désormais extraire `.secteurs` et vérifier `.statut === 'ok'` avant d'appeler `construireSecteurs()`) — aucun changement fonctionnel dans `construireSecteurs()` elle-même.

Vérifié : `node --check` sur `nexus-secteurs-catalogue.js`, `nexus-secteurs-moteur.js` et le script inline extrait de `NEXUS-Brief-v1.html`, zéro erreur de syntaxe. Suite de 10 tests unitaires Node (`require()` direct du fichier, sans mock) couvrant : site absent, `type_commerce` null, métier reconnu mais non outillé (`boulangerie`), `type_commerce` totalement inconnu, station-service (comportement inchangé, statut `'ok'`, 6 secteurs), override `secteurs` personnalisé valide, et override partiellement invalide (couvre précisément le bug de couverture partielle décrit ci-dessus) — tous passants. Relecture manuelle complète de `NEXUS-Brief-v1.html` confirmant l'ordre d'exécution : `SITE_SECTEURS_CONFIG` est renseigné depuis `sites.type_commerce`/`sites.secteurs` (ligne ~1545) avant le premier appel à `rafraichir()`/`construireBrief()`, et le commentaire existant au-dessus de l'appel à `construireSecteurs()` (qui référence explicitement `secteursActifsSite(SITE_SECTEURS_CONFIG)`) reste exact après le changement — pas de mise à jour nécessaire. Non vérifié en conditions réelles faute d'un second site non-station-service actif en base à ce jour ; comportement pour Vito Sainte-Marie elle-même inchangé (`type_commerce = 'station-service'`, statut `'ok'`, 6 secteurs, dans le même ordre qu'avant ce correctif). Avec ce lot, les 3 chantiers déférés lors du choix de priorité de la v2.37 (centralisation, dé-Vito-isation, durcissement du repli métier) sont tous traités ; restent la dette technique mineure documentée en v2.37 (variantes `fmtPct`/`fmtEuros`/`fmtDateFr`/`fmtL`, formules d'évolution dupliquées FDJ-Analyse/Capital) et le texte de marque cosmétique + les commentaires de tarif Vito explicitement laissés hors périmètre en v2.38. |

| v2.40 | 11/08/2026 | REFACTORING DES PAGES MONOLITHIQUES — dernier des 3 chantiers déférés lors du choix de priorité de la v2.37, demandé explicitement par Frédéric ("refactoring des pages monolithiques") après la v2.39. L'audit "philosophie/architecture" cible nommément 5 pages : APP/Inventaire Manager/FDJ Analyse/Brief/Cockpit (1500 à 2600 lignes chacune, tout inline — affichage, requêtes Supabase et logique de décision mélangés dans un seul `<script>`). Avant de lancer un chantier sur les 5, Frédéric a défini précisément ce qu'il entend par "refactoring" pour NEXUS, en substance : conserver exactement le comportement fonctionnel et visuel validé (pas de refonte d'interface, pas de réécriture, pas de nouvelle fonctionnalité) ; séparer progressivement une page en 3 couches — un service qui récupère les données, un moteur qui calcule, une page qui affiche ; une règle métier ne doit exister qu'à un seul endroit, consommée identiquement par tous les écrans qui en ont besoin ; procéder page par page, en vérifiant l'équivalence avant/après à chaque étape plutôt qu'en un seul chantier massif. Ce lot traite **NEXUS-Brief-v1.html en page pilote** (choisi par Frédéric — la page la plus récemment retravaillée dans cette session, donc la mieux connue) ; les 4 autres pages restent à traiter séparément si l'approche tient la route.

Cartographie préalable de NEXUS-Brief-v1.html (1559 lignes) : le fichier respecte déjà largement l'esprit de l'Article 11 côté CALCUL — quasiment tous les moteurs (produits R2/R3/R4, Tempo, secteurs, marge, stock, FDJ, Coach FDJ, carburants, boussole) sont déjà délégués à des fichiers partagés, sans recalcul local. Ce qui restait mélangé à l'affichage, c'était la couche ACCÈS AUX DONNÉES : 20 fonctions de chargement Supabase (~360 lignes, avant `construireBrief()`), certaines explicitement commentées "reprises à l'identique de NEXUS-App-v1.html et NEXUS-Cockpit-v2.html" — un aveu de duplication déjà présent dans le code avant ce lot.

Nouveau fichier `nexus-brief-donnees.js` (service, sur le modèle exact de `nexus-carburant-donnees.js`/`nexus-coach-fdj-donnees.js` déjà en production) : regroupe les 20 chargeurs (`fetchAllRows`, `chargerProduitsAppel`, `estProduitAppel`, `chargerProducts`, `chargerMargePlus`, `chargerMessagesAdvisor`, `calculerStatutOperations`, `chargerConstatTempo`, `chargerCandidatsCaisse`, `chargerCandidatsStock`, `chargerCandidatsRappels`, `chargerDerniereReferenceFdj`, `chargerCarburantsBrief`, `chargerCandidatsFdj`, `chargerSeuilsCoachEquipeFdj`, `chargerCandidatsCoachEquipe`, `chargerDomaineEquipe`, `chargerAlertesInventaireOuvertes`, `chargerControlesVerifyRestants`, `chargerMissionsRestantes`, `chargerJournalDecisions`), exportés via `global.NexusBriefDonnees`. Chaque fonction reçoit désormais `client`/`siteId` en paramètres explicites plutôt que de fermer sur les variables module-level de Brief (`nexusClient`/`SITE_ACTUEL`) — un chargeur ne doit dépendre que de ce qu'on lui donne. Changement de contrat assumé sur un seul point : `chargerJournalDecisions()` modifiait auparavant deux variables de Brief par effet de bord (`JOURNAL_DECISIONS`/`VALIDEES_SITE`) ; la version du service retourne désormais `{ journal, validees }`, et c'est Brief qui décide quoi faire du résultat — un service récupère les données, il ne décide pas de l'état de la page qui l'appelle. `NEXUS-Brief-v1.html` ne garde qu'un alias local pour cette seule fonction (pour assigner son propre état) et pour `construireCandidatTempo` (déjà un alias direct vers `NexusTempo`, inchangé) ; les 18 autres chargeurs sont appelés directement `NexusBriefDonnees.xxx(nexusClient, SITE_ACTUEL, ...)` depuis `construireBrief()`, sans indirection locale. Résultat : `NEXUS-Brief-v1.html` passe de 1559 à 1244 lignes (-20 %), et ne contient plus que la garde de configuration métier, l'orchestration (`construireBrief()`), l'affichage (`renderXxx()`) et les actions utilisateur (valider une décision, marquer un rappel fait, etc.).

Écart de comportement identifié et VOLONTAIREMENT PRÉSERVÉ À L'IDENTIQUE (Article 5 — transparence, pas de correction opportuniste hors périmètre) : `chargerDomaineEquipe()` ne filtre par aucun site (ni dans l'ancienne version locale, ni dans le service) — repris tel quel de l'existant, documenté explicitement dans le nouveau fichier pour que ça ne passe pas inaperçu à la prochaine lecture, à corriger séparément si Frédéric le souhaite.

Dette de duplication identifiée mais non éliminée dans ce lot (le pilote porte sur UNE page ; dédupliquer avec les pages sœurs appartient au chantier de CES pages) : `chargerCandidatsCaisse`/`chargerCandidatsStock`/`chargerCandidatsRappels` restent recopiées à l'identique dans `NEXUS-Cockpit-v2.html` ; `chargerMargePlus`/`chargerMessagesAdvisor`/`chargerConstatTempo` (partiellement, le calcul est déjà centralisé) restent recopiées dans `NEXUS-App-v1.html` (et `chargerMessagesAdvisor` une troisième fois dans `NEXUS-Centre-Intelligence-v1.html`) ; `fetchAllRows` reste dupliquée à l'identique dans 15 autres pages NEXUS. Ce sera directement réutilisable quand Cockpit et App passeront à leur tour en page pilote — la fonction déjà extraite ici n'aura qu'à être consommée, pas réécrite.

Vérifié : `node --check` sur `nexus-brief-donnees.js` et sur le script inline extrait de `NEXUS-Brief-v1.html`, zéro erreur de syntaxe. Recherche exhaustive confirmant zéro référence orpheline aux 20 fonctions déplacées dans `NEXUS-Brief-v1.html` (aucun appel bare restant, tout passe par `NexusBriefDonnees.xxx` ou par l'un des 2 alias conservés). Suite de 9 tests unitaires Node sur `nexus-brief-donnees.js` (mocks légers des moteurs partagés — aucun calcul métier n'est testé ici, seulement la glue Supabase et le passage des paramètres/retours) : pagination `fetchAllRows` sur plusieurs pages, exclusion des produits d'appel dans `chargerProducts`, forme de retour `{journal, validees}` de `chargerJournalDecisions`, absence confirmée de filtre site dans `chargerDomaineEquipe` (comportement préservé), et normalisation correctement appliquée par `chargerCandidatsCaisse`/`chargerCandidatsRappels` — tous passants. Non vérifié en conditions réelles (pas de test dans le navigateur avec Supabase live) ; le risque est jugé faible car chaque fonction a été déplacée verbatim (même requêtes, mêmes filtres, même ordre des `Promise.all`), avec substitution mécanique de `nexusClient`/`SITE_ACTUEL` par des paramètres explicites — pas de logique réécrite. Reste à faire, si Frédéric confirme que l'approche tient la route : appliquer le même traitement à Cockpit, APP, Inventaire Manager et FDJ Analyse (et, à cette occasion, éliminer la duplication cross-pages documentée ci-dessus plutôt que de la recopier une nouvelle fois dans les futurs services `nexus-cockpit-donnees.js`/`nexus-app-donnees.js`). |

| v2.41 | 11/08/2026 | REFACTORING DES PAGES MONOLITHIQUES — 2e page — suite immédiate de la v2.40, Frédéric ayant confirmé ("ok on continue") vouloir poursuivre l'approche pilote sur une 2e page. Choisie par cohérence directe avec la dette identifiée en v2.40 : `NEXUS-Cockpit-v2.html` partageait déjà, mot pour mot, 5 chargeurs avec `NEXUS-Brief-v1.html` (`fetchAllRows`, `chargerJournalDecisions`, `chargerCandidatsCaisse`, `chargerCandidatsStock`, `chargerCandidatsRappels`, plus un 6e motif quasi identique — le couple `products` + `produits_appel` — dupliqué une 3e fois dans `construirePlansAction()` sans même porter de nom de fonction dédié). Traiter Cockpit ensuite permettait de tester une variante du principe "un service récupère les données" que Brief seul n'avait pas encore vérifiée : que se passe-t-il quand DEUX pages ont réellement besoin du même chargeur, pas juste une ?

Réponse retenue : un nouveau fichier **`nexus-conseiller-donnees.js`** (sur le modèle de `nexus-carburant-donnees.js`/`nexus-coach-fdj-donnees.js`), réellement partagé entre les deux pages plutôt qu'un `nexus-cockpit-donnees.js` qui aurait simplement recopié une 2e fois ce que `nexus-brief-donnees.js` contenait déjà. Il exporte `global.NexusConseillerDonnees` avec `fetchAllRows`, `chargerProduitsAppel`, `chargerProduitsBrut` (products moins produits d'appel — la fonction que Cockpit n'avait jamais nommée), `chargerJournalDecisions`, `chargerCandidatsCaisse`, `chargerCandidatsStock`, `chargerCandidatsRappels`. `nexus-brief-donnees.js` est réécrit pour DÉLÉGUER à ce nouveau fichier plutôt que de garder ses propres copies : `chargerProducts`, `chargerJournalDecisions`, `chargerCandidatsCaisse`, `chargerCandidatsStock`, `chargerCandidatsRappels` y sont désormais des alias d'une ligne (`return global.NexusConseillerDonnees.xxx(client, siteId)`), et `chargerConstatTempo` appelle `NexusConseillerDonnees.fetchAllRows` au lieu d'une copie locale. Choix délibéré : GARDER ces noms et cette signature dans `NexusBriefDonnees` plutôt que de les supprimer et faire pointer `NEXUS-Brief-v1.html` directement vers `NexusConseillerDonnees` — **zéro changement d'appel nécessaire dans `construireBrief()`**, déjà vérifié et livré en v2.40 ; seul un nouveau `<script src="nexus-conseiller-donnees.js">` est ajouté (avant `nexus-brief-donnees.js`). `NEXUS-Cockpit-v2.html`, lui, appelle directement `NexusConseillerDonnees.xxx(nexusClient, SITE_ACTUEL)` sans indirection (pas de fichier `nexus-cockpit-donnees.js` séparé : Cockpit n'avait aucun chargeur qui lui soit propre et non déjà couvert par un moteur existant — sa seule dette, ces 6 chargeurs, était entièrement partagée avec Brief).

Écart de forme corrigé au passage, assumé et documenté : l'ancien `chargerCandidatsCaisse()` de Cockpit retournait un tableau normalisé nu, alors que celui de Brief retournait `{ raw, normalises }` (Brief compte les critiques sur `raw` pour le secteur Opérations). Le service partagé retourne désormais TOUJOURRS `{ raw, normalises }` (la forme la plus complète, un sur-ensemble strict) ; Cockpit a été mis à jour pour lire `.normalises` — comportement identique à avant, juste un niveau d'emboîtement en plus à l'endroit où Cockpit consomme le résultat. Aucun autre changement de comportement.

`NEXUS-Cockpit-v2.html` : suppression de `chargerProduitsAppel()` (le service `chargerProduitsBrut` fait le même Promise.all + filtre, remplace directement le bloc dupliqué en tête de `construirePlansAction()`) ; `marquerProduitAppel()`/`exclureAvecCommentaire()` restent en place (actions d'écriture propres à Cockpit, pas de la lecture — un chargeur `-donnees.js` ne fait jamais d'écriture, Article 11 appliqué à la lettre). Résultat : Cockpit passe de 1466 à 1395 lignes (-5 % — plus modeste que Brief, la majorité du fichier étant des `renderXxx()` d'affichage, hors périmètre de ce chantier).

Vérifié : `node --check` sur `nexus-conseiller-donnees.js`, `nexus-brief-donnees.js` (réécrit), et les scripts inline extraits de `NEXUS-Brief-v1.html` et `NEXUS-Cockpit-v2.html` — zéro erreur de syntaxe. Recherche exhaustive confirmant zéro référence orpheline aux fonctions déplacées dans les deux pages HTML. 10 tests unitaires Node (mocks légers des moteurs de calcul, comme en v2.40) chargeant cette fois les VRAIS fichiers (pas des mocks du service lui-même) pour vérifier la chaîne de délégation réelle : pagination, exclusion des produits d'appel, forme `{journal, validees}`/`{raw, normalises}`, et — spécifiquement — que `NexusBriefDonnees.chargerProducts/chargerJournalDecisions/chargerCandidatsCaisse` délèguent bien à `NexusConseillerDonnees` et produisent le même résultat qu'un appel direct ; absence de filtre site dans `chargerDomaineEquipe` reconfirmée inchangée. Tous passants. Non vérifié en conditions réelles (pas de test navigateur/Supabase live) — risque jugé faible pour la même raison qu'en v2.40 (déplacement mécanique, aucune requête ni logique réécrite, seule la forme de retour de `chargerCandidatsCaisse` a changé et a été spécifiquement testée des deux côtés). Dette de duplication restante inchangée par ce lot : `chargerMargePlus`/`chargerMessagesAdvisor`/`chargerConstatTempo` (partiel) toujours recopiées dans `NEXUS-App-v1.html`, `chargerMessagesAdvisor` une 3e fois dans `NEXUS-Centre-Intelligence-v1.html`, `fetchAllRows` toujours dupliquée dans 13 autres pages NEXUS (15 moins Brief et Cockpit désormais traités) — à reprendre quand App passera à son tour en refactoring pilote. Reste des 5 pages ciblées par l'audit : Inventaire Manager et FDJ Analyse, non commencées. |

| v2.42 | 11/08/2026 | REFACTORING DES PAGES MONOLITHIQUES — 3e page — suite de la v2.41, Frédéric ayant confirmé ("continue") vouloir poursuivre. Page traitée : `NEXUS-App-v1.html` (2586 lignes avant ce lot — la plus grosse des 5 pages ciblées par l'audit, celle de l'écran d'accueil "Votre entreprise aujourd'hui"). Cartographie : 11 chargeurs identifiés (`fetchAllRowsHome`, `calculerCandidatsHome`, `chargerValideesHome`, `chargerDomainesRadarHome`, `chargerControlesVerifyHome`, `chargerStatutCarburantsHome`, `chargerAlertesFdjNonVuesHome`, `chargerMargePlusHome`, `chargerMessagesAdvisorHome`, `estProduitAppelHome`, `chargerConstatTempoHome`), 5 d'entre eux strictement identiques à leur équivalent déjà présent dans `nexus-brief-donnees.js` (`fetchAllRowsHome`≡`fetchAllRows`, `chargerControlesVerifyHome`≡`chargerControlesVerifyRestants`, `chargerMessagesAdvisorHome`≡`chargerMessagesAdvisor`, `estProduitAppelHome`≡`estProduitAppel`, `chargerConstatTempoHome`≡`chargerConstatTempo`) — repérés dès la v2.40/v2.41 comme dette à traiter "quand App passera à son tour en refactoring pilote".

Ces 5 fonctions rejoignent **`nexus-conseiller-donnees.js`** (déjà partagé Brief+Cockpit depuis la v2.41), qui devient ainsi partagé sur 3 pages. `nexus-brief-donnees.js` est mis à jour une seconde fois : `chargerMessagesAdvisor`, `calculerStatutOperations` et `chargerConstatTempo` deviennent à leur tour des alias d'une ligne vers `NexusConseillerDonnees` (ils ne l'étaient pas encore en v2.41, faute d'avoir identifié le doublon avec App avant cette cartographie) ; `chargerControlesVerifyRestants` et `estProduitAppel` de même. Une fois de plus, **zéro changement d'appel dans `construireBrief()`** — la façade `NexusBriefDonnees` garde exactement les mêmes noms et signatures.

Nouveau fichier **`nexus-app-donnees.js`** pour les 6 chargeurs restants, propres à l'accueil et sans équivalent ailleurs : `calculerCandidatsHome`, `chargerValideesHome` (variante allégée de `chargerJournalDecisions` — seulement les `candidate_id`, pas les lignes complètes, l'accueil n'affichant pas de journal), `chargerDomainesRadarHome`, `chargerStatutCarburantsHome`, `chargerAlertesFdjNonVuesHome`, `chargerMargePlusHome`. `NEXUS-App-v1.html` appelle directement `NexusAppDonnees.xxx(nexusClient, SITE_HOME, ...)` et `NexusConseillerDonnees.xxx(nexusClient, SITE_HOME)` selon le cas, sans indirection locale (mêmes conventions que Cockpit en v2.41).

**Écart de comportement trouvé et délibérément NON unifié (Article 5 — transparence avant correction)** : `chargerMargePlusHome()` construit un `candidatTop` avec un champ `contexte` ("Comparaison faite uniquement entre produits économiquement comparables.") que `NEXUS-Brief-v1.html::chargerMargePlus` n'a jamais eu — les deux fonctions avaient divergé avant ce refactoring sans que personne ne le remarque, exactement le risque que l'audit signale. Imposer la même forme aux deux aurait changé ce que l'une ou l'autre page affiche aujourd'hui à l'écran — exclu par la consigne explicite de Frédéric ("ne pas changer les calculs validés, ne pas casser les pages qui fonctionnent"). `chargerMargePlusHome()` reste donc une fonction séparée dans `nexus-app-donnees.js`, avec son `contexte` préservé, testé spécifiquement pour confirmer que l'écart persiste des deux côtés après ce lot — à trancher séparément si Frédéric confirme vouloir harmoniser l'affichage un jour. De la même façon, `chargerDomainesRadarHome()` (App) n'a jamais filtré ses requêtes par site — même anomalie préexistante que `chargerDomaineEquipe()` (Brief, déjà signalée en v2.40) — reprise à l'identique, non corrigée dans ce lot.

Résultat : `NEXUS-App-v1.html` passe de 2586 à 2315 lignes (-10 %). `nexus-conseiller-donnees.js` regroupe désormais 12 fonctions partagées entre 2 ou 3 pages selon le cas.

**Incident auto-détecté et corrigé pendant ce lot (Article 5 — transparence)** : en construisant ce lot, une commande `cp` a écrasé par erreur `nexus-conseiller-donnees.js` (déjà à jour dans le dossier projet, édité directement via l'outil `Edit`) avec une copie obsolète venant du dossier de brouillon (`outputs/`) — annulant temporairement les 5 nouvelles fonctions ajoutées et la forme `{raw, normalises}` de `chargerCandidatsCaisse` datant de la v2.41. Repéré immédiatement (avant toute livraison) via la relecture du contenu du fichier, corrigé en réécrivant le contenu correct complet dans le fichier du dossier projet, revérifié par `node --check` et par la suite de tests unitaires (tous passants après correction). Leçon retenue et appliquée depuis : ne plus jamais copier depuis `outputs/` vers le dossier projet pour un fichier déjà édité directement dans le dossier projet — le sens inverse (projet → outputs) reste sûr.

Vérifié : `node --check` sur `nexus-conseiller-donnees.js`, `nexus-brief-donnees.js`, `nexus-app-donnees.js`, et les scripts inline extraits de `NEXUS-Brief-v1.html`, `NEXUS-Cockpit-v2.html` et `NEXUS-App-v1.html` — zéro erreur de syntaxe sur les 3 pages, bien que seule App ait été modifiée dans ce lot précis (Brief et Cockpit revérifiés par précaution après la mise à jour de leur dépendance partagée). Recherche exhaustive confirmant zéro référence orpheline aux 11 fonctions déplacées dans `NEXUS-App-v1.html`. 18 tests unitaires Node chargeant les 3 vrais fichiers (mocks légers des moteurs de calcul uniquement) : fonctions pures (`estProduitAppel`, `calculerStatutOperations`), délégation Brief confirmée après la 2e vague de centralisation, `calculerCandidatsHome` (exclusion produits d'appel + facteurs), `chargerValideesHome` (Set de candidate_id), `chargerDomainesRadarHome` (absence de filtre site reconfirmée, devScore/equipeScore calculés), `chargerStatutCarburantsHome`/`chargerAlertesFdjNonVuesHome`, et surtout un test dédié confirmant que `chargerMargePlusHome` garde son champ `contexte` tandis que `NexusBriefDonnees.chargerMargePlus` continue de ne pas l'avoir — la preuve que l'écart trouvé n'a pas été silencieusement corrigé dans un sens ou dans l'autre. Tous passants. Non vérifié en conditions réelles (pas de test navigateur/Supabase live) — risque jugé faible, même raisonnement qu'en v2.40/v2.41 (déplacement mécanique, aucune requête ni logique réécrite). Dette de duplication restante après ce lot : `chargerMessagesAdvisor` reste dupliquée une 3e fois dans `NEXUS-Centre-Intelligence-v1.html` (non traité) ; `fetchAllRows` reste dupliquée dans 12 autres pages NEXUS (15 moins Brief/Cockpit/App désormais traités). Reste des 5 pages ciblées par l'audit : Inventaire Manager et FDJ Analyse, non commencées. |
| v2.43 | 11/08/2026 | REFACTORING DES PAGES MONOLITHIQUES — 4e page — suite de la v2.42, Frédéric ayant confirmé ("continue") vouloir poursuivre. Page traitée : `NEXUS-Inventaire-Manager-v1.html` (2634 lignes avant ce lot — la plus grosse des 5 pages ciblées par l'audit). Cartographie : contrairement à Brief/Cockpit/App, qui partagent tous le même « Conseiller cross-moteurs » (produits, caisse, stock, rappels, FDJ, tempo…), cette page couvre un domaine à part — le comptage/contrôle d'inventaire par quart (ouverture/clôture, alertes d'écart, revues de période) — sans recoupement significatif avec `nexus-conseiller-donnees.js`. Un seul nom de fonction identique trouvé ailleurs dans NEXUS : `chargerModeJaugeageActif`, également présent dans `NEXUS-Inventaire-v1.html` (écran employé) — non centralisé dans ce lot car les deux pages l'appellent dans des contextes différents (employé vs manager) et l'audit ne cible pas `NEXUS-Inventaire-v1.html`.

21 fonctions de lecture pure (SELECT/RPC, chacune vérifiée individuellement pour l'absence d'insert/update/upsert/delete avant extraction) regroupées dans un nouveau fichier **`nexus-inventaire-manager-donnees.js`**, propre à cette page (pas de partage cross-pages comme pour `nexus-conseiller-donnees.js`, faute de duplication réelle trouvée) : `quartDuMoment`, `chargerQuart`, `chargerAlertesOuvertesQuart`, `chargerComptagesQuart`, `chargerProduitsSensibles`, `chargerTousProduitsActifsSite`, `chargerHorairesStation`, `chargerParametresInventaire`, `chargerCategoriesSite`, `chargerDecisionsQuart`, `chargerAlertesOuvertesPeriode`, `chargerDecisionsPeriode`, `chargerReviewPeriode`, `chargerEmployesSite`, `chargerModesAveugleActifs`, `chargerModeJaugeageActif`, `chargerHistoriqueEcartsRecents`, `chargerCatalogueProduitsPourVentes`, `chargerCategoriesProduitsParId`, `chargerComptageActuel`, `chargerImpactCorrection`. `NEXUS-Inventaire-Manager-v1.html` garde les 21 noms de fonction d'origine comme délégués d'une ligne (`return NexusInventaireManagerDonnees.xxx(nexusClient, ...)`) — **zéro changement d'appel** dans le reste de la page (`chargerEtAfficherTout()`, `construirePlansAction()` équivalent, écrans Paramètres/Correction/Review), même schéma alias que les 3 pages précédentes.

Détail signature notable : `chargerParametresInventaire(client, site, defaults)` reçoit la constante `DEFAULTS_PARAMETRES_INVENTAIRE` de la page en 3e paramètre explicite plutôt que d'en garder une copie dans le fichier partagé — cette constante sert aussi à l'état local `parametresInventaire` et à l'UI Paramètres, la dupliquer aurait recréé exactement le risque de divergence que l'Article 11 interdit.

Restent volontairement dans la page (hors scope de ce lot, toutes identifiées et documentées en tête de `nexus-inventaire-manager-donnees.js`) : toutes les actions manager qui écrivent (`resoudreAlerte`, `resoudreAlerteSansRecharger`, `resoudreAvecNexus`, `validerToutesAlertes`, réouverture de clôture, `appliquerCorrectionRetroactive`, `toggleModeAveugle`, `toggleJaugeage`, `sauvegarderParametresInventaire`) ; le rapprochement des ventes Decenium (`parserFichierVentesDecenium`, `rapprocherLignesVentes`, `comparerVentesQuart`) et les calculs d'écoulement physique (`calculerEcoulementPhysiqueJournee`/`Quart`) — logique de calcul, pas de simple chargement, candidate à un futur moteur dédié si Frédéric le souhaite un jour, pas dans le périmètre "extraction de chargeurs" de ce chantier.

Résultat : les 21 chargeurs identifiés sont tous délégués ; la taille de `NEXUS-Inventaire-Manager-v1.html` ne baisse que marginalement (contrairement à Brief/App) car chaque délégué reste une fonction nommée d'une ligne plutôt qu'une suppression pure — cohérent avec le choix "zéro changement d'appel" déjà fait sur les 3 pages précédentes.

Vérifié : `node --check` sur `nexus-inventaire-manager-donnees.js` et sur le script inline extrait de `NEXUS-Inventaire-Manager-v1.html` — zéro erreur de syntaxe. Recherche exhaustive confirmant que les 21 fonctions gardent une définition unique dans la page (le wrapper local) et qu'aucun site d'appel ne référence directement `NexusInventaireManagerDonnees` en dehors des 21 délégués eux-mêmes. 28 tests unitaires Node chargeant le VRAI fichier `nexus-inventaire-manager-donnees.js` : logique horaire de `quartDuMoment` (matin/soir, avec et sans override de configuration station), construction des deux `Set` de `chargerComptagesQuart` (y compris le chemin d'erreur, qui doit retourner des `Set` vides et non `null`), fusion `defaults`/overrides de `chargerParametresInventaire` (avec confirmation que l'objet `defaults` reçu n'est pas muté), filtre manager/gérant exclu de `chargerEmployesSite`, booléen de `chargerModeJaugeageActif`, court-circuit et construction de map de `chargerCategoriesProduitsParId`, transmission des paramètres RPC de `chargerReviewPeriode`, et lecture directe des chargeurs restants. Tous passants (28/28). Les 3 suites de tests des lots précédents (v2.40 : 9, v2.41 : 10, v2.42 : 18) rejouées sans modification — toutes toujours passantes, confirmant l'absence de régression croisée. Non vérifié en conditions réelles (pas de test navigateur/Supabase live) — risque jugé faible, même raisonnement que les 3 lots précédents (déplacement mécanique, aucune requête ni logique réécrite, seule `client` a été ajoutée comme premier paramètre explicite). Dette identifiée et non traitée dans ce lot : `chargerModeJaugeageActif` reste dupliquée (à l'identique) avec `NEXUS-Inventaire-v1.html` — candidate à centralisation si cette page est un jour incluse dans un futur lot. Reste de la 5e et dernière page ciblée par l'audit : `NEXUS-FDJ-Analyse-v1.html`, non commencée. |

Prochaine révision suggérée : après vérification des sections héritées (§5) et des deux chantiers
au statut inconnu (§4 — Anomalie stock, Capacité de réassort). Côté FDJ : figer les formules de
rotation et d'autonomie au moment de construire la Phase C (page Analyse).
