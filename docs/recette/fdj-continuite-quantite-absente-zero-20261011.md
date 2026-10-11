# Recette — continuité FDJ : une quantité absente vaut 0 (nexus-test)

**Handoff MISSION PATRIMOINE du 11/10/2026 (Frédéric).** « GO pour corriger le défaut de continuité du stock FDJ en développement et en Test. Aucun GO Production. » Règle : une quantité de stock non renseignée vaut 0, sans valeur fictive ni mouvement modifié ; le stock initial d'un quart reprend le stock final effectif du quart précédent, jeu par jeu ; aucun jeu actif n'est écarté silencieusement parce que sa quantité est NULL.

**Environnement.** Base Test `udljdqxerrbbbajxubfn`, site `nexus-station-test`. La migration `20261011200000_fdj_continuite_quantite_absente_zero.sql` y est **appliquée le 11/10/2026 à 20:20:01Z** (registre 318 → 319). Chaque scénario est une transaction annulée. **Aucune écriture en Production** : voir `docs/deploiement/procedure-fdj-continuite-quantite-absente-zero-production.md`.

## Cause racine

La chaîne a été mesurée en Production, en lecture seule.

1. **La saisie manager crée une fin NULL.** `fdj_manager_enregistrer_comptages` fait un upsert de `nullif(stock_final, '')`. Une ligne envoyée sans fin, ici MISSION PATRIMOINE ajoutée à un quart, est donc créée avec un début 0 et une fin NULL. C'est le cas des quarts du 10/10 le 11/10 à 14:40-14:42Z, puis de `539e87bc` (Q1 du 11/10) à 18:23Z.
2. **L'écran employé n'hérite que des fins renseignées.** `chargerDernierStockFinal` (`NEXUS-FDJ-v1.html`) faisait `if (c.stock_final !== null) map[...]`, depuis 67b3555 du 09/08. Le jeu arrive sans début.
3. **L'écran n'envoie que les jeux comptés.** `jeuEstCompte` exige un début et une fin ; `jeuxSansStockFinal` n'invite que si le début est connu ; `construireComptagesAEnvoyer` filtre sur `jeuEstCompte`. MP disparaît du quart sans invite.
4. **Aucune commande en base n'appliquait « absent = 0 ».** `fdj_valider_ouverture_quart`, `fdj_incrementer_appro_shift_count` et `fdj_ecrire_saisies_caisse` écrivent ce que l'écran envoie. `fdj_confirmer_caisse` ne compare pas les lignes aux jeux actifs.

Le relevé imprime malgré tout « Continuité vérifiée ». En effet, la chaîne ne compare que les jeux présents.

## Correctif

| Couche | Avant | Après |
|---|---|---|
| Base (autorité métier) | aucune règle de stock hérité | `fdj_stock_initial_herite(shift, jeu)` lit la fin du dernier quart validé qui porte une ligne. Une fin absente à stock nul donne 0 (`quantite_absente_zero`). S'il restait du stock, la valeur est NULL (`inconnu`). Un jeu jamais compté donne 0 (`jamais_compte`). |
| Base (complétion) | — | `fdj_completer_continuite_quart(shift, source, jeu)` agit sur un **quart brouillon seulement** et ne vise que les jeux actifs sans ligne et les lignes sans début. Elle pose le début hérité avec `stock_initial_auto = true` et écrit le journal `correction_stock_initial`. Dans le cas « inconnu », elle lève l'alerte `continuite_stock_a_verifier` sans poser de valeur. |
| Base (câblage) | — | La complétion est appelée par `fdj_valider_ouverture_quart` (qui rend `jeux_completes`), par `fdj_incrementer_appro_shift_count` et par `fdj_ecrire_saisies_caisse`, chacune après sa propre écriture. `fdj_confirmer_caisse` refuse `saisie_incomplete` quand la fin manque alors que début + appro > 0. Le relevé est `provisoire` si une alerte de continuité est ouverte. |
| Moteur | — | `NexusFdjMoteur.stocksFinauxHerites(lignes)` applique la même règle que la base. |
| Écran employé | hérite des fins non NULL seulement | `chargerDernierStockFinal` lit début, appro et fin, puis passe par le moteur |

Ne sont **jamais** écrits : une valeur saisie (début, fin, appro), un mouvement de stock (`fdj_stock_movements`), un quart validé ou certifié.

## Recette base sous rollback — 53 OK, 0 KO

Rejouée le 11/10 après application sur Test. Le registre n'a pas bougé pendant la recette (319).

| Section | Ce qui est éprouvé | Résultat |
|---|---|---|
| **S1** séquence du handoff | Q2 du 10/10 : MP final 0. Q1 du 11/10 : final absent. Ouverture du Q2 du 11/10 par l'ancien écran, qui envoie 28 jeux sans MP. | `jeux_completes = 1` ; MP présent, **0 / 0 / NULL**, `stock_initial_auto` ; 29 lignes, aucun jeu actif sans ligne ; un seul audit `correction_stock_initial` ; ouverture validée, aucune alerte ; lignes du Q1 du 11/10 inchangées |
| **S1b** clôture | confirmation du Q2 | écart 0 ; un événement et un relevé v1 ; **relevé définitif**, continuité sans réserve, MP au relevé ; rejeu idempotent, sans nouvel événement ni relevé, toujours un seul audit |
| **S1c** quart suivant | ouverture du Q1 du 12/10 | MP = 0, hérité du Q2 du 11/10 |
| **S8** pas de recalcul injustifié | caisses, événements et relevés des quarts précédents | inchangés ; ventes du Q2 = `ventes_grattage_valeur` de sa caisse |
| **S2** stock final positif | fin MP du Q1 = 7 | MP absent du payload : il hérite 7 (`stock_final_precedent`). MP envoyé par l'écran : 7, rien complété, aucun audit. |
| **S3a** approvisionnement réel avant ouverture | appro +20 puis +5 | 0 / 20 / NULL, audit du déclencheur avec le contexte de reprise ; 25 sans nouvel audit ; ouverture sans toucher MP ; **clôture sans fin MP refusée** (`saisie_incomplete`, 25 en stock) ; clôture avec fin MP confirmée, **appro 25 et non 50** |
| **S3b** approvisionnement après ouverture | ouverture, appro +20, vente de 5 | 75 €, écart 0, un seul audit MP |
| **S4** modification manager | la saisie manager recrée l'origine (Q1 MP 0 / 0 / NULL) | ouverture employé : MP = 0. Une correction manager du Q1 (4 / 0 / 4) laisse le début du Q2 inchangé et n'ajoute aucun audit. |
| **S5a** quart déjà ouvert | quart ouvert sans MP | la clôture le complète à 0 et confirme |
| **S5b** valeur saisie | début 3 saisi | **jamais remplacé par 0**, rejeu compris |
| **S6** quart clôturé et certifié | Q1 validé | `completer` : 0, aucune ligne ; ouverture et appro refusées (42501) ; confirmation : `quart_non_confirmable` ; caisse, événements, relevés, lignes et statut inchangés. Un Q1 sans ligne MP fait remonter le Q2 jusqu'au Q2 du 10/10 (0, `stock_final_precedent`). |
| **S7** « inconnu » | fin absente alors qu'il restait du stock | **aucune valeur fabriquée** : pas de ligne MP, une seule alerte, rejeu compris ; confirmée avec **relevé provisoire**, continuité à vérifier |
| **S9** accès | `authenticated`, `anon`, `service_role` | `completer` et `herite` refusés à `authenticated` et `anon` (42501) ; insertion directe refusée (42501) ; EXECUTE : les deux nouvelles à `service_role` seul ; `confirmer`, `valider_ouverture`, `incrementer_appro` à `authenticated` ; `ecrire_saisies` fermée à `authenticated` (A6) |
| **Témoin** | après la recette | aucun quart de recette restant ; le Q1 du 11/10 de la base Test n'est pas modifié |

## Mutations (chacune chargée dans la transaction, puis annulée)

| Mutation | Altération | Résultat |
|---|---|---|
| **M1** | `fdj_completer_continuite_quart` rend 0 sans rien faire : c'est l'état de Production | **9 OK / 8 KO** : 28 lignes, MP absent, `jeux_completes = 0`, quart suivant sans MP. **C'est le symptôme constaté en Production**, alors que le relevé reste « définitif, sans manquant ». |
| **M2** | `herite` : la condition `= 0` devient `= -1`, donc une fin absente à stock nul passe en « inconnu » | **8 OK / 9 KO** : MP absent, alerte levée, relevé provisoire |
| M3 | `herite` : la valeur « inconnu » passe à 0, mais la règle reste `inconnu` | 2 OK / 0 KO : **mal visée**. La complétion arbitre sur `regle`, pas sur `valeur` ; la mutation sort donc du contrat. Remplacée par M3b. |
| **M3b** | `herite` : `= 0` devient `>= 0`, donc il restait du stock et 0 est fabriqué | **2 KO en S7** : une ligne MP est posée et le relevé n'est plus provisoire |
| **M4** | `completer` : la branche « inconnu » est désactivée | **2 KO en S7** : aucune alerte, relevé non provisoire |
| **M5** | `completer` vise toutes les lignes et remplace sans condition | **1 KO en S5b** : la valeur saisie 3 est remplacée par 0 |

Après les mutations, le témoin est restauré : les md5 servis sont ceux du tableau ci-dessous.

## md5 servis sur Test après application

`pg_get_functiondef`, relus le 11/10 à 21:17:46Z (registre 319, dernière `20261011200000`). Le constat Production (geste 3 de la procédure) doit retrouver ces valeurs.

| Fonction | md5 avant (= Production au 11/10) | md5 après (Test) | ACL après |
|---|---|---|---|
| `fdj_stock_initial_herite` | absente | `afcc76734436df99556d96132367c76d` | `postgres`, `service_role` |
| `fdj_completer_continuite_quart` | absente | `43a9adb18012da763d59673da3d2552c` | `postgres`, `service_role` |
| `fdj_tracer_correction_stock_initial` | `c2c4ca11ac2fc2344fc791f033f9e789` | `97a6abf465fd3d81c26157dba431d0d6` | non touchée (`=X`, `postgres`, `anon`, `authenticated`, `service_role`) |
| `fdj_ecrire_saisies_caisse` | `4fccfc9827ba46fd36ce0a1bd3f06cb9` | `9598b701c204424042a336677ce33e59` | `postgres`, `service_role` |
| `fdj_valider_ouverture_quart` | `9104e4ffc5409779291e02c63306478e` | `b3ae27c81565abd6afab31f60ddd518b` | `postgres`, `authenticated`, `service_role` |
| `fdj_incrementer_appro_shift_count` | `d5da665129c1828fc840821d4f670068` | `623e23757f319d7e2f15890dd39575dc` | `postgres`, `authenticated`, `service_role` |
| `fdj_confirmer_caisse` | `ebe560a12a7ac29ba3a61804957d939e` | `2ff1ecdcc78cb3ce4906db9df93247f9` | `postgres`, `authenticated`, `service_role` |

Les ACL de A6 sont respectées : aucune fonction n'est ouverte à `anon`, sauf la fonction de déclencheur préexistante, qu'on ne peut pas appeler directement. `fdj_ecrire_saisies_caisse` reste fermée à `authenticated`.

## Suite automatique

`test_fdj_continuite_quantite_absente_zero_20261011.js` : **10/10**. Il couvre :
- le moteur : fin absente à stock nul, fin renseignée, stock restant, ligne vide, plusieurs jeux ;
- le câblage de l'écran ;
- le contenu de la migration : « inconnu » n'est pas 0 ; complétion bornée au brouillon et aux débuts NULL ; aucun mouvement ; câblage aux trois écritures et à la confirmation ; nouvelles fonctions fermées à `anon` et `authenticated`.

## Production au 11/10 (lecture seule, 21:14:22Z)

- Registre 308, dernière `20261011090000` ; `20261011200000` absente ; les cinq md5 « avant » sont inchangés.
- `539e87bc` (Q1 du 11/10) est `valide` : 29 lignes, MP (0, 0, NULL). **Le Q2 du 11/10 n'est toujours pas ouvert.** 29 jeux actifs.
- 7 fins absentes, toutes à stock nul, 0 « inconnu » : voir la procédure, § Impact.
- **PHARAONIS 3€** : sa fin manque sur `8319de45`, et le quart suivant `4fa6b5b0` n'a pas de ligne. Ce n'est pas le défaut : `4fa6b5b0` a été créé par le manager le 04/10 à 23:16:58Z, et cette création envoie tous les jeux actifs. Le jeu était donc déjà désactivé. Effet nul.
- Aucun quart validé n'est touché par la migration. Ni nouvelle version, ni révocation de certification, ni régularisation ne sont nécessaires. La régularisation de `539e87bc` reste optionnelle, sur GO distinct.

## Points ouverts (arbitre)

- **« inconnu » vs « non renseigné = 0 ».** Quand il restait du stock, poser 0 fabriquerait une vente. La base pose NULL et lève une alerte. 0 cas en Production.
- **Création manager à 0** (`NEXUS-FDJ-Manager-v1.html` l.1290) : une fin NULL y vaut 0 même s'il restait du stock.
- **Détection d'écart manager** (l.1712) : les fins NULL sont ignorées.
- **`fdj_manager_enregistrer_comptages`** n'est pas modifiée : elle crée toujours des fins NULL, que la base lit désormais comme 0.
