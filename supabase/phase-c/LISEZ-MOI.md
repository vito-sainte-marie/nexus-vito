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

1. Lire les **conditions C1 à C5** en tête du fichier et les vérifier une par
   une. Elles portent sur l'état réel de la base et sur le fichier réellement
   **servi**, pas sur le contenu du dépôt. C5 est la plus facile à oublier :
   l'écran *Ma Progression* lit `fdj_cash_controls` par jointure, et une
   politique réservée au manager n'y produirait aucune erreur — seulement une
   ligne imbriquée vide, en silence.
2. Répéter d'abord la fermeture **en transaction annulée**, avec les
   mutations, par la recette :
   ```
   supabase/phase-c/recette-test.sh
   ```
   Elle joue le fichier **exact** du dépôt : elle n'en substitue que le
   `begin;` et le `commit;`, vérifie l'ancrage avant de le faire, imprime le
   `diff` (quatre lignes) et refuse de partir si autre chose a bougé. Sur une
   base qui n'a pas encore la Phase A, elle charge les neuf migrations dans la
   même transaction annulée. Le fichier contient cinq contrôles internes qui
   font échouer la transaction si la fermeture est incomplète, et la recette
   enchaîne sur les dix mutations — étape **non facultative**, voir plus bas
   *« pourquoi les cinq contrôles ne suffisent pas »*.
3. Appliquer ensuite le fichier tel quel, avec `psql -f`.
4. Rejouer les requêtes de vérification données en fin de fichier.

Une sortie de recette datée ne prouve jamais que le fichier **d'aujourd'hui**
s'exécute : à chaque fois que ce dossier change, la recette est à rejouer.
C'est précisément ce que la CI ne peut pas faire — elle n'a pas de base, et
n'en aura pas. Elle vérifie donc la seule chose vérifiable sans base, mais elle
la vérifie pour de bon : `test_phase_c_analysable_20260917.js` analyse le SQL
d'ici avec `outils/analyser-sql-plpgsql.js` (appariement réel des blocs
PL/pgSQL, pas une recherche de motifs), contrôle que l'ancrage transactionnel
reste substituable par la recette, et rejoue six mutations du fichier qui
doivent toutes rougir.

## Pourquoi les cinq contrôles internes ne suffisent pas

Ils interrogent `pg_policies` et `pg_trigger` : ils constatent qu'une garde
est **installée**, jamais qu'elle **refuse** quelque chose. Les deux se
ressemblent beaucoup — en vert.

Mesuré le 17/09/2026 : les deux fonctions de garde avaient d'abord été
écrites en `security definer`. Elles s'exécutaient donc sous le propriétaire,
`current_user` y valait `postgres`, et leur première ligne
(`if current_user <> 'authenticated' then return new`) **désactivait la garde
elle-même**. Les cinq contrôles passaient. Un employé pouvait se réattribuer
le quart d'un collègue. Seule la mutation l'a montré.

D'où `20260916230000_mutations_de_validation.sql`, à jouer **dans la même
transaction annulée**, juste après le corps de la fermeture :

```
{ sed 's/^commit;$//' 20260916230000_fdj_rls_definitives_phase_c.sql
  printf '\n'
  cat 20260916230000_mutations_de_validation.sql
  printf '\nrollback;\n'
} > /tmp/essai.sql
psql "<url directe de Test>" -v ON_ERROR_STOP=1 -f /tmp/essai.sql
```

Dix mutations jouées sous le rôle `authenticated`, avec le jeton d'employés
réels : chacune **doit échouer**, et le script échoue si l'une d'elles passe.
S'y ajoutent des contre-épreuves (M2 bis, M4, M7, M8 bis, M9) qui vérifient
l'inverse — car une garde qui refuse *tout* casserait l'écran FDJ et serait,
elle aussi, verte au premier examen.

Attention à ne pas confondre les deux formes de refus : le trigger lève une
exception `42501`, tandis que la RLS se contente de masquer la ligne — **0
ligne touchée, aucune erreur**. Écrire « on attend une exception » pour le
second cas donne un test vert qui ne prouve rien.

## Retour arrière

Il figure en fin de fichier, commenté, avec sa propre condition d'arrêt. Il
rouvre les écritures directes : ne l'exécuter que si le front a lui aussi été
remis en arrière.

## Contenu du dossier

| Fichier | Rôle |
|---|---|
| `20260916230000_fdj_rls_definitives_phase_c.sql` | la fermeture elle-même : politiques RLS définitives, deux triggers de garde, cinq contrôles internes, retour arrière commenté |
| `20260916230000_mutations_de_validation.sql` | les dix mutations qui doivent échouer, plus leurs contre-épreuves ; ne s'exécute pas seul |
| `recette-test.sh` | joue le fichier exact sur `nexus-test` en transaction annulée, mutations comprises ; refuse toute cible ressemblant à la Production |

## Registre des migrations

Ce fichier **ne doit pas** être inscrit dans `supabase_migrations.schema_migrations`.
Il porte un horodatage dans son nom pour l'ordre de lecture humaine, pas pour
le registre. S'il devait un jour rejoindre les migrations estampillées — après
application manuelle sur tous les environnements — ce serait par une décision
explicite et documentée, jamais par un simple `git mv`.
