# Brief, performance B0-perf-4 : note de conception

Statut : note seule. Aucun code, aucune migration, aucune lecture Production. Présentée au gérant par Guardian avant tout lot.

## Point de départ (mesure Guardian après B0-perf-3, #402)

- Contenu visible à 19,8 s. Dernier chargeur : `NexusCarburantDonnees.chargerControleJour` (fin à 19 087 ms). Calcul JS : 631 ms.
- 186 requêtes, durée moyenne 755 ms. Rien ne démarre avant 3 s : scripts, `nexusRequireAuth`, forfait, fuseau, tout en séquence.
- Repli carburant : 14 à 18 s, rejoué jour par jour (premier candidat seul, puis lots de 4).
- `products` : 26 pages de 1000 lignes en Production, 6 à 14 s par page.

Les trois options sont indépendantes. Elles peuvent être livrées dans n'importe quel ordre, une PR et un GO chacune.

## Option (a) : démarrage en parallèle de l'authentification

**Constat.** Après `nexusRequireAuth()`, `NEXUS-Brief-v1.html` enchaîne en séquence : `nexusRequireGestion`, `nexusRequireBriefNexus` (forfait), `fuseauDeLaStation`, `lirePosteDuJour`, lecture de `sites`, puis `chargerJournalDecisions` et `rafraichir`. Le `site_id` vient de l'employé : forfait, fuseau, poste du jour et `sites` n'ont pas besoin les uns des autres.

**Proposition.**
1. Lancer ensemble (`Promise.all`) forfait, fuseau, poste du jour et lecture de `sites` dès que `employee` est connu.
2. Garder la garde (`nexusRequireGestion`, puis le verdict du forfait) avant tout rendu et avant `rafraichir()`. Les lectures lancées en parallèle ne sont jamais affichées si la garde refuse : leur résultat est jeté.
3. Option plus poussée, à ne prendre qu'avec un GO distinct : démarrer `chargerProduitsBrut` pendant la garde. Elle lit des données du site avant le verdict d'accès, donc elle élargit ce que la garde protège. Non retenue dans la version de base.

**Gain attendu.** Les quatre attentes séquentielles deviennent une seule : de l'ordre de 1 à 2 s sur les 3 s de démarrage (estimation, à mesurer : chaque appel dure environ 755 ms en moyenne).

**Risque.** Faible. Le point de vigilance est l'ordre d'effet : `NexusTheme.definirFuseau` doit rester appelé avant le premier rendu. Un refus de garde ne doit rien laisser d'affiché ni d'écrit.

**GO nécessaire.** GO de Guardian pour le lot. Pas de migration, pas de Production.

## Option (b) : repli carburant en une seule vague

**Constat.** Le repli rejoue `chargerCarburantsBrief` pour chaque jour candidat (14 jours au plus). Chaque rejeu relit les mêmes tables : `carburant_releves` (jour et précédent), point zéro, `station_config`, `audits_caisse`, ventes de période ×2, cuves, prix, livraisons par carburant. Plusieurs de ces lectures ne dépendent pas du jour (`station_config`, cuves, prix).

**Proposition.**
1. Lire une fois ce qui ne dépend pas du jour : `station_config`, cuves, prix.
2. Lire une fois, sur la plage des jours candidats, les tables qui dépendent du jour : `carburant_releves` et `audits_caisse` (`gte` borne basse, `lte` borne haute, ou `in(...)`), plus les réceptions et livraisons de la plage.
3. Évaluer chaque jour côté navigateur avec les mêmes fonctions pures (`M.resoudreVentesFenetre`, `trouverJourFiableAnterieur`, `fraicheurCarburant`). Même résultat, une vague au lieu de N.

**Gain attendu.** Le repli passe de 14 à 18 s à l'ordre d'une à deux requêtes larges : de l'ordre de 2 à 4 s (estimation). C'est le plus gros gain des trois, puisque c'est le dernier chargeur à finir.

**Risque.** Moyen. Le résultat doit être identique à l'actuel : même date retenue, même `fraicheur`, mêmes avertissements. Cas à couvrir : point zéro ancrant une date ultérieure, relevé lié à une livraison, quart chevauchant, jour sans relevé. Preuve prévue : test d'équivalence sur client factice, sur le modèle de `test_brief_perf_b0.js` (séquentiel contre une vague, mêmes entrées, sortie comparée champ à champ), complété par une mesure sur Test.

**GO nécessaire.** GO de Guardian pour le lot. Pas de migration. Pas de Production : la mesure se fait sur Test.

## Option (c) : agrégation de `products` côté base

**Constat.** `chargerProduitsBrut` lit toute la table du site, 7 colonnes, 26 pages en Production (environ 26 000 lignes), puis retire les produits d'appel. C'est l'essentiel du temps réseau du Brief, et elle est lue en entier à chaque ouverture.

**Champs consommés (7, déjà la projection minimale).**

| Champ | Usage dans le Brief |
|---|---|
| `article` | clé d'appariement entre périodes, exclusion des produits d'appel |
| `categorie` | groupes de comparaison de marge, candidats, catégories en écart |
| `ca` | CA total de la période affichée, facteurs d'indice, tendances |
| `marge` | écart de marge au groupe, facteurs d'indice |
| `quantite` | volume suffisant, tendances par article |
| `periode_debut` | repérage des périodes, `caTotalPeriode` |
| `periode_fin` | durée des périodes (`analyserPeriodes`, appariement `dernieres`) |

Réserve honnête : les consommateurs (`analyserPeriodes`, `calculerFacteurs`, `calculerCandidatsProduits`, `analyserProduitsStrategiques`, `analyserEvolutionsPaire`, `chargerMargePlus`, qualification) n'ont pas tous été relus champ par champ pour cette note. La liste ci-dessus est l'union de ce qu'ils lisent. Avant toute migration, un inventaire par consommateur fixera ce que la vue doit renvoyer : probablement une ligne par article et par période (ca, marge, quantite sommés) sur les périodes utiles, plutôt que les lignes brutes.

**Proposition.** Une vue ou une RPC `security invoker`, filtrée par site, qui renvoie seulement ces champs, déjà débarrassée des produits d'appel, limitée aux périodes que le Brief consomme (période affichée, période précédente, historique des facteurs).

**Gain attendu.** Volume : de l'ordre de 26 000 lignes à quelques milliers (estimation : un article par ligne et par période retenue, au lieu de toutes les lignes de toutes les périodes). Temps : 26 pages (6 à 14 s chacune, par lots de 4) à une ou deux pages. Gain probable de 8 à 15 s sur le chemin critique. À confirmer par une mesure sur Test, jamais sur Production sans GO.

**Risque.** Le plus élevé des trois. Une agrégation qui ne reproduit pas exactement l'entrée des fonctions pures changerait les recommandations affichées. Avec `security invoker`, la RLS de `products` s'applique : à vérifier, pour ne pas ouvrir une lecture que la RLS fermait. Le même motif de vue pourrait servir à d'autres pages, ce qui est écarté pour l'instant (lecture partagée de `products` : « non pour l'instant »).

**GO nécessaire.** Deux GO distincts : celui de Guardian pour la conception de la vue, puis celui du gérant pour la migration (changement de base). Application sur Test d'abord. Aucune Production sans GO.

## Ordre proposé et récapitulatif

| Option | Gain attendu | Risque | GO |
|---|---|---|---|
| (b) repli carburant en une vague | 10 à 14 s | moyen | Guardian |
| (c) agrégation `products` | 8 à 15 s | élevé | Guardian puis gérant (migration) |
| (a) démarrage en parallèle | 1 à 2 s | faible | Guardian |

Les gains ne s'additionnent pas : le Brief attend le plus lent des chargeurs. Après (b), le chemin critique devient `products` ; après (c), le démarrage. Ordre conseillé : (b), puis (a) qui est peu coûteuse, puis (c) si la mesure montre que `products` domine encore.

Tous les chiffres de gain sont des estimations tirées de la mesure de Guardian (B0-perf-3), pas de mesures de ces options. Chaque lot mesurera avant et après sur Test.
