# Procédure — 20261011200000 et 20261011220000, continuité FDJ : quantité absente traitée comme 0, stocks finaux confirmés (Production)

**Statut : non exécutée en Production. Aucun GO Production donné** (handoff MISSION PATRIMOINE du 11/10/2026 : « GO pour corriger le défaut de continuité du stock FDJ en développement et en Test. Aucun GO Production »). Projet `uzhjpqpctpvxytxpxoqz`.

Les deux migrations forment un seul lot : 200000 sécurise la continuité, 220000 (decision-1 de l'arbitre, APPROVED_WITH_CONDITIONS) empêche qu'un quart soit validé avec une fin indéterminée. Leur ordre est imposé (§ Ordre global).

200000 appliquée sur Test le 11/10/2026 à 20:20:01Z (registre 318 → 319). Les md5 obtenus après application sont consignés dans `docs/recette/fdj-continuite-quantite-absente-zero-20261011.md`. En Production, le constat du geste 3 doit retrouver ces mêmes md5.

Fichier : `supabase/migrations/20261011200000_fdj_continuite_quantite_absente_zero.sql`. Le blob git est celui qu'enregistre `qualification-ordre-migration-code.json` (`mesure.blob_migration`) : un fichier ne peut pas nommer sa propre empreinte, et toute retouche de la migration fait tomber la qualification.

## Ce que la migration touche

md5 `pg_get_functiondef` servis en Production, mesurés le 11/10 à 20:56:10Z puis à 21:14:22Z (inchangés). Ce sont exactement les définitions servies sur Test avant application : le texte remplacé est donc celui que la recette a éprouvé.

| Objet | Nature | Origine du texte remplacé | md5 servi en Production |
|---|---|---|---|
| `fdj_stock_initial_herite(uuid, uuid)` | **créée** | — | absente |
| `fdj_completer_continuite_quart(uuid, text, uuid)` | **créée** | — | absente |
| `fdj_tracer_correction_stock_initial()` (fonction de déclencheur) | remplacée, déclencheur non recréé | `20260830222700` | `c2c4ca11ac2fc2344fc791f033f9e789` |
| `fdj_ecrire_saisies_caisse(uuid, text, uuid, jsonb, numeric, numeric)` | remplacée | `20260916220600` | `4fccfc9827ba46fd36ce0a1bd3f06cb9` |
| `fdj_valider_ouverture_quart(uuid, jsonb)` | remplacée | `20261010150000` | `9104e4ffc5409779291e02c63306478e` |
| `fdj_incrementer_appro_shift_count(text, uuid, uuid, numeric)` | remplacée | `20261010150000` | `d5da665129c1828fc840821d4f670068` |
| `fdj_confirmer_caisse(uuid, jsonb, numeric, numeric, numeric, numeric)` | remplacée | `20260916220600` | `ebe560a12a7ac29ba3a61804957d939e` |

Aucun DDL de table, aucune donnée réécrite par la migration elle-même. Les cinq remplacements gardent signature, type de retour, `security definer` et `search_path`.

ACL :
- **les deux fonctions créées** : EXECUTE à `service_role` seul (revoke `public`, `anon`, `authenticated`). Elles ne sont appelées que par des commandes SECURITY DEFINER ;
- **`fdj_ecrire_saisies_caisse`** : `{postgres, service_role}`, réaffirmée à l'identique (A6) ;
- **`fdj_confirmer_caisse`, `fdj_valider_ouverture_quart`, `fdj_incrementer_appro_shift_count`** : `{postgres, authenticated, service_role}`, réaffirmées à l'identique (A6) ;
- **`fdj_tracer_correction_stock_initial`** : ACL non touchée, `{=X, postgres, anon, authenticated, service_role}` préexistante. Une fonction de déclencheur ne peut pas être appelée directement.

Les contrôles d'accès des commandes appelantes sont inchangés (`fdj_quart_ouvert_de_l_employe`, `fdj_quart_de_l_employe`, `fdj_exiger_jeu_du_site`).

### Effets visibles côté serveur

- **Complétion.** Après leur propre écriture, `fdj_valider_ouverture_quart`, `fdj_incrementer_appro_shift_count` et `fdj_ecrire_saisies_caisse` posent le stock de départ hérité sur chaque jeu actif sans ligne et chaque ligne sans début, **d'un quart en brouillon seulement**. `stock_initial_auto = true`. Jamais une valeur saisie remplacée ; ni fin, ni appro, ni mouvement écrits.
- **`jeux_completes`.** `fdj_valider_ouverture_quart` le rend en plus dans son jsonb. L'écran servi l'ignore.
- **Journal.** `fdj_audit_log`, action `correction_stock_initial`, `metadata.source` (commande appelante), `complete_par`, `regle`, `quart_source`.
- **Cas « inconnu »** (fin absente alors qu'il restait du stock) : aucune valeur posée, alerte `continuite_stock_a_verifier` (une par quart et par jeu). Le relevé du quart devient `provisoire`. **0 cas en Production le 11/10.**
- **Refus `saisie_incomplete`.** `fdj_confirmer_caisse` refuse, avec la liste `jeux`, un jeu dont la fin manque alors que début + appro > 0. Message : « Rechargez l'écran de clôture : le stock de départ de ce jeu a été repris du quart précédent ; indiquez son stock final. » Une fin absente à stock nul passe : elle vaut 0.

## Ordre : migration d'abord, code ensuite

- **Migration d'abord** : l'écran servi continue de fonctionner, et c'est la base qui répare.
  - L'ancien écran envoie 28 jeux sans MISSION PATRIMOINE ; la base complète MP à 0, le quart compte 29 lignes et le relevé est définitif (recette S1/S1b).
  - Un jeu complété avec un stock positif apparaît au rechargement de l'ouverture ou de la clôture : les deux écrans relisent les lignes du quart (`NEXUS-FDJ-v1.html` l.1321-1322 et l.1922-1923). Le refus `saisie_incomplete` et son message sont donc cohérents avec l'écran servi.
  - Aucun cas Production actuel n'atteint ce refus : 0 « inconnu », et les 29 jeux actifs ont une ligne dans `539e87bc`.
- **Code d'abord** : l'écran du candidat hérite 0 d'une fin absente à stock nul et envoie MP. Rien ne casse, mais la base n'impose rien : une autre voie d'écriture, ou un écran mis en cache, reproduirait le défaut.

## Gestes (chacun sur GO distinct de Frédéric)

1. **Préflight en lecture seule** (`begin read only … rollback`), rejoué juste avant d'écrire. Toute valeur différente arrête la procédure.
   - registre = 308, dernière estampille `20261011090000`, `20261011200000` absente ;
   - `fdj_stock_initial_herite` et `fdj_completer_continuite_quart` absentes ;
   - les cinq md5 et les ACL du tableau ci-dessus ;
   - état des quarts `vito-sainte-marie` depuis le 10/10 : statut, nombre de lignes, ligne MP. Au 11/10 à 21:14:22Z : `84e16ef6` et `3f3900d5` `valide`, MP (0, 0, 0) ; `539e87bc` `valide`, 29 lignes, MP (0, 0, NULL) ; **Q2 du 11/10 non ouvert** ; 29 jeux actifs.
2. **Application Production**, par le connecteur `execute_sql` (jamais `apply_migration`, jamais `supabase db push`), en une transaction :
   - un bloc `DO` gardé : registre exact, version absente, deux fonctions absentes, cinq md5 attendus ; sinon `raise exception` ;
   - le texte du fichier ;
   - la ligne du registre `('20261011200000', 'fdj_continuite_quantite_absente_zero')`.
3. **Constat en lecture seule.**
   - Les sept md5 sont ceux de Test (recette, § md5) ;
   - ACL comme ci-dessus ; `security definer` et `search_path` inchangés ;
   - registre = 309, dernière `20261011200000` ;
   - aucune ligne `fdj_shift_counts` ni `fdj_audit_log` écrite par la migration elle-même.
4. **Fusion** de la PR vers `production`, puis **déploiement constaté** par le sha256 de `NEXUS-FDJ-v1.html` (lignes `<script src>` entières retirées, le build réécrivant `?v=`) et de `nexus-fdj-moteur.js` servis.
5. **Recette sur désignation**, ou constat passif au premier quart employé suivant :
   - le quart compte autant de lignes que de jeux actifs, MP compris, avec un stock de départ 0 ;
   - si l'écran servi est encore l'ancien : une ligne `correction_stock_initial` avec `metadata.regle = 'quantite_absente_zero'` et `quart_source = 539e87bc` ;
   - si le code est déployé : l'écran envoie MP lui-même, `jeux_completes` vaut 0 ;
   - la clôture produit un relevé définitif, sans « continuité à vérifier ».

## Retour arrière (GO distinct)

Une transaction :
1. `drop function public.fdj_completer_continuite_quart(uuid, text, uuid);`
2. `drop function public.fdj_stock_initial_herite(uuid, uuid);`
3. rétablir `fdj_confirmer_caisse` et `fdj_ecrire_saisies_caisse` depuis `20260916220600` ;
4. rétablir `fdj_valider_ouverture_quart` et `fdj_incrementer_appro_shift_count` depuis `20261010150000` ;
5. rétablir `fdj_tracer_correction_stock_initial` depuis `20260830222700` : l'ACL de la fonction de déclencheur est conservée, le déclencheur n'est pas recréé ;
6. réaffirmer les ACL A6 des quatre commandes ;
7. supprimer la ligne du registre ;
8. vérifier que les cinq md5 sont revenus aux valeurs du tableau.

Les lignes déjà écrites restent en place (historique immuable) : journal `correction_stock_initial`, alertes `continuite_stock_a_verifier`, débuts posés par la complétion. L'écran du candidat retombe alors dans le cas « code d'abord » ci-dessus.

## Impact sur les quarts existants

Mesuré en lecture seule le 11/10 à 21:04:53Z.

- `vito-sainte-marie` : 131 quarts, tous `valide`. **La migration ne touche jamais un quart validé** : ni nouvelle version de relevé, ni révocation de certification, ni recalcul financier.
- `site-fantome-test` : 3 brouillons, site créé par Frédéric pour ses tests. Ils seraient complétés à la prochaine écriture employé sur ces quarts, et seulement à ce moment.
- **7 fins absentes, toutes à stock nul** (règle `quantite_absente_zero`), **0 « inconnu »** :
  - MISSION PATRIMOINE sur `e5fdf558`, `c15dc945`, `d0697175`, `83134282`, `95d10337` : chaque quart suivant porte déjà une ligne MP ;
  - MISSION PATRIMOINE sur `539e87bc` : pas encore de quart suivant ; c'est lui que la complétion reprendra à 0 ;
  - PHARAONIS 3€ sur `8319de45` : le quart suivant `4fa6b5b0` n'a pas de ligne. Ce n'est pas le défaut : `4fa6b5b0` a été créé par le manager le 04/10 à 23:16:58Z, et la création manager envoie **tous** les jeux actifs, une fin NULL valant 0 (`NEXUS-FDJ-Manager-v1.html` l.1290, l.5277, l.6272-6273). PHARAONIS était donc déjà désactivé au chargement de cette page. La désactivation n'est pas journalisée. Effet nul : stock 0, aucun mouvement depuis le 25/09, inactif aujourd'hui.

Fenêtre d'exposition : tant que la migration n'est pas appliquée, chaque quart employé ouvert reproduit l'exclusion de MP. Effet caisse nul tant que le stock de MP vaut 0 ; réel s'il reçoit un approvisionnement avant le correctif.

## Régularisation de `539e87bc` (optionnelle, GO distinct)

**Non nécessaire au correctif** : l'héritage lit la fin absente comme 0 sans réécrire le quart validé. Si l'arbitre souhaite que la fin soit lisible sur le quart lui-même :
- correction manager de la fin MP à 0 sur `539e87bc` ;
- relevé v2 `regularisation_manager`, résultat financier inchangé (stock 0, appro 0, aucune vente).

## Points soumis à l'arbitre (200000) — tranchés par decision-1

Les points ci-dessous ont été tranchés par decision-1 et sont traités par 220000 :
- « inconnu » : la validation est refusée tant que la fin n'est ni saisie ni confirmée à 0 ;
- `fdj_manager_enregistrer_comptages` est gardée.

Texte d'origine :

- **« inconnu »** : la règle littérale dit « non renseigné = 0 ». Quand il restait du stock, poser 0 fabriquerait une vente ; la base pose NULL et lève une alerte. 0 cas en Production.
- **Création manager à 0** (`NEXUS-FDJ-Manager-v1.html` l.1290) : vaut 0 pour une fin NULL même quand il restait du stock, en divergence avec « inconnu ».
- **Détection d'écart manager** (l.1712) : ignore les fins NULL ; angle mort de détection, pas d'exclusion.
- **`fdj_manager_enregistrer_comptages`** non modifiée : elle continue de créer des fins NULL ; la base les lit désormais comme 0.

## 20261011220000 — stocks finaux confirmés avant clôture (decision-1)

**Statut : appliquée sur Test le 12/10/2026 (registre 319 → 320), non exécutée en Production, aucun GO.** Fichier : `supabase/migrations/20261011220000_fdj_confirmation_stocks_finaux.sql`. Son blob est enregistré dans la qualification (`20261011220000`, `etat` = `exige_code_d_abord`).

### Ce que la migration touche

| Objet | Nature | Texte remplacé | md5 servi en Production (12/10 03:58:32Z) | ACL Production |
|---|---|---|---|---|
| `fdj_stocks_finaux_a_confirmer(uuid, jsonb, boolean)` | **créée**, `stable` | — | absente | — |
| `fdj_poser_stocks_finaux_confirmes(uuid, jsonb, text, uuid, boolean, boolean)` | **créée** | — | absente | — |
| `fdj_exiger_stocks_finaux_determines(uuid, jsonb, text, uuid, boolean)` | **créée** | — | absente | — |
| `fdj_confirmer_caisse` | remplacée | `20261011200000` (absente en Production avant 200000) | `ebe560a12a7ac29ba3a61804957d939e` | `{postgres=X,authenticated=X,service_role=X}` |
| `fdj_corriger_caisse_confirmee` | remplacée | `20260916220600` | `cd097747679824e418fb0f8ecc8150da` | idem |
| `fdj_manager_creer_quart` | remplacée | `20261010150000` | `e668aa912e292f0428eb8688431150c2` | idem |
| `fdj_manager_modifier_quart` | remplacée | `20261010170000` | `c19f7b24bae242456f50a002ef980d22` | idem |
| `fdj_manager_changer_statut_quart` | remplacée | `20261010150000` | `86be1550d7b98b1d6448e4c53b2204aa` | idem |
| `fdj_manager_enregistrer_comptages` | remplacée | `20261010150000` | `92bcd8aaaa5814272dc9e63dee616074` | idem |

Le md5 de `fdj_confirmer_caisse` relevé ici est celui d'avant 200000. Le préflight de 220000 doit le comparer au md5 servi **après** 200000, c'est-à-dire au md5 Test d'avant 220000.

Les trois aides sont réservées à `service_role` : `authenticated` et `anon` sont refusés (42501, recette C11). Les ACL des six commandes sont réaffirmées à l'identique (A6).

md5 servis sur Test après application (12/10) ; le constat Production doit retrouver les mêmes :

| Fonction | md5 Test |
|---|---|
| `fdj_stocks_finaux_a_confirmer` | `2f04e3d19d9e73e8cc4496a808d13661` |
| `fdj_poser_stocks_finaux_confirmes` | `65553ae634724f88df4c27313c7c9dad` |
| `fdj_exiger_stocks_finaux_determines` | `281c7ae368b7a5cfc2a4096e2037e7fb` |
| `fdj_confirmer_caisse` | `70d6a4edf3a1c0de5c7f49dec1ae16ef` |
| `fdj_corriger_caisse_confirmee` | `7057bac5a4c07deb207c806456cb81f7` |
| `fdj_manager_creer_quart` | `8a71c6475363eb09dbfa680086b864ab` |
| `fdj_manager_modifier_quart` | `ffaf90e11869867028241c961e1a63a4` |
| `fdj_manager_changer_statut_quart` | `f893d77b2b5d2d462d1aa912c8bb973e` |
| `fdj_manager_enregistrer_comptages` | `cb05426296f01526f7cf20be295e6876` |

### Pourquoi le code d'abord

- L'écran manager servi passe un quart à `valide` **avant** d'écrire ses comptages. Avec 220000 en place, cette étape est refusée (23514) dès qu'une fin est vide (recette M5).
- L'écran employé servi ne connaît pas le motif `stocks_finaux_a_confirmer` : il afficherait le message, sans proposer le choix « Confirmer 0 / Corriger la saisie ».
- Le code du candidat fonctionne sur une base sans 220000 :
  - le marqueur `stock_final_confirme_zero` est ignoré, et la ligne complète porte déjà `stock_final` 0 ;
  - le contrôle se fait côté client avant l'envoi (recette M4).

### Ordre global (chaque geste sur GO distinct de Frédéric)

1. **200000** : gestes 1 à 3 ci-dessus (préflight 308, application, constat 309).
2. **Fusion et déploiement du code** : geste 4 ci-dessus, avec en plus le sha256 de `NEXUS-FDJ-Manager-v1.html` servi.
3. **220000 — préflight en lecture seule** :
   - registre = 309, dernière `20261011200000`, `20261011220000` absente ;
   - les trois aides absentes ;
   - md5 et ACL des six commandes égaux aux valeurs servies sur Test avant 220000 : celles du tableau ci-dessus, et pour `fdj_confirmer_caisse` celle que 200000 a posée ;
   - **code servi constaté** (étape 2) ; sinon, arrêt.
4. **220000 — application** : connecteur `execute_sql`, une transaction, avec un bloc `DO` gardé (registre, absence, md5), le texte du fichier et la ligne de registre `('20261011220000', 'fdj_confirmation_stocks_finaux')`.
5. **220000 — constat en lecture seule** : les neuf md5 Test ci-dessus, les ACL, registre = 310, aucune ligne `fdj_shift_counts` ni `fdj_audit_log` écrite par la migration.
6. **Recette sur désignation**, ou constat passif au premier quart suivant. Une clôture avec une fin vide et du stock disponible doit présenter la fenêtre « Confirmer 0 / Corriger la saisie ». Une fin vide à stock nul doit devenir 0, avec une trace `stock_final_zero_automatique`.

### Retour arrière 220000 (GO distinct)

C'est celui de l'en-tête de la migration :
1. rétablir les six commandes depuis leurs migrations d'origine (`fdj_confirmer_caisse` ← 200000) et leurs commentaires ;
2. supprimer `fdj_exiger_stocks_finaux_determines`, `fdj_poser_stocks_finaux_confirmes` puis `fdj_stocks_finaux_a_confirmer` ;
3. supprimer la ligne du registre ;
4. vérifier les md5.

Les fins posées à 0 et les traces écrites entre-temps restent (historique immuable). Le code du candidat continue de fonctionner sans 220000.

### Impact sur les quarts existants

La migration ne fait que (re)définir des fonctions : aucune donnée existante n'est réécrite. Les gardes ne jouent qu'au **passage** à `valide`, ou lors d'une régularisation de comptages d'un quart validé, et seulement sur les jeux envoyés. Un quart validé ne bouge pas tant que personne ne l'écrit. Les transitions `valide → valide` et `valide → brouillon` ne sont pas gardées.

## Limites hors lot

- Un début NULL avec une fin saisie reçoit un début hérité.
- Le PDF affiche « Continuité vérifiée » sans comparer le nombre de lignes au nombre de jeux actifs.
- `shift_precedent_id` est approximatif ; l'écran ne remonte qu'un quart, la base jusqu'au dernier quart validé portant une ligne.
- L'ACL de `fdj_alertes` est ouverte.
- La désactivation d'un jeu n'est pas journalisée.
