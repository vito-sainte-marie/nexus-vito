---
protocol: nexus-handoff/2
kind: request
lot_id: SITE-EXPLICITE-1-INSERT-SITE-GUARD-20260906
seq: 1
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=501c0c7 production=501c0c7
  - id: inserts-fermes
    classe: VERIFIED
    valeur: 5 insertions illegitimes refusees 42501
  - id: chemins-legitimes
    classe: VERIFIED
    valeur: regle locale du site et snapshot propre acceptes
  - id: site-omis-refuse
    classe: VERIFIED
    valeur: omettre site_id creait une regle globale - refuse
  - id: creer-egale-administrer
    classe: VERIFIED
    valeur: test interdisant aux deux faces de diverger
  - id: aucun-elargissement
    classe: VERIFIED
    valeur: role et auteur conserves, aucune donnee reattribuee
  - id: adr-0001
    classe: VERIFIED
    valeur: ACCEPTEE, 6 occurrences recensees, toutes closes en Test
  - id: suite
    classe: VERIFIED
    valeur: 190/199
  - id: garde-statique
    classe: HUMAN
    valeur: inexistante - l ADR n est pas opposable
  - id: policies-classe-a
    classe: HUMAN
    valeur: 52 classees par lecture, non eprouvees
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete, aucun merge, aucun deploiement
---

# SITE-EXPLICITE-1-INSERT-SITE-GUARD — la dernière face du motif

## Contrat anti-dérive

| Champ | Valeur |
|---|---|
| `objectif_metier` | Qu'on ne puisse pas créer une donnée dont la portée dépasse ce qu'on a le droit d'administrer. |
| `gain_attendu` | **Sécurité** — fermeture du dernier chemin permettant de créer une règle influençant **tous** les commerces. |
| `contrats_touches` | 2 policies `INSERT` |
| `guardians_requis` | Architecture · Security & Isolation · QA / Regression |
| `preuves_exigees` | policies avant/après · 5 insertions illégitimes · 2 chemins légitimes · état ADR |
| `definition_de_termine` | Périmètre exécuté, ADR adoptée, retour Handoff. **Atteinte.** |

## Résumé

Les deux `INSERT` sont fermés. **ADR-0001 est ACCEPTÉE.** Les six occurrences
du motif sont désormais closes en Test.

## 1. L'incohérence que ce lot ferme

Après MUTATION-SITE-GUARD, les faces `UPDATE` et `DELETE` étaient closes, mais
les faces `INSERT` ne l'étaient pas. Résultat :

> **Un manager pouvait créer une règle globale — influençant tous les
> commerces — qu'il n'avait plus le droit de modifier ni de supprimer.**

Créer était devenu plus permissif qu'administrer. Le contrat d'insertion est
donc aligné sur celui d'administration : un manager ne crée qu'une règle
**locale de son site**.

Un test interdit désormais aux deux faces de diverger à nouveau — si l'une
s'assouplissait, on pourrait recréer une portée impossible à administrer.

## 2. Policies avant / après

| Policy | Avant | Après |
|---|---|---|
| `manager_insert_advisor_rules` | rôle seul | rôle **+ site** |
| `employee_own_snapshot_upsert` | `employee_id` seul | auteur **+ site** |

`apprentissage_snapshots` est écrite par `upsert` : **fermer l'`UPDATE` sans
l'`INSERT` n'aurait rien fermé**, le chemin d'insertion restant ouvert.

## 3. Preuves — sous identités réelles, transaction annulée

```
A1 creer une regle GLOBALE          : REFUSE [42501]
A2 creer pour un AUTRE site         : REFUSE [42501]
A3 LEGITIME regle locale de son site: ACCEPTE
A4 omettre le site                  : REFUSE [42501]
B1 snapshot sur un AUTRE site       : REFUSE [42501]
B2 snapshot pour un AUTRE employe   : REFUSE [42501]
B3 LEGITIME son snapshot, son site  : ACCEPTE
```

**A4 mérite d'être souligné** : omettre `site_id` — qui est *nullable* sur
`advisor_rules`, donc sans défaut à `'vito-sainte-marie'` — créait
silencieusement une règle **globale**. C'est refusé, et sans clause spéciale :
`site_id = current_employee_site_id()` est faux pour un `null`. Aucun `null`
ne peut être confondu avec « autorisé », et un test interdit d'ajouter un
`is null` de rattrapage.

## 4. Aucun élargissement, aucune réattribution

Le rôle et l'auteur restent exigés — la correction **ajoute** le site. Aucune
policy `UPDATE` ou `DELETE` n'est retouchée. Aucune donnée existante n'est
modifiée : toutes les lignes de preuve sont créées puis annulées.

Le contrôle fail-closed de la migration **relit aussi les trois policies du
lot précédent** : si l'une était perdue, la migration s'arrêterait. Une garde
ne vaut que si elle vérifie l'ensemble, pas seulement ce qu'elle vient
d'écrire.

## 5. ADR-0001 — ACCEPTÉE

État : **ACCEPTÉE le 06/09/2026**, avec sa condition inscrite **en tête du
document** plutôt qu'en note de bas de page :

> Tant que le lot de garde statique n'existe pas, cette ADR est une règle
> écrite, **pas une garantie**.

Les six occurrences sont recensées avec leur face et leur état — toutes
closes en Test.

**Ce que l'adoption a appris, et qui est l'argument le plus fort pour les
ADR** : les trois premières occurrences ont été trouvées **une par une, par
hasard** — une régression, un rejeu, une matrice. Les deux dernières ont été
trouvées **parce qu'on cherchait le motif**, en lisant les faces `INSERT` des
tables dont les faces `UPDATE` venaient d'être corrigées.

Nommer le motif a changé le rendement de la recherche. Une ADR ne corrige
rien ; elle dit où regarder.

## Avis des Guardians

### Security & Isolation Guardian

Le risque que j'avais qualifié de principal au lot précédent — créer une règle
globale — est fermé. Les six faces des trois tables concernées contrôlent
désormais la portée.

**Avis : je ne connais plus de chemin ouvert de mutation ou de création
inter-site** sur les tables auditées. Ce n'est pas la même chose que dire
qu'il n'en existe pas : 52 policies `UPDATE` restent classées par lecture, non
éprouvées, et les Edge Functions demeurent hors de portée.

### Architecture Guardian

L'alignement `INSERT`/`UPDATE` est le vrai apport de ce lot. Un système où
créer est plus permissif qu'administrer produit mécaniquement des objets
orphelins — créés par quelqu'un qui ne peut plus les toucher. Le test qui
interdit aux deux faces de diverger vaut mieux que les deux policies
elles-mêmes.

**Avis : construire la garde statique avant d'ouvrir la classe D.** La classe
D touchera 9 chemins d'écriture et 54 defaults ; sans invariant automatisé,
elle produira une septième occurrence pendant qu'on célèbre la fermeture des
six premières.

### QA / Regression Guardian

Huit vérifications, dont deux qui gardent le raisonnement : que les deux faces
partagent le même contrat, et qu'aucune clause `is null` de rattrapage
n'apparaisse.

**Réserves inchangées, et je les répète parce qu'elles ne s'usent pas** : les
preuves vivent en transaction annulée ; la garde statique n'existe pas ; le
classificateur n'a toujours pas de tests. **Six occurrences fermées
n'empêchent pas la septième.**

## Preuves

- Migration `20260906060000_garde_insertion_site.sql`, **Test uniquement**.
- 5 insertions illégitimes refusées `42501`, 2 chemins légitimes acceptés.
- `test_garde_insertion_site_20260906.js` — 8 vérifications.
- ADR-0001 **ACCEPTÉE**, 6 occurrences recensées.
- Suite `190/199`, mêmes 9 échecs historiques.
- `main` et `production` : `501c0c7` — preuve calculée par l'outillage.

## Rollback

Migration inverse rétablissant les deux policies dans leur forme antérieure.
**Aucune donnée touchée** : retour complet.

## Risques / anomalies

1. **La garde statique n'existe toujours pas.** L'ADR est acceptée mais non
   opposable ; rien n'empêche une septième occurrence.
2. **52 policies `UPDATE` classées par lecture**, non éprouvées.
3. **Le classificateur reste sans tests** et non promu.
4. **Les Edge Functions** demeurent hors de portée en Test.

## Question pour arbitrage

**Q49 — Garde statique ou classe D ?** C'est le choix que la décision
précédente laissait ouvert. Recommandation : **la garde statique d'abord**.
La classe D touchera 9 écritures et 54 defaults — le plus grand volume de
changement du chantier — et le ferait sans invariant automatisé, alors qu'on
vient de passer six lots à trouver un même motif à la main. Construire
l'instrument avant d'ouvrir le plus gros chantier est le seul ordre qui ne
répète pas l'erreur.

## Action attendue de ChatGPT

Arbitrer Q49 pour le `LOT_ID` **SITE-EXPLICITE-1-INSERT-SITE-GUARD-20260906**.
**Aucune extension n'est demandée ; la classe D reste fermée.**
