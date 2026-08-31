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

## Critère de sortie P0

Le lot est validable uniquement lorsque :

- le scénario P0-01 ne double-compte plus les ventes pré-ancre ;
- P0-02 conserve le comportement historique des jaugeages d'ouverture ;
- P0-03 à P0-05 sont couverts par la logique partagée, pas par un correctif d'écran ;
- P0-08 et P0-09 empêchent toute double recommandation alors qu'une commande réelle est déjà engagée ;
- la branche ne contient que les modifications attendues ;
- la PR reste brouillon jusqu'à validation explicite.