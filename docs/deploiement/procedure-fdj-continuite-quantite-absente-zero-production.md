# Procédure — 20261011200000, continuité FDJ : quantité absente traitée comme 0 (Production)

**Statut : non exécutée en Production. Aucun GO Production donné** (handoff MISSION PATRIMOINE du 11/10/2026 : « GO pour corriger le défaut de continuité du stock FDJ en développement et en Test. Aucun GO Production »). Projet `uzhjpqpctpvxytxpxoqz`.

Appliquée sur Test le 11/10/2026 à 20:20:01Z (registre 318 → 319). Les md5 obtenus après application sont consignés dans `docs/recette/fdj-continuite-quantite-absente-zero-20261011.md`. En Production, le constat du geste 3 doit retrouver ces mêmes md5.

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

## Points soumis à l'arbitre

- **« inconnu »** : la règle littérale dit « non renseigné = 0 ». Quand il restait du stock, poser 0 fabriquerait une vente ; la base pose NULL et lève une alerte. 0 cas en Production.
- **Création manager à 0** (`NEXUS-FDJ-Manager-v1.html` l.1290) : vaut 0 pour une fin NULL même quand il restait du stock, en divergence avec « inconnu ».
- **Détection d'écart manager** (l.1712) : ignore les fins NULL ; angle mort de détection, pas d'exclusion.
- **`fdj_manager_enregistrer_comptages`** non modifiée : elle continue de créer des fins NULL ; la base les lit désormais comme 0.

## Limites hors lot

- Un début NULL avec une fin saisie reçoit un début hérité.
- Le PDF affiche « Continuité vérifiée » sans comparer le nombre de lignes au nombre de jeux actifs.
- `shift_precedent_id` est approximatif ; l'écran ne remonte qu'un quart, la base jusqu'au dernier quart validé portant une ligne.
- L'ACL de `fdj_alertes` est ouverte.
- La désactivation d'un jeu n'est pas journalisée.
