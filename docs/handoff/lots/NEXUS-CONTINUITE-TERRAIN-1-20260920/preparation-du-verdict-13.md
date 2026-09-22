# Décision 13 — préparée intégralement, non signée

Ce fichier n'est **pas** une enveloppe du registre : il ne porte pas de front-matter
`kind: decision`, le validateur ne le lit pas, et il ne vaut aucun verdict. C'est le geste de
Frédéric, prêt à être exécuté par lui — corps, commande et dérogation compris.

Motif de ne pas le signer moi-même : un verdict porte la signature de son auteur, et la
dérogation qu'il entraîne porte un `autorise_par`. Frédéric a donné le GO de ratification en
session, mais il n'a pas vu la dérogation que le dépôt réclame, et l'inscrire à son nom
reviendrait à lui faire autoriser ce qu'il n'a pas lu. Voir `request-13.md` §5 pour la mesure.

## 1. Corps de la décision

À écrire dans un fichier — ci-dessous, `/tmp/corps-decision-13.md` :

```markdown
# Décision Créateur — ratification de `5b047e0`, et GO de transport vers les deux branches de PR

GO ratification.

## Les mots de la décision

Transcrits du message de Frédéric :

> 1. Ratifier `5b047e0`, en enregistrant la non-conformité procédurale.
> 2. Autoriser explicitement le transport Git vers les deux branches PR non protégées, et
>    uniquement elles : `fdj-vague1-cycle-caisse-20260916` pour #62 et
>    `reception-regularisation-20260919` pour #65.
> 3. Faire pousser les intégrations préparées par Claude, puis considérer les SHA GitHub
>    obtenus comme les nouveaux candidats, pas `fe4e9a2`/`fe36a8e` par confiance implicite.
> 4. Laisser la CI repartir sur chacun et vérifier les preuves ordinaires sur ces SHA exacts.
> 5. Inscrire explicitement au dossier que la recette navigateur profonde n'existe pas pour
>    leur SHA. Ne pas transformer son absence en succès ou en preuve équivalente.
> 6. Une fois les deux dossiers constitués, seulement alors décider de leur promotion
>    Production. Aucune fusion Production automatique.

> Donc oui : je ratifierais toujours `5b047e0`. Et, au vu du rapport de Claude, je donnerais
> également le GO au transport des deux intégrations vers leurs branches PR non protégées,
> strictement pour déclencher et obtenir les preuves CI. Pas de GO Production.

## Ce qui est ratifié

La justesse de `5b047e0` — la suppression du repli silencieux de
`.github/workflows/claude.yml`, telle que mesurée par `request-13` §2.

**La non-conformité procédurale reste explicitement inscrite au registre** : ce commit a été
déposé directement sur `main`, sans pull request, sans enveloppe préalable et sans revue. La
ratification ne transforme pas ce geste en geste conforme, ne réécrit pas l'historique et ne
crée aucun précédent. Le prochain changement de CI passe par une enveloppe.

## Ce qui est autorisé en plus, et rien d'autre

Le transport Git vers **deux branches de PR non protégées, et uniquement elles** :
`fdj-vague1-cycle-caisse-20260916` (#62) et `reception-regularisation-20260919` (#65),
strictement pour déclencher et obtenir les preuves CI. Cette autorisation ne couvre ni `main`,
ni `production`, ni le rail `handoff-continuite-20260920` lui-même.

## Ce qui n'est pas autorisé

**Pas de GO Production.** Aucune fusion vers `production`, aucun déploiement, aucune migration
Supabase Production, aucune écriture de données Production. Les dossiers de décision de #62 et
#65 se constituent d'abord ; la promotion se décide ensuite, séparément, jamais
automatiquement.
```

Pourquoi `APPROVED_WITH_CONDITIONS` et non `APPROVED` : le corps pose des réserves qui
survivent au GO — la non-conformité reste inscrite, le transport est borné à deux refs, et la
Production est exclue. `APPROVED` les effacerait. `GO_RATIFICATION`, employé en
`decision-12.md`, est hors vocabulaire et a coûté une dérogation de plus : ne pas le reprendre.

## 2. Commande de dépôt

```bash
cd /Users/fredericbragance/Documents/nexus-worktree-handoff-continuite && node outils/handoff.js decision NEXUS-CONTINUITE-TERRAIN-1-20260920 /tmp/corps-decision-13.md --decision APPROVED_WITH_CONDITIONS --closes false --en-reponse-a request-13.md --auteur Frederic
```

`closes: false` : le lot reste ouvert — les dossiers #62 et #65 et la question B1 y vivent
encore.

## 3. La dérogation que ce dépôt réclame

Mesure prise : après ce dépôt, `handoff.js verifier` rend **une** violation et une seule,
`SEQUENCE_NON_CONTIGUE` sur `decision-13.md`. Entrée à ajouter à la liste `derogations` de
`docs/handoff/STATE.json` — le champ `le` se met à la date réelle du geste :

```json
{
  "fichier": "NEXUS-CONTINUITE-TERRAIN-1-20260920/decision-13.md",
  "regle": "SEQUENCE_NON_CONTIGUE",
  "motif": "decision-13.md est la 11e decision reelle du lot et porte le rang 13, parce que decision-12.md porte deja le rang 12 pour la 10e — decision-10.md et decision-11.md n'ont jamais existe. Defaut de FORME seulement, et HERITE : ce n'est pas un ecart de ce depot mais la consequence mecanique de la mauvaise numerotation de decision-12.md, deja derogee le 22/09/2026. L'outil handoff.js decision numerote derniere+1, donc 13 ; la seule numerotation contigue serait 11, c'est-a-dire glisser cette decision AVANT decision-12.md alors qu'elle est deposee apres — fabriquer un ordre qui n'a pas eu lieu, ce que l'append-only interdit. Le fichier n'est ni renomme ni reecrit. Consequence a assumer : ce lot ne peut plus produire une decision contigue, et chaque decision suivante appellera la meme derogation.",
  "autorise_par": "Frédéric Bragance (gate humaine)",
  "le": "2026-09-22"
}
```

## 4. Après le dépôt

```bash
cd /Users/fredericbragance/Documents/nexus-worktree-handoff-continuite && node outils/handoff.js verifier && node outils/handoff.js consommer NEXUS-CONTINUITE-TERRAIN-1-20260920
```
