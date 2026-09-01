# NEXUS Carburants — P0 Chaîne de preuve — 31/08/2026

> Branche : `audit-carburants-p0-20260831`
> Statut : audit et recette avant correction. Ne pas fusionner tant que les cas ci-dessous ne sont pas vérifiés.

## Principe

Commande, document de livraison, compartiments, variation mesurée au jaugeage et stock physique sont des vérités distinctes. NEXUS les rapproche ; il ne remplace jamais l'une par l'autre.

## P0-18 — La quantité documentaire livrée ne devient jamais la variation mesurée

Cas réel Sainte-Marie du 31/08/2026 :

- commande NEXUS : 5 000 L GO ;
- quantité BL : 5 000 L ;
- compartiments déclarés : 5 000 L ;
- variation mesurée au jaugeage : 5 695 L ;
- écart réception : +695 L / +13,9 % ;
- stock physique post-réception : 7 671 L.

### Attendu

- `carburant_releves.livraison_go` porte la quantité documentaire/confirmée utilisée par le théorique, ici 5 000 L, jamais 5 695 L ;
- le stock physique post-réception reste issu des jaugeages après livraison ;
- la variation mesurée reste dans la chaîne de preuve Réception et sert à calculer l'écart ;
- aucun écart mesuré ne peut être utilisé simultanément comme entrée du théorique et comme mesure physique à contrôler.

### Interdit

- dériver `livraison_*` de `delta_mesure_l` ;
- utiliser le même flotteur comme preuve de la quantité livrée et comme mesure contrôlée.

## P0-19 — Dernière livraison affiche la vérité documentaire et l'écart séparément

La carte « Dernière livraison » ne doit pas présenter `quantite_mesuree_l` comme quantité livrée lorsque le BL existe.

### Attendu

Pour le 31/08 :

- `Livraison : 5 000 L GO` ;
- information distincte : `Variation mesurée : 5 695 L` ;
- information distincte : `Écart à rapprocher : +695 L (+13,9 %)` ;
- aucune formulation ne laisse croire que le fournisseur a livré 5 695 L sans preuve documentaire.

## P0-20 — Toute nouvelle vérité physique invalide le contrôle dérivé précédent

Cas réel du 31/08 : le relevé est passé en version 3, origine `reception_livraison`, mesure 13:45, alors que le dernier contrôle persisté avait été calculé avant cette réception.

### Attendu

- création/modification d'un relevé physique => `controle_statut = en_attente` ;
- recalcul du contrôle à partir de la nouvelle version ;
- insertion d'une nouvelle version de `carburant_controles` seulement si le résultat dérivé change ;
- `controle_statut = ok` uniquement après succès du recalcul correspondant à la version physique courante ;
- en cas d'échec : `controle_statut = erreur`, jamais conservation de l'ancien `ok`.

## P0-21 — Tous les statuts réellement engagés restent visibles jusqu'à réception

Statuts SQL d'une commande : `proposee`, `validee`, `confirmee_fournisseur`, `modifiee`, `reportee`, `hors_nexus`, `annulee`, `livree`, `reception_controlee`.

### Commandes engagées

Doivent rester intégrées au moteur et disponibles pour le rapprochement réception :

- `validee` ;
- `modifiee` ;
- `confirmee_fournisseur` ;
- `hors_nexus`.

### Hors commandes engagées

- `proposee` : pas encore commandée ;
- `reportee` : décision différée ;
- `annulee` : annulée ;
- `livree` / `reception_controlee` : déjà reçue.

### Attendu

Le même prédicat métier « commande engagée » est réutilisé par :

1. la prévision de stock/commande ;
2. la prévention d'une double commande ;
3. le rapprochement automatique Réception → Commande.

Une confirmation fournisseur ne doit jamais faire disparaître une commande ; elle augmente au contraire son niveau de certitude.

## P1-01 — Suspicion de double représentation d'une réception

Cas à arbitrer, jamais à supprimer automatiquement : 26/08/2026.

Deux visites distinctes, deux références documentaires et deux clés d'idempotence, mais :

- horaires qui se chevauchent ;
- même chauffeur ;
- jaugeages avant/après strictement identiques sur toutes les cuves ;
- mêmes volumes GO/SP95 ;
- composition compartiments pratiquement identique.

### Attendu

NEXUS peut signaler : `Deux réceptions présentent une signature physique identique sur une fenêtre horaire chevauchante — vérifier s'il s'agit de deux opérations distinctes.`

Il ne fusionne, ne supprime et ne corrige aucune visite sans arbitrage manager.

## P1-02 — La signature statistique exclut l'observation qu'elle évalue

`signatureDeltaLivraison` est une bonne base robuste (médiane + MAD), mais l'historique fourni doit exclure la visite courante.

### Attendu

- comparaison d'une réception uniquement aux réceptions indépendantes antérieures ;
- possibilité d'exclure les réceptions marquées comme suspicion de doublon de l'échantillon d'apprentissage ;
- taille d'échantillon affichée après ces exclusions.

## P1-03 — Apprentissage futur du défaut de flotteur par niveau de cuve

Ne pas conclure aujourd'hui à un seuil de niveau : l'historique indépendant est encore insuffisant.

Conserver pour chaque cuve et chaque réception :

- niveau avant en litres et % de capacité ;
- niveau après en litres et % ;
- quantité documentaire affectée si connue ;
- variation mesurée ;
- écart mesure/document ;
- statut de qualité de la réception.

Lorsque plusieurs observations indépendantes convergent, NEXUS pourra formuler une hypothèse du type : `Les écarts de jaugeage augmentent de façon récurrente lorsque la cuve se situe dans cette zone de remplissage.` Tant que ce n'est pas démontré : `cause non établie`.

## Cas chiffré — pourquoi P0-18 est nécessaire

Dernier stock physique GO du 29/08 : 7 308 L.
Ventes captées jusqu'au Q1 du 31/08 : 5 276,28 L.
Stock physique post-réception du 31/08 : 7 671 L.

Avec la variation mesurée utilisée à tort comme livraison :

`7 308 + 5 695 - 5 276,28 = 7 726,72 L` théoriques, soit seulement `-55,72 L` face au physique.

Avec la quantité documentaire :

`7 308 + 5 000 - 5 276,28 = 7 031,72 L` théoriques, soit `+639,28 L` inexpliqués face au physique.

Les deux écarts (+695 L sur la réception et +639,28 L sur une fenêtre inter-relevés plus large) ne sont pas identiques mathématiquement, mais ils appartiennent à la même famille d'anomalie. NEXUS doit préserver cette information au lieu de l'auto-neutraliser.
