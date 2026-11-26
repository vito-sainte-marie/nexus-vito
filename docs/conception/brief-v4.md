### Fiche de conception : Brief v4

Référentiel appliqué : NEXUS-REFERENTIEL-CONCEPTION v1.0

Statut : brouillon pour relecture. Aucun code n'est modifié par cette fiche. Rien en Production.
Origine : demande de Guardian (#383, commentaire 7198957693) : « Je te demande d'abord une fiche de conception, sans code. »
Maquette : `docs/conception/maquettes/brief-v4.html` (données fictives, bouton Jour / Nuit, cadres 1280 et 375).

## 0. Décisions du gérant reprises telles quelles

1. Le secteur Équipe sort du Brief : pas de carte, pas de place dans le radar ni dans l'Indice, pas de signaux Équipe. Raison : `pointages` n'est plus alimentée depuis août.
2. La fiabilité des données va dans l'en-tête : nombre de secteurs mesurés sur 5, et date réelle des données de chaque secteur.
3. L'objectif de marge est la cible de la politique tarifaire (`tarif_seuils`, champ `cible`, vue `v_tarif_seuils_actifs`). Plus de référence fixe à 25 %. Aucune cible n'est saisie en Production : Performance Marge est « non mesurée » (neutre, jamais pénalisée). La carte dit « Objectif de marge à définir dans Produits », avec un lien.
4. Courbe d'évolution sur 40 jours. Données quotidiennes disponibles : volumes carburant, ventes boutique (`audits_caisse.vente_boutique`), chiffre FDJ. Une grandeur par axe. La marge n'existe que par période importée : un point par période, jamais une ligne quotidienne.

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
- Marge : un point par période importée, sur sa propre rangée, jamais une ligne quotidienne.
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
- La recette de l'interface reste celle de Guardian : une CI verte ne la valide pas.

## 15. Découpage en lots courts (une PR brouillon chacun)

- Lot A, calculs : Indice à 4 secteurs, bandeau recentré, Maîtrise Marge en euros, Opérations en écarts absolus, fuseau de la station, Équipe retirée du moteur, objectif de marge lu dans `tarif_seuils`, classement stable. Épreuves de valeurs et de fuseau.
- Lot B, en-tête et disposition : fiabilité des données, bloc État global, trois indicateurs, grille, priorités, accès au rapport A4, Jour et Nuit, 375 et 1280.
- Lot C, courbe sur 40 jours : chargement des séries quotidiennes, rendu, états vides, tableau de valeurs.
- Lot D, signaux de risque : règle de fermeture et affichage.

Ordre : A, puis B, puis C et D indépendants. Rien en Production sans GO. Aucune fusion sans GO écrit du gérant. Le déploiement de #391 reste à l'approbation du gérant ; la disposition bureau est ce lot B, ouvert sur instruction du gérant seulement.
