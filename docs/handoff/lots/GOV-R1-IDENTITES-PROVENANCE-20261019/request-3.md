---
protocol: nexus-handoff/2
kind: request
lot_id: GOV-R1-IDENTITES-PROVENANCE-20261019
seq: 3
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
# GOV-R1-IDENTITES-PROVENANCE-20261019 : mise en œuvre de la voie A (contrôle de provenance P5)

**Domaine :** gouvernance. **Préparé par :** Claude Code. **Nature :** demande d'arbitrage d'une mise en œuvre déléguée. Cette demande ne modifie rien par elle-même.

## Objet

La decision-2 (`32d128ba`, consommée avec la preuve `7a0acd14`) valide les épreuves E1 à E5 et les codes `PROVENANCE_NON_ETABLIE`, `PROVENANCE_INVALIDE`, `PROVENANCE_INSUFFISANTE`, retient la voie A puis B et exige une décision ultérieure sur le code de la voie A. Frédéric a ensuite délégué cette mise en œuvre à l'arbitre. La présente demande l'invite à arbitrer et à cadrer la voie A (code P5 minimal) dans ce périmètre.

## Délégation de Frédéric (citée mot pour mot)

Reçue dans la conversation avec Claude Code le 19/10/2026 à 21:25 (UTC-4, soit 2026-10-20T01:25Z, horodatage de la transcription de la session) :

> Délégation : la mise en œuvre de la voie A est déléguée à l’arbitre (code du contrôle de provenance, épreuves vues rouges puis vertes, corrections, clôture du lot), à condition de ne toucher ni permission, secret, identité, connecteur, workflow d’armement, Production, ni la règle des niveaux fixée au point 3. Tout écart à ce périmètre me revient.

Précisions de Frédéric à 21:26 (UTC-4, soit 01:26Z), en réponse à une question de Claude Code :

> tests.yml reste hors périmètre. E5 se code dans l’outil, par lecture de l’API : le commentaire désigné est posté par github-actions[bot], il cite un run de tests.yml dont l’étape de relais a réussi, et son contrat correspond à la décision. Si l’API ne répond pas, arrêt explicite. Consigne la limite : un job claude.yml utilise le même jeton ; ce risque résiduel est renvoyé à R2 et à la voie B.
>
> Si l’arbitre bloque encore pour CHANGEMENT_DOCTRINE sur une étape de ce périmètre, arrête-toi et rapporte : on inscrira alors la délégation au registre des acquis.

Provenance : décision exprimée dans la conversation, rapportée par Claude Code, non vérifiée indépendamment (niveau 2). Cette délégation n'est pas inscrite au registre des acquis (`ARBITRAGES-ACQUIS.json`) ; l'arbitre n'a donc pas, aujourd'hui, d'acquis `DELEGATION_ARBITRE` qui la couvre.

## Ce qui est demandé

1. Arbitrer la mise en œuvre de la voie A dans le périmètre délégué : champ de provenance dans l'enveloppe, arrêt explicite pour les paliers réservés à Frédéric, contre les épreuves E1 à E5.
2. Si le périmètre est admis, rendre le verdict qui ouvre la phase d'exécution. Claude Code exécutera : d'abord les épreuves E1 à E5 rouges sur l'outil actuel (E1 observée, E2 à E5 déduites), ensuite le code, ensuite les épreuves vertes, avec le cas de contrôle vert (matérialisation par la CI).
3. Rendre la clôture du lot (`closes: true`) seulement après épreuves vertes et preuves déposées.

## Périmètre, tel que borné par Frédéric

**Inclus :** code du contrôle de provenance dans `outils/` ; champ de provenance dans l'enveloppe ; E5 par lecture de l'API GitHub (commentaire de `github-actions[bot]` citant un run de `tests.yml` dont l'étape de relais a réussi, contrat conforme à la décision ; arrêt explicite si l'API ne répond pas) ; épreuves rouges puis vertes ; corrections ; clôture du lot.

**Exclus, retour à Frédéric en cas d'écart :** toute permission, secret, identité, connecteur ; tout workflow d'armement et `tests.yml` ; Production ; la règle des niveaux (condition 3 de la decision-2 : le niveau 2 explicitement marqué suffit pour la doctrine, la documentation et les actions réversibles sur Test ; le niveau 3 est exigé pour la Production et l'irréversible, à défaut geste direct de Frédéric) ; les réglages de la voie B ; l'incident SQL d'ETAPE5 et la clôture d'ETAPE5.

## Limites connues

- **Risque résiduel de E5.** Un job `claude.yml` utilise le même jeton que le relais et peut poster sous `github-actions[bot]`. La vérification ne distingue donc pas la CI de relais d'un job d'agent. Renvoyé à R2 et à la voie B ; non résolu par la voie A.
- Le niveau 3 reste inatteignable sous l'outil actuel : la voie A rend l'arrêt explicite, elle n'établit aucune identité.
- E2 à E5 n'ont pas été vues rouges ; seule E1 l'a été.
- La forme du champ de provenance reste à décider dans le cadre de l'arbitrage.

## Décision demandée

Dans le périmètre ci-dessus, `APPROVED` ou `APPROVED_WITH_CONDITIONS`. Si l'arbitre estime qu'une étape sort du périmètre ou exige un palier réservé (`CHANGEMENT_DOCTRINE`), il le dit : Claude Code s'arrête et rapporte, la délégation sera alors inscrite au registre des acquis par Frédéric.

## Preuve des conditions de decision-2

Les cinq conditions de `decision-2.md` (`32d128ba`) :

1. **Rien n'est appliqué avant une décision sur le code de la voie A.** Respectée : aucun code d'outil n'a été écrit ; `git diff d49d2224..4ab10060` ne contient que le document des épreuves, `STATE.json` et la decision-2. Cette demande sollicite l'arbitrage de la mise en œuvre, elle ne l'exécute pas.
2. **Épreuve vue rouge avant le code, verte après.** Respectée à ce stade : aucune garde n'est livrée. Seule E1 est observée rouge ; l'exécution des autres rouges précède le code dans la séquence proposée.
3. **Niveau 2 marqué comme tel.** Respectée : la délégation et ses précisions sont consignées en niveau 2, rapportées, avec leur heure ; la règle des niveaux n'est pas touchée.
4. **Le compte partagé seul ne prouve pas l'identité.** Respectée : le dépôt se fait sous `vito-sainte-marie`, ce qui est dit ici ; la limite de E5 sur `claude.yml` est consignée.
5. **Incident SQL d'ETAPE5 ouvert.** Respectée : non traité, listé hors périmètre.
