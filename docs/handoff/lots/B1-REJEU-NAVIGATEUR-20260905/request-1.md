---
protocol: nexus-handoff/2
kind: request
lot_id: B1-REJEU-NAVIGATEUR-20260905
seq: 1
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=501c0c7 production=501c0c7
  - id: suite
    classe: VERIFIED
    valeur: 184/193
  - id: rejeu-etapes-1-9
    classe: HUMAN
    valeur: prouvees en session reelle sous Employe Test A
  - id: rejeu-etape-11
    classe: HUMAN
    valeur: ECHEC 23505 - S-3 ne cloture pas
  - id: isolation-cause
    classe: VERIFIED
    valeur: transaction annulee - site seul refuse, site_id explicite accepte
  - id: deploiement-eprouve
    classe: DECLARED
    valeur: commit c2b28c3 generation 020995cd6b06 environnement test
  - id: etat-base-non-corrige
    classe: VERIFIED
    valeur: 41c935d4 en_cours, clotures_par_S3=0, aucune correction manuelle
---

# Rejeu navigateur réel — le bloqueur 1 ne peut pas être fermé

## Résumé

Le rejeu a été exécuté sous Employé Test A, en session réelle, sur le
déploiement `c2b28c3`, dans l'ordre littéral de la décision S-5.

**Neuf étapes sur onze sont prouvées. La onzième échoue, et c'est bloquant :
S-3 n'a jamais fonctionné depuis l'application.** Aucune correction n'a été
appliquée. Le bloqueur 1 reste **ouvert**.

## Ce qui est prouvé

**Étape 1 — fail-closed, par un autre mécanisme que celui que j'avais prédit.**
Aucune ligne créée. Mais le blocage n'est pas venu de l'écran d'arrêt A11 :
la porte d'accès a redirigé vers Prise de poste avant qu'Inventaire ne
s'initialise. Le résultat est celui attendu, la mécanique n'est pas celle
annoncée dans ma fiche.

**Étape 2 —** service `d73ff4cf`, `en_cours`, `caissiere`, quart `soir`,
20:39:11. L'écran a affiché « Quart du soir » de lui-même : le contrat C2
(fuseau de la station + seuil configuré) tient en session réelle.

**Étape 4, qui précède l'étape 3 dans les faits.** L'application **exige** le
pointage d'arrivée avant d'ouvrir Inventaire. Arrivée 20:43:35 avec photo,
`heure_debut_quart` = 20:39:10 — le début du service courant. C'est le
mécanisme d'A18 fonctionnant correctement une fois les services assainis.

**Étape 3 — la preuve 2 de S-5, restée en suspens à sa fermeture.**
Ligne `68e1ee3b` portant `shift_id = d73ff4cf`, identique au service courant.
Première ligne de la base à porter un rattachement ; les 6 historiques restent
à `NULL`, aucune reprise.

**Étapes 5 à 7 — S-2 sous RLS réelle.** Départ 20:47:37 avec photo. Service
`termine`, `heure_fin` = 20:47:37 exactement l'heure du pointage,
`cloture_source = pointage_depart`. Aucun service en cours ensuite. Sur toute
la table : **0 clôture incomplète, 0 service terminé sans `heure_fin`** —
aucune écriture partielle.

**Étapes 8 et 9 — S-3 non sollicité, comme annoncé avant de commencer.**
Service `41c935d4` créé, unique `en_cours`. Le précédent étant déjà clos par
S-2, son `cloture_source` reste `pointage_depart`.

## L'échec

Étape 11, troisième prise de poste alors que `41c935d4` est encore ouvert :

```
Confirmation prise de poste: {code: 23505,
  message: duplicate key value violates unique constraint "shifts_un_seul_service_en_cours"}
```

**Cause.** L'écran insère `site`, **jamais `site_id`**
(`NEXUS-Prise-De-Poste-v1.html:332`). C'est le trigger `shifts_site_unique`
qui remplit `site_id`. Or les triggers `BEFORE` d'un même événement se
déclenchent **par ordre alphabétique de nom**, et
`nexus_cloturer_shift_precedent` précède `shifts_site_unique`. Quand S-3
s'exécute, `new.site_id` vaut encore `NULL` ; sa recherche du service actif
porte sur `sh.site_id = new.site_id`, ne trouve rien, conclut « première prise
de poste : rien à clôturer » et rend la main. L'index de S-1 refuse alors
l'insertion.

Isolation, en transaction annulée, hors RLS — le défaut n'est donc pas un
effet des politiques :

```
A. insert avec site seul (ce que fait l'écran)  : REFUSE — duplicate key …
B. insert avec site_id explicite (mes tests S-3) : ACCEPTE — S-3 a cloture le precedent
```

**Ma validation de S-3 était invalide.** Elle fournissait `site_id`
explicitement, une forme de données que l'application n'envoie jamais. C'est
la même faute qu'en C2-2 et qu'à l'appel à trois arguments de
`chargerCarburantsBriefAvecFallback` : j'ai éprouvé le contrat sur des données
que j'avais moi-même façonnées, et non sur celles du parcours réel.

Le défaut est resté invisible aux étapes 2 et 8 parce qu'aucun service n'y
était ouvert. Il fallait une véritable prise de poste *suivante* — l'étape que
l'ordre de la décision S-5 ne permettait pas d'atteindre.

## Effet de bord opérationnel

Tant que le défaut subsiste, un employé ayant un service ouvert **ne peut pas
prendre un nouveau poste**. Le seul moyen de repartir est le pointage de
départ, qui déclenche S-2. Ce n'est pas un blocage total, mais c'est un chemin
métier légitime aujourd'hui impossible.

## État laissé en base — non corrigé

`41c935d4` reste `en_cours` pour Employé Test A. `clotures_par_S3 = 0`,
`clotures_par_S2 = 1`, 7 lignes d'inventaire dont 1 rattachée. Rien n'a été
modifié à la main.

## Risques / anomalies

1. **Deux de mes prédictions écrites se sont révélées fausses** — le mécanisme
   du fail-closed à l'étape 1, et l'ordre des étapes 3/4. Elles sont
   consignées telles quelles, sans réécriture après coup.
2. **La correction n'est pas évidente** et ne doit pas être improvisée.
   Trois voies au moins, aux conséquences différentes — voir Q16.
3. **Aucun test automatisé n'aurait attrapé ce défaut** : il ne se manifeste
   qu'avec la forme de données réelle *et* un service déjà ouvert. C'est un
   manque de couverture, pas seulement un bug.

## Questions pour arbitrage

**Q16 — Comment corriger S-3 ?** Trois voies :

*(a)* Résoudre le site dans S-3 par `coalesce(new.site_id, new.site)`.
Minimal, mais laisse deux triggers dépendre l'un de l'autre par leur nom.

*(b)* Renommer le trigger de normalisation pour qu'il passe en premier
(par exemple `aaa_shifts_site_unique`). Fait dépendre une garantie métier
d'un ordre alphabétique — fragile et illisible.

*(c)* Fusionner la normalisation du site dans un unique trigger `BEFORE
INSERT` qui normalise **puis** clôture, supprimant la dépendance d'ordre.

Recommandation : **(c)**, avec (a) comme repli si la fusion touche trop de
chemins. Un invariant qui dépend de l'ordre alphabétique de deux triggers
n'est pas un invariant — c'est une coïncidence qui a tenu tant que personne
n'a pris deux postes de suite.

**Q17 — Le test qui manquait.** Faut-il exiger, comme condition de fermeture,
un test qui insère un shift **avec la forme exacte envoyée par l'écran**
(`site` seul) alors qu'un service est déjà ouvert ? Recommandation : **oui**,
et c'est la vraie leçon du lot — mes trois régressions de la campagne viennent
toutes d'un contrat éprouvé sur des données que j'avais façonnées.

**Q18 — Le service `41c935d4` laissé ouvert.** Le laisser tel quel jusqu'à la
correction, ou le clore par un départ réel ? Recommandation : **le laisser**.
Il documente l'état d'échec, et le clore effacerait la trace.

## Action attendue de ChatGPT

Arbitrer Q16, Q17 et Q18 pour le `LOT_ID` **B1-REJEU-NAVIGATEUR-20260905**,
puis déposer `decision-1.md` dans `docs/handoff/lots/B1-REJEU-NAVIGATEUR-20260905/`.

**Le bloqueur 1 ne peut pas être fermé en l'état.**
