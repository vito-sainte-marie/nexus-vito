# `supabase/phase-c/` — fichiers SQL **volontairement hors des migrations**

Ce dossier n'est pas un dossier de migrations. Rien de ce qu'il contient ne
part avec `supabase db push`, et c'est la raison d'être du dossier.

## Pourquoi

La Vague 1 de la refonte FDJ suit la stratégie **étendre → basculer → fermer** :

| Phase | Contenu | Où | Application |
|---|---|---|---|
| **A — étendre** | 12 migrations `20260916220000` → `20260916221100` : colonnes, tables, journal, commandes serveur, projections employé, commandes d'activation et de saisie managériale | `supabase/migrations/` | avec le déploiement, sans rien casser |
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
   **servi**, pas sur le contenu du dépôt. C5 est la plus facile à oublier, et
   elle a changé de sens le 17/09/2026 : l'écran *Ma Progression* ne lit plus
   `fdj_cash_controls` par jointure, il appelle `fdj_ma_progression_caisse()`.
   La fermeture réserve donc la lecture des caisses au manager — mais si
   l'écran **servi** est encore l'ancien, il n'en sortira aucune erreur,
   seulement une ligne imbriquée vide, en silence. C'est le même piège,
   passé de l'autre côté.
2. Répéter d'abord la fermeture **en transaction annulée**, avec les
   mutations, par la recette :
   ```
   supabase/phase-c/recette-test.sh
   ```
   Elle joue le fichier **exact** du dépôt : elle n'en substitue que le
   `begin;` et le `commit;`, vérifie l'ancrage avant de le faire, imprime le
   `diff` (quatre lignes) et refuse de partir si autre chose a bougé. Sur une
   base qui n'a pas encore la Phase A, elle charge les douze migrations dans la
   même transaction annulée. Le fichier contient huit contrôles internes qui
   font échouer la transaction si la fermeture est incomplète, et la recette
   enchaîne sur les treize mutations — étape **non facultative**, voir plus bas
   *« pourquoi les contrôles internes ne suffisent pas »*.

   Chaque exécution dépose une preuve datée sous `supabase/phase-c/preuves/`.
   Une recette qui ne laisse rien derrière elle ne se prouve pas : l'absence
   de migration Phase A sur `nexus-test` établit qu'aucune écriture n'a
   survécu, jamais qu'une recette a tourné — une recette jamais lancée
   laisserait le même état. La preuve porte donc la date, le commit, les
   empreintes des fichiers joués, la liste nominative des prérequis retenus
   avec leurs empreintes, **le pilote intégral réellement soumis à psql**, la
   commande expurgée, le `diff`, la sortie complète du serveur, le code de
   retour et la dernière instruction rendue.

   Le pilote y figure en clair et non seulement empreint : il contient un
   chemin temporaire qui change à chaque exécution, donc son empreinte brute
   ne serait reproductible par personne. C'est le texte expurgé qui est
   empreint — celui-là, un relecteur peut le refaire. Et chaque prérequis
   s'annonce lui-même dans la sortie du serveur, par un `\echo` émis avant
   son `\ir` : sans cela, seules les migrations ayant produit un `NOTICE`
   laisseraient une trace, et un glob trop étroit resterait invisible dans le
   fichier même censé l'empêcher.

   Elle distingue explicitement l'exécution, le `ROLLBACK`, et l'absence
   d'effet durable — cette dernière se vérifiant hors du fichier, en
   interrogeant la base après coup. Elle ne dit **pas** ce que cette
   vérification a donné : une preuve écrite par le processus qui vient de
   tourner ne peut rien affirmer de ce qui subsiste après lui.
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
doivent toutes rougir. Elle analyse aussi le fichier de mutations lui-même :
tout `.sql` de ce dossier passe sous l'analyseur.

Une seconde garde, `test_phase_c_identifiants_synthetiques_20260917.js`,
refuse tout UUID de ce dossier — SQL, script, ce fichier-ci et **preuves
comprises** — qui ne figure pas dans la liste déclarée des fixtures. Le
dépôt est public : l'identifiant d'un employé réel y est un identifiant
pseudonyme persistant, corrélable à une personne, même sans nom ni
courriel. La liste est elle-même contrainte de forme — un seul chiffre
hexadécimal répété — de sorte qu'on ne puisse pas faire taire la garde en
y déclarant un identifiant réel.

## Pourquoi les contrôles internes ne suffisent pas

Ils interrogent `pg_policies`, `pg_trigger` et `to_regprocedure` : ils
constatent qu'une garde est **installée**, jamais qu'elle **refuse** quelque
chose. Les deux se
ressemblent beaucoup — en vert.

Mesuré le 17/09/2026 : les deux fonctions de garde avaient d'abord été
écrites en `security definer`. Elles s'exécutaient donc sous le propriétaire,
`current_user` y valait `postgres`, et leur première ligne
(`if current_user <> 'authenticated' then return new`) **désactivait la garde
elle-même**. Les contrôles internes passaient. Un employé pouvait se réattribuer
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

Treize mutations jouées sous le rôle `authenticated`, avec le jeton
d'employés **entièrement synthétiques** : chacune **doit échouer**, et le
script échoue si l'une d'elles passe.
S'y ajoutent des contre-épreuves (M2 bis, M4, M7, M8 bis, M9, M11 bis, et la
seconde moitié de M12) qui vérifient
l'inverse — car une garde qui refuse *tout* casserait l'écran FDJ et serait,
elle aussi, verte au premier examen.

Attention à ne pas confondre les deux formes de refus : le trigger lève une
exception `42501`, tandis que la RLS se contente de masquer la ligne — **0
ligne touchée, aucune erreur**. Écrire « on attend une exception » pour le
second cas donne un test vert qui ne prouve rien.

Les deux acteurs sont créés par le fichier de mutations lui-même et
démontés avant la fin, dans la même transaction annulée. Le `rollback;`
reste la garantie d'absence d'effet durable ; le démontage répond d'autre
chose — que la recette sait défaire ce qu'elle a fait et n'a rien laissé
essaimer hors des onze identifiants déclarés. Il ne connaît que ces onze
UUID : il parcourt les clés étrangères mono-colonne de type `uuid` du
schéma `public` et ne supprime que les lignes qui les portent, donc
aucune ligne préexistante n'est atteignable.

Un point mérite d'être lu avant d'être jugé : le démontage ouvre
`nexus.fdj_journal_maintenance`. `fdj_caisse_evenements` est un journal
immuable par trigger — ni UPDATE ni DELETE, propriétaire compris — et
c'est le seul obstacle réel, y compris pour les lignes mères, puisque
supprimer une caisse y cascaderait et que supprimer un employé y
passerait un `set null`. La migration 20260916220200 prévoit elle-même
ce mode de maintenance ; il est ouvert **après la treizième mutation**,
en variable `local` à la transaction, et refermé aussitôt. Aucune
mutation ne peut donc en profiter, et il meurt avec le `rollback`. Pour
que cette ouverture ne puisse pas masquer un journal déjà sans garde, le
démontage exige d'abord que le journal porte des traces des fixtures,
**puis** qu'un DELETE hors maintenance soit refusé : les deux échouent
bruyamment sinon.

## Retour arrière

Il figure en fin de fichier, commenté, avec sa propre condition d'arrêt. Il
rouvre les écritures directes : ne l'exécuter que si le front a lui aussi été
remis en arrière.

## Contenu du dossier

| Fichier | Rôle |
|---|---|
| `20260916230000_fdj_rls_definitives_phase_c.sql` | la fermeture elle-même : politiques RLS définitives, deux triggers de garde, huit contrôles internes, retour arrière commenté |
| `20260916230000_mutations_de_validation.sql` | les treize mutations qui doivent échouer, plus leurs contre-épreuves ; crée et démonte ses deux acteurs synthétiques ; ne s'exécute pas seul |
| `recette-test.sh` | joue le fichier exact sur `nexus-test` en transaction annulée, mutations comprises ; refuse toute cible ressemblant à la Production ; dépose une preuve datée et refuse d'en écrire une qui porterait le secret |
| `preuves/` | les preuves engendrées, une par exécution. Écrites par le script, jamais à la main |

## Registre des migrations

Ce fichier **ne doit pas** être inscrit dans `supabase_migrations.schema_migrations`.
Il porte un horodatage dans son nom pour l'ordre de lecture humaine, pas pour
le registre. S'il devait un jour rejoindre les migrations estampillées — après
application manuelle sur tous les environnements — ce serait par une décision
explicite et documentée, jamais par un simple `git mv`.
