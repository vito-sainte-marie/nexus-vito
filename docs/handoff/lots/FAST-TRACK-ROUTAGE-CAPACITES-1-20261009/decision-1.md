---
protocol: nexus-handoff/2
kind: decision
lot_id: FAST-TRACK-ROUTAGE-CAPACITES-1-20261009
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: true
in_reply_to: request-1.md
---
# decision-1 — routage par capacités : APPROVED_WITH_CONDITIONS, lot clos

_Provenance : verdict rendu par ChatGPT via l'API OpenAI. Le relais l'a posté sur #28 (commentaire 6086399070, run 37969698290, 17:57:54Z), sans recopie humaine. Aucun run `claude.yml` n'a suivi, parce qu'un commentaire posté avec GITHUB_TOKEN ne déclenche aucun workflow. Le stade (a) n'était pas armé. Claude matérialise donc la décision en session le 09/10, à la demande de Frédéric (« matérialise decision-1 maintenant »), sans en changer le verdict._

## Contrôles faits par Claude avant matérialisation

- `LOT` = `FAST-TRACK-ROUTAGE-CAPACITES-1-20261009`, `REQUEST` = `request-1.md` : c'est la demande en attente dans `STATE.json` (`ATTENTE_DECISION`).
- Périmètre : les commits du lot (`b910ae9`, `0a8fc97`, `2a251c6`, plus `19668e1` sur la branche de run) sont déjà sur le rail sous les noms `e0bcafa`, `895780c`, `f18dc18` et `2f1f4ed`. Leurs patch-ids sont identiques un à un.
- Conditions de périmètre, sur `e0bcafa~1..3d34ceb` :
  - aucune modification de `.github/workflows/claude.yml` ni de `ARBITRAGES-ACQUIS.json` ;
  - aucune ligne touchant `permissions`, `contents:` ou `secrets.` dans `tests.yml` ;
  - `main` et `production` ne sont pas concernés.
- Épreuves ciblées : la CI du rail sur `3d34ceb` (run 37970667604) conclut « 306/315 — Aucune régression : seuls les 9 échecs connus subsistent ».
  - Aucune des trois épreuves ciblées ne figure parmi ces 9 échecs connus (chaîne temporelle carburant, inventaire ×5, pilotage/réception ×3) : `test_routage_capacites_canal_20261009.js`, `test_empreinte_progression_20261009.js` et `test_relais_arbitre_openai_20261007.js` sont donc vertes.
  - Aucun des deux timeouts diagnostiqués n'y apparaît.
- `RAIL_LU: INACCESSIBLE` était attendu. Le contrôle équivalent : le run 37969698290 portait `b9b3d47`, qui est sur le rail. Les seuls commits ultérieurs sont `3d34ceb` (épreuve C de l'empreinte) et ne touchent pas l'objet de l'arbitrage.

## Texte de l'arbitre

## Décision

**APPROVED_WITH_CONDITIONS.**

J’arbitre sur le texte intégral reproduit dans le réveil ; le connecteur au rail n’est pas accessible dans cette session.

Le lot relève de `OUTILLAGE_A_POSTERIORI` : aucun choix métier, secret, geste Production ou changement de `main` n’est établi. Les deux échecs de suite complète sont diagnostiqués comme des timeouts de banc et restent hors palier humain conformément à `REGRESSION_PRODUIT_VS_BANC`. Le routage vers un canal capable applique `LIMITATION_CANAL_NON_STOP`.

Réponses aux choix soumis :

1. **Portée de `HEAD` confirmée** : une empreinte de progression Handoff peut être liée au dernier commit touchant `docs/handoff`, plutôt qu’à tout `GITHUB_SHA`. Les tests doivent conserver la preuve qu’un commit étranger au domaine ne débloque pas artificiellement une empreinte identique.
2. **Pas de nouvel arbitrage acquis dans ce lot.** Le comportement proposé est déjà une application de `LIMITATION_CANAL_NON_STOP` et de `PALIER_HUMAIN_RESTREINT`. L’ajouter comme nouvelle règle autonome dans `ARBITRAGES-ACQUIS.json` constituerait un changement de doctrine distinct ; cette modification n’est ni nécessaire ni autorisée par la présente décision.
3. **Contrat à 15 champs accepté.** Une ancienne réponse à 13 champs doit être rejetée explicitement puis reformulée ; aucune conversion silencieuse.
4. **Aucune modification candidate de `claude.yml`** dans ce lot. La déduction actuelle suffit. Une modification de `main`, des secrets ou des permissions resterait soumise à son palier propre.
5. **Ordre des canaux confirmé** : à autorisation et capacité égales, un canal non humain passe avant Frédéric en application de `PALIER_HUMAIN_RESTREINT`. Cet ordre ne peut toutefois ni créer une autorisation, ni contourner un STOP, ni sélectionner un canal dépourvu de preuve de capacité.

Conditions vérifiables :

- les commits matérialisés doivent correspondre au périmètre décrit, sans modification de `main`, `production`, `.github/workflows/claude.yml`, des secrets ou des permissions ;
- aucune entrée ne doit être ajoutée à `ARBITRAGES-ACQUIS.json` par ce lot ;
- les trois épreuves ciblées doivent rester vertes en CI du rail ;
- une suite complète peut conserver les deux timeouts diagnostiqués uniquement si leur signature demeure identique et qu’aucun nouvel échec attribuable au lot n’apparaît.

RAIL_LU: INACCESSIBLE
NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: true
LOT: FAST-TRACK-ROUTAGE-CAPACITES-1-20261009
REQUEST: request-1.md
HEAD: INACCESSIBLE
LEASE: aucun
GATE_STATE: G1, épreuves ciblées locales vertes; CI du rail à exécuter
PROOF_STATE: PROOF_VALID
CONDITIONS: Ne modifier ni main, ni production, ni .github/workflows/claude.yml, ni secrets ou permissions; ne pas ajouter d’entrée à ARBITRAGES-ACQUIS.json; obtenir les trois épreuves ciblées vertes en CI du rail; n’accepter les deux timeouts diagnostiqués que si leur signature reste identique et qu’aucun nouvel échec attribuable au lot n’apparaît.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: CANAL_PUBLICATION
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Matérialiser cette décision avec outils/handoff.js decision --auteur ChatGPT sur le rail canonique, sans en modifier le verdict.


