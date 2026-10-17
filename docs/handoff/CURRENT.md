<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/FAST-TRACK-POMPISTE-RELEVES-PISTE-20261016/request-8.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: FAST-TRACK-POMPISTE-RELEVES-PISTE-20261016
seq: 8
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=ff19b8a0 production=838630c9
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 156-fichiers
  - id: registre-production
    classe: VERIFIED
    valeur: 318 (20261017130000), 311 quarts, bucket documents-a-traiter 3 politiques, 0 objet jaugeage_veeder_root
  - id: politique-sql
    classe: VERIFIED
    valeur: sha256=9f82f38a0cbc0ea6479574b0e877dde37e02be81f8837d11f46dade40e592bcc
  - id: preuve-sql-refus-test
    classe: VERIFIED
    valeur: sha256=f3dd4e45963a2833a1af6aa4d8554d9d0c3fda37a3370288358aba983682cafe
  - id: preuve-production
    classe: NOT_APPLICABLE
    valeur: rejouer la preuve de refus sur Production est un geste decriture soumis a cette decision
  - id: geste-humain
    classe: HUMAN
    valeur: GO distinct de Frederic pour appliquer la politique en Production, puis upload reel sur un vrai quart et Safari iOS
---
# FAST TRACK — Arbitrage de sécurité : envoi de la photo Veeder-Root par le pompiste, reprise en PRODUCTION

**Aucune permission n'est modifiée par cette demande.** decision-5.md a ratifié la politique `documents_a_traiter_jaugeage_pompiste` sur Test exclusivement et précisé : « La reprise en Production exigerait un arbitrage de sécurité et un GO distincts. » Cette demande est cet arbitrage. Elle soumet le geste, ses préconditions et la preuve attendue au palier humain. Aucune application, aucune fusion, aucun déploiement avant décision.

## Preuve des conditions de decision-5

Remesuré en lecture seule le 17/10/2026 :

1. **Politique ratifiée sur Test exclusivement** — Test porte quatre politiques sur ce bucket : les trois d'origine inchangées et `documents_a_traiter_jaugeage_pompiste` (INSERT, `authenticated`), seule nouvelle. Conforme à l'objet ratifié.
2. **Aucune autre politique modifiée, aucun élargissement, aucune fusion, aucune intervention Production sur ce sujet.** Production porte toujours exactement les trois politiques d'origine : la politique n'y a pas été appliquée. Précision de fait, pour qu'elle ne soit pas découverte ailleurs : après decision-5, Frédéric a donné un GO distinct (« go deploiement sur le perimetre deja testé ») qui a porté en Production le périmètre relevés piste — migrations 20261016230000 et 20261017130000 (aucun grant ni politique d'upload), PR #135 fusionnée dans `production` (838630c9) et déploiement Pages. La migration 20261017120000 en a été **exclue** précisément pour être soumise ici.
3. **Recette complète sur Test** — jouée et consignée (`recette-test-20261016.md`) ; Safari iOS sur appareil réel : NON TESTÉ.

## 1. Pourquoi maintenant

Le périmètre « relevés piste » est en Production depuis le 17/10/2026 (PR #135, fusionnée en 838630c9, déployée ; migrations 20261016230000 et 20261017130000, registre 318). La politique d'envoi photo en a été exclue volontairement (migration 20261017120000, « EXCLUE — Test/CI »). Conséquence mesurée : en Production, un pompiste ne peut pas téléverser la photo du Veeder-Root (aucune politique INSERT pour son rôle sur le bucket) ; le jaugeage retombe en `hors_ligne` (valeur saisie à la main, sans photo de preuve).

## 2. État de Production mesuré en lecture seule (17/10/2026)

- Bucket `documents-a-traiter` : privé, sans limite de taille ni liste de types MIME déclarée.
- Politiques `storage.objects` visant ce bucket : exactement trois — `documents_a_traiter_ecriture_site` (INSERT, via `nexus_clients_ecriture_ok(site)` : manager/gérant du site, donc exclut le pompiste), `documents_a_traiter_lecture_site` (SELECT), `documents_a_traiter_service_role_tout_acces` (ALL, service_role, worker OCR). Aucune politique UPDATE/DELETE pour les utilisateurs.
- `documents_ocr_file` : INSERT, SELECT, DELETE (manager du site) existent ; l'INSERT est déjà ouvert à `depose_par = auth.uid()`.
- Fonctions requises présentes : `est_pompiste_du_jour(text)` (SECURITY DEFINER, STABLE, fail-closed : fuseau du site valide, shift `en_cours` du jour, rôle `pompiste`), `current_employee_site_id()`, `nexus_clients_ecriture_ok`.
- Objets déjà présents sous `*/jaugeage_veeder_root/*` : 0.

## 3. Le geste demandé

Appliquer sur Production, **à l'identique de Test**, la migration `20261017120000_politique_upload_jaugeage_pompiste.sql` (sha256 du texte : `9f82f38a0cbc0ea6479574b0e877dde37e02be81f8837d11f46dade40e592bcc`) :

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

Droit ajouté, et lui seul : **un INSERT** pour `authenticated`, sur son propre site, dans l'unique dossier `<site>/jaugeage_veeder_root/` (pas de sous-dossier), pendant son quart `en_cours` du jour, avec un nom préfixé de la date et de son `auth.uid()`, extensions image seulement. Aucun SELECT, UPDATE, DELETE ni `upsert` ajouté ; aucun accès `anon` ; aucune politique existante modifiée.

## 4. Preuves existantes et leur limite

Preuve de refus rejouée sur Test (`preuve-upload-jaugeage-pompiste-test.sql`, transaction annulée, sha256 `f3dd4e45963a2833a1af6aa4d8554d9d0c3fda37a3370288358aba983682cafe`) : accepté pour le pompiste du jour sur son site et le bon chemin ; refusé pour un autre site, un autre dossier ou sous-dossier, une extension non image, un nom sans l'identifiant de l'appelant, un utilisateur non habilité, un pompiste d'un autre site ; aucun UPDATE ni DELETE possible ; aucune lecture ajoutée. Recette Test jouée ensuite sur le parcours réel.

**Ce qui n'est PAS prouvé pour la Production :**
- Cette preuve a été jouée sur Test, pas sur Production : la rejouer sur Production serait elle-même un geste d'écriture (même annulé), donc soumis à cette décision. Elle est proposée comme **précondition d'application** (voir §5), dans la même transaction, avec annulation sur tout écart.
- Test de l'API Storage réelle avec un jeton de pompiste réel : à faire après application, sur un vrai quart, par Frédéric ou un pompiste.
- Safari iOS sur appareil réel et caméra : NON TESTÉS à ce jour.
- Pompiste hors quart : couvert uniquement par `est_pompiste_du_jour` (existante, fail-closed), non rejoué.

## 5. Conditions proposées pour le GO

1. Protocole Production habituel : `execute_sql` jamais `apply_migration`, une transaction `begin; set local lock_timeout='2s'; …; insert into supabase_migrations.schema_migrations (version, name); commit;`, contrôle C3 du texte transmis par md5 contre le fichier, lecture seule préalable.
2. Précondition : les trois politiques ci-dessus sont toujours les seules sur ce bucket et `documents_a_traiter_jaugeage_pompiste` est absente ; sinon arrêt.
3. Postcondition mesurée : exactement quatre politiques sur ce bucket, la nouvelle étant INSERT / `authenticated`, texte égal à celui ci-dessus ; les trois autres inchangées ; registre 319 ; aucune ligne d'écriture ou d'objet créée.
4. Retour arrière documenté : `drop policy documents_a_traiter_jaugeage_pompiste on storage.objects;` (une seule instruction, aucun effet sur les données ; les photos déjà déposées resteraient lisibles par les rôles existants).
5. Après application : un pompiste réel (ou Frédéric) téléverse une photo sur un vrai quart ; contrôle que l'objet apparaît sous `<site>/jaugeage_veeder_root/`, que `documents_ocr_file` reçoit sa ligne et que le worker traite ; Safari iOS réel à faire à ce moment, avec constat écrit.
6. Aucune autre permission, aucun secret, aucune fusion, aucun déploiement applicatif n'est requis : le code appelant est déjà en Production (PR #135).

## 6. Décision demandée

Autoriser, ou refuser, l'application de cette politique unique sur **Production**, selon les conditions du §5. Sans décision favorable, Production reste en l'état : le jaugeage fonctionne en mode `hors_ligne` (saisie manuelle sans photo).
