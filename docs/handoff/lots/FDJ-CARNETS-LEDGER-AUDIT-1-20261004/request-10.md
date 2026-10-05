---
protocol: nexus-handoff/2
kind: request
lot_id: FDJ-CARNETS-LEDGER-AUDIT-1-20261004
seq: 10
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: decision-9-consommee
    classe: VERIFIED
    valeur: depot-77527a6-consommation-b68b25d-miroir-27cc897
  - id: base-production-inchangee
    classe: VERIFIED
    valeur: production-30544c9-avant-et-apres-push
  - id: branche-poussee
    classe: VERIFIED
    valeur: claude-fdj-verite-canonique-20261005-3822649-sans-force
  - id: epreuve-conteneur-jetable
    classe: VERIFIED
    valeur: 291-migrations-scenarios-A-G-M-R-ACL-verts-contre-temoin-9-echecs-relecture-moteur-16-16-temoin-mute-9-16
  - id: tests-node-nouveaux
    classe: VERIFIED
    valeur: reconciliation-22-0-ledger-correction-2-2-plus-mutant-idempotence-matrice-46-0
  - id: run-tests-sans-regression
    classe: VERIFIED
    valeur: 238-245-memes-7-echecs-que-production-235-242
  - id: ci-branche
    classe: VERIFIED
    valeur: run-37323834704-non-regression-success-14-14-sur-3822649
  - id: qualification-nexus-test
    classe: NOT_APPLICABLE
    valeur: migration-non-appliquee-sur-test-geste-soumis-a-GO
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-ecriture-aucun-merge-aucune-migration-aucun-deploiement
---
# request-10 — réconciliation canonique FDJ : correctif local fait et éprouvé, branche poussée à 3822649 ; GO séparés demandés

Réponse à `decision-9.md` (`APPROVED_WITH_CONDITIONS`, `closes: false`, en
réponse à `request-9.md`).

## 0. Autorisations consommées

- `decision-9.md` (77527a6) : GO de Frédéric Bragance, en session le 05/10/2026,
  « GO étendre le lot, fais le correctif local et les tests ». Elle a été consommée sur le
  rail (b68b25d), et le miroir a été régénéré (27cc897).
- GO suivant, en session le 05/10/2026 :
  « GO pousse la branche et dépose request-10 ». Il est consommé par ce dépôt.

## 1. Désignation exacte

| | |
|---|---|
| Branche | `claude/fdj-verite-canonique-20261005` |
| **SHA candidat** | **`38226495194001b3baa4624d43ec85a9f096d1df`** |
| Base | `production` = `30544c9af7ebf83d8ec1ba3882418252380036f1` (inchangée au push) |
| Commits | `9bfee5a` (correctif + tests + épreuve), `3822649` (re-mesure d'empreinte, §6) |
| Diff contre la base | 21 fichiers, +2706/−53 |
| Migration nouvelle | `supabase/migrations/20261005090000_fdj_reconciliation_canonique_caisse.sql` (fichier seulement) |

**Le SHA a bougé après le premier push**, et l'écart est déclaré. Le push de
`9bfee5a` a rougi la CI de branche (§6). La correction est un second commit
séparé, poussé sans force. Seul `3822649` est le candidat : un GO
rendu sur `9bfee5a` ne vaudrait pas.

Aucune PR n'est ouverte.

## 2. Cause, rappel du constat

En Production, une activation de carnet n'écrit qu'un mouvement caisse→caisse.
Le bureau→caisse n'est écrit que si quelqu'un a saisi un transfert de réappro
avant. Quand ce transfert manque, le moteur calcule une caisse non activée
**négative**. C'est ce qui arrive quand Loane active au quart 1 sans réappro
saisi, ou quand le Manager reconstitue une activation en complétant la caisse
journalière. On mesure alors −1 sur MAXI GOAL 3€, MEGA GOAL 10€ et
MILLIONNAIRE 10€, et un bureau surévalué d'autant. Le carnet est pourtant
physiquement sorti du bureau, mais le ledger ne le dit nulle part.

## 3. Le correctif

### 3.1 Serveur : une seule source

Nouveau helper `fdj_reconcilier_caisse_jeu(p_declencheur)` :

- `security definer`, `search_path` vide ;
- EXECUTE réservé à `service_role` : grants nommés, fermé à `anon` et à
  `authenticated`.

Il est appelé par `fdj_activer_carnet` et `fdj_enregistrer_mouvement_stock`,
après un insert réussi (jamais sur un rejeu). Ces deux RPC sont redéfinies **à
signature et retour identiques**, avec en plus une clé de retour `reconciliation`.

Le helper recalcule les soldes du jeu depuis la dernière référence. Il
applique exactement les règles de `soldesCarnetsAvecReference` du moteur, en
datant chaque mouvement par `coalesce(effective_at, created_at)` :

| Situation | Effet |
|---|---|
| Caisse non activée < 0 et bureau > 0 | Transfert bureau→caisse **automatique** : `source = 'reconciliation_automatique'`, clé d'idempotence dérivée du déclencheur, justification qui le cite, ligne `fdj_audit_log` |
| Déficit que le bureau ne couvre pas | **Ambiguïté explicite**, sans transfert inventé : alerte `activation_sans_carnet_confie` (motif `reconciliation_bureau_insuffisant`) si un quart est connu, sinon audit `fdj_reconciliation_ambigue` |
| Caisse non activée ≥ 0 | Les alertes ouvertes de ce type sur le jeu passent à `resolue_automatiquement` + `resolue_le`. Jamais à `vue` : l'examen humain reste un geste distinct |
| Correction négative (annulation d'activation) | Retour caisse→bureau, **borné par le net automatique** déjà écrit pour ce jeu. Un réappro manuel reste en caisse |

Un verrou transactionnel par (site, jeu) sérialise deux réconciliations
concurrentes.

L'alerte d'exception déclarée par l'employé (`p_motif`) est désormais écrite
**par la RPC**, dans la même transaction que le mouvement. L'écran ne l'insère
plus.

### 3.2 Écrans

| Fichier | Changement |
|---|---|
| `NEXUS-FDJ-v1.html` (Employé) | Inserts d'alerte retirés. Jeton d'activation stable par jeu (`jetonsActivationCarnet`, `jetonsActivationImplicite`) : supprimé au succès, conservé à l'erreur, pour qu'un nouvel essai soit un rejeu et non un doublon |
| `NEXUS-FDJ-Manager-v1.html`, `nexus-app-donnees.js`, `nexus-desktop.js` | Les compteurs d'alertes excluent `vue` **et** `resolue_automatiquement` |
| `nexus-brief-donnees.js`, `nexus-coach-fdj-donnees.js` | Lisent `effective_at` |
| `nexus-fdj-moteur.js` | La correction est imputée aux actives (bug du ledger-correction, request-8). `instantEffetMouvement` est exporté et sert au seuil de référence et à la vélocité |

Manager et Employé lisent le **même moteur**, et le serveur en applique les
mêmes règles. La relecture croisée (§4) le prouve sur le ledger réellement
produit par le serveur.

### 3.3 Ce qui n'est pas fait (périmètre de decision-9 non couvert)

- **« Vérifié » à trois états** (détectée / examinée / résolue) : seule la
  séparation `vue` ≠ `resolue_automatiquement` est en place. Le panneau à trois
  états n'est pas construit.
- Pas de renommage des libellés.
- Aucune réparation de données. Les −1 actuels seront absorbés par le point
  zéro.

## 4. Preuves

### 4.1 Épreuve en conteneur jetable

`outils/epreuve-fdj-reconciliation-canonique-20261005/executer.sh` tourne sur
une image `supabase/postgres:17.6.1.175`, dans un conteneur supprimé à la
sortie. Aucune URL distante n'est lue. Sortie 0, « ÉPREUVE VERTE », environ
33 s. Étapes :

1. Les **291 migrations** du dépôt sont appliquées.
2. **Scénarios verts** :
   - A : réappro tracé puis activation, sans mouvement automatique ;
   - B1, B2 : activation sans réappro ; livraison après activation ;
   - C : le Manager reconstitue sur le quart de Loane, puis rapproche hors quart ;
   - D1–D3 : annulation, retour borné, correction rejouée ;
   - E : idempotence Employé/Manager, et même jeton avec un autre auteur ;
   - F1–F3 : ambiguïté, sans alerte en double ni orpheline ;
   - M, M2 : motif déclaré, alerte unique ; motif résolu dans la transaction ;
   - G : multi-interface sur trois quarts, refus d'activer sur le quart d'autrui
     et refus de reconstitution par un employé ;
   - R : rétroactivité selon `effective_at` ;
   - 2 contrôles d'ACL : helper fermé à `authenticated`, réconciliation faite
     sous `authenticated` via la RPC.
3. **Contre-témoin** : avec le helper neutralisé, exactement **9** blocs
   rougissent (`ERROR:  ÉCHEC`), ce qui est exigé.
4. **Relecture croisée** : le ledger produit par le serveur, relu par
   `nexus-fdj-moteur.js`, donne **16/16**. Avec un ledger muté, le témoin lit
   16 lignes et donne **9/16**.

**Faux vert attrapé en cours de route.** Le témoin muté rendait d'abord 0/0 :
la sortie psql était alignée, avec un espace en tête de ligne. `0/0` sort en
code 1, et le script comptait cet échec comme le « rouge attendu ». C'est
corrigé : `\pset` non aligné, et le témoin doit avoir lu 16 lignes **et** ne
pas être à 16/16.

### 4.2 Tests node

- `test_fdj_reconciliation_canonique_20261005.js` : 22 réussites, 0 échec.
- `test_fdj_ledger_correction_20261004.js` : 2/2, et le mutant (moteur de
  `production`) rougit.
- `test_fdj_idempotence_matrice_20261004.js` : 46/0.

### 4.3 `run-tests.js`

- Candidat : 238/245.
- `production` 30544c9 : 235/242.
- Les **7 mêmes échecs** des deux côtés, tous préexistants et étrangers au FDJ :
  - `inventaire_categorie_mixte_deux_lieux`
  - `inventaire_production_journaliere_q1`
  - `inventaire_sprint4_ux_flash`
  - `inventaire_sprint4bis_ecriture_immediate`
  - `pilotage_qualite_receptions`
  - `reception_moteur`
  - `reception_v1_dom`
- Les 3 nouveaux tests sont verts.

Un rouge nouveau est apparu en cours de lot, et il a été **corrigé, pas
reclassé**. `test_fdj_fiabilisation_etape5_idempotence.js` extrait les fonctions
de l'écran sans l'état du module, d'où « jetonsActivationCarnet is not
defined ». Le harnais déclare désormais cette variable : une ligne, commentée.

## 5. Impact données à l'application

- Aucun mouvement passé n'est réécrit ni complété.
- **Effet de bord déclaré** : au premier mouvement d'un jeu après application,
  une alerte `activation_sans_carnet_confie` encore ouverte sur ce jeu est
  résolue automatiquement si le solde recalculé est ≥ 0. C'est la doctrine de
  20260815213225 appliquée, pas une purge. `vue` reste à false.
- **Ordre de déploiement : migration d'abord, front ensuite.** Avec l'ancien
  front et la nouvelle migration, l'alerte de motif est écrite deux fois
  (serveur et client) pendant la fenêtre. C'est transitoire et sans effet sur
  les soldes.
- **Retour arrière** :
  1. réappliquer les définitions de `20260916221000` §3 et §4 (les signatures
     sont identiques) ;
  2. `drop function public.fdj_reconcilier_caisse_jeu(uuid)`.

  Les transferts automatiques déjà écrits restent : ce sont des faits tracés.

## 6. CI de la branche

- **Run 37323435435 sur `9bfee5a` : échec.** L'étape « Infrastructure — empreinte
  de l'artefact » donne 31/32 : le cas réel annonçait 290 migrations, mesuré
  291. C'est le point de conflit **programmé** de cette épreuve, puisque tout
  ajout de migration rend ses deux constantes fausses. Les étapes suivantes
  étaient donc `skipped`.
- **Correction `3822649`**, commit séparé. Les constantes sont re-mesurées à
  **291 / `8d1c4690…fee3fe`**, par trois chemins concordants :
  - la mesure de la CI elle-même ;
  - `empreinte-artefact.js --arbre-source=.` ;
  - un recalcul indépendant depuis les blobs git de `9bfee5a`.

  Le journal d'arithmétique est complété. L'épreuve passe 32/32 en local.
- **Run 37323834704 sur `3822649` : `success`.** Job `non-regression`, 14 étapes
  sur 14 en `success`, aucune `skipped`.
- **Ce que cette CI ne couvre pas.** Sur une branche `claude/*`, les étapes
  réservées au rail (Postgres Test, recette navigateur) sont absentes, pas
  sautées. Le second check requis par le ruleset, « Construire et éprouver
  l'artefact », ne tourne que sur une PR, et aucune n'est ouverte.

## 7. Recette restante

1. Migration appliquée sur **Test**, puis rejeu des scénarios B, C et M au
   navigateur : Employé, et Manager qui complète la caisse journalière.
2. Après la migration Production, vérifier que les −1 actuels ne bougent pas
   (aucune réparation) jusqu'au premier mouvement du jeu ou au point zéro.

## 8. Demande : quatre GO séparés, au SHA `3822649`

Chacun est indépendant. Si le SHA bouge, le GO tombe.

1. **GO migration Test** : appliquer `20261005090000` sur Supabase Test.
   L'outillage CI ne le peut pas (`nexus_ci_recette` n'a pas les droits, et ils
   ne seront pas élargis). La voie reste à désigner.
2. **GO migration Production** : appliquer `20261005090000` en Production, par
   le connecteur, **avant** le front.
3. **GO fusion** : ouvrir une PR `claude/fdj-verite-canonique-20261005` →
   `production`, puis la fusionner une fois les deux checks requis verts.
4. **GO déploiement** : gate Pages, puis contrôle du contenu servi par sha256.
   Le statut 200 seul ne suffit pas.

Ordre recommandé : 1 → recette Test → 2 → 3 → 4.

**STOP. Aucun autre geste avant arbitrage.**
