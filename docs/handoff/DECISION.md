<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/PRISE-DE-POSTE-UN-ECRAN-20261025/decision-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: PRISE-DE-POSTE-UN-ECRAN-20261025
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6397407501
---
# Décision sur request-1.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 40191407452), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6397407501. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `PRISE-DE-POSTE-UN-ECRAN-20261025`, `REQUEST` = `request-1.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `fd028e3876458a89cd3ea4a9b12c758825755732`, `HEAD` = `fd028e3876458a89cd3ea4a9b12c758825755732`, SHA du run `fd028e3876458a89cd3ea4a9b12c758825755732`, tête du rail `fd028e3876458a89cd3ea4a9b12c758825755732`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« La lecture Production est strictement en lecture seule, filtrée sur vito-sainte-marie, limitée aux lignes publiées des 14 derniers jours et ne restitue que des agrégats par statut et tache, sans identifiant ni nom d’employé; aucune mutation Production; role_prevu est interdit comme source de proposition; repos ou conge prime, tache univoque détermine Piste ou Caisse, renfort n’est retenu qu’en l’absence de contradiction, et toute ambiguïté, panne ou contradiction entraîne zéro présélection sans bloquer la prise de poste; les données fictives sont bornées, rejouables, identifiables et exclusivement Test; une épreuve avec mutation démontre que Ma progression ne crée ni service, ni pointage, ni retard; la PR reste en brouillon vers production avec recette Guardian sur aperçu, sans fusion, promotion ni déploiement. »). Elles lient l'exécutant suivant (`session-claude-habilitee`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**Verdict : APPROVED_WITH_CONDITIONS.**

La lecture seule agrégée de Production est autorisée par la présente décision : elle ne relève ni de `SUPABASE_PRODUCTION_MUTATION` ni d’un autre motif du palier humain. Conformément à `PALIER_HUMAIN_RESTREINT` et `DELEGATION_ARBITRE`, aucun GO supplémentaire de Frédéric n’est requis.

La stratégie fonctionnelle est approuvée :

- `v_planning_officiel` est la source du planning ; `shifts.role_prevu` ne doit jamais servir à proposer le poste.
- `repos` ou `conge` produit l’état de repos.
- `tache=piste|caisse` détermine le poste lorsqu’elle est univoque.
- `quart=renfort` ou `statut=renfort` détermine Renfort en l’absence de `tache` contradictoire.
- Toute absence, erreur, valeur ambiguë ou contradiction donne **zéro présélection** et ne bloque jamais la prise de poste.
- La construction sur données fictives Test, la PR en brouillon vers `production` et la recette Guardian sur aperçu sont approuvées. `PREAUTORISATIONS_CLAUDE` couvre l’alimentation bornée de Test.
- La PR n’autorise aucune fusion, promotion ou mise en Production.

RAIL_LU: fd028e3876458a89cd3ea4a9b12c758825755732

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: PRISE-DE-POSTE-UN-ECRAN-20261025
REQUEST: request-1.md
HEAD: fd028e3876458a89cd3ea4a9b12c758825755732
LEASE: aucun
GATE_STATE: G0, CI non lancée
PROOF_STATE: PROOF_VALID
CONDITIONS: La lecture Production est strictement en lecture seule, filtrée sur vito-sainte-marie, limitée aux lignes publiées des 14 derniers jours et ne restitue que des agrégats par statut et tache, sans identifiant ni nom d’employé; aucune mutation Production; role_prevu est interdit comme source de proposition; repos ou conge prime, tache univoque détermine Piste ou Caisse, renfort n’est retenu qu’en l’absence de contradiction, et toute ambiguïté, panne ou contradiction entraîne zéro présélection sans bloquer la prise de poste; les données fictives sont bornées, rejouables, identifiables et exclusivement Test; une épreuve avec mutation démontre que Ma progression ne crée ni service, ni pointage, ni retard; la PR reste en brouillon vers production avec recette Guardian sur aperçu, sans fusion, promotion ni déploiement.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: SUPABASE_PRODUCTION_LECTURE
OWNER_NEXT: Claude
EXECUTANT_NEXT: session-claude-habilitee
ACTION_NEXT: Exécuter la lecture Production agrégée et bornée des statuts et taches publiés sur les 14 derniers jours pour vito-sainte-marie, puis en consigner uniquement les résultats agrégés.
