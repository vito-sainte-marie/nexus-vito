# Import sur Test du 17/11/2026, 19 h 48 (heure de Martinique)

GO d'écriture du pilote à 19 h 42. Lancé par le pilote depuis son poste : `21_jouer_sur_test.mjs` (SHA-256 `d30266b2b0032151…`, commit `248d89ae`), avec `--ca` et `--schema`, en connexion directe et TLS vérifié.

- Lot : `885bed76-6ab0-48eb-a214-1037af71bd99`. Ventes 1 555, stock brut 2 871, déclarations 27, jeux 3.
- Relecture sur Test, en lecture seule (Guardian) : md5 identiques au manifeste pour les trois jeux (`3af44957…`, `d7b7881e…`, `6bca11df…`).
- Isolement : aucun droit pour `anon` ni `authenticated`, RLS active sur toutes les tables du schéma, un seul lot.
- Inchangés avant et après : les 130 règles T2 (138 lignes, `1752f6f440c7777399d6b0040c86438e`) ; `public.products` et `public.stock_releves` de Sainte-Marie, 0 ligne ; 352 migrations, la dernière étant `20261117161325`.
- Comparaison A/B/C (`50_comparer_a_b_c.mjs`, compléments fournis), sur des données identiques à celles de Test au md5 près :
  - A, conditionnel : 431/440, 9 attendus, 0 régression ;
  - A, réel : 383/440, 9 attendus et 48 données absentes ;
  - B, sans stock : 0/440 ;
  - C : 848 références, dont 440 comparées, mêmes chiffres que A.
