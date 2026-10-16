# Dossier de promotion Production — « Dernier poste » sous 5 prises (lot C)

| | |
|---|---|
| Branche | `lot-c-dernier-poste-20261016`, PR #133 (base `production`, **non fusionnable sans GO**) |
| Cible | Production `uzhjpqpctpvxytxpxoqz` + GitHub Pages (`production`) |
| Date | 16/10/2026 |
| Verdict demandé | **aucun** : ce dossier prépare, il n'autorise rien. Aucun GO Production n'est implicite. |
| État de Production | inchangé par ce lot — migration, code et données |

**Qualification soumise au verdict Handoff. Cette qualification documentaire ne constitue aucune autorisation de migration, de fusion ou de déploiement en Production.**

Fiche rédigée par Claude. Statut : aucun GO Production, aucune fusion, aucun déploiement.

## 1. Ce que le lot change

Avec moins de 5 prises de poste confirmées sur 90 jours, l'écran de prise de poste affiche « Dernier poste » sous le poste le plus récent (au lieu de « historique insuffisant »). Libellés des postes : Piste, Boutique, Renfort (valeurs inchangées). Aucune présélection.

## 2. Migration — `20261016150000_poste_dernier_sous_seuil.sql`

Blob au moment de la qualification : `46804ad69135ed3072002658fbe0cdf35fcbc61f`. Un blob différent fait tomber la qualification.

`create or replace` de `public.poste_le_plus_frequent(uuid)`, déjà en Production (lot B, `20261016120000`) : même signature, mêmes colonnes, mêmes filtres, SECURITY INVOKER, STABLE, `anon` sans EXECUTE. Seul change le cas `< 5` : l'état `dernier_poste` (poste du quart le plus récent) remplace `historique_insuffisant` quand il existe au moins une prise. Aucune table, colonne, contrainte, politique ni donnée touchée.

Mesure Production du 16/10/2026 à 20:10 UTC (lecture seule, `begin read only … rollback`) : registre 315 (`20261016120000` présente, `20261016150000` absente) ; fonction en place, définition du lot B (md5 `d8d429a18a28c3c7913aa37a096be79d`, sans `dernier_poste`).

### 2.1 Pourquoi cette fiche n'est pas « additive pure »

La garde a refusé l'état additif (`CIBLE_DEJA_DEPENDANTE`) : le code déjà en Production nomme `poste_le_plus_frequent`, que la migration remplace. C'est un faux positif de classement, la fonction préexiste, mais le risque réel est celui d'un remplacement de fonction en service, d'où une procédure. La garde n'est ni modifiée ni affaiblie.

### 2.2 Compatibilité

- **Ancien code, nouvelle fonction** : le code servi ne produit un texte que pour `dominant`, `aucune_dominante` et `historique_insuffisant`. L'état `dernier_poste` n'affiche rien : la prise de poste reste intacte.
- **Nouveau code, ancienne fonction** : l'état `historique_insuffisant` s'affiche comme aujourd'hui ; le badge « Dernier poste » n'apparaît pas, rien ne casse.

## 3. Ordre exact

1. **Préflight (lecture seule).** Relire la base : fonction présente, md5 de la définition = `d8d429a18a28c3c7913aa37a096be79d` (sinon **arrêt**, la base a bougé hors dépôt) ; registre à 315 sans `20261016150000` ; blob de la migration = `46804ad6…`.
2. **Migration (GO distinct de Frédéric).** Une transaction (`begin … commit`) via `execute_sql`, jamais `apply_migration`, avec l'insertion dans `supabase_migrations.schema_migrations`. Bloc `do $ctrl$` fail-closed en fin de fichier.
3. **Contrôles après migration.** Fonction SECURITY INVOKER, STABLE, `anon` sans EXECUTE, `authenticated` avec ; définition lisant `dernier_poste` ; registre à 316 ; nombre de lignes de `shifts` inchangé.
4. **Code (GO distincts : fusion de la PR #133, puis déploiement Pages).** Jamais avant l'étape 3.
5. **Contrôles finaux.** Empreinte de l'artefact servi ; recette navigateur humaine (moins de 5 prises : « Dernier poste » ; 5 prises ou plus : inchangé).

## 4. Conditions d'arrêt

- md5 de la fonction différent au préflight : arrêt.
- Un `do $ctrl$` qui lève : transaction annulée, ne pas relancer sans comprendre.
- Après migration : une ligne de `shifts` créée ou modifiée, ou `anon` pouvant exécuter la fonction : arrêt et retour arrière.

## 5. Retour arrière

Réappliquer le `create or replace function public.poste_le_plus_frequent` de `20261016120000_poste_le_plus_frequent.sql` ; vérifier le md5 `d8d429a1…`. Sans perte : la fonction est en lecture seule. Après le code : revenir d'abord à l'ancien artefact Pages, puis seulement la fonction (l'inverse est de toute façon sans casse, voir §2.2).

## 6. Preuves disponibles

Épreuve Node `test_poste_le_plus_frequent_20261016.js` (33 OK) ; épreuve SQL 16/16 sous rollback sur Test (cas 15 et 16 = lot C) ; suite 282/289 avec les 7 échecs identiques à `origin/production`.
