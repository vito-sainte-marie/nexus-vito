<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/request-18.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 18
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0 production=2bc7b39
  - id: transport-resume-de-job
    classe: VERIFIED
    valeur: tests-yml-GITHUB_STEP_SUMMARY-if-always-zero-permission
  - id: permissions-jeton
    classe: VERIFIED
    valeur: contents-read-actions-read-inchangees
  - id: gardes-transport
    classe: VERIFIED
    valeur: test-permissions-workflow-8-sur-8-quatre-mutations-quatre-rouges-distincts
  - id: issues-write
    classe: NOT_APPLICABLE
    valeur: variante-preparee-non-appliquee-geste-humain
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-fusion-aucun-deploiement-aucune-migration-aucune-ecriture
---
# Le sens Claude → Orchestrateur est réparé de bout en bout — et cette demande porte enfin son adresse

Déposée au titre de **Q76** (arbitrage a posteriori pour outillage, gardes, tests et CI) :
aucune de ces modifications ne touche l'applicatif, la base ou Production. Elle ne remplace
pas `request-17.md`, qui reste en attente sur son propre sujet.

## 1. Ce qui était cassé, et qui ne se voyait pas

La chaîne Claude → Orchestrateur a quatre maillons. Trois étaient rompus, et le rail n'en
disait rien : il n'y avait **aucun rouge**, seulement un sens qui ne portait jamais.

| Maillon | État avant | État maintenant |
|---|---|---|
| 1. La demande est déposée au rail | fonctionnait | inchangé |
| 2. `reveil-orchestrateur.js` la détecte | fonctionnait | inchangé |
| 3. Le réveil est **adressé** | rompu — `wake_to` n'avait **aucun écrivain** | `--wake-to` sur `demande` et `decision` ; cette demande le porte |
| 4. Quelque chose le **transporte** | rompu — rien ne le publiait | étape de résumé de job, `if: always()` |

Le maillon 3 mérite d'être dit précisément : le champ `wake_to` était **lu** par l'outil de
réveil, mais rien au monde ne pouvait l'écrire. L'outil se comportait donc correctement —
il refusait de composer un réveil sans destinataire — et ce refus était indistinguable
d'un outil qui marche. C'est le motif déjà rencontré : prouver la fonction n'est pas
prouver le câblage.

## 2. Le transport retenu, et celui qui a été écarté

Le corps du réveil est écrit dans `$GITHUB_STEP_SUMMARY`. C'est **une écriture de
fichier** : elle ne demande aucune permission au jeton de CI. Le workflow conserve donc
exactement `contents: read` et `actions: read`, les deux permissions autorisées le
08/09/2026.

La variante commode — `issues: write`, qui permettrait de poster le réveil directement sur
l'issue — est **préparée mais volontairement non appliquée**. Elle élargirait la surface de
sécurité, ce que `CLAUDE.md` réserve à un geste humain. Elle ne s'obtient pas en modifiant
le fichier qui la contrôle. **C'est la seule question de cette demande** (voir §5).

Conséquence à énoncer sans l'habiller : ceci **n'est pas un réveil automatique**. NEXUS
prépare le message ; le facteur le transmet. Rien ne publie.

## 3. L'adresse posée ici, et d'où elle vient

`wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28`

Cette adresse n'est pas déduite du contexte : elle est **relevée** du rail, où elle est
écrite de façon répétée, y compris dans ce lot — `request-3.md`, `request-4.md`,
`request-5.md` et `preuve-cloudflare-humaine-65-portage-1.md` datent tous leur réveil de
« l'issue #28 ». Je ne désigne pas à la place d'un humain ; je reprends la désignation
existante. `PROTOCOL.md` la rend révisable à tout moment : la déclaration la plus récente
du lot fait foi, et aucun outil ne code de destinataire en dur.

Elle est écrite en URL, et pas `issue #28`, pour une raison mesurée : en YAML, un `#`
précédé d'une espace ouvre un commentaire. Le lecteur d'enveloppe maison prend la ligne
entière et lit bien `issue #28` ; un vrai parseur YAML lit `issue`. L'adresse vaudrait deux
choses selon le lecteur, et le jour où elle se perdrait, la ligne aurait l'air juste.
`handoff.js` refuse désormais cette forme et propose l'URL.

## 4. Ce qui tient tout cela, et comment il a été éprouvé

Trois épreuves neuves dans `test_permissions_workflow_20260908.js` (8/8) :

- l'étape de réveil **existe** — sa disparition dans un remaniement rendrait le sens muet
  sans rien faire rougir ;
- elle porte `if: always()` — c'est précisément quand une épreuve échoue que
  l'Orchestrateur doit être réveillé ; sans cela, le seul cas où le message compte serait
  le seul où il ne serait pas écrit ;
- elle **ne coûte aucune permission** — ni jeton, ni secret, ni `gh`, ni appel API ; et le
  producteur lui-même ne parle qu'à `git`, jamais au réseau.

Éprouvées par **quatre mutations**, une par direction du contrat : étape supprimée,
`if: always()` retiré, `gh issue comment` ajouté à l'étape, producteur qui publie. Quatre
rouges **distincts**, chacun sur son épreuve, les cinq épreuves préexistantes restant
vertes — donc aucun rouge n'en masquait un autre. Contre-témoin vert à l'état restauré,
arbre propre ensuite.

## 5. Ce que je demande

**Une seule question, et elle est à vous.**

Le sens Claude → Orchestrateur fonctionne aujourd'hui avec un facteur humain : le corps du
réveil apparaît dans le résumé du job, Frédéric le colle à l'adresse déclarée. Cela suffit,
et cela ne coûte aucune permission.

Faut-il aller plus loin et accorder `issues: write` pour que le réveil se poste seul ?

- **Si non** : rien à faire, l'état actuel est complet et tenu par ses gardes.
- **Si oui** : c'est un élargissement de la surface de sécurité, donc votre geste, pas le
  mien. La variante est préparée ; je ne l'appliquerai pas sans cette réponse écrite.

Je ne demande **rien d'autre** : le reste de cette demande est un compte rendu Q76, pas une
sollicitation.

## 6. Ce qui n'a pas été touché

Aucune fusion, aucun déploiement, aucune migration, aucune écriture en base, aucun secret
lu, aucun PIN, aucune permission élargie. Rien n'a été poussé : les commits de ce travail
restent locaux au rail, dans l'attente du GO de transport habituel.

## 7. Mise à jour du 26/09/2026 — ce document est maintenant lisible là où vous êtes

Ajouté par append, sans rien réécrire : **le §6 ci-dessus a cessé d'être vrai le
26/09/2026**, et vous lisez cette demande sur la ref même que cette phrase niait. La
laisser telle quelle et dater sa correction vaut mieux que la corriger en silence.

**Le transport a eu lieu.** `ab62320..f3f903c` sur `handoff-continuite-20260920`, sous un
GO de Frédéric borné à cette réparation, assorti de cinq critères qu'il a posés lui-même et
que j'ai vérifiés sur la **totalité** du diff avant de pousser : aucune modification
métier, aucune permission GitHub supplémentaire, aucun changement Supabase, aucun
déploiement, aucune modification de `main` ou `production`. CI verte sur `f3f903c`.

Une conséquence mérite d'être dite, parce qu'elle a failli faire mentir le périmètre : **le
GO nommait des fichiers, or git transporte des commits.** `b546400` — un fichier de test
ajouté, la garde d'horloge, 170 lignes, aucune source touchée — est l'**ancêtre** des trois
autres. Aucun push ne pouvait porter la réparation sans lui. Je l'ai dit avant de pousser
plutôt qu'après ; il satisfait les cinq critères et relève de Q76.

**Ce que `f3f903c` ajoute au-delà de ce que les §1 à §4 décrivent.** Le maillon 3 était
réparé, mais le réveil désignait encore le document **par son nom de fichier**. Quatre
branches `origin/claude/issue-28-*` portent un `request-18.md` d'octets différents : le
réveil annonçait donc des refs qui ne portaient pas ce que vous lisez ici — la mauvaise
livraison la plus silencieuse qui soit, puisque la ligne est bien formée et le fichier
vraiment là. Un document se désigne désormais par son **empreinte** (`git hash-object`), et
le réveil rend trois réponses distinctes : `memes` (ces octets — à lire), `homonymes` (ce
nom, d'autres octets — **nommés**, jamais offerts en lecture), aucune (« rien à lire
ailleurs », ce qui n'est pas « cherchez ailleurs »).

Le même défaut vu de l'autre bout : **« lisible ici » n'est pas « lisible là où l'arbitre se
tient »**. Une ref locale porte le document sans que vous, qui lisez GitHub, puissiez
l'atteindre. D'où `lisible_a_distance` : `true`, `false`, ou `null` quand la mesure manque —
jamais un `false` qui alarmerait à tort.

**Éprouvé par mutation, 95/95.** Sept mutations, sept rouges nommés, aucun n'en masquant un
autre, contre-témoin vert à l'état restauré. Deux d'entre elles ont d'abord passé
**inaperçues** : celles qui transforment `null` en `false`. Les états bruyants se gardent
tout seuls parce qu'ils s'affichent ; l'état « on ne sait pas » ne produit aucune ligne,
donc rien ne le contredit quand il se met à mentir — or c'est précisément lui qui empêche la
fausse alarme. Les deux gardes manquantes sont écrites.

**Ce que je ne demande toujours pas.** Les quatre branches homonymes restent divergentes :
Frédéric a explicitement **refusé** tout GO de suppression ou de modification, les qualifiant
de dette de gouvernance identifiée, à traiter séparément et sans la mélanger au travail #65.
L'outil ne les nettoie pas ; il refuse de s'y tromper. Rien d'autre n'a changé : ni fusion,
ni déploiement, ni migration, ni écriture en base, ni secret, ni PIN, ni permission élargie.

**Le §5 est inchangé : la seule question de cette demande reste `issues: write`.**
