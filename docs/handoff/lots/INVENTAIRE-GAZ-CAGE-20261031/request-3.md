---
protocol: nexus-handoff/2
kind: request
lot_id: INVENTAIRE-GAZ-CAGE-20261031
seq: 3
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=659af077 production=bd7c2dbf
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 170-fichiers
  - id: merge-pr168
    classe: VERIFIED
    valeur: bd7c2dbf
  - id: deploiement-production
    classe: VERIFIED
    valeur: run-7467319695
  - id: contenu-servi
    classe: VERIFIED
    valeur: 160-6552326114
  - id: recette-guardian
    classe: VERIFIED
    valeur: 160-6551457282
  - id: verification-production
    classe: VERIFIED
    valeur: 160-6552053882
  - id: go-ecritures-production
    classe: HUMAN
    valeur: 160-6551475182
---
# INVENTAIRE-GAZ-CAGE-20261031 : request-3 — demande de clôture, #168 fusionnée et servie, deux écritures Production vérifiées

## Ce qui est fait

- **#168 fusionnée** (`bd7c2dbf`, 01/11 02:06 UTC), déploiement Production `github-pages` 7467319695 en succès. Guardian a vérifié le contenu servi sur app.nexusconseil.net (`calculerRepereCage`, `comptageAveugleImpose`, `repere_cage`, message « votre collègue était à la cage » présents ; aucune référence à Test) : commentaire 6552326114.
- **Comptage à l'aveugle pour l'employé** : aucune valeur transmise dans le DOM ni préremplie, les chemins qui écrivaient `ouverture = valeurTransmise` sont retirés ou gardés (request-2). Épreuve de 32 contrôles.
- **Repère de cage calculé** à la clôture (cage = nb_cages − ceil(q/capacité) + 1), jamais saisi, avec abstentions (comptage de plus de 24 h, mouvement ou correction depuis, réglage absent ou invalide, quantité hors 0–150, lecture en échec). Épreuve de 19 contrôles.
- **Recette Guardian sur Test** conforme (comptage aveugle et repère) : commentaire 6551457282.
- **Deux écritures Production**, sous le GO écrit de Frédéric (6551475182) puis son instruction dans le chat de la session : migration `20261031190000` (colonne `repere_cage jsonb` nullable) et réglage `{"nb_cages":5,"capacite":30}` sur l'unique Gaz 12,5KG de Sainte-Marie (`29cd4d36-…`, 1 ligne). Compte rendu 6551949510, recontrôle de Guardian en lecture seule 6552053882 : conforme, 1 réglage sur 244 lignes.

## Limites consignées

1. **Option (b), limite assumée** : le repère est calculé côté client. La quantité du dernier comptage n'apparaît jamais dans le DOM de l'employé, mais elle transite dans la réponse réseau et en mémoire. Une RPC serveur qui ne renverrait que l'état et la cage (option a) reste possible dans un lot ultérieur.
2. **H1 non prouvée** : la seconde `ouverture` à 0 n'a pas été reproduite (décision de Frédéric du 31/10, 18 h 42). La correction supprime les chemins d'écriture de `valeurTransmise` pour l'employé, sans dépendre d'une lecture de données.
3. **Historique des zéros laissé en l'état** : les ouvertures à 0 en double déjà en Production (30/10 et 31/10) ne sont ni filtrées ni corrigées. Aucun filtrage des zéros à la lecture (condition de decision-1).
4. **Estampille Production** : la migration est enregistrée sous `20261101014700 inventaire_zone_produit_repere_cage`, pas `20261031190000`. Non bloquant (la garde lit la fiche de qualification, blob `d71c75f1`, et la migration est idempotente). Aucune correction de `schema_migrations` sans GO de Frédéric.
5. **Trois limites de la recette Guardian**, à traiter dans le lot suivant : (i) une livraison saisie pendant la clôture n'est pas prise en compte par le repère (le masquer dès qu'une livraison du produit est ajoutée) ; (ii) « Écarts de passage de quart : 2 » reste visible de l'employé (à retirer) ; (iii) l'accès direct à Inventaire choisit le quart par l'heure.

## Suite

Clôture du lot sur decision APPROVED. Lot suivant : INVENTAIRE-CAISSE-RENFORT-20261031 (y compris le faux « Réassort potentiel +N »).

## Preuve des conditions de decision-1

1. **Lecture Production en SELECT, filtrée par site, résultats consignés** : aucune lecture de données pour départager H1 et H2 ; H1 et H2 ne sont pas départagées (request-2, décision de Frédéric du 31/10, 18 h 42). Les seules lectures Production de ce lot portent sur le catalogue et sur la ligne du Gaz 12,5KG (id, désignation, réglage), faites par Guardian et par cette session pour vérifier les deux écritures du GO ; aucune donnée de comptage lue.
2. **Corriger à la source seulement si H1 est confirmée** : H1 n'est pas confirmée. La correction (retrait pour l'employé des chemins d'écriture de `valeurTransmise`, comptage aveugle) est faite sur décision de Frédéric, sans dépendre d'une lecture de données. Écart assumé, déjà porté par request-2.
3. **Aucune heuristique de filtrage des zéros** : tenue. Le repère lit le dernier comptage `ouverture` ou `cloture` validé et manuel, sans écarter de ligne à 0 ; l'historique des zéros est laissé en l'état.
4. **Option A, `jsonb` nullable sur `inventaire_zone_produit`, `site_id` et RLS préservés** : tenue (colonne ajoutée seule, RLS et droits inchangés, vérifié sur Test puis sur Production). « Sur Test uniquement » a été dépassé par le GO de Frédéric, voir 6.
5. **Repère affiché à la clôture uniquement** : tenue (recette Guardian 6551457282 ; rien à l'ouverture).
6. **Aucune mutation, migration, fusion ou promotion Production** : NON tenue au sens littéral de decision-1, qui laissait ces gestes « hors de cette décision ». Ils ont eu lieu sous GO distincts de Frédéric : migration et réglage (GO écrit 6551475182, confirmé par Frédéric dans le chat de la session ; compte rendu 6551949510, recontrôle Guardian 6552053882), fusion de #168 par Frédéric (`bd7c2dbf`). L'arbitre est invité à le constater et non à le ratifier : la décision humaine n'est pas la sienne.
