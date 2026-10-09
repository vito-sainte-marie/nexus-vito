# Procédure G1 — six migrations des versements de régularisation (Production)

**Statut : exécutée le 09/10/2026, 10:31–10:38 UTC, sur GO de Frédéric (« go G1. comme prevu dans le dossier E »).**
Lot Handoff `GO-G1-MIGRATIONS-REGULARISATION-1-20261009` (decision-1 : STOP_REQUIRED SUPABASE_PRODUCTION_MUTATION, sept conditions ; clôture request-3).
Candidat mesuré : `61c50059f8d27efec05e289f779e8fe16909b23f`. Projet `uzhjpqpctpvxytxpxoqz`.

## Fichiers appliqués (extraits de git, jamais d'un worktree)

| Version | blob git | SHA-256 |
|---|---|---|
| 20261008120000 | 5685d874062dd15c7eb8c1fea7f640cf55e3ae10 | a6ec1e616ac35a7e83df4a30014629d51d1f94ee3e1f642bfb6e75b8c7eb908c |
| 20261008125000 | 38c6607447b66f246b523ee107ad64d9781cad26 | 688a257bb12556ef247b0b1a349041ced6e6d9ab24af1ad61cbec8c104f8ece9 |
| 20261008130000 | 2fab8424462e628285ede7454502759710a8b7b8 | 45ab35c8ea78663e670e6b8953e9d954c5afd2b13f5c0078997ee5164adc60f0 |
| 20261008140000 | f12db5635426d3e0632d805280c0bb4975e855f5 | 8db84bf99820e68585dabbcd3af722d3deb0869cf6d7549610826ea46a6679d0 |
| 20261008150000 | 5b5baf59b15d80a957b0e16cb37c2b294da52fca | 467523102c3b42cfd5f0e3c77591327d8c562ba61d6466777eb9737a16c3b097 |
| 20261008160000 | 7c2bedd16ee04008a3561f21d5196c660ad03bb6 | f9d2a83cb77ae29368ac33fb00cae063164f90fd9b153597c8e316ed494fecf6 |

## Chemin d'écriture

Connecteur Supabase, `execute_sql`, jamais `apply_migration` (qui réestampille la version). Une transaction par migration, dans un bloc `DO` gardé : registre attendu exact, version absente, md5 du texte transmis ; puis exécution du texte et insertion de la ligne du registre, dans la même transaction. Pour 160000, la garde revérifiait aussi le md5 de `fdj_calculer_caisse` (`0418bed1d0316063def74ab81cfe71e1`), dont la définition avait été sauvegardée avant (source du retour arrière).

## Ordre et journal

Préflight lecture seule rejoué à 10:27:39 (298, 20261006220000, aucune version du lot, md5 identique), puis :

| Version | Registre après | Heure (UTC) |
|---|---|---|
| 20261008120000 | 299 | 10:31:18 |
| 20261008125000 | 300 | 10:32:45 |
| 20261008130000 | 301 | 10:34:56 |
| 20261008140000 | 302 | 10:35:37 |
| 20261008150000 | 303 | 10:37:08 |
| 20261008160000 | 304 | mesuré 10:38:29 |

## Pourquoi 125000 relève de cette procédure

`20261008125000` ne fait que révoquer des privilèges sur `fdj_cash_controls` : la garde n'y trouve aucun objet à constater, et « déjà appliquée » y serait infalsifiable. Son effet est donc constaté par les droits, pas par des noms : lecture seule du 09/10/2026 à 10:46:44 UTC, seul `authenticated:SELECT` subsiste ; `anon` n'a ni SELECT ni INSERT ; `authenticated` n'a ni INSERT, ni UPDATE, ni DELETE, ni TRUNCATE ; estampille présente au registre.

## Retour arrière

Dossier E §7, ordre inverse, chacun sur GO distinct. Aucun n'est autorisé par le GO G1.
