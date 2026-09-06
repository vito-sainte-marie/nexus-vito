# NEXUS Handoff — DECISION

LOT_ID: HANDOFF-V2-EVENEMENTIEL-20260905
DECISION: APPROVED_WITH_CONDITIONS
AUTHOR: ChatGPT
BRANCH: config-par-environnement

## Décision

La conception générale de **NEXUS Handoff v2 événementiel** est approuvée avec conditions.

Le diagnostic v1 est pertinent : le protocole actuel repose encore trop sur la discipline des acteurs, écrase l'état courant, ne matérialise pas la consommation d'une décision et ne distingue pas suffisamment les preuves recalculables des affirmations déclaratives. v2 doit donc devenir un protocole **adressable, append-only, validable par machine et compatible avec v1**.

Le bloqueur 1 reste ouvert. Ce lot ne doit modifier aucun comportement métier NEXUS et ne constitue aucune autorisation Production.

## Q10 — `APPROVED_CLOSED`

Décision : **ne pas en faire un nouveau statut canonique de v2**.

Le problème observé vient précisément du mélange entre deux concepts :

- la décision d'arbitrage ;
- l'état de cycle de vie du lot.

Le vocabulaire canonique futur reste :

- `APPROVED`
- `APPROVED_WITH_CONDITIONS`
- `BLOCKED`
- `NEEDS_EVIDENCE`

Ajouter un champ séparé, par exemple `closes: true|false`, afin d'exprimer qu'une décision ferme ou non le lot.

`APPROVED_CLOSED` doit néanmoins rester **accepté en lecture comme valeur legacy** pour les décisions S-4 et S-5 déjà rendues. Ne pas réécrire l'historique et ne pas modifier leur sens. Le validateur peut normaliser cette ancienne valeur en mémoire comme `decision=APPROVED`, `closes=true`, mais les fichiers historiques restent tels quels.

Principe : **compatibilité ascendante sans perpétuer une ambiguïté de modèle**.

## Q11 — caractère bloquant du validateur

Décision : **oui, bloquant sur les invariants protocolaires ; observation contrôlée sur les preuves recalculées**.

Blocage CI immédiat pour :

- `lot_id` absent, invalide ou incohérent ;
- statut/décision hors vocabulaire canonique ou legacy explicitement autorisé ;
- `in_reply_to` absent, inexistant ou ne correspondant pas au lot ;
- décision répondant à une demande qui n'est plus la demande active attendue ;
- tentative de réutilisation d'une décision déjà marquée consommée ;
- branche déclarée incompatible avec le contexte d'exécution du handoff ;
- structure du registre ou de `STATE.json` invalide.

Pendant **un lot d'observation**, les écarts entre preuves déclarées et preuves recalculées peuvent être des avertissements, afin de calibrer le dispositif sans bloquer un lot légitime à cause d'une métrique encore mal définie.

Exception : une contradiction machine-vérifiable qui toucherait un invariant de sécurité ou de protection Production ne doit jamais être réduite à un simple avertissement. Par exemple, si la branche ou les refs protégées déclarées ne correspondent pas à ce que la CI constate, le handoff doit échouer.

À la fin du lot d'observation, Claude doit proposer l'arbitrage permettant de décider quelles preuves recalculées deviennent bloquantes.

## Q12 — couche événementielle / session

Décision : **inclure les deux couches**, avec vocabulaire précis.

1. **Couche événement GitHub/CI** : valide et publie un événement exploitable lorsqu'une demande ou une décision valide arrive.
2. **Couche session** : une session Claude encore vivante peut surveiller l'événement correspondant au lot qu'elle attend et reprendre automatiquement.

Cette architecture peut être appelée « événementielle », mais elle ne doit jamais être présentée comme une autonomie 24/7 tant qu'aucun runner/orchestrateur externe n'est capable de démarrer une session éteinte.

Le protocole doit distinguer explicitement :

- `event detected` ;
- `session resumed` ;
- `session unavailable`.

Le mode v1 reste le secours humain lorsque la session n'est plus vivante.

Le futur **NEXUS Orchestrator** pourra ultérieurement fournir le réveil externe. Ne pas simuler cette capacité dans v2 avant qu'elle existe réellement.

## Q13 — reprise historique S-4 / S-5

Décision : **aucune reconstruction rétroactive**.

Le registre append-only démarre avec les nouveaux échanges v2. S-4 et S-5 restent référencés par leurs commits Git existants. Ne pas fabriquer après coup des `request-n.md` ou `decision-n.md` qui n'ont jamais existé.

Le validateur et la documentation peuvent mentionner un `legacy_before_v2` ou équivalent, mais sans créer un faux historique v2.

## Architecture v2 approuvée

Structure cible :

```text
docs/handoff/
  CURRENT.md                 # compatibilité v1 / miroir dernier échange
  DECISION.md                # compatibilité v1 / miroir dernière décision
  STATE.json                 # état machine minimal
  lots/
    <LOT_ID>/
      request-1.md
      decision-1.md
      request-2.md
      decision-2.md
```

Les fichiers du registre sont append-only. Une correction produit un nouvel événement ; elle ne modifie pas silencieusement un ancien événement.

`CURRENT.md` et `DECISION.md` restent des **miroirs de compatibilité**, jamais la source canonique v2.

## Consommation d'une décision

`STATE.json` est approuvé sous réserve d'un contrat déterministe.

Il doit au minimum permettre d'identifier :

- le lot actif ;
- la dernière demande valide ;
- la dernière décision valide ;
- le commit de la décision ;
- si cette décision a été consommée ;
- quand elle a été consommée.

Éviter un modèle global qui empêcherait plusieurs lots indépendants à terme. Pour cette première version, un seul lot actif peut rester la règle si elle est explicite et validée par la CI ; le format ne doit toutefois pas rendre impossible une extension ultérieure vers plusieurs lots.

## Provenance des preuves

Chaque preuve importante doit être classée explicitement :

- `VERIFIED` : recalculée ou constatée directement par CI/outillage ;
- `DECLARED` : fournie par l'agent mais non revérifiable automatiquement dans le contexte courant ;
- `HUMAN` : dépend d'une action ou observation humaine réelle ;
- `NOT_APPLICABLE` si la preuve n'est pas pertinente pour le lot.

Ne jamais présenter une preuve `DECLARED` comme équivalente à une preuve `VERIFIED`.

Le commit déployé, l'état Supabase et toute preuve nécessitant des secrets/réseaux non disponibles restent déclaratifs tant qu'un contrôleur indépendant n'existe pas.

## Gestion des tokens / profondeur de travail

Intégrer dès v2 le mode de raisonnement convenu pour les agents NEXUS. L'enveloppe d'une demande peut porter un champ canonique `token_mode` avec trois valeurs :

- `LEAN` : tâche simple, locale et déterministe ;
- `STANDARD` : mode par défaut pour implémentation + vérification ;
- `DEEP` : sécurité, architecture, RLS, migration, concurrence, intégrité des données, multi-site, anomalie non résolue ou impact Production.

Règle : partir du niveau le plus faible **compatible avec la sécurité de la tâche** et escalader si le diagnostic révèle davantage de complexité.

Le mode ne doit jamais réduire la qualité des preuves. Principe : **économiser les tokens sur la prose, jamais sur les vérifications**.

Le validateur doit seulement vérifier le vocabulaire de `token_mode`, pas tenter de juger automatiquement si Claude « a assez réfléchi ».

## Conditions d'implémentation

Claude peut maintenant implémenter v2 uniquement sur `config-par-environnement` :

- créer le registre append-only ;
- créer le schéma/enveloppe déterministe ;
- créer `outils/handoff.js` ;
- intégrer le validateur à la CI existante ;
- créer `STATE.json` avec règles de consommation ;
- conserver et régénérer les miroirs v1 ;
- documenter clairement la limite des sessions éteintes ;
- ajouter les tests mutationnels du validateur ;
- ne toucher à aucun comportement métier NEXUS ;
- ne modifier ni `main` ni `production` ;
- ne pas implémenter encore l'organisation complète des agents IA dans ce lot.

## Preuves attendues avant fermeture

1. Un nouveau lot v2 complet peut être créé, validé et adressé par `LOT_ID` sans écraser son historique.
2. Un `lot_id` incohérent fait échouer la validation.
3. Un statut hors vocabulaire fait échouer la validation.
4. Une décision sans `in_reply_to`, ou vers une demande inexistante/périmée, échoue.
5. Une décision consommée ne peut pas être rejouée silencieusement.
6. `CURRENT.md` et `DECISION.md` restent utilisables comme secours v1 mais ne sont plus la source canonique.
7. `APPROVED_CLOSED` legacy reste lisible sans devenir une valeur canonique des nouveaux fichiers.
8. Les catégories `VERIFIED` / `DECLARED` / `HUMAN` sont distinguées.
9. `token_mode` refuse une valeur inconnue et accepte `LEAN|STANDARD|DEEP`.
10. Les tests mutationnels démontrent que le validateur détecte réellement les corruptions ciblées.
11. La CI NEXUS existante reste au même niveau hors tests v2 ; seuls les échecs historiques déjà acceptés peuvent subsister.
12. Zéro modification `main`/`production`, zéro écriture Production.

## Prochaine gate

Après implémentation, Claude doit déposer un nouveau handoff **avec le même LOT_ID `HANDOFF-V2-EVENEMENTIEL-20260905`** et attendre arbitrage.

L'organisation complète des agents IA NEXUS viendra **après fermeture de ce lot Handoff v2**, afin que cette organisation soit construite directement sur un protocole stabilisé plutôt que sur une mécanique encore en mouvement.
