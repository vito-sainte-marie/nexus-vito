# NEXUS Carburants — Correction de doctrine temporelle — 31/08/2026

> Branche : `audit-carburants-p0-20260831`
> Statut : cette note ANNULE et remplace les hypothèses P0-01 à P0-06 du premier brouillon qui faisaient du jaugeage post-réception de 13:45 une nouvelle ancre de calcul.

## Décision métier validée

Tant que NEXUS ne reçoit pas de ventes carburant horodatées par API Insite360, les ventes ne sont connues qu'à la granularité du quart. NEXUS ne doit donc jamais fabriquer une ventilation intrajournalière des litres vendus.

La référence du contrôle carburant reste le jaugeage physique d'ouverture, avant les ventes du matin. Une livraison arrivée après cette ouverture appartient à la fenêtre qui conduit au relevé d'ouverture suivant.

Le jaugeage après réception est une preuve physique utile pour connaître le stock courant et contrôler la réception, mais il ne devient pas une frontière temporelle permettant de retrancher seulement les ventes postérieures à son heure.

## Cas réel du 31/08/2026

- relevé d'ouverture corrigé manager (version 2) : GO cuve 1 = 1 448 L ; GO cuve 2 = 1 554 L ; total GO = 3 002 L ;
- début de réception saisi : 11:38 heure Martinique ;
- commande NEXUS : 5 000 L GO ;
- BL : 5 000 L GO ;
- compartiments : 5 000 L GO ;
- jaugeage après réception : 4 831 + 2 840 = 7 671 L GO ;
- variation mesurée : 5 695 L ;
- écart réception : +695 L / +13,9 % ;
- heure technique du jaugeage final / pont : environ 13:45 locale.

## Chaîne correcte

1. Le relevé d'ouverture du 31/08 reste l'ancre de contrôle : 3 002 L GO.
2. Les ventes du 31/08 sont comptées lorsqu'elles sont disponibles dans leur intégralité selon la granularité des quarts.
3. La livraison documentaire de 5 000 L intervenue le 31/08 est ajoutée dans la fenêtre allant vers le prochain relevé d'ouverture.
4. Le relevé d'ouverture du 01/09 sera comparé au théorique construit depuis l'ouverture du 31/08 + livraisons documentaires + mouvements - ventes connues.
5. Le jaugeage post-réception de 7 671 L peut être affiché comme dernier stock physique connu et servir au contrôle qualité de réception, mais ne remplace pas l'ancre d'ouverture dans le contrôle inter-relevés.
6. Les +695 L restent une anomalie de réception à rapprocher ; ils ne deviennent jamais une quantité livrée certaine.

## Interdit tant qu'Insite360 n'est pas disponible

- calculer les litres vendus entre 11:38 et 13:45 ;
- estimer une fraction de Q1 ou Q2 pour fabriquer un stock théorique intrajournalier ;
- prendre 13:45 comme nouvelle frontière de ventes ;
- écraser le relevé d'ouverture du jour avec le jaugeage post-livraison ;
- écrire `livraison_go = quantite_mesuree_l` ;
- présenter `theorique = stock_post_livraison` et `ecart = 0` comme un contrôle du jour.

## Correctif structurel attendu

Le pont Réception → Carburants ne doit plus modifier la ligne `carburant_releves` représentant le relevé d'ouverture du jour.

Les mesures post-réception restent dans `carburant_reception_mesures` et sont utilisables pour l'affichage du dernier stock physique connu via les fonctions déjà existantes `referencePhysiqueDuJour()` / `stockPhysiquePostLivraison()`.

Pour le contrôle du relevé suivant, NEXUS doit récupérer automatiquement les réceptions validées intervenues depuis le précédent relevé et sommer les quantités documentaires/confirmées (`quantite_bl_l`, sous réserve du statut de réception), afin d'alimenter la variable `livraison` sans ressaisie manager.

## Compatibilité historique

Les anciennes lignes `carburant_releves.livraison_*` restent supportées comme source historique/legacy. La nouvelle logique doit éviter un double comptage lorsqu'une même réception existe à la fois dans les anciennes colonnes et dans les tables de réception.

## Règle NEXUS

**Une heure enregistrée ne donne pas automatiquement une précision que la donnée commerciale ne possède pas.**

L'heure de début de réception est une preuve de l'événement. L'heure du jaugeage final est une preuve de mesure. Tant que les ventes ne sont pas horodatées au même niveau, le contrôle carburant reste ancré sur les relevés d'ouverture et les quarts complets.
