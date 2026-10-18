---
protocol: nexus-handoff/2
kind: request
lot_id: SECURITE-DEFINER-ETAPE5-20261018
seq: 3
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=ff19b8a0 production=a9ccf920
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 158-fichiers
  - id: exec-chatgpt
    classe: VERIFIED
    valeur: GO-cite-hors-session-heure-inconnue
  - id: recette-prod
    classe: VERIFIED
    valeur: registre320-17-search_path-8-revoke-18x42501-login-ok-fonctionnel-annule-ok
---
# SÉCURITÉ SECURITY DEFINER — Étape 5 : preuves d'exécution en Production (SECURITE-DEFINER-ETAPE5-20261018)

Suite de `decision-1.md` (humaine, Frédéric Bragance, APPROVED_WITH_CONDITIONS, closes:false). Cette demande **consigne** l'exécution et la recette ; elle n'ouvre aucune nouvelle opération. Aucun déploiement, aucune gate Pages approuvée.

## Provenance de l'exécution (à lire d'abord)
La transaction SQL Production a été exécutée par **ChatGPT, à la demande de Frédéric**, hors de la session de Claude. Claude ne l'a pas exécutée et n'a pas reçu de GO d'exécution. Le GO cité par ChatGPT : « Caisses sécurisées, GO SQL Production étape 5. » Heure exacte de la transaction : **inconnue** (à chercher dans les journaux Supabase si nécessaire). Compte rendu de ChatGPT : transaction unique, `lock_timeout` 5 s, `statement_timeout` 45 s, verrou advisory `hashtext('securite_definer_etape5')`, gardes DO, corps de la migration `20261018200000` (blob `a33ad478…`), INSERT au registre, COMMIT.

## Preuve des conditions de decision-1
1. GO d'exécution distinct daté : cité par ChatGPT (voir ci-dessus), non reçu ni vérifié par Claude ; date/heure non établies.
2. « Deploy to production » éteint : constaté par la capture d'écran de Frédéric (Supabase Integrations, Production).
3. Relevé préalable : fourni par ChatGPT avant exécution (gardes DO dans la transaction) ; écart de décompte 25 vs 19 signalé ci-dessous.
4. Fenêtre hors clôture de caisse : non vérifiée par Claude (heure inconnue).
5. Aucune gate Pages ni déploiement : aucune approbation donnée ; run Pages en `waiting`.
6. Compte rendu des épreuves : ci-dessous ; connexion réelle à constater par Frédéric.

## Recette post-exécution (Claude, GO de Frédéric « GO pour la recette post-exécution »)
Lectures seules et blocs annulés (`raise exception`), aucune écriture durable.
1. Registre : 320 lignes, `20261018200000` présente une fois.
2. Les 17 fonctions de la migration sont à `search_path=public, pg_temp` (liste identique à la migration) ; 0 SECURITY DEFINER sans `search_path`.
3. Les 8 fonctions de trigger : ACL `{postgres=X/postgres,service_role=X/postgres}` ; 0 fonction de trigger SECURITY DEFINER ouverte à `anon`.
4. 9 triggers liés, tous `tgenabled=O`.
5. Appel direct sous `anon` et `authenticated` des 8 fonctions + `nexus_garde_regularisation_reception` : 18 combinaisons, 18 × `42501`.
6. Connexion sous `anon` : `nexus_identifiant_de_connexion(prénom)` d'un compte actif unique renvoie le `username` attendu (booléen seulement ; aucun PIN ni identifiant consigné). ACL inchangée `{postgres,anon,authenticated,service_role}`.
7. Fonctionnel sous `authenticated` (pompiste d'un site réel, bloc annulé) : insertion `shifts` OK (trigger `nexus_forcer_site_unique`) ; insertion `inventaire_mouvements` OK (trigger `flag_mouvement_non_justifie`). Rien conservé.
8. Exceptions préservées : `nexus_garde_regularisation_reception()` fermée à `anon` (ACL `{postgres,service_role}`) ; `run_scheduled_inventory_reviews()` ACL `{postgres}`.
9. Job `nexus-inventaire-reviews` : 12 passages `succeeded` sur 3 h, dernier 21:00:00 UTC ; **postériorité à la transaction non établie** (heure inconnue).

## Écarts et points à connaître
- La condition 3 parlait de 25 fonctions ; le périmètre réel relevé est de 17 modifiées + 2 exclues = 19. Écart de décompte, pas de dérive constatée.
- Sur Test, l'appel direct de `nexus_garde_regularisation_reception` sous `authenticated` donnait `0A000` ; sur Production l'ACL ne comprend pas `authenticated`, donc `42501`. Comportement plus fermé, ACL non modifiée par l'étape 5.
- 21 autres fonctions SECURITY DEFINER restent à `search_path=public` (hors périmètre).
- Non constaté par Claude : la **connexion réelle** d'un employé, à constater par Frédéric (condition 6).

## Hors de cette demande
Gate Pages / déploiement (GO séparé), réconciliation main/production, suppression de l'oracle de connexion, 21 autres fonctions.

## Question
Constatez-vous que les conditions de decision-1 sont remplies, sous réserve de la connexion réelle par Frédéric ? Réponse attendue : APPROVED / APPROVED_WITH_CONDITIONS / REJECTED, avec `closes`.
