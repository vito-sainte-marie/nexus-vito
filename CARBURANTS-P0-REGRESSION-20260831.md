# NEXUS Carburants — Recette P0 du 31/08/2026

> Branche de travail : `audit-carburants-p0-20260831`
> Statut : garde-fou avant fusion. Aucun de ces cas ne doit régresser.

## Principe de vérité physique

Un relevé `reception_livraison` est une mesure physique horodatée. À partir de son instant exact, il devient la nouvelle vérité de stock. Toute vente antérieure à cet instant est déjà reflétée dans la mesure et ne doit jamais être retranchée une seconde fois.

Les jaugeages d'ouverture ordinaires conservent la convention historique NEXUS : ils représentent le stock à l'ouverture de la journée, même s'ils ont été saisis plus tard dans l'application.

## P0-01 — Cas réel Sainte-Marie, réception du 31/08 à 13:45

Données réelles de référence :

- date locale : `2026-08-31`
- fuseau : `America/Martinique`
- origine du relevé : `reception_livraison`
- mesure : `2026-08-31T17:45:28.414Z`, soit 13:45 en Martinique
- stock physique GO après réception : `7 671 L`
- Q1 déjà capté : `1 281,26 L GO`
- Q1 étendu : 05:45–13:45
- Q2 étendu : 13:40–22:05

### Attendu

1. `7 671 L` est la nouvelle ancre physique GO à 13:45.
2. Les `1 281,26 L` du Q1 sont antérieurs ou égaux à l'ancre et ne doivent plus être déduits après 13:45.
3. La projection de stock après l'ancre ne consomme que les ventes postérieures à 13:45.
4. Si Q2 n'est pas encore clôturé, sa consommation peut être estimée sur son historique, mais uniquement pour la fraction du quart située après 13:45.
5. La source d'ancre exposée doit rester `reception_livraison` avec son heure exacte.

### Interdit

- Repartir de minuit pour cette ancre.
- Retrancher une prévision de journée complète à partir du stock physique mesuré à 13:45.
- Retrancher à nouveau le Q1 déjà incorporé dans les 7 671 L.

## P0-02 — Jaugeage d'ouverture ordinaire inchangé

Pour un relevé dont `origine !== 'reception_livraison'`, la convention actuelle reste inchangée : l'ancre représente l'ouverture de la date du relevé et la projection peut partir de la journée complète.

Ce P0 ne doit donc pas transformer l'heure de saisie d'un jaugeage matinal tardivement enregistré en heure physique de mesure.

## P0-03 — Fraction d'un quart après une ancre intrajournalière

Pour une fenêtre `[t0, t1]` et un quart `[debutQuart, finQuart]`, la fraction estimable doit être calculée sur le chevauchement réel :

`max(0, min(t1, finQuart) - max(t0, debutQuart)) / (finQuart - debutQuart)`

Exemple : Q2 étendu 13:40–22:05, ancre 13:45. Les cinq minutes 13:40–13:45 sont antérieures à l'ancre et ne doivent jamais être estimées comme consommation postérieure à la mesure physique.

## P0-04 — Quart entièrement antérieur à l'ancre

Un quart dont la fin est `<= t0` contribue à `0` à la consommation projetée après l'ancre.

## P0-05 — Réception sans heure exploitable

Un relevé `reception_livraison` sans `mesure_le` exploitable ne doit jamais être transformé silencieusement en ancre de minuit. La projection concernée doit rester non calculable / à confirmer jusqu'à résolution de l'heure d'ancre.

## P0-06 — Traçabilité de la source

L'évaluation de commande doit permettre de restituer au minimum :

- date de l'ancre ;
- instant de mesure ;
- origine `reception_livraison` ou jaugeage d'ouverture ;
- motif lorsqu'un relevé plus ancien est utilisé en repli.

## P0-07 — Anomalie de réception distincte de la cause

Cas réel du 31/08 :

- BL GO : `5 000 L`
- quantité mesurée : `5 695 L`
- écart : `+695 L`
- ratio : `+13,9 %`

NEXUS doit journaliser le fait comme anomalie à rapprocher/informative sans inventer sa cause. `cause_etablie` reste faux tant qu'une preuve ou un arbitrage manager ne l'établit pas.

## P0-08 — Commande confirmée fournisseur reste engagée

Une commande passée de `validee` à `confirmee_fournisseur` est toujours une commande en cours tant qu'elle n'est pas `livree`, `reception_controlee` ou `annulee`.

### Attendu

- son volume reste intégré dans `commandesEnCoursVolumeL` ;
- NEXUS ne recommande jamais un deuxième camion comme si cette commande avait disparu ;
- la confirmation fournisseur augmente la certitude de la commande, elle ne doit jamais la retirer du calcul.

## P0-09 — Commande passée hors NEXUS reste engagée jusqu'à livraison

`enregistrerCommandeHorsNexus()` existe précisément pour signaler qu'une commande réelle a déjà été passée par un autre canal. Tant que cette commande n'est pas livrée ou annulée, son volume doit être intégré au moteur comme une commande en cours.

### Attendu

- le statut `hors_nexus` ne fait pas disparaître la commande du calcul ;
- la recommandation persistante que cette action cherche à neutraliser ne doit pas réapparaître ;
- après rapprochement de la livraison, le volume cesse naturellement d'être considéré comme engagé.

## P0-10 — Consommation nulle ne permet jamais de compléter le camion

Un carburant avec une consommation journalière connue égale à `0` ne doit jamais être assimilé à un carburant dont l'historique est simplement absent.

### Attendu

- `consommationMoyenneJour === 0` interdit tout volume de complétion automatique vers un camion plein, sauf règle métier explicite distincte ;
- une consommation `null` reste une donnée insuffisante, jamais une autorisation de remplir sans plafond ;
- un carburant suspendu ou indisponible opérationnellement ne peut jamais être utilisé comme carburant de remplissage ;
- le GNR de Sainte-Marie, actuellement à 0 L vendu dans l'historique disponible, ne doit pas apparaître dans une recommandation automatique de complétion.

## P0-11 — Journée partielle jamais apprise comme journée complète

Une journée ne peut alimenter une moyenne journalière, une comparaison même-jour-de-semaine ou une prévision comme journée complète que si la couverture attendue de ses quarts est démontrée.

Cas réels à conserver comme tests :

- 18/07/2026 : Q1 sans litrage, Q2 connu ;
- 19/07/2026 : Q1 sans litrage, Q2 connu ;
- 20/07/2026 : Q1 connu, Q2 sans litrage.

### Attendu

- ces journées sont qualifiées `partielles` ;
- leur total partiel n'est jamais présenté ou appris comme total journalier comparable ;
- le moteur peut les exclure d'une moyenne nécessitant des journées complètes, ou les utiliser uniquement avec une méthode explicitement adaptée au quart ;
- l'absence d'un quart reste distincte d'une vraie journée commercialement faible.

## P0-12 — Suspicion de duplication de quart à arbitrer

Cas réel unique dans l'historique actuel : 28/08/2026, Q1 et Q2 portent exactement les mêmes litrages GO, SP95 et GNR.

### Attendu

- NEXUS signale une suspicion de duplication sans supprimer ni corriger automatiquement la donnée ;
- la donnée reste traçable et le manager arbitre ;
- tant que la suspicion n'est pas levée, une prévision sensible à cette journée porte une qualité dégradée ou exclut ce point selon la règle de calcul retenue.

## P0-13 — Couverture Performance basée sur les quarts attendus

La couverture d'une période ne doit jamais utiliser comme dénominateur uniquement les lignes qui existent déjà dans `audits_caisse`.

Cas réel du 31/08/2026 : août contient 61 lignes de quart enregistrées au moment du contrôle, toutes avec un litrage, alors que le Q2 du 31/08 n'existe pas encore. `61/61` ne signifie donc pas « période complète ».

### Attendu

- NEXUS détermine les quarts opérationnellement attendus pour chaque date du site ;
- `nbQuartsTotal` devient un nombre attendu, distinct du nombre de lignes reçues ;
- un quart absent est visible comme absent, jamais effacé du dénominateur ;
- la couverture doit pouvoir distinguer `présent avec litrage`, `présent sans litrage`, `attendu mais absent` et, si nécessaire, `non attendu`.

## P0-14 — Fin de période = clôture opérationnelle, pas simple égalité de date

Une période qui se termine aujourd'hui n'est pas automatiquement terminée au début ou au milieu de sa dernière journée.

Cas réel : le 31/08, `periode.fin === todayISO()` alors que Q2 n'est pas encore clôturé.

### Attendu

- la période reste `en cours` tant que les quarts opérationnellement attendus jusqu'au point de contrôle ne sont pas clôturés ;
- la fin calendaire et la fin opérationnelle sont deux notions distinctes ;
- aucune conclusion consolidée de mois n'est affichée avant la clôture opérationnelle du dernier quart attendu.

## P0-15 — Une référence partielle n'est jamais acceptée comme mois comparable

Une référence ne devient pas comparable simplement parce qu'elle contient au moins un quart avec litrage.

Cas réel : juillet 2026 ne contient dans NEXUS que la période du 18 au 31 juillet, avec trois quarts sans litrage, alors que le code actuel peut choisir juillet comme « mois précédent » dès que `nbQuartsAvecLitrage > 0`.

### Attendu

- chaque référence candidate est qualifiée avant usage ;
- une référence mensuelle partielle ne peut pas être présentée comme un mois complet comparable ;
- NEXUS utilise soit une fenêtre réellement comparable, soit un repli qualifié, soit affiche « comparaison indisponible » ;
- aucune hausse/recul mensuel ne doit être calculé entre un mois complet et quelques jours d'un autre mois sous l'étiquette « à jours comparables ».

## P0-16 — Même coupure opérationnelle entre période actuelle et référence

« À jours comparables » signifie même avancée opérationnelle, pas seulement même date civile.

Cas réel : lundi 31/08, seul Q1 existe. Le lundi 24/08 possède Q1 + Q2. Comparer 31/08 Q1 à 24/08 Q1+Q2 crée artificiellement un recul d'environ 57 %.

### Attendu

- si la période actuelle est arrêtée après Q1, la référence est elle aussi arrêtée après Q1 ;
- les quarts futurs du jour courant ne sont jamais comparés à des quarts déjà clôturés de la référence ;
- à défaut d'une coupure opérationnelle fiable, la comparaison reste provisoire/non disponible.

## P0-17 — Une tendance provisoire ne déclenche jamais une conclusion ferme

Quand `tendanceProvisoire === true`, aucune couche de l'écran ne doit produire simultanément une alerte commerciale consolidée comme si la comparabilité était démontrée.

### Attendu

- `construireMessagesPilotage()` tient compte du statut provisoire transmis par l'écran ;
- un mouvement supérieur à ±15 % sur une période non comparable reste présenté comme observation provisoire, jamais comme hausse/recul établi ;
- le code couleur, la phrase « Lecture NEXUS », le bloc ventes et « Ce qui explique l'évolution » utilisent tous le même niveau de confiance ;
- une cause commerciale n'est jamais inventée tant que la donnée n'est pas comparable.

## Critère de sortie P0

Le lot est validable uniquement lorsque :

- le scénario P0-01 ne double-compte plus les ventes pré-ancre ;
- P0-02 conserve le comportement historique des jaugeages d'ouverture ;
- P0-03 à P0-05 sont couverts par la logique partagée, pas par un correctif d'écran ;
- P0-08 et P0-09 empêchent toute double recommandation alors qu'une commande réelle est déjà engagée ;
- P0-10 interdit toute complétion automatique d'un carburant à consommation nulle ;
- P0-11 empêche les journées partielles d'être apprises comme journées complètes ;
- P0-12 traite les doublons suspects comme exceptions à arbitrer, jamais comme corrections automatiques ;
- P0-13 à P0-16 démontrent la comparabilité opérationnelle avant tout calcul de tendance ;
- P0-17 empêche une conclusion ferme lorsqu'une comparaison reste provisoire ;
- la branche ne contient que les modifications attendues ;
- la PR reste brouillon jusqu'à validation explicite.