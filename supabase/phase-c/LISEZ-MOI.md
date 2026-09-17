# `supabase/phase-c/` — fichiers SQL **volontairement hors des migrations**

Ce dossier n'est pas un dossier de migrations. Rien de ce qu'il contient ne
part avec `supabase db push`, et c'est la raison d'être du dossier.

## Pourquoi

La Vague 1 de la refonte FDJ suit la stratégie **étendre → basculer → fermer** :

| Phase | Contenu | Où | Application |
|---|---|---|---|
| **A — étendre** | 9 migrations `20260916220000` → `20260916220800` : colonnes, tables, journal, commandes serveur, projection employé | `supabase/migrations/` | avec le déploiement, sans rien casser |
| **B — basculer** | le front n'utilise plus que les nouvelles commandes | fichiers `.html` / `.js` | déploiement Pages |
| **C — fermer** | RLS définitives, retrait des écritures directes | **ici** | **manuelle, après preuve que B est servi** |

La Phase A est conçue pour être sans effet sur le front existant : elle
n'ajoute que des objets. La Phase C, elle, **retire** des droits. Appliquée
avant que le front basculé soit effectivement servi, elle casse l'écran FDJ au
premier enregistrement.

Or Production est servie **brute par GitHub Pages, sans build** : la fusion
d'une PR et le déploiement d'une page ne disent rien de l'état de la base, et
inversement — *« ne jamais supposer qu'une migration Supabase est appliquée
automatiquement par la fusion Git ou le déploiement Pages »*. Les deux
calendriers sont indépendants. Un fichier de fermeture rangé dans
`supabase/migrations/` partirait donc avec le lot de la Phase A, c'est-à-dire
au pire moment possible.

Le tenir ici est la seule garantie mécanique qu'il ne s'applique pas par
inadvertance. Ce n'est pas une convention : c'est la garde.

## Comment l'appliquer, le jour venu

1. Lire les **conditions C1 à C4** en tête du fichier et les vérifier une par
   une. Elles portent sur l'état réel de la base et sur le fichier réellement
   **servi**, pas sur le contenu du dépôt.
2. Répéter d'abord la fermeture **en transaction annulée** :
   ```
   sed 's/^commit;$/rollback;/' 20260916230000_fdj_rls_definitives_phase_c.sql > /tmp/essai.sql
   psql "<url directe>" -v ON_ERROR_STOP=1 -f /tmp/essai.sql
   ```
   Le fichier contient trois contrôles internes qui font échouer la
   transaction si la fermeture est incomplète.
3. Appliquer ensuite le fichier tel quel, avec `psql -f`.
4. Rejouer les requêtes de vérification données en fin de fichier.

## Retour arrière

Il figure en fin de fichier, commenté, avec sa propre condition d'arrêt. Il
rouvre les écritures directes : ne l'exécuter que si le front a lui aussi été
remis en arrière.

## Registre des migrations

Ce fichier **ne doit pas** être inscrit dans `supabase_migrations.schema_migrations`.
Il porte un horodatage dans son nom pour l'ordre de lecture humaine, pas pour
le registre. S'il devait un jour rejoindre les migrations estampillées — après
application manuelle sur tous les environnements — ce serait par une décision
explicite et documentée, jamais par un simple `git mv`.
