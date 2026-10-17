# Décision sur request-8.md — GO humain de Frédéric (application en Production)

Cette décision consigne l'arbitrage humain rendu par Frédéric Bragance dans la conversation du 17/10/2026, en réponse à request-8.md : « go sur l'application en Production ». Aucune décision d'arbitre n'était arrivée sur le rail au moment du GO ; Frédéric, palier humain, a tranché directement. La décision est donc consignée après l'application, et le dit.

1. **Politique `documents_a_traiter_jaugeage_pompiste` : APPROUVÉE et APPLIQUÉE en Production**, selon les conditions du §5 de request-8.md. INSERT pour `authenticated`, site propre, dossier unique `jaugeage_veeder_root`, pompiste du jour (`est_pompiste_du_jour`), nom préfixé de `auth.uid()`, extensions image seulement.
2. Aucune autre politique modifiée, aucun élargissement, aucune fusion, aucun déploiement applicatif, aucun secret.

## Vérification de l'objet appliqué (Claude, 17/10/2026)

- Avant : registre 318 (20261017130000), exactement trois politiques sur le bucket, nouvelle politique absente, 0 objet `jaugeage_veeder_root`, fonctions requises présentes.
- Application : `execute_sql` (jamais `apply_migration`), une transaction, `lock_timeout` 2 s, tampon `20261017120000 / politique_upload_jaugeage_pompiste`. Le texte de la politique est celui du fichier (sha256 `9f82f38a0cbc0ea6479574b0e877dde37e02be81f8837d11f46dade40e592bcc`) sans `begin`/`commit` ; le contrôle md5 du texte transmis n'a pas été rejoué.
- Après : registre 319 ; quatre politiques (les trois d'origine inchangées, plus la nouvelle : INSERT, rôle `authenticated`) ; 0 objet créé.
- Retour arrière : `drop policy documents_a_traiter_jaugeage_pompiste on storage.objects;`.

## Reste ouvert (non testé)

- Envoi réel d'une photo par un pompiste sur un vrai quart, via l'API Storage, puis ligne `documents_ocr_file` et traitement par le worker.
- Safari iOS sur appareil réel et caméra.
- La preuve de refus n'a été jouée que sur Test ; elle n'a pas été rejouée sur Production (geste d'écriture).

La décision ne clôt donc pas le lot.
