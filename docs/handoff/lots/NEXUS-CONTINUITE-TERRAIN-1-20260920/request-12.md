---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-1-20260920
seq: 12
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: LEAN
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=a786408 production=2bc7b39
  - id: corrige
    classe: VERIFIED
    valeur: request-11_paragraphe_8
  - id: run-rail
    classe: VERIFIED
    valeur: tests_214a955_job_106553520771_success_59s
  - id: rail-resolu
    classe: VERIFIED
    valeur: handoff-continuite-20260920_sans_repli
  - id: immuabilite
    classe: VERIFIED
    valeur: etape_5_verte_aucune_etape_sautee_en_amont
  - id: epreuves-handoff-en-ci
    classe: VERIFIED
    valeur: etapes_11_et_12_vertes_31_lots_10_avertissements
  - id: suite-ci
    classe: VERIFIED
    valeur: 265/274
  - id: chiffre-errone-de-request-11
    classe: DECLARED
    valeur: 263/274_pris_sur_un_autre_arbre
  - id: etapes-sautees
    classe: VERIFIED
    valeur: 5_etapes_playwright_supabase_test_par_condition
---
# Correction de request-11 §8 — la CI prouve désormais le Handoff sur ce rail

## 1. Ce que je corrige, et pourquoi dans une séquence nouvelle

`request-11.md` §8 affirme : « La CI ne prouve toujours pas le Handoff sur ce rail. L'étape
« Immuabilité des migrations déjà en production » casse et **saute les 45 étapes suivantes**,
dont toutes les épreuves Handoff. Le verdict réel se prend avec
`NEXUS_BASE_BRANCH=handoff-continuite-20260920` : **263/274** […] Le rouge que ce dépôt va
afficher après ce commit est cet artefact-là. »

**C'est faux, et le dépôt de `request-11` l'a lui-même démontré deux minutes plus tard.** Je
ne réécris pas `request-11` : le registre est append-only, et une enveloppe déposée reste
lisible telle qu'elle a été déposée, erreur comprise. La correction vit ici.

## 2. Ce qui a été mesuré

Run Tests `214a955` (push du transport sur le rail), job `non-regression` — **succès en 59 s** :

- Étape 4 « Résoudre le rail Handoff de ce run » : `Rail Handoff retenu :
  handoff-continuite-20260920 (ref : handoff-continuite-20260920)`. Le rail est résolu
  correctement — pas de repli silencieux vers `config-par-environnement`.
- Étape 5 « Immuabilité des migrations déjà en production » : **verte**. Elle ne casse plus,
  parce que le dépôt et la base sont réconciliés et que Production porte désormais ces
  migrations. Aucune étape n'est sautée en amont.
- 46 étapes sur 51 exécutées et vertes ; les 5 sautées sont les étapes Playwright / Supabase
  Test, sautées par condition, pas par rupture.
- Étape 11 « Protocole Handoff v2 » : **verte** — `Handoff v2 : registre, enveloppes et
  STATE.json conformes (31 lot(s), 10 avertissement(s), 6 dérogation(s))`, identique au
  verdict local déclaré dans `request-11`. Étape 12 « Épreuves mutationnelles du validateur
  Handoff » : verte aussi.
- Suite de non-régression en CI : **265/274**, pas 263/274. Le chiffre de `request-11` avait
  été pris sur un autre arbre, dans une exécution forcée à la main.

## 3. Ce que cela change

Le rail Handoff est désormais **prouvé par la CI, sur la CI**, et non plus seulement par une
exécution locale avec `NEXUS_BASE_BRANCH` posé à la main. La réserve ouverte depuis le
câblage de `bdff0d5` — « le rail est routable mais sa preuve est sautée » — est fermée par la
mesure, pas par une déclaration.

Ce que cela ne change pas : `request-11` §1 à §7 et §9 à §10 restent exacts et non modifiés.
En particulier, l'écart de forme du geste Production (PR #67 / `2bc7b39` au lieu d'un
fast-forward vers `f5398a7`) reste entier.

## 4. Ce que je demande

La question de fond est inchangée : **ratifier ou refuser l'équivalence** décrite en
`request-11` §1 à §3. Comme le protocole fait de cette demande la demande active, une
décision rendue ici vaut décision sur le post-flight complet — `request-11` et cette
correction ensemble. Aucune écriture Production n'est demandée.
