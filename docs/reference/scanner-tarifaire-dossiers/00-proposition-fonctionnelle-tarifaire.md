# NEXUS Scanner, proposition fonctionnelle tarifaire

16/11/2026

## Objet et périmètre

NEXUS Scanner contrôle la politique tarifaire de Sainte-Marie référence par référence : il signale, chiffre et propose, mais ne change jamais un prix. Le gérant décide, puis applique lui-même dans Decenium. La base de travail est la [matrice tarifaire](https://claude.ai/artifact/D1WyH1CoLhNH4rYnGUFuP5) du 16/11/2026 : 440 références, dont 247 fiables, 123 à confirmer et 70 insuffisantes.

| Élément | Statut | Origine |
| --- | --- | --- |
| Prix TTC décidés : Sprite et Royal Soda 2 L à 4,80 € ; Orangina et Amigo Orange 2 L à 5,90 € ; Coca-Cola 2 L inchangé ; Monster 50 cl à 4,20 € ; Floup classique à 0,95 € ; autres Floups à 1,25 € ; Glacons Vito 5 kg à 4,00 € | Décidés, non appliqués (sauf autres Floups, déjà à 1,25 €) | Gérant |
| Exceptions : Floup classique, menthes à l'unité Durmint et Dr Tom, packs Heineken 25 cl × 6 et 4 × 50 cl, pack Lorraine 4 × 50 cl, pack Chanflor 1,5 L × 6, Bavaria Blonde 50 cl, Glacons Vito 5 kg | Validées | Gérant et produits d'appel déjà enregistrés |
| Menthise 250 g, pack St Jude 1,5 L × 6 | Candidates, non décidées | Contre-audit |
| Pack Guinness 27,5 cl × 6 | Pas d'exception | Gérant |
| Seuils par famille (bières, jus, énergétiques, eaux, glaces, confiserie, feuilles, biscuiterie, chips) | Indicatifs ; sodas 2 L en objectif ; cible des jus et seuils des glaces à l'étude | Gérant |
| Seuils des sodas hors 2 L | Hypothèse statistique, non validée | Dossier d'arbitrage |
| Pains, huiles moteur | Sans seuil | Gérant |
| Vapotage (WPUFF, Falcon-X) | Contrôle réglementaire prioritaire, exclu des hausses | Gérant |

Ce document décrit le fonctionnement attendu. Il n'engage aucune migration : aucune écriture dans Decenium ni dans NEXUS Production, aucune application automatique de prix. Chaque lot de développement passera par la recette habituelle et votre GO.

### Examen du 16/11/2026 : six conditions pour T1

Verdict du gérant : approuvé avec conditions, pour le seul lot T1 (moteur en lecture seule). Les sections suivantes intègrent ces conditions.

| Condition | Effet sur la conception |
| --- | --- |
| 1. Pas d'application déduite du PV moyen | Cinq états d'un prix décidé : décidé, saisie déclarée, cohérence constatée, application vérifiée (sur preuve datée), écart constaté |
| 2. Pas de double comptage | Une référence entre dans un seul compartiment par scénario ; minimum et cible sont deux hypothèses alternatives |
| 3. PA HT n'est pas un PMP prouvé | Le coût garde son libellé Decenium, sa provenance et sa méthode, « non établie » tant qu'elle n'est pas prouvée |
| 4. Réglementaire indépendant | Axe de conformité séparé de la fiabilité comptable |
| 5. Pas de « Conforme » sans règle validée | Nouveau statut « Sans seuil validé » |
| 6. Exceptions contrôlées | Marge négative, coût anormal, TVA et conformité restent actifs sur une exception |

## Principes

Le Scanner reste un outil de contrôle et d'aide à la décision : sept règles encadrent tout ce qui suit.

1. **Aucun prix appliqué par NEXUS.** Une cible statistique ne devient jamais un prix de vente. NEXUS affiche un prix envisageable ; le gérant décide ; le prix est saisi dans Decenium par une personne ; NEXUS constate l'application au prochain import.
2. **Une entrée sert tous les moteurs.** Seuils, exceptions, prix décidés, TVA confirmée et nature d'une référence sont saisis une fois. Scanner, Marge, Brief, Capital et Conseiller lisent le même registre.
3. **Pas de chiffre inventé.** Un taux, un gain ou un prix n'est affiché que s'il est calculé sur des données dont la fiabilité est écrite. Une donnée absente reste absente.
4. **Trois niveaux de fiabilité qui ne se mélangent pas.** Les gains des références fiables, à confirmer et insuffisantes sont toujours affichés séparément, jamais additionnés.
5. **Une exception reste contrôlée.** Un produit d'appel ou un pack sort des recommandations de hausse, jamais des contrôles de coût, de marge négative ou de TVA.
6. **Un régime légal ne se déduit pas.** Ni le taux de marge ni le libellé ne suffisent à classer un produit en prix réglementé, contractuel ou commissionné : la qualification est déclarée.
7. **Rien ne s'efface.** Chaque décision, correction ou annulation crée une nouvelle ligne datée, avec son auteur et son motif.

## Données et fiabilité

Chaque référence reçoit un niveau de fiabilité avant tout calcul de prix : fiable, à confirmer ou insuffisante. Le niveau dépend de cinq contrôles sur les imports Decenium déjà présents dans NEXUS.

| Source | Ce que NEXUS en tire | Limite connue |
| --- | --- | --- |
| Export ventes Decenium (QTE, PA HT, PV HT, TVA) | Quantités, PV HT moyen, coût, taux de marque | PV moyen sur la période, pas le prix paramétré en caisse ; montants au centime |
| Valorisation du stock (PA net HT) | Contrôle du coût de la période | Les packs n'ont pas de ligne propre |
| Période précédente | Variation de coût et de prix | Référence nouvelle : pas d'historique |
| Registres NEXUS (TVA confirmée, nature, justifications, exceptions, prix décidés) | Ce que le gérant a déclaré ou décidé | Vides tant que personne n'a saisi |

Le PV exporté est bien HT : 87 % des lignes à 2,1 % et 96 % des lignes à 8,5 % retombent sur un prix TTC rond. Le prix paramétré en caisse et sa date d'effet ne sont pas dans NEXUS. Tant qu'un export de l'historique des prix Decenium n'existe pas, le Scanner compare un prix décidé au PV moyen constaté, et le dit.

| Contrôle | À confirmer | Insuffisante |
| --- | --- | --- |
| Coût de la période contre PA net HT du stock | écart de 5 à 10 %, ou référence absente du stock | écart de plus de 10 % |
| Variation du coût depuis la période précédente | de 10 à 50 % | 50 % ou plus |
| TVA | 0 % expliqué par une exonération, non confirmé | taux non expliqué ou changé entre périodes |
| Prix déclaré par le gérant | PV moyen proche, date d'effet inconnue | PV moyen éloigné sans explication (Floup classique) |
| Volume, prix et traçabilité | moins de 3 unités, prix inférieur à 0,50 €, libellé daté, sans historique | marge négative, sortie Périmés/Casse |

La conformité réglementaire est un axe distinct : une référence peut avoir des chiffres fiables et un contrôle réglementaire ouvert. Le coût est toujours affiché avec son libellé Decenium (« PA HT »), sa provenance et sa méthode de valorisation, « non établie » tant que Decenium n'a pas confirmé s'il s'agit d'un PMP ou d'un dernier prix d'achat. Le niveau se recalcule à chaque import ; une confirmation saisie par le gérant (TVA, coût, prix) le fait remonter sans effacer l'anomalie d'origine.

## Règles de calcul

Le Scanner calcule le taux de marque sur le HT, applique le seuil le plus précis qui existe, puis propose un prix envisageable seulement si la référence est fiable ou à confirmer.

```latex
\text{taux de marque} = \frac{PV_{HT} - \text{coût}_{HT}}{PV_{HT}} \qquad \text{coût}_{HT} = \text{PA HT de l'export Decenium}
```

```latex
PV_{HT}^{\text{envisageable}} = \frac{\text{coût}_{HT}}{1 - \text{seuil}} \qquad PV_{TTC}^{\text{envisageable}} = \left\lceil 20 \times PV_{HT}^{\text{envisageable}} \times (1 + TVA) \right\rceil / 20
```

```latex
\text{gain théorique} = \left( \frac{PV_{TTC}^{\text{envisageable}}}{1 + TVA} - PV_{HT}^{\text{moyen}} \right) \times \text{quantité de la période}
```

L'arrondi aux 5 centimes TTC supérieurs est une convention de présentation, réglable par site. Le gain est écrit « gain théorique à volume constant », jamais « bénéfice ». Il est ramené à 30 jours comme les autres contrôles du Scanner (réglage `joursReference`) ; la matrice du 16/11 le donne sur 36 jours.

### Quel seuil s'applique

Ordre de priorité : prix décidé par le gérant, puis exception commerciale, puis seuil de famille, puis seuil de rayon, puis seuil par défaut. Le défaut 41 / 48 % reste une hypothèse non activée. Une famille commerciale peut regrouper des références de plusieurs rayons Decenium sans modifier Decenium (Aloe Vera et Vitamalt hors énergétiques, stouts avec les bières).

| Famille | Minimum | Cible | Statut du seuil |
| --- | --- | --- | --- |
| Bières (stouts comprises) | 47 % | 50 % | Indicatif |
| Jus | 41 % | 49 % | Minimum indicatif, cible à l'étude |
| Sodas 2 L | 41 % | 42 % | Objectif |
| Sodas autres formats | 39 % | 48 % | Hypothèse statistique, non validée |
| Énergétiques (hors Aloe Vera et Vitamalt) | 47 % | 48 % | Indicatif |
| Eaux non aromatisées | 46 % | 51 % | Indicatif |
| Glaces hors Floups | 40 % | 42 % | À étudier |
| Confiserie hors exceptions | aucun | 50 % | Objectif |
| Feuilles à rouler, filtres, tubes | 47 % | 51 % | Surveillance |
| Biscuiterie | 37 % | 41 % | Indicatif |
| Eaux aromatisées | 47 % | 51 % | Indicatif |
| Chips et petits salés | 41 % | 45 % | Indicatif, pas de hausse générale |
| Huiles Shell 1 L, 2 L, 5 L ; huiles hors Shell | aucun | aucun | 1 L plus margé que 5 L, pas de taux uniforme |
| Pains et pâtisseries fraîches | aucun | aucun | Différé |
| Boissons à l'aloe vera, boissons maltées | aucun | aucun | Famille nouvelle, à fixer |
| Vapotage | supérieur à 50 % | aucun | Suspendu : contrôle réglementaire |

### Qui reçoit un prix envisageable

- Oui : référence fiable ou à confirmer, sous son minimum (ou sous la cible quand seule une cible existe), sans exception ni prix décidé.
- Non : exception commerciale, vapotage, huiles, pains, familles sans seuil, référence insuffisante. Ces lignes restent dans tous les contrôles.
- Prix décidé : le Scanner calcule le taux au prix décidé et l'écart avec le PV moyen constaté, sans proposer d'autre prix.

### Cinq statuts et des gains séparés

| Statut | Condition |
| --- | --- |
| À vérifier | Fiabilité insuffisante ou contrôle réglementaire ouvert |
| Proposition à valider | Sous le minimum avec un prix envisageable, ou prix décidé pas encore constaté en caisse |
| À surveiller | Exception commerciale, entre minimum et cible, ou fiabilité à confirmer |
| Conforme | Au-dessus d'un seuil validé par le gérant, ou prix décidé dont l'application est vérifiée. Jamais sans règle validée |

Cinquième statut, **Sans seuil validé** : aucune règle validée ne s'applique (seuil à l'étude, hypothèse statistique, famille sans seuil). La référence reste dans tous les contrôles mais n'a ni prix envisageable ni statut « Conforme ».

Les gains sont rangés par scénario (prix décidés, minimum, cible) et par niveau de fiabilité (fiable, à confirmer, insuffisante). Chaque référence entre dans une seule case par scénario ; une référence à prix décidé n'est pas simulée au minimum ; minimum et cible sont deux hypothèses alternatives, jamais additionnées. Les références insuffisantes n'apparaissent qu'au niveau de la preuve, marquées « donnée à corriger ».

Un seuil indicatif ne produit jamais de proposition : sous ce seuil, la référence est « à surveiller », et le calcul au seuil indicatif reste un repère non décisionnel. Seuls les objectifs arrêtés (sodas 2 L, confiserie, vapotage) sont des seuils validés.

| Gains décisionnels (36 jours, moteur T1 v2) | Fiables | À confirmer |
| --- | --- | --- |
| Prix décidés | 159,91 € | 18,49 € |
| Minimum validé | 125,80 € | 99,26 € |
| Cible validée | 125,80 € | 99,26 € |

Les repères indicatifs et les simulations des références insuffisantes restent dans les preuves techniques, jamais présentés comme des gains exploitables.

## Alertes

Le Scanner lève huit alertes à chaque import : les sept demandées et le contrôle réglementaire. Trois existent déjà en partie dans le Scanner actuel (ventes à perte, hausses non répercutées, prix suspects) et sont reprises, pas dupliquées.

| N° | Alerte | Se déclenche quand | Conséquence chiffrée | Action proposée | Exemple au 16/11 |
| --- | --- | --- | --- | --- | --- |
| 1 | Marge en baisse par hausse du coût | Coût (PA HT) en hausse, PV inchangé, taux en baisse | Hausse de coût × quantité, « impact estimé à volume observé » | Vérifier la facture, puis décider du prix | Contrôle B actuel |
| 2 | Référence sous son seuil | Taux sous le minimum de sa famille, référence fiable ou à confirmer | Gain théorique au minimum | Valider ou refuser le prix envisageable | 110 propositions à valider |
| 3 | Vente à marge négative | Coût supérieur ou égal au PV | Perte = (coût − PV) × quantité | Justifier ou corriger ; la justification n'efface pas la perte | Sachet Durmint 100 g : coût 2,94 € pour PV 2,35 € |
| 4 | Variation anormale de prix ou de coût | Coût en variation de 50 % ou plus, ou écart de plus de 10 % avec le stock | Écart de valorisation, jamais présenté comme un gain | Contrôler la dernière facture | Maxi Pop Corn : 2,76 € contre 1,26 € au stock |
| 5 | Incohérence entre sources | TVA non expliquée ou changée, référence absente du stock, libellé daté, motif de sortie divergent | Marge HT en jeu si le taux était différent | Confirmer la TVA ou le motif | Sandwich à 0 % ; Durmint « périmé » contre « emballage détérioré » |
| 6 | Produit d'appel en dégradation | Taux d'une exception en baisse de plus de 2 points, ou marge unitaire en baisse d'au moins 0,02 € et 5 %, avec au moins 5 € de marge perdue (réglages proposés, modifiables) | Marge perdue = baisse de taux × CA HT | Vérifier le coût et le prix, sans remettre en cause l'exception | Floup classique à 32,9 % contre 43,0 % au prix déclaré |
| 7 | Exception hors de ses conditions | Prix TTC constaté différent du prix déclaré, marge négative ou coût hors de ±10 % | Écart de prix × quantité | Confirmer, adapter ou lever l'exception | Floup classique : 0,81 € constaté contre 0,95 € |
| 8 | Contrôle réglementaire ouvert | Référence classée en contrôle prioritaire | CA HT concerné, aucun gain | Obtenir la fiche technique, qualifier, décider | 24 références de vapotage |

Chaque alerte affiche la cause observée, les données utilisées (période, coût, prix, quantité) et sa fiabilité. La gravité et l'action suivent `nexus-badge-etat.js` : critique pour les alertes 3 et 8, à vérifier pour 4, 5 et 7, information pour 1, 2 et 6 ; l'action est « Vérifier », « Décider » ou « Surveiller », jamais « Appliquer ».

Les conditions d'une exception (alerte 7) sont proposées par défaut : prix TTC déclaré maintenu, marge unitaire positive, coût stable à ±10 %. Le gérant peut les modifier exception par exception.

## Écrans

La politique tarifaire devient un espace d'analyse du Scanner, construit sur le canevas du référentiel de conception, plus quatre écrans de travail. Aucun bouton n'applique un prix.

| Écran | Type (référentiel) | Pour qui | Premier écran | Actions |
| --- | --- | --- | --- | --- |
| Politique tarifaire (onglet du Scanner) | Espace d'analyse | Gérant, manager | 4 cartes : propositions à valider, références à vérifier, prix décidés non constatés, contrôles réglementaires ouverts. Puis un Conseiller, puis les 8 cartes d'alerte | Ouvrir une alerte, filtrer la liste |
| Fiche tarifaire d'une référence | Fiche individuelle | Gérant, manager | Photo ou icône, nom, famille ; taux actuel, seuil applicable, PV TTC moyen, marge unitaire ; fiabilité et ses raisons | Valider ou refuser le prix envisageable, confirmer la TVA ou le coût, proposer une exception |
| Exceptions commerciales | Outil de travail (tableau) | Gérant | Exceptions validées, candidates et refusées, avec motif, conditions et dernier contrôle | Valider, refuser, lever, modifier les conditions |
| Prix décidés | Outil de travail (tableau) | Gérant, manager | Prix décidé, PV moyen constaté, écart, taux au prix décidé, état (décidé, constaté, écart persistant) | Déclarer la date de saisie dans Decenium |
| Paramètres tarifaires | Saisie ou paramétrage | Gérant | Seuils par famille avec leur statut, rattachements de familles, arrondi | Créer une nouvelle version de seuil |
| Contrôle réglementaire | Outil de travail (tableau) | Gérant | Références en contrôle prioritaire, type de produit, pièce attendue | Joindre la fiche technique, qualifier, décider |

- **Les quatre cartes** suivent les règles de lisibilité : un chiffre par carte, son unité, sa période, sa limite de fiabilité écrite. La carte des propositions montre le gain des références fiables ; le gain des références à confirmer est à côté, en plus petit et étiqueté.
- **La liste complète** (440 références à Sainte-Marie) a une recherche, des filtres cumulables (famille, rayon, statut, fiabilité, exception, alerte) et montre d'abord les 10 premières, triées par gravité puis par montant.
- **Le Conseiller** dit ce que les cartes ne disent pas : par quoi commencer et pourquoi, au ton directeur d'exploitation pour le manager, au ton conseil pour le gérant.
- **La preuve** (sources, méthode, historique, gain des références insuffisantes) est derrière un seul chevron par carte.
- **Les droits** restent ceux de `nexus-auth.js` : le gérant décide ; le manager confirme une donnée et propose ; l'employé ne voit pas l'espace.

Le budget du premier écran est vérifié à 375 × 812 et 1280 × 800, en Sombre et en Jour, comme pour les lots précédents. Deux icônes seront à demander sur #160 (exceptions, contrôle réglementaire).

## Workflow de validation

Une proposition ne devient un prix qu'après trois gestes humains : la décision du gérant, la saisie dans Decenium, le constat au prochain import.

&#91;embedded content: workflow de validation · 3 décisions, aucune application automatique\]

Une référence insuffisante n'atteint jamais la décision : elle passe d'abord par une anomalie à instruire, puis revient aux contrôles après réponse écrite. « Exploitable » veut dire fiable ou à confirmer ; une référence à confirmer porte cette mention jusque dans la décision.

1. **Proposition.** NEXUS affiche le prix envisageable, le seuil et sa version, le gain théorique et la fiabilité. Le manager peut confirmer une donnée (coût, TVA) ou commenter ; il ne décide pas du prix.
2. **Décision.** Le gérant valide, refuse (motif obligatoire) ou fixe un autre prix TTC. Une validation par lot est possible pour une famille, ligne par ligne dans le journal.
3. **Saisie.** Une personne saisit le prix dans Decenium et peut déclarer la date de saisie. NEXUS n'écrit rien dans Decenium.
4. **Constat.** Au prochain import, NEXUS compare le PV moyen au prix décidé (tolérance de 2 centimes TTC). Un PV moyen cohérent donne seulement « cohérence constatée ». « Application vérifiée » exige une preuve datée (export de prix, ticket, relevé en rayon), qu'un PV moyen contraire sur une période postérieure fait retomber en écart constaté. Non cohérent : l'alerte reste ouverte. Une période à cheval sur la date de saisie est signalée comme partielle, comme les Glacons Vito à 3,85 €.

Les exceptions et les contrôles réglementaires suivent le même schéma : candidate, puis décision du gérant, puis contrôle à chaque import.

## Traçabilité des décisions

Toute décision tarifaire laisse une ligne datée, signée et motivée, avec la photo des chiffres vus au moment de décider. Les registres suivent le modèle déjà en place pour la TVA confirmée et les justifications de marge : ajout seul, correction par une nouvelle ligne qui remplace la précédente, annulation datée avec motif, filtrage par site.

| Registre | Contenu | État |
| --- | --- | --- |
| TVA confirmée | Taux confirmé par référence | Existe (`produits_tva_confirmations`), vide |
| Nature d'une référence | Produit, service, opération de caisse | Existe (`produits_nature_reference`) |
| Justification de marge | Motif d'une sortie à marge négative, par période | Existe (`produits_justifications_marge`), 3 lignes |
| Produits d'appel | Liste sans motif | Existe (`produits_appel`), 24 lignes |
| Seuils tarifaires | Famille, minimum, cible, statut du seuil, version | À créer |
| Rattachement de famille | Référence vers famille commerciale, motif | À créer |
| Exceptions commerciales | Type, motif, statut (candidate, validée, refusée, levée), conditions | À créer ; reprend `produits_appel` sans le dupliquer |
| Prix décidés | Prix TTC, nature (changement, prix en vigueur, maintenu), décideur, date de décision, date de saisie déclarée, preuve d'application | À créer |
| Contrôles réglementaires | Référence, type de produit, pièces, qualification, décision | À créer |
| Décisions tarifaires | Proposition vue, décision, motif, photo des données | Journal existant (`journal_decisions`) à compléter |

Chaque décision conserve : la référence (code-barres, sinon libellé exact), la période importée, le coût, le PV moyen, la quantité, le taux, le seuil et sa version, le prix envisageable, la fiabilité, la décision, le motif, l'auteur et l'heure. Ces chiffres ne sont jamais recalculés après coup.

Une exception candidate (Menthise, pack St Jude) est enregistrée comme candidate et le reste tant que le gérant ne l'a pas validée : elle n'a aucun effet sur les recommandations. Une anomalie (coût, TVA, motif Durmint) reste ouverte jusqu'à une réponse écrite ; la réponse s'ajoute, l'anomalie d'origine reste visible dans l'historique.

## Vapotage : contrôle réglementaire prioritaire

Les 24 références de vapotage (18 WPUFF, 6 Falcon-X) sont classées en contrôle réglementaire prioritaire et exclues de toute recommandation de hausse tant que leur conformité n'est pas établie. NEXUS ne présume ni la conformité ni la non-conformité, et ne propose aucun retrait sans identification précise de la référence.

**Textes à vérifier.** L'article [L3513-5-1](https://www.legifrance.gouv.fr/codes/id/LEGIARTI000051246084/2025-02-26) du Code de la santé publique, en vigueur depuis le 26/02/2025, interdit la vente des dispositifs préremplis qui ne peuvent être remplis à nouveau, avec ou sans batterie rechargeable ; il ne vise pas les cartouches. L'article [L3513-15](https://www.legifrance.gouv.fr/codes/id/LEGIARTI000051247078/2025-02-26) renvoie à un arrêté le volume maximal des réservoirs des cartouches à usage unique et des flacons de recharge ; les valeurs de cet arrêté restent à lire sur le texte officiel. Les articles consultés ne prévoient pas d'exception pour la Martinique.

| Type d'élément | Références concernées | Question à trancher | Pièce attendue |
| --- | --- | --- | --- |
| Dispositif complet prérempli | Falcon-X (6) ; kits WPUFF Fusion Starter (5) | Peut-il être rempli à nouveau ? Volume du réservoir ? | Fiche technique et notice du modèle exact |
| Cartouche ou pod prérempli | WPUFF Fusion PS (6) ; WPUFF POD 2.0 (5) | Est-ce une cartouche au sens du code, ou un dispositif complet ? Volume ? | Fiche technique, déclaration du fabricant |
| Batterie seule | WPUFF Fusion PS Batterie ; WPUFF POD 2.0 Battery | Compatible avec des cartouches conformes ? | Fiche technique |
| Réservoir ou flacon | Liquides JNR 10 ml (rayon E-Liquides, hors matrice) | Volume et taux de nicotine conformes ? | Étiquette et fiche du produit |

Les sources publiques consultées décrivent un Falcon-X Plus remplissable avec un réservoir de 10 ml et un kit WPUFF Fusion à cartouche préremplie de 10 + 2 ml. Elles ne prouvent pas que ce sont les modèles vendus à Sainte-Marie. La fiche exacte est à demander au distributeur, référence par référence, avec le code-barres.

Dans NEXUS, chaque référence garde un dossier : type d'élément, pièces jointes, qualification (conforme, non conforme, à compléter), décideur et date. Une batterie rechargeable n'est jamais retenue comme preuve de conformité. Tant que le dossier est ouvert, la référence reste « à vérifier », son CA reste visible et aucun prix envisageable n'est calculé.

## Points ouverts et lots

Le développement peut commencer par un moteur en lecture seule, sans migration ; les registres n'arrivent qu'au deuxième lot, en Test d'abord et sur votre GO.

| Lot | Contenu | Écriture en base | Préalable |
| --- | --- | --- | --- |
| T1 Moteur | Réalisé le 16/11/2026, en attente d'examen : module nexus-politique-tarifaire.js, version 2, 47 tests réussis, passage sur les 440 références de Sainte-Marie avec seuils indicatifs non activés. T2 ne démarre qu'après un nouvel examen de son périmètre technique | Aucune | Aucun |
| T2 Registres | Seuils versionnés, rattachements de familles, exceptions (reprise de `produits_appel`), prix décidés, contrôles réglementaires ; correction de la règle `familleMarge` qui exclut à tort le rayon Gaz / Plein air / Glaçons | Migration en Test | GO migration |
| T3 Écrans | Onglet Politique tarifaire, fiche tarifaire, exceptions, prix décidés, paramètres, contrôle réglementaire | Aucune nouvelle | T1, T2 |
| T4 Validation | Décisions, journal, constat d'application après import, alertes d'exception | Lignes ajoutées au journal | T3 |
| T5 Historique des prix | Lecture de la date d'effet d'un prix, si Decenium fournit cet export | À définir | Export disponible |

**Questions de données, sans décision métier nouvelle**

- [ ] Le « PA HT » de l'export ventes Decenium est-il un PMP ou un dernier prix d'achat ?
- [ ] Decenium peut-il exporter l'historique des prix de vente avec leur date d'effet ?
- [ ] Prix paramétré en caisse et remises du Floup classique ; date du passage des Glacons Vito à 4,00 €.
- [ ] Confirmation écrite de l'expert-comptable : huiles, chips de pomme de terre, Pringles, sandwich, Chouchou, biscuits à 0 %.
- [ ] Menthise : conditionnement et vente réelle à l'unité. Pack St Jude : prix, coût, politique du pack.
- [ ] Fiches techniques des 24 références de vapotage, demandées au distributeur.

**Seuils encore à fixer par le gérant, plus tard** : cible des jus, glaces hors Floups, sodas hors 2 L, boissons à l'aloe vera, boissons maltées. Tant qu'ils ne sont pas fixés, ces familles n'ont pas de prix envisageable, ou affichent l'hypothèse statistique étiquetée comme telle.
