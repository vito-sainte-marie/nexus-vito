# Manifeste de promotion Production — addendum courant, append-only

Ce fichier **complète** `docs/handoff/lots/NEXUS-PRODUCTION-READINESS-1-20260908/manifeste-migrations-production-1.md`
(le « manifeste historique », clos avec le lot `NEXUS-PRODUCTION-READINESS-1-20260908`,
`DECISION_CONSOMMEE` le 11/09/2026). Il ne le remplace pas et ne le réécrit
jamais.

## Pourquoi ce fichier existe

`test_manifeste_migrations_complet_20260909.js` exige que CHAQUE migration
postérieure à `VERSION_PRODUCTION` (`20260904175722`) soit classée
incluse/exclue/bloquée. Le manifeste historique a déjà été étendu deux fois
après sa clôture initiale (« Ajouts du 09/09/2026 », « INCLUSES — lot
correctif du 11/09/2026 ») — mais chaque extension exigeait de rouvrir et
réécrire un fichier appartenant à un lot officiellement clos, ce que
`decision-4.md` du lot `NEXUS-CONTINUITE-TERRAIN-1-20260920` interdit
désormais par principe pour tout geste qui ne fait que TRANSPORTER des
migrations déjà appliquées ailleurs (Test, ou une branche non rapatriée).

Ce fichier est le point d'ajout pour ce cas récurrent : une nouvelle section
**datée et attribuée à un lot Handoff**, jamais une modification d'une
section existante — ici comme dans le manifeste historique lui-même. La
suppression ou la modification d'une section déjà publiée y serait aussi
illégitime qu'elle le serait dans un `request-N.md`/`decision-N.md` du
registre Handoff.

## Garde d'immuabilité du manifeste historique

Empreinte SHA256 figée du manifeste historique au moment de la rédaction de
cet addendum (calculée en lecture seule, jamais recalculée pour « corriger »
un écart — un écart détecté signale une réécriture, pas une erreur de cette
empreinte) :

```
59f9f95e9fe03e9227f1355885da3f68474a1fae097dfa58193ed1ae3dc90fa7  docs/handoff/lots/NEXUS-PRODUCTION-READINESS-1-20260908/manifeste-migrations-production-1.md
```

`outils/verifier-manifeste-migrations-complet.js` la vérifie avant de lire le
manifeste historique : si elle ne concorde plus, le mécanisme refuse de
conclure plutôt que de certifier sur un fichier qui a changé sous lui.

## Mécanisme de lecture combinée (câblé dans le contrôle réel)

`outils/verifier-manifeste-migrations-complet.js` lit le manifeste
historique **et** ce fichier, et considère une migration classée dès qu'elle
est citée dans l'un OU l'autre. Ce module est démontré et éprouvé par
mutation dans `test_manifeste_migrations_append_only_20260921.js`, et,
depuis `decision-5.md` du lot `NEXUS-CONTINUITE-TERRAIN-1-20260920`, **est
câblé** dans le contrôle réel `test_manifeste_migrations_complet_20260909.js` :
celui-ci lit désormais ce fichier en plus du manifeste historique, et refuse
de conclure si l'empreinte figée ci-dessus ne concorde plus avec le manifeste
historique réel.

---

## Addendum du 21/09/2026 — lot `NEXUS-CONTINUITE-TERRAIN-1-20260920`

**PROPOSITION — non arbitrée.** Cette section applique aux 14 migrations
transportées par ce lot (`request-4.md`) exactement la même règle
déterministe que `test_manifeste_migrations_complet_20260909.js` applique
déjà (une migration est Test/CI si et seulement si elle le DÉCLARE dans son
propre en-tête, ou si elle touche le rôle `nexus_ci_recette`) — je n'invente
aucun nouveau critère de classement, je rejoue celui qui existe déjà contre
les 14 fichiers réels du dépôt. Vérifié par lecture de code le 21/09/2026,
aucune des 14 ne se déclare Test/CI et aucune ne touche `nexus_ci_recette` :

### Proposées incluses dans une future release Production (14 migrations)

1. `20260914210000_mes_ecarts_caisse_projection_employe`
2. `20260916193000_prise_de_poste_ninvente_plus_la_fin`
3. `20260916194000_regularisation_fins_inventees_prise_de_poste`
4. `20260916195000_cloture_source_cycle_pilote`
5. `20260916210000_mes_ecarts_caisse_masque_le_provisoire`
6. `20260919160000_horaires_moteur_unique_et_retard_nullable`
7. `20260919180000_planning_source_officielle_projection_normalisee`
8. `20260919200000_import_planning_google_sheets`
9. `20260919220000_bascule_source_planning_tracee`
10. `20260919240000_horodatage_serveur_planning_shifts`
11. `20260919260000_bascule_source_planning_date_effet`
12. `20260919280000_source_precedente_a_la_date_d_effet`
13. `20260920120000_droits_v_planning_officiel`
14. `20260920140000_bascule_source_precedente_et_change_le`

### Ce que cette classification ne fait pas

Elle ne promeut rien en Production, n'exécute aucun SQL, ne modifie ni le
manifeste historique ni `main`/`production`. Elle ne tranche pas non plus la
question métier de savoir si ces 14 migrations DOIVENT être promues (ordre,
fenêtre de déploiement, dépendances applicatives) — seulement qu'aucune
d'elles ne se déclare Test/CI, ce qui est un fait mécanique, pas un jugement.
La décision de les inclure réellement dans une release reste une gate
Orchestrator/Frédéric distincte, comme pour toutes les entrées du manifeste
historique.

---

## Addendum du 01/10/2026 — deux migrations, deux statuts opposés

Ce lot ajoute deux estampilles au dépôt, et il importe qu'elles ne soient pas
classées ensemble : l'une est **déjà en Production**, l'autre **ne l'est pas**.

### Déjà appliquée en Production — constatée, pas promue (1 migration)

1. `20260919103000_carburant_reception_regularisation_releve_manuscrit`

**Ce fichier n'est pas une nouveauté : c'est une absence réparée.** Il est
enregistré en Production (lecture du 01/10/2026 15 h 01 UTC, verdict
`MIGRATION_APPLIQUEE — 13/13`, 13 objets constatés nom par nom) et il existait
sur `production` sans exister sur le rail. `test_migrations_immuables_20260905.js`
le signalait depuis le 20/09 : « Migrations de production absentes de cette
branche ». Mesuré rouge sur le rail propre à `f6e3f33`, avant toute écriture de
ce lot — ce rouge n'appartenait pas à ce lot, il l'attendait.

Le fichier a été **copié verbatim** depuis `origin/production`, et l'identité a
été vérifiée par l'objet git lui-même : blob `b51aaec6` des deux côtés, 8988
octets, sha256 identique. Une migration appliquée est immuable dans son
identité : elle se copie, elle ne se réécrit pas.

Ce classement **ne promeut rien** — la cible la porte déjà. Il rend le dépôt
véridique sur ce que la base fait.

### Proposée incluse dans une future release Production (1 migration)

2. `20261001160000_revoque_garde_regularisation_reception_anon_authenticated`

Un `revoke` pur : aucun objet créé, modifié ou supprimé. Elle retire
l'`EXECUTE` de `anon` et `authenticated` sur
`public.nexus_garde_regularisation_reception()`, que la migration n° 1 avait
voulu fermer par `revoke … from public` — un instrument qui ne pouvait pas
mordre, Supabase accordant ces `EXECUTE` par grants **nommés**.

Elle ne se déclare pas Test/CI et ne touche pas `nexus_ci_recette` : même
critère déterministe que les 14 de l'addendum du 21/09, rejoué, pas réinventé.

**Pourquoi l'ordre entre les deux compte.** La n° 2 agit sur une fonction que
la n° 1 crée. Tant que le rail ne portait pas la n° 1, le dépôt contenait un
`revoke` visant une fonction qu'aucune de ses migrations ne crée : rejoué sur
une base vierge, le garde `if exists` de la n° 2 aurait rendu son avis
« fonction ABSENTE » et le lot aurait **réussi sans rien fermer**. C'est
précisément le faux succès que la procédure de la n° 2 refuse de compter.
Descendre la n° 1 n'est donc pas un à-côté : c'est ce qui rend la n° 2
falsifiable.

### Proportion, à dire honnêtement

L'exposition pratique fermée par la n° 2 est **nulle** :
`nexus_garde_regularisation_reception()` est `returns trigger`, un appel direct
échoue à la compilation, et PostgreSQL ne consulte pas `EXECUTE` quand un
trigger se déclenche. Ce qui est réel est la divergence entre ce que le dépôt
affirme et ce que la base fait. Une intention écrite qui n'agit pas est pire
qu'une intention absente : elle se relit comme une protection.

### Ce que cet addendum ne fait pas

Il ne promeut rien, n'exécute aucun SQL, ne modifie ni le manifeste historique
ni `main`/`production`, et ne tranche pas la fenêtre de déploiement. L'application
du `revoke` à Production reste le geste de Frédéric
(`outils/revoke-garde-regularisation-production-a-executer-par-frederic.sql`),
sous la gate humaine, et le GO du 01/10/2026 porte sur le revoke seul — ni
fusion, ni déploiement.

---

## Addendum du 02/10/2026 — correctif anomalie terrain Carburants (issue #28)

### Proposée incluse dans une future release Production (1 migration)

1. `20261002000000_station_config_fuseau_horaire_nullable`

Corrige l'anomalie terrain « Enregistrer les prix du mois » (HTTP 400,
PostgREST 23502 sur `station_config?on_conflict=site`). Cause racine :
`20260905131500_fuseau_horaire_par_site` avait fait `DROP DEFAULT` sur
`station_config.fuseau_horaire` sans le `DROP NOT NULL` compagnon, alors que
le client avait, le même jour, cessé d'écrire cette colonne — rendant
impossible TOUT upsert `station_config` (`INSERT ... ON CONFLICT DO UPDATE`
valide la ligne proposée, défauts/NULL compris, avant même de vérifier le
conflit). Cette migration ne fait qu'`ALTER COLUMN fuseau_horaire DROP NOT
NULL` : aucune table créée, aucun défaut réintroduit, aucune donnée touchée.

Elle ne se déclare pas Test/CI et ne touche pas `nexus_ci_recette` : même
critère déterministe que les entrées précédentes de cet addendum, rejoué, pas
réinventé.

### Ce que cet addendum ne fait pas

Il ne promeut rien, n'exécute aucun SQL (aucun accès Supabase depuis le canal
GitHub Issue qui a produit ce correctif), ne modifie ni le manifeste
historique ni `main`/`production`. La preuve de la cause racine est statique
(`test_station_config_upsert_fuseau_horaire_23502_20261002.js`, rejoue le
schéma réel et les 15 payloads d'upsert réels du dépôt) ; la preuve
comportementale SQL (`outils/epreuve-station-config-upsert-fuseau-horaire-
23502-20261002.sql`) reste à exécuter par quiconque dispose d'un accès réel à
`nexus-test`, ce que ce canal n'a jamais eu.
