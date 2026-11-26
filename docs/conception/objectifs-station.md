# Référentiel des objectifs de station : étapes 1 à 5 (inventaire, autorité, catalogue, requêtes, modèle, maquettes, recette, arbitrages)

Branche `claude/objectifs-station` · mandat Guardian (#383, commentaire 7201798072) · **conception seule : aucun code, aucune migration, aucune lecture Production.**
Base : audit des moteurs (PR #393, `docs/audit/audit-moteurs-nexus.md`, V1–V12).

## 0. Doctrine (rappel)

Trois natures, jamais confondues, jamais additionnées :

| Nature | Qui la fixe | Exemple | Se mesure comme |
|---|---|---|---|
| **Objectif de performance** | le gérant, validé | CA boutique +5 % | valeur réelle / cible |
| **Exigence permanente de maîtrise** | la règle d'exploitation | 100 % des contrôles obligatoires | conforme / non conforme |
| **Potentiel détecté** | un moteur | écart de marge R5, campagne restante | jamais un objectif, jamais un gain acquis |

Une bonne performance commerciale ne compense jamais une anomalie opérationnelle confirmée : les deux se lisent côte à côte, sans solde.

Règles transverses : une valeur réelle vient toujours d'un moteur, jamais d'une saisie ; une donnée absente s'affiche « non disponible », jamais 0 (Art. 5) ; un calcul par indicateur (Art. 11) ; aucune cible de marge hors `tarif_seuils`.

## 1. Inventaire des indicateurs (livrable 1)

Colonnes : **Id** stable · **Nature** P = performance, M = maîtrise · **Unité / sens** (↑ plus haut = mieux, ↓ plus bas = mieux) · **Agrégation** sur mois/trimestre/année · **HT/TTC**.

### Carburants
| Id | Indicateur | Nat. | Unité / sens | Agrégation | HT/TTC |
|---|---|---|---|---|---|
| CARB-VOL-TOT | Volume total vendu | P | L ↑ | additif (somme) | sans objet |
| CARB-VOL-PROD | Volume par carburant (GO, SP95, GNR) | P | L ↑ | additif | sans objet |
| CARB-LIT-JOUR | Litrage journalier moyen | P | L/j ↑ | moyenne pondérée par jours d'ouverture (jamais cible annuelle ÷ 12) | sans objet |
| CARB-MARGE | Marge brute carburant | P *(Reclassé à l'étape 5 sur la matrice §2 seule, sans relecture du code.)* | € ↑ | additif | HT |
| CARB-PROGRES | Progression des volumes | P | % ↑ | ratio, recalculé sur la période (pas sommé) | sans objet |
| CARB-RUPTURE | Jours de rupture | M *(Reclassé à l'étape 5 sur la matrice §2 seule, sans relecture du code.)* | j ↓ (cible 0) | additif | sans objet |
| CARB-ECART-NE | Écarts non expliqués | M *(Reclassé à l'étape 5 sur la matrice §2 seule, sans relecture du code.)* | L ou nb ↓ | additif | sans objet |
| CARB-PROD-H | volumes ci-dessus ÷ heures d'ouverture | Tempo pour les volumes ; heures : voir ci-dessous *(Reclassé à l'étape 5 sur la matrice §2 seule, sans relecture du code.)* | Heures : `station_config.horaires` existe (Paramètres Station, source canonique, migration 20260919160000, lue aussi par `calculer_horaires_quart`). Elle déclare les régimes `normal` et `etendu` par quart, pas forcément l'ouverture réelle de la station ni les fermetures exceptionnelles. Indicateur **à fiabiliser** : arbitrage G-3 pour le gérant. |

### Commerce
| Id | Indicateur | Nat. | Unité / sens | Agrégation | HT/TTC |
|---|---|---|---|---|---|
| COM-CA | CA boutique | P | € ↑ | additif | HT (TTC en détail) |
| COM-CA-JOUR | CA journalier moyen | P | €/j ↑ | moyenne pondérée jours d'ouverture | HT |
| COM-PROGRES | Progression du CA | P | % ↑ | ratio recalculé | HT |
| COM-PANIER | Panier moyen | P | € ↑ | Σ CA ÷ Σ tickets (jamais moyenne de moyennes) | HT |
| COM-TICKETS | Nombre de transactions | P | nb ↑ | additif | sans objet |
| COM-CA-H | CA par heure d'ouverture | P | €/h ↑ | Σ CA ÷ Σ heures | HT |
| COM-DISPO-REF | Disponibilité des références prioritaires | M | % ↑ | ratio jours-référence disponibles | sans objet |

### Marge
| Id | Indicateur | Nat. | Unité / sens | Agrégation | HT/TTC |
|---|---|---|---|---|---|
| MAR-BRUTE | Marge brute commerciale | P *(Reclassé à l'étape 5 sur la matrice §2 seule, sans relecture du code.)* | € ↑ | additif | HT |
| MAR-TAUX | Taux de marge | P | % ↑ | Σ marge ÷ Σ CA HT, sur la période (jamais annuel ÷ 12, jamais moyenne de taux) | HT |
| MAR-PROGRES | Progression de la marge brute | P | % ↑ | ratio recalculé | HT |
| MAR-H | Marge par heure d'ouverture | P | €/h ↑ | Σ marge ÷ Σ heures | HT |
| MAR-ANO-TARIF | Anomalies tarifaires confirmées | M *(Reclassé à l'étape 5 sur la matrice §2 seule, sans relecture du code.)* | nb ↓ (cible 0) | additif | sans objet |
| MAR-DEMARQUE | Démarque connue | P | € ou % du CA ↓ | additif (€) ; ratio (%) | HT |
| MAR-PERTE-DC | Pertes dates courtes | P *(Reclassé à l'étape 5 sur la matrice §2 seule, sans relecture du code.)* | € ↓ | additif | HT, au coût d'achat |
| MAR-EVITE | Pertes effectivement évitées | P | € ↑ | additif, uniquement résultat constaté | HT, au coût d'achat |

Définition du taux de marge retenue : **(CA HT − coût d'achat HT) ÷ CA HT**, la cible venant de `tarif_seuils` ; la référence 25 % codée en dur à trois endroits (audit §13) n'est pas une cible d'objectif.

### FDJ
| Id | Indicateur | Nat. | Unité / sens | Agrégation | HT/TTC |
|---|---|---|---|---|---|
| FDJ-COMMISSION | Commissions perçues | P *(Reclassé à l'étape 5 sur la matrice §2 seule, sans relecture du code.)* | € ↑ | additif | commission FDJ (non soumise au HT/TTC boutique : à confirmer avec la comptabilité) |
| FDJ-VOLUME | Volume d'activité (ventes de jeux) | P | € ↑ | additif | TTC joueur |
| FDJ-EVOL | Évolution | P | % ↑ | ratio recalculé | sans objet |
| FDJ-ECART-COMP | Écarts après compensation autorisée | M *(Reclassé à l'étape 5 sur la matrice §2 seule, sans relecture du code.)* | € ↓ | additif en absolu | sans objet |
| FDJ-CONTROLES | Contrôles réalisés | M | % ↑ | ratio réalisés ÷ dus | sans objet |
| FDJ-ANO-NR | Anomalies non régularisées | M | nb ↓ (cible 0) | stock à date, pas somme | sans objet |

Volume et commissions sont deux indicateurs distincts : on ne déduit pas l'un de l'autre. Les règles de compensation FDJ ne sont pas touchées.

### Opérations
| Id | Indicateur | Nat. | Unité / sens | Agrégation | HT/TTC |
|---|---|---|---|---|---|
| OPS-CTRL | Contrôles obligatoires réalisés | M | % ↑ | ratio | sans objet |
| OPS-CLOT | Clôtures conformes | M | % ↑ | ratio | sans objet |
| OPS-ECART-CAISSE | Écarts absolus de caisse par quart | M | € ↓ | moyenne par quart, en valeur absolue | sans objet |
| OPS-INV | Inventaires dans les délais | M | % ↑ | ratio | sans objet |
| OPS-ANO-DELAI | Anomalies résolues dans les délais | M | % ↑ | ratio | sans objet |
| OPS-DELAI-RES | Délai moyen de résolution | M | jours ↓ | moyenne sur anomalies résolues | sans objet |
| OPS-TOURNEES | Tournées dates courtes réalisées | M | % ↑ | ratio | sans objet |
| OPS-EQUIP | Disponibilité des équipements critiques | M *(Reclassé à l'étape 5 sur la matrice §2 seule, sans relecture du code.)* | % ↑ | ratio temps disponible | sans objet |

`OPS-ECART-CAISSE` (maîtrise, absolu par quart) n'a rien à voir avec les écarts individuels consolidés du dossier comptable Paye : deux indicateurs, deux libellés, jamais fusionnés.

## 2. Matrice d'autorité (livrable 2)

Une ligne = un indicateur = **un seul calcul**. « Autorité » est le moteur qui calcule ; le Brief, le Conseiller et le rapport A4 lisent ce moteur et n'ont aucun calcul concurrent. Les points « à trancher » renvoient à l'audit #393.

| Id | Source de données (lecture) | Moteur autorité | Doublon / risque (audit) |
|---|---|---|---|
| CARB-VOL-*, CARB-LIT-JOUR, CARB-PROGRES | `audits_caisse.litrage_gazole / litrage_sp95 / litrage_gnr` par quart (saisie caissier) via `chargerVentesPeriode` | **Tempo** (`nexus-tempo.js` : `joursLitresCompletsPiste`, `resumerParJour`), seule autorité sur les litres par jour complet (Brief v4 §21.bis, audit §13.5). Les fonctions de `nexus-carburant-moteur.js` (`sommerVentesPeriode`, `calculerMixCarburant`, `calculerEvolutionVolume`) ne font pas foi pour ces indicateurs. | Pas de troisième propriétaire : Tempo et le Brief v4 sont alignés. Écart à trancher (arbitrage G-1) : la progression du Brief est en fenêtres glissantes de 7 jours, le référentiel exige des périodes calendaires. Ancre « aujourd'hui » en UTC (audit §13.3). |
| CARB-MARGE | `carburant_commandes`, `carburant_tarifs_achat`, prix de vente courant (CMP progressif) | `nexus-carburant-moteur.js` (CMP, effet prix) *(Reclassé à l'étape 5 sur la matrice §2 seule, sans relecture du code.)* | Aucun historique de marge carburant mensuel stocké : à construire ou à écarter (étape 2). |
| CARB-RUPTURE | `carburant_releves` (stock réel par jour) + seuils cuve | `nexus-carburant-moteur.js` (contrôle du jour) *(Reclassé à l'étape 5 sur la matrice §2 seule, sans relecture du code.)* | Définition de « rupture » à fixer (seuil de cuve). |
| CARB-ECART-NE | `carburant_controles`, `nexus_ecarts_qualifications` | `nexus-carburant-moteur.js` + `nexus-ecarts-moteur.js` *(Reclassé à l'étape 5 sur la matrice §2 seule, sans relecture du code.)* | Qualification d'écart : autorité = gravité dans `nexus-ecarts-moteur.js` (audit §13.5). |
| CARB-PROD-H | volumes ci-dessus ÷ heures d'ouverture | aucun *(Reclassé à l'étape 5 sur la matrice §2 seule, sans relecture du code.)* | **Aucune table d'heures d'ouverture** : indicateur non disponible tant que la source n'existe pas. |
| COM-CA, COM-CA-JOUR, COM-PROGRES | `audits_caisse.vente_boutique` (par quart) | **Saisie de caisse** (`audits_caisse.vente_boutique`), via Tempo (`joursCaBoutique`) | Décidé par le gérant (second contre-audit §3) : le suivi d'activité au jour le jour est la saisie de caisse ; les périodes importées servent à l'analyse produit et à la rentabilité. Deux périmètres coexistent (caisse et import Decenium) : la différence de périmètre est écrite ici et dans la maquette, jamais effacée. |
| COM-PANIER, COM-TICKETS | `panier_moyen_quotidien` (`nb_tickets`, `panier_moyen_ht/ttc`, hors carburant, import Decenium) | à désigner (aucun moteur dédié trouvé) | Ces deux indicateurs restent **sur l'import**, car la saisie de caisse ne porte pas les tickets. Périmètre différent de COM-CA (import, hors carburant) : afficher le périmètre sous la valeur. Panier = Σ CA ÷ Σ tickets, recomposé par `panier_moyen × nb_tickets`. |
| COM-CA-H, MAR-H | CA ou marge ÷ heures d'ouverture | Tempo (CA), R5 (marge) ; heures : G-3 | Mêmes réserves que CARB-PROD-H : **à fiabiliser** tant que le gérant n'a pas confirmé la source des heures. |
| COM-DISPO-REF | `mission_completions`, références prioritaires | aucun | « Référence prioritaire » non défini. |
| MAR-BRUTE, MAR-TAUX, MAR-PROGRES | `normalized_sales` (ventes importées) + coûts d'achat | `nexus-rayon-moteur.js` / règle R5 (écart de marge) *(Reclassé à l'étape 5 sur la matrice §2 seule, sans relecture du code.)* | La marge n'existe que par période d'import, et une période peut chevaucher deux mois. **Règle de passage au mois civil : au prorata des jours**, comme l'histogramme base 100 par jour (`resumerMargeParPeriode`). Si une période n'est pas couverte, le mois est **à fiabiliser** et affiché ainsi. Cible de taux : `tarif_seuils` (vide en Production), la référence 25 % codée en dur à trois endroits n'est pas une cible. |
| MAR-ANO-TARIF | `journal_decisions` (R5-MARGE-ECART), `marge_exceptions` | moteur R5 *(Reclassé à l'étape 5 sur la matrice §2 seule, sans relecture du code.)* | « Confirmée » = décision au journal. |
| MAR-DEMARQUE | `inventaire_*`, `inventaire_alertes` | `nexus-inventaire-moteur.js` | Définition de « démarque connue » à valider avec le gérant. |
| MAR-PERTE-DC, MAR-EVITE | lot Dates courtes (PR #352 / #354, non en Production) | à venir *(Reclassé à l'étape 5 sur la matrice §2 seule, sans relecture du code.)* | Source absente en Production tant que le lot n'est pas déployé. |
| FDJ-COMMISSION | `fdj_reports` | `nexus-fdj-moteur.js` *(Reclassé à l'étape 5 sur la matrice §2 seule, sans relecture du code.)* | À confirmer : la table porte-t-elle la commission ? Sinon indicateur « à fiabiliser ». |
| FDJ-VOLUME, FDJ-EVOL | `view_fdj_daily_summary`, `view_fdj_game_daily` (CA par jeu) | **Tempo** (`joursCaFdjComplets`), seule autorité sur le CA FDJ par jour complet (Brief v4 §21.bis, audit §13.5). `nexus-fdj-moteur.js` garde les contrôles et la compensation. | Pas de troisième propriétaire. Évolution FDJ du Brief : fenêtre 7 jours ×250 plafonnée ±25 (audit §3), à aligner sur des périodes calendaires (G-1). |
| FDJ-ECART-COMP, FDJ-ANO-NR, FDJ-CONTROLES | `fdj_cash_controls`, `fdj_discrepancies`, `fdj_shifts` | `nexus-fdj-moteur.js` *(Reclassé à l'étape 5 sur la matrice §2 seule, sans relecture du code.)* | Compensation autorisée : lire telle quelle, sans la réécrire. |
| OPS-CTRL | `carburant_controles`, `mission_completions`, `fdj_cash_controls` | à désigner | Plusieurs moteurs comptent « contrôle » ; définir la liste des contrôles obligatoires. |
| OPS-CLOT | `audits_caisse` (clôture), `fdj_shifts` | `nexus-verify-moteur.js` (`agregerAudits`) | « Conforme » à définir ; V4 et V11 non conformes. |
| OPS-ECART-CAISSE | `audits_caisse` (écart par quart) | **`nexus-ecarts-moteur.js` (autorité proposée, audit §13.5)** | Lu de quatre façons (Verify max absolu, Tempo somme nette, Écarts seuils, A4 via agregerAudits) : tant que l'autorité n'est pas fixée, l'objectif ne peut pas citer de chiffre. |
| OPS-INV | `inventaire_missions`, `inventaire_quarts` | `nexus-inventaire-moteur.js` | Délai de référence à fixer. |
| OPS-ANO-DELAI, OPS-DELAI-RES | `inventaire_alertes`, journaux d'anomalies | `nexus-risques-moteur.js` (niveau/urgence, autorité proposée) | Notion de « délai » non partagée entre moteurs. |
| OPS-TOURNEES | lot Dates courtes | à venir | Idem MAR-PERTE-DC. |
| OPS-EQUIP | aucune | aucun *(Reclassé à l'étape 5 sur la matrice §2 seule, sans relecture du code.)* | Aucune table d'équipements critiques. |

### Ce que l'inventaire fait déjà apparaître

1. **Volumes carburant et CA FDJ** : l'autorité est Tempo (litres et CA FDJ par jour complet), comme dans le Brief v4 §21.bis et l'audit §13.5. Les litres viennent de la saisie du caissier par quart, pas d'un compteur ; les index de pompe (`carburant_index_valeurs`) pourraient recouper mais n'ont pas d'historique long.
2. **Heures d'ouverture** : la source existe (`station_config.horaires`, canonique). Reste à savoir si elle représente l'ouverture réelle ; sinon le gérant les saisit une fois ou on écarte les quatre indicateurs « par heure » (G-3).
3. **Jours fériés et vacances scolaires de Martinique** : déjà dans Tempo (`analyseFeries`) et dans `inventaire_calendrier_site` (migration 20261110130000). Le découpage saisonnier s'appuie dessus, sans nouvelle table.
4. **CA boutique** : décidé, la saisie de caisse fait foi pour l'activité quotidienne ; panier et tickets restent sur l'import, périmètre écrit.
5. **Marge au mois** : passage de la période d'import au mois civil au prorata des jours, mois non couvert marqué « à fiabiliser ».
6. **Cibles** : `tarif_seuils` est vide en Production ; l'objectif de taux de marge n'a pas de repère hérité.
7. **Écart de caisse** : aucune autorité effective aujourd'hui (quatre lectures).
8. **Sources absentes** : équipements critiques, références prioritaires.

### Arbitrages ouverts pour le gérant (étape 1)

- **G-1** : progression en périodes calendaires (mois contre mois précédent, en moyenne par jour complet) plutôt qu'en fenêtres glissantes de 7 jours.
- **G-3** : les horaires de `station_config.horaires` valent-ils horaires d'ouverture de la station ? Sinon : les saisir une fois, ou renoncer aux quatre indicateurs « par heure ».

## 3. Catalogue et classement (livrable 3)

Trois classes, appliquées sans exception (article 5 : pas de valeur fabriquée).

- **Disponible** : une requête de lecture donne l'historique mensuel de la station avec la couverture de chaque mois.
- **À fiabiliser** : la source existe mais sa lecture mensuelle exige un arbitrage ou une règle de passage ; aucune requête n'est livrée tant qu'elle n'est pas tranchée.
- **Non disponible** : aucune source stockée à ce jour ; l'indicateur ne peut être ni suivi ni projeté.

| Id | Classe | Source ou raison | Agrégation sur le mois | Premier mois disponible |
|---|---|---|---|---|
| CARB-VOL-TOT | Disponible | `audits_caisse` (litrages), jours complets Tempo | somme (additif) | mi-juillet 2026 |
| CARB-VOL-PROD | Disponible | idem, par produit (gazole, SP95, GNR) | somme (additif) | mi-juillet 2026 |
| CARB-LIT-JOUR | Disponible | idem, litres ÷ jours complets | moyenne par jour complet | mi-juillet 2026 |
| CARB-PROGRES | Dérivé | série mensuelle de CARB-VOL-TOT (règle G-1) | sans requête propre | mi-juillet 2026 |
| COM-CA | Disponible | `audits_caisse.vente_boutique`, mêmes jours complets | somme (additif) | mi-juillet 2026 |
| COM-CA-JOUR | Disponible | idem, CA ÷ jours complets | moyenne par jour complet | mi-juillet 2026 |
| COM-PANIER | Disponible, périmètre écrit | `panier_moyen_quotidien` (boutique hors carburant) | ratio Σ CA ÷ Σ tickets | janvier 2026 |
| COM-TICKETS | Disponible, périmètre écrit | idem | somme (additif) | janvier 2026 |
| COM-PROGRES | Dérivé | série mensuelle de COM-CA | sans requête propre | mi-juillet 2026 |
| FDJ-VOLUME | Disponible | `view_fdj_daily_summary`, jours à deux quarts contrôlés | somme (additif) | janvier 2026 |
| FDJ-EVOL | Dérivé | série mensuelle de FDJ-VOLUME | sans requête propre | janvier 2026 |
| OPS-ECART-CAISSE | Disponible | `audits_caisse.ecart_total`, valeur absolue par quart | moyenne par quart, sans compensation | mi-juillet 2026 |
| CARB-PROD-H, COM-CA-H, MAR-H | À fiabiliser | dépend des horaires réels (G-3) *(Reclassé à l'étape 5 sur la matrice §2 seule, sans relecture du code.)* | ratio | sans objet à ce stade |
| MAR-BRUTE, MAR-TAUX, MAR-PROGRES | À fiabiliser | marge connue par période d'import ; passage au mois civil au prorata des jours *(Reclassé à l'étape 5 sur la matrice §2 seule, sans relecture du code.)* | ratio | sans objet à ce stade |
| CARB-ECART-NE | À fiabiliser | qualification manuelle, pas de champ dédié lu *(Reclassé à l'étape 5 sur la matrice §2 seule, sans relecture du code.)* | à définir | sans objet à ce stade |
| FDJ-ECART-COMP, FDJ-CONTROLES | À fiabiliser | lecture à confirmer sur la vue FDJ, règle de comptage à écrire *(Reclassé à l'étape 5 sur la matrice §2 seule, sans relecture du code.)* | à définir | sans objet à ce stade |
| CARB-RUPTURE | Non disponible | seule une rupture projetée existe dans le moteur de commande ; aucune rupture observée n'est stockée *(Reclassé à l'étape 5 sur la matrice §2 seule, sans relecture du code.)* | sans objet | sans objet à ce stade |
| CARB-MARGE | Non disponible | aucun coût d'achat stocké *(Reclassé à l'étape 5 sur la matrice §2 seule, sans relecture du code.)* | sans objet | sans objet à ce stade |
| FDJ-COMMISSION | Non disponible | aucune source de commission lue *(Reclassé à l'étape 5 sur la matrice §2 seule, sans relecture du code.)* | sans objet | sans objet à ce stade |
| OPS-CTRL, OPS-CLOT, OPS-INV, OPS-ANO-DELAI, OPS-DELAI-RES | À fiabiliser | la source existe (matrice §2) mais la définition manque : liste des contrôles obligatoires, sens de « conforme », délai de référence, notion de « délai » non partagée entre moteurs *(Reclassé à l'étape 5 sur la matrice §2 seule, sans relecture du code.)* | ratio ; moyenne sur anomalies résolues pour OPS-DELAI-RES | sans objet à ce stade |
| MAR-ANO-TARIF, MAR-DEMARQUE, FDJ-ANO-NR, COM-DISPO-REF | À fiabiliser | la source existe (matrice §2) mais « confirmée », « démarque connue », « référence prioritaire » ne sont pas définis ; FDJ-ANO-NR se lit comme un stock à date, pas comme une somme *(Reclassé à l'étape 5 sur la matrice §2 seule, sans relecture du code.)* | additif ; stock à date pour FDJ-ANO-NR ; ratio pour COM-DISPO-REF | sans objet à ce stade |
| MAR-PERTE-DC, MAR-EVITE, OPS-TOURNEES | Non disponible | source du lot Dates courtes (#352 / #354), absente de Production tant que le lot n'est pas déployé *(Reclassé à l'étape 5 sur la matrice §2 seule, sans relecture du code.)* | sans objet | sans objet à ce stade |
| OPS-EQUIP | Non disponible | aucune table d'équipements critiques *(Reclassé à l'étape 5 sur la matrice §2 seule, sans relecture du code.)* | sans objet | sans objet à ce stade |

Les anciennes lignes « à instruire » sont reclassées à l'étape 5 sur la seule base de la matrice d'autorité (§2), sans nouvelle lecture du code. Règle suivie : source nommée mais définition absente = à fiabiliser ; source absente de Production = non disponible. Aucune n'est promue en « disponible » : aucune requête de lecture n'est livrée pour elles.

### Historique disponible et conséquences (A4)

La colonne « Premier mois disponible » est celle de l'historique réellement stocké : saisie de caisse (litres, CA boutique, écarts) à partir de mi-juillet 2026 ; FDJ et imports (panier, tickets, marge par période) à partir de janvier 2026. Conséquences écrites :

- aucune comparaison d'une année sur l'autre et aucun profil saisonnier propre à la station avant l'été 2027 ;
- une cible annuelle sur un indicateur de caisse est un ordre de grandeur, pas une trajectoire éprouvée ;
- tant que 12 mois n'existent pas, le découpage mensuel d'une cible annuelle est uniforme par jour (et non saisonnier) ; l'écran l'affiche comme tel, avec le nombre de mois d'historique.

### Agrégation selon l'horizon (mois, trimestre, année)

- **Additifs** (litres, CA, tickets, volume FDJ) : le trimestre et l'année sont la somme des mois, ce qui garantit la cohérence entre horizons. Une cible annuelle se décompose en cibles mensuelles dont la somme redonne l'annuel.
- **Moyennes par jour complet** : le trimestre est Σ valeurs ÷ Σ jours complets, jamais la moyenne des moyennes mensuelles.
- **Ratios** (panier moyen) : Σ CA ÷ Σ tickets sur la période, jamais la moyenne des ratios mensuels.
- **Écart de caisse** : moyenne absolue par quart sur tous les quarts de la période.

## 4. Requêtes de lecture mensuelles (livrable 3, suite)

### Conventions communes

- **Lecture seule** : `select` uniquement, aucune écriture, aucune fonction à effet de bord.
- **Station en paramètre obligatoire** dans le `where` (`site = :station`), sans compter sur la RLS.
- **Fenêtre demi-ouverte** : `date >= :debut and date < :fin_exclusive`.
- **Fuseau** : la Martinique est en UTC−4 toute l'année, sans heure d'été. Les colonnes `date` de `audits_caisse`, `panier_moyen_quotidien` et `view_fdj_daily_summary` sont des dates de service saisies ou dérivées par la station : elles sont déjà locales, aucune conversion. Attention : la valeur par défaut de `audits_caisse.date` est `current_date` côté serveur, donc en UTC ; on ne s'y fie pas, seule la date saisie compte. Tout `timestamptz` (par exemple `created_at`, utilisé pour la fraîcheur) passe par `at time zone 'America/Martinique'` avant `date_trunc('month', …)`.
- **Jours complets** : même règle que Tempo (`joursLitresCompletsPiste`) : le jour a un quart '1' et un quart '2', chacun avec les trois litrages non nuls, et un total supérieur à zéro. Le CA boutique réutilise exactement les mêmes jours (`joursCaBoutique`).
- **Couverture visible** : chaque requête rend `jours_couverts` (jours complets du mois) et `jours_du_mois`, pour qu'un mois incomplet se voie au lieu de passer pour un mois faible.
- **Parité** : un test de parité entre ces requêtes et Tempo sur un jeu fictif figure dans les critères de recette (livrable 8).

### Requête Q-CARB : litres par mois (CARB-VOL-TOT, CARB-VOL-PROD, CARB-LIT-JOUR)

```sql
with jours as (
  select a.date,
         sum(a.litrage_gazole) as gazole,
         sum(a.litrage_sp95)   as sp95,
         sum(a.litrage_gnr)    as gnr
  from audits_caisse a
  where a.site = :station
    and a.date >= :debut and a.date < :fin_exclusive
  group by a.date
  having count(*) filter (where a.quart = '1'
                            and a.litrage_gazole is not null
                            and a.litrage_sp95   is not null
                            and a.litrage_gnr    is not null) >= 1
     and count(*) filter (where a.quart = '2'
                            and a.litrage_gazole is not null
                            and a.litrage_sp95   is not null
                            and a.litrage_gnr    is not null) >= 1
     and count(*) filter (where a.litrage_gazole is null
                             or a.litrage_sp95   is null
                             or a.litrage_gnr    is null) = 0
     and sum(a.litrage_gazole + a.litrage_sp95 + a.litrage_gnr) > 0
)
select date_trunc('month', date)::date                       as mois,
       sum(gazole)                                           as litres_gazole,
       sum(sp95)                                             as litres_sp95,
       sum(gnr)                                              as litres_gnr,
       sum(gazole + sp95 + gnr)                              as litres_total,
       count(*)                                              as jours_couverts,
       extract(day from (date_trunc('month', min(date)) + interval '1 month - 1 day'))::int as jours_du_mois,
       round(sum(gazole + sp95 + gnr) / count(*), 0)         as litres_par_jour_complet
from jours
group by 1
order by 1;
```

Le `having` reproduit `agregerParJour` : un seul quart sans détail fait tomber le jour (`litrageDisponible = false`). La date est déjà locale : `date_trunc` s'applique sans conversion. `jours_du_mois` est calculé sur `min(date)`, donc sur une expression agrégée : l'ancienne forme (`date_trunc('month', date)` hors agrégat) levait l'erreur 42803 (colonne non groupée). Même correction dans Q-COM, Q-PANIER et Q-FDJ.

### Requête Q-COM : CA boutique par mois (COM-CA, COM-CA-JOUR)

Même CTE `jours` que Q-CARB (mêmes jours complets, Tempo `joursCaBoutique`), en ajoutant `sum(a.vente_boutique) as ca_boutique` dans la CTE.

```sql
select date_trunc('month', date)::date as mois,
       sum(ca_boutique)                as ca_boutique,
       count(*)                        as jours_couverts,
       extract(day from (date_trunc('month', min(date)) + interval '1 month - 1 day'))::int as jours_du_mois,
       round(sum(ca_boutique) / count(*), 2) as ca_par_jour_complet
from jours
group by 1
order by 1;
```

La CA boutique est celle de la saisie de caisse (décision du gérant). Ce n'est pas le CA des imports.

### Requête Q-PANIER : panier moyen et tickets (COM-PANIER, COM-TICKETS)

```sql
select date_trunc('month', p.date)::date                    as mois,
       sum(p.nb_tickets)                                     as tickets,
       round(sum(p.panier_moyen_ht  * p.nb_tickets) / nullif(sum(p.nb_tickets), 0), 2) as panier_moyen_ht,
       round(sum(p.panier_moyen_ttc * p.nb_tickets) / nullif(sum(p.nb_tickets), 0), 2) as panier_moyen_ttc,
       count(*)                                              as jours_couverts,
       extract(day from (date_trunc('month', min(p.date)) + interval '1 month - 1 day'))::int as jours_du_mois
from panier_moyen_quotidien p
where p.site = :station
  and p.date >= :debut and p.date < :fin_exclusive
group by 1
order by 1;
```

Périmètre : boutique hors carburant, importé. Le panier mensuel est pondéré par les tickets, pas une moyenne de paniers journaliers. Ici « jour couvert » veut dire « jour importé » : la règle de jour complet de Tempo ne s'applique pas.

### Requête Q-FDJ : volume FDJ par mois (FDJ-VOLUME)

```sql
select date_trunc('month', v.date)::date          as mois,
       sum(v.ca_grattage + v.caisse_tirages)       as ca_fdj,
       count(*)                                    as jours_couverts,
       extract(day from (date_trunc('month', min(v.date)) + interval '1 month - 1 day'))::int as jours_du_mois
from view_fdj_daily_summary v
where v.site = :station
  and v.date >= :debut and v.date < :fin_exclusive
  and v.nb_quarts_controles >= 2
group by 1
order by 1;
```

Même règle que Tempo `joursCaFdjComplets` : deux quarts contrôlés, grattage plus tirages.

### Requête Q-ECART : écart de caisse par quart (OPS-ECART-CAISSE)

```sql
with quarts as (
  select a.date,
         abs(a.ecart_piste) + abs(a.ecart_boutique) as ecart_abs_quart,
         abs(a.ecart_total)                         as ecart_total_abs,
         a.statut
  from audits_caisse a
  where a.site = :station
    and a.date >= :debut and a.date < :fin_exclusive
    and a.ecart_piste is not null
    and a.ecart_boutique is not null
)
select date_trunc('month', date)::date                  as mois,
       count(*)                                          as quarts_mesures,
       round(avg(ecart_abs_quart), 2)                    as ecart_absolu_moyen_par_quart,
       round(sum(ecart_abs_quart), 2)                    as ecart_absolu_cumule,
       round(avg(ecart_total_abs), 2)                    as ecart_total_abs_moyen_par_quart,
       count(*) filter (where statut in ('anomalie','critique')) as quarts_anomalie_critique
from quarts
group by 1
order by 1;
```

Valeur absolue par quart, jamais de compensation entre quarts ni entre piste et boutique. Colonne de référence : `abs(ecart_piste) + abs(ecart_boutique)`, car un `ecart_total` qui additionne +20 € en piste et −20 € en boutique vaut 0 et cacherait deux écarts. `ecart_total_abs_moyen_par_quart` est rendue à titre secondaire, pour la parité avec `calculer_caisse_sante` (qui lit `ecart_total`). **Différence écrite** : sur un quart où piste et boutique se compensent, la colonne principale est supérieure à la colonne secondaire ; elles sont égales si les deux écarts ont le même signe. La couverture est le nombre de quarts mesurés rapporté à deux par jour. Seuil de gravité : celui de `nexus-ecarts-moteur.js` (autorité), pas recalculé ici. Le choix de la somme des valeurs absolues reste une décision du gérant (G-7) : voir §9.

### Fraîcheur

Pour chaque série, la fraîcheur est la dernière date de service présente, et, si l'on veut l'heure de saisie, `max(created_at at time zone 'America/Martinique')`.

## 5. Modèle relationnel (livrable 5) : présenté, non migré

**Aucune migration n'est écrite ni appliquée.** Le SQL ci-dessous est un schéma de conception, à ne pas exécuter avant GO explicite.

### Principes

- Trois natures jamais confondues : seules les **cibles de performance** sont stockées et validées. Les exigences de maîtrise et les potentiels détectés restent calculés par les moteurs, avec une `nature` portée par le catalogue pour que rien ne passe de l'une à l'autre en silence.
- **Un seul objectif officiel** par indicateur, station et période : garanti par la base (index unique partiel), pas par l'écran (article 11).
- **Versionnement par ajout** : une cible validée n'est jamais modifiée ; la corriger crée une version suivante et marque l'ancienne « remplacée ». L'historique et la version utilisée par A4 restent lisibles.
- **Station sur chaque ligne**, politique RLS sur `site`, avec les assistants existants `current_employee_site_id()` et `current_employee_role()`.

### Tables

```sql
-- Catalogue : commun à toutes les stations, écrit par migration seulement.
create table objectif_catalogue (
  indicateur_id   text primary key,              -- CARB-VOL-TOT, COM-CA, ...
  libelle         text not null,
  nature          text not null check (nature in ('performance','maitrise','potentiel')),
  classe          text not null check (classe in ('disponible','a_fiabiliser','non_disponible')),
  unite           text not null,
  agregation      text not null check (agregation in ('somme','moyenne_jour_complet','ratio','moyenne_par_quart')),
  sens            text not null check (sens in ('hausse','baisse')),   -- baisse = objectif de réduction
  cible_zero_ok   boolean not null default false,                      -- une cible 0 a un sens (écarts)
  autorite        text not null,                                        -- moteur ou fichier qui fait foi
  premier_mois    date,                                                 -- premier mois d'historique stocké (A4)
  cible_externe   text check (cible_externe in ('tarif_seuils')),       -- la cible vient d'ailleurs : refus de toute cible ici
  objectivable    boolean not null                                      -- voir « Qui peut porter une cible »
);

-- Cibles : une ligne par version.
create table station_objectifs (
  id              uuid primary key default gen_random_uuid(),
  site            text not null references sites(site_id),
  indicateur_id   text not null references objectif_catalogue,
  horizon         text not null check (horizon in ('mois','trimestre','annee')),
  periode_debut   date not null,                 -- date de service locale, début inclus
  periode_fin     date not null,                 -- fin exclue
  version         int  not null,
  cible           numeric not null,
  statut          text not null check (statut in ('brouillon','propose','officiel','remplace','retire')),
  origine         text not null check (origine in ('gerant','proposition_nexus','reprise_historique')),
  propose_par     uuid references employees(id),
  propose_le      timestamptz,
  valide_par      uuid references employees(id),
  valide_le       timestamptz,
  motif           text,                          -- obligatoire dès la version 2
  remplace_id     uuid references station_objectifs(id),   -- versions seulement
  parent_id       uuid references station_objectifs(id),   -- lien mois -> année (hiérarchie, pas version)
  created_at      timestamptz not null default now(),
  unique (site, indicateur_id, horizon, periode_debut, version),
  check (periode_fin > periode_debut),
  -- alignement calendaire par horizon (heure locale : ce sont des dates de service)
  check (horizon <> 'mois' or (
           periode_debut = date_trunc('month', periode_debut)::date
           and periode_fin = (periode_debut + interval '1 month')::date)),
  check (horizon <> 'trimestre' or (
           extract(month from periode_debut) in (1,4,7,10)
           and periode_debut = date_trunc('month', periode_debut)::date
           and periode_fin = (periode_debut + interval '3 months')::date)),
  check (horizon <> 'annee' or (
           extract(month from periode_debut) = 1 and extract(day from periode_debut) = 1
           and periode_fin = (periode_debut + interval '1 year')::date)),
  check (statut <> 'officiel' or (valide_par is not null and valide_le is not null)),
  check (version = 1 or motif is not null)
);

-- Un seul officiel par indicateur, station, horizon et période.
create unique index station_objectifs_un_officiel
  on station_objectifs (site, indicateur_id, horizon, periode_debut)
  where statut = 'officiel';
```

`propose_par` et `valide_par` pointent `employees(id)` : un texte libre ne prouve pas qui a posé la cible. `origine` dit d'où vient la ligne (saisie du gérant, proposition de NEXUS acceptée, reprise d'un historique) ; une proposition de NEXUS n'est jamais officielle sans validation du gérant. `remplace_id` ne sert qu'aux versions d'une même cible ; le lien d'un mois vers son année passe par `parent_id`.

### Qui peut porter une cible

Le catalogue dit `objectivable`. Sont acceptés :

- les **cibles de performance** (litres, CA, volume FDJ, panier, tickets) ;
- les **objectifs de réduction de maîtrise** : écarts de caisse −30 %, démarque −15 %. Ils vivent dans `station_objectifs`, la `nature = 'maitrise'` les sépare dans le Brief ; leur `sens` est `baisse` ;
- jamais les **potentiels détectés** (`nature = 'potentiel'`) ;
- jamais les **exigences permanentes** (100 % des contrôles, 0 rupture) : ce sont des règles, pas des objectifs ; elles restent des seuils de moteur.

Un indicateur dont la cible vit ailleurs (`cible_externe`) est refusé : MAR-TAUX renvoie à `tarif_seuils`, qui reste la seule source de cible de taux de marge. La RPC de proposition refuse toute cible sur lui (R8).

### Règles portées par la base

- **Immuabilité** : un déclencheur refuse toute modification de `cible`, `periode_*` et `version` sur une ligne `officiel` ou `remplace` ; seul `statut` peut passer de `officiel` à `remplace` (et uniquement à la création de la version suivante).
- **Période alignée** : les trois `check` ci-dessus refusent une période qui ne commence pas au 1er (mois), à janvier, avril, juillet ou octobre (trimestre), ou au 1er janvier (année) (R9).
- **Cohérence entre horizons** : pour un indicateur additif, la cible annuelle est la somme des cibles mensuelles à l'arrondi près ; le trimestre est la somme de ses trois mois. Un déclencheur de validation vérifie l'égalité à l'arrondi près entre la somme des mois et l'année, et signale l'écart sans bloquer si les mois ne sont pas tous posés. Pour une moyenne ou un ratio, aucune somme : la cible de chaque horizon est indépendante et se compare à la valeur agrégée de cet horizon.
- **Classe** : on ne peut pas proposer de cible sur un indicateur `non_disponible`, ni passer `officiel` sur un indicateur `a_fiabiliser` sans arbitrage consigné.
- **Cible zéro** : acceptée seulement si `cible_zero_ok`. Le Brief affiche alors « 0 attendu » et un niveau atteint ou non, jamais un pourcentage de progression (division par zéro interdite).
- **Réduction** : `sens = 'baisse'` inverse l'écart et la lecture de la tendance ; la progression se calcule en part de la réduction visée.

### RLS par station

```sql
alter table station_objectifs enable row level security;

-- Lecture : habilitée seulement (compte nommément habilité, voir ci-dessous).
-- Un employé de la station, même de la bonne station, ne lit rien.
create policy so_lecture on station_objectifs for select to authenticated
  using (site = current_employee_site_id()
         and objectif_habilite(site, 'lire'));

-- Aucune politique insert, update ni delete pour authenticated : tout passe par les fonctions ci-dessous.
```

Le Brief et la vue d'A4 lisent la même table (ou la vue §ci-dessous) : la restriction de rôle s'applique à eux aussi. La lecture de `objectif_catalogue` reste ouverte aux `authenticated` (aucune donnée de station).

### Habilitation explicite (G-4)

Le droit de proposer et de valider n'est **pas un rôle**. Les comptes actifs de la station montrent que le pilote du projet, qui valide les objectifs, a le rôle `manager`, et que le seul compte `gerant` appartient à une autre personne : `current_employee_role() = 'gerant'` ferait valider la mauvaise personne et exclurait le pilote.

Le droit est donc une habilitation nominative, par compte et par station, sur le modèle de `acces_createur_autorise` :

```sql
create table objectif_habilitation (
  site        text not null,
  employe_id  uuid not null,          -- le compte nommé
  droit       text not null check (droit in ('lire','proposer','valider')),
  accorde_par uuid not null,
  accorde_le  timestamptz not null default now(),
  revoque_le  timestamptz,
  primary key (site, employe_id, droit)
);
-- RLS : lecture par le titulaire et par les comptes habilités à valider ; aucune écriture directe.
-- objectif_habilite(p_site, p_droit) : security definer, search_path vide, vrai si le compte courant
-- a ce droit non révoqué sur cette station. Le rôle ne compte pas.
```

L'octroi et la révocation passent par une fonction `security definer` de même nature que les trois autres, réservée à un compte déjà habilité à valider ; la première habilitation est posée par une migration explicite, avec GO. `valider` suppose `proposer` et `lire` ; `proposer` suppose `lire`.

### Écriture : fonctions `security definer`, une par opération

Aucune politique d'insertion directe : une politique `insert` laisserait un `manager` écrire n'importe quel statut en contournant les règles. Sur le modèle de `_ecarts_regul_manager` (migration 20261008130000), chaque opération est une fonction `security definer`, `set search_path = ''`, qui porte ses propres gardes (session, rôle, station, unicité, période alignée) et refuse la mauvaise station :

| Fonction | Rôle autorisé | Gardes |
|---|---|---|
| `proposer_objectif(p_site, p_indicateur, p_horizon, p_debut, p_cible, p_origine)` | compte habilité `proposer` sur la station (G-4) | station = celle de l'appelant ; indicateur `objectivable`, classe ≠ `non_disponible`, `cible_externe` nul ; période alignée sur l'horizon ; cible zéro seulement si `cible_zero_ok` ; une seule proposition ouverte par clé |
| `valider_objectif(p_id)` | compte habilité `valider` sur la station (G-4) | station de la ligne = celle de l'appelant ; statut `propose` ; unicité de l'officiel ; arbitrage consigné si classe `a_fiabiliser` ; pose `valide_par`, `valide_le`, remplace la version précédente dans la même transaction |
| `retirer_objectif(p_id, p_motif)` | compte habilité `valider` | station de la ligne = celle de l'appelant ; motif obligatoire ; statut `retire`, jamais un `delete` |

`anon` n'a aucun droit. Les `revoke` sont posés explicitement sur `anon` et sur `public` pour chaque fonction (un `revoke from public` seul ne ferme pas `anon`), `grant execute` à `authenticated` seulement, et `TRUNCATE` est retiré à `authenticated` sur les tables.

### Lecture par le Brief et par A4

Le Brief et A4 lisent la même vue en lecture seule, créée avec `security_invoker = true` (`create view ... with (security_invoker = true)`) : sans cela elle s'exécuterait avec les droits de son propriétaire et contournerait la RLS de lecture ci-dessus. Elle qui expose pour la période demandée l'objectif **officiel** de la station (jamais un brouillon), sa `version` et `valide_le`. A4 conserve cet identifiant de version à côté des chiffres, pour qu'un relevé reste interprétable après un changement de cible.

### Liens avec le Conseiller

Une table `objectif_recommandation(site, objectif_id, recommandation_id, ecart, cause_nature, action, potentiel_estime, resultat_obtenu)` relie une recommandation à une cible. `cause_nature` vaut `demontree` ou `supposee`. Les potentiels sont dédoublonnés par clé (`site`, `indicateur_id`, `periode_debut`, `cause`) pour qu'un même gain ne soit pas compté sous deux objectifs. Les moteurs ne sont pas modifiés par cette étape : le lien est une table de rapprochement alimentée plus tard.

### Arbitrages ouverts pour le gérant (étape 3)

- **G-4** : quels comptes, nommément, peuvent proposer et lesquels peuvent valider ? (Le droit est une habilitation par compte et par station, pas un rôle : le pilote est `manager`, l'unique `gerant` est une autre personne.)
- **G-5** : une cible officielle de période en cours peut-elle être révisée, avec motif, ou seulement à la période suivante ?
- **G-6** (reformulé) : l'année est saisie, les mois sont proposés par NEXUS, le trimestre est la somme de ses mois pour un indicateur additif, et le contrôle est l'égalité à l'arrondi près entre la somme des mois et l'année. Reste ouverte seulement la cible propre du trimestre pour les moyennes et les ratios.

## 6. Suite

Étape 4 : maquettes (données fictives, charte Brief v4). Étape 5 : recette, tests de sécurité, arbitrages consolidés (§8 et §9). Les lignes « à instruire » sont reclassées (§3).

## 7. Maquettes (étape 4)

### Fiche de conception

- **Qui, quand, pourquoi** : le gérant, une fois par an (puis pour un ajustement). Il veut fixer ce qu'il attend de sa station et vérifier d'un coup d'œil où il en est.
- **Première question à l'écran** : « Quel objectif pour l'année ? » Le gérant donne un chiffre ou une hypothèse (par exemple +3 %). NEXUS montre sa base d'historique et sa limite (« 4 mois d'historique »), propose la répartition sur 12 mois et 4 trimestres, une barre par mois. Le gérant ajuste un mois, puis valide l'ensemble. Le tableau mois par mois est au second niveau.
- **Pas de cartes pédagogiques** : les trois natures et le parcours de validation sont retirés du premier niveau, ils restent au §0 et au §5. Une seule ligne d'aide repliée.
- **Groupement** : les cinq secteurs (Carburant, Commerce, FDJ, Opérations, Marge), avec les icônes NEXUS (`assets/icones`, `nexus-icones.js`).
- **Chaque objectif** : valeur, objectif, avancement, attendu à la date, écart, tendance. La méthode est dans le détail.
- **Écart de caisse** : en euros, moyenne en valeur absolue par quart, jamais « ≤ 40 € » par mois. Le signe est sans ambiguïté : « 7 € au-dessus de l'objectif », jamais « +22 € » sur un écart à réduire.
- **Retiré** : « Écarts non justifiés » (pas un indicateur de ce lot), le jargon, « Parité avec l'A4 » (voir D1, §8). Le Brief ne garde qu'une mention discrète de la version des objectifs.
- **Conseiller** : avatar officiel (`assets/avatar`). Il n'énonce que des faits mesurés et une cause que NEXUS peut établir, sinon il l'écrit (« aucune cause établie »). Jamais de météo ni de cause inventée.
- **Vocabulaire** : « repère linéaire » est écrit en toutes lettres : progression en ligne droite entre le début de la période et l'objectif.
- **Données** : toutes fictives. Valeurs de la maquette : Station Exemple.

### Livrables

- `maquettes/objectifs-bureau.html` : première vue « l'année d'abord » (hypothèse, base et limite, 12 barres, 4 trimestres, ajustement, validation d'ensemble), puis lecture par secteur, puis tableau mensuel au second niveau.
- `maquettes/objectifs-brief.html` : variante intégrée de `brief-v4.html` (draft #392) : le bloc « Objectifs » remplace l'ancien, une fiche par secteur, Conseiller avec avatar officiel, version des objectifs citée en titre. L'en-tête image du Brief n'est pas reprise (actif absent de cette branche).

Version mobile : non commencée, comme demandé.

## 8. Recette et tests de sécurité (livrable 8, étape 5)

Rien de ce qui suit n'est exécuté : aucune migration, aucun code, aucun accès Production. Ce sont les critères que le lot devra satisfaire, à rejouer sur Test avec des stations de recette. Chaque critère nomme la preuve attendue.

### 8.1 Sécurité (base)

| Id | Critère | Preuve attendue |
|---|---|---|
| S1 | `anon` n'a aucun privilège (select, insert, update, delete, truncate) sur `objectif_catalogue`, `station_objectifs`, `objectif_recommandation` | lecture de `has_table_privilege` sur chaque couple rôle/privilège ; un appel REST anonyme est refusé |
| S2 | `TRUNCATE` est révoqué de `authenticated` et `anon` sur les trois tables | `has_table_privilege(..., 'TRUNCATE')` faux ; `revoke from public` seul ne suffit pas |
| S3 | Un employé de la station A ne lit aucune ligne de la station B | requête avec le jeton d'un employé de A filtrée sur B : zéro ligne |
| S4 | Un employé de A ne peut pas insérer pour B, ni déplacer une ligne vers B | insertion refusée par la politique ; test sur `with check` |
| S5 | Aucune écriture directe : un `insert`, `update` ou `delete` de `authenticated` sur `station_objectifs` est refusé ; seules les RPC écrivent, et seuls les comptes habilités `proposer` appellent `proposer_objectif` | essai direct avec chaque rôle : refus ; appel de la RPC par un employé : refus |
| S6 | `valider_objectif` et `retirer_objectif` sont `security definer`, réservés aux comptes habilités `valider` de la station, et refusent tout autre compte, quel que soit son rôle, et l'habilité d'une autre station | appel par chaque compte : erreur `insufficient_privilege` sauf habilité de la station |
| S13 | Un employé de la station elle-même ne lit aucune ligne (lecture limitée aux comptes habilités, Brief et vue A4 compris) ; la vue de lecture est `security_invoker = true` | jeton d'employé de la bonne station : zéro ligne, y compris par la vue ; jeton habilité : lignes visibles ; `pg_class.reloptions` de la vue contient `security_invoker=true` |
| S15 | L'habilitation prime sur le rôle : un compte de rôle `gerant` sans habilitation est refusé, un compte `manager` habilité est accepté | `valider_objectif` appelé par un `gerant` non habilité : refus ; par un `manager` habilité `valider` : accepté ; après révocation : refus |
| S14 | Chaque RPC `security definer` a un `search_path` vide et refuse la mauvaise station | lecture de `pg_proc.proconfig` ; appel avec un `p_site` d'une autre station : refus |
| S7 | Aucune politique UPDATE ni DELETE n'existe | liste de `pg_policies` : aucune commande UPDATE/DELETE |
| S8 | Une ligne `officiel` ou `remplace` est immuable (trigger) | tentative d'UPDATE par le propriétaire de la table : refus du trigger |
| S9 | Un seul objectif officiel par (station, indicateur, horizon, début de période) | seconde insertion `officiel` : violation de l'index unique partiel |
| S10 | Aucune colonne sensible n'est exposée par la RLS : la RLS ne masque pas les colonnes | revue des colonnes ; aucun secret ni donnée personnelle dans les trois tables |
| S11 | Les vues et fonctions ajoutées n'héritent pas de privilèges par défaut vers `anon` | contrôle des default privileges après création |
| S12 | La station figure dans le `where` de chaque requête de lecture, sans s'appuyer sur la RLS | revue des requêtes Q-CARB, Q-COM, Q-PANIER, Q-FDJ, Q-ECART |

### 8.2 Règles métier portées par la base

| Id | Critère | Preuve attendue |
|---|---|---|
| R1 | Aucune cible sur un indicateur « non disponible » | insertion refusée |
| R2 | Aucun objectif officiel sur un indicateur « à fiabiliser » sans arbitrage consigné | insertion `officiel` refusée ; avec arbitrage référencé : acceptée |
| R3 | Cible zéro acceptée seulement si `cible_zero_ok` ; aucun pourcentage d'atteinte n'est calculé sur une cible nulle | affichage « 0 attendu », pas de division |
| R4 | `sens = 'baisse'` : un recul est un progrès ; l'atteinte est plafonnée à 100 % sans dépasser | série fictive décroissante |
| R5 | Cohérence entre horizons d'un indicateur additif : la somme des cibles mensuelles égale la cible annuelle à l'arrondi près, le trimestre est la somme de ses trois mois ; un écart est signalé sans bloquer tant que les mois ne sont pas tous posés. Aucune somme pour une moyenne ou un ratio | année posée, mois incohérents : avertissement visible ; ratio : aucun contrôle de somme |
| R8 | Une cible sur un indicateur `cible_externe` (MAR-TAUX) est refusée par `proposer_objectif` | appel sur MAR-TAUX : erreur |
| R9 | Une période non alignée est refusée (mois ne commençant pas au 1er, trimestre hors janvier/avril/juillet/octobre, année ne commençant pas au 1er janvier) | trois essais non alignés : `check` violé |
| R6 | Taux, moyennes et ratios portent leur propre cible par horizon, sans somme ni moyenne des mois | cible annuelle d'un ratio indépendante des cibles mensuelles |
| R7 | Un objectif remplacé garde sa version ; la nouvelle version référence l'ancienne | historique complet lisible |

### 8.3 Données et lecture

| Id | Critère | Preuve attendue |
|---|---|---|
| D1 | Parité A4 : valeur Brief = valeur du rapport A4 = valeur Tempo pour litres, CA boutique, FDJ, sur au moins trois mois de la station de recette | tableau de comparaison, écart nul |
| D2 | Mois civils en heure de Martinique (`at time zone 'America/Martinique'`) ; les colonnes `date` sont déjà locales | jeu avec des saisies proches de minuit : rattachement au bon mois |
| D3 | Seuls les jours complets Tempo comptent ; la colonne de jours couverts accompagne chaque valeur mensuelle | mois partiel : valeur et couverture affichées ensemble |
| D4 | Écarts de caisse en valeur absolue par quart, sans compensation | quart +10 et quart −10 : 20, pas 0 ; un quart à +20 en piste et −20 en boutique vaut 40 en colonne principale, 0 en colonne secondaire (différence écrite en Q-ECART) |
| D9 | **Chaque requête du document s'exécute sans erreur sur Test** (Q-CARB, Q-COM, Q-PANIER, Q-FDJ, Q-ECART) | exécution sur la base Test avec une station de recette, un mois et un mois vide : aucune erreur (notamment 42803), `jours_du_mois` présent partout, résultats consignés dans le compte rendu |
| D5 | Pas de projection quand les données sont insuffisantes ; le Brief l'écrit au lieu de calculer | panier moyen avec peu de jours : mention « données insuffisantes » |
| D6 | Chaque objectif affiche courant, cible, avancement, niveau attendu à date, écart, tendance, période, fraîcheur | contrôle champ par champ |
| D7 | Fraîcheur : un indicateur dont la dernière donnée est ancienne est signalé comme périmé | jeu sans saisie récente |
| D8 | A4 conserve la version des objectifs utilisée : un rapport ancien se relit avec ses cibles d'alors | changement de cible après édition d'un A4 : l'ancien A4 inchangé |

### 8.4 Conseiller

| Id | Critère | Preuve attendue |
|---|---|---|
| C1 | Une recommandation porte l'écart, la cause (démontrée ou supposée, distinguée), l'action, le potentiel estimé, le résultat obtenu | contrôle des champs |
| C2 | Un même potentiel n'est jamais compté deux fois quand deux recommandations touchent le même objectif | deux recommandations, un seul potentiel retenu |
| C3 | Le potentiel détecté par un moteur n'est jamais présenté comme objectif validé | libellés distincts ; trois natures jamais mélangées |

### 8.5 Mise en œuvre de la recette

Ordre : sécurité (8.1) avant tout jeu de données ; règles de base (8.2) ; lecture (8.3) ; Conseiller (8.4). La recette navigateur sur Test se fait sur un artefact déployé, pas sur le local. Un résultat sans code d'échec nommé n'est pas arbitrable : chaque échec porte l'identifiant du critère. Les mesures de recette sur l'historique réel de Sainte-Marie restent hors canal : Guardian les mène.

## 9. Arbitrages consolidés pour le gérant (livrable 9)

Rien n'est tranché ici. Chaque ligne dit ce qui change selon la réponse et ce que je recommande.

| Id | Question | Recommandation | Ce qui dépend de la réponse |
|---|---|---|---|
| G-1 | La progression se mesure-t-elle en périodes calendaires (mois contre mois précédent, en moyenne par jour complet) ou en fenêtres glissantes de 7 jours comme aujourd'hui dans le Brief ? | périodes calendaires, seules cohérentes avec des objectifs mensuels | CARB-PROGRES, COM-PROGRES, FDJ-EVOL |
| G-3 | Les horaires de `station_config.horaires` valent-ils horaires d'ouverture ? Sinon : les saisir une fois, ou renoncer aux quatre indicateurs « par heure » | les confirmer si le gérant les reconnaît ; sinon renoncer | CARB-PROD-H, COM-CA-H, MAR-H (et leur voisin par heure) passent de « à fiabiliser » à « disponible » |
| G-4 | Quels comptes, nommément, peuvent proposer, et lesquels valider ? (droit par compte et par station, pas par rôle : le pilote est `manager`) | proposer : les comptes de direction de la station ; valider : le pilote nommé, plus tout autre compte que le gérant désigne | S5, S6, S15, flux de validation de la maquette |
| G-5 | Une cible officielle de période en cours peut-elle être révisée, avec motif, ou seulement à la période suivante ? | révisable avec motif, par une nouvelle version qui remplace l'ancienne, jamais par modification | R7, D8 |
| G-6 | Pour un additif, l'année est saisie, les mois proposés, le trimestre est la somme de ses mois (contrôle : somme des mois = année à l'arrondi). Pour une moyenne ou un ratio, le trimestre porte-t-il sa propre cible ? | année saisie et mois proposés pour les additifs ; cible propre du trimestre pour les ratios | R5, R6 |
| G-7 | « Écart de caisse » : `ecart_total` tel que stocké, ou somme des valeurs absolues piste + boutique par quart ? | somme des valeurs absolues par quart, sans compensation | OPS-ECART-CAISSE, D4 |
| G-8 | Pour les indicateurs de maîtrise reclassés « à fiabiliser » (contrôles, clôtures, inventaires, délais, anomalies, référence prioritaire), quelle définition de « conforme » et quel délai de référence ? | une définition écrite par indicateur avant toute cible | OPS-CTRL, OPS-CLOT, OPS-INV, OPS-ANO-DELAI, OPS-DELAI-RES, MAR-ANO-TARIF, MAR-DEMARQUE, FDJ-ANO-NR, COM-DISPO-REF |

Ordre conseillé des réponses : G-4 et G-5 (ils fixent le flux), puis G-7 et G-1 (ils fixent les mesures déjà disponibles), puis G-3 et G-8 (ils ouvrent de nouveaux indicateurs).
