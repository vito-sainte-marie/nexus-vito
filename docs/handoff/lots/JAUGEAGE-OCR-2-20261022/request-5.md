---
protocol: nexus-handoff/2
kind: request
lot_id: JAUGEAGE-OCR-2-20261022
seq: 5
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=73c88a47 production=78840bc4
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 160-fichiers
---
# JAUGEAGE-OCR-2-20261022 : nommer l'envoi de la photo de jaugeage sans nom d'employé

**Suite de :** decision-4.md (capture guidée, PR brouillon #149). Complément demandé par Frédéric le 22/10/2026. Texte préparé, **non déposé** : à déposer comme request-5 quand le registre est libre. **Aucun code n'est écrit avant la décision.**

## Constat (code lu sur `origin/production`, 22/10/2026)

`NEXUS-Releves-Piste-v1.html`, `envoyerPhoto` :

```
const chemin = `${emp.site_id}/jaugeage_veeder_root/${date}_${emp.id}_${Date.now()}.${fmtEnvoi.ext}`;
```

- Le nom contient `emp.id`, l'identifiant de l'employé : les deux photos du 22/10 téléchargées par Frédéric s'appellent `2026-10-22_0d44032a-…_<ms>.jpg`. Le nom identifie donc la personne, et il est illisible pour un humain.
- L'heure n'y figure pas ; seul `Date.now()` (millisecondes, UTC) la porte, sans lisibilité.
- La ligne `documents_ocr_file` garde déjà `depose_par = emp.id` : la traçabilité n'a pas besoin du nom de fichier.

## Preuve des conditions de decision-4

Détail et correction datée : `docs/executions-lot-JAUGEAGE-OCR-2-capture-guidee-20261022.md` (commit `6f086c74`).
- Branche applicative distincte du rail, PR brouillon uniquement : `jaug-capture-guidee`, PR #149, HEAD `9cb23678`, CI verte (`non-regression`, « Construire et éprouver l'artefact »), état `CLEAN`.
- Changement limité à la capture guidée du jaugeage ; lecteur Vision et iMac non touchés ; Pointage et Relevés Piste conservés à l'identique (épreuve de non-régression dédiée).
- Recadrage avec en-tête date/heure et repère 2 × 2 (marge de 6 %) ; proportions 5:3 et seuils (netteté 500, reflet 3 %) documentés dans la source, **provisoires** : proportion confirmée par une seule photo réelle, seuils établis sur images synthétiques.
- 52 vérifications vertes, 14 mutants sur 14 tués. Écart avoué : module écrit avant l'épreuve. Délai 20 à 27 ms sur navigateur de test, **pas une preuve iPhone**.
- **Condition « aucune fusion » : levée par le GO explicite de Frédéric dans le chat (22/10/2026) pour #149**, avant validation iPhone ; à consigner comme écart. Les seuils restent provisoires jusqu'à la recette iPhone et la calibration sur quinze photos. Aucune écriture Production, aucune mise en service par Claude.

## Ce qui est demandé

1. **Nouveau nom** : `nexus-jaug_<site>_<AAAA-MM-JJ>_<HHhMM>.<ext>`, par exemple `nexus-jaug_vito-sainte-marie_2026-10-22_15h22.jpg`.
   - `<site>` : le `site_id` déjà utilisé.
   - Date et heure : **l'heure de la station** (`nexusFuseauSite` + `nexusJourDansFuseau`, comme le reste de l'écran), jamais l'heure de l'appareil. Sans fuseau connu, aucun envoi n'est nommé au hasard : même refus que l'écran actuel.
   - **Aucun nom, identifiant ni UUID d'employé** dans le nom.
2. **Dossier inchangé** : `<site_id>/jaugeage_veeder_root/` dans le bucket `documents-a-traiter`. `depose_par`, `type_document` et le reste de l'insertion ne changent pas.
3. **Extension** : `.jpg` quand l'image envoyée est le JPEG redimensionné (cas normal). Le repli existant sur l'original (PNG, WebP, HEIC) garde son extension réelle ; on ne renomme pas un format en `.jpg`.
4. **Unicité** : l'envoi se fait sans écrasement (`upsert: false`). Si le nom existe déjà (deux photos dans la même minute), on ajoute `-2`, `-3`, … avant l'extension, jusqu'à une limite documentée, puis on échoue avec le message d'erreur d'envoi existant. Le nom retenu est celui inséré dans `fichier_path`. *Arbitrage proposé :* suffixe numérique par réessai plutôt que secondes ou aléa, pour garder un nom lisible dans le cas courant.
5. **Épreuve sur le format** : une fonction pure (module testable) construit le nom ; l'épreuve vérifie le motif `^nexus-jaug_[a-z0-9-]+_\d{4}-\d{2}-\d{2}_\d{2}h\d{2}(-\d+)?\.(jpg|png|webp|heic)$`, l'heure de station (un instant à 23 h 30 UTC donne le jour et l'heure du fuseau, pas ceux de l'UTC), l'absence de tout identifiant d'employé, le suffixe de collision, le refus sans fuseau, et que le dossier reste `<site>/jaugeage_veeder_root/`. Rouge d'abord sur le code actuel, puis vert ; mutations : heure UTC au lieu de la station, `emp.id` réintroduit, suffixe supprimé, extension forcée en `.jpg`.
6. **Hors périmètre** : les objets déjà déposés ne sont pas renommés ; le Pointage et le module `nexus-camera-page.js` ne changent pas ; aucun changement de lecteur Vision, de worker ni d'iMac.

## Constats de vérification (22/10/2026)

- **Le worker ne lit pas le nom pour en tirer la date ou l'employé.** `main.py` passe `doc["fichier_path"]` à `moteur.extraire(...)`, qui ne s'en sert que pour reconnaître un PDF (`_est_pdf`, extension). Aucune vue ni fonction SQL du dépôt ne lit `fichier_path` d'un jaugeage ; les lectures existantes concernent les factures et bons (Boîte de réception, `nexus-envoyer-facture`). Le changement de nom ne casse donc aucun lecteur.
- **BLOQUANT TROUVÉ : la politique de stockage impose l'identifiant de l'employé dans le nom.** `supabase/migrations/20261017120000_politique_upload_jaugeage_pompiste.sql` exige `storage.filename(name) like '____-__-__\_' || auth.uid()::text || '\_%'`. Un nom `nexus-jaug_…` serait **refusé** par la base. Le changement de nom exige donc une migration qui remplace cette politique : même dossier (`<site>/jaugeage_veeder_root/`, profondeur 2), même pompiste du jour, mêmes extensions, mais le nom doit suivre le motif `nexus-jaug_<site>_<AAAA-MM-JJ>_<HHhMM>(-N)?.<ext>` au lieu de contenir `auth.uid()`. Conséquence : la garde « le fichier porte l'identité de son déposant » disparaît du nom ; elle subsiste dans `documents_ocr_file.depose_par` et dans la règle « pompiste du jour du site ». À arbitrer explicitement.
- Cette migration est **Test seulement** dans cette request. L'état de la politique en Production est à mesurer (lecture seule) avant toute promotion : le lot « relevés piste promus » avait exclu la politique d'upload.
- **Ordre avec #149** : #149 est fusionnée sur GO de Frédéric avant ce changement ; celui-ci se bâtit sur la Production à jour.

## Ce que la request ajoute à l'étendue (conséquence du bloquant)

7. **Migration de remplacement de la politique** `documents_a_traiter_jaugeage_pompiste` (drop + create dans une transaction), avec épreuve de refus sur Test : ancien nom avec `auth.uid()` accepté ou non selon l'arbitrage (proposé : refusé), nom `nexus-jaug_…` d'un autre site refusé, extension hors liste refusée, pompiste non du jour refusé, dossier autre refusé. Fichier de preuve SQL comme pour la request-7 du 17/10.
8. Hors Test : aucune promotion en Production sans GO ; la migration exige le code d'abord ou l'inverse selon la mesure de l'état Production (à documenter).

## Limites

- Aucune écriture en Production, aucun déploiement, aucune fusion sans le GO de Frédéric.
- Recette sur Test seulement ; les photos de jaugeage réelles ne sont jamais versionnées.
