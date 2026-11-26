# Référentiel des objectifs de station : étape 1 (inventaire et matrice d'autorité)

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
| CARB-MARGE | Marge brute carburant | P | € ↑ | additif | HT |
| CARB-PROGRES | Progression des volumes | P | % ↑ | ratio, recalculé sur la période (pas sommé) | sans objet |
| CARB-RUPTURE | Jours de rupture | M | j ↓ (cible 0) | additif | sans objet |
| CARB-ECART-NE | Écarts non expliqués | M | L ou nb ↓ | additif | sans objet |
| CARB-PROD-H | volumes ci-dessus ÷ heures d'ouverture | Tempo pour les volumes ; heures : voir ci-dessous | Heures : `station_config.horaires` existe (Paramètres Station, source canonique, migration 20260919160000, lue aussi par `calculer_horaires_quart`). Elle déclare les régimes `normal` et `etendu` par quart, pas forcément l'ouverture réelle de la station ni les fermetures exceptionnelles. Indicateur **à fiabiliser** : arbitrage G-3 pour le gérant. |

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
| MAR-BRUTE | Marge brute commerciale | P | € ↑ | additif | HT |
| MAR-TAUX | Taux de marge | P | % ↑ | Σ marge ÷ Σ CA HT, sur la période (jamais annuel ÷ 12, jamais moyenne de taux) | HT |
| MAR-PROGRES | Progression de la marge brute | P | % ↑ | ratio recalculé | HT |
| MAR-H | Marge par heure d'ouverture | P | €/h ↑ | Σ marge ÷ Σ heures | HT |
| MAR-ANO-TARIF | Anomalies tarifaires confirmées | M | nb ↓ (cible 0) | additif | sans objet |
| MAR-DEMARQUE | Démarque connue | P | € ou % du CA ↓ | additif (€) ; ratio (%) | HT |
| MAR-PERTE-DC | Pertes dates courtes | P | € ↓ | additif | HT, au coût d'achat |
| MAR-EVITE | Pertes effectivement évitées | P | € ↑ | additif, uniquement résultat constaté | HT, au coût d'achat |

Définition du taux de marge retenue : **(CA HT − coût d'achat HT) ÷ CA HT**, la cible venant de `tarif_seuils` ; la référence 25 % codée en dur à trois endroits (audit §13) n'est pas une cible d'objectif.

### FDJ
| Id | Indicateur | Nat. | Unité / sens | Agrégation | HT/TTC |
|---|---|---|---|---|---|
| FDJ-COMMISSION | Commissions perçues | P | € ↑ | additif | commission FDJ (non soumise au HT/TTC boutique : à confirmer avec la comptabilité) |
| FDJ-VOLUME | Volume d'activité (ventes de jeux) | P | € ↑ | additif | TTC joueur |
| FDJ-EVOL | Évolution | P | % ↑ | ratio recalculé | sans objet |
| FDJ-ECART-COMP | Écarts après compensation autorisée | M | € ↓ | additif en absolu | sans objet |
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
| OPS-EQUIP | Disponibilité des équipements critiques | M | % ↑ | ratio temps disponible | sans objet |

`OPS-ECART-CAISSE` (maîtrise, absolu par quart) n'a rien à voir avec les écarts individuels consolidés du dossier comptable Paye : deux indicateurs, deux libellés, jamais fusionnés.

## 2. Matrice d'autorité (livrable 2)

Une ligne = un indicateur = **un seul calcul**. « Autorité » est le moteur qui calcule ; le Brief, le Conseiller et le rapport A4 lisent ce moteur et n'ont aucun calcul concurrent. Les points « à trancher » renvoient à l'audit #393.

| Id | Source de données (lecture) | Moteur autorité | Doublon / risque (audit) |
|---|---|---|---|
| CARB-VOL-*, CARB-LIT-JOUR, CARB-PROGRES | `audits_caisse.litrage_gazole / litrage_sp95 / litrage_gnr` par quart (saisie caissier) via `chargerVentesPeriode` | **Tempo** (`nexus-tempo.js` : `joursLitresCompletsPiste`, `resumerParJour`), seule autorité sur les litres par jour complet (Brief v4 §21.bis, audit §13.5). Les fonctions de `nexus-carburant-moteur.js` (`sommerVentesPeriode`, `calculerMixCarburant`, `calculerEvolutionVolume`) ne font pas foi pour ces indicateurs. | Pas de troisième propriétaire : Tempo et le Brief v4 sont alignés. Écart à trancher (arbitrage G-1) : la progression du Brief est en fenêtres glissantes de 7 jours, le référentiel exige des périodes calendaires. Ancre « aujourd'hui » en UTC (audit §13.3). |
| CARB-MARGE | `carburant_commandes`, `carburant_tarifs_achat`, prix de vente courant (CMP progressif) | `nexus-carburant-moteur.js` (CMP, effet prix) | Aucun historique de marge carburant mensuel stocké : à construire ou à écarter (étape 2). |
| CARB-RUPTURE | `carburant_releves` (stock réel par jour) + seuils cuve | `nexus-carburant-moteur.js` (contrôle du jour) | Définition de « rupture » à fixer (seuil de cuve). |
| CARB-ECART-NE | `carburant_controles`, `nexus_ecarts_qualifications` | `nexus-carburant-moteur.js` + `nexus-ecarts-moteur.js` | Qualification d'écart : autorité = gravité dans `nexus-ecarts-moteur.js` (audit §13.5). |
| CARB-PROD-H | volumes ci-dessus ÷ heures d'ouverture | aucun | **Aucune table d'heures d'ouverture** : indicateur non disponible tant que la source n'existe pas. |
| COM-CA, COM-CA-JOUR, COM-PROGRES | `audits_caisse.vente_boutique` (par quart) | **Saisie de caisse** (`audits_caisse.vente_boutique`), via Tempo (`joursCaBoutique`) | Décidé par le gérant (second contre-audit §3) : le suivi d'activité au jour le jour est la saisie de caisse ; les périodes importées servent à l'analyse produit et à la rentabilité. Deux périmètres coexistent (caisse et import Decenium) : la différence de périmètre est écrite ici et dans la maquette, jamais effacée. |
| COM-PANIER, COM-TICKETS | `panier_moyen_quotidien` (`nb_tickets`, `panier_moyen_ht/ttc`, hors carburant, import Decenium) | à désigner (aucun moteur dédié trouvé) | Ces deux indicateurs restent **sur l'import**, car la saisie de caisse ne porte pas les tickets. Périmètre différent de COM-CA (import, hors carburant) : afficher le périmètre sous la valeur. Panier = Σ CA ÷ Σ tickets, recomposé par `panier_moyen × nb_tickets`. |
| COM-CA-H, MAR-H | CA ou marge ÷ heures d'ouverture | Tempo (CA), R5 (marge) ; heures : G-3 | Mêmes réserves que CARB-PROD-H : **à fiabiliser** tant que le gérant n'a pas confirmé la source des heures. |
| COM-DISPO-REF | `mission_completions`, références prioritaires | aucun | « Référence prioritaire » non défini. |
| MAR-BRUTE, MAR-TAUX, MAR-PROGRES | `normalized_sales` (ventes importées) + coûts d'achat | `nexus-rayon-moteur.js` / règle R5 (écart de marge) | La marge n'existe que par période d'import, et une période peut chevaucher deux mois. **Règle de passage au mois civil : au prorata des jours**, comme l'histogramme base 100 par jour (`resumerMargeParPeriode`). Si une période n'est pas couverte, le mois est **à fiabiliser** et affiché ainsi. Cible de taux : `tarif_seuils` (vide en Production), la référence 25 % codée en dur à trois endroits n'est pas une cible. |
| MAR-ANO-TARIF | `journal_decisions` (R5-MARGE-ECART), `marge_exceptions` | moteur R5 | « Confirmée » = décision au journal. |
| MAR-DEMARQUE | `inventaire_*`, `inventaire_alertes` | `nexus-inventaire-moteur.js` | Définition de « démarque connue » à valider avec le gérant. |
| MAR-PERTE-DC, MAR-EVITE | lot Dates courtes (PR #352 / #354, non en Production) | à venir | Source absente en Production tant que le lot n'est pas déployé. |
| FDJ-COMMISSION | `fdj_reports` | `nexus-fdj-moteur.js` | À confirmer : la table porte-t-elle la commission ? Sinon indicateur « à fiabiliser ». |
| FDJ-VOLUME, FDJ-EVOL | `view_fdj_daily_summary`, `view_fdj_game_daily` (CA par jeu) | **Tempo** (`joursCaFdjComplets`), seule autorité sur le CA FDJ par jour complet (Brief v4 §21.bis, audit §13.5). `nexus-fdj-moteur.js` garde les contrôles et la compensation. | Pas de troisième propriétaire. Évolution FDJ du Brief : fenêtre 7 jours ×250 plafonnée ±25 (audit §3), à aligner sur des périodes calendaires (G-1). |
| FDJ-ECART-COMP, FDJ-ANO-NR, FDJ-CONTROLES | `fdj_cash_controls`, `fdj_discrepancies`, `fdj_shifts` | `nexus-fdj-moteur.js` | Compensation autorisée : lire telle quelle, sans la réécrire. |
| OPS-CTRL | `carburant_controles`, `mission_completions`, `fdj_cash_controls` | à désigner | Plusieurs moteurs comptent « contrôle » ; définir la liste des contrôles obligatoires. |
| OPS-CLOT | `audits_caisse` (clôture), `fdj_shifts` | `nexus-verify-moteur.js` (`agregerAudits`) | « Conforme » à définir ; V4 et V11 non conformes. |
| OPS-ECART-CAISSE | `audits_caisse` (écart par quart) | **`nexus-ecarts-moteur.js` (autorité proposée, audit §13.5)** | Lu de quatre façons (Verify max absolu, Tempo somme nette, Écarts seuils, A4 via agregerAudits) : tant que l'autorité n'est pas fixée, l'objectif ne peut pas citer de chiffre. |
| OPS-INV | `inventaire_missions`, `inventaire_quarts` | `nexus-inventaire-moteur.js` | Délai de référence à fixer. |
| OPS-ANO-DELAI, OPS-DELAI-RES | `inventaire_alertes`, journaux d'anomalies | `nexus-risques-moteur.js` (niveau/urgence, autorité proposée) | Notion de « délai » non partagée entre moteurs. |
| OPS-TOURNEES | lot Dates courtes | à venir | Idem MAR-PERTE-DC. |
| OPS-EQUIP | aucune | aucun | Aucune table d'équipements critiques. |

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

## 3. Suite

Étape 2 (catalogue + classement disponible / à fiabiliser / non disponible, avec requête de lecture mensuelle filtrée par station pour chaque « disponible ») : prochaine livraison. Les points ci-dessus marqués « à confirmer » y seront tranchés par lecture du code et des migrations, sans accès aux données.
