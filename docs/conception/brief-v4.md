### Fiche de conception : Brief v4

Référentiel appliqué : NEXUS-REFERENTIEL-CONCEPTION v1.0

Statut : brouillon pour relecture. Aucun code n'est modifié par cette fiche. Rien en Production.
Origine : demande de Guardian (#383, commentaire 7198957693) : « Je te demande d'abord une fiche de conception, sans code. »
Maquette : `docs/conception/maquettes/brief-v4.html` (données fictives, bouton Jour / Nuit, cadres 1280 et 375).

## 0. Décisions du gérant reprises telles quelles

1. Le secteur Équipe sort du Brief : pas de carte, pas de place dans le radar ni dans l'Indice, pas de signaux Équipe. Raison : `pointages` n'est plus alimentée depuis août.
2. La fiabilité des données va dans l'en-tête : nombre de secteurs mesurés sur 5, et date réelle des données de chaque secteur.
3. L'objectif de marge est la cible de la politique tarifaire (`tarif_seuils`, champ `cible`, vue `v_tarif_seuils_actifs`). Plus de référence fixe à 25 %. Aucune cible n'est saisie en Production : Performance Marge est « non mesurée » (neutre, jamais pénalisée). La carte dit « Objectif de marge à définir dans Produits », avec un lien.
4. Courbe d'évolution sur 40 jours. Données quotidiennes disponibles : volumes carburant, ventes boutique (`audits_caisse.vente_boutique`), chiffre FDJ. Une grandeur par axe.

Complément du gérant (Guardian, 7199090542) :

5. Aucune marge dans le graphique d'évolution. La marge devient un indicateur à part : taux réel de la période comparé à la cible de la politique tarifaire, avec la date de la période.
6. Le Brief fait connaître au gérant sa performance, son potentiel et ses objectifs à court, moyen et long terme. NEXUS le guide : le Brief dit « où je vais et ce qui me sépare de l'objectif ». Voir §16 et le lot E.

## 1. Utilisateur cible

Le gérant, à son bureau le matin (1280) et debout sur le téléphone (375). Il ouvre le Brief pour savoir si la station va bien et quoi faire en premier. Il n'est pas là pour saisir.

## 2. Besoin principal

« Où en est la station, et que dois-je faire aujourd'hui ? » en moins de dix secondes, avec la preuve que les chiffres sont frais.

## 3. Trois informations à comprendre en premier

1. L'état global : l'Indice sur 100 et son statut, ou « Indice non calculé : N secteurs mesurés sur 5 ».
2. Les trois indicateurs clés, chacun daté : volumes carburant, chiffre boutique, marge réelle contre son objectif.
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

Aucune demandée. Les couleurs viennent des jetons, les états de `nexus-badge-etat.js`, aucun emoji en guise d'état.

## 11. Contenu de chaque carte

Règle générale : une carte = une question, 4 données au plus, un chiffre n'apparaît qu'une fois au niveau 1, chaque chiffre porte sa date ou sa période.

### 11.1 État global
- Question : la station est-elle sous contrôle ?
- Source : notes des secteurs mesurés.
- Formule : moyenne arrondie des notes des secteurs mesurés. Une note de secteur = 50 + Performance + Maîtrise, bornée à [0, 100] (inchangé).
- Période : jour de données le plus ancien des secteurs retenus, affiché.
- Seuil : calculé seulement si au moins 4 secteurs sur 5 sont mesurés. Sinon « Indice non calculé : N secteurs mesurés sur 5 », secteurs manquants listés.
- Bandeau recentré sur le neutre : un secteur stable vaut 50. Le rouge est réservé à un secteur au statut « À corriger ». Seuils exacts proposés : à valider (§13).
- Vide : voir §9.

### 11.2 Volumes carburant
- Source : relevés carburant (même chargeur qu'aujourd'hui).
- Période : jour, avec le repli sur le dernier jour disponible affiché en clair.
- Fuseau : celui de la station partout (aujourd'hui `chargerCarburantsBriefAvecFallback` ignore le fuseau passé et prend l'UTC).
- Vide : « non mesuré », raison.

### 11.3 Chiffre boutique
- Source : `audits_caisse.vente_boutique`.
- Période : dernier quart audité, date réelle.
- Vide : « non mesuré ».

### 11.4 Marge réelle contre objectif
- Source : marge de la période importée ; objectif = `tarif_seuils.cible` via `v_tarif_seuils_actifs`.
- Indicateur à part, jamais tracé dans la courbe d'évolution (décision 5). Il montre le taux réel de la période, la cible de la politique tarifaire et l'écart en points, avec la date de la période.
- Période : la période importée, dates de début et de fin. Rappel d'import si les données ont plus de 15 jours.
- Sans objectif saisi (cas actuel) : « Marge mesurée, objectif à définir dans Produits » avec lien. Performance Marge « non mesurée », neutre. Le texte « pour une référence de 25 % » disparaît.
- Sans import : « non mesurée ».

### 11.5 Cartes secteur (Carburant, Commerce, Marge, FDJ, Opérations)
Chaque carte : nom et icône, note /100, statut métier (`statutMetier`), petite tendance, bouton « Détails ». Un secteur non mesuré est gris, avec sa raison. La couleur de la note vient du statut métier, jamais de seuils numériques.

- Carburant : performance = volumes contre la référence actuelle ; maîtrise = écarts de stock. Période : jour de données.
- Commerce : performance boutique. Date réelle affichée. Rappel d'import après 15 jours.
- Marge : voir 11.4 pour la performance. Maîtrise Marge mesurée en euros (voir §12).
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
- Alternative texte : tableau des valeurs sous la courbe, ouvert à la demande.

### 11.8 Signaux de risque
- Aujourd'hui, les trois premiers après tri par urgence puis niveau. Ils s'accumulent sans jamais se fermer.
- Règle de fermeture proposée (décision du gérant) : un signal se ferme quand sa mesure revient sous son seuil deux jours consécutifs, ou après 30 jours sans nouvelle mesure, avec la mention « clos, plus de mesure ». Un signal clos reste lisible au niveau 3.

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

Proposition à arbitrer : échelle de Maîtrise Marge. Aujourd'hui elle compte les articles en écart (`contributionMaitriseEcarts` : 0 → +10, jusqu'à 2 → −5, jusqu'à 5 → −15, au-delà → −25), si bien que beaucoup de petits écarts plafonnent la pénalité. Mesure proposée : gain potentiel des écarts (en euros) rapporté au chiffre d'affaires de la période.

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
4. Règle de fermeture des signaux du §11.8.
5. Seuil de rappel d'import : 15 jours pour Commerce et Marge ?
6. Objectifs (§16) : durées des horizons proposées (court = mois civil, moyen = trimestre civil, long = année civile) : à valider.
7. Objectifs : qui saisit ? Proposition : le gérant, ou le gérant de station, depuis un écran « Objectifs de la station » ; le Brief reste en lecture.
8. Objectifs : valeurs de départ proposées à partir de l'historique réel de la station (moyenne des mêmes périodes passées), toujours affichées comme proposition, jamais enregistrées sans validation. D'accord ?
9. Objectifs : table nouvelle `station_objectifs` (§16.c) acceptée dans son principe, avant toute migration ?
10. Objectifs : quelles grandeurs au démarrage ? Proposition : volumes carburant, ventes boutique, chiffre FDJ, taux de marge. Les trois premières n'ont aujourd'hui aucun objectif nulle part.

## 14. Épreuves prévues

- Non-régression des valeurs : à jeu de données identique, les notes des secteurs inchangés (Carburant, FDJ) sont identiques à origin/production. Les notes qui changent (Marge, Opérations, Indice) sont listées avec avant / après sur données fictives.
- Cibles cliquables : chaque bouton ou lien du Brief a une destination réelle et mesure au moins 44 px ; aucun bouton sans cible.
- Fuseau : jeu de données à cheval sur minuit UTC, station en heure d'été et en heure d'hiver ; les fenêtres FDJ, Opérations et Carburant coupent à minuit de la station.
- Indice : 3 secteurs mesurés → « non calculé » ; 4 → calculé ; liste des manquants exacte.
- Équipe : aucune lecture de `pointages` ni de `coach_daily_recommendations` ; aucune carte Équipe.
- Marge : sans objectif, « non mesurée » et aucune pénalité ; avec objectif, comparaison correcte.
- Classement stable : deux jours consécutifs sans changement de données donnent le même ordre.
- Charte : `test_charte_interface.js` inchangé en rouge, jetons uniquement, pas d'emoji, Jour et Nuit.
- Épreuves déjà liées au Brief : test_badge_etat_brief_20261109.js, test_brief_chargement_dynamique.js, test_brief_vague3_20261109.js, test_carburant_brief_fallback_verifie_v2248.js, test_carburant_brief_rapport_economie.js, test_connexion_carte_brief_20261126.js.
- Lot E : un objectif sans valeur validée n'est jamais affiché comme atteint ni comme manqué ; « à ce rythme » n'apparaît que si la période est assez avancée et la grandeur assez mesurée (jeu fictif en dessous du minimum : aucune projection) ; potentiel : deux gains de natures différentes ne s'additionnent jamais (épreuve sur des gains en euros de marge et des litres commandés) ; une proposition de départ est marquée « proposition » tant qu'elle n'est pas validée ; politique RLS de `station_objectifs` : un gérant d'une autre station ne lit ni n'écrit, un employé ne peut pas insérer, aucune modification ni suppression ; chaque priorité du Conseiller nomme l'objectif qu'elle sert, ou « sans objectif lié » en clair.
- Marge : l'indicateur affiche le taux de la période, la cible et la date ; aucune série de marge dans le graphique.
- La recette de l'interface reste celle de Guardian : une CI verte ne la valide pas.

## 15. Découpage en lots courts (une PR brouillon chacun)

- Lot A, calculs : Indice à 4 secteurs, bandeau recentré, Maîtrise Marge en euros, Opérations en écarts absolus, fuseau de la station, Équipe retirée du moteur, objectif de marge lu dans `tarif_seuils`, classement stable. Épreuves de valeurs et de fuseau.
- Lot B, en-tête et disposition : fiabilité des données, bloc État global, trois indicateurs, grille, priorités, accès au rapport A4, Jour et Nuit, 375 et 1280.
- Lot C, courbe sur 40 jours : chargement des séries quotidiennes, rendu, états vides, tableau de valeurs.
- Lot D, signaux de risque : règle de fermeture et affichage.
- Lot E, objectifs et potentiel (présenté séparément, §16) : écran de saisie des objectifs, bloc « Objectifs et potentiel » du Brief, objectif servi sur chaque priorité. Il commence après la revue de la fiche et le GO du gérant sur le modèle ; la table n'est créée qu'après un GO explicite sur la migration.

Ordre : A, puis B, puis C et D indépendants ; E après B et après le GO sur le modèle. Rien en Production sans GO. Aucune fusion sans GO écrit du gérant. Le déploiement de #391 reste à l'approbation du gérant ; la disposition bureau est ce lot B, ouvert sur instruction du gérant seulement.

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
- somme des gains déjà mesurés par les moteurs, par nature : euros de marge (Marge+, Scanner tarifaire), euros de pertes évitables (écarts de caisse, stock non compté), litres à commander (carburant). Chaque nature est affichée avec son propre chiffre et son unité ; jamais d'addition d'euros de natures différentes.
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
