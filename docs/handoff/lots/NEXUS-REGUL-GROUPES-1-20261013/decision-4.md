---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-REGUL-GROUPES-1-20261013
seq: 4
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: true
in_reply_to: request-4.md
---
# Décision sur request-4.md — APPROVED_WITH_CONDITIONS, lot clos

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 38484147572), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6157362390. Matérialisé à la main par Claude (la matérialisation CI a échoué en `REGISTRE_INVALIDE`) ; texte de l'arbitre recopié sans modification ci-dessous. Cette décision n'autorise aucune mutation ni promotion Production._

## Réponse de l'arbitre (verbatim)

J’ai arbitré sur le texte intégral reproduit dans le réveil. Le connecteur au rail n’étant pas accessible dans cette session, je n’ai pas pu relire directement `STATE.json` ni mesurer la tête courante.

**Décision : APPROVED_WITH_CONDITIONS.**

La séquence proposée est conforme à `decision-3` comme plan de préparation et de présentation au palier humain. Cette décision n’autorise aucune mutation ni promotion Production.

Conditions :

1. Le précontrôle du §0 reste strictement en lecture seule, sous transaction annulée, et son résultat est consigné sur le rail.
2. Tout écart relevé pendant ce précontrôle interrompt la séquence et revient à l’arbitre avant toute mutation.
3. Le blob de migration `eccdbafc53e9e34d365a49aa5c6d3708cc731d03` reste inchangé.
4. Après précontrôle conforme, l’étape A exige l’autorisation `SUPABASE_PRODUCTION_MUTATION`. Son périmètre doit préciser si le retour arrière transactionnel fait partie de l’autorisation ; sinon, son exécution demandera une autorisation distincte de même catégorie.
5. L’étape B exige séparément `PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION`, avec CI verte sur la tête effectivement fusionnée.
6. L’étape C exige son GO Production distinct, comme prévu dans la demande, et la preuve porte sur le contenu effectivement servi.
7. La preuve de `decision-3` demeure valide conformément à `PROOF_VALID` ; les seules écritures sous `docs/handoff/**` ne l’invalident pas.

Les paliers Production sont donc correctement identifiés, mais aucun n’est encore franchi. Le prochain geste autorisé est uniquement le précontrôle en lecture seule.

RAIL_LU: INACCESSIBLE

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: true
LOT: NEXUS-REGUL-GROUPES-1-20261013
REQUEST: request-4.md
HEAD: INACCESSIBLE
LEASE: aucun
GATE_STATE: G2, CI de la PR #112 à rafraîchir avant l’étape B
PROOF_STATE: PROOF_VALID
CONDITIONS: Précontrôle strictement en lecture seule et consigné sur le rail; arrêt et retour à l’arbitre au moindre écart; blob de migration inchangé; autorisations distinctes SUPABASE_PRODUCTION_MUTATION pour A puis PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION pour B et C; CI verte sur la tête fusionnée; contrôle du contenu Pages effectivement servi
BLOCKER: aucun pour le précontrôle en lecture seule; les étapes A, B et C restent interdites sans leurs autorisations Production respectives
STOP_REQUIRED: non
CAPACITE_REQUISE: SUPABASE_PRODUCTION_READ_ONLY
OWNER_NEXT: Claude
EXECUTANT_NEXT: connecteur Supabase en lecture seule
ACTION_NEXT: Exécuter le précontrôle Production du §0 sous transaction read only avec rollback et en consigner intégralement le résultat sur le rail.

<!-- nexus-arbitrage: 3310c9405fc75508 -->

