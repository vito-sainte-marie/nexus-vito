---
protocol: nexus-handoff/2
kind: request
lot_id: GOV-R3-CONSOMMATION-CLOTURE-20261020
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
# GOV-R3-CONSOMMATION-CLOTURE-20261020 : consommation automatique d'une clôture déposée par la CI, par O3 (hors workflow)

**Domaine :** gouvernance. **Origine :** note de Frédéric du 20/10/2026 (« la CI ne déclenche personne pour consommer une clôture qu'elle dépose. Il faut que ce soit automatique »), renvoyée de R2 à R3, et GO du 20/10/2026 : « ouvre la R3 : consommation automatique par O3 ».
**Redépôt :** la request-1 (`3fa64c9d`) ne déclarait pas `wake_to` ; le réveil de l'arbitre n'a donc pas été composé (run 39474481132). Cette request-2 a le même contenu, avec `wake_to` vers l'issue #28. La request-1 n'a reçu aucune décision.
**Nature de cette request-2 :** cadrage et épreuves de falsification seulement. Aucun code, workflow, permission, secret, identité ni connecteur n'est modifié par elle.
**Écart de numérotation, dit d'emblée :** dans `PLAN-RACCORDEMENT-GUARDIAN.md` §2, « R3 » désigne le journal des transitions et de provenance. Ce lot reprend le nom R3 pour la consommation des clôtures, sur demande de Frédéric ; le journal des transitions reste à cadrer (lot distinct, ou second objet de celui-ci si l'arbitre le préfère).

## Constat établi (R2, `mesure-consommations-20261020.md`)

- `relancer-claude-ci.js` rend `RIEN_A_FAIRE` pour toute décision `closes: true` : voulu par la garde, pas accidentel. La CI ne consomme pas (`tests.yml`, ARMEMENT-ARBITRAGE-AUTONOME-1 decision-1:54).
- Deux clôtures déposées par la CI le 20/10/2026 (R1 decision-4, R2 decision-3) sont restées en `ATTENTE_DECISION` jusqu'à une consommation manuelle.
- `handoff.js consommer` sait déjà consommer « nu » une décision `closes: true` (`--cloture`), après la garde de provenance P5 (`verifierProvenanceDecision`). Ce qui manque n'est pas le geste, c'est **qui l'exécute, sans humain, et dans quel garde-fou**.

## Objet : O3

Un outil de `outils/` qui, appelé à l'ouverture d'une session ou à la demande (futur appelant : la vigie R4), repère et consomme les clôtures en attente, sans toucher à aucun workflow. Conception proposée :

1. **Détection (lecture seule).** Un lot est candidat si : statut `ATTENTE_DECISION`, dernière décision `closes: true`, elle répond à la demande active (`demandeVisee`), et son commit n'est pas déjà consommé.
2. **Contrôles avant tout geste, tous bloquants :**
   - garde P5 existante (`verifierProvenanceDecision`) ;
   - vérificateur de source de R2 (`verifier-source-decision.js`), avec l'API réelle ; API injoignable = arrêt explicite, jamais un succès ;
   - décision issue de la CI seulement (`author: ChatGPT`, provenance `ci`, commit `github-actions[bot]`) ; une décision humaine n'est jamais consommée automatiquement ;
   - `verifier` vert avant et après ; aucun palier Frédéric dans le contrat (`STOP_REQUIRED: non`) ; aucune condition ni `ACTION_NEXT` autre que la matérialisation ;
   - un seul lot à la fois ; clé d'idempotence (lot + commit de décision).
3. **Geste.** `consommer <lot> --prise-en-charge` puis consommation `--cloture` (les deux temps existants), un commit de registre. **Jamais de jugement métier : l'outil vérifie la forme et la source, il ne rouvre pas le fond (E10).**
4. **Mode par défaut = rapport.** `--appliquer` écrit dans l'arbre de travail et commite localement ; le push reste le geste de la session, selon les règles de la session. Aucune écriture sur une branche distante par l'outil.
5. **Traçabilité.** Le commit nomme la décision, l'empreinte vérifiée et le commentaire source.

## Ce que O3 ne résout pas (dit, pas masqué)

- **Elle n'est pas automatique au sens fort** : rien ne s'exécute tant qu'aucune session ne s'ouvre. Une clôture déposée la nuit attend la prochaine ouverture. Le déclencheur sans session est la vigie R4 (workflow planifié, GO Frédéric) ou O1/O2 (workflow/permission), tous hors de ce lot.
- Le risque résiduel hérité de R1 et R2 demeure : `claude.yml` et le relais partagent `github-actions[bot]`. La concordance d'empreinte lie le dépôt au commentaire, pas à l'émetteur.
- **Appel à l'ouverture de session :** l'appelant naturel serait un hook de session ou une consigne de prise de poste. Un hook est une configuration persistante : **non posé par ce lot**, listé pour arbitrage séparé. Tant qu'il n'existe pas, l'outil s'appelle à la main ou par la consigne de session.

## Épreuves de falsification proposées (à écrire rouges avant tout code)

- G1 clôture CI conforme, source concordante : consommée, `DECISION_CONSOMMEE`, `verifier` vert.
- G2 décision altérée après dépôt (empreinte divergente) : refus, aucun changement de STATE.
- G3 API injoignable : arrêt explicite, aucun changement.
- G4 décision `author` humain ou provenance non CI : jamais consommée.
- G5 `closes: false`, ou condition, ou palier Frédéric dans le contrat : jamais consommée.
- G6 décision ne répondant pas à la demande active : refus.
- G7 deuxième appel : sans effet (idempotence).
- G8 deux lots candidats : un seul consommé par appel, ou arrêt.
- G9 rapport par défaut : aucune écriture.
- G10 l'outil ne pousse jamais et ne touche à aucun fichier hors `docs/handoff/STATE.json` (et la publication d'en-attente déjà prévue par `consommer`).

## Hors périmètre

Voie B ; `tests.yml` et tout workflow ; permission, secret, identité, connecteur ; hook de session ou toute configuration persistante ; O1/O2 ; vigie R4 ; Production ; règle des niveaux ; incident SQL d'ETAPE5 et clôture d'ETAPE5 ; toute écriture Supabase, fusion ou déploiement.

## Décision demandée

1. Admettre O3 et les épreuves G1–G10 comme périmètre, ou les amender.
2. Dire si l'outil peut être écrit dans `outils/` sans câblage (comme en R2), et si le journal des transitions du plan R3 est rattaché à ce lot ou laissé à un lot distinct.
3. Nommer tout palier réservé que l'arbitre verrait dans ce cadrage ; Claude Code s'arrête alors et rapporte. Rien n'est appliqué par cette demande.
