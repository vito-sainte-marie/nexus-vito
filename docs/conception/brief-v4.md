### Fiche de conception : Brief v4

Référentiel appliqué : NEXUS-REFERENTIEL-CONCEPTION v1.0

Statut : brouillon pour relecture. Aucun code n'est modifié par cette fiche. Rien en Production.
Origine : demande de Guardian (#383, commentaire 7198957693) : « Je te demande d'abord une fiche de conception, sans code. »
Maquette : `docs/conception/maquettes/brief-v4.html` (données fictives, bouton Jour / Nuit, cadre bureau 1280 seulement : la version mobile attend).

## 0. Décisions du gérant reprises telles quelles

1. Le secteur Équipe sort du Brief : pas de carte, pas de place dans le radar ni dans l'Indice, pas de signaux Équipe. Raison : `pointages` n'est plus alimentée depuis août.
2. La fiabilité des données va dans l'en-tête : nombre de secteurs mesurés sur 5, et date réelle des données de chaque secteur.
3. L'objectif de marge est la cible de la politique tarifaire (`tarif_seuils`, champ `cible`, vue `v_tarif_seuils_actifs`). Plus de référence fixe à 25 %. Aucune cible n'est saisie en Production : la Performance Marge est neutre (jamais pénalisée) ; le taux réel et la Maîtrise restent mesurés. La carte dit « Objectif de marge à définir dans Produits », avec un lien.
4. Courbe d'évolution sur 40 jours. Données quotidiennes disponibles : volumes carburant, ventes boutique (`audits_caisse.vente_boutique`), chiffre FDJ. Une grandeur par axe.

Complément du gérant (Guardian, 7199090542) :

5. Aucune marge dans le graphique d'évolution. La marge devient un indicateur à part : taux réel de la période comparé à la cible de la politique tarifaire, avec la date de la période.
6. Le Brief fait connaître au gérant sa performance, son potentiel et ses objectifs à court, moyen et long terme. NEXUS le guide : le Brief dit « où je vais et ce qui me sépare de l'objectif ». Voir §16 et le lot E.

Arbitrages du gérant du 26/11 (Guardian, 7199835605 et 7199856933) :

7. Le nom Boussole reste. La note globale sur 100 quitte le premier niveau de lecture. Trois lectures séparées : performance économique, maîtrise opérationnelle, fiabilité des données. Une bonne performance commerciale ne compense jamais une anomalie opérationnelle confirmée. Aucune tendance globale calculée arbitrairement : des évolutions contrastées sont montrées comme telles (§17).
8. Cartes secteur : des chiffres métier réels (unité, graphique adapté, tendance, statut métier) à la place des notes sur 100, qui restent au détail si elles sont légitimes. Option B retenue : une dimension non mesurée sort du calcul et la couverture partielle est affichée. Une dimension non applicable (Opérations n'a pas de Performance) se distingue d'une dimension attendue mais indisponible (§17.1).
9. Commerce : le suivi d'activité repose sur les ventes boutique quotidiennes (`audits_caisse.vente_boutique`) ; les périodes importées servent à l'analyse détaillée des produits et de la rentabilité. L'écart de périmètre et les écarts résiduels sont documentés (§18.1).
10. Marge : pas d'échelle arbitraire. Quatre lectures (§19). Une anomalie durable ne devient pas normale parce qu'elle est dans l'historique.
11. Risques : quatre états conservés ; preuves de résolution et délais de fraîcheur selon le type de risque (§20). L'absence de mesure n'est jamais une résolution.
12. Objectifs : trois horizons conservés ; une saisie de référence annuelle à l'étude, avec propositions mensuelles et trimestrielles (§16.b). Aucune migration avant validation du modèle final.
13. Un seul graphique, trois séries comparées dans le temps (§18.3) : litres piste, CA FDJ (calculs de Tempo, repris tels quels), marge des produits boutique (fonction nouvelle chez Tempo). Indice base 100, valeurs par jour, périodes importées, couleurs de Tempo Mois. Pas de CA boutique. Il s'ajoute aux trois courbes sur 40 jours. Audit individuel et transversal des moteurs : plus tard, non commencé.

## 1. Utilisateur cible

Le gérant, à son bureau le matin (1280) et debout sur le téléphone (375). Il ouvre le Brief pour savoir si la station va bien et quoi faire en premier. Il n'est pas là pour saisir.

## 2. Besoin principal

« Où en est la station, et que dois-je faire aujourd'hui ? » en moins de dix secondes, avec la preuve que les chiffres sont frais.

## 3. Trois informations à comprendre en premier

1. L'état global : l'Indice sur 100 et son statut, ou « Indice non calculé : N secteurs mesurés sur 5 ».
2. Les trois indicateurs clés, chacun daté et comparé : volumes carburant sur 7 jours, ventes boutique sur 7 jours (chacun contre les 7 jours précédents), marge réelle contre son objectif.
3. Les trois priorités du jour, chacune avec son action.

## 4. Actions possibles

- « Détails » sur chaque carte secteur (vers la page du secteur, destination réelle).
- Une action par priorité (ouvre l'écran qui traite le sujet).
- « Objectif de marge à définir » (lien vers Produits).
- Ouvrir le rapport A4.
- Aucun bouton sans destination. Aucune tuile en bas qui répète « Détails ».

## 5. Canevas

Retenus :
- A identité : titre, date du jour, fiabilité des données (en-tête).
- B synthèse : bloc État global, trois indicateurs, grille des secteurs.
- C Conseiller : « Mes priorités du jour ».
- D navigation et actions : boutons « Détails », accès au rapport A4.
- E détails et preuves : courbe sur 40 jours, signaux de risque, sources.

Écartés : menu latéral qui répète celui de l'App sans destination propre ; tuiles de navigation en bas ; bloc Impact qui additionne des euros de natures différentes (voir §10).

## 6. Composants réutilisés

`nexus-icones.js` (icônes de secteur), `nexus-badge-etat.js` (statuts et gravités), `nexus-theme.js` (Jour / Sombre), jetons `--t-*`, IBM Plex Sans et Plex Mono pour les chiffres avec unité. Cartes : rayon 12 px, bordure 1 px. Boutons et pastilles : rayon 8 px. Aucun dégradé, aucune illustration décorative. Si une icône manque, je la demande sur #383, je n'en invente pas.

## 7. Réservé aux détails

Formules, bornes, listes complètes de signaux, historique des périodes de marge, tableau des écarts de caisse par quart. Rien n'est supprimé : tout descend au niveau 3 (pages secteur, rapport A4).

## 8. Premier écran

375×812 : en-tête (date, « 4 secteurs sur 5 mesurés »), État global, trois indicateurs empilés, début de la grille des secteurs (une colonne).
1280×800 : en-tête, État global à gauche et trois indicateurs à droite, grille des secteurs en 2 rangées visibles. Les priorités et la courbe sont sous la ligne de flottaison mais accessibles sans menu.

## 9. États

| Élément | Chargement | Aucune donnée | Erreur | Donnée non fiable |
|---|---|---|---|---|
| En-tête | squelette | « 0 secteur mesuré sur 5 » | « Brief indisponible » + Réessayer | date réelle affichée par secteur, rappel d'import au-delà de 15 jours |
| État global | squelette | « Indice non calculé : N secteurs mesurés sur 5 » + secteurs manquants listés | idem | Indice calculé seulement à partir de 4 secteurs mesurés sur 5 |
| Indicateur | squelette | « non mesuré » en gris, avec la raison | « lecture impossible » | date ou période sous le chiffre ; en rouge ambre si > 15 jours |
| Carte secteur | squelette | grise, raison écrite (jamais un 0) | grise, « lecture impossible » | badge de fraîcheur (`fraicheur.mode`) |
| Priorités | 3 lignes squelette | « Rien d'urgent aujourd'hui » | « Conseiller indisponible » | ligne marquée « à confirmer » |
| Courbe | squelette | « Pas assez de jours » | « courbe indisponible » | jours manquants laissés vides, pas interpolés |

## 10. Exceptions à la charte

Une seule, voulue par le gérant (26/11) : l'illustration de l'en-tête du Brief (`assets/brief/brief-entete-*.webp`, repli `.jpg`). Elle n'est autorisée que dans l'en-tête, nulle part ailleurs. Elle remplace le titre texte à l'œil ; le `<h1>` « Brief du jour » existe en texte, masqué visuellement, et l'image porte `alt="NEXUS Brief, tableau de direction"`. La date et la fiabilité des données restent en texte réel sous le bandeau, jamais dans l'image. Hauteur proposée : 200 px à 1280 px, cadrage à gauche (titre et tablette), pour que « À retenir » reste au-dessus de la ligne de flottaison à 1280 × 800. En Jour comme en Nuit, le bandeau reste sombre, coins à 12 px, sans dégradé ajouté. Pour le reste, les couleurs viennent des jetons, les états de `nexus-badge-etat.js`, aucun emoji en guise d'état.

## 11. Contenu de chaque carte

Règle générale : une carte = une question, 4 données au plus, un chiffre n'apparaît qu'une fois au niveau 1, chaque chiffre porte sa date ou sa période.

### 11.1 État global
> Révisé après la contre-expertise du 26/11 (commentaire 7199572601) : l'Indice est scindé en performance globale et risques confirmés, sans nombre unique qui mélange les deux. Voir §17. Les règles ci-dessous restent des propositions, rien n'est validé.

- Question : la station est-elle sous contrôle ?
- Source : notes des secteurs mesurés.
- Formule : moyenne arrondie des notes des secteurs mesurés. Une note de secteur = 50 + Performance + Maîtrise, bornée à [0, 100] (inchangé).
- Période : jour de données le plus ancien des secteurs retenus, affiché.
- Seuil : calculé seulement si au moins 4 secteurs sur 5 sont mesurés. Sinon « Indice non calculé : N secteurs mesurés sur 5 », secteurs manquants listés.
- Bandeau recentré sur le neutre : un secteur stable vaut 50. Le rouge est réservé à un secteur au statut « À corriger ». Seuils exacts proposés : à valider (§13).
- Règle actuelle du moteur : un secteur est mesuré dès qu'une de ses deux dimensions l'est, la dimension non mesurée compte pour 0. Cette règle est mise en question au §17.1 : une dimension inconnue n'est pas la preuve d'une situation neutre.
- Libellés possibles de l'Indice : Sous contrôle, À confirmer, À corriger, plus « Indice non calculé ». Les libellés propres aux secteurs (« À relancer », etc.) ne servent pas à l'Indice.
- Couleur et libellé, cas par cas (proposition, §13.2) : Indice à 60 ou plus et aucun secteur « À corriger » : vert, « Sous contrôle ». De 45 à 59, ou 60 et plus avec un secteur « À confirmer » : ambre, « À confirmer ». Sous 45 sans aucun secteur « À corriger » : ambre, « À confirmer », avec la mention « Indice bas, aucun secteur à corriger » ; il n'y a pas de rouge sans secteur à corriger. Au moins un secteur « À corriger » : rouge, « À corriger », avec le nom du secteur.
- Poids : moyenne simple des secteurs mesurés (proposition) ou moyenne pondérée ; voir §13.
- Vide : voir §9.

### 11.2 Volumes carburant
- Source : relevés carburant (même chargeur qu'aujourd'hui).
- Période : volume sur les 7 derniers jours, comparé aux 7 jours précédents, en litres et en pourcentage ; dates des deux fenêtres affichées. Repli sur le dernier jour disponible affiché en clair.
- Fuseau : celui de la station partout (aujourd'hui `chargerCarburantsBriefAvecFallback` ignore le fuseau passé et prend l'UTC).
- Vide : « non mesuré », raison.

### 11.3 Chiffre boutique
- Source : `audits_caisse.vente_boutique`.
- Période : ventes des 7 derniers jours comparées à celles des 7 jours précédents (`audits_caisse`, journées de la station), en euros et en pourcentage ; dates des deux fenêtres affichées. Le « dernier quart audité » est abandonné : il n'a pas de sens pour un dirigeant.
- Vide : « non mesuré ».

### 11.4 Marge réelle contre objectif
- Source : marge de la période importée ; objectif = `tarif_seuils.cible` via `v_tarif_seuils_actifs`.
- Cible servant à comparer le taux global : la cible `defaut` si elle existe et est valide ; sinon la moyenne des cibles valides des familles, pondérée par le chiffre d'affaires de chaque famille ; si aucune cible n'est valide, aucune comparaison.
- Indicateur à part, jamais tracé dans la courbe d'évolution (décision 5). Il montre le taux réel de la période, la cible de la politique tarifaire et l'écart en points, avec la date de la période.
- Période : la période importée, dates de début et de fin. Rappel d'import si les données ont plus de 15 jours.
- Sans objectif saisi (cas actuel) : l'indicateur affiche le taux réel de la période et sa date, avec « objectif à définir dans Produits » en dessous et un lien (le seul de l'écran). Le taux est mesuré ; la Performance Marge est neutre ; le secteur Marge est mesuré par sa Maîtrise (écarts en euros). Le texte « pour une référence de 25 % » disparaît.
- Sans import : « non mesurée ».
- Pas de doublon : le taux n'apparaît qu'ici au premier niveau ; la carte secteur Marge ne montre que sa note et son statut.

### 11.5 Cartes secteur (Carburant, Commerce, Marge, FDJ, Opérations)
Chaque carte : nom et icône, note /100, statut métier (`statutMetier`), petite tendance, bouton « Détails ». Un secteur non mesuré est gris, avec sa raison. La couleur de la note vient du statut métier, jamais de seuils numériques.

- Carburant : performance = volumes contre la référence actuelle ; maîtrise = écarts de stock. Période : jour de données.
- Commerce : performance boutique. Date réelle affichée. Rappel d'import après 15 jours. Source à arbitrer (§13.11).
- Marge : note et statut seulement ; le taux est dans l'indicateur 11.4. Performance neutre sans cible ; Maîtrise Marge mesurée en euros (voir §12).
- FDJ : fenêtre de 7 jours en heure de la station (aujourd'hui construite en UTC avec un décalage).
- Opérations : maîtrise seule. « Écart de caisse » = somme des écarts en valeur absolue par quart, pas la somme signée par jour (deux quarts opposés s'annulent aujourd'hui). Jour du dernier contrôle en heure de la station.

Équipe : retirée (décision 1). La lecture de `coach_daily_recommendations` et de `pointages` pour le Brief disparaît au lot A.

### 11.6 Mes priorités du jour
- Trois lignes : action, précision, étiquette d'urgence.
- Classement stable d'un jour à l'autre : plus de tirage au sort daté.
- Urgence et échéance tirées du fait (montant, jours de stock), pas du rang du moteur.
- Pas d'addition d'euros de natures différentes : chaque ligne garde son propre chiffre et son unité.

### 11.7 Évolution sur 40 jours
- Proposition : un graphique par grandeur (volumes carburant, ventes boutique, chiffre FDJ), même abscisse, une grandeur par axe. Variante : indice base 100 au premier jour sur un seul graphique. Je recommande les petits graphiques séparés (lisibles sur 375, chaque unité reste vraie).
- Jours sans donnée : trous visibles, pas d'interpolation.
- Marge : absente du graphique (décision 5). Elle vit dans son indicateur daté (§11.4).
- Chaque graphique a un axe des dates (début, milieu, fin) et sa propre échelle (minimum et maximum de la grandeur, avec l'unité), et occupe toute la largeur disponible.
- Alternative texte : tableau des valeurs sous la courbe, ouvert à la demande.

### 11.8 Signaux de risque
- Aujourd'hui, les trois premiers après tri par urgence puis niveau. Ils s'accumulent sans jamais se fermer.
- Règle de fermeture : l'ancienne proposition (fermeture après 30 jours sans mesure) est retirée. 30 jours sans mesure ne sont pas une résolution. Quatre états distincts, preuves et traces au §20.

### 11.9 Accès au rapport A4
Un bouton. Le rapport garde sa feuille de style claire et ne dépend pas du thème.

## 12. Calculs corrigés et propositions

Corrections décidées :
1. Indice : au moins 4 secteurs mesurés sur 5.
2. Bandeau recentré sur le neutre (stable = 50). Rouge réservé à « À corriger ».
3. Maîtrise Marge en euros.
4. Opérations : somme des écarts absolus par quart.
5. Fuseau de la station partout (carburant, Opérations, FDJ).
6. Classement stable ; urgence tirée du fait ; pas de somme d'euros hétérogènes.
7. Date réelle pour Commerce et Marge, rappel d'import après 15 jours.

Proposition à arbitrer, révisée au §19 (échelle relative à l'historique de la station) : échelle de Maîtrise Marge. Aujourd'hui elle compte les articles en écart (`contributionMaitriseEcarts` : 0 → +10, jusqu'à 2 → −5, jusqu'à 5 → −15, au-delà → −25), si bien que beaucoup de petits écarts plafonnent la pénalité. Mesure proposée : gain potentiel des écarts (en euros) rapporté au chiffre d'affaires de la période.

| Gain potentiel / chiffre d'affaires | Contribution |
|---|---|
| aucun écart | +10 |
| moins de 0,1 % | 0 |
| de 0,1 % à moins de 0,5 % | −5 |
| de 0,5 % à moins de 1 % | −15 |
| 1 % et plus | −25 |

Les bornes sont une proposition, à ajuster par le gérant avec les vrais ordres de grandeur. Je ne cite aucune donnée réelle dans cette fiche. Tant que le chiffre d'affaires de la période est inconnu, la maîtrise est « non mesurée ».

## 13. Questions pour le gérant

1. Échelle de Maîtrise Marge du §12 : bornes à valider.
2. Seuils du bandeau recentré (proposition : vert à partir de 60, ambre de 45 à 59, rouge seulement pour « À corriger »).
3. Courbe : petits graphiques séparés (recommandé) ou indice base 100 ?
4. Règle de fermeture des signaux : voir §20 et le dossier d'arbitrage §21.
5. Seuil de rappel d'import : 15 jours pour Commerce et Marge ?
6. Objectifs (§16) : durées des horizons proposées (court = mois civil, moyen = trimestre civil, long = année civile) : à valider.
7. Objectifs : qui saisit ? Proposition : le gérant, ou le gérant de station, depuis un écran « Objectifs de la station » ; le Brief reste en lecture.
8. Objectifs : valeurs de départ proposées à partir de l'historique réel de la station (moyenne des mêmes périodes passées), toujours affichées comme proposition, jamais enregistrées sans validation. D'accord ?
9. Objectifs : table nouvelle `station_objectifs` (§16.c) acceptée dans son principe, avant toute migration ?
10. Objectifs : quelles grandeurs au démarrage ? Proposition : volumes carburant, ventes boutique, chiffre FDJ, taux de marge. Les trois premières n'ont aujourd'hui aucun objectif nulle part.
11. Commerce : source de la Performance. Option 1 : les périodes importées (actuel), souvent vieilles de plusieurs semaines, mais cohérentes avec la marge. Option 2 : `audits_caisse` sur 7 jours, frais et quotidien, avec les périodes importées gardées pour la marge seulement. Limite levée par Guardian : voir §18, les deux options y sont décrites avec leur périmètre exact.
12. Poids des secteurs dans l'Indice : moyenne simple (proposition) ou pondération par secteur ? Je ne tranche pas.

## 14. Épreuves prévues

- Non-régression des valeurs : à jeu de données identique, les notes des secteurs inchangés (Carburant, FDJ) sont identiques à origin/production. Les notes qui changent (Marge, Opérations, Indice) sont listées avec avant / après sur données fictives.
- Cibles cliquables : chaque bouton ou lien du Brief a une destination réelle et mesure au moins 44 px ; aucun bouton sans cible.
- Fuseau : jeu de données à cheval sur minuit UTC, station en heure d'été et en heure d'hiver ; les fenêtres FDJ, Opérations et Carburant coupent à minuit de la station.
- Indice : 3 secteurs mesurés → « non calculé » ; 4 → calculé ; liste des manquants exacte.
- Équipe : aucune lecture de `pointages` ni de `coach_daily_recommendations` ; aucune carte Équipe.
- Marge : sans objectif, taux mesuré, Performance neutre, secteur mesuré par sa Maîtrise, aucune pénalité ; avec objectif, comparaison correcte ; cible globale : `defaut`, sinon moyenne pondérée par le chiffre d'affaires, sinon aucune.
- Règle « mesuré dès qu'une dimension l'est » ; bandeau de l'Indice : chaque cas a une couleur et un libellé, y compris sous 45 sans secteur « À corriger ».
- Carburant et boutique : fenêtres de 7 jours contre les 7 jours précédents, fenêtres vides et divisions par zéro.
- Classement stable : deux jours consécutifs sans changement de données donnent le même ordre.
- Charte : `test_charte_interface.js` inchangé en rouge, jetons uniquement, pas d'emoji, Jour et Nuit.
- Épreuves déjà liées au Brief : test_badge_etat_brief_20261109.js, test_brief_chargement_dynamique.js, test_brief_vague3_20261109.js, test_carburant_brief_fallback_verifie_v2248.js, test_carburant_brief_rapport_economie.js, test_connexion_carte_brief_20261126.js.
- Lot E : un objectif sans valeur validée n'est jamais affiché comme atteint ni comme manqué ; « à ce rythme » n'apparaît que si la période est assez avancée et la grandeur assez mesurée (jeu fictif en dessous du minimum : aucune projection) ; potentiel : deux gains de natures différentes ne s'additionnent jamais (épreuve sur un gain de marge et une perte évitable ; le carburant à commander n'apparaît jamais dans le potentiel) ; une proposition de départ est marquée « proposition » tant qu'elle n'est pas validée ; politique RLS de `station_objectifs` : un gérant d'une autre station ne lit ni n'écrit, un employé ne peut pas insérer, aucune modification ni suppression ; chaque priorité du Conseiller nomme l'objectif qu'elle sert, ou « sans objectif lié » en clair.
- Marge : l'indicateur affiche le taux de la période, la cible et la date ; aucune série de marge dans le graphique.
- La recette de l'interface reste celle de Guardian : une CI verte ne la valide pas.

## 15. Découpage en lots courts (une PR brouillon chacun)

- Lot A, calculs : Indice à 4 secteurs, bandeau recentré, Maîtrise Marge en euros, Opérations en écarts absolus, fuseau de la station, Équipe retirée du moteur, objectif de marge lu dans `tarif_seuils`, classement stable. Épreuves de valeurs et de fuseau.
- Lot B, en-tête et disposition : fiabilité des données, bloc État global, trois indicateurs, grille, priorités, accès au rapport A4, Jour et Nuit, 375 et 1280.
- Lot C, courbe sur 40 jours : chargement des séries quotidiennes, rendu, états vides, tableau de valeurs.
- Lot D, signaux de risque : règle de fermeture et affichage.
- Lot E, objectifs et potentiel (présenté séparément, §16) : écran de saisie des objectifs, bloc « Objectifs et potentiel » du Brief, objectif servi sur chaque priorité. Il commence après la revue de la fiche et le GO du gérant sur le modèle ; la table n'est créée qu'après un GO explicite sur la migration.

Ordre : A, puis B, puis C et D indépendants ; E après B et après le GO sur le modèle. Rien en Production sans GO. Aucune fusion sans GO écrit du gérant. Le déploiement de #391 est fait ; la disposition bureau est ce lot B, ouvert sur instruction du gérant seulement.

## 16. Objectifs et potentiel (lot E)

But : que le gérant voie sa performance, son potentiel et ses objectifs à court, moyen et long terme, et que NEXUS le guide. Le Brief répond à « où je vais et ce qui me sépare de l'objectif ». Aucune donnée réelle citée ; tout ce qui suit est lu dans le dépôt, en lecture seule.

### 16.a Inventaire de l'existant (rien n'est inventé)

Objectifs existants :

| Objet | Où | Ce qu'il porte | Qui écrit | Où il s'affiche |
|---|---|---|---|---|
| `campagne_objectifs_produits` (migration 20261114140000) | table append-only, versionnée (campagne, article, version) | objectif de ventes par jour et par produit : proposé, validé, rythme minimum, seuil d'unités, ventes et période de référence, validé par / le, version du moteur, provenance | gérant ou gérant de station de la même station (insert) ; aucune modification ni suppression ; `anon` fermé | écran `NEXUS-Campagne-v2-Objectifs.html` (saisie et validation, analyse par `NexusSimulateurPromo.analyserObjectif`), bilan dans `nexus-campagne-bilan.js` |
| `tarif_seuils` (migration 20261117020430) | table versionnée (niveau famille / rayon / défaut) | cible de taux de marge et minimum, avec statut (valide, indicatif, à l'étude, hypothèse). Seul « valide » décide. | saisi_par / saisi_le, remplacement et annulation par versions ; l'écran de saisie est à confirmer | Politique tarifaire en lecture seule (`nexus-politique-tarifaire-ecran.js`, moteur `nexus-politique-tarifaire.js`, fiche dans `NEXUS-Produits-v1.html`) |

Potentiels déjà calculés par les moteurs :

| Potentiel | Moteur | Nature et unité |
|---|---|---|
| Écarts de marge contre la médiane du groupe (Marge+) | `nexus-marge.js`, `detecterEcartsMarge` : gain = écart en points × chiffre d'affaires de l'article | euros de marge |
| Scanner tarifaire | `nexus-scanner-tarifaire.js`, écarts R5 préparés une fois | euros de marge |
| Candidats du Conseiller | `nexus-conseiller.js` : gain, perte, risque de stock non compté, écarts de caisse, impact FDJ, tous avec `impact_eur` | euros, mais de natures différentes (gain, perte évitée, risque) |
| Commandes carburant | `nexus-carburant-commande-moteur.js` : régimes avec une phrase « Objectif : … » et des quantités à commander | litres, aucun gain en euros |
| Progression | `nexus-progression.js`, `projeterProchainObjectif` : projection du prochain niveau, minimum 5 services | niveau de l'employé, pas un objectif de station |

À ne pas confondre : `inventaire_reassort_interne_regles` porte des cibles de stock, pas des objectifs métier. Le moteur FDJ dit déjà « aucun objectif défini ».

Constat honnête : il n'existe aujourd'hui que des objectifs de vente par produit pour une campagne et des cibles de taux de marge. Aucun objectif mensuel, trimestriel ou annuel, ni pour les volumes de carburant, ni pour le chiffre boutique, ni pour le chiffre FDJ, n'existe nulle part. Je n'en ai trouvé aucun autre dans le dépôt.

### 16.b Proposition de modèle

Horizons (durées proposées, à valider) :
- court : le mois civil en cours ;
- moyen : le trimestre civil en cours ;
- long : l'année civile en cours.
Saisie de référence annuelle (à l'étude, arbitrage du 26/11) : le gérant saisit une seule référence par an et par grandeur. NEXUS en déduit des propositions mensuelles et trimestrielles à partir de l'historique réel et de la saisonnalité de la station, avec la base du calcul affichée. Ces propositions sont modifiables ligne par ligne et ne comptent qu'après validation explicite du gérant. Pas assez d'historique pour une saisonnalité : répartition non proposée, « pas assez de recul ». Le taux de marge garde son autorité dans la politique tarifaire (`tarif_seuils`) : il n'entre pas dans cette saisie. Aucune migration (§16.c) avant la validation du modèle final.

Variante possible pour le court terme : la semaine, mais les ventes de boutique et le chiffre FDJ y sont trop volatiles pour un objectif lisible. Je recommande le mois.

Saisie :
- Qui : le gérant ou le gérant de station, depuis un écran « Objectifs de la station », à créer au lot E (le Brief reste en lecture, il ne saisit rien). Pour la marge, la cible reste celle de `tarif_seuils`, saisie dans Produits ; elle n'est pas dupliquée.
- Valeur de départ : NEXUS propose, à partir de l'historique réel de la station (même grandeur sur les mêmes périodes passées, et la période précédente), une valeur affichée comme « proposition de NEXUS », avec la base du calcul. Elle n'est jamais enregistrée sans validation du gérant. Pas assez d'historique : « pas assez de recul pour proposer », champ vide.

Affichage, pour chaque objectif (une carte = une question : « où j'en suis de cet objectif ? ») :
- valeur actuelle de la période, avec sa date ;
- cible ;
- écart (en unités et en pourcentage de la cible) ;
- tendance par rapport à la période précédente, flèche et mot (« en hausse », « stable », « en baisse ») ;
- « atteint à ce rythme » ou « pas atteint à ce rythme » seulement quand le calcul le permet : au moins la moitié de la période écoulée et les jours mesurés suffisants ; sinon « trop tôt pour dire ». Aucune prévision inventée (Constitution art. 12). Le calcul est une règle de proportionnalité sur les jours mesurés, annoncée comme telle.

Potentiel :
- somme des gains déjà mesurés par les moteurs, par nature : euros de marge (Marge+, Scanner tarifaire), euros de pertes évitables (écarts de caisse, stock non compté). Le carburant à commander n'est pas un potentiel : c'est un besoin, il reste dans les priorités. Le potentiel ne contient que des gains et des pertes évitables, en euros, chacun dans sa nature ; jamais d'addition de natures différentes.
- chaque ligne de potentiel nomme le moteur qui l'a mesuré et la date de sa mesure ; un potentiel sans mesure datée n'est pas affiché.

Guidage :
- chaque priorité du Conseiller nomme l'objectif qu'elle sert (« sert l'objectif : marge du trimestre »), ou dit « sans objectif lié » quand aucun objectif ne correspond. L'ordre des priorités reste celui du §11.6 ; l'objectif servi est une étiquette, pas un critère de tri caché.

### 16.c Base de données (aucune migration avant GO du gérant)

Besoin : les objectifs de volume carburant, de ventes boutique et de chiffre FDJ n'ont aucune table. La table `campagne_objectifs_produits` est liée à une campagne et à un article : elle ne convient pas. `tarif_seuils` ne porte que des taux de marge.

Proposition : une table `station_objectifs`, append-only et versionnée, sur le modèle des deux tables existantes.

| Colonne | Rôle |
|---|---|
| `id` | identifiant |
| `site_id` | station concernée |
| `grandeur` | volumes_carburant, ventes_boutique, chiffre_fdj (liste fermée, taux de marge exclu : il reste dans `tarif_seuils`) |
| `horizon` | mois, trimestre, annee |
| `periode_debut`, `periode_fin` | période civile visée, en date de la station |
| `valeur_cible` | cible, strictement positive |
| `unite` | litres ou euros, imposée par la grandeur |
| `proposition_nexus` | valeur proposée par NEXUS, conservée pour l'audit |
| `base_proposition` | description de l'historique utilisé, pour relire la proposition |
| `statut` | valide, indicatif, a_l_etude (même vocabulaire que `tarif_seuils`) ; seul « valide » alimente le Brief |
| `saisi_par`, `saisi_le` | auteur et date |
| `remplace_id` | version remplacée |
| `annule_par`, `annule_le`, `annule_motif` | annulation, sans suppression |

RLS par station : lecture pour les employés de la même station (`site_id = current_employee_site_id()`) ; insertion pour le gérant et le gérant de station de la même station (`current_employee_role()`) ; aucune modification ni suppression ; `anon` fermé, y compris `TRUNCATE`, sans `revoke from public` seul. Écriture par l'écran « Objectifs de la station » uniquement, jamais par le Brief.

Aucune migration, aucune table créée, aucune lecture Production avant le GO du gérant.

## 17. Boussole : trois lectures séparées, plus de note globale

Tout ce qui suit est une proposition de conception. Aucun seuil n'est gelé, aucun nombre n'est validé. Les jeux de données sont fictifs. Le nom Boussole est conservé.

### 17.1 Couvertures : option B retenue, applicable ou indisponible

Chaque dimension d'un secteur (Performance, Maîtrise) a l'une de trois couvertures : complète, partielle (période trop courte, jours ou familles manquants), absente.

Décision du gérant : option B. Une dimension non mesurée ne compte pas comme 0 ni comme un neutre : elle est exclue du calcul et la couverture partielle est affichée à côté du résultat (« 3 secteurs sur 5 », « Maîtrise non mesurée »). Un secteur sans aucune dimension mesurée n'a pas de lecture chiffrée. Cela remplace la règle actuelle de `assemblerScoreSecteur` (qui met `null` à 0) ; le changement de moteur est hors de ce lot.

Deux cas à ne jamais confondre, et à afficher différemment :
- dimension non applicable : le secteur n'en a pas par nature (Opérations n'a pas de Performance). Elle n'est pas comptée comme manquante : « sans objet » ;
- dimension attendue mais indisponible : le secteur devrait la mesurer et ne le peut pas (import absent, quart non saisi). Elle réduit la couverture et le dit : « non mesurée ».

### 17.2 Trois lectures, pas un nombre

Le premier niveau de lecture ne montre plus de note globale sur 100. Trois lectures séparées :
1. Performance économique : volumes carburant, ventes boutique, FDJ, taux de marge face à la cible, chacun dans son unité, avec la couverture (« 3 sur 5 »).
2. Maîtrise opérationnelle : les anomalies confirmées (écarts de caisse, anomalies tarifaires dédoublonnées, signaux de risque actifs), par secteur, nommées. Vide, elle dit « aucune anomalie confirmée, contrôles faits sur N secteurs » et non « tout va bien » quand la couverture est partielle.
3. Fiabilité des données : nombre de secteurs mesurés sur 5, date réelle des données de chaque secteur, couverture des dimensions (§0, décision 2).

Règles :
- une bonne performance commerciale ne compense jamais une anomalie opérationnelle confirmée : l'anomalie reste en première ligne, jamais diluée dans une moyenne ;
- aucune tendance globale calculée arbitrairement : si le carburant monte et la boutique baisse, les deux évolutions sont montrées côte à côte, contrastées, sans flèche de synthèse ;
- la note par secteur reste au détail (niveau 3) si elle est légitime, avec sa couverture ; elle ne remplace pas les chiffres métier de la carte.

### 17.3 Cartes secteur : chiffres métier

Chaque carte secteur montre, à la place d'une note sur 100 : une icône, l'indicateur principal avec son unité, un graphique adapté à la grandeur, la tendance (flèche et mot) et un statut métier. Exemples de la maquette (valeurs fictives) : Carburant en litres, Commerce en euros, FDJ en euros de chiffre d'affaires, Opérations en nombre d'écarts et euros, Marge en taux contre la cible.

### 17.4 Simulations sur jeux fictifs

Quatre situations, rejouées avec la règle actuelle et avec les trois lectures. Les chiffres sont inventés. À refaire par le lot de calcul avant tout gel, sur les épreuves du §14.

| Situation fictive | Règle actuelle (moyenne unique) | Proposition (trois lectures) |
|---|---|---|
| Station stable : 5 secteurs mesurés, performances proches de 0, maîtrise bonne | Indice voisin de 55 à 60, « Sous contrôle » ou « À confirmer » selon le seuil | Performance économique stable, 5 sur 5 ; aucune anomalie confirmée |
| Baisse d'activité : performances négatives sur Carburant et Commerce, maîtrise bonne | Indice qui baisse, éventuellement ambre ; le secteur dit « À relancer » | Carburant et Commerce en baisse, nommés, sans flèche de synthèse ; aucune anomalie confirmée (une baisse d'activité n'est pas un défaut de contrôle) |
| Problème de contrôle confirmé : écart de caisse récurrent en Opérations, performances correctes ailleurs | Moyenne amortie par les autres secteurs, Indice presque inchangé ; un seul secteur rouge noyé | Performance économique correcte ; maîtrise : anomalie confirmée en Opérations, en première ligne, non compensée |
| Couverture partielle : 2 secteurs sans aucune dimension mesurée | Indice « non calculé » (moins de 4 secteurs) ou calculé avec des 50 neutres | Lectures sur 3 secteurs, mention « 3 sur 5 », dimensions « non mesurées » nommées ; fiabilité des données dégradée, affichée |

À produire avant gel : ces quatre situations en tableau chiffré, par secteur et dimension, avec le calcul actuel et les trois lectures côte à côte. Le gérant tranche ensuite sur pièces.

## 18. Table d'autorité des calculs

Principe : le Brief consomme des résultats officiels, il ne crée jamais un second calcul concurrent. Une ligne par indicateur et par secteur. Les fonctions de référence sont celles lues dans le dépôt le 26/11 ; une cellule « à confirmer » veut dire que la lecture du code reste à faire avant le lot de calcul.

| Indicateur ou secteur | Moteur propriétaire | Donnée et unité | Périmètre station | Période | Fraîcheur | Fonction de référence | Autres pages qui consomment le résultat |
|---|---|---|---|---|---|---|---|
| Volumes carburant | moteur carburant | litres par relevé | site de l'utilisateur | 7 jours contre 7 précédents (proposé) | jour de données | chargeur du Brief (`chargerCarburantsBriefAvecFallback`) puis `construireSecteurCarburants` | pages Carburant, Conseiller (à confirmer) |
| Suivi d'activité boutique (décidé 26/11) | caisse | euros par quart | site | jour (ventes quotidiennes) | jour de données | `audits_caisse.vente_boutique` | Commerce, caisse (à confirmer) |
| Analyse produits et rentabilité boutique | `products` (périodes importées) | euros de CA et de marge | site | période importée | date de l'import | `construireSecteurCommerce` (périodes importées) | Commerce, Marge (à confirmer) |
| Marge (taux et écarts) | `nexus-marge.js` | taux en %, écarts en euros | site | période importée | date de l'import | `detecterEcartsMarge`, `construireSecteurMarge`, `construireSyntheseFreinMarge` | Marge+, Scanner tarifaire, Politique tarifaire |
| Cible de marge | `tarif_seuils` | taux en % | site | versions | date de saisie | `v_tarif_seuils_actifs`, `nexus-politique-tarifaire.js` | Produits, Politique tarifaire |
| FDJ | moteur FDJ | euros | site | fenêtre de 7 jours | jour de données | `construireSecteurFdj` | écran FDJ (à confirmer) |
| Opérations | `nexus-conseiller-donnees.js` (le Brief n'en garde que des alias) | euros d'écarts, nombre d'alertes | site | moyenne sur tout l'historique exploitable (pas le jour du dernier contrôle) | date du dernier contrôle pris en compte | `calculerStatutOperations`, `chargerConstatTempo` | caisse, inventaire (à confirmer) |
| Notes et statuts secteur | moteur Boussole | points sur 100, statut | site | celle du secteur | la plus ancienne des données | `assemblerScoreSecteur`, `statutMetier`, `scoreDimension` | Boussole (SVG : `genererBoussoleSVG`) |
| Trois lectures (performance économique, maîtrise opérationnelle, fiabilité des données) | à construire à partir des résultats officiels ci-dessus, sans nouveau calcul | selon la lecture | site | celle de chaque secteur | la plus ancienne des données | pas de note globale ; `construireVerdictDirection` n'est plus au premier niveau (à confirmer) | Boussole |
| Signaux de risque | score et statut : `nexus-boussole-moteur.js` ; qualification et enregistrement dans `nexus_risk_signals` : `nexus-risques-donnees.js` (`qualifierEtEnregistrerRisques…`) ; `nexus-risques-moteur.js` à vérifier | selon le signal | site | continue | date de dernière mesure | `scoreRisques`, `statutRisques` | Conseiller, Brief |
| Potentiel et priorités | Conseiller | euros, par nature | site | selon le candidat | date de mesure | `nexus-conseiller.js` | Conseiller |
| Objectifs | `station_objectifs` (proposée), `tarif_seuils` | litres ou euros | site | mois, trimestre, année | date de validation | à créer au lot E | Brief seulement |

### 18.1 Commerce : autorité décidée, périmètres documentés

Décision du gérant (26/11) : le suivi d'activité Commerce repose sur les ventes boutique quotidiennes, `audits_caisse.vente_boutique` (total boutique Decenium par quart). Les périodes importées (`products`) servent à l'analyse détaillée des produits et de la rentabilité, pas au suivi d'activité.

Écart de périmètre, vérifié en lecture seule par Guardian et filtré par station : `vente_boutique` couvre le même périmètre que le chiffre d'affaires total des périodes importées, tabac et produits d'appel compris. Sur 4 périodes complètes, les deux totaux diffèrent de moins de 3 %. Aucun chiffre réel n'est repris ici.

Ce qui ne se recoupe pas, à documenter à l'écran et non à masquer :
- le Brief actuel retire les produits d'appel des périodes importées (`estProduitAppel`) pour calculer la marge : le chiffre d'analyse a donc un périmètre inférieur à `vente_boutique` ; chaque chiffre porte son périmètre étiqueté ;
- les périodes importées sont décalées de plusieurs semaines ; `vente_boutique` est quotidien : on ne compare un jour qu'à un jour, jamais une semaine de caisse à une période importée non alignée ;
- écarts résiduels (moins de 3 % sur 4 périodes) non expliqués : timing de saisie des quarts, retours, produits hors catégorie. Cause non établie ; une quatrième lecture des écarts par période reste à produire au lot de calcul. Aucune réconciliation n'est promise.

### 18.2 Endroits où le Brief recalcule aujourd'hui ce qui existe ailleurs

À signaler et à supprimer ou à brancher sur le résultat officiel avant le lot A :
1. Commerce : le Brief retire lui-même les produits d'appel des périodes importées (`estProduitAppel` via `nexus-brief-donnees.js`) pour son chiffre d'activité alors que `vente_boutique` existe et fait désormais autorité pour le suivi (§18.1).
2. Marge : `construireSecteurMarge` et `construireSyntheseFreinMarge` consomment `detecterEcartsMarge` ; le Scanner tarifaire calcule des écarts proches (§19.2). Risque de deux moteurs sur le même article.
3. Opérations : `calculerStatutOperations` (moyenne d'écarts absolus sur tout l'historique exploitable) et `chargerConstatTempo` vivent dans `nexus-conseiller-donnees.js`, le Brief n'en garde que des alias ; l'écart de caisse existe aussi côté caisse (à confirmer).
4. Fuseau : le chargeur carburant du Brief prend l'UTC alors que les autres écrans prennent le fuseau de la station.
5. Note globale : l'Indice et son libellé sont recalculés par le Brief à partir des secteurs (`construireVerdictDirection`, seuils 60 / 45 proposés au §11.1) ; la décision du 26/11 retire la note globale du premier niveau (§17.2), la Boussole en garde sa propre lecture.
6. Potentiel : le §16 additionne des gains lus dans Marge+ et dans le Conseiller ; une même perte peut y figurer deux fois (voir §19.2).

### 18.3 Graphique des trois moteurs (décision du 26/11, compléments du gérant)

Un seul graphique, trois séries, pour lire la direction de la station dans le temps : litres piste, CA FDJ, marge des produits boutique. Pas de CA boutique. Il s'ajoute aux trois courbes quotidiennes sur 40 jours (§11.7).

**Autorité : un seul calcul, une seule voix.** Vérifié sur `origin/production` : `NEXUS-Tempo-v2-Mois.html` affiche déjà, mois par mois, la moyenne par jour complet des litres piste et du CA FDJ (`joursLitresCompletsPiste`, `joursCaFdjComplets`, `resumerParJour` de `nexus-tempo.js`, jours de la station, jour en cours exclu). Le Brief consomme ces fonctions et n'écrit aucun second calcul. Pour la boutique, Tempo Mois ne donne pas de marge mois par mois : `resumerMargeImport` ne résume que la période la plus récente. La marge par période est la seule série à construire.

**Fonction nouvelle, une seule : `resumerMargeParPeriode`, dans `nexus-tempo.js`.** Elle rend, pour chaque période importée, la marge moyenne par jour, avec les filtres exacts de `resumerMargeImport` (articles hors produits d'appel, lignes cohérentes : ca > 0, 0 ≤ marge ≤ ca). Raison du rangement chez Tempo : ces filtres y vivent déjà ; la ranger dans le moteur Marge les dupliquerait ; Tempo Mois pourra l'appeler à son tour pour afficher la marge. `resumerMargeImport` pourra en devenir le dernier élément. Elle ne ferait qu'un code de calcul : la marge totale de la période divisée par le nombre de jours calendaires de la période, et le nombre de jours affiché.

**Pas de temps commun : recommandation, les périodes importées.** Les deux options étudiées :
- A. La marge posée sur les mois qu'elle couvre. Défaut : une période importée de 45 jours couvre deux mois, parfois en partie ; il faudrait attribuer une même valeur à deux barres ou couper la période, ce qui invente une marge mensuelle que personne n'a mesurée.
- B (recommandée). Litres et FDJ ramenés aux périodes importées : on appelle `resumerParJour` avec comme bornes les dates de la période, sur `joursLitresCompletsPiste` et `joursCaFdjComplets`. Le calcul est celui de Tempo, seule la fenêtre change. Aucune valeur n'est répartie ni inventée, et les trois séries portent sur les mêmes jours. Écart assumé : la marge est une moyenne sur tous les jours de la période, litres et FDJ sur les jours complets seulement ; le tableau affiche le nombre de jours de chaque série.
Le gérant retrouve les mois dans Tempo Mois, le Brief répond à une autre question (direction commune) sur des périodes qu'il nomme.

**Lecture.**
1. Unités : euros et litres ne partagent pas un axe. Indice base 100 (première période = 100) ; survol et tableau de détail donnent la valeur réelle et l'unité (€/jour, L/jour), plus le nombre de jours.
2. Grammaire de Tempo Mois : barres, couleurs piste, boutique et FDJ de la charte, tableau de valeurs sous le graphique. Les barres partent de la ligne 100 : au-dessus, la série monte ; au-dessous, elle baisse. Libellé de la marge : « période importée ».
3. Période sans import de marge : barre absente, « — » dans le tableau, aucune interpolation. Les autres séries continuent. Si la première période n'a pas de marge, la base de cette série est sa première période disponible, et la légende le dit.
4. Profondeur proposée : 6 périodes importées (environ 6 mois). 12 seulement si litres, FDJ et marge existent sur toute la durée. Aucune période n'est comblée pour atteindre la profondeur.
5. L'indice donne une direction, jamais un niveau : l'écart entre séries ne se lit pas.

Écarts à documenter : la marge ne couvre que les produits importés ; FDJ et carburant n'ont pas de marge dans NEXUS ; l'import étant manuel, la marge peut retarder sur les deux autres séries.

## 19. Marge : quatre lectures, pas d'échelle arbitraire

### 19.1 Pourquoi l'échelle du §12 est abandonnée en l'état

Guardian a rejoué le rapport « marge récupérable / chiffre d'affaires de la période » sur les 7 périodes importées depuis janvier, en approchant les familles de Marge+. Avec l'échelle du §12, toutes les périodes tombent dans les deux paliers les plus sévères : la station serait rouge en permanence. Un indicateur toujours rouge ne dit plus rien. L'échelle du §12 est donc retirée du dossier comme proposition, conservée seulement pour mémoire.

### 19.2 Quatre lectures (décision du 26/11)

Pas d'échelle arbitraire ni de palier chiffré. La Marge se lit en quatre points séparés, sans note :
1. taux réel de la période contre la cible validée de la politique tarifaire (`tarif_seuils`) ; sans cible validée, le taux est montré seul, « objectif à définir » ;
2. évolution sur des périodes comparables (même nature, même périmètre, produits d'appel traités de la même façon) ;
3. anomalies tarifaires confirmées et dédoublonnées (§19.3) ;
4. potentiel de marge estimé, en euros, étiqueté « estimé », avec le moteur et la date de mesure.

Une anomalie durable ne devient pas normale parce qu'elle figure dans l'historique : le Brief n'établit pas de médiane qui l'absorberait, et une anomalie ouverte depuis longtemps est affichée avec son ancienneté. Historique insuffisant pour la lecture 2 : « évolution non mesurée, historique insuffisant ».

Guardian remettra la distribution réelle au gérant hors du canal. Cette fiche n'en cite aucune valeur.

### 19.3 Anomalies communes à Marge+ et au Scanner tarifaire

Les deux moteurs détectent une marge récupérable ; un même article peut être compté deux fois. La clé (site, article, période) ne suffit pas. Deux anomalies sur cette clé n'en font qu'une si trois contrôles concordent :
- la nature de l'écart : écart contre médiane du groupe (Marge+) et écart contre seuil de politique (Scanner tarifaire) sont deux natures distinctes, même sur le même article ;
- le référentiel : médiane, seuil et prix de référence viennent de la même version (période, cible `tarif_seuils` en vigueur) ;
- le recouvrement des gains : on mesure la part de marge récupérable que les deux moteurs revendiquent en commun ; seule cette part est comptée une fois (le plus prudent des deux), le reste s'additionne.

Tant qu'un contrôle manque, les deux anomalies restent séparées et le recouvrement est signalé, pas supposé. Le recouvrement réel n'est pas mesuré ; à faire au lot de calcul.

Aucun seuil ne change sans l'arbitrage du gérant.

## 20. Signaux de risque : quatre états

L'absence de mesure n'est jamais une résolution. États :
- actif : la mesure dépasse le seuil ;
- à vérifier : la mesure est revenue sous le seuil mais n'est pas encore confirmée, ou une action corrective est déclarée sans preuve ;
- résolu : la mesure est revenue sous le seuil de façon confirmée ;
- sans mesure récente : plus de mesure depuis un délai à fixer. Le signal n'est ni actif ni résolu ; il reste visible, grisé.

| Transition | Preuve exigée | Qui la déclenche | Trace conservée |
|---|---|---|---|
| actif vers à vérifier | une mesure sous le seuil, ou l'action corrective déclarée | le moteur (mesure) ou l'utilisateur de la station (déclaration) | date, valeur, auteur ou moteur |
| à vérifier vers résolu | deux mesures consécutives sous le seuil, de dates distinctes (proposition) | le moteur seul ; un humain peut seulement confirmer par commentaire | les deux mesures datées, valeurs, seuil en vigueur |
| actif ou à vérifier vers sans mesure récente | aucune mesure depuis le délai | le moteur | date de la dernière mesure |
| sans mesure récente vers actif ou à vérifier | une nouvelle mesure | le moteur | la mesure |
| résolu vers actif | une mesure au-dessus du seuil | le moteur | la mesure, rattachée au même signal |

Les preuves de résolution et les délais de fraîcheur dépendent du type de risque et de la fréquence normale d'alimentation du moteur concerné : un signal alimenté chaque jour ne tolère pas le même délai qu'un signal alimenté par import mensuel, et le nombre de mesures de confirmation suit la même logique. Le tableau des délais par type de risque est à produire au lot de calcul, à partir de la fréquence réelle de chaque moteur ; aucun délai unique n'est proposé ici. Rien ne passe à « résolu » sur la seule absence de mesure ni sur la déclaration d'un humain. Les traces sont ajoutées, jamais modifiées. Le délai de « sans mesure récente » et le nombre de mesures de confirmation sont des propositions à arbitrer. Un signal résolu ou sans mesure récente reste lisible au niveau 3.

## 21. Dossier d'arbitrage

Un sujet par bloc. Rien n'est écrit comme validé. Le gérant choisit.

| Sujet | Options | Conséquences |
|---|---|---|
| Échelle de Marge | décidé : pas d'échelle, quatre lectures (§19.2) | une anomalie durable n'est pas normalisée ; la lecture « évolution » exige un historique suffisant |
| Note globale | décidé : trois lectures séparées, nom Boussole conservé, ni note ni tendance globale (§17.2) | plus de seuil ni de pondération à arbitrer ; libellés des lectures à valider |
| Couvertures | décidé : option B, non applicable distinct d'indisponible (§17.1) | notes de couvertures différentes non strictement comparables, couverture toujours affichée |
| Autorité Commerce | décidé : `audits_caisse.vente_boutique` pour le suivi, périodes importées pour l'analyse (§18.1) | deux périmètres étiquetés, écarts résiduels documentés |
| Graphique des trois moteurs | autorité Tempo pour litres et FDJ ; `resumerMargeParPeriode` à créer dans `nexus-tempo.js` ; pas = périodes importées ; profondeur 6 (§18.3) | recommandation B, le gérant tranche pas et profondeur |
| Schéma des objectifs | trois horizons, saisie annuelle de référence à l'étude (§16.b) ; `station_objectifs` ou autre | aucune migration avant validation du modèle final |
| Fermeture des risques | règle du §20 ; règle plus simple ; règle plus stricte | selon le nombre de mesures de confirmation et le délai « sans mesure récente » |


### 21.bis Décisions du gérant du 26/11 (après visa de la maquette bureau)

Le visa porte sur la maquette seule. Il ne vaut ni GO de code, ni de migration, ni de changement de moteur.

| Sujet | Décision |
|---|---|
| Statut de la carte Marge | **Taux contre cible.** « Sous la cible » ou « Cible atteinte », selon la cible tarifaire validée : règle `defaut`, sinon moyenne pondérée par le CA, sinon aucune cible et aucun statut de cible. Les anomalies confirmées sont affichées à part, en nombre et en euros, sans note et sans barème. |
| Objectifs | **L'objectif annuel d'abord.** Le gérant fixe l'année. NEXUS propose les mois et les trimestres à partir de l'historique et de la saisonnalité, modifiables, à valider explicitement. |
| Rangement | **Nouvelle table `station_objectifs`**, acceptée dans son principe : versionnée, droits par station, sans modification ni suppression. Aucune migration avant le GO du gérant sur le schéma définitif. |
| Étape suivante | **Audit des moteurs** (`docs/audit/audit-moteurs-nexus.md`), avant la version mobile et avant tout code. |

Ces lignes complètent le tableau ci-dessus sans le réécrire : les propositions antérieures (§16.b, §19.2) restent lisibles comme historique.

Aucun code, aucune migration, rien en Production avant le GO du gérant.

## 22. Icônes utilisées (registre `nexus-icones.js`, `assets/icones`)

Aucune icône dessinée pour la maquette. Fichiers vérifiés présents. Aucune icône manquante : rien à demander.

| Bloc | Id | Fichier |
|---|---|---|
| Page, en-tête | `mod-brief` | `assets/icones/v2/mod-brief/mod-brief-24.svg` |
| Lecture Performance économique | `mod-resultats` | `assets/icones/v2/mod-resultats/mod-resultats-24.svg` |
| Lecture Maîtrise opérationnelle | `mod-verify` | `assets/icones/v2/mod-verify/mod-verify-24.svg` |
| Lecture Fiabilité des données | `tempo-fiabilite-donnees` | `assets/icones/tempo/simple/tempo-fiabilite-donnees.svg` |
| Secteur Carburant | `mod-carburants` | `assets/icones/v2/mod-carburants/mod-carburants-24.svg` |
| Secteur Commerce | `mod-produits` | `assets/icones/v2/mod-produits/mod-produits-24.svg` |
| Secteur FDJ | `mod-fdj` | `assets/icones/v2/mod-fdj/mod-fdj-24.svg` |
| Secteur Opérations | `mod-prise-de-poste` | `assets/icones/v2/mod-prise-de-poste/mod-prise-de-poste-24.svg` |
| Secteur Marge | `mod-capital` | `assets/icones/v2/mod-capital/mod-capital-24.svg` |
| Histogramme des trois moteurs | `tempo-comparaison-historique` | `assets/icones/tempo/simple/tempo-comparaison-historique.svg` |
| Potentiel financier | `mod-evolution` | `assets/icones/v2/mod-evolution/mod-evolution-24.svg` |
| Décisions prioritaires | `mod-assignations` | `assets/icones/v2/mod-assignations/mod-assignations-24.svg` |
| Évolution 40 jours / 6 mois | `mod-tempo` | `assets/icones/v2/mod-tempo/mod-tempo-24.svg` |
| Rapport A4 | `mod-rapport` | `assets/icones/v2/mod-rapport/mod-rapport-24.svg` |

Le bloc Objectifs n'a pas d'icône propre : ses titres sont textuels. À confirmer par le gérant si une icône est souhaitée (`mod-progression` existe au registre).

## 23. Éléments dynamiques (complément du gérant, 26/11)

Autorisés quand ils aident la lecture, montrés dans la maquette 1280, Jour et Nuit :
- jauges et barres qui se remplissent au chargement, une seule fois, 300 ms au plus ;
- survol, focus, clic et clavier révèlent la valeur réelle avec son unité (info-bulle ; Échap la ferme) ;
- histogramme : puces pour afficher ou masquer chaque série (au moins une reste active) ;
- détail repliable sur chaque carte secteur (`<details>`) ;
- courbes : bascule 40 jours / 6 mois ; 12 mois grisé tant que l'historique manque (9 mois aujourd'hui) ;
- tableau de valeurs de l'histogramme, accessible à la demande, présent dans le DOM.

Règles : animation au service de la lecture, jamais décorative ; rien ne se rejoue au survol ; `prefers-reduced-motion` coupe toute animation et la page reste complète ; ce qui s'ouvre au survol s'ouvre aussi au clic et au clavier, avec focus visible ; aucune information n'existe seulement dans une animation ou une info-bulle.

**Aucune bibliothèque externe.** HTML, CSS et JavaScript natifs, SVG en ligne. Rien à proposer en poids ni en justification.

## 24. Vue mobile (orientation du gérant, 26/11 ; rien à produire avant validation du bureau)

En mobile, le Brief va à l'essentiel : ce n'est pas la page bureau empilée. Premier écran limité à ce qui décide de la journée.

| Bloc | Mobile |
|---|---|
| Bandeau d'en-tête | version recadrée ou réduite au logo et au titre (à produire après validation du bureau) |
| Fiabilité des données | reste, en une ligne |
| Trois lectures | restent, en tendance et en mots, sans graphique lourd |
| Risques confirmés | restent, nommés |
| Trois priorités du jour | restent, chacune avec son action |
| Cartes secteur détaillées | se replient derrière un accès clair |
| Histogramme comparatif | n'y figure pas (bureau seulement) |
| Courbes 40 jours / 6 mois | n'y figurent pas (bureau seulement) |
| Objectifs | se replient derrière un accès clair |
| Potentiel financier | se replie derrière un accès clair |
| Rapport A4 | se replie derrière un accès clair |

Le découpage replié ou réservé au bureau est une proposition à valider avec la maquette bureau. La maquette mobile ne sera produite qu'après cette validation.

## 25. Corrections de la recette visuelle (26/11)

- **Fiabilité.** Commerce suit les ventes quotidiennes, il ne dépend plus de l'import : le bloc affiche « 4 / 5 secteurs à jour », seule la Marge reste sur l'import du 14/11. Les badges des cartes disent la même chose.
- **Légendes.** Les légendes de Carburant et de Commerce nomment les sept derniers jours, comme les barres.
- **Objectifs.** Un objectif validé montre sa jauge et son pourcentage ; un objectif en proposition montre la valeur proposée et un bouton « Valider », jamais un pourcentage ni une jauge (règle du §14).
- **Taux de marge.** Il apparaît une seule fois au premier niveau, dans la carte Marge.
- **Potentiels.** « Marge à récupérer » est un fait (anomalies confirmées, chiffrées) ; « Potentiel de marge estimé » est une estimation sans anomalie confirmée. Les deux ne s'additionnent jamais.
- **Histogramme.** « Pas d'import » est écrit à la verticale dans l'emplacement vide de la série marge ; la période 1 porte la marque « base 100 ».
- **Opérations.** Le cadre vide est remplacé par les écarts des sept derniers jours en barres.
- **Nuit.** Les icônes des lectures reposent sur une pastille claire pour garder leur contraste.
