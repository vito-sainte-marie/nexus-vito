---
protocol: nexus-handoff/2
kind: request
lot_id: PRISE-DE-POSTE-UN-ECRAN-20261025
seq: 3
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=f56edb0d production=f6b145df
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 164-fichiers
  - id: suite
    classe: MEASURED
    valeur: 303/310
  - id: ci-pr158
    classe: VERIFIED
    valeur: 246b5765-checks-verts
---
# PRISE-DE-POSTE-UN-ECRAN-20261025 : preuve des conditions de decision-2

## Preuve des conditions de decision-2
PR #158 (brouillon, vers `production`), branche `prise-de-poste-un-ecran-20261025`, tête `246b5765`. Rien n'est fusionné, promu ni déployé en Production.

1. **Trois cartes, sans présélection, un appui.** Piste, Caisse, Renfort s'affichent sans présélection ni lecture du planning ; le poste se choisit en touchant sa carte. Recette Guardian sur l'alias d'aperçu, en employé puis en manager : conforme.
2. **« Ma progression » toujours visible**, première avec « Votre service est terminé » une fois la journée finie. Zone de recherche en haut de Ma Progression. Recette Guardian conforme.
3. **Aucun planning fictif, aucune nouvelle lecture ou écriture Production, aucune migration.** Les recettes ont eu lieu sur Test uniquement. Le service de recette du manager (`d136d364-5c55-46e5-b211-33b7130c8d32`) a été ouvert puis supprimé sur Test, avec le GO de Frédéric ; Guardian a constaté son absence. `cbd02130` est conservé jusqu'à la fin de la recette de #158 ; `afdfac9a` n'a pas été touché.
4. **PR en brouillon vers `production`**, recette Guardian sur l'aperçu, aucune fusion.
5. **`OPTION-PLANNING-PRISE-DE-POSTE` reste hors périmètre** : fiche seulement, aucun dépôt, aucune migration.

## Ce qui s'est ajouté pendant la recette
- **Bouton « Continuer »** : il réutilisait la classe des cartes photo. Il a désormais sa classe `.pdp-bouton` (charte cyan, 14 px, 47 px de haut), avec une garde et sa mutation. Guardian : conforme.
- **Incident `cbd02130`** : service clos par `pointage_depart` sans aucun pointage lié, à 13:42:02Z. Cause inconnue. Fiche `INC-74839140d278` ouverte dans `INCIDENTS.jsonl` (rail, 72216ec1), statut OUVERT. Guardian vérifie le rappel de sécurité demain matin avec Employé Test B.
- **CI rouge, puis corrigée.** La garde « Accueil : scriptRecherche » comparait une référence sans empreinte, alors que la construction épingle `nexus-recherche.js?v=…`. Elle est devenue tolérante à l'empreinte, et sa mutation rougit toujours (246b5765).

## Preuves chiffrées
- Suite lancée après `outils/build.sh` avec l'environnement de la CI : **303/310**, avec exactement les 7 échecs connus. La garde du lot compte 63 vérifications.
- Check GitHub sur 246b5765 : non-regression ×2 pass, « Construire et éprouver l'artefact » pass, Cloudflare Pages pass. GitHub Pages et Supabase Preview ne s'exécutent pas.

## À arbitrer
1. Les cinq conditions de decision-2 sont-elles tenues ?
2. Le lot peut-il passer à la fusion, sous réserve du GO de Frédéric (aucune fusion, promotion ni déploiement sans lui) ?

Aucune lecture ni écriture de la Production sans le GO de Frédéric.
