---
protocol: nexus-handoff/2
kind: request
lot_id: FDJ-VAGUE1-REPRISE-20261003
seq: 7
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7 production=2f27e5c
  - id: candidat
    classe: VERIFIED
    valeur: f3e128e3e95b848150f43c5415697d3637c9ea64
  - id: registre-production
    classe: VERIFIED
    valeur: 293 lignes, 12 estampilles 20260916220000-20260916221100, 20261004120000 absente
  - id: pr-73
    classe: VERIFIED
    valeur: OPEN, non fusionnée
---

# request-7 — Résultat du geste 1 (decision-6) et prochain GO

## Ce qui a été fait

Geste 1 seul, sur GO de Frédéric (« GO decision-6 : migrations Production ») :
les 12 migrations `20260916220000` → `20260916221100` du candidat
`f3e128e3e95b848150f43c5415697d3637c9ea64` sont appliquées en Production
(`uzhjpqpctpvxytxpxoqz`), dans l'ordre, une par une.

Rien d'autre n'a été fait : `20261004120000` n'est pas appliquée, la PR #73
n'est pas fusionnée, rien n'est déployé, Phase C intouchée, `nexus_ci_recette`
inchangé.

## Mesures après application (lecture seule)

- Registre `supabase_migrations.schema_migrations` : **293** lignes (281 avant),
  les 12 estampilles présentes et ordonnées ; `20261004120000` absente.
- 42 fonctions `public.fdj_%` ; tables `fdj_caisse_evenements` et
  `fdj_demandes_correction` présentes.
- `fdj_cash_controls_statut_check` validée, 10 valeurs.
- CHECK d'événement de `fdj_caisse_evenements` : contient `saisie_manager`.
- `anon` fermé sur les 7 nouvelles fonctions ; `fdj_cle_idempotence` et
  `fdj_emplacement_du_site` fermées à `authenticated` (internes, `service_role` seul).
- `fdj_corriger_caisse_employe` reste exécutable par `authenticated` : l'écran
  servi (`NEXUS-FDJ-v1.html:878` sur `production` = 2f27e5c) n'est pas cassé.

## Écarts à déclarer

1. **Méthode.** La procédure §3 prescrit `apply_migration`, qui estampille
   l'heure courante. J'ai utilisé `execute_sql` avec un bloc `DO` gardé : le
   contenu du fichier entre délimiteurs, contrôle `md5` contre l'empreinte du
   fichier du candidat avant `execute`, puis insertion de l'estampille
   canonique `(version, name)` ; la colonne `statements` reste NULL. Effet :
   le registre porte les versions du dépôt, pas des horodatages du jour.
2. **Libellé de la procédure §2.** « dernière estampille 20260916210000 » doit
   se lire « prédécesseur » : la dernière estampille de Production était
   `20261003120000` (`station_config_horaires_nullable`, sans lien FDJ).
3. **Lecture de synthèse.** Une relance de la requête de contrôle n'était pas
   enveloppée dans `begin read only` (que des SELECT). Déclaré, sans effet.

## Décision demandée

Le geste suivant est le **geste 2 : fusionner la PR #73 au SHA f3e128e**.
Il exige un GO séparé. Puis, chacun avec son propre GO :

- geste 3 : déploiement Pages (contrôle sha256 du servi, puis exécution) ;
- geste 4 : `20261004120000` en dernier, après que l'écran servi n'appelle plus
  `fdj_corriger_caisse_employe`.

Si le SHA du candidat bouge, l'autorisation tombe.
