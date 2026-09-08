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


---

## Mise en œuvre (08/09/2026)

Rapatrié depuis `claude/issue-28-20260906-1405`, où ce document est resté seul
pendant deux jours — l'audit du 07/09 le signalait déjà comme travail perdu
(GOV-002). Un guardian dont la doctrine n'est lisible nulle part n'existe pas.

`decision-1.md` du lot NEXUS-ORCHESTRATION-GUARDIANS-1-20260907 (Q75) l'a
arbitré : **consultatif uniquement**, jamais bloquant tant qu'il dépend d'un
jugement de modèle. Cette contrainte n'interdit pas de mécaniser ce qui n'est
PAS un jugement de modèle.

### Ce qui est mécanisé — `outils/guardian-philosophie.js`

Le critère 4 (**explicabilité**) et le critère 8 (**fail-closed**) ont une
conséquence directe sur les écrans, formulée par Frédéric le 08/09/2026 :

> Le silence doit avoir une signification explicite. Pas de disparition de
> carte qui pourrait signifier « non contrôlé ».

Une section TITRÉE qui disparaît entièrement quand sa condition est fausse
laisse le lecteur incapable de distinguer « vérifié, rien à signaler » de
« pas vérifié ». C'est détectable sans jugement : la garde le signale.

Mesuré avant d'être câblé (règle QA-002) : 7 signalements sur 62 écrans, tous
relus. Le premier jet, qui signalait toute expression conditionnelle rendant
du vide, en produisait 435 sur 47 fichiers — une garde qui crie autant se fait
désactiver et emporte ses vraies trouvailles.

### Ce qui n'est pas mécanisé, et pourquoi

Les neuf critères relèvent du jugement. La garde les RAPPELLE au relecteur
plutôt que de prétendre les évaluer : une garde qui déclarerait « simplicité
conforme » fabriquerait une conformité que personne n'a jugée — exactement ce
que le critère 4 interdit.
