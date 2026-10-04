---
protocol: nexus-handoff/2
kind: request
lot_id: FDJ-VAGUE1-REPRISE-20261003
seq: 5
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7 production=2f27e5c
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7 production=2f27e5c
  - id: candidat
    classe: VERIFIED
    valeur: 4c63621 rebuild/fdj-62-20260922
  - id: acl-production
    classe: VERIFIED
    valeur: begin read only 2026-10-04T10:33Z nexus_prod_readonly_login; anon=t authenticated=t service_role=t
  - id: corps-production
    classe: VERIFIED
    valeur: md5 prosrc f683a539; auth.uid() exige; cash_controls.statut non lu
  - id: ecran-servi
    classe: VERIFIED
    valeur: production 2f27e5c NEXUS-FDJ-v1.html:878 appelle fdj_corriger_caisse_employe
---
# Demande — résultat de l'option A (`decision-4.md`) : l'ancienne porte est ouverte en Production, et l'écran employé servi l'utilise

## 1. Mesure — Production, `begin read only … rollback`, 04/10/2026 10:33 UTC

- **Identité.** Constatée, non choisie : `current_user = nexus_prod_readonly_login`, `transaction_read_only = on`.
- **Écriture.** Aucune.

| Objet | Mesure |
|---|---|
| `public.fdj_corriger_caisse_employe(uuid,numeric,text,text)` | existe, `SECURITY DEFINER` |
| `proacl` | `{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}` |
| `has_function_privilege(…, 'EXECUTE')` | `anon` = **t**, `authenticated` = **t**, `service_role` = t |
| `fdj_corriger_caisse_confirmee` (la remplaçante) | **absente** |
| `md5(prosrc)` | `f683a5394e4b36cee0d2e4be4014cc03` |

`PUBLIC` ne figure pas dans l'ACL, alors qu'`anon` et `authenticated` y figurent nommément. C'est le cas décrit par la mémoire « `revoke from public` ne ferme pas `anon` ».

Le nombre de migrations n'a pas pu être lu : `supabase_migrations` est refusé au rôle readonly. Il n'est pas nécessaire à la conclusion.

## 2. Qualification du risque, lue dans le corps de la fonction (même lecture)

- **`anon` : ouvert, mais non exploitable.** La fonction commence par `if auth.uid() is null then raise exception`. Le grant est une hygiène à refermer, pas une brèche active.
- **`authenticated` : le défaut de `request-3` est présent en Production.**
  - La fonction exige que l'appelant soit la caissière du quart (`v_shift.employee_id = auth.uid()`) et que ce quart soit `valide`.
  - Elle **ne lit pas** `fdj_cash_controls.statut`.
  - Une employée peut donc, sur son propre quart clôturé, réécrire à tout moment `caisse_reelle` et `ecart`, écraser `motif_ecart_texte`, et remettre le contrôle en `provisoire`, même après sa validation par le manager.
  - Chaque appel est tracé dans `fdj_corrections` et dans `fdj_audit_log`.
- **Ce n'est pas un appel détourné, c'est le parcours nominal.** L'écran employé servi (`origin/production` = `2f27e5c`, `NEXUS-FDJ-v1.html:878`, bouton « Corriger et inscrire sur mon relevé ») appelle cette RPC.
- **Usage réel : non mesuré.** Je n'ai pas lu `fdj_corrections`, hors périmètre de `decision-4`. Sous RLS, un refus de lecture rendrait `0` en silence (mémoire « un grant rend le refus silencieux »).

## 3. Conséquence pour la fermeture côté Production

Révoquer `authenticated` seul, sans le nouveau code, **casse le bouton de correction de l'écran employé servi** : l'appel échouerait, avec l'alerte « La correction n'a pas pu être enregistrée ». La remplaçante n'existe pas en Production, et l'écran servi ne la connaît pas. Le candidat `4c63621`, lui, n'appelle plus l'ancienne RPC : il appelle `fdj_corriger_caisse_confirmee` (`NEXUS-FDJ-v1.html:1029`).

**Ordre imposé si le candidat est déployé.**
1. Les 12 autres migrations, dont la création de la remplaçante.
2. Le déploiement de l'écran.
3. Seulement ensuite, `20261004120000`.

Dans l'ordre inverse, l'écran encore servi casse pendant la fenêtre. Ce cas est de la même famille que « deux migrations exigent le code d'abord ».

## 4. Ce qui reste ouvert, inchangé

- Phase C (`request-3` §5).
- Contrôle réseau connecté de l'écran : il attend une connexion de Frédéric.
- GO de fusion et de déploiement de la PR #72.

## 5. Options — chacune exige ses propres GO, un GO par geste

- **A — fermer par le candidat.** Préparer le dossier de fusion et de déploiement du candidat `rebuild/fdj-62-20260922` (`4c63621`), avec l'ordre du §3 explicite et la qualification des migrations exigée par la garde #70. Ensuite :
  - GO de migration Production (hors `120000`) ;
  - GO de fusion ;
  - GO de déploiement ;
  - GO pour `120000`.

  Cette option suppose d'abord de trancher la Phase C ou de l'écarter explicitement.
- **B — refermer `anon` seul, tout de suite, en migration isolée.** `revoke execute … from anon`. Effet fonctionnel nul, puisque la fonction refuse déjà sans `auth.uid()`. C'est une hygiène, et le défaut employé reste entier. Exige :
  - un fichier de migration sur une branche ;
  - un GO d'écriture Production ;
  - l'inscription de l'estampille.
- **C — refermer `authenticated` aussi, tout de suite, en acceptant la perte du bouton employé.** Les corrections passent alors par le manager. C'est une décision métier, pas technique : elle retire une fonction utilisée à l'écran jusqu'au déploiement du candidat. Mêmes gestes que B.
- **D — ne rien toucher en Production avant le candidat.** Le défaut reste ouvert, il est tracé dans le journal d'audit, et je clos cette sous-question en l'état.

Je n'arbitre pas.
