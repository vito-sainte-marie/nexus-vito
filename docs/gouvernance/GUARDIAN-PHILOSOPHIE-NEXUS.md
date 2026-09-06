# Guardian Philosophie NEXUS

Garde transversale, distincte des Guardians Architecture / Security & Isolation
/ QA-Regression déjà en usage dans le registre Handoff. Les trois premiers
jugent si un changement est correct et sûr. Celui-ci juge si un changement est
**conforme à la philosophie NEXUS**, indépendamment de sa correction technique.
Une CI verte ou un code juste ne suffisent pas à l'emporter contre son veto.

## Principe constitutionnel

> NEXUS automatise tout ce qui peut être détecté, vérifié, transmis ou exécuté
> de manière fiable. L'attention humaine est réservée aux exceptions, aux
> arbitrages et aux décisions où le jugement humain crée réellement de la
> valeur.

## Question obligatoire

Toute évolution touchant l'orchestration, un rail événementiel, ou tout
mécanisme sollicitant potentiellement un humain doit répondre explicitement à
la question :

> **Pourquoi un humain doit-il intervenir ici ?**

Si aucune justification forte n'existe — la réponse est « par habitude », «
pour être sûr », ou reste implicite — la conception doit être revue avant
d'être proposée à l'arbitrage. L'absence de réponse écrite est traitée comme
un défaut, pas comme une case optionnelle.

## Les neuf critères

1. **Simplicité** — le mécanisme le plus simple qui satisfait les invariants
   de sécurité l'emporte sur le plus général ou le plus configurable.
2. **Automatisation par défaut, humain par exception** — une étape manuelle
   ne se justifie que par une valeur de jugement réelle (règle métier
   inconnue, arbitrage stratégique, risque juridique/sécurité majeur,
   opération irréversible, autorisation Production).
3. **Absence de double saisie / double surveillance** — si une information ou
   un contrôle existe déjà quelque part (STATE.json, CI, registre), une
   nouvelle brique ne le reconstruit pas ailleurs ; elle le lit.
4. **Explicabilité** — un humain qui lit l'état du système (STATE.json, un
   log, un commentaire de réveil) doit pouvoir reconstituer *pourquoi* une
   action a eu lieu ou a été refusée, sans deviner.
5. **Attribution correcte de la décision** — une décision d'arbitrage porte
   toujours l'identité de qui l'a réellement rendue ; un mécanisme ne doit
   jamais pouvoir se faire passer pour, ou se substituer à, l'auteur réel
   d'une décision (voir garde anti-boucle, `docs/handoff/PROTOCOL.md`).
6. **Prévention de la dérive ERP** — NEXUS ne doit pas accumuler des
   mécanismes génériques « au cas où » qui complexifient chaque flux pour un
   besoin hypothétique ; chaque brique répond à un besoin démontré.
7. **Contrôle de la complexité cumulative** — une évolution qui, seule,
   paraît raisonnable mais qui, ajoutée aux précédentes, rend le système
   globalement plus difficile à auditer, est refusée ou reportée tant que la
   dette n'est pas réduite ailleurs.
8. **Fail-closed par défaut** — en cas d'état canonique contradictoire,
   d'événement insuffisant, ou d'autorisation absente, le système s'arrête et
   attend plutôt que de deviner ou d'agir par défaut.
9. **Isolation des données clientes préservée** — aucune évolution
   d'orchestration n'élargit l'accès inter-site, ni ne transforme une
   identité machine (`service_role`) en passe-partout métier.

## Droit de veto

Le Guardian Philosophie dispose d'un **veto**, distinct d'un simple avis :

- il s'exerce sur la conception (avant implémentation) et sur le résultat
  (avant clôture d'un lot) ;
- un veto n'est pas dérogeable par une preuve technique — seule une
  reformulation de la conception qui satisfait les neuf critères le lève ;
- un veto est toujours écrit et daté, avec le critère précis qu'il invoque ;
  un veto sans motif nommé n'est pas recevable ;
- un veto ne bloque jamais, à lui seul, un correctif de sécurité urgent en
  Test — il retarde la promotion et l'extension de portée, pas le confinement
  d'un risque déjà identifié.

## Où il s'applique

- Dans le registre Handoff : toute demande dont `type` est
  `architecture-and-implementation-request` (ou tout type touchant
  l'orchestration) doit porter une section `## Guardian Philosophie NEXUS`
  répondant explicitement à la question obligatoire. Une demande de ce type
  sans cette section est bloquante (voir `outils/handoff.js`,
  `validerGuardianPhilosophie`).
- Dans les gates humaines : avant de solliciter Frédéric, l'agent doit
  démontrer que la sollicitation correspond à l'une des cinq exceptions du
  critère 2. Une sollicitation qui ne le démontre pas est elle-même un défaut
  de conception, pas une simple question posée par prudence.

## Ce que ce document n'est pas

Il ne remplace pas `docs/handoff/PROTOCOL.md` (grammaire et vocabulaire du
registre) ni les Guardians Architecture / Security & Isolation / QA-Regression
existants. Il ajoute une lecture transversale que les trois autres n'ont pas
mandat de porter : celle de savoir si NEXUS reste NEXUS, indépendamment de
savoir si le code est correct.
