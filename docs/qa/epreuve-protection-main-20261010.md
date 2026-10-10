# Épreuve du verrou de `main` — 10/10/2026

Ce fichier n'a qu'un rôle : porter une PR jetable vers `main` pour mesurer ce
que le ruleset `22486287` exige réellement, plutôt que de le déduire de l'API.

Ce qu'on veut constater :

1. le push direct sur `main` est refusé ;
2. la PR attend `non-regression` et rien d'autre ;
3. `require_extra_approval_for_unattributed_changes` bloque la fusion, ou non.

La PR est close sans fusion une fois la mesure faite. Le constat est consigné
au registre d'apprentissage, pas ici.
