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
