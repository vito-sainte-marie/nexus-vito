# Huit services en une matinée, et une fin antérieure à son début

**11/09/2026.** Diagnostic demandé par l'Orchestrator. Aucune écriture
Production ; tout ce qui suit est lu, sur Test et sur le dépôt.

## La question

Huit services pour `Employé Test A` le 11/09, dont un portant :

```
fin    2026-09-11 12:22:43
début  2026-09-11 12:22:44.023762
```

## Cause démontrée — ce n'est ni la navigation, ni le pointage

**Un seul endroit du code crée un service** : `NEXUS-Prise-De-Poste-v1.html:389`,
derrière le clic « Confirmer ma prise de poste », bouton désactivé pendant
l'appel. Vérifié par recherche exhaustive de `from('shifts').insert` sur tout
le dépôt : aucune autre insertion applicative.

Les huit services forment **quatre paires**, chacune séparée de moins d'une
seconde. Chaque paire tombe exactement dans la fenêtre d'un run CI :

| paire | fenêtre du run `push` (heure station) | commit |
|---|---|---|
| 11:06:01.150 · 11:06:01.652 | run antérieur | — |
| 11:17:50.740 · 11:17:51.318 | 11:16:05 → 11:19:00 | `3ca9a06` |
| 11:51:53.543 · 11:51:54.640 | 11:50:04 → 11:53:03 | `59f38ec` |
| 12:22:43.604 · 12:22:44.023 | 12:21:04 → 12:23:07 | `c33faf8` |

**Ce sont les prises de poste de la recette navigateur automatisée.** Son
scénario en fait deux à la suite — c'est le cas « prise de poste avec un quart
DÉJÀ OUVERT » qu'elle vérifie. Deux prises volontaires produisent deux
services : le comportement est conforme, pas défaillant.

**La fin antérieure au début vient d'une concurrence**, et elle est datée à la
seconde. Mon parcours manuel s'est déroulé **à l'intérieur** de la fenêtre du
run `c33faf8` : arrivée 12:21:59, départ 12:22:43. Au même instant, la recette
CI créait ses deux services sur **le même compte**.

Les deux déclencheurs écrivent alors une fin de service, et ils ne la calculent
pas de la même façon :

| trigger | `heure_fin` posée |
|---|---|
| `nexus_shifts_avant_insertion` | `NEW.heure_debut`, c'est-à-dire `now()` du serveur |
| `nexus_cloturer_shift_au_depart` | `(new.date + new.heure) at time zone <fuseau>`, c'est-à-dire **l'heure du CLIC** |

Le service créé par la CI à 12:22:44.023 a donc été clôturé par mon départ
avec l'heure de mon clic, 12:22:43 — **antérieure de 1,023 seconde à sa propre
création**. Aucun des deux triggers n'est faux isolément ; c'est leur
rencontre qui l'est, et **rien en base n'interdit le résultat**.

## Les six invariants demandés, état réel

| invariant | état |
|---|---|
| un seul service courant par employé et par site | **tenu** — index unique partiel (S-1), plus le tri défensif dans les deux triggers |
| une navigation ou une actualisation ne crée jamais de service | **tenu** — une seule insertion, derrière un clic explicite |
| un pointage ne crée pas de chaîne de services | **tenu** — le trigger de départ clôture, il n'insère rien |
| `fin >= debut` toujours vrai | **NON TENU** — aucune contrainte, aucune garde |
| `prise_de_poste_suivante` exige une prise distincte | **tenu** — garde temporelle S-3 : une insertion antérieure ou égale lève `22007` |
| appels répétés idempotents | **partiellement** — le bouton se désactive, mais rien en base ne s'y oppose |

## Ce que je ne corrige pas ici, et pourquoi

Les deux invariants manquants se réparent **en base**, donc par migration :
une garde `fin >= debut` dans les triggers et une contrainte `CHECK`. Le
mandat interdit toute écriture Production et demande de ne rien appliquer
aveuglément. Les migrations sont donc **préparées et non appliquées** — voir
`plan-migration-service-id-1.md`.

**Une remarque d'exploitation, sans laquelle le diagnostic serait incomplet :**
la recette navigateur CI et une session humaine partagent le même compte
`Employé Test A`. Tant que ce sera le cas, toute session manuelle menée pendant
un run CI produira des entrelacements de ce genre. Ce n'est pas un défaut du
produit, c'est un défaut de dispositif d'épreuve — et il vaut d'être corrigé
avant d'accuser le code.
