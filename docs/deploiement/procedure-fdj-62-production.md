# Procédure Production — candidat FDJ `rebuild/fdj-62-20260922`

Rédigée le 04/10/2026 sous decision-5 (option A), lot FDJ-VAGUE1-REPRISE-20261003.
**Ce document n'autorise rien.** Il décrit quatre gestes. Chacun exige son propre
GO de Frédéric, et ces GO ne se transmettent pas d'un geste à l'autre. Si le SHA du
candidat bouge, toute autorisation déjà donnée tombe.

| Ordre | Geste | GO exigé |
|---|---|---|
| 1 | Appliquer en Production les 12 migrations `20260916220000` → `20260916221100` | GO migration |
| 2 | Fusionner la PR du candidat dans `production` (avance rapide, 33 commits) | GO fusion |
| 3 | Déployer `production` sur GitHub Pages (gate humaine du workflow) | GO déploiement |
| 4 | Appliquer `20261004120000` (fermeture de l'ancienne correction employé) | GO 120000 |

Cet ordre n'est pas négociable. Le §4 explique pourquoi.

## 1. Pourquoi cet ordre

- **Les migrations passent avant le code (geste 1 avant 2-3).** L'écran du candidat
  appelle les 36 fonctions créées par les 12 migrations. Aucune n'existe en
  Production (mesure du §2). Si l'écran est déployé avant elles, la caisse FDJ
  tombe en panne.
- **Les 12 migrations n'altèrent pas l'écran servi.** Elles ne retirent aucun droit
  sur une table ni sur une fonction existante. Les cinq fonctions qu'elles
  ferment à `authenticated`, ci-dessous, sont des fonctions neuves qu'elles
  créent elles-mêmes :
  - `fdj_calculer_caisse` ;
  - `fdj_chaine_continuite` ;
  - `fdj_ecrire_saisies_caisse` ;
  - `fdj_emplacement_du_site` ;
  - `fdj_cle_idempotence`.

  Aucune de ces cinq n'existe en Production, et `git grep` sur
  `origin/production` (2f27e5c) ne les trouve que dans le Data Dictionary.
  La contrainte de statut est élargie, jamais restreinte. Elle passe de 8 à
  10 valeurs, avec l'ajout de `brouillon` et `confirmee` : les écritures de
  l'ancien écran restent donc valides. L'écran servi continue de fonctionner
  entre les gestes 1 et 3.
- **`120000` passe en dernier, après le code (geste 4 après 3).** L'écran servi
  appelle `fdj_corriger_caisse_employe` (`NEXUS-FDJ-v1.html:878` sur 2f27e5c).
  Révoquer `authenticated` avant le déploiement casserait le bouton « Corriger et
  inscrire sur mon relevé ».
  - **Correction d'un commentaire.** Le commentaire de la migration affirme
    « Aucun écran ne l'appelle ». C'est vrai du candidat, faux de l'écran servi.
    Le fichier n'est pas modifié, car le retoucher ferait tomber sa
    qualification.
  - **Délai à respecter.** Entre les gestes 3 et 4, attendre qu'aucun onglet
    ne serve plus l'ancien écran : un onglet non rechargé n'envoie rien.
    Constater d'abord que l'URL servie porte le nouveau contenu (sha256).

## 2. Ce qui a été mesuré (lecture seule, 04/10/2026)

**Lecture 1**
- Rôle : `nexus_prod_readonly_login`.
- Conditions : `begin read only`, moteur 17.6, horodatage 10:39:58 UTC.

**Lecture 2**
- Outil : connecteur Supabase, sous `begin read only` (rôle constaté :
  `postgres`, `transaction_read_only = on`).
- Horodatage : 10:44:04 UTC.

**Résultats**
- **Fonctions.** Aucune des 36 fonctions créées n'existe.
- **Tables.** `fdj_caisse_evenements` et `fdj_demandes_correction` sont absentes.
- **Trigger.** `fdj_caisse_evenements_pas_de_modification` est absent.
- **Index.** Aucun des 15 noms d'index créés n'existe.
- **Colonnes.** Aucune des colonnes ajoutées n'existe sur `fdj_shifts`,
  `fdj_cash_controls` ou `fdj_stock_movements`. `fdj_shifts.version` existe, mais
  aucune migration ne l'ajoute : `version` est ajoutée à `fdj_cash_controls`.
- **Contrainte de statut.**
  - `fdj_cash_controls_statut_check` est validée sur 8 valeurs.
  - Les 113 lignes existantes ne portent que 4 de ces valeurs :
    `a_regulariser`, `conforme`, `regularise` et `valide_avec_ecart`.
  - 220100 la recrée VALIDÉE sur un sur-ensemble : la revalidation passera.
- **Index d'idempotence.**
  - `fdj_stock_movements_idempotency_key_uniq` existe déjà (unique, partiel).
  - Le bloc conditionnel de 220400 constatera qu'un index unique couvre déjà la
    colonne et ne créera rien. Aucun risque de doublon.
- **Colonnes NOT NULL.** Les deux colonnes NOT NULL ajoutées (`version`,
  `nb_corrections`) ont un défaut. `fdj_cash_controls_version_check` est NOT VALID
  et satisfaite par les défauts (1 = 0 + 1).
- **Triggers existants.**
  - Deux triggers existent sur `fdj_cash_controls` : `proteger_origine` et
    `sync_releve_apres_cash_control`.
  - Aucune migration n'écrit de ligne au moment où on l'applique : tous les
    `insert`/`update` sont dans des corps de fonction. Les triggers ne se
    déclenchent donc pas.
- **Registre.** Les 13 estampilles sont absentes de `list_migrations`. La
  dernière estampille de septembre est `20260916210000`.

## 3. Geste 1 — les 12 migrations

**Méthode.** Le seul chemin d'écriture vers Production est le connecteur, avec
`apply_migration`, une migration par appel. Chaque appel est une transaction, et
l'estampille est inscrite au registre.

Les 12 migrations ne forment donc **pas** une transaction unique. Ce qui borne le
risque :
- Toutes créent des objets neufs, et la plupart avec `if not exists`.
- La première erreur arrête la série. Il ne faut jamais enchaîner la suivante.

**AVANT.** Relire la base, puisque la garde ne voit pas une base qui bouge sans le
dépôt. Exécuter sous `begin read only … rollback` et s'arrêter si un seul
résultat diffère du §2 :

```sql
begin read only;
select current_user, current_setting('transaction_read_only');
select count(*) as fonctions_deja_la from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in (
  'fdj_calculer_caisse','fdj_chaine_continuite','fdj_ecrire_saisies_caisse',
  'fdj_emplacement_du_site','fdj_cle_idempotence','fdj_corriger_caisse_confirmee',
  'fdj_ouvrir_quart_depuis_prise_de_poste','fdj_ma_progression_caisse');      -- attendu 0
select count(*) as tables_deja_la from pg_class
 where relname in ('fdj_caisse_evenements','fdj_demandes_correction');        -- attendu 0
select pg_get_constraintdef(oid) from pg_constraint
 where conname = 'fdj_cash_controls_statut_check';                            -- attendu : 8 valeurs du §2
select distinct statut from public.fdj_cash_controls;                         -- attendu ⊂ 10 valeurs de 220100
rollback;
```

**Application, dans cet ordre exact :**

1. `20260916220000_fdj_quart_relie_a_la_prise_de_poste`
2. `20260916220100_fdj_caisse_cycle_de_vie_colonnes`
3. `20260916220200_fdj_caisse_journal_evenements`
4. `20260916220300_fdj_demandes_correction_apres_validation`
5. `20260916220400_fdj_mouvements_auteur_et_date_effet`
6. `20260916220500_fdj_commande_ouverture_quart`
7. `20260916220600_fdj_commandes_caisse_employe`
8. `20260916220700_fdj_commandes_caisse_manager`
9. `20260916220800_fdj_projection_employe`
10. `20260916220900_fdj_projection_progression`
11. `20260916221000_fdj_commandes_activations_et_mouvements`
12. `20260916221100_fdj_commande_saisie_caisse_manager`

Le contenu appliqué est celui du fichier au SHA du candidat, à l'octet près. Les
empreintes `blob_migration` sont inscrites dans
`qualification-ordre-migration-code.json`.

**APRÈS.** En lecture seule :
- les 12 estampilles sont au registre ;
- les 36 fonctions et les 2 tables existent ;
- `fdj_cash_controls_statut_check` porte 10 valeurs et est validée ;
- `fdj_corriger_caisse_employe` garde `authenticated`, car 120000 n'est pas
  encore passée ;
- l'écran servi s'ouvre toujours.

**Retour arrière.** Chaque fichier porte en commentaire final son bloc de
retour arrière. Ces blocs ne sont pas exécutés et doivent être joués à rebours.
Aucune donnée existante n'est modifiée par les 12 migrations : le retour arrière
ne supprime que des objets neufs et vides.

## 4. Gestes 2 et 3 — fusion puis déploiement

- **Fusion.** Avance rapide de `production` (2f27e5c) vers le candidat.
  - Le candidat a 33 commits d'avance et 0 de retard.
  - La fusion ne déploie pas.
- **Déploiement.** Il passe par la gate GitHub Pages, en mode « construit »
  (`outils/build.sh` est présent sur `production`).
  - La garde #70 refusera le déploiement si une migration du candidat n'est pas
    qualifiée, ou si son fichier diffère de l'empreinte qualifiée.
- **Constat.** Contenu servi, sha256, puis exécution : un 200 ne prouve pas le
  contenu.

## 5. Geste 4 — `20261004120000`

- **AVANT** (lecture seule) :
  - l'écran servi est celui du candidat, ce qui se constate par sha256 ;
  - l'ACL de `fdj_corriger_caisse_employe(uuid, numeric, text, text)` vaut
    `{postgres, anon, authenticated, service_role}=X`, comme mesuré le
    04/10 à 10:33 UTC ;
  - `fdj_corriger_caisse_confirmee` existe, puisque le geste 1 est fait.
- **Application.** `apply_migration`, avec le fichier à l'octet près.
- **APRÈS.** L'ACL vaut `{postgres=X, service_role=X}`. Côté écran, la correction
  employé passe par `fdj_corriger_caisse_confirmee`, qui refuse une caisse validée.
- **Retour arrière.**
  `grant execute on function public.fdj_corriger_caisse_employe(uuid, numeric, text, text) to authenticated;`

## 6. Hors périmètre

- **Phase C** (`supabase/phase-c/`). Elle n'est pas portée par le candidat : elle
  n'est pas dans `supabase/migrations`. Elle reste en attente de son propre
  arbitrage (request-3 §5). Rien dans cette procédure ne l'applique ni n'en
  dépend.
- **Faux positif de la garde.** La garde détecte des DDL destructifs dans
  220000, 220200, 220300 et 220400. Ce sont les blocs de retour arrière
  **commentés** (`-- drop …`), car la regex ne retire pas les commentaires.
  Cela impose l'état `atomique_ou_procedure_speciale`, qui est de toute façon
  l'état juste ici. La garde n'est pas corrigée dans ce lot.
