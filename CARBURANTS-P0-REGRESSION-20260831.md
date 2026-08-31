# NEXUS Carburants — Recette P0 du 31/08/2026

> Branche de travail : `audit-carburants-p0-20260831`
> Statut : garde-fou avant fusion. Aucun de ces cas ne doit régresser.

## Doctrine temporelle verrouillée

Tant que NEXUS ne dispose pas de ventes carburant réellement horodatées via Insite360, le relevé quotidien représente le stock physique **à l'ouverture, avant les ventes du matin**.

Une réception effectuée après cette ouverture est un événement distinct :

- son heure de début reste tracée ;
- son BL est la quantité documentaire à intégrer dans le flux de stock ;
- le jaugeage après réception est une preuve physique de contrôle de la réception ;
- le jaugeage après réception ne remplace jamais l'ouverture comme ancre du calcul journalier ;
- NEXUS ne découpe jamais arbitrairement les ventes d'un quart avant/après l'heure de réception.

Cas réel du 31/08/2026 :

- ouverture GO corrigée : `1 448 + 1 554 = 3 002 L` ;
- début de réception : `11:38` heure Martinique ;
- BL GO : `5 000 L` ;
- jaugeage post-réception : `4 831 + 2 840 = 7 671 L` ;
- variation mesurée : `5 695 L` ;
- anomalie réception : `+695 L / +13,9 %` ;
- l'instant `13:45` correspond au jaugeage final / à l'écriture technique post-réception, pas à une nouvelle frontière de ventes.

La précédente hypothèse de travail « 13:45 devient la nouvelle ancre de commande » est annulée.

## P0-01 — L'ouverture reste l'ancre du jour

Pour le 31/08, l'ancre métier GO reste `3 002 L`.

### Attendu

- aucune réception du jour ne remplace cette valeur dans `carburant_releves` ;
- la version de réception peut rester tracée dans l'historique ;
- le dernier stock physique post-réception peut être affiché séparément ;
- l'origine et l'heure du relevé d'ouverture restent disponibles pour le moteur de commande.

## P0-02 — Pas de découpage intrajournalier inventé

Tant que les ventes sont connues uniquement par quart :

- un quart qui chevauche une borne horaire n'est jamais ventilé au prorata comme s'il s'agissait d'une mesure réelle ;
- `resoudreVentesFenetre()` peut déclarer la fenêtre non isolable ;
- aucune estimation horaire ne remplace une donnée absente.

Cette règle pourra évoluer lorsque l'API Insite360 fournira des volumes réellement horodatés.

## P0-03 — Livraison du jour dans la commande = ouverture + BL reçu

Après une livraison déjà réceptionnée dans la journée, la recommandation de commande peut partir d'une ancre de flux équivalente :

`jaugeage d'ouverture + quantités BL effectivement réceptionnées dans la journée`

puis appliquer la prévision journalière complète. Elle ne doit pas utiliser le jaugeage post-réception comme nouvelle frontière temporelle.

Cas 31/08 GO : `3 002 + 5 000 = 8 002 L` avant consommation journalière projetée.

## P0-04 — Livraison inter-relevés lue directement depuis Réception

Pour le contrôle du relevé suivant, NEXUS doit sommer les quantités BL des visites terminées entre l'ancre précédente et le nouveau relevé, sans demander une nouvelle saisie dans Carburants.

La table `carburant_releves` n'est pas une deuxième base de réceptions.

## P0-05 — Réception physiquement dupliquée = exception, pas somme automatique

Si deux visites distinctes présentent une signature physique strictement identique sur la même date (mêmes BL par carburant et mêmes jaugeages avant/après par cuve), NEXUS ne les additionne pas automatiquement dans le théorique.

Il signale une ambiguïté à arbitrer.

Cas réel à conserver comme test : 26/08/2026.

## P0-06 — Stock post-réception affichable, mais pas « écart = 0 » par construction

Le jaugeage final peut alimenter :

`Dernier stock physique connu après réception : X L`

mais il ne doit jamais produire automatiquement :

`Théorique = physique` puis `Écart = 0`.

Le rapprochement de réception reste distinct du contrôle inter-relevés.

## P0-07 — Anomalie de réception distincte de la cause

Cas 31/08 GO :

- BL : `5 000 L` ;
- mesuré : `5 695 L` ;
- écart : `+695 L` ;
- ratio : `+13,9 %`.

NEXUS journalise ce fait sans inventer sa cause. `cause_etablie=false` tant qu'une preuve ou un arbitrage manager ne l'établit pas.

## P0-08 — Commande confirmée fournisseur reste engagée

Une commande `confirmee_fournisseur` reste une commande en cours jusqu'à `livree`, `reception_controlee` ou `annulee`.

### Attendu

- son volume reste intégré dans `commandesEnCoursVolumeL` ;
- elle reste disponible pour le rapprochement Réception → Commande ;
- NEXUS ne recommande pas un second camion comme si elle avait disparu.

## P0-09 — Commande hors NEXUS reste engagée

Le statut `hors_nexus` signifie qu'une commande réelle existe déjà par un autre canal.

### Attendu

- son volume reste intégré jusqu'à livraison/annulation ;
- la recommandation qu'elle neutralise ne réapparaît pas ;
- elle peut être rapprochée de la réception réelle.

## P0-10 — Consommation nulle ne permet jamais de compléter le camion

Un carburant à consommation `0` n'est pas équivalent à un carburant sans historique.

### Attendu

- `consommationMoyenneJour === 0` interdit toute complétion automatique ;
- `null` signifie donnée insuffisante ;
- un carburant suspendu/indisponible ne sert jamais de remplissage ;
- le GNR de Sainte-Marie ne doit pas être ajouté automatiquement à un camion plein tant que son statut opérationnel n'est pas fiabilisé.

## P0-11 — Journée partielle jamais apprise comme journée complète

Cas réels :

- 18/07/2026 : Q1 sans litrage, Q2 connu ;
- 19/07/2026 : Q1 sans litrage, Q2 connu ;
- 20/07/2026 : Q1 connu, Q2 sans litrage.

### Attendu

- ces journées sont qualifiées `partielles` ;
- elles n'alimentent pas une moyenne journalière comme journées complètes ;
- l'absence d'un quart reste distincte d'une vraie faible journée commerciale.

## P0-12 — Suspicion de duplication de quart à arbitrer

Cas réel : 28/08/2026, Q1 et Q2 portent exactement les mêmes litrages GO, SP95 et GNR.

### Attendu

- signaler une suspicion ;
- ne supprimer ni corriger automatiquement ;
- dégrader/exclure ce point pour les calculs sensibles tant que l'exception n'est pas arbitrée.

## P0-13 — Couverture Performance basée sur les quarts attendus

Le dénominateur d'une période n'est jamais uniquement le nombre de lignes existantes dans `audits_caisse`.

Cas 31/08 : 61 lignes présentes ne signifient pas 61/61 quarts complets si le Q2 du 31/08 est encore attendu.

### Attendu

Distinguer :

- présent avec litrage ;
- présent sans litrage ;
- attendu mais absent ;
- non attendu.

## P0-14 — Fin de période = clôture opérationnelle

`periode.fin === todayISO()` ne suffit pas à conclure que la période est terminée.

Le mois du 31/08 reste provisoire tant que les quarts attendus de la journée ne sont pas clôturés.

## P0-15 — Référence partielle jamais présentée comme mois comparable

Juillet 2026 ne contient dans NEXUS que la période du 18 au 31 juillet avec des quarts incomplets.

### Attendu

- une référence candidate est qualifiée avant usage ;
- pas de comparaison « mois complet vs mois partiel » sous l'étiquette « à jours comparables » ;
- utiliser une fenêtre réellement comparable ou afficher comparaison indisponible.

## P0-16 — Même coupure opérationnelle entre période actuelle et référence

Si le 31/08 n'a que Q1, sa référence ne doit pas inclure Q1+Q2 du 24/08.

À défaut de coupure fiable, la comparaison reste provisoire/non disponible.

## P0-17 — Une tendance provisoire ne déclenche jamais une conclusion ferme

Quand `tendanceProvisoire === true` :

- `construireMessagesPilotage()` ne produit pas d'alerte commerciale consolidée ;
- le code couleur et les phrases d'analyse utilisent le même niveau de confiance ;
- aucune cause commerciale n'est inventée.

## Critère de sortie P0

Le lot est validable uniquement lorsque :

- le relevé d'ouverture n'est plus écrasé par une réception ;
- le BL est lu depuis Réception et non dérivé du flotteur ;
- la commande du jour tient compte des BL déjà reçus sans découpage horaire des ventes ;
- les réceptions physiquement ambiguës sont arbitrées avant sommation ;
- les commandes `confirmee_fournisseur` et `hors_nexus` restent engagées ;
- le GNR à consommation nulle ne peut pas compléter automatiquement un camion ;
- les journées/quarts partiels ne contaminent plus les moyennes ;
- Performance démontre la comparabilité avant toute conclusion ;
- l'anomalie +695 L du 31/08 reste visible et `cause_etablie=false` ;
- aucune version historique n'est supprimée ;
- la PR reste brouillon jusqu'à validation des tests réels.
