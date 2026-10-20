<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/GOV-R1-IDENTITES-PROVENANCE-20261019/request-2.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: GOV-R1-IDENTITES-PROVENANCE-20261019
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=ff19b8a0 production=d3244d86
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 158-fichiers
---
# GOV-R1-IDENTITES-PROVENANCE-20261019 : validation des épreuves et état des pistes

**Domaine :** gouvernance. **Préparé par :** Claude Code. **Nature :** documentation et décision. Aucun outil, workflow, permission, secret ni identité n'est modifié par cette demande.

## Objet

La decision-1 (`091437cc`, consommée avec la preuve `f426dbad`) a retenu P5 d'abord et exigé que les épreuves de falsification soient écrites et validées avant tout code d'outil. Elles sont écrites : `docs/gouvernance/v2/EPREUVES-FALSIFICATION-PROVENANCE-20261019.md` (E1 à E5). Cette demande en sollicite la validation et expose ce que l'instruction des pistes a établi, en lecture seule, le 20/10/2026.

## Constats d'instruction (lecture seule, API GitHub, 20/10/2026 ~01:15Z)

| Point | Constat | Conséquence |
|---|---|---|
| Collaborateurs du dépôt | un seul : `vito-sainte-marie` (propriétaire, admin) ; c'est aussi le compte des agents | aucun second compte ne peut aujourd'hui distinguer Frédéric d'un agent |
| Environnement `github-pages` | relecteurs requis : `vito-sainte-marie` seul ; `prevent_self_review: false` | P2 en l'état n'établit rien : le compte approbateur est le compte déposant |
| Commits récents du rail | tous `unsigned`, auteur et committer `vito-sainte-marie` | P1 n'existe pas aujourd'hui : aucune clé de signature vérifiée par la plateforme |
| Rail `handoff-continuite-20260920` | `protected: false` ; les deux rulesets actifs visent `production` et `main` | le rail, où se déposent les décisions, n'a aucune protection (objet de R7) |
| Ruleset Production | sans acteur de contournement ; règles : suppression, non-fast-forward, PR, contrôles requis | la protection existe côté `production`, pas côté rail |

Non établi, donc non affirmé : ce que ChatGPT peut attester côté API (P4) ; si la session Claude Code peut être condensée par une empreinte externe (P3). Ces deux points demandent une vérification que je n'ai pas faite.

## Ce qui est demandé

1. **Valider, amender ou refuser les épreuves E1 à E5.** Détail des points à trancher : les trois codes d'arrêt proposés (`PROVENANCE_NON_ETABLIE`, `PROVENANCE_INVALIDE`, `PROVENANCE_INSUFFISANTE`) ; E5 (un `author: ChatGPT` déposé par un agent est refusé, seule la matérialisation par la CI est admise).
2. **Choisir la suite**, en connaissant les constats ci-dessus :
   - **Voie A, code P5 minimal** : un champ de provenance dans l'enveloppe et l'arrêt explicite pour les paliers réservés à Frédéric, écrit contre les épreuves validées. Le niveau 3 reste inatteignable.
   - **Voie B, réglages d'abord (à Frédéric)** : création d'une identité distincte et/ou clé de signature (P1), protection du rail (R7), relecteur distinct (P2). Aucun n'est faisable par un agent ; chacun change une permission ou une identité.
   - Les voies ne s'excluent pas : A rend l'arrêt explicite maintenant, B conditionne tout accès au niveau 3.

## Hors périmètre

Incident SQL de l'étape 5 (ouvert) ; clôture d'ETAPE5 ; Supabase ; fusion ; déploiement ; toute modification de permission, secret, identité, connecteur ou workflow ; tout code d'outil avant décision sur les épreuves.

## Décision demandée

`CHANGEMENT_DOCTRINE`, palier de Frédéric : épreuves E1 à E5 validées ou amendées, et voie retenue (A, B, ou A puis B).

## Preuve des conditions de decision-1

Les cinq conditions de `decision-1.md` (`091437cc`) ont été acceptées par Frédéric dans la conversation avec Claude Code le 19/10/2026 à 21:00 (UTC-4), consignées dans le commit de preuve `f426dbad` ; décision exprimée, rapportée par Claude Code, non vérifiée indépendamment. Respect des conditions :

1. **P5 est une orientation, rien n'est appliqué.** Respectée : P5 n'est implémentée nulle part ; cette demande propose seulement une voie A dont la mise en œuvre exige une décision.
2. **Épreuves écrites et validées avant tout code d'outil.** Écrites : E1 à E5, dans `docs/gouvernance/v2/EPREUVES-FALSIFICATION-PROVENANCE-20261019.md` (`f426dbad`). Validation : non acquise, c'est l'objet de la question 1 ci-dessus. Aucun code d'outil n'a été écrit ; `git diff 091437cc..HEAD` ne contient que ce document et `STATE.json`.
3. **Aucune modification d'outil, workflow, permission, secret, identité ou connecteur ; R1 et R7 restent à Frédéric.** Respectée : les constats d'instruction sont des lectures seules de l'API GitHub ; aucun réglage n'a été exécuté.
4. **Le niveau 2 ne vaut jamais le niveau 3 ; le compte partagé seul ne prouve pas l'identité.** Respectée : la confirmation du 19/10 est qualifiée niveau 1/2 et E4 en fait une épreuve ; le constat « un seul collaborateur, relecteur unique, auto-relecture permise » est reporté tel quel.
5. **L'incident SQL de l'étape 5 reste ouvert.** Respectée : non traité, listé hors périmètre.
