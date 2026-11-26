# Référentiel des objectifs de station : étapes 1 à 3 (inventaire, autorité, catalogue, requêtes, modèle)

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

## 3. Catalogue et classement (livrable 3)

Trois classes, appliquées sans exception (article 5 : pas de valeur fabriquée).

- **Disponible** : une requête de lecture donne l'historique mensuel de la station avec la couverture de chaque mois.
- **À fiabiliser** : la source existe mais sa lecture mensuelle exige un arbitrage ou une règle de passage ; aucune requête n'est livrée tant qu'elle n'est pas tranchée.
- **Non disponible** : aucune source stockée à ce jour ; l'indicateur ne peut être ni suivi ni projeté.

| Id | Classe | Source ou raison | Agrégation sur le mois |
|---|---|---|---|
| CARB-VOL-TOT | Disponible | `audits_caisse` (litrages), jours complets Tempo | somme (additif) |
| CARB-VOL-PROD | Disponible | idem, par produit (gazole, SP95, GNR) | somme (additif) |
| CARB-LIT-JOUR | Disponible | idem, litres ÷ jours complets | moyenne par jour complet |
| CARB-PROGRES | Dérivé | série mensuelle de CARB-VOL-TOT (règle G-1) | sans requête propre |
| COM-CA | Disponible | `audits_caisse.vente_boutique`, mêmes jours complets | somme (additif) |
| COM-CA-JOUR | Disponible | idem, CA ÷ jours complets | moyenne par jour complet |
| COM-PANIER | Disponible, périmètre écrit | `panier_moyen_quotidien` (boutique hors carburant) | ratio Σ CA ÷ Σ tickets |
| COM-TICKETS | Disponible, périmètre écrit | idem | somme (additif) |
| COM-PROGRES | Dérivé | série mensuelle de COM-CA | sans requête propre |
| FDJ-VOLUME | Disponible | `view_fdj_daily_summary`, jours à deux quarts contrôlés | somme (additif) |
| FDJ-EVOL | Dérivé | série mensuelle de FDJ-VOLUME | sans requête propre |
| OPS-ECART-CAISSE | Disponible | `audits_caisse.ecart_total`, valeur absolue par quart | moyenne par quart, sans compensation |
| CARB-PROD-H, COM-CA-H, MAR-H | À fiabiliser | dépend des horaires réels (G-3) | ratio |
| MAR-BRUTE, MAR-TAUX, MAR-PROGRES | À fiabiliser | marge connue par période d'import ; passage au mois civil au prorata des jours | ratio |
| CARB-ECART-NE | À fiabiliser | qualification manuelle, pas de champ dédié lu | à définir |
| FDJ-ECART-COMP, FDJ-CONTROLES | À fiabiliser | lecture à confirmer sur la vue FDJ, règle de comptage à écrire | à définir |
| CARB-RUPTURE | Non disponible | seule une rupture projetée existe dans le moteur de commande ; aucune rupture observée n'est stockée | sans objet |
| CARB-MARGE | Non disponible | aucun coût d'achat stocké | sans objet |
| FDJ-COMMISSION | Non disponible | aucune source de commission lue | sans objet |
| OPS-CTRL, OPS-CLOT, OPS-INV, OPS-ANO-DELAI, OPS-DELAI-RES, OPS-TOURNEES, OPS-EQUIP, MAR-ANO-TARIF, MAR-DEMARQUE, MAR-PERTE-DC, MAR-EVITE, FDJ-ANO-NR, COM-DISPO-REF | À instruire | source non relue à cette étape ; classés « non disponible » tant qu'une lecture du code et du schéma n'a pas établi le contraire | sans objet |

Cette dernière ligne est volontairement prudente : je ne range pas en « à fiabiliser » ce que je n'ai pas lu. L'étape suivante ou une relecture de Guardian les fera passer d'un côté ou de l'autre.

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
       extract(day from (date_trunc('month', date) + interval '1 month - 1 day'))::int as jours_du_mois,
       round(sum(gazole + sp95 + gnr) / count(*), 0)         as litres_par_jour_complet
from jours
group by 1
order by 1;
```

Le `having` reproduit `agregerParJour` : un seul quart sans détail fait tomber le jour (`litrageDisponible = false`). La date est déjà locale : `date_trunc` s'applique sans conversion.

### Requête Q-COM : CA boutique par mois (COM-CA, COM-CA-JOUR)

Même CTE `jours` que Q-CARB (mêmes jours complets, Tempo `joursCaBoutique`), en ajoutant `sum(a.vente_boutique) as ca_boutique` dans la CTE.

```sql
select date_trunc('month', date)::date as mois,
       sum(ca_boutique)                as ca_boutique,
       count(*)                        as jours_couverts,
       extract(day from (date_trunc('month', date) + interval '1 month - 1 day'))::int as jours_du_mois,
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
       count(*)                                              as jours_couverts
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
       extract(day from (date_trunc('month', v.date) + interval '1 month - 1 day'))::int as jours_du_mois
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
select date_trunc('month', a.date)::date              as mois,
       count(*)                                        as quarts_mesures,
       round(avg(abs(a.ecart_total)), 2)               as ecart_absolu_moyen_par_quart,
       round(sum(abs(a.ecart_total)), 2)               as ecart_absolu_cumule,
       count(*) filter (where a.statut in ('anomalie','critique')) as quarts_anomalie_critique
from audits_caisse a
where a.site = :station
  and a.date >= :debut and a.date < :fin_exclusive
  and a.ecart_total is not null
group by 1
order by 1;
```

Valeur absolue par quart, jamais de compensation entre quarts ni entre piste et boutique. La couverture est le nombre de quarts mesurés rapporté à deux par jour. Seuil de gravité : celui de `nexus-ecarts-moteur.js` (autorité), pas recalculé ici. À arbitrer : la définition OPS-ECART-CAISSE retient-elle `ecart_total` ou la somme des valeurs absolues de `ecart_piste` et `ecart_boutique` ? La requête prend `ecart_total`, conforme à `calculer_caisse_sante`.

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
  autorite        text not null                                         -- moteur ou fichier qui fait foi
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
  propose_par     text,
  propose_le      timestamptz,
  valide_par      text,
  valide_le       timestamptz,
  motif           text,                          -- obligatoire dès la version 2
  remplace_id     uuid references station_objectifs(id),
  created_at      timestamptz not null default now(),
  unique (site, indicateur_id, horizon, periode_debut, version),
  check (periode_fin > periode_debut),
  check (statut <> 'officiel' or (valide_par is not null and valide_le is not null)),
  check (version = 1 or motif is not null)
);

-- Un seul officiel par indicateur, station, horizon et période.
create unique index station_objectifs_un_officiel
  on station_objectifs (site, indicateur_id, horizon, periode_debut)
  where statut = 'officiel';
```

### Règles portées par la base

- **Immuabilité** : un déclencheur refuse toute modification de `cible`, `periode_*` et `version` sur une ligne `officiel` ou `remplace` ; seul `statut` peut passer de `officiel` à `remplace` (et uniquement à la création de la version suivante).
- **Cohérence entre horizons** : pour un indicateur additif, un déclencheur de validation vérifie que la somme des cibles mensuelles officielles d'un trimestre ne dépasse pas la cible trimestrielle, et signale l'écart sans bloquer si les mois ne sont pas tous posés. Pour une moyenne ou un ratio, aucune somme : la cible de chaque horizon est indépendante et se compare à la valeur agrégée de cet horizon.
- **Classe** : on ne peut pas proposer de cible sur un indicateur `non_disponible`, ni passer `officiel` sur un indicateur `a_fiabiliser` sans arbitrage consigné.
- **Cible zéro** : acceptée seulement si `cible_zero_ok`. Le Brief affiche alors « 0 attendu » et un niveau atteint ou non, jamais un pourcentage de progression (division par zéro interdite).
- **Réduction** : `sens = 'baisse'` inverse l'écart et la lecture de la tendance ; la progression se calcule en part de la réduction visée.

### RLS par station

```sql
alter table station_objectifs enable row level security;

-- Lecture : tout employé de la station.
create policy so_lecture on station_objectifs for select to authenticated
  using (site = current_employee_site_id());

-- Proposition : gérant ou responsable habilité, sa station, statut propose/brouillon seulement.
create policy so_proposer on station_objectifs for insert to authenticated
  with check (site = current_employee_site_id()
              and current_employee_role() in ('manager','gerant')
              and statut in ('brouillon','propose'));

-- Validation : gérant seul, et via une fonction, jamais par UPDATE direct.
-- Pas de politique update ni delete pour authenticated.
```

La validation passe par une fonction `valider_objectif(id)` en `security invoker`, qui contrôle `current_employee_role() = 'gerant'` (ou le rôle habilité désigné au point G-4), la station, l'unicité de l'officiel, puis pose `valide_par`, `valide_le` et remplace l'ancienne version dans la même transaction. `anon` n'a aucun droit. Les `revoke` sont posés explicitement sur `anon` et sur `public` (un `revoke from public` seul ne ferme pas `anon`), et `TRUNCATE` est retiré à `authenticated`.

`objectif_catalogue` : lecture pour `authenticated`, aucune écriture hors migration.

### Lecture par le Brief et par A4

Le Brief et A4 lisent la même vue en lecture seule, qui expose pour la période demandée l'objectif **officiel** de la station (jamais un brouillon), sa `version` et `valide_le`. A4 conserve cet identifiant de version à côté des chiffres, pour qu'un relevé reste interprétable après un changement de cible.

### Liens avec le Conseiller

Une table `objectif_recommandation(site, objectif_id, recommandation_id, ecart, cause_nature, action, potentiel_estime, resultat_obtenu)` relie une recommandation à une cible. `cause_nature` vaut `demontree` ou `supposee`. Les potentiels sont dédoublonnés par clé (`site`, `indicateur_id`, `periode_debut`, `cause`) pour qu'un même gain ne soit pas compté sous deux objectifs. Les moteurs ne sont pas modifiés par cette étape : le lien est une table de rapprochement alimentée plus tard.

### Arbitrages ouverts pour le gérant (étape 3)

- **G-4** : quels rôles sont « responsables habilités » à proposer, et le gérant seul valide-t-il ? (Aujourd'hui `manager` et `gerant` partagent la plupart des politiques.)
- **G-5** : une cible officielle de période en cours peut-elle être révisée, avec motif, ou seulement à la période suivante ?
- **G-6** : cible trimestrielle et annuelle saisies directement, ou seulement déduites de la somme des mois ?

## 6. Suite

Étape 4 : maquette du bureau de gestion et maquette de restitution dans le Brief (données fictives, charte Brief v4). Étape 5 : critères de recette, tests de sécurité, arbitrages consolidés. Les lignes « À instruire » du catalogue seront reclassées avant l'étape 5.

## 7. Maquettes (étape 4)

Deux maquettes statiques, charte du Brief v4, station fictive « Station Exemple », aucune valeur réelle, aucun branchement.

- `maquettes/objectifs-bureau.html` : bureau de gestion. Liste par indicateur et horizon (mois, trimestre, année), classe disponible / à fiabiliser / non disponible, règle d'agrégation affichée, parcours brouillon → proposé → officiel → remplacé, historique des versions, cible trimestre ou année dérivée ou saisie avec écart de cohérence (G-6), indicateurs non posables sans bouton.
- `maquettes/objectifs-brief.html` : restitution dans le Brief. Par objectif : atteint, cible, % de progression, niveau attendu aujourd'hui, écart, tendance, période, fraîcheur, jours couverts. Cas traités : cumul en retard et en avance, moyenne sans projection faute de jours complets, plafond de réduction dépassé, cible zéro sans pourcentage, indicateurs sans lecture, recommandations du Conseiller avec cause démontrée ou supposée et potentiel non doublé, parité avec l'A4 et version des objectifs citée.

Version mobile : non commencée, comme demandé.
