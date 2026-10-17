# Trace d'exécution — politique d'upload photo du jaugeage (Production)

Lot : FAST-TRACK-POMPISTE-RELEVES-PISTE-20261016 — action prescrite par decision-6.md (en réponse à request-8.md).
Date : 17/10/2026. Autorisation : GO explicite de Frédéric Bragance (« go sur l'application en Production »), consigné par decision-6.

## Action exécutée
Migration `20261017120000_politique_upload_jaugeage_pompiste.sql` (sha256 du texte `9f82f38a0cbc0ea6479574b0e877dde37e02be81f8837d11f46dade40e592bcc`), appliquée sur Production (`uzhjpqpctpvxytxpxoqz`) par `execute_sql` (jamais `apply_migration`), `lock_timeout = 2s`, tampon dans `supabase_migrations.schema_migrations`.
Objet créé : politique `documents_a_traiter_jaugeage_pompiste` (INSERT, `authenticated`) sur `storage.objects`.

## Contrôles mesurés
- Avant : 3 politiques sur le bucket `documents-a-traiter`, la nouvelle absente.
- Après : 4 politiques (ecriture_site INSERT, jaugeage_pompiste INSERT/authenticated, lecture_site SELECT, service_role_tout_acces ALL) ; registre des migrations 319 ; 0 objet sous `*/jaugeage_veeder_root/*`.

## Retour arrière
`drop policy documents_a_traiter_jaugeage_pompiste on storage.objects;`

## Non prouvé à ce jour
Envoi réel d'une photo sur un vrai quart (Storage API, ligne `documents_ocr_file`, traitement par le worker) ; Safari iOS et Android sur appareil réel ; preuve de refus non rejouée sur Production.

## Code appelant
PR #135 (838630c9) puis PR #136 (13388b23, cause du refus et compatibilité Android), déployées sur Pages.
