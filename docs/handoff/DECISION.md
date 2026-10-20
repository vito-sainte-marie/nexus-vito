<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/GOV-R1-IDENTITES-PROVENANCE-20261019/decision-2.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: GOV-R1-IDENTITES-PROVENANCE-20261019
seq: 2
author: Frédéric Bragance
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-2.md
---
# Décision sur GOV-R1-IDENTITES-PROVENANCE-20261019, request-2

**APPROVED_WITH_CONDITIONS, closes: false.** Palier : `CHANGEMENT_DOCTRINE`, réservé à Frédéric. Elle répond directement à la request-2 (`d49d2224`) et au `BLOCKED` / `STOP_REQUIRED: CHANGEMENT_DOCTRINE` rendu par l'arbitre sur cette même request.

## Décision (texte de Frédéric, repris tel que reçu)

> Je décide, sur GOV-R1 request-2 : APPROVED_WITH_CONDITIONS, closes: false.
>
> 1. Les épreuves E1 à E5 et les codes PROVENANCE_NON_ETABLIE, PROVENANCE_INVALIDE et PROVENANCE_INSUFFISANTE sont validés tels quels.
> 2. Voie A puis B. A : code P5 minimal (champ de provenance, arrêt explicite), écrit contre les épreuves, qui doivent être vues rouges avant le code puis vertes après. B : mes réglages (identité distincte ou clé de signature, protection du rail R7), décidés séparément.
> 3. Tant que B n'est pas fait, le niveau 2 explicitement marqué suffit pour la doctrine, la documentation et les actions réversibles sur Test. Le niveau 3 est exigé pour la Production et l'irréversible ; à défaut, ces opérations restent soumises à mon geste direct.
> 4. Ne pas matérialiser le BLOCKED de l'arbitre : cette décision y répond directement.
> 5. Rien n'est appliqué sans décision ultérieure sur le code de la voie A ; l'incident SQL de l'étape 5 reste ouvert.

Le texte reçu commençait par « e décide » ; la faute de frappe est corrigée ici, rien d'autre n'est changé.

## Conséquences retenues par Claude Code (à relire par Frédéric)

- Les épreuves de `docs/gouvernance/v2/EPREUVES-FALSIFICATION-PROVENANCE-20261019.md` (`f426dbad`) sont validées sans amendement ; leur statut de brouillon doit être mis à jour par un commit ultérieur.
- Voie A : aucun code d'outil n'est écrit par cette décision. Le code attend une décision ultérieure ; avant lui, E1 à E5 sont exécutées et vues rouges, puis vertes après le code.
- Voie B : aucun réglage n'est fait ni autorisé par cette décision (identité, clé, protection du rail, relecteur).
- Le blocage de l'arbitre sur la request-2 n'est pas matérialisé sur le rail.

## Conditions

1. Rien n'est appliqué (outil, workflow, permission, secret, identité, connecteur) tant qu'une décision ultérieure de Frédéric n'a pas porté sur le code de la voie A.
2. Aucune garde n'est livrée sans que l'épreuve correspondante ait été vue rouge avant le code, puis verte après.
3. Un GO de niveau 2 doit être explicitement marqué comme tel. Avant la voie B, il suffit pour la doctrine, la documentation et les actions réversibles sur Test ; il ne suffit ni pour la Production ni pour l'irréversible, qui restent soumis au geste direct de Frédéric.
4. Le compte partagé seul ne prouve pas l'identité de Frédéric.
5. L'incident SQL d'ETAPE5 reste ouvert ; ce lot ne le régularise pas, et ne clôt pas ETAPE5.

## Provenance (niveau 2, rapportée, non vérifiée)

Le texte ci-dessus a été reçu dans la conversation avec Claude Code, le 19/10/2026, comme message collé de Frédéric. Claude Code ne peut pas vérifier qui l'a écrit. Frédéric a ensuite écrit dans la même conversation, le 19/10/2026 à 21:20 (UTC-4, soit 2026-10-20T01:20Z) : « oui c'est ma reponse et goo commit et push », confirmant qu'il en est l'auteur après avoir pu relire ce brouillon. Cette confirmation est elle-même rapportée par Claude Code, sans vérification indépendante. Les conséquences et les conditions 1 à 5 ont été rédigées par Claude Code à partir de ce texte ; Frédéric doit les relire avant dépôt. Dépôt sous le compte GitHub `vito-sainte-marie`, partagé avec des agents : il ne prouve pas l'identité de l'auteur ; le niveau 3 n'est pas atteignable avec l'outil actuel.
