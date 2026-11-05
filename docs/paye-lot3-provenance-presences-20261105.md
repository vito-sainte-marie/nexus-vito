# Paye lot 3 — provenance des présences (05/11/2026)

Rapport écrit avant tout changement de libellé. Aucun calcul n'est modifié ; pas de migration.

## D'où viennent `presencesMesurees` et `presencesReconstituees`

| Cas | Champ | Sens réel |
|---|---|---|
| Verify **et** pointage concordent | `presencesMesurees` | journée attestée par deux sources |
| Une seule source (Verify seul, pointage seul) ou Verify sans planning | `presencesReconstituees` | journée attestée par **une seule** source |
| Renfort planifié, sans preuve (avant le 01/10/2026) | `presencesPlanifiees` | le planning officiel fait foi pour le renfort |

Durée retenue : `horaire_exceptionnel` > `duree_reference` (barème du poste) > `planning`.

Le mot « reconstituée » ne signifie donc pas « inventée » : la journée est bien constatée, mais par une seule source. Le même mot recouvrait trois formulations différentes à l'écran, dans l'infobulle et dans le PDF.

## Trois notions retenues

- **Constatée** : journée attestée par Verify (avec ou sans pointage) ou, pour un renfort, par le planning officiel. Une journée à source unique est signalée comme telle.
- **Calculée** : durée chiffrée selon les règles du poste (journée longue = 7 h + 1 h supplémentaire, règle du 10/10).
- **Corrigée** : heures exceptionnelles justifiées par le manager.

## Ce qui change / ne change pas

Change : libellés, infobulles, note du PDF (`NEXUS-Paye-v1.html`, `nexus-paye-dossier-pdf.js`).
Ne change pas : noms de champs, heures retenues, montants, sources, permissions.

## Point (a)

Un écart de caisse (`typeItem = ecart_caisse`, `impactPaye = false`) ne compte plus dans le statut du salarié ni dans « Décisions à traiter ». Il reste visible en consultation, avec le lien vers Verify. Limité aux écarts de caisse : les autres items `impactPaye = false` restent des décisions. Un écart de caisse contesté est aussi exclu (neutre pour la paie, traité dans Verify).
