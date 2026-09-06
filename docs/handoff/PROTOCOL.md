# NEXUS Handoff Protocol v2

Branche de travail autorisée : `config-par-environnement`.
Refs protégées, jamais touchées par un handoff : `main`, `production`.

Objectif inchangé depuis v1 : GitHub est le canal de transmission versionné et
auditable entre Claude et ChatGPT. Ce que v2 ajoute, c'est que **le protocole
ne repose plus sur la discipline de ses acteurs** — il est validé par machine.

## Pourquoi v2

v1 a servi sur deux lots. L'audit de son propre historique a montré quatre
défauts, tous du même genre que ceux que la recette a trouvés dans NEXUS : un
contrat que seule la bonne conduite fait respecter.

1. **Une fenêtre de décision périmée a réellement existé.** Au commit
   `67ecdce`, le dépôt portait une demande S-5 ouverte face à une décision S-4
   déjà consommée et toujours d'apparence autoritaire.
2. **Le vocabulaire a dérivé.** `APPROVED_CLOSED`, absent du protocole, a
   fermé les deux seuls lots aboutis. `APPROVED` n'a jamais servi.
3. **Les deux fentes étaient écrasées** à chaque tour ; aucun lot n'était
   adressable par son identifiant.
4. **Rien ne marquait une décision comme consommée.**

## Structure

```text
docs/handoff/
  CURRENT.md          # MIROIR v1 — compatibilité, jamais la source
  DECISION.md         # MIROIR v1 — compatibilité, jamais la source
  STATE.json          # état machine
  lots/<LOT_ID>/request-N.md, decision-N.md   # source canonique, append-only
```

Le registre est **append-only**. Une correction produit un nouvel échange ;
elle ne modifie pas un échange déjà déposé. Les miroirs restent lisibles tels
quels par qui ne connaît que v1 — leur en-tête dit qu'ils ne sont pas la
source, pour que personne ne les édite en croyant agir sur le protocole.

`legacy_before_v2` : S-4 et S-5 se sont déroulés avant le registre. Ils ne
sont **pas** reconstruits — `STATE.json` les référence par leurs commits.
Fabriquer après coup des échanges qui n'ont jamais existé serait inventer un
passé plausible, ce qu'A18 et S-5/Q7 interdisent.

## Enveloppe

Front-matter en tête de chaque fichier du registre. Grammaire volontairement
étroite : `clef: valeur`, plus des listes d'objets plats. **Une ligne non
reconnue est une erreur, jamais un silence** — ignorer ce qu'on ne comprend
pas est précisément la mécanique qui a laissé le vocabulaire dériver.

Demande : `protocol`, `kind: request`, `lot_id`, `seq`, `author`, `branch`,
`status`, `token_mode`, `preuves`.
Décision : `protocol`, `kind: decision`, `lot_id`, `seq`, `author`, `branch`,
`decision`, `closes`, `in_reply_to`.

## Vocabulaire clos

| Champ | Valeurs |
|---|---|
| `status` (demande) | `AWAITING_DECISION` |
| `decision` | `APPROVED`, `APPROVED_WITH_CONDITIONS`, `BLOCKED`, `NEEDS_EVIDENCE` |
| `closes` | `true`, `false` |
| `token_mode` | `LEAN`, `STANDARD`, `DEEP` |
| `classe` de preuve | `VERIFIED`, `DECLARED`, `HUMAN`, `NOT_APPLICABLE` |

**`APPROVED_CLOSED` n'est pas canonique.** Il reste *lisible* comme valeur
legacy pour S-4 et S-5, que le validateur normalise en mémoire en
`decision=APPROVED, closes=true` sans jamais réécrire les fichiers. Un fichier
du registre v2 qui l'emploie échoue : la décision d'arbitrage et le cycle de
vie du lot sont deux choses, et les confondre est ce qui a produit la dérive.

## Provenance des preuves

Une preuve porte toujours sa classe, et **une preuve `DECLARED` ne doit jamais
être présentée comme équivalente à une preuve `VERIFIED`**.

- `VERIFIED` — recalculée ou constatée par l'outillage. Aujourd'hui : l'état
  des refs protégées, le résultat de la suite mesuré par la CI.
- `DECLARED` — fournie par l'agent, non revérifiable dans le contexte courant.
  Le commit déployé et l'état Supabase en font partie : la CI n'a ni réseau ni
  identifiants pour les constater. Ils le resteront tant qu'un contrôleur
  indépendant n'existera pas.
- `HUMAN` — dépend d'une observation humaine réelle (rejeu navigateur, PIN).
- `NOT_APPLICABLE`.

## Mode de raisonnement

`token_mode` déclare la profondeur de travail : `LEAN` pour une tâche simple,
locale et déterministe ; `STANDARD` par défaut ; `DEEP` pour la sécurité,
l'architecture, la RLS, les migrations, la concurrence, l'intégrité des
données, le multi-site, une anomalie non résolue ou un impact Production.

Partir du niveau le plus faible **compatible avec la sécurité de la tâche** et
escalader si le diagnostic révèle davantage de complexité. Le mode ne réduit
jamais la qualité des preuves : **on économise les tokens sur la prose, jamais
sur les vérifications**. Le validateur ne contrôle que le vocabulaire — juger
si un agent « a assez réfléchi » n'est pas une question qu'une machine tranche.

## Ce que la CI bloque

Immédiatement, sans exception : `lot_id` absent, malformé ou incohérent ;
statut ou décision hors vocabulaire ; `APPROVED_CLOSED` dans un fichier v2 ;
`in_reply_to` absent, inexistant, ou désignant une demande qui n'est plus
active ; séquence trouée ; enveloppe illisible ; `STATE.json` invalide ou en
désaccord avec le registre ; plus d'un lot actif ; consommation sans commit ;
**branche déclarée protégée ou différente de la branche autorisée** ; **refs
protégées déclarées différentes de celles constatées**.

Ces deux derniers points sont des invariants de sécurité : ils ne sont jamais
ramenés à un avertissement, et une ref protégée illisible est un échec, pas
une tolérance.

**Lot d'observation** : l'écart entre le résultat de suite déclaré et celui
mesuré est un simple avertissement, le temps de calibrer. À la fin de ce lot,
Claude doit proposer l'arbitrage décidant quelles preuves recalculées
deviennent bloquantes.

## Couche événementielle — et sa limite

- `event detected` — la CI a validé une demande ou une décision.
- `session resumed` — une session vivante a repris sur cet événement.
- `session unavailable` — **rien ne réveille une session éteinte.**

Cette architecture est événementielle ; elle **n'est pas** une autonomie 24/7,
et ne doit jamais être présentée comme telle. Aucun runner externe ne démarre
aujourd'hui une session Claude. Le futur NEXUS Orchestrator pourra fournir ce
réveil ; **ne pas simuler cette capacité avant qu'elle existe**. Jusque-là, le
secours est humain, et c'est une raison de plus pour que les miroirs v1
survivent.

## Cycle

```
handoff.js demande <LOT_ID> <corps.md>   →  request-N.md + miroirs
ChatGPT                                  →  decision-N.md
handoff.js consommer <LOT_ID>            →  STATE.json marque la consommation
```

Une décision déjà consommée ne se rejoue pas : la commande refuse et n'écrit
rien.

## Gate humaine

Frédéric intervient pour les décisions produit majeures, les changements de
philosophie NEXUS, les arbitrages métier importants, la sécurité critique et
**toute autorisation de production**. Aucun handoff, aucune décision
d'arbitrage ne vaut autorisation de production.

## Protocole v1 — secours

v1 reste valide comme mode dégradé : `CURRENT.md` et `DECISION.md` portent le
dernier échange et se lisent seuls. Ses dix règles restent vraies ; v2 ne les
remplace pas, il les rend contrôlables. En cas de panne d'outillage, on
retombe sur v1 sans rien perdre.
