# Dossier de promotion Production — heures, renfort Q1 et réconciliation Verify / Paye

| | |
|---|---|
| Branche | `fast-track-heures-renfort-20261012` (tête `6ee1816`), 13 commits au-dessus du rail `7978abb` |
| Cible | Production `uzhjpqpctpvxytxpxoqz` + GitHub Pages (`production`) |
| Date | 13/10/2026 |
| Verdict demandé | **aucun** : ce dossier prépare, il n'autorise rien. Aucun GO Production n'est implicite. |
| État de Production | inchangé par ce lot — migration, code et données |

## 1. Ce que le lot change

- **Verify** : la colonne RENFORT du classeur est lue à l'import (Q1 retenu, Q2 « vérrouillée » ignoré, jamais de salarié créé, nom inconnu → « introuvable, à déclarer à la main »). Un renfort Q1 qui tient aussi un poste le même jour est signalé à la synchronisation et compté une seule fois, en poste.
- **Paye** : le renfort Q1 vaut 7 h normales (9 h–17 h, pause 1 h), sans heure sup automatique. Jeudi→samedi : 7 h + 1 h sup ; dimanche→mercredi : 7 h. Les heures sup sont visibles (cockpit, fiche, dossier comptable, export). Le renfort n'est effectif qu'à partir de `renfort_effectif_depuis` = 01/10/2026 (défaut, surchargeable par site). Caisse/piste confirmée dans Verify prime sur le renfort, jamais de cumul. Durée > 12 h et sources contradictoires signalées, sans plafond ni retenue.
- **Aucun taux, aucune majoration inventés. Aucune retenue automatique.**

## 2. Ce qui est à poser en Production

### 2.1 Migration unique — `20261009120000_nexus_paye_items_types_heures_verify.sql`

Additive, rejouable (`if not exists`, `drop constraint if exists`), aucune donnée supprimée :

1. `audits_caisse.employes_renfort jsonb` ;
2. `nexus_paye_items.detail jsonb` ;
3. CHECK `statut` élargi : `a_verifier, valide, exclu` + `examine, corrige, justifie` ;
4. CHECK `type_item` élargi : les 14 valeurs actuelles + `ecart_verify_planning`, `horaire_exceptionnel`.

Mesuré en Production le 13/10/2026 (lecture seule, `begin read only … rollback`) :

| Mesure | Valeur |
|---|---|
| `audits_caisse.employes_renfort` | absente (0) |
| `nexus_paye_items.detail` | absente (0) |
| lignes de `nexus_paye_items` | 10 |
| lignes dont le statut sortirait de la nouvelle liste | 0 |
| lignes dont le type sortirait de la nouvelle liste | 0 |
| contraintes CHECK actuelles | `statut` à 3 valeurs, `type_item` à 14 valeurs : les nouvelles sont des sur-ensembles |
| migrations appliquées / dernière | 310 / `20261011220000` |

Conclusion : la migration est applicable sans réécriture ni rejet de ligne existante. Le manifeste la classe encore **EXCLUE** (« appliquée nulle part ») : il devra être mis à jour après décision, pas avant.

Écart d'estampille : le fichier porte `20261009120000`, inférieure à la dernière version de Production. L'estampille réellement posée sera celle du connecteur (Test : `20261013132532`). La garde d'ordre de migration et le tableau des « migrations sans fichier » devront le constater, comme pour les lots précédents.

### 2.2 Réglage

Aucune ligne `station_config` à écrire : `renfort_effectif_depuis` vaut 01/10/2026 par défaut dans le moteur.

### 2.3 Code

Fichiers touchés : `NEXUS-Verify-v1.html`, `NEXUS-Paye-v1.html`, `NEXUS-Parametres-Station-v1.html`, `nexus-verify-moteur.js`, `nexus-paye-moteur.js`, `nexus-paye-donnees.js`, `nexus-paye-dossier-pdf.js`, plus tests et `simulations/executer-paye.js`.

## 3. Ordre de pose et compatibilité

1. **Migration d'abord, code ensuite.** Verify sonde `employes_renfort` (bloc masqué si absente) et Paye sonde `detail`, donc le nouveau code ne casse pas sur l'ancien schéma, mais il ne servirait à rien : il lirait « renfort indisponible ». L'ancien code sur le nouveau schéma est sans effet (colonnes nullables, contraintes élargies).
2. Aucune étape ne demande le code avant la migration (contrairement à `login_non_enumerable`).
3. Une fois la colonne posée, le renfort déjà noté dans le classeur avant la pose n'est pas rétro-importé : Paye ignore tout ce qui précède le 01/10/2026 et rien d'antérieur n'est recalculé. L'historique avant octobre est préservé.

## 4. Obstacle principal : le véhicule de code

La branche est bâtie sur le **rail** (`7978abb`), pas sur `production`. Mesures du 13/10/2026 :

- `origin/production` est à 264 commits du rail ; la fusion de la branche dans `production` produit des conflits d'ajout/ajout sur de nombreux `test_*.js`.
- Les fichiers du lot ont **aussi** bougé côté Production depuis la base (règles SMU #95, FDJ #98/#101/#102…) : `NEXUS-Paye-v1.html` +620/−70, `NEXUS-Parametres-Station-v1.html` +838/−202, `nexus-verify-moteur.js` +334/−3, `nexus-paye-moteur.js` +139/−39.
- Essai à blanc (clone jetable, supprimé) : en rejouant les 13 commits un par un sur `origin/production`, 12 sur 13 conflictent, un seul passe sans conflit (`0ec34f2`). Les conflits portent sur les deux moteurs et les trois écrans.

Donc : **ni PR directe vers `production`, ni cherry-pick mécanique.** Le véhicule sera une branche de portage partie de `origin/production` (jamais d'une branche locale), réécrite à la main sur les fichiers ci-dessus, puis passée dans la suite complète. Chaque PR de ce type a jusqu'ici été une PR distincte (#95 pour les règles SMU).

## 5. Preuves disponibles

- Test (`udljdqxerrbbbajxubfn`, migration appliquée hors bande) : renfort Test B du 08/10 = 7 h sans heure sup ; Test A piste + renfort du 09/10 compté une fois ; import classeur rejoué le 13/10 sur le 01/10 Q1 (variante réelle → « introuvable » ; variante mappée → renfort coché, 7 h).
- Épreuves du dépôt : `test_verify_import_renfort_q1_20261012.js`, `test_verify_renfort_declaration_20261009.js`, `test_nexus_paye_renfort_effectif_20261013.js`, `test_nexus_paye_ruddy_renfort_q1_piste_q2_20261013.js`, `test_nexus_paye_reconciliation_verify_paye_20261013.js`, `test_nexus_paye_heures_supplementaires_cockpit_20261012.js`, `test_nexus_paye_donnees_renfort_20261009.js`.
- **CI** : non observée à la rédaction de ce dossier ; elle tournera sur la PR vers le rail. Deux épreuves de manifeste de migrations rougissent pour une cause connue (ajouter une migration) et attendent un addendum Handoff — elles ne sont pas reclassées en dette.
- **Limite connue** : Test a 11 migrations hors bande ; la recette Test ne prouve pas à elle seule l'état de Production, d'où les mesures du §2.1.

## 6. Plan de retour arrière

La migration étant additive, le retour arrière **ne supprime rien par défaut**.

| Niveau | Geste | Effet | Condition |
|---|---|---|---|
| R1 — code | rétablir le fichier précédent de chaque page sur `production` (revert de la PR de portage) | Verify / Paye reviennent à l'ancien comportement ; les colonnes restent, inertes | aucune donnée perdue |
| R2 — contraintes | rétablir les anciens CHECK `statut` (3 valeurs) et `type_item` (14 valeurs) | refuse de nouveau les 5 valeurs ajoutées | **seulement si aucune ligne n'en porte** ; sinon d'abord les requalifier — décision humaine |
| R3 — colonnes | `drop column employes_renfort` / `detail` | efface les renforts et détails saisis | **déconseillé** : destructif ; jamais sans accord distinct et sauvegarde des valeurs |

Mesure préalable à tout R2/R3 : compter les lignes concernées (`statut in ('examine','corrige','justifie')`, `type_item in ('ecart_verify_planning','horaire_exceptionnel')`, `employes_renfort is not null`, `detail is not null`). Aujourd'hui toutes sont à 0 en Production.

Le retour arrière lui-même est une écriture Production : il demande son propre GO et son propre verdict, comme la pose.

## 7. Décisions qui restent ouvertes — non tranchées ici

- **Q4** — case vide au planning : ni absence ni déduction aujourd'hui ; la règle de fond reste à arbitrer.
- **B** — heures exceptionnelles : colonne de provenance ou ligne distincte.
- Ces deux points partent au Handoff sans recommandation fermée de ma part.

## 8. Gestes humains / Handoff requis avant Production

1. Verdict Handoff sur la migration (GO nommé, SHA et empreinte du blob cités).
2. Addendum Handoff pour les deux épreuves de manifeste de migrations.
3. Arbitrage du véhicule de portage (§4) et revue de la branche de portage.
4. GO distinct pour : (a) application de la migration, (b) fusion de la PR de portage, (c) déploiement Pages.
5. Après (a)–(c) : recette sur l'URL servie, en comparant le contenu servi et non seulement le code HTTP, puis mesure SQL de Production.

Rien de ce qui précède n'a été exécuté.
