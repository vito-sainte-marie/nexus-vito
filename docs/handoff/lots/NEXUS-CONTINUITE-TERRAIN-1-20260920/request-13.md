---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-1-20260920
seq: 13
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: LEAN
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0 production=2bc7b39
  - id: sha-soumis
    classe: VERIFIED
    valeur: 5b047e008c07746b1c91846e50247ee594e07314
  - id: tete-de-main
    classe: VERIFIED
    valeur: origin/main=5b047e0_ce_commit_est_la_tete
  - id: portee
    classe: VERIFIED
    valeur: 1_fichier_.github/workflows/claude.yml_+41_-12
  - id: pull-request-associee
    classe: VERIFIED
    valeur: 0_aucune
  - id: enveloppe-prealable
    classe: VERIFIED
    valeur: 0_mention_de_5b047e0_dans_docs/handoff
  - id: protection-de-main
    classe: VERIFIED
    valeur: ruleset=deletion+non_fast_forward_uniquement
  - id: ci-sur-ce-sha
    classe: VERIFIED
    valeur: run_35753483047_Tests_success
  - id: mesure-du-defaut
    classe: VERIFIED
    valeur: 98_corps_reels_issue_28_dont_68_sans_designation_et_6_formes_non_reconnues
  - id: verification-de-la-reparation
    classe: VERIFIED
    valeur: rejeu_des_98_corps_30_resolutions_68_refus_0_supposition
  - id: non-conformite-procedurale
    classe: DECLARED
    valeur: depot_direct_sur_main_sans_enveloppe_ni_pr_ni_revue
---
# Ratification de `5b047e0` — et inscription de sa non-conformité procédurale

## 1. Ce qui est soumis

`5b047e008c07746b1c91846e50247ee594e07314`, « ci(claude): supprimer le repli silencieux qui
détournait le rail », auteur `Claude <noreply@anthropic.com>`, 22/09/2026 12 h 20 min 36 s
(−04:00). Il touche **un seul fichier**, `.github/workflows/claude.yml`, pour +41 / −12.

Il est la **tête de `origin/main`**.

## 2. Ce qu'il corrige, et la mesure du défaut

Le rail présenté à un run Claude était re-dérivé du corps du déclencheur par une expression
qui n'acceptait que la forme `NEXUS_BASE_BRANCH=`. Toute autre forme, et toute absence,
retombaient **sans un mot** sur `config-par-environnement` — la branche gelée le 14/09
(`ea57d4b`). Une désignation humaine était donc remplacée par une supposition, en silence.

Mesure sur les **98 corps de déclencheur réels** de l'issue #28 : 68 ne portaient aucune
désignation et partaient sur la branche gelée ; 6 en portaient une que l'expression ne
reconnaissait pas (`NEXUS_BASE_BRANCH: \`x\`` et `NEXUS_BASE_BRANCH=\`x\``) et partaient au
même endroit. Côté runs, six l'ont annoncé sans que personne ne le lise comme une faute :
35687211545, 35693303110, 35735764410, 35740788694, 35747812656, 35748146221 — tous
« Rail NEXUS sélectionné: config-par-environnement » alors que le rail demandé était
`handoff-continuite-20260920`, d'où un travail rendu « divergent du rail, merge-base
`ea57d4b` ».

La réparation supprime le repli au lieu de l'élargir : sans désignation le job **s'arrête et
le dit** ; la désignation est lue telle qu'elle s'écrit (`=` ou `:`, espaces, backticks ou
guillemets) ; deux branches désignées dans le même corps sont **refusées** au lieu d'être
arbitrées ; un rail absent d'`origin` est nommé là, et non plus au checkout. Vérification par
rejeu de l'étape extraite du YAML sur les 98 corps réels : **30 résolutions correctes,
68 refus explicites, 0 supposition**.

C'est le premier des quatre replis silencieux recensés ; les trois autres sont déjà réparés
(`337468f` pour `outils/handoff.js` et la variable `rail=` de `tests.yml`, `18db37a` pour les
cinq étapes profondes de `tests.yml`).

## 3. La non-conformité procédurale — ce que je demande d'inscrire, pas d'effacer

`5b047e0` a été **déposé directement sur `main`** :

- **aucune pull request** ne lui est associée — `repos/.../commits/5b047e0/pulls` rend une
  liste vide ;
- **aucune enveloppe préalable** ne le mentionne — `grep -rl 5b047e0 docs/handoff/` rend 0 ;
- il n'a donc porté **ni demande, ni décision, ni revue** avant d'exister.

Deux précisions d'honnêteté, parce que la non-conformité serait fausse sans elles :

1. Le dépôt **le permettait**. Le ruleset de `main` ne porte que `deletion` et
   `non_fast_forward` : ni PR obligatoire, ni check requis. Ce n'est donc pas un
   contournement d'une règle technique, c'est un écart à la **gouvernance NEXUS**, qui veut
   qu'une modification de la CI soit demandée puis décidée avant d'être écrite.
2. Le commit **n'est pas non vérifié** : le run Tests `35753483047` sur ce SHA exact est en
   succès, et la réparation a été éprouvée par rejeu sur les 98 corps réels. L'écart porte
   sur la **forme du geste**, pas sur l'absence de preuve.

Je ne propose pas de réécrire l'historique. `main` est protégée en non-fast-forward, la
réécriture serait elle-même un geste plus lourd que l'écart, et le registre est append-only :
un écart se consigne, il ne se rattrape pas.

## 4. Ce que la ratification ne vaut pas

Elle porte sur ce commit et sur lui seul. Elle n'autorise aucune écriture Production, aucune
migration Production, aucune fusion vers `production`, aucun déploiement. Elle ne crée
aucun précédent : un dépôt direct sur `main` reste un écart, et le prochain devra passer par
une enveloppe.

## 5. Ce que le dépôt de la décision va coûter — mesuré, pas supposé

Cette demande est déposée par `handoff.js demande` : elle est conforme par construction, et
`handoff.js verifier` est vert avec elle (31 lots, 14 avertissements, 10 dérogations).

**La décision qui l'arbitre, elle, ne peut pas être conforme.** Mesure prise, pas déduite :
`handoff.js decision … --decision APPROVED_WITH_CONDITIONS --closes false --en-reponse-a
request-13.md --auteur Frederic` produit bien une enveloppe « conforme par construction », et
`handoff.js verifier` rend alors **une** violation, une seule :

    ÉCHEC — lots/NEXUS-CONTINUITE-TERRAIN-1-20260920 : séquence des décisions non contiguë (decision-13.md)

Cause : la règle exige que la i-ème décision porte `seq = i+1`. Ce lot porte les décisions
1 à 9 puis **12** — `decision-10.md` et `decision-11.md` n'ont jamais existé, et `decision-12.md`
est déjà couverte par une dérogation SEQUENCE_NON_CONTIGUE du 22/09. L'outil numérote la
suivante `dernière + 1`, donc 13, alors que la contiguïté en attendrait 11.

Conséquence structurelle à énoncer : **ce lot ne peut plus produire une décision contiguë.**
Ni l'outil, ni une écriture à la main : la seule numérotation qui satisferait la règle serait
11, c'est-à-dire glisser une décision *avant* `decision-12.md` alors qu'elle est déposée après
— fabriquer un ordre qui n'a pas eu lieu, précisément ce que l'append-only interdit. Ce n'est
donc pas un défaut de `decision-13`, c'est l'héritage de la mauvaise numérotation de
`decision-12`, qui se paiera à chaque décision suivante du lot.

Je n'écris pas cette décision. Un verdict porte la signature de son auteur, et la dérogation
qu'il entraîne porte un `autorise_par` — les deux appartiennent à Frédéric, pas à moi. Le
corps de la décision, la commande exacte qui la dépose et l'entrée `derogations` exacte
qu'elle réclame sont préparés intégralement et joints au dossier. Le lot reste en
`ATTENTE_DECISION`, ce qui est l'état vrai.
