# Référentiel des objectifs de station : plan d'implémentation

Document seul : aucun code, aucune migration. Il découle de `objectifs-station.md` (arbitrages du 26/11 inclus) et des autorités de l'audit #393. Rien n'est lancé sans le GO indiqué pour chaque lot. Aucun accès Production n'est nécessaire pour concevoir ou recetter sur Test.

## 1. Principe d'ordre

Un lot ne démarre que si ses dépendances sont closes. Les trois autorités de l'audit #393 passent d'abord, car chaque objectif de performance en lit au moins une :

1. **Compensation de caisse** (rang 1) : l'écart de caisse se mesure en Σ |piste| + |boutique| par quart, sans compensation (G-7). `nexus-ecarts-moteur.js` reste l'autorité de gravité.
2. **Filtre de station** (rang 3) : toute lecture d'objectif, de réalisé ou d'habilitation est filtrée par site.
3. **Fuseau horaire** : Martinique, UTC−4 ; jour complet et mois civil se calculent dans ce fuseau, via Tempo.

## 2. Lots

| Lot | Contenu | Dépend de | GO requis | Test sans GO Production | Taille |
|---|---|---|---|---|---|
| L0 | Cadrage des autorités #393 : compensation, filtre de station, fuseau, en lecture des moteurs existants ; fiche de conformité par moteur | aucune | aucun (document) | oui | S |
| L1 | Écart de caisse conforme à G-7 dans le moteur d'écarts, avec épreuves | L0 | GO modification de moteur | oui (épreuves locales) | S |
| L2 | Schéma : `objectif_catalogue`, `station_objectifs` versionnée (immuabilité, R7, D8), `objectif_habilitation`, `objectif_habilite(site, droit)`, RLS réduite aux comptes habilités, vue en `security_invoker` | L0 | GO migration (Test d'abord, Production ensuite) | oui sur Test | M |
| L3 | RPC `security definer` : `proposer_objectif`, `valider_objectif` (jamais sa propre proposition, S16), `retirer_objectif`, RPC d'octroi ; première habilitation posée par la migration : pilote, rôle `gerant`, managers de station | L2 | GO migration | oui sur Test | M |
| L4 | Moteur de lecture des objectifs : trois natures jamais mêlées, trois horizons, agrégation propre aux taux et moyennes, progression mois civil contre mois précédent (G-1) | L1, L3 | GO code | oui | M |
| L5 | Écran bureau : saisie, validation, révision motivée (G-5), historique des versions | L3, L4 | GO code | oui sur Test | M |
| L6 | Indicateurs de maîtrise reclassés : définitions « conforme » de G-8 branchées là où la source existe ; les « à valider » restent sans cible | L4, arbitrage du gérant sur chaque « à valider » | GO code, puis réponses du gérant | partiellement | S à M |
| L7 | Recette navigateur sur Test (S1 à S16), puis demande de GO de promotion | L5, L6 | GO déploiement Production, séparé | oui, jusqu'à la promotion | S |
| L8 | Version mobile | L7 | signal de Guardian | hors périmètre pour l'instant | non estimée |

Taille : S ≈ une demi-journée, M ≈ une à deux journées, hors attente d'arbitrage.

## 3. Ce que l'on peut faire sans GO Production

Tout sauf la promotion : L0 est un document ; L1 à L7 se conçoivent, s'écrivent et se recettent sur Test, chacun sous son propre GO de code ou de migration. Aucune lecture Production, aucune donnée réelle sur le canal. Le seul geste Production est la promotion de L7, par PR et GO explicites.

## 4. Points encore ouverts

- **G-6** : cible propre du trimestre pour les moyennes et ratios (recommandation : oui pour les ratios). À trancher avant L2.
- Chaque définition « à valider » de la sous-section G-8 : tant que le gérant ne l'a pas validée, l'indicateur reste « à fiabiliser » et ne reçoit pas de cible.
- La PR #392 (brief v4) reste en brouillon ; ce plan n'en dépend pas pour L0 à L3.

## 5. Hors de ce plan

Le lot d'annulation des versements de régularisation (demande 7203252709) est en file d'attente, indépendant. Il ne démarre pas avant le signal de Guardian.
