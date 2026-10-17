---
protocol: nexus-handoff/2
kind: request
lot_id: FAST-TRACK-POMPISTE-RELEVES-PISTE-20261016
seq: 7
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=55285d8b production=3a014991
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 158-fichiers
  - id: preuve-sql-refus
    classe: VERIFIED
    valeur: sha256=f3dd4e45963a2833a1af6aa4d8554d9d0c3fda37a3370288358aba983682cafe
  - id: politique-installee
    classe: VERIFIED
    valeur: 0 (transaction annulee sur Test, aucune permission modifiee)
---
# FAST TRACK — Arbitrage de sécurité : envoi de la photo Veeder-Root par le pompiste (Test seulement)

**Aucune permission n'est modifiée.** Décision de principe de l'humain : FAVORABLE à un droit d'envoi ciblé, exclusivement sur Test. Cette demande soumet la politique exacte et les preuves au palier humain de sécurité **avant toute application**. Aucun GO Production, aucune fusion.

## Preuve des conditions de decision-4

Remesuré en lecture seule sur Test le 17/10/2026 : `anon` n'a aucun droit sur les quatre tables d'index ; `authenticated` n'a pas TRUNCATE ; RLS active sur les quatre ; les deux fonctions trigger restent non SECURITY DEFINER avec EXECUTE PUBLIC, comme arbitré. Aucune fusion, aucune écriture Production ni sur main/production depuis. Aucune différence entre objets déployés et objets visés.

## 1. Constat
Sur Test, un pompiste ne peut pas téléverser la photo du Veeder-Root : « new row violates row-level security policy » (bucket `documents-a-traiter`).

## 2. Audit des politiques actuelles (bucket privé `documents-a-traiter`, `storage.objects`)
- `documents_a_traiter_ecriture_site` (INSERT) : `nexus_clients_ecriture_ok(site)` = rôle manager/gérant du site → exclut le pompiste.
- `documents_a_traiter_lecture_site` (SELECT) : `nexus_clients_lecture_ok(site)`.
- `documents_a_traiter_service_role_tout_acces` (ALL) : service_role (worker OCR).
- Aucune politique UPDATE/DELETE pour les utilisateurs. Table `documents_ocr_file` : INSERT déjà ouvert à `depose_par = auth.uid()` sur son site.
- **Droit nécessaire, et lui seul : un INSERT.** Pas de SELECT (la page lit le résultat via `documents_ocr_file`), pas d'UPDATE, pas de DELETE, pas d'`upsert`.

## 3. Politique SQL exacte soumise (additive, aucune politique existante modifiée)
```sql
create policy documents_a_traiter_jaugeage_pompiste on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents-a-traiter'
    and array_length(storage.foldername(name), 1) = 2
    and (storage.foldername(name))[1] = public.current_employee_site_id()
    and (storage.foldername(name))[2] = 'jaugeage_veeder_root'
    and public.est_pompiste_du_jour((storage.foldername(name))[1])
    and storage.filename(name) like '____-__-__\_' || auth.uid()::text || '\_%'
    and lower(storage.extension(name)) in ('jpg','jpeg','png','webp','heic')
  );
```
Conditions : son propre site ; dossier unique `<site>/jaugeage_veeder_root/` sans sous-dossier ; pompiste du jour en quart `en_cours` (fonction existante, fail-closed) ; nom portant son `auth.uid()` ; extensions image seulement. Aucun élargissement des politiques existantes, aucune lecture/modification/suppression ajoutée, aucun accès `anon`.

## 4. Preuves de refus (Test, transaction `begin … rollback`, fichier `preuve-upload-jaugeage-pompiste-test.sql`)
| Cas | Résultat |
|---|---|
| Pompiste du jour, son site, bon chemin | ACCEPTÉ (attendu) |
| Autre site (chemin d'un autre site) | REFUSÉ |
| Autre dossier / sous-dossier du site | REFUSÉ |
| Extension non image (pdf) | REFUSÉ |
| Nom sans l'identifiant de l'appelant | REFUSÉ |
| Utilisateur non habilité (caissier) | REFUSÉ |
| Pompiste d'un autre site visant ce site | REFUSÉ |
| Remplacement (UPDATE) | 0 ligne (aucune politique) — réserve : le pompiste ne voit de toute façon aucun objet, la preuve est donc structurelle |
| Suppression (DELETE) | aucune politique DELETE pour `authenticated` (0) ; le DELETE SQL direct est de toute façon interdit par `storage.protect_delete` |
| Lecture | 0 objet visible : aucun droit SELECT ajouté |

Contrôle final : `politique_installee = 0` après rollback.

## 5. Ce qui n'est pas prouvé
- Le test d'upload par l'API Storage réelle (jeton pompiste) n'est possible qu'après application.
- Le cas « pompiste hors quart » n'est couvert que par `est_pompiste_du_jour` (existante, fail-closed), non rejoué ici.

## 6. Décision demandée
Autoriser l'application de cette politique **sur Test uniquement**, via l'ordre habituel. Après application : recette complète (sélection de photo, upload, OCR par le worker, correction manuelle, validation, enregistrement, consultation dans Carburants / Relevés), puis Safari iOS sur appareil réel (NON TESTÉ à ce jour). Le succès de l'OCR Apple Vision local n'est pas une preuve du parcours NEXUS. Rien sur Production.
