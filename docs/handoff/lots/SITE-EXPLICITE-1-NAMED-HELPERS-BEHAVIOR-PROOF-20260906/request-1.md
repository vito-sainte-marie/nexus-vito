---
protocol: nexus-handoff/2
kind: request
lot_id: SITE-EXPLICITE-1-NAMED-HELPERS-BEHAVIOR-PROOF-20260906
seq: 1
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=501c0c7 production=501c0c7
  - id: est-pompiste-du-jour
    classe: VERIFIED
    valeur: 5 cas - anomalie confirmee, frontiere de journee en UTC
  - id: est-receptionniste
    classe: VERIFIED
    valeur: 6 cas - conforme, compare deux colonnes date
  - id: cause-verifiee
    classe: VERIFIED
    valeur: service du 05/09 20h49 station date du 06/09 en UTC
  - id: aucune-correction
    classe: VERIFIED
    valeur: aucune policy, fonction ni donnee modifiee
  - id: activation-bloquante-non-preparee
    classe: VERIFIED
    valeur: condition si et seulement si non remplie
  - id: registre-anomalie
    classe: VERIFIED
    valeur: inscrite dans l entree de l aide, pas tue
  - id: suite
    classe: VERIFIED
    valeur: 192/201
  - id: sept-policies-safe-a-tort
    classe: HUMAN
    valeur: la garde dit vrai sur la forme et faux sur le fond
  - id: cas-limites
    classe: HUMAN
    valeur: minuit station et service a cheval non eprouves
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete, aucun merge, aucun deploiement
---

# SITE-EXPLICITE-1-NAMED-HELPERS-BEHAVIOR-PROOF — une aide conforme, une défaillante

## Contrat anti-dérive

| Champ | Valeur |
|---|---|
| `objectif_metier` | Savoir si les aides qui gardent les écritures carburant tiennent réellement leur contrat. |
| `gain_attendu` | **Fiabilité** — deux aides déclaraient contrôler la portée ; une seule le fait. |
| `contrats_touches` | **aucun** — phase de mesure |
| `guardians_requis` | Architecture · Security & Isolation · QA / Regression |
| `preuves_exigees` | 6 cas imposés sur `est_pompiste_du_jour` · seconde aide si coût faible |
| `definition_de_termine` | Les deux aides éprouvées, anomalie remontée **sans correction**. **Atteinte.** |

## Résumé

**Les preuves ne sont pas conformes. L'activation bloquante n'est donc pas
préparée** — la décision la conditionnait à un « si et seulement si ».

| Aide | Verdict |
|---|---|
| `est_receptionniste_livraison_du_jour` | **CONFORME** — 6 cas sur 6 |
| `est_pompiste_du_jour` | **DÉFAILLANTE** — frontière de journée en UTC |

## 1. `est_pompiste_du_jour` — l'anomalie

```
1. pompiste du jour, SON site        : true
2. meme acteur, AUTRE site           : false
3. renfort du meme site              : false      (le rôle ne se déduit pas du site)
4. employe sans service pompiste     : true       ← ANOMALIE
5. service pompiste CLOS ce jour     : true       ← à noter
```

Le cas 4 n'est pas un faux positif de mon test : je l'ai vérifié plutôt que de
le supposer.

```
service 41c935d4 (pompiste)
  heure_debut  : 2026-09-06 00:49 UTC
  date UTC     : 2026-09-06   ← ce que compare la fonction
  date STATION : 2026-09-05   ← le jour où le service a réellement eu lieu
  aujourd'hui  : 2026-09-06 (UTC comme station)
```

La fonction date le service par `heure_debut::date`, donc **en UTC**, alors
que la journée d'un commerce se compte dans **son fuseau**.

### Conséquence concrète

Un service de **soirée** — après 20:00 en Martinique — bascule au lendemain en
UTC. L'acteur conserve alors ses droits de pompiste **pendant toute la
journée-station suivante**, bien après la fin de son service.

Ce n'est pas une porte ouverte à un autre commerce : la portée par site tient
(cas 2). C'est une **fenêtre de sur-permission dans le temps**, sur des
écritures réelles — relevés carburant, jaugeage, réception de livraison.

**C'est la même famille que C2 et A17** : une frontière de journée calculée
sur la mauvaise horloge. Le chantier a corrigé ce défaut pour le quart ; il
subsiste ici, dans une aide de sécurité.

### Le cas 5, distinct et moins grave

Un service **clos** compte encore. C'est discutable plutôt que faux — la
personne *a été* pompiste ce jour-là. Je le signale sans le qualifier
d'anomalie : c'est une décision de contrat, pas une erreur d'horloge.

## 2. `est_receptionniste_livraison_du_jour` — conforme

```
R1 receptionnaire, SON site, CE jour : true
R2 meme acteur, AUTRE site           : false
R3 meme acteur, AUTRE jour           : false
R4 visite EN COURS (non terminee)    : false     (le statut est exigé)
R5 sa visite terminee, la VEILLE     : true      (bornée au jour demandé)
R6 acteur sans aucune visite         : false
```

Elle compare **deux colonnes `date`** — `v.date_visite = p_date` — donc aucune
horloge n'intervient et l'ambiguïté de fuseau n'existe pas. Elle exige en
outre un statut terminé.

Le coût du fixture était faible : trois lignes, aucune clé étrangère. Je l'ai
donc éprouvée dans ce lot comme la décision l'autorisait, plutôt que de la
laisser devenir une dette juste après la première preuve.

## 3. Ce que je n'ai pas fait, et pourquoi

- **Aucune correction.** La décision l'interdit avant retour au Handoff.
- **Aucune activation bloquante.** Elle était conditionnée à des preuves
  conformes ; elles ne le sont pas.
- **Aucun changement de la garde.** Elle continue de classer `SAFE` les sept
  policies carburant qui s'appuient sur `est_pompiste_du_jour` — voir le
  risque n° 1, qui est le point le plus important de ce lot.

## 4. Registre mis à jour — l'anomalie est inscrite, pas tue

L'entrée `est_pompiste_du_jour` porte désormais son anomalie : nature,
conséquence, famille, et statut « remontée au Handoff, non corrigée ».

C'était le sens même du registre : une aide déclarée sûre **sur lecture
seule** est exactement ce qu'il devait empêcher. Il a fallu la preuve
comportementale pour le voir — la lecture de la fonction, elle, paraissait
irréprochable.

## Avis des Guardians

### Security & Isolation Guardian

L'isolation **entre commerces** n'est pas en cause : le cas 2 le montre. Ce
qui est en cause est l'isolation **dans le temps**, et elle a des effets
réels : un pompiste du soir garde le droit d'écrire des relevés carburant le
lendemain entier.

**Avis : à corriger avant l'activation bloquante.** Bloquer la CI sur une
garde qui déclare `SAFE` sept policies adossées à une aide défaillante
reviendrait à faire certifier une erreur par un instrument.

### Architecture Guardian

La correction paraît simple — comparer au fuseau de la station — mais elle
touche une fonction `SECURITY DEFINER` utilisée par sept policies, et le
fuseau doit venir de `sites.timezone`, pas d'une constante. C'est exactement
le contrat C2, appliqué à une garde de sécurité.

**Avis : ce n'est pas une correction opportuniste, c'est un lot.** Elle
mérite ses propres preuves avant/après, sur les sept policies.

### QA / Regression Guardian

Le lot valide la méthode : **une aide qui se lit bien peut se comporter
mal**. `est_pompiste_du_jour` est limpide à la lecture ; il a fallu construire
un service de soirée pour voir le défaut.

**Réserve** : mes cinq cas ne couvrent pas tout. Je n'ai pas éprouvé le
passage de minuit station, ni un service à cheval sur deux jours. La
conformité de la seconde aide est établie sur six cas, pas démontrée en
général.

## Preuves

- `est_pompiste_du_jour` : 5 cas, **anomalie confirmée** puis vérifiée sur les
  dates réelles du service.
- `est_receptionniste_livraison_du_jour` : 6 cas, **conforme**.
- Identités réelles, transactions annulées, aucune donnée persistée.
- Registre des aides mis à jour avec l'anomalie.
- Suite `192/201`, mêmes 9 échecs historiques.
- **Aucune policy, aucune fonction, aucune donnée modifiée.**
- `main` et `production` : `501c0c7` — preuve calculée par l'outillage.

## Risques / anomalies

1. **Sept policies carburant sont classées `SAFE` sur la foi d'une aide
   défaillante.** La garde dit vrai sur la forme et faux sur le fond. C'est le
   risque principal, et c'est pourquoi je n'ai pas activé le blocage.
2. **Fenêtre de sur-permission** ouverte tant que la correction n'a pas lieu.
3. **Le cas « service clos »** reste une question de contrat non tranchée.
4. Couverture des cas limites incomplète — minuit station, service à cheval.

## Questions pour arbitrage

**Q61 — Corriger `est_pompiste_du_jour` ?** Recommandation : **oui, dans un
lot dédié**, en comparant au fuseau de `sites.timezone` comme l'exige le
contrat C2 — pas à une constante. Sept policies en dépendent : cela mérite des
preuves avant/après, pas une retouche au passage.

**Q62 — Un service clos compte-t-il encore ?** Recommandation : **le trancher
explicitement**. Aujourd'hui oui, par effet de bord d'une requête qui ignore
`statut`. Que la réponse soit oui ou non, elle doit être écrite.

**Q63 — La garde doit-elle rétrograder les policies adossées à une aide
défaillante ?** Recommandation : **oui**, et c'est un vrai manque de
conception : le registre sait qu'une aide est défaillante, la garde continue
de la traiter comme sûre. Sans cela, le registre documente pendant que la
garde rassure.

## Action attendue de ChatGPT

Arbitrer Q61, Q62, Q63 pour le `LOT_ID`
**SITE-EXPLICITE-1-NAMED-HELPERS-BEHAVIOR-PROOF-20260906**. **L'activation
bloquante n'est pas demandée ; la classe D reste fermée.**
