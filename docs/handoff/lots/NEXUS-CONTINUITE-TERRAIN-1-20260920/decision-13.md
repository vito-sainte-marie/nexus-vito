---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-CONTINUITE-TERRAIN-1-20260920
seq: 13
author: Frederic
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: true
in_reply_to: request-13.md
---
# Décision Créateur — ratification de `5b047e0`, GO de transport vers les deux branches de PR, et clôture du lot

GO ratification. **Cette décision ferme le lot.**

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
Supabase Production, aucune écriture de données Production.

Les deux GO/NO GO de fusion sont **rendus et négatifs** : `NO GO temporaire` pour #62
(`fe4e9a2`) et `NO GO temporaire` pour #65 (`fe36a8e`), au 22/09/2026. Ce ne sont pas des
rejets fonctionnels — les candidats peuvent être bons, leur dossier de preuve n'est pas au
niveau requis. Les motifs et les mesures sont aux §7 et §8 de `dossier-decision-pr-62.md` et
`dossier-decision-pr-65.md`.

## Pourquoi cette décision ferme le lot

Une seule dérogation `SEQUENCE_NON_CONTIGUE` est accordée, strictement limitée au défaut de
séquence hérité de `decision-12.md`. Le contrôle de contiguïté étant **positionnel**
(`outils/handoff.js:250`, `seq` lu du nom de fichier), toute décision supplémentaire déposée
dans ce lot ajouterait mécaniquement une violation de plus, donc une dérogation de plus.

Décision de Frédéric : « Je ne prolongerais surtout pas ce lot avec trois décisions
supplémentaires qui généreraient mécaniquement trois nouvelles dérogations. B1 et les décisions
#62/#65 doivent repartir dans un lot successeur propre et contigu. »

**`closes: true`.** Les questions encore ouvertes sont transférées, telles quelles, au lot
successeur `NEXUS-CONTINUITE-TERRAIN-2-20260922`, numéroté à partir de `request-1` et contigu
par construction :

1. **B1 — l'accès du remplaçant.** Sans réponse depuis le 20/09/2026. Angélique est `renfort`,
   `current_employee_role()` lit `employees.role` et non le rôle du jour ; les trois comptes
   porteurs des droits n'ont plus de connexion depuis juillet.
2. **Les deux trous de preuve à combler avant tout GO Production de #62 et #65**, tels que
   nommés par Frédéric le 22/09 :
   - **Isolation Supabase Test pour les candidats web.** Le `nexus-auth.js` d'un candidat de PR
     code Supabase Production en dur ; une recette navigateur sur une de ces branches écrirait
     en Production. À corriger avant que #62 puisse devenir un candidat Production complet.
   - **Preuve de création réelle de la migration de #65.** Sur un schéma reproduisant
     exactement l'état des 276 migrations `production`, appliquer la seule 277e et vérifier les
     objets attendus. Environnement jetable ; aucune écriture Production n'est nécessaire.
3. **La dérive de schéma de Supabase Test**, formellement identifiée : 287 migrations
   appliquées dont 11 absentes de tous les arbres Git. À réconcilier après sécurisation du
   mécanisme Test, **sans la mélanger** aux fonctionnalités FDJ/Carburants.
