# Plan d'implémentation : référentiel des objectifs et Brief v4

Document seul : aucun code, aucune migration. Il découpe **deux ensembles** : le référentiel des objectifs (`objectifs-station.md`, arbitrages du 26/11 inclus) et le Brief v4 (PR #392, §15 et §18.2). Rien n'est lancé sans le GO indiqué pour chaque lot. Aucun accès Production n'est nécessaire pour concevoir ou recetter sur Test. Tailles : S ou M, sans délai promis.

Limite de lecture : la liste des doublons ci-dessous est celle du Brief v4 §18.2. Je ne l'ai pas rapprochée ligne à ligne du §13 de l'audit #393 ; ce rapprochement est la première tâche du lot A0.

## 1. Ordre et dépendances

1. **Autorités (lots A)** : corrections de code, chacune sous son GO. Elles passent avant tout ce qui les lit.
2. **Référentiel (lots R)** : schéma, habilitation, RPC, moteur L4 (R3), écran.
3. **Brief (lots B)** : B1 à B5 ne lisent pas le moteur R3. Le bloc « Objectifs » du Brief (B6) lit R3 et ne démarre qu'après lui.
4. **Conseiller et A4 (lots C)** : après R3 ; ils lisent les objectifs.
5. **Recette et promotion (lot P)** en dernier.

## 2. Lots

Colonnes : fichiers touchés · migration (retour arrière) · tests · recette · risque. « À confirmer » signale un nom de fichier que je n'ai pas relu pour ce plan.

### Autorités (code, un GO chacune)

| Lot | Contenu | Dépend de | GO | Taille |
|---|---|---|---|---|
| A0 | Rapprocher la liste de §18.2 de l'audit #393 §13 ; fiche de conformité par moteur. Document. | aucune | aucun | S |
| A1 | **Compensation de caisse** (rang 1) : écart = Σ \|piste\| + \|boutique\| par quart (G-7) ; supprimer le doublon `calculerStatutOperations` / alias du Brief (§18.2 pt 3) | A0 | GO code | S |
| A1b | **Santé de la caisse** : migration de `calculer_caisse_sante` pour lire `abs(ecart_piste) + abs(ecart_boutique)` (G-7) ; aucun rattrapage de données (`ecart_total` stocké inchangé) ; retour arrière et tests sur Test | A1 | GO migration | S |
| A2 | **Filtre de station** (rang 3) : correction de code dans chaque lecteur sans filtre explicite de site (liste de l'audit) | A0 | GO code | M |
| A3 | **Fuseau** : une fonction « aujourd'hui de la station » (UTC−4) remplace l'UTC dans huit emplacements (audit §13.3, A0 §1 pt 4) : risques, Conseiller, Tempo, projection A4, rappels, coach FDJ, carburant (chargeur du Brief inclus), inventaire ; mois civils en Martinique | A0 | GO code | M |
| A4 | **Doublons suivants de §18.2** : Commerce (produits d'appel, pt 1), Marge (deux moteurs d'écarts, pt 2), note globale (pt 5), potentiel compté deux fois (pt 6, repris en C1) | A0 | GO code, un par doublon | M |

| Lot | Fichiers touchés | Migration | Tests | Recette | Risque |
|---|---|---|---|---|---|
| A1 | `nexus-ecarts-moteur.js`, `nexus-conseiller-donnees.js`, alias du Brief | non | épreuves de valeurs (+10 et −10 = 20) | D4 | un écran lit l'ancienne règle compensée |
| A2 | lecteurs listés par l'audit (à confirmer) | non | épreuve par lecteur : station A ne voit pas B | S3, S12 | un filtre ajouté masque des lignes à site nul |
| A3 | `nexus-brief-donnees.js` (chargeur carburant), `nexus-tempo.js` en lecture | non | épreuve de bascule à minuit UTC−4 | D2 | séries décalées d'un jour dans le Brief |
| A4 | `nexus-brief-donnees.js`, `nexus-secteurs-moteur.js`, `detecterEcartsMarge` (à confirmer) | non | parité avant/après sur jeux fictifs | D1, D3 | deux moteurs divergents pendant la transition |

### Référentiel

| Lot | Contenu | Dépend de | GO | Taille |
|---|---|---|---|---|
| R1 | Schéma : `objectif_catalogue`, `station_objectifs` versionnée (immuabilité, R7, D8), `objectif_habilitation`, `objectif_habilite(site, droit)`, RLS réduite aux comptes habilités, vue `security_invoker`. **Aucun compte désigné.** | A2 | GO migration (Test, puis Production) | M |
| R2 | RPC `security definer` : `proposer_objectif`, `valider_objectif` (jamais sa propre proposition), `retirer_objectif`, RPC d'octroi | R1 | GO migration | M |
| R2b | **Première habilitation, migration distincte** : pilote, rôle `gerant`, managers de station. Peut ne jamais aller sur Test, qui garde un schéma sans compte désigné. | R2 | GO migration propre, séparé de R1 et R2 | S |
| R3 | Moteur de lecture : trois natures jamais mêlées, trois horizons, agrégation propre aux taux et moyennes, progression mois civil contre mois précédent (G-1) | A1, A3, R2 | GO code | M |
| R4 | Écran bureau : saisie, validation, révision motivée (G-5), historique des versions | R2, R3 | GO code | M |
| R5 | Indicateurs de maîtrise reclassés : définitions « conforme » (G-8) branchées là où la source existe ; les « à valider » restent sans cible | R3, réponses du gérant | GO code, puis réponses | S à M |

**G-6** (tranché le 26/11) : le trimestre d'un ratio ou d'une moyenne porte sa propre cible, préremplie par NEXUS avec la cible annuelle et modifiable avant validation. R3 en tient compte pour l'agrégation, R4 pour le champ de saisie du trimestre. R1 et R2 n'en dépendaient pas.

| Lot | Fichiers touchés | Migration (retour arrière) | Tests | Recette | Risque |
|---|---|---|---|---|---|
| R1 | `supabase/migrations/` (nom à confirmer) | oui ; retour : supprimer vue, politiques, trigger, tables, dans l'ordre inverse. Avec des lignes présentes, le trigger d'immuabilité bloque la suppression : l'ôter d'abord, à vérifier sur Test | S1 à S4, S7 à S13 | S1 à S4, S7 à S13 | RLS ouverte par défaut ; privilèges par défaut vers `anon` |
| R2 | idem | oui ; retour : supprimer les fonctions | S5, S6, S14, S16 | S5, S6, S14, S16 | `search_path` ; auto-validation |
| R2b | idem | oui ; retour : supprimer les lignes d'habilitation marquées d'origine « migration » | S15 | S15 | désigner un compte à tort ; Production seulement |
| R3 | nouveau `nexus-objectifs-moteur.js` (à confirmer), `nexus-tempo.js` en lecture | non | D2 à D7 | D2 à D7 | mélange des trois natures ; agrégation fausse d'un ratio |
| R4 | écran bureau (à confirmer) | non | épreuves d'écran + garde de page | S6, S16, D6, D8 | écran qui recalcule au lieu de lire R3 |
| R5 | `nexus-inventaire-moteur.js`, `nexus-verify-moteur.js`, `nexus-risques-moteur.js`, `nexus-fdj-moteur.js` en lecture | non | une épreuve par définition | D6, D7 | cible posée sur une définition « à valider » |

### Brief v4

| Lot | Contenu (Brief §15) | Dépend de | GO | Taille |
|---|---|---|---|---|
| B0 | Calculs du Brief (Brief lot A) : Indice à 4 secteurs, Marge en euros, Opérations en écarts absolus, classement stable | A1 à A4 | GO code | M |
| B1 | En-tête et fiabilité des données (bloc État global) | B0 | GO code | S |
| B2 | Les trois lectures : performance, maîtrise, fiabilité (§17) | B0 | GO code | M |
| B3 | Les cinq cartes de secteur (§11.5, §17.3) | B0, B2 | GO code | M |
| B4 | Histogramme base 100 (`resumerMargeParPeriode`, §18.3) | B0 | GO code | S |
| B5 | Courbes sur 40 jours (Brief lot C) | B0, A3 | GO code | M |
| BD | Signaux de risque (Brief lot D) | B0 | GO code | S |
| B6 | Potentiel et décisions : bloc « Objectifs et potentiel », objectif servi sur chaque priorité (Brief lot E). **Lit le moteur R3.** | R3, B1, GO du gérant sur le modèle | GO code | M |
| B7 | Accès au rapport A4 depuis le Brief | B1 | GO code | S |

| Lot | Fichiers touchés | Migration | Tests | Recette | Risque |
|---|---|---|---|---|---|
| B0 | `nexus-secteurs-moteur.js`, `nexus-brief-donnees.js` | non | épreuves de valeurs et de fuseau (Brief §14) | D1, D3 | recalcule ce qu'un moteur fait déjà |
| B1 | écran du Brief (à confirmer), `nexus-brief-donnees.js` | non | épreuves Brief §14 | recette Guardian | fiabilité affichée sans donnée |
| B2 | `nexus-secteurs-moteur.js`, écran du Brief | non | épreuves Brief §14 | recette Guardian | une note globale réapparaît |
| B3 | `nexus-secteurs-moteur.js`, écran du Brief | non | idem | recette Guardian | chiffre métier divergent du moteur |
| B4 | `nexus-brief-donnees.js` | non | épreuve base 100 sur jeu fictif | D5 | base 100 sur période courte |
| B5 | `nexus-brief-donnees.js`, écran du Brief | non | états vides, tableau de valeurs | D3, D7 | séries tronquées à 40 jours |
| BD | `nexus-risques-moteur.js`, écran du Brief | non | règle de fermeture | recette Guardian | alerte qui ne se ferme pas |
| B6 | écran du Brief, R3 en lecture | non | parité cible Brief = cible R3 | D6, D8, C3 | cible présentée comme potentiel |
| B7 | écran du Brief | non | lien vers l'A4 | D1 | lien vers un A4 d'une autre version |

Recette « Brief §14 » : identifiants propres au Brief, non repris ici.

### Conseiller et A4 (lots distincts, car ils touchent deux fichiers sans lien)

| Lot | Contenu | Dépend de | GO | Taille |
|---|---|---|---|---|
| C1 | **Conseiller** : table `objectif_recommandation`, recommandation avec écart, cause (démontrée ou supposée), action, potentiel ; **dédoublonnage des potentiels** (une perte n'est comptée qu'une fois) | R3, A4 (pt 6) | GO migration puis GO code | M |
| C2 | **A4** : version des objectifs imprimée dans le rapport, pour relire un ancien A4 avec ses cibles d'alors | R3 | GO code ; migration éventuelle (référence de version), à confirmer à la conception | S |

| Lot | Fichiers touchés | Migration (retour arrière) | Tests | Recette | Risque |
|---|---|---|---|---|---|
| C1 | `nexus-conseiller-donnees.js`, supabase (à confirmer) | oui ; retour : supprimer la table | épreuve de double comptage | C1, C2, C3 | potentiel présenté comme objectif validé |
| C2 | `rapport-a4` (à confirmer) | éventuelle ; retour : retirer la colonne | A4 ancien relu avec cibles d'alors | D8 | A4 ancien recalculé avec les cibles actuelles |

### Promotion

| Lot | Contenu | Dépend de | GO | Taille |
|---|---|---|---|---|
| P | Recette navigateur sur Test (S1 à S16, D1 à D9, C1 à C3), puis demande de promotion ; R2b suit séparément | R4, R5, B6, C1, C2 | GO déploiement Production, séparé | S |
| M | Version mobile (Brief §24) | P | signal de Guardian | non estimée |

## 3. Ce que l'on peut faire sans GO Production

Tout sauf la promotion : les lots A, R1, R2, R3 à R5, B, C se conçoivent, s'écrivent et se recettent sur Test, chacun sous son GO de code ou de migration. Aucune lecture Production, aucune donnée réelle sur le canal. Le seul geste Production est P, plus R2b, par PR et GO explicites.

## 4. Points encore ouverts

- Chaque définition « à valider » du §3 de `objectifs-station.md` : l'indicateur reste sans cible tant qu'elle n'est pas validée.
- Les noms de fichiers marqués « à confirmer » sont à relever à l'ouverture de chaque lot.
- Brief v4 reste en brouillon (#392) ; aucune fusion sans GO écrit du gérant.

## 5. Hors de ce plan

Le lot d'annulation des versements de régularisation (demande 7203252709) reste en file, indépendant. Il ne démarre pas avant le signal de Guardian.
