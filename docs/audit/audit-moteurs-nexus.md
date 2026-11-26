# Audit des moteurs NEXUS — un calcul, une voix

> **Statut : brouillon, document seul.** Aucun code, aucune migration, rien en Production.
> Branche `claude/audit-moteurs`, coupée de `production`. Les numéros de ligne sont ceux de `origin/production` au moment de la lecture.
> Demandé par Guardian (#383, commentaire 7200307889), après le visa de la maquette Brief v4.
> **Aucun accès Production** : tout ce qui suit vient de la lecture du code. Les vérifications de données sont listées en fin de document (§ Vérifications), à faire exécuter par le gérant via Guardian.

## Avancement

| Étape | Contenu | Statut |
|---|---|---|
| 1 | Marge (R5) · Boussole · Secteurs (6) | fait |
| 2 | Rapport A4 (données et moteur) | fait (lecture partielle, voir §3) |
| 3 | Risques · Conseiller · Décisions prioritaires | à faire |
| 4 | Courbes 40 jours · histogramme · objectifs · potentiel | à faire |
| 5 | Périmètre 2 (écrans qui montrent la même grandeur) · synthèse · vérifications | à faire |

## Légende des fiches

Chaque indicateur : **autorité** (moteur, fonction, fichier:ligne) · **formule** · **source** · **périmètre station** (filtre explicite ou RLS seule) · **période et fuseau** · **seuils et constantes** · **limites connues** · **consommateurs** · **doublons**.

---

## 1. Marge R5 — écarts de marge entre pairs (`nexus-marge.js`)

### 1.1 Écart de marge d'un article

- **Autorité** : `detecterEcartsMarge`, `nexus-marge.js:156`. Préparation unique pour tous les consommateurs : `ecartsMargeDeLaPeriode`, `nexus-marge.js:200`.
- **Formule** : `margePct = marge / ca × 100` (si `ca > 0`). Médiane par groupe de famille. `écart = médiane − margePct`. Anomalie si `écart ≥ 10` points ; `gainPotentiel = écart / 100 × ca`.
- **Lignes retenues** : `ca > 0` et `0 ≤ marge ≤ ca`. Articles `produitsAppel` exclus.
- **Source** : lignes `products` (`categorie`, `article`, `ca`, `marge`, période) ; exclusions manuelles `marge_exceptions`.
- **Périmètre station** : **fonction pure, aucun filtre**. Le périmètre dépend de chaque appelant (voir consommateurs).
- **Période et fuseau** : aucun fuseau. La période est celle des lignes passées.
- **Constantes** : `SEUIL_ECART_POINTS = 10` (l.146), `TAILLE_MIN_GROUPE = 4` (l.147). Non recalibrées.
- **Familles** : `EXCEPTIONS` (l.47–100) = quatre familles (`tabac-reglemente`, `gaz`, `presse-telephonie-cartes`, `tabac-par-quantite`) reconnues par **expressions régulières sur des libellés de catégorie en français**, « premier jet ». `familleMarge` (l.114) teste d'abord les exclusions manuelles.
- **Limites** :
  1. Un libellé de catégorie renommé à l'import sort silencieusement de sa famille.
  2. La médiane d'un groupe de 4 articles est fragile ; le seuil de 10 points est le même pour toutes les familles.
  3. Le drapeau `validee` exige une décision de même `candidate_id` **et** même période affichée (10 premiers caractères). Deux écrans qui n'affichent pas la même période ne voient pas la même chose validée.
- **Identité d'un candidat** : `idCandidatMarge = LIVE-R5-${categorie}|${article}`.
- **Doublons** : voir §2.3 (la référence 25 % de la Boussole n'est pas cette médiane).

### 1.2 Deux comptes de marge jamais fusionnés

`nbEcartsMargePlus` (pairs, période courante) et `signauxRisqueMarge` (historique propre de la catégorie, `NexusRisques`) sont **volontairement** affichés séparément. Ce n'est pas un doublon à supprimer, mais un point à expliquer au gérant : deux nombres de « marge à surveiller » peuvent coexister.

---

## 2. Boussole — mécanique de score (`nexus-boussole-moteur.js`)

### 2.1 Un score par secteur, trois lectures séparées

Pas de score global. Chaque secteur : `score = 50 + contribution performance + contribution maîtrise`, borné à 0–100 (`BUDGET_DIMENSION = 25` par dimension, `BUDGET_DIMENSION_UNIQUE = 50` quand une seule dimension existe, l.124–125 ; `scoreDimension` l.146, `assemblerScoreSecteur` l.150). Statut affiché : `statutMetier` (l.249), **pas** `statutDepuisScore` (l.166, hérité, plus appelé).

### 2.2 Constantes et formules

| Élément | Où | Valeur | Remarque |
|---|---|---|---|
| Évolution → score | `scoreDepuisEvolution` l.67 | `50 + évol × 250`, 0–100 | Pleine échelle |
| Marge → score | `scoreDepuisMarge` l.71 | `50 + (margeReelle − 0,25) × 100` | **Référence 25 % en dur** |
| Opérations → score | `scoreOperations` l.75 | `100 − (écart/15) × 50` | `SEUIL_ECART_OPERATIONS_EUR = 15` (l.32) |
| Risques → score | `scoreRisques` l.79 | `min(40, critiques×15) + min(20, alertes×4) + 20 si risqueStock + 20 si pertesR2` | |
| Maîtrise des écarts | `contributionMaitriseEcarts` l.178 | 0 → +10 ; ≤2 → −5 ; ≤5 → −15 ; sinon −25 | **Une seule échelle** pour les écarts Marge+ et les écarts de caisse FDJ |
| Statut commerce | `statutCommerce` l.38 | ±5 % d'évolution | |
| Équipe | `statutEquipe` l.49 | ≥90 / ≥70 | `SEUIL_MIN_POINTAGES_EQUIPE = 5` (l.33) |
| Risques | `statutRisques` l.55 | ≥70 / ≥40 | |
| Seaux | l.215–224 | `FRACTION_MAITRISE_MAUVAISE = 0,6`, `FRACTION_PERFORMANCE_MARQUEE = 0,4` | |
| Priorité de statut | `statutMetier` l.249 | maîtrise « mauvaise » → À corriger ; « mitigée » → À confirmer ; performance négative → À relancer ; positive → En progression ; sinon Sous contrôle ; « Données insuffisantes » si les deux inconnues | |

**Constantes provisoires jamais recalibrées** : ×250, référence 25 %, budgets ±25 / ±50, fractions 0,6 et 0,4, seuil 15 €, échelle de maîtrise +10/−5/−15/−25. Le code les déclare lui-même « PROVISOIRE, non recalibrée ».

### 2.3 Écart avec les décisions de Brief v4

La fiche v4 (§21.bis) fixe : **statut de la carte Marge = taux contre la cible** (règle `defaut`, sinon moyenne pondérée par le CA, sinon aucune). La Boussole compare à **25 % en dur**, valeur reprise dans le texte de détail affiché.
→ Écart visible assuré : deux cartes Marge peuvent donner deux verdicts. **Doublon n° 1 à traiter** (voir synthèse).

---

## 3. Secteurs (`nexus-secteurs-moteur.js`, `nexus-brief-donnees.js`)

Contrat commun `construireContratCommun` (l.674) : fraîcheur, repli, qualité ; `signaux`/`decisions`/`preuves` restent vides. Constructeurs : `CONSTRUCTEURS_SECTEUR` (l.621). Chargeurs : `nexus-brief-donnees.js`.

### 3.1 Carburants (l.170)

- **Performance** : évolution 7 jours × 250, bornée ±25.
- **Maîtrise** : aucun relevé → −10 ; `statutGlobalControle` « Sous contrôle » → +15, « À surveiller » → −10, sinon −25.
- **Fraîcheur** : modes `jour` / `repli` / `périmé` (périmé → « À actualiser », INSUFFISANT, au-delà de J-3).
- **Source** : `chargerCarburantsBrief` (l.155), `chargerCarburantsBriefAvecFallback` (l.309).
- **Limite** : la « date du jour » est l'UTC (`toISOString().slice(0,10)`, l.156, 166, 312).
- **Doublon probable** : `nexus-carburant-moteur.js` (1752 lignes), lu à l'étape 5.

### 3.2 Commerce (l.248)

- **Performance** : `scoreDepuisEvolution` pleine échelle, **budget ±50** (contre ±25 ailleurs). Maîtrise : « inconnue ». « En repli » → « À relancer ».
- **Source** : `facteurs.evolutionReelle` = CA contre période comparable précédente.
- **Arbitrage commerce** : `audits_caisse.vente_boutique` pour le suivi d'activité, périodes importées (`products`) pour l'analyse.
- **Écart de définition** : Carburants et FDJ mesurent un volume sur 7 jours glissants ; Commerce mesure un CA sur « période comparable ». Deux horizons différents sous le même mot « évolution ».

### 3.3 Marge (l.329)

- **Performance** : `clamp((margeReelle − 0,25) × 100)` à ±25 — référence 25 % en dur, écrite dans le texte.
- **Maîtrise** : `contributionMaitriseEcarts(nbEcarts)`.
- **Synthèse du frein** : `construireSyntheseFreinMarge` (l.300).
- **Voir** §1 et §2.3.

### 3.4 FDJ (l.386)

- **Performance** : `clamp(evolutionCa 7 j × 250)`. **Maîtrise** : `contributionMaitriseEcarts(nbEcarts)` appliquée aux écarts de **caisse** FDJ (même échelle que les écarts de marge, mais ce sont des euros de caisse, pas des points de marge).
- **Seuil dupliqué** : `SEUIL_FDJ_EVOLUTION = 0,15` (l.371), copié de `nexus-fdj-moteur.js` (règles FDJ-JOUR-RECUL / FDJ-CROISSANCE). Une valeur, deux fichiers.
- **Exige** `nbQuartsControles`. Fraîcheur : mêmes modes que Carburants.
- **Source** : `chargerCandidatsFdj` (l.407) ; vues filtrées `.eq('site', …)`.

### 3.5 Opérations (l.450)

- **Maîtrise seule** : `scoreOperations` → `clampContributionPleine(score − 50)`. Performance nulle.
- **Âge du dernier contrôle** : jours calendaires **UTC** (`new Date().toISOString()`), pas le fuseau de la station (choix documenté « Article 11 », identique à `aujourdHuiISO()` de `nexus-tempo.js`).
- **Moyenne glissante** sur tout l'historique exploitable, **hors aujourd'hui** : le résultat dépend de l'usage de Verify.
- **Source** : `chargerControlesVerifyRestants` (l.712), `chargerAlertesInventaireOuvertes` (l.688), `…Critiques…` (l.706), `chargerMissionsRestantes` (l.716, `mission_completions` filtré par `site_id`, date = **UTC du jour**).

### 3.6 Équipe (l.562)

- **Mesure suffisante** si `totalPointages ≥ seuilMinPointages (5)`. Maîtrise = `clampContributionPleine(equipeScore − 50)`, performance nulle.
- **Score** : `equipeScore = round(max(0, 100 − taux × 200))`, taux = retards / arrivées mesurées sur 7 jours, comparé aux 7 précédents. Récurrence : ≥ 3 retards (`employesASurveiller`). Portée (`classifierPorteeEquipe`, l.532) : collectif si ≥ 2 récurrents ; `recurrence_individuelle` ; `incident_individuel` ; `incidents_isoles`.
- **⚠ Constat de périmètre — confirmé par lecture** : `chargerDomaineEquipe` (`nexus-brief-donnees.js:618`) interroge `pointages` **sans aucun filtre `site`** (5 requêtes, l.633–647). Le code l'écrit lui-même : « cette fonction ne filtre par aucun site ». La séparation entre stations repose **uniquement sur la RLS**. De plus la portée et `employesASurveiller` sont mesurés sur **tout l'historique**, sans fenêtre.
- **Fuseau** : « aujourd'hui » = `new Date()` en UTC ; fenêtre construite par `setDate` puis `toISOString().slice(0,10)` — près de minuit, la fenêtre peut décaler d'un jour.
- **Doublon avéré** : le rapport A4 calcule la ponctualité **filtrée par site et par période** (§4.3). Même grandeur, deux périmètres, deux résultats possibles.

### 3.7 Constats transversaux de cette étape

1. `0,15` (contribution stratégique) est écrit deux fois : `nexus-secteurs-moteur.js` et `nexus-conseiller.js` (R4-RENFORT-A, « repris à l'identique »).
2. « Aujourd'hui » en UTC dans 7 chargeurs de `nexus-brief-donnees.js` (l.156, 166, 312, 412, 547, 620, 717).
3. Requêtes avec filtre `site` explicite : `marge_exceptions`, `journal_decisions` (R5), `fdj_*`, `coach_daily_recommendations` (l.550–551), `inventaire_alertes` (l.689, 707). **Sans filtre** : `pointages` (ci-dessus).

---

## 4. Rapport A4 (`nexus-rapport-direction-*.js`)

Principe déclaré : « jamais une deuxième formule », le moteur recompose ce que les autres moteurs calculent. L'audit vérifie si c'est tenu.

### 4.1 Commerce et trajectoire

- **Commerce** : `chargerCommerceCategories(client, site)` (`nexus-rapport-direction-donnees.js:45`) charge **toutes** les lignes `products` du site (`.eq('site', site)`), puis laisse `NexusRayonMoteur` trouver la « période affichage ». **La période du chapitre n'est donc pas la période choisie par le gérant pour le rapport.** Le fichier le reconnaît (même limite pour `chargerCaPeriode`/`chargerMargePeriode`). Fuseau : `nexusFuseauSite(site)` — **fuseau de la station**, contrairement au Brief.
- **Trajectoire** : `chargerTrajectoire` (l.167) regroupe les blocs `products` par mois du **début de bloc** (`regrouperParMoisCalendaire`) ; un bloc à cheval n'est pas réparti au prorata. Évolution mois précédent, écart à la moyenne des 3 mois précédents, N-1 recherché dynamiquement. Seuil de commentaire ±2 %.
- **Contribution à la croissance** : `construireChapitreCommerce` — part du top 3 dans la croissance positive uniquement.

### 4.2 Marge, décisions

- `SEUIL_BRUIT_EFFET_MARGE_POINTS = 1` (`nexus-rapport-direction-moteur.js:697`) : en dessous d'un point, l'effet d'une décision est du bruit (`evaluerEffetDecisionMarge`, l.698). Constante propre au rapport, **distincte** du seuil de 10 points de R5.
- « Rentabilité sous pression » du rapport s'appuie sur les signaux qualifiés par `NexusRisques` (historique propre), non sur la médiane des pairs : cohérent avec la décision de ne pas fusionner les deux comptes (§1.2).

### 4.3 Opérations et Équipe

- **Opérations** (`chargerOperationsPeriode`, l.81) : Verify via `NexusVerifyMoteur.agregerAudits` (filtré site + période) ; Inventaire via le RPC `generate_inventory_review`, type `weekly` si période = semaine, **sinon `monthly`** pour trimestre/année/libre : limite connue, la synthèse d'inventaire d'un trimestre est demandée « mensuelle ».
- **Équipe** (`chargerEquipePeriode`, l.114) : ponctualité = 1 − retards/arrivées mesurées, **filtré par site et par période** ; missions = terminées / assignées (statuts `completed`, `termine`, `terminee`). Les arrivées à `retard_min` NULL comptent comme présence mais sortent des deux côtés du taux.
- **Écart avec §3.6** : Brief = tout l'historique, sans site ; rapport = période, avec site. Même mot « ponctualité », deux résultats.
- Tableau de bord : le champ `ecarts` de FDJ est écrit `(cond) ? null : null` (`construireTableauDeBord`) — **toujours nul**, quel que soit le cas ; l'écart FDJ n'est donc jamais montré dans ce tableau. À confirmer côté rendu.

### 4.4 Non encore lu (étape 3)

`construireChapitreRisques` (l.456), `construireForces`, `construireAmeliorer`, `construireProjection`, `construireSuggestions`, `construirePriorites` (l.758), et `nexus-rapport-donnees.js` / `nexus-rapport-moteur.js`.

---

## Vérifications de données (à exécuter par le gérant, lecture seule, filtrées par station)

À compléter à l'étape 5. Premières demandes, déjà justifiées par cette étape :

| # | Question | Requête (lecture seule) | Résultat attendu |
|---|---|---|---|
| V1 | `pointages` : le compte vu par le Brief est-il limité à la station ? | `select site, count(*) from pointages where type='arrivee' and date >= current_date - 6 group by site` exécuté **avec le rôle d'un gérant d'une seule station** | Une seule ligne `site` |
| V2 | Les familles de marge sont-elles toujours reconnues ? | pour la station : `select distinct categorie from products where site = :site` | Chaque libellé réel des quatre familles correspond à une expression de `EXCEPTIONS` |
| V3 | Le taux de marge « cible » existe-t-il ? | `select * from <table des règles de marge> where site = :site` (nom de table à confirmer à l'étape 5) | Une règle `defaut` ou aucune |

Aucune donnée réelle n'est à renvoyer sur le canal : seulement « conforme / non conforme » et les comptes.
