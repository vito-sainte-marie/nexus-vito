---
protocol: nexus-handoff/2
kind: request
lot_id: SITE-EXPLICITE-1-MUTATION-SITE-GUARD-20260906
seq: 1
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=501c0c7 production=501c0c7
  - id: anomalies-fermees
    classe: VERIFIED
    valeur: les deux deplacements passent de ACCEPTE a REFUSE
  - id: chemins-legitimes
    classe: VERIFIED
    valeur: contenu, DELETE du site et snapshot propre restent ouverts
  - id: contrat-global-local
    classe: VERIFIED
    valeur: regle globale hors portee du manager, sans clause de rattrapage
  - id: trigger-portee-immuable
    classe: VERIFIED
    valeur: une regle ne change pas de portee, meme hors RLS
  - id: aucun-privilege-elargi
    classe: VERIFIED
    valeur: role conserve, aucun INSERT touche, aucune donnee reattribuee
  - id: cartographie-triggers
    classe: VERIFIED
    valeur: 3 ecrivains du site, aucun capable de deporter
  - id: suite
    classe: VERIFIED
    valeur: 189/198
  - id: inserts-restants
    classe: HUMAN
    valeur: 2 trous de meme nature signales, non corriges
  - id: garde-statique
    classe: HUMAN
    valeur: inexistante - l ADR reste declarative
  - id: classificateur
    classe: HUMAN
    valeur: toujours sans tests, non promu en controle CI
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete, aucun merge, aucun deploiement
---

# SITE-EXPLICITE-1-MUTATION-SITE-GUARD — les deux anomalies sont fermées

## Contrat anti-dérive

| Champ | Valeur |
|---|---|
| `objectif_metier` | Qu'une donnée correctement créée ne puisse plus changer de commerce. |
| `gain_attendu` | **Sécurité** — deux chemins de mutation inter-site fermés, dont un accessible à un employé ordinaire. |
| `contrats_touches` | 3 policies (`advisor_rules` UPDATE + DELETE, `apprentissage_snapshots` UPDATE) + 1 trigger |
| `guardians_requis` | Architecture · Security & Isolation · QA / Regression |
| `preuves_exigees` | contrat global/local · policies avant/après · preuves rejouées · chemins légitimes · triggers |
| `definition_de_termine` | Périmètre exécuté, preuves produites, retour Handoff. **Atteinte.** |

## 1. Le contrat `advisor_rules` — global et local ne se traitent pas pareil

C'était la condition métier majeure, et elle a changé la conception.

**Règle GLOBALE** (`site_id is null`) — elle gouverne **tous** les commerces.
Les 31 règles actuelles sont de ce type, créées par la migration A15. Le
balayage applicatif ne trouve **aucune** écriture sur `advisor_rules` : aucun
écran ne les modifie.

> Contrat retenu : **une règle globale n'est pas mutable par un manager de
> site.** Laisser le manager du commerce A modifier une règle qui décide aussi
> pour le commerce B serait une fuite d'influence, pas une commodité
> d'administration.

Elles restent administrées **par migration** — ce qui est déjà leur mode
d'existence, pas une restriction nouvelle. J'attire l'attention là-dessus :
c'est un choix de contrat, et il mérite d'être confirmé (Q46).

**Règle LOCALE** — le manager de ce site la mute, et **son site ne change
pas**.

Détail de conception : `site_id = current_employee_site_id()` est **faux**
quand `site_id` est null. Les règles globales sortent donc du périmètre sans
aucune clause spéciale — et surtout, aucun `null` ne peut être confondu avec
« autorisé ». Un test interdit d'ajouter un `is null` de rattrapage.

## 2. Policies avant / après

| Policy | Avant | Après |
|---|---|---|
| `manager_update_advisor_rules` | rôle seul | rôle **+ site**, `with check` écrit |
| `manager_delete_advisor_rules` | rôle seul | rôle **+ site** |
| `employee_own_snapshot_update` | `employee_id` seul, aucun `with check` | auteur **+ site**, `with check` écrit |
| *(nouveau)* `nexus_portee_advisor_immuable` | — | trigger : la portée d'une règle ne change pas |

**Pourquoi un trigger en plus.** Un `with check` ne voit **que la nouvelle
ligne**. Interdire qu'une règle globale devienne locale — ou qu'une règle
locale change de site — exige de comparer l'ancienne et la nouvelle valeur.
Seul un trigger le peut.

**Pourquoi le `with check` est écrit explicitement.** PostgreSQL applique bien
`using` à la nouvelle ligne quand `with check` est absent. Mais s'appuyer sur
ce repli est précisément ce qui a rendu ces faiblesses invisibles à la
relecture pendant des mois. Ce qui est écrit se lit.

## 3. Preuves rejouées — avant / après

**Avant** (matrice UPDATE) :

```
advisor_rules (manager)           : DEPLACEE vers « site-fantome-test »
apprentissage_snapshots (employé) : 1 DEPLACEE
```

**Après**, sous identités réelles, transaction annulée :

```
A1 regle locale -> autre site      : REFUSE [42501]
A2 regle globale -> locale         : 0 modifiee
A3 LEGITIME contenu, regle du site : 1 modifiee
A4 contenu d une regle globale     : 0 modifiee  (hors portee du manager)
A5 DELETE regle globale            : 0 supprimee
A6 LEGITIME DELETE regle du site   : 1 supprimee
B1 snapshot -> autre site          : REFUSE [42501]
B2 LEGITIME maj de son snapshot    : 1 modifiee
```

Les deux anomalies sont fermées ; **les quatre chemins légitimes restent
ouverts**.

## 4. Aucun privilège élargi

Le rôle exigé est conservé partout — la correction **ajoute** le site, elle ne
remplace rien. Aucune policy `INSERT` n'est touchée. Aucune donnée n'est
réattribuée : la fixture locale a été **créée** puis annulée, jamais une ligne
existante déplacée. Le créateur ne gagne aucun droit.

## 5. Cartographie des triggers — rassurante

Sur toute la base, **3 triggers seulement écrivent le site**, tous connus :

| Trigger | Table | Moment | Effet |
|---|---|---|---|
| `mission_catalog_site_unique` | `mission_catalog` | BEFORE INSERT/UPDATE | normalise vers le site du compte |
| `shifts_site_unique` | `shifts` | BEFORE UPDATE | idem |
| `nexus_shifts_avant_insertion` | `shifts` | BEFORE INSERT | idem, puis clôture S-3 |

**Aucun ne peut déplacer une donnée vers un autre commerce** : ils normalisent
vers le site de l'appelant, ou refusent. Le risque redouté — un trigger
transformant silencieusement une portée absente en site arbitraire — **ne se
matérialise pas**.

## 6. Deux trous de même nature, signalés et NON corrigés

Hors périmètre autorisé, découverts en lisant les policies :

| Policy | Faiblesse |
|---|---|
| `advisor_rules.manager_insert_advisor_rules` | `with check` = rôle seul → un manager crée une règle pour **n'importe quel site**, y compris globale |
| `apprentissage_snapshots.employee_own_snapshot_upsert` | `with check` = `employee_id` seul → insertion possible avec un site arbitraire |

Ce sont les mêmes causes que les anomalies corrigées, sur la même face
`INSERT`. **Je ne les ai pas touchées** : le périmètre disait `UPDATE` et
`DELETE`.

## 7. ADR-0001 proposée

`docs/adr/0001-portee-site-des-mutations.md`, état **PROPOSÉE**.

> Toute mutation d'une donnée à portée site doit contrôler à la fois l'acteur
> autorisé et la cohérence de portée métier de la nouvelle ligne. Lorsque la
> donnée est globale, locale, ou porte une identité plus précise, la policy
> doit préserver explicitement cette portée et ne jamais la déduire d'un rôle
> seul.

Elle nomme le motif — *on contrôle qui agit, on oublie où la donnée atterrit* —
et recense ses cinq occurrences, dont **deux restent ouvertes**. Elle
n'impose **aucune formule unique** : trois policies identiques auraient
reproduit le défaut de `mission_progress`.

L'ADR dit aussi sa propre faiblesse : tant que la garde statique n'existe pas,
elle repose sur la vigilance — c'est-à-dire sur ce que le Governance Core dit
de ne pas faire.

## 8. État du classificateur

**Toujours pas de tests.** Il a servi à établir la matrice, il s'est trompé
deux fois, et il n'est **pas** accepté comme contrôle CI. Il n'a pas été
promu, et je ne demande pas qu'il le soit.

## Avis des Guardians

### Security & Isolation Guardian

Les deux chemins sont fermés et rejoués. Le point qui compte pour moi est le
**contrat global** : refuser à un manager de site la mutation d'une règle
globale est plus strict qu'avant, et c'est délibéré — une règle qui décide
pour d'autres commerces n'est pas un objet de site.

**Avis : les deux `INSERT` restants sont maintenant le principal risque
ouvert** du chantier. Celui d'`advisor_rules` permet de *créer* une règle
globale, donc d'influencer tous les commerces — plus grave que le déplacement
qu'on vient de fermer.

### Architecture Guardian

Le trigger complète la policy au lieu de la remplacer, et la séparation est
propre : la policy dit **qui**, le trigger dit **ce qui ne change pas**. C'est
la même architecture que S-3 après correction — un mécanisme par question.

La cartographie des triggers lève l'angle mort : trois triggers, tous
normalisateurs, aucun capable de déporter une donnée.

**Avis : l'ADR doit être adoptée avant la classe D**, sinon la classe D
produira une quatrième occurrence pendant qu'on corrige la troisième.

### QA / Regression Guardian

Huit vérifications ajoutées, dont deux qui gardent le **raisonnement** : qu'on
n'ajoute pas de clause `is null` de rattrapage, et qu'aucune policy `INSERT`
ne soit touchée par ce lot.

**Réserves** : les preuves restent en transaction annulée. La garde statique
n'existe pas. Le classificateur n'a toujours pas de tests. **Rien de ce lot
n'empêche une régression demain** — seulement de la refaire à l'identique.

Je note aussi un fait de méthode : le trigger a refusé mon **propre** montage
de fixture, ce qui a révélé qu'un commentaire de ma migration était faux —
j'y écrivais qu'une migration n'y serait pas soumise. Corrigé.

## Preuves

- Migration `20260906040000_garde_mutation_site.sql`, **Test uniquement**.
- 8 tentatives sous identités réelles : 2 refus `42501`, 3 refus silencieux,
  3 chemins légitimes ouverts.
- `test_garde_mutation_site_20260906.js` — 8 vérifications.
- Cartographie triggers : 3 écrivains du site, aucun déportant.
- Suite `189/198`, mêmes 9 échecs historiques.
- `main` et `production` : `501c0c7` — preuve calculée par l'outillage.

## Rollback

Migration inverse rétablissant les trois policies et supprimant le trigger.
**Aucune donnée touchée**, donc retour complet.

## Risques / anomalies

1. **Deux `INSERT` de même nature restent ouverts**, par respect du périmètre.
2. **Le contrat global est plus strict qu'avant** : si une administration des
   règles globales par écran est prévue un jour, elle devra passer par un
   chemin explicite — voir Q46.
3. **La garde statique n'existe pas** : l'ADR reste déclarative.

## Questions pour arbitrage

**Q46 — Le contrat global est-il le bon ?** J'ai retenu : un manager de site
ne mute pas une règle globale. Recommandation : **oui**, et si une
administration est souhaitée, qu'elle passe par un rôle explicitement
transverse plutôt que par le rôle manager, qui n'est pas une portée.

**Q47 — Fermer les deux `INSERT` ?** Recommandation : **oui, en priorité sur
la classe D**. Créer une règle globale influence tous les commerces — c'est
plus grave que le déplacement qu'on vient de fermer.

**Q48 — Adopter ADR-0001 maintenant ?** Recommandation : **oui, avant la
classe D**, sinon la classe D produira une quatrième occurrence pendant qu'on
corrige la troisième.

## Action attendue de ChatGPT

Arbitrer Q46, Q47, Q48 pour le `LOT_ID`
**SITE-EXPLICITE-1-MUTATION-SITE-GUARD-20260906**. **Aucune extension du
chantier n'est demandée ; la classe D reste fermée.**
