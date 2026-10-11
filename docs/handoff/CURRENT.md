<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/FDJ-CONTINUITE-QUANTITE-ABSENTE-20261011/request-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: FDJ-CONTINUITE-QUANTITE-ABSENTE-20261011
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=c516322 production=866b153
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 144-fichiers
  - id: pr102-tete
    classe: VERIFIED
    valeur: 0d492753c1a902b4a6e167e2835393551982aa33
  - id: migration-test
    classe: VERIFIED
    valeur: 20261011200000-registre-319
  - id: migration-production
    classe: VERIFIED
    valeur: absente-registre-308
  - id: recette-test
    classe: VERIFIED
    valeur: 53-ok-0-ko
  - id: mutations
    classe: VERIFIED
    valeur: M1-symptome-M2-M3b-M4-M5-rouges
  - id: run-tests
    classe: VERIFIED
    valeur: 263-270-identique-socle
  - id: q2-1110-production
    classe: VERIFIED
    valeur: non-ouvert-21-14-22Z
---
## Objet

Handoff de Frédéric du 11/10/2026 : **corriger le défaut de continuité du stock FDJ révélé par MISSION PATRIMOINE 15 €**. Le GO couvre le développement et Test. **Aucun GO Production.**

Les livrables sont prêts dans la PR [#102](https://github.com/vito-sainte-marie/nexus-vito/pull/102), **non fusionnée**. Je demande à l'arbitre de les juger, puis des **GO distincts** pour chaque geste Production listé plus bas. Je n'en exécute aucun sans ce GO.

## État mesuré

| Fait | Valeur |
|---|---|
| PR | #102, OPEN vers `production`, MERGEABLE, tête `0d492753c1a902b4a6e167e2835393551982aa33`, base `866b153` |
| CI de #102 | Construire et éprouver l'artefact SUCCESS (empreinte 304), Cloudflare Pages SUCCESS, une non-régression SUCCESS et l'autre en cours au dépôt ; GitHub Pages et Supabase Preview SKIPPED |
| Test (`udljdqxerrbbbajxubfn`) | `20261011200000` appliquée, registre 318 → 319 ; les sept md5 relus le 11/10 à 21:17:46Z |
| Production (`uzhjpqpctpvxytxpxoqz`), lecture seule du 11/10 à 21:14:22Z | registre 308, migration **absente** ; les cinq md5 « avant » sont identiques à ceux de Test avant application |
| Quart Q1 du 11/10 (`539e87bc`) | `valide`, 29 lignes, MP (début 0, appro 0, fin NULL) |
| Q2 du 11/10 | **non ouvert** au moment de la lecture |

## Cause racine (démontrée)

1. `fdj_manager_enregistrer_comptages` écrit `nullif(stock_final, '')`. La saisie manager a ainsi créé MISSION PATRIMOINE avec un début 0 et une fin NULL.
2. Côté employé, `chargerDernierStockFinal` (depuis 67b3555 du 09/08) n'héritait que des fins non NULL. Le jeu arrivait donc sans début.
3. `jeuEstCompte`, `jeuxSansStockFinal` et `construireComptagesAEnvoyer` écartaient ensuite ce jeu sans aucune invite. Il a disparu de quatre quarts consécutifs.
4. Aucune règle en base n'appliquait « non renseigné = 0 ». Le relevé imprimait malgré tout « Continuité vérifiée ».

## Correctif (PR #102)

- **Autorité métier en base**, migration `20261011200000`, blob `cc0bb193de4a8b9edcc52c9c8ce70c2736257772` :
  - `fdj_stock_initial_herite(uuid, uuid)` lit le dernier quart **validé**. Une fin absente à stock nul donne `0`. Une fin absente alors qu'il restait du stock donne `NULL` (règle `inconnu`), jamais 0, car 0 fabriquerait une vente. Un jeu jamais compté donne `0`.
  - `fdj_completer_continuite_quart(uuid, text, uuid)` agit sur un **quart brouillon seulement** et sur les **débuts NULL seulement**. Elle trace dans le journal `correction_stock_initial`. Dans le cas `inconnu`, elle lève une alerte `continuite_stock_a_verifier` sans poser de valeur.
  - Elle est câblée dans `fdj_valider_ouverture_quart`, `fdj_incrementer_appro_shift_count` et `fdj_ecrire_saisies_caisse`, toutes trois remplacées à signature identique.
  - `fdj_confirmer_caisse` refuse `saisie_incomplete` lorsqu'il reste du stock sans fin.
  - Les ACL de A6 sont réaffirmées à l'identique. Les deux nouvelles fonctions sont réservées à `service_role`. Aucun DDL.
- **Moteur et écran** : `NexusFdjMoteur.stocksFinauxHerites`, désormais appelé par `chargerDernierStockFinal`.
- **Jamais écrits** : une quantité réellement saisie, un mouvement de stock, un quart validé ou certifié.

## Preuves

- **Recette Test sous rollback : 53 OK / 0 KO.** Elle couvre :
  - la séquence du handoff (Q2 du 10/10 fin 0 → Q1 du 11/10 fin absente → ouverture du Q2 du 11/10 : MP présent avec un début 0) ;
  - une fin positive, un appro réel, une modification manager ;
  - un quart déjà ouvert, un quart clôturé et certifié ;
  - le cas `inconnu` ;
  - l'absence de double mouvement et de recalcul financier ;
  - les ACL.
- **Mutations** :

  | Mutation | Résultat |
  |---|---|
  | M1 | reproduit le symptôme de Production : 28 lignes, MP absent, relevé « définitif » |
  | M2 | rougit |
  | M3b | rougit |
  | M4 | rougit |
  | M5 | rougit |
  | M3 | mal visée au premier essai, puis remplacée par M3b ; consigné |

- `test_fdj_continuite_quantite_absente_zero_20261011.js` : 10/10.
- `run-tests.js` : 263/270. Les 7 rouges (inventaire, réception) sont identiques sur 866b153 (262/269). Aucun nouveau rouge.
- Garde d'ordre migration → code : verte. La fiche `atomique_ou_procedure_speciale` porte une mesure du catalogue Production.

## Impact sur les quarts existants

- 7 fins absentes en Production, toutes à stock nul ; 0 « inconnu ». Aucune n'est corrigée par la migration, car seuls les quarts brouillons sont complétés.
- Au prochain Q2, MISSION PATRIMOINE reprendra 0 automatiquement. **Aucune nouvelle version, révocation de certification ni régularisation n'est nécessaire.**
- PHARAONIS (fin manquante sur `8319de45`) : le jeu était déjà désactivé quand le manager a créé le quart suivant `4fa6b5b0`. Ce n'est pas le défaut.

## GO demandés, un par geste

1. **Arbitrage des livrables** de #102 (ChatGPT ou Frédéric).
2. **Migration Production**, gestes 1 à 3 de `docs/deploiement/procedure-fdj-continuite-quantite-absente-zero-production.md` : preflight (registre 308, dernière `20261011090000`), application, puis relecture des md5 et des ACL. **La migration passe avant le code.**
3. **Fusion de #102**, après le geste 2 seulement.
4. **Déploiement GitHub Pages** : approbation humaine de l'environnement.
5. **Recette Production en lecture seule**, puis constat passif au prochain Q2.
6. *Optionnel* : régularisation tracée de `539e87bc` (fin MP NULL → 0). Ce n'est pas nécessaire au correctif.

## Points soumis à l'arbitre

- **`inconnu`** : je laisse NULL et lève une alerte quand il restait du stock, car poser 0 fabriquerait une vente. Faut-il au contraire imposer 0 partout, au titre de « non renseigné = 0 » ?
- **Création manager à 0** (`NEXUS-FDJ-Manager-v1.html` l.1290) : une fin NULL y vaut 0, même s'il restait du stock.
- **Détection d'écart manager** (l.1712) : les fins NULL y sont ignorées.
- Je n'ai modifié ni l'une ni l'autre.
- **`fdj_manager_enregistrer_comptages`** : non modifiée. Elle peut encore écrire une fin vide, que le correctif absorbe en aval. Faut-il la contraindre aussi ?

Je ne fusionne, ne migre, ne déploie et n'écris rien en Production sans GO distinct.
