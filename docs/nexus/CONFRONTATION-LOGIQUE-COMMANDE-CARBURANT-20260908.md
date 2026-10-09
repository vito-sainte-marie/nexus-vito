# Confrontation — logique de commande de Frédéric vs moteur Carburants et Bible

Date : 2026-09-08
Demandé par : Frédéric Bragance
Portée : **analyse seule**. Aucune règle métier modifiée, aucun code touché par ce document.
Sources confrontées : `nexus-carburant-commande-moteur.js` (1 906 lignes, issu du cahier
en 38 sections transmis par Frédéric le 24/08/2026), `nexus-carburant-moteur.js`,
`docs/nexus/BIBLE.md`, `NEXUS-Constitution-v1.md`.

## Résultat en une phrase

Le moteur suit déjà la logique décrite, souvent au mot près — parce qu'il a été construit
à partir du même cahier. Trois écarts réels subsistent, dont **un qui produit aujourd'hui
une recommandation physiquement impossible sur NEXUS Test**.

---

## 1. Jaugeage du matin → capacité de réception estimée

**Conforme.** Les deux formules du texte existent telles quelles :

- `stockPrevuLivraison` (l. 445) = `dernierStockFiable + livraisonsIntermediaires − ventesPrevuesJusquaLivraison`
- `capaciteDisponibleLivraison` (l. 453) = `limiteRemplissage − stockPrevuLivraisonL`

Le moteur travaille sur `limite_remplissage` et non sur la capacité brute — conforme à
« capacité utile/cible ». Sur la station Test : SP95 23 750 L pour une cuve de 25 000 L.

**ÉCART 1 — la capacité n'est bornée que par le bas.** `Math.max(0, …)` empêche une
capacité négative, mais **rien ne l'empêche de dépasser la limite physique de la cuve**.
Quand le stock projeté à la livraison est négatif — la station est à sec avant l'arrivée
du camion — la capacité calculée vaut `limite + |déficit|`.

Ce n'est pas théorique : le 08/09/2026, sur NEXUS Test, l'écran recommande **24 000 L de
SP95 pour une cuve dont la limite de remplissage est 23 750 L**. Le camion ne pourrait pas
la décharger.

Cela contredit directement deux phrases du texte : « NEXUS ne doit jamais présenter une
capacité théorique comme une certitude physique » (§1) et « ne jamais ajouter
artificiellement du carburant si cela crée un risque de dépassement de capacité de
réception » (§6). C'est la dette déjà tracée **CARB-006** ; le texte de Frédéric ne crée
pas une règle nouvelle, il **arbitre une dette ouverte**.

**ÉCART 2 — un stock projeté négatif n'est jamais dit.** Il est silencieusement converti
en capacité supplémentaire. Or « la station sera à sec avant le camion » est un signal
d'exploitation majeur, pas un espace de rangement. Rien dans le moteur ne le signale
(recherche `stockPrevuLivraisonL < 0` : aucun résultat).

## 2. Ventes prévisionnelles contextualisées

**Conforme sur l'essentiel.** Le moteur ne fait pas de moyenne aveugle :

- jour de la semaine — `moyennePondereeMemeJourSemaine` (l. 259)
- jours fériés — `moyenneJoursFeries` (l. 292)
- exclusion des jours atypiques — `exclureJoursAtypiques` (l. 227)
- hypothèse haute prudente — `moyenneHauteDeuxMeilleures` (l. 243), explicitement motivée
  dans le code par « il vaut mieux surestimer légèrement »
- **refus d'inventer** — `{ prevision: null, methode: 'aucune_donnee', confiance: 'non_calculable' }`
- confiance explicite et propagée : `fiable` / `a_confirmer` / `non_calculable`

**Partiellement conforme — la granularité.** Le quart est traité pour la couverture
(`estimerCouvertureParQuart`) et pour le quart déjà entamé (`quartsAEstimerDansFenetre`),
mais les ventes jusqu'à la livraison sont sommées **par jour entier**
(`prevoirConsommationFenetre`, l. 342).

**ÉCART 3 — l'heure probable de livraison n'existe pas dans le moteur.** Recherche sur
`heureLivraison|heure_livraison|livraisonHeure|heureProbable` : aucun résultat. Le cutoff
de commande est bien modélisé (`calculerFenetreLivraison`, `heureCommandeHHMM`), mais pas
l'heure d'arrivée du camion. L'exemple du texte — « si je prévois 3 000 L de ventes avant
l'arrivée du camion » — n'est donc pas modélisable finement aujourd'hui : le moteur
raisonne en journées.

**Manquant, signalé comme « éventuellement » dans le texte :** saisonnalité et veille de
jour férié (aucune occurrence). Le cahier §8 fixait quatre priorités de prévision ;
ajouter ces deux dimensions serait une règle nouvelle.

## 3. Couverture jusqu'à quand — conforme

`estimerCouvertureParQuart` rend « mardi Q2 » plutôt que « 4,3 jours ». Le code cite
nommément le retour de Frédéric du 28/08/2026 qui l'a demandé. La valeur décimale n'est
pas supprimée : elle reste dans « Voir les calculs ». Conforme au principe UX de la Bible
(« langage du terrain : jour/quart, couverture »).

Honnêteté déjà en place : dès qu'un quart devient `non_calculable`, la projection s'arrête
et rend le dernier quart réellement couvert — jamais une couverture fabriquée.

## 4. Calendrier de livraison — conforme

`estJourLivraisonPossible`, `prochainJourLivraisonPossible`, `estJourCommandePossible`,
`prochainJourCommandePossibleApres`, cutoff horaire, jours fériés en entrée. La station
Test est configurée jours 1-5, cutoff 11:00 — cohérent avec le texte.

## 5. Fin de mois — conforme

`estFinDeMois`, `reserveCibleJours` (2 jours en régime normal, 1 en fin de mois),
`determinerRegimeGestion({ modeFinDeMois })`, `estPontDeMois`, `livraisonChangeDeMois`.
La priorité continuité sur optimisation comptable est tenue par la réserve de sécurité,
qui n'est jamais annulée en fin de mois — seulement réduite.

## 6. Optimisation du camion — conforme, mais héritant de l'écart 1

`optimiserCommandeMultiCarburant` (minimum 3 000 L, maximum 36 000 L, capacités par
carburant), `completerVersCamionPlein`, `verifierMinimumCamion`. Le garde-fou demandé par
le texte existe : `plafondAdditionnelL` borne l'ajout par la capacité restante **et** par
une marge d'autonomie (20 jours), pour ne pas gonfler un stock sans raison.

Mais il s'appuie sur `capacitesDisponiblesL` : quand celle-ci dépasse la limite physique
(écart 1), le garde-fou laisse passer. C'est le mécanisme exact du 24 000 L observé.

## 7. Livraison du jour, double comptage — conforme

`ancreStockISO` (l. 552) : la fenêtre de ventes part de la date du **dernier stock
fiable**, pas de la date de commande. `livraisonsIntermediaires` entre dans
`stockPrevuLivraison`. Un test dédié existe (`test_carburant_commande_ancre_jaugeage_v2255.js`),
et une migration protège le relevé d'ouverture lors d'une réception
(`preserver_releve_ouverture_lors_reception`).

## 8. Commande en cours ≠ livraison effectuée — conforme

`integrerCommandeEnCours` (l. 462) rend `stockAvantReception` et `stockApresReception`
séparément, avec `livraisonPrevueLe`. Les litres commandés ne sont jamais fondus dans le
stock physique. Le commentaire du code cite l'exemple exact du cahier §10.

## 9. Fiabilité du jaugeage — conforme

`qualiteDonneesCommande` / `detailQualiteDonneesCommande` / `actionsResolutionFiabilite`,
`jaugeageEstFrais`, `livraisonEnCoursCoherente`, `etatConfirmationCommande`. Le niveau
`a_confirmer` accompagne la recommandation au lieu de la supprimer — exactement
« recommandation possible, fiabilité réduite en raison de… ». La Bible impose déjà le `(i)`
discret plutôt que la pollution de l'écran principal.

## 10-11. Chaîne complète et distinctions de notions

La chaîne du §10 est présente de bout en bout, sauf les deux maillons manquants ci-dessus.
Les distinctions du §11 sont portées par le nommage même du moteur : `stockReel` /
`stockPrevuLivraison` / `ventesPrevues` / `commandeEnCours` / `livraisonPrevueLe` /
`capaciteDisponibleLivraison` / `reserveCibleJours`. Conforme au principe de la Bible :
« une règle métier ne doit avoir qu'un propriétaire logique ».

---

## Ce qui remonte pour arbitrage

Aucune contradiction entre ce texte et le cahier des 38 sections : c'est le même
raisonnement, précisé. Trois points demandent néanmoins une décision, car les trancher
change une recommandation métier.

| # | Objet | Nature | Pourquoi ça ne peut pas être décidé par Claude |
|---|---|---|---|
| A | Borner la capacité de réception à la limite physique de la cuve | **Arbitrage d'une dette existante** (CARB-006) | Change les volumes recommandés dans tous les cas où la station est à sec avant livraison. Le sens physique est évident ; l'effet métier ne l'est pas. |
| B | Signaler « à sec avant livraison » comme un état d'exploitation | Règle nouvelle | Ni le cahier ni le moteur n'ont d'état pour ça. Décider s'il bloque, alerte ou informe est un choix produit. |
| C | Introduire l'heure probable de livraison | Règle nouvelle **et** donnée nouvelle | Le moteur raisonne en journées. Modéliser l'heure suppose une source : contrat transporteur, historique de réceptions, saisie ? Sans source, ce serait une invention. |

Saisonnalité et veille de jour férié sont laissées de côté : le texte les présente comme
« éventuellement », et le cahier §8 fixait quatre priorités de prévision déjà implémentées.
Les ajouter mérite son propre lot, avec la preuve d'un cas réel mal prévu.

## Ce qui reste hors périmètre, pour mémoire

§17-19 du cahier (optimisation tarifaire mensuelle) ont été explicitement reportés à un lot
séparé lors de la construction du moteur : celui-ci n'a même pas connaissance des prix en
entrée. Rien dans le texte du 08/09 ne le rouvre.
