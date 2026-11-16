# NEXUS · Référentiel de conception et d'expérience

Version 1.0 du 16/11/2026. Validé par le gérant le 16/11/2026. Toute évolution de ce référentiel est un changement de doctrine : elle passe par l'arbitrage du gérant.

## 1. Objet

Ce référentiel rend obligatoire, pour toute nouvelle interface NEXUS et toute modification significative d'une interface existante, une conception centrée sur la décision : comprendre où l'on est, ce qui compte, ce que cela signifie et quoi faire, puis seulement les détails.

Il complète la doctrine existante sans la remplacer :

- Constitution NEXUS (`NEXUS-Constitution-v1.md`) : article 5 (la vérité avant la certitude), article 12 (le langage du Conseiller), article 13 (le test NEXUS).
- Guardian Philosophie (`docs/gouvernance/GUARDIAN-PHILOSOPHIE-NEXUS.md`).
- Lexique du Conseiller (`nexus-vocabulaire.js`) : Constat, Explication, Décision.
- Charte des états (`nexus-badge-etat.js`) et registre des icônes (`nexus-icones.js`).

Il ne crée ni palette, ni police, ni composant concurrent. Là où l'existant diverge, il désigne une référence et renvoie la mutualisation à un lot distinct.

## 2. Audit des références (commit 68753f96)

NEXUS dispose déjà de briques partagées solides, mais coexistent deux systèmes de jetons de couleur et deux palettes d'états, et les jetons Tempo sont recopiés page par page.

### Briques partagées

| Fichier | Rôle | Utilisé par |
| --- | --- | --- |
| `nexus-theme.js` | Modes Sombre, Jour, Auto posés sur `<html data-theme>` avant rendu | Tempo, Paye, Accueil, Campagne, Produits |
| `nexus-icones.js` | Registre unique des icônes de modules, catégories et rôles | toutes les pages auditées |
| `nexus-badge-etat.js` | Charte des états : gravité, traitement, action, qualification, priorité | Produits, Cockpit |
| `nexus-etats-conseiller.js` | Clé stable des états du Conseiller | Accueil, Cockpit |
| `nexus-composants-pilotage.js` | Anneau, pastilles, bouton « i », tuile d'indicateur (copie de Paye) | Contrôle inventaire |
| `nexus-banniere-station.js` | Photo de station Jour et Nuit | Accueil, Paye, Tempo |
| `nexus-vocabulaire.js` | Lexique du Conseiller | Tempo, Campagne, Produits, Cockpit |
| `nexus-desktop.js`, `nexus-header-nav.js`, `nexus-menu-accueil.js` | Vue bureau, en-tête, menu | selon les pages |
| `assets/avatar/nexus-avatar-*.png` | Avatar officiel du Conseiller | Accueil, Paye, Campagne, Produits |

### Pages de référence

| Page | Apport | Jetons | Remarque |
| --- | --- | --- | --- |
| Tempo v2 et sous-pages | Hiérarchie, cartes à bordure fine, pastilles, niveaux de preuve, détails repliés | `--t-*` | Référence visuelle principale |
| Paye | Fiches salarié claires, anneaux, bouton « i », navigation | historiques | Paye n'est pas rebranchée sur `nexus-composants-pilotage.js` |
| Accueil employé (`NEXUS-App-v1.html`, `nexus-accueil-piste.js`) | Identité, bannière station, parcours court | historiques | Police Inter en plus de Plex ; emojis d'état |
| Campagne v2 | Navigation par espaces métier | `--t-*` | Proche de Tempo |
| Produits | Fiche produit, recherche, déclarations | `--t-*` | Vues encore très textuelles |
| Scanner NEXUS, Cockpit | Contre-exemples | historiques | Emojis d'état |

### Divergences, à traiter en lots distincts

1. Jetons `--t-*` définis dans 13 pages au lieu d'un fichier partagé.
2. Deux palettes d'états : Tempo et `nexus-badge-etat.js`.
3. Paye n'utilise pas `nexus-composants-pilotage.js`, dont elle est la source.
4. Rayons de bordure dispersés (2 à 30 px).
5. Emojis d'état sur l'Accueil, le Cockpit et Scanner NEXUS.

## 3. Canevas et niveaux de lecture

Le canevas impose une logique de compréhension, pas une page type. Une page employé privilégie l'action, une page manager les contrôles, une page gérant la compréhension des résultats et la décision. Chaque bloc doit répondre à un besoin réel : une page n'a pas forcément quatre indicateurs, un Conseiller ou des chevrons.

- A. Identité : icône officielle ou illustration, titre, sous-titre d'une ligne, station et période.
- B. Synthèse : 3 ou 4 cartes d'indicateurs, unité et période visibles, limite de fiabilité écrite sur la carte concernée.
- C. Conseiller : ce que la synthèse ne dit pas déjà (priorité, explication, point de départ).
- D. Navigation et actions : cartes à destination réelle, verbe d'action explicite.
- E. Détails et preuves : sources, méthodes, rapprochements, historiques, derrière un chevron ou dans un écran dédié.

| Niveau | Question du lecteur | Blocs | Temps visé |
| --- | --- | --- | --- |
| 1 | Où en suis-je ? | A, B | quelques secondes |
| 2 | Que dois-je regarder ou faire ? | C, D | moins d'une minute |
| 3 | Pourquoi, et sur quelles données ? | E | à la demande |

Un élément du niveau 3 ne monte au niveau 1 que s'il change la décision ou touche à la sécurité. Un seul niveau de chevron par section.

### Budget du premier écran

À 375 × 812 px sur téléphone et 1280 × 800 px sur ordinateur, sans défiler, l'utilisateur voit la fonction de la page, sa situation principale et l'action attendue.

- Pas d'introduction longue, pas d'en-têtes empilés, un seul bloc Conseiller par écran.
- Une sous-page dont l'en-tête général est déjà affiché prend une identité compacte : icône, titre et période sur une ligne.
- Un tableau reste permis quand il est l'outil de travail (liste de contrôle, espace de comparaison) ; il n'est pas le premier écran d'un tableau de bord.

### Canevas par type de page

| Type | Exemple | A | B | C | D | E |
| --- | --- | --- | --- | --- | --- | --- |
| Tableau de bord de direction | Tempo, accueil Produits | oui | 3-4 cartes | oui | cartes d'espaces | chevrons |
| Espace d'analyse | Scanner tarifaire | oui | 3-5 cartes | oui | cartes de contrôle, liste complète filtrable | méthode une fois par carte |
| Fiche individuelle | fiche produit, fiche salarié | photo ou icône, nom | 3-4 chiffres | si un signal existe | actions de la fiche | historique, sources |
| Parcours employé | prise de poste, missions | court | progression | consigne d'une phrase | une action principale | aide à la demande |
| Saisie ou paramétrage | Paramètres station | oui | non | non | formulaire et confirmation | règles et historique |

## 4. Profils de conception

Le profil choisit la densité et le ton ; il ne change jamais les droits. Les permissions restent celles de la base et de `nexus-auth.js`.

| | Employé polyvalent | Manager | Gérant ou dirigeant |
| --- | --- | --- | --- |
| Support prioritaire | téléphone, 375 px | téléphone et bureau | bureau puis téléphone |
| Premier écran | la tâche du moment et sa progression | les contrôles et anomalies à traiter | la performance et ce qui la fait bouger |
| Chiffres | ceux de sa mission, sans montant financier inutile | ceux du contrôle, avec écarts | CA, marge, contribution, comparaisons fiables |
| Actions | une action principale, bouton de 44 px minimum, confirmation claire | valider, justifier, assigner, avec historique | décider, arbitrer, ouvrir la preuve |
| Ton du Conseiller | coach : consigne courte | directeur d'exploitation : priorité et raison | conseil : constat, explication, décision |
| Détails | aide à la demande | historique des actions | preuves, sources, méthodes |

## 5. Charte et composants

### Charte commune

- Thème : `nexus-theme.js` dans le `<head>`, valeurs Sombre dans `:root`, Jour dans `:root[data-theme="jour"]`. Toute page est vérifiée dans les deux modes.
- Jetons : la famille Tempo `--t-*` est la référence de l'environnement graphique des nouvelles pages (`--t-bg`, `--t-panel`, `--t-raised`, `--t-line`, `--t-text`, `--t-mid`, `--t-cyan`, `--t-green`, `--t-amber`). Aucune couleur en dur dans une nouvelle page.
- États métier : `nexus-badge-etat.js` (critique, à vérifier, information, conforme ; en attente, exclu ; agir, décider, vérifier, surveiller). Gravité, activité et action restent trois systèmes distincts ; pas de palette concurrente. La gravité et l'action sont deux badges distincts. Le sens est toujours écrit : la couleur ne porte jamais seule l'information.
- Typographie : IBM Plex Sans pour le texte, IBM Plex Mono pour les chiffres et les rangs.
- Cartes : bordure fine complète `1px solid var(--t-line)`, fond `--t-panel`, sans lueur. Rayons des nouvelles interfaces : 12 px pour une carte, 8 px pour un badge ou un bouton. Exceptions admises : pastilles, anneaux, illustrations, composants officiels existants, contraintes d'accessibilité. Les pages existantes ne sont pas reprises pour uniformiser leurs rayons.
- Icônes : `nexus-icones.js` et `assets/icones/`. Une icône manquante est demandée sur #160, jamais dessinée à la volée. Aucun emoji comme état métier.
- Conseiller : avatar officiel, lexique `nexus-vocabulaire.js`, ton de l'article 12.

### Catalogue

| Composant | Rôle | Référence actuelle | Statut |
| --- | --- | --- | --- |
| En-tête de module | Bloc A | Tempo v2, Paye (`entete-texte`) | local, à mutualiser |
| Carte d'indicateur | Un chiffre, son unité, sa période, une limite | `tuile` de `nexus-composants-pilotage.js`, `valeur` de Tempo | partagé en partie |
| Carte de navigation | Ouvre un espace | tuiles Produits, Campagne | local |
| Carte Conseiller | Avatar, synthèse, point de départ | Accueil, Campagne, Produits | local, 3 variantes |
| Carte de contrôle ou d'anomalie | Icône, titre, nombre, montant, chevron, détail replié | Scanner tarifaire (en cours) | nouveau |
| Carte de performance | Indicateur avec comparaison fiable | Tempo (`barre`, `pastilles`) | local |
| Fiche produit compacte | Photo `product_photos` ou icône, nom, famille, 3 chiffres, lien | `vp-ligne-prod` de Produits | local |
| Fiche salarié | Identité, statut, chiffres de paye | Paye | local |
| État et badge | Gravité, traitement, action, priorité | `nexus-badge-etat.js` | partagé |
| Chevron et section dépliable | Niveau 3, un seul niveau d'imbrication | `details.comprendre` Produits, `detail-btn` Tempo | deux variantes |
| Tableau de données | Liste complète ou outil de travail | Inventaire, Paye | local |
| Formulaire | Saisie, déclaration, justification | déclarations Produits, Paramètres | local |
| Recherche et filtres | Recherche, tri, filtres cumulables | Mes produits | local |
| Chargement, erreur, absence de données | Message honnête | dispersé | à normaliser |
| Confirmation d'action | Ce qui a été enregistré, par qui, annulable ou non | déclarations Produits, Paye | local |

Réutiliser avant de créer. Un composant local n'est pas recopié pour une petite différence visuelle. Une mutualisation passe par un lot borné, avec ses tests et sans changement de comportement.

## 6. Règles de lisibilité

1. Une carte répond à une seule question, écrite dans son titre.
2. Le chiffre principal est le plus grand texte de la carte, en Plex Mono, avec son unité.
3. Un même chiffre n'apparaît qu'une fois au niveau 1. Deux montants de nature différente ne s'additionnent jamais.
4. Une action est un verbe (« Justifier », « Ouvrir la fiche »). Jamais un bouton sans effet.
5. Une explication répétée sur chaque ligne est écrite une seule fois, en tête de liste ou derrière un chevron.
6. Les termes techniques gardent leur nom exact, avec une aide « i » d'une phrase.
7. Une liste de plus de 10 lignes a une recherche, un tri, des filtres, et montre d'abord les 10 premières.
8. Simplifier un écran ne supprime pas une donnée : elle descend au niveau 3.
9. L'ordre de lecture suit l'importance : grave avant secondaire, décision avant preuve.
10. Pas de paragraphe de plus de 3 lignes aux niveaux 1 et 2. Pas de carte à plus de 4 données.
11. Une donnée incertaine le dit sur la carte (« estimée », « hypothèse à vérifier », « donnée insuffisante »).

## 7. Fiche de conception

Avant de coder un lot significatif (nouvelle page, nouvel espace, nouvelle carte, changement de la structure A à E), CC publie sur #160 une fiche courte et attend la revue de Guardian. Un lot mineur (libellé, couleur d'état, alignement, correction de recette) n'a pas de fiche ; sa PR cite la règle appliquée.

```markdown
### Fiche de conception : <page ou espace>
Référentiel appliqué : NEXUS-REFERENTIEL-CONCEPTION v<version>
1. Utilisateur cible : employé | manager | gérant
2. Besoin principal : <une phrase>
3. Trois informations à comprendre en premier : <1>, <2>, <3>
4. Actions possibles : <verbe + destination réelle>
5. Canevas : <type de page>, blocs A-E retenus et blocs écartés
6. Composants réutilisés : <fichier ou page de référence>
7. Réservé aux détails : <sources, méthodes, historiques>
8. Premier écran à 375 × 812 et 1280 × 800 : <ce qui est visible sans défiler>
9. États : chargement, aucune donnée, erreur, donnée non fiable
10. Exceptions à la charte et leur raison : <aucune | liste>
11. Maquette : <capture du prototype ou schéma, si le changement le justifie>
```

## 8. Recette

Une interface n'est validée que sur des écrans réellement exécutés avec des données représentatives. Une maquette statique ne prouve rien. Les tests automatiques protègent contre les régressions ; ils ne jugent pas la qualité cognitive. Une CI verte ne valide pas une interface.

| Critère | Contrôle | Qui |
| --- | --- | --- |
| Valeurs affichées identiques aux moteurs | test de non-régression | CI, puis Guardian sur données représentatives |
| Aucune couleur en dur, jetons `--t-*` | analyse du CSS | `test_charte_interface.js` |
| Aucun emoji d'état | recherche de caractères | `test_charte_interface.js` |
| Icônes présentes | chemins vérifiés | `test_charte_interface.js` |
| Chaque cible cliquable mène quelque part | clic dans le harnais | Guardian |
| Pas de débordement ni de chevauchement | 375, 768 et 1280 px | Guardian |
| Jour et Nuit lisibles | captures dans les deux modes | Guardian |
| Contraste des textes et chiffres | mesure sur les jetons | Guardian |
| Clavier : focus visible, ordre logique | tabulation | Guardian |
| États chargement, vide, erreur | données simulées | Guardian |
| Premier écran compris | test de compréhension | Guardian |
| Safari iOS | appareil réel si disponible ; sinon, écrit comme non fait | Guardian |
| Fonctions existantes conservées | parcours avant et après | Guardian |

### Test de compréhension NEXUS

À partir de l'interface exécutée, du point de vue du rôle cible, Guardian répond par écrit à cinq questions. Une réponse impossible ou hésitante est un écart de recette.

1. À quoi sert cette page ?
2. Quelle est l'information principale ?
3. Qu'est-ce qui mérite mon attention ?
4. Quelle action puis-je effectuer ?
5. Où trouver les preuves et les détails ?

### Données et preuves

- Données représentatives sur Test ; une lecture de Production n'a lieu que sur GO, filtrée par site, et aucune donnée personnelle n'apparaît dans une capture publiée.
- Chaque preuve indique sa nature : navigateur réellement exécuté (moteur, taille, mode) ou vérification simulée (client simulé, date figée).
- Un contrôle non fait est écrit comme tel, jamais supposé réussi.

Livrable : captures bureau et téléphone, Jour et Nuit, valeurs avant et après, cibles cliquées, test de compréhension, écarts.

## 9. Application et gouvernance

- Skill de dépôt `.claude/skills/nexus-design-experience/SKILL.md` et `CLAUDE.md` à la racine, qui impose de le charger pour tout travail d'interface.
- `test_charte_interface.js` : d'abord en mode rapport non bloquant ; il ignore les graphiques SVG, les illustrations et les exceptions déclarées dans la page. Il ne devient bloquant qu'après examen de ses faux positifs, et seulement pour les pages listées comme recettées conformes.

### Preuve d'application

La présence du skill ne prouve pas qu'il a été chargé. Un lot d'interface n'est recetté que s'il apporte :

- la fiche de conception citant le référentiel et sa version (lot significatif) ;
- dans le compte rendu, les composants réutilisés, les composants nouveaux et les exceptions justifiées ;
- la recette visuelle et cognitive de Guardian, avec ses captures.

### Gouvernance

La revue de conception se fait dans le Handoff existant : CC publie la fiche sur #160, Guardian la revoit et la recette. Une nouvelle carte, une correction graphique ou un ajustement de présentation avancent sans GO du gérant. Restent soumis aux règles d'autorité établies : une décision métier nouvelle, un changement de doctrine ou de ce référentiel, la sécurité, les migrations, les fusions et la Production.

## 10. Chantier suivant

Bibliothèque de composants partagés, à préparer après les deux premiers cas (Scanner tarifaire, accueil Produits) : jetons `--t-*` dans un fichier commun, en-tête de module, carte Conseiller, carte de contrôle, carte d'indicateur, rebranchement de Paye. Dossier présenté avant tout code.
