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
| 3 | Risques · Conseiller · Décisions prioritaires · fin du rapport A4 | fait (voir §5 à §7) |
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
- **Verdict V1 (Guardian, lecture seule Production)** : la règle RLS `select_pointages` donne à un employé ses seules lignes, à un manager ou gérant les lignes de son site, à un **créateur** toutes les stations où `acces_createur_autorise` est vrai. Sans filtre explicite, un compte créateur verrait des pointages de plusieurs stations mélangés, et un employé un « taux d'équipe » calculé sur ses seules arrivées. **Règle à retenir : le filtre `.eq('site', site)` doit être explicite, on ne s'en remet jamais à la RLS.** Sans effet visible aujourd'hui (aucun pointage depuis le 16/08, Équipe sort du Brief v4), mais vrai pour tout autre consommateur de `chargerDomaineEquipe`.
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
- Tableau de bord : le champ `ecarts` de FDJ est écrit `(cond) ? null : null` (`construireTableauDeBord`) — **toujours nul**, quel que soit le cas ; l'écart FDJ n'est donc jamais montré dans ce tableau. **Confirmé** : le rendu (`NEXUS-Rapport-v1.html:615–617`) ne lit que `ca` et `evolution` de `tb.fdj` ; `ecarts` est un champ mort, jamais affiché. Défaut réel : le tableau de bord du rapport ne dit rien des écarts de caisse FDJ, alors que la Boussole les compte dans la maîtrise (§2.2).

### 4.4 Fin du rapport A4 (lu à l'étape 3)

Le chapitre risques, « à améliorer », « priorités », la projection et les suggestions sont décrits en §7. Restent non lus : `nexus-rapport-donnees.js` et `nexus-rapport-moteur.js` (rapport hebdomadaire, hors rapport direction), repris à l'étape 5 avec le périmètre 2.

## 5. Signaux de risque (`nexus-risques-moteur.js`, `nexus-risques-donnees.js`)

Moteur pur (article 11). Un signal qualifié est un objet unique, stocké dans `nexus_risk_signals` (clé `site_id, cle_signal`). C'est la seule voix qui dit « risque avéré / exposition / signal faible / anomalie » ; le Brief, le Conseiller et le rapport A4 la lisent.

### 5.1 Niveau de gravité (`classifierNiveau`, l.171)

Quatre niveaux ordonnés : `anomalie < signal_faible < exposition < risque_avere`.

| Règle | Condition | Niveau |
|---|---|---|
| A | impact mesuré > 0 et (récurrence ≥ 5 ou impact ≥ 500 €) | risque avéré |
| B | impact potentiel ≥ 200 € | exposition |
| A2 | sévérité qualitative « majeure » | risque avéré |
| A2 | « significative » avec récurrence ≥ 5 | risque avéré |
| B2 | « significative » | exposition |
| C | récurrence ≥ 2 | signal faible |
| D | sinon | anomalie |

Constantes : `SEUIL_IMPACT_MESURE_MATERIEL_EUR = 500`, `SEUIL_IMPACT_POTENTIEL_SIGNIFICATIF_EUR = 200`, `SEUIL_RECURRENCE_SIGNAL_FAIBLE = 2`, `SEUIL_RECURRENCE_RISQUE_AVERE = 5`. Le code les dit calibrées sur des exemples donnés par Frédéric, « à ajuster une fois le pilote en usage réel » : **jamais recalibrées**. Confiance de l'échantillon (`niveauConfiance`, l.105) : ≥ 10 A, ≥ 5 B, ≥ 2 C, sinon D.

### 5.2 Urgence (`classifierUrgence`, l.469)

Seconde dimension, indépendante du niveau : exposition → immédiate ; risque avéré → moyenne si le signal est installé depuis ≥ 14 jours (`SEUIL_ANCIENNETE_INSTALLEE_JOURS`), sinon immédiate ; signal faible → moyenne ; anomalie → faible.

**Constat** : un risque avéré ancien devient « moyenne » alors qu'une simple exposition reste « immédiate ». Au tri « urgence puis niveau » du Brief (§6.3), une exposition passe donc **devant** un risque avéré installé depuis deux semaines. C'est voulu par la règle, mais le gérant lira « exposition » avant « risque avéré » sans comprendre pourquoi.

### 5.3 Qualificateurs

- **Caisse** (`qualifierEcartCaisse`, l.295) : impact = **somme nette** des écarts (`ecartCumule`) ; récurrence = nombre d'audits en anomalie ou critique ; échantillon = total d'audits. *Limite* : la somme est nette, un manque de 40 € et un excédent de 40 € se compensent à zéro. À vérifier en donnée (V4).
- **Marge d'une catégorie** (`qualifierMargeCategorie`, l.343) : compare la catégorie à **sa propre histoire** (moyenne des périodes précédentes), pas à la moyenne du magasin ni aux pairs (cohérent avec §1.2). CA « stable » si l'écart ≤ `seuilCaStablePct = 0,15` : impact **mesuré** = écart de points / 100 × CA actuel si le CA est stable, impact **potentiel** sinon. Récurrence = périodes historiques sous la moyenne, +1 si la période courante l'est.
- **Historique de marge** : assemblé de **deux façons** : `assemblerHistoriqueMargeCategorie` (l.411, en mémoire, 3 périodes, hors période courante et hors CA = 0) et `NexusRisquesDonnees.chargerHistoriqueMargeCategorie` (requête Supabase ciblée). Deux chemins pour une même histoire.
- **Ponctualité d'un collaborateur** (`qualifierPonctualiteCollaborateur`, `SEUIL_RETARDS_RECURRENTS = 3`, l.637) : ≥ 3 retards fixent la sévérité « majeure », donc **risque avéré immédiat sans aucun montant en euros**. Troisième version de la ponctualité (voir §3.6 et §4.3), même seuil de 3, périmètre encore différent (14 jours).

### 5.4 Source, périmètre, période (`nexus-risques-donnees.js`)

- Filtre de station **explicite** partout : `audits_caisse` (l.308, 325), `products` (l.554, 572), `pointages` (l.702, 708). Bon point, opposé au Brief (§3.6).
- Dates en **UTC** (l.305, 322, 625–626, 660, 700), alors que le chargeur du coach (`nexus-conseiller-donnees.js:204`) utilise le fuseau de la station (`NexusStation.dateLocaleStation`). Une même journée ne désigne pas le même jour selon l'écran, près de minuit.
- Commentaire l.690 : un possible décalage entre `site_id` et la colonne `site` de `pointages`. Non tranché dans le code (à vérifier, V5).

### 5.5 Consommateurs et doublons

Consommateurs : Brief (3 signaux max), Conseiller (candidats), rapport A4 (chapitre risques, « à améliorer »). **Doublon de rang** : le rapport A4 redéfinit `RANG_NIVEAU_LOCAL` (`construireAmeliorer`, l.559) au lieu d'utiliser `NexusRisques.RANG_NIVEAU`, et **ignore l'urgence** (§7.2).

---

## 6. Décisions prioritaires (`nexus-conseiller.js`, `nexus-conseiller-donnees.js`)

### 6.1 Principe

Chaque moteur métier propose des candidats (normaliseurs l.790–1112) ; `fusionnerEtSelectionner(listes, {n = 3, site})` (l.1171) en garde trois. Procédé : regroupement par moteur ; dans chaque moteur, tri par rang, puis **mélange au hasard à rang égal**, avec une graine du jour ; tour de table, un candidat par moteur, les moteurs classés par leur meilleur rang.

### 6.2 Graine du jour : UTC, pas la station

`genererGraineJour(site)` (l.1131) = site + `new Date().toISOString().slice(0,10)`. La graine change à 00:00 UTC, soit **01:00 ou 02:00 heure locale**. Entre minuit et 01:00/02:00, la sélection d'hier reste affichée ; et à rang égal, le choix change d'un jour à l'autre sans fait nouveau. `normaliserRappel` (l.1011) utilise aussi « aujourd'hui » UTC.

**Effet visible pour le gérant** : deux décisions de rang égal peuvent s'échanger d'un jour à l'autre sans que rien n'ait changé. Pas une faute de calcul, mais l'impression d'un outil qui se contredit.

### 6.3 Trois ordres différents pour « le plus important »

| Écran | Tri | Coupe |
|---|---|---|
| Brief, signaux de risque (`NEXUS-Brief-v1.html:670–680`) | urgence, puis niveau | 3 |
| Brief, décisions (l.963) | `fusionnerEtSelectionner`, rang par moteur | 3 |
| Rapport A4, « priorités » (`construirePriorites`, l.758) | **ordre d'insertion** (axes, marge, caisse, commerce), 5 premiers de « à améliorer » | 5 |

Un même problème peut être premier d'un côté et absent de l'autre : « priorité » n'a pas la même définition dans le Brief et dans le rapport (voir §7.2).

### 6.4 Constantes du Conseiller (l.197–231)

`SEUIL_CONTRIBUTION_FORTE = 0,15` (doublon de `nexus-secteurs-moteur.js`, 3e emplacement du 0,15 avec le CA stable de §5.3), `SEUIL_HAUSSE = 0,20`, `SEUIL_BAISSE = −0,30`, `SEUIL_VOLUME_CA_EUR = 50`, `DUREE_DORMANT_PERIODES = 2`, `DUREE_RELEVE_STOCK_JOURS = 30`, `SEUILS_RENTABILITE = {0,40 ; 0,25 ; 0,10}` (**3e emplacement du 25 %** : Boussole, `defaut` du Brief v4, ici), `SEUILS_ROTATION_JOURS`, `SEUILS_STOCK_JOURS`, `SEUILS_PRODUITS_MESURE`, `SEUILS_SCANNER_TARIFAIRE`. Aucune n'est indiquée comme recalibrée.

### 6.5 Chargeurs (`nexus-conseiller-donnees.js`)

Tous filtrés par station. Deux helpers sont **recopiés** de `nexus-brief-donnees.js` : `estProduitAppel` (l.129 ← l.56) et `calculerStatutOperations` (l.133 ← l.108). Deux copies d'une règle : l'une peut évoluer sans l'autre.

---

## 7. Fin du rapport A4 (`nexus-rapport-direction-moteur.js`, l.440–820)

### 7.1 Chapitre risques (`construireChapitreRisques`, l.456)

Sépare deux familles : `constatsSectoriels` (descriptifs, sans niveau de gravité NEXUS) et `signauxQualifies` (venus de `NexusRisques`). Les signaux sont triés par urgence puis niveau avec `NexusRisques.RANG_URGENCE` / `RANG_NIVEAU` (repli sur `{}` : sans le moteur, l'ordre devient stable mais non trié). **Pas de coupe à 3** : le Brief coupe à 3, le rapport montre tout. Compteurs : risque avéré, exposition, signal faible.

Les `constatsSectoriels` (écart cumulé Verify, valeur d'inventaire, marges « destructrices », écarts ouverts, comptages manquants, catégories en baisse, volume carburant < −5 %) **n'ont pas de niveau**, alors que le même sujet peut être qualifié « exposition » par `NexusRisques`. Le lecteur voit donc la même réalité en deux voix : « constat » d'un côté, « signal qualifié » de l'autre. La marge « destructrice » compare au **magasin** (période courante), le signal qualifié à l'**historique de la catégorie** : deux définitions de « marge qui se dégrade » dans un même chapitre.

### 7.2 « À améliorer » et « Priorités »

- `construireAmeliorer` (l.559) : au plus 5 éléments, dans l'ordre axes « en baisse », signaux de marge, caisse « récurrente » (anomalie + critique sur le total), pire catégorie du commerce si < −5 %. Tri de marge via `RANG_NIVEAU_LOCAL` (risque avéré 2, exposition 1, signal faible 0) : **ignore l'urgence**.
- `construirePriorites` (l.758) : prend les **5 premiers** de « à améliorer » et les renumérote. **Une priorité n'est donc ni un classement par gravité, ni par urgence** : c'est un préfixe d'une liste construite par rubrique. Un risque avéré de caisse, rangé après trois axes en baisse, peut sortir de la liste (la coupe à 5 s'applique avant renumérotation).

### 7.3 Projection (`construireProjection`, l.600)

Rythme = CA / jours écoulés × jours de la période. Scénario « moyenne » = moyenne des 3 derniers mois / 30 (approximation documentée). Scénario N-1 : toujours nul. **Horloge** : `dateReference || new Date()`, soit l'horloge de la machine, pas le fuseau de la station (le chapitre commerce, lui, utilise `nexusFuseauSite`). Près de minuit, jours écoulés et projection peuvent différer d'un jour entre la machine et la station.

### 7.4 Suggestions (`construireSuggestions`, l.634)

Au plus 5, règles fixes sur marge, carburant, FDJ (un seul jeu dominant) et Équipe. Constantes propres au rapport, non recalibrées. Les suggestions du rapport, les décisions du Conseiller et les priorités du rapport sont **trois listes d'actions** produites par trois chemins sans arbitre commun.

### 7.5 Constats de l'étape 3 (pour la synthèse)

1. Ponctualité en **trois** versions (Brief, A4, risques), seuil 3 partout (§3.6, §4.3, §5.3).
2. 25 % de marge à **trois** endroits (Boussole, Brief v4, `SEUILS_RENTABILITE`) ; 0,15 à **trois** endroits.
3. « Priorité » : trois ordres (§6.3) et `RANG_NIVEAU_LOCAL` dupliqué.
4. UTC contre fuseau de la station : chargeurs de risques, graine du Conseiller, rappel, projection A4 (machine).
5. Helpers recopiés Brief ↔ Conseiller ; historique de marge assemblé deux fois.
6. Constantes de risque 500 / 200 / 2 / 5 / 14 : provisoires, jamais recalibrées.
7. `ecarts` FDJ du tableau de bord : champ mort, confirmé (§4.3).
8. Qualité des libellés importés (V2) : deux libellés « tabac à rouler » avec encodage abîmé et double espace donnent deux catégories d'affichage ; à rattacher au moteur d'import (étape 5).

---

## Vérifications de données (lecture seule, filtrées par station)

Résultats communiqués par le Guardian le 26/11 (aucune donnée réelle sur le canal : conforme / non conforme).

| # | Question | Requête (lecture seule) | Attendu | Résultat |
|---|---|---|---|---|
| V1 | `pointages` : le compte vu par le Brief est-il limité à la station ? | `select site, count(*) from pointages where type='arrivee' and date >= current_date - 6 group by site`, avec chaque type de compte | Une seule ligne `site` | **Conforme** pour gérant et manager ; **non conforme** pour un compte créateur (RLS multi-stations) et pour un employé (ses seules lignes). Voir §3.6 |
| V2 | Les familles de marge sont-elles reconnues ? | `select distinct categorie from products where site = :site` passé dans `NexusMarge.familleMarge` | Familles réglementées toutes exclues | **Conforme**. Constat annexe : deux libellés « tabac à rouler » à l'encodage abîmé et au double espace, donc deux catégories d'affichage |
| V3 | Existe-t-il une cible de marge ? | `select * from tarif_seuils where site = :site` (vue `v_tarif_seuils_actifs`) | Règle `defaut` ou aucune | **Conforme : aucune ligne, pour aucune station.** La carte Marge du Brief v4 affichera « objectif à définir dans Produits » |

Demandes nouvelles, issues de l'étape 3 :

| # | Question | Requête (lecture seule) | Attendu |
|---|---|---|---|
| V4 | Les écarts de caisse se compensent-ils dans la somme nette ? | `select count(*) filter (where ecart > 0), count(*) filter (where ecart < 0), sum(ecart), sum(abs(ecart)) from audits_caisse where site = :site and date >= current_date - 30` | Si `sum(ecart)` est proche de 0 alors que `sum(abs(ecart))` est élevé, le signal de caisse sous-estime l'impact |
| V5 | `site_id` et `site` de `pointages` désignent-ils la même station ? | `select count(*) from pointages where site = :site and (site_id is null or site_id::text <> :site_id)` | 0 |
| V6 | Combien de signaux qualifiés par niveau et urgence ? | `select niveau, urgence, count(*) from nexus_risk_signals where site_id = :site group by 1,2` | Voir si des « risque avéré / moyenne » sont placés après des « exposition / immédiate » |
