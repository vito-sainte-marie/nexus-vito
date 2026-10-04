---
protocol: nexus-handoff/2
kind: request
lot_id: FDJ-VAGUE1-REPRISE-20261003
seq: 3
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7 production=2f27e5c
  - id: migrations-test
    classe: VERIFIED
    valeur: 292->304 max 20261003190000 fdj=42
  - id: candidat
    classe: VERIFIED
    valeur: 9ffee7e rebuild/fdj-62-20260922
  - id: recette-serveur
    classe: VERIFIED
    valeur: psql begin..rollback Test 2026-10-04T03:55Z, rollback verifie
  - id: ancienne-porte
    classe: VERIFIED
    valeur: fdj_corriger_caisse_employe EXECUTE authenticated=t anon=t, appel apres validation reussi
---
# Demande — résultats de l'option A (`decision-2.md`) ; un défaut bloquant sur le candidat

## 1. Migrations appliquées à nexus-test — FAIT

- Les 12 fichiers `supabase/migrations/2026091622*.sql` du candidat `9ffee7e` sont passés en une transaction, avec `ON_ERROR_STOP`, chacun estampillé dans `supabase_migrations.schema_migrations`.
- Compte : **292 → 304**. Max inchangé (`20261003190000`, la Vague 1 est datée du 16/09). 42 fonctions `fdj_*` présentes. Sortie 0.
- Deux NOTICE seulement, toutes deux attendues : un trigger absent ignoré, et l'index `idempotency_key` déjà présent.
- Aucune autre écriture Test. Rien sur Production. `nexus_ci_recette` n'a pas été touché.

## 2. Divergence Test / rail — à consigner

- Test porte désormais **12 migrations que le rail ne porte pas** : `20260916220000` à `20260916221100`, celles du candidat `rebuild/fdj-62-20260922`.
- Elles s'ajoutent aux 11 hors-bande déjà connues sur Test.
- Conséquence : jusqu'à la fusion du candidat (ou jusqu'à un retrait explicite), un écran du rail servi sur Test voit 42 fonctions FDJ qu'il n'appelle pas. Les migrations sont additives, donc le front du rail n'est pas cassé (dossier §15, scénario A).

## 3. Recette côté serveur, sur Test, annulée à la fin

Comment c'est fait :
- Un seul script psql, dans `begin … rollback`.
- Les identités sont jouées par `request.jwt.claims` puis `set local role authenticated`.
- Les acteurs sont Employé Test A, Employé Test B et Manager Test, sur `nexus-station-test`.
- Les jeux, les prises de poste et toutes les lignes FDJ créés ont disparu après le rollback, vérifié : 0 jeu `RECETTE%`, 0 `fdj_shifts` sur le site de test.

| Cas | Attendu | Mesuré |
|---|---|---|
| 1 — un quart par prise de poste | ouverture, puis idempotence | `ouverture_naturelle`, puis `idempotence_prise_de_poste`, 1 ligne. Manager : `prise_de_poste_managerial`. Un tiers est refusé. |
| 2 — étapes employé | 4 étapes, permissions du moteur cohérentes | `saisie_a_commencer` → `brouillon` → `en_attente_controle_manager` (écart provisoire −5,00) → `validee`. `permissionsEcartCaisseEmploye` : `corrigerDirectement` vrai jusqu'à la confirmation, faux une fois validée ; `signalerApresValidation` vrai seulement une fois validée. |
| 3 — seul le manager valide | refus pour l'employé | Valider, ouvrir le contrôle, saisie manager : les trois sont refusés (« Seul un manager habilité… »). Pour le manager : `valide_avec_ecart`, et `valide_par` = `controle_par` = manager ≠ employé. |
| 4 — aucun champ manager vers l'employé (RPC) | 0 fuite | `fdj_ma_caisse` aux 4 étapes, `mes_quarts_fdj`, `ma_progression_caisse`, `mes_corrections_caisse`, `mes_comptages_caisse` : aucune des clés `motif_interne`, `motif_ecart(_texte)`, `valide_par`, `controle_par`, `controle_le`, `resultat_controle`, ni la valeur témoin du motif interne. |
| Après validation | correction refusée, signalement possible | `fdj_corriger_caisse_confirmee` est refusée (`caisse_validee`) et le signalement est accepté. **Mais voir §4.** |
| Demande, réouverture, correction | chaîne manager complète | `acceptee_reouverture` → `rouvrir` → `corriger_manager` (version 2, écart d'origine préservé) → `conforme`. |
| Transfert | A perd l'accès, B l'obtient | Transfert vers B. A est refusé. B lit (`validee`, 0 fuite). |
| Carnets et mouvements | auteur ≠ titulaire tracé | B active : idempotent au rejeu. A est refusé sur le quart de B. A est refusé sur un mouvement de gestion. Réception et réappro par le manager. Activation reconstituée par le manager : `created_by` = manager, `employee_id` = B. |

L'écran employé `NEXUS-FDJ-v1.html` ne lit `fdj_cash_controls` nulle part (statique, à `9ffee7e`) : il ne passe que par ces RPC.

Le contrôle du réseau de l'écran, connecté, **n'est pas fait**. Il exige que Frédéric se connecte lui-même dans le navigateur, sur l'alias du candidat. Je ne saisis aucun mot de passe.

## 4. Défaut bloquant — l'ancienne porte de correction reste ouverte

**Constat.** `fdj_corriger_caisse_employe(uuid,numeric,text,text)` date de `20260901225945` et reste exécutable par `authenticated`, et même par `anon` sur Test. Le dossier de la vague la désigne pourtant comme « LE défaut que corrige cette vague » (commentaire de `220600`). La vague crée bien la remplaçante `fdj_corriger_caisse_confirmee`, qui refuse. Mais aucune migration, y compris la Phase C, ne révoque ni ne supprime l'ancienne.

**Mesuré sur Test, en tant qu'Employé Test A, après validation par le manager :**
- l'appel réussit : caisse 126 → 127, écart −4 → −3 ;
- `fdj_cash_controls.statut` passe de `valide_avec_ecart` à `provisoire`, alors que `valide_par` et `valide_le` restent remplis ;
- `motif_ecart_texte`, le motif interne du manager, est **écrasé** par le commentaire de l'employé ;
- `fdj_ma_caisse` continue d'afficher `validee`. L'employé ne voit pas qu'il a dévalidé la caisse.

**Portée.**
- Le §5.1 du dossier (« modifier une caisse validée est interdit à l'employé ») n'est pas tenu au niveau de l'API.
- Aucun écran du candidat n'appelle l'ancienne fonction. Seul `DOSSIER-FDJ-VAGUE1-20260917.md` la cite. La fermer ne casse donc rien de servi.
- Production : non mesurée (hors périmètre de `decision-2`). La fonction y existe depuis la migration du 01/09.

**Ce n'est pas une dette connue.** C'est le défaut que la vague prétend fermer, et la recette montre qu'il reste ouvert.

## 5. Second constat — Phase C ne masque pas le motif interne au titulaire

- Aujourd'hui, la RLS `select_fdj_cash_controls` est filtrée par site seulement. Un employé lit donc en direct `motif_ecart_texte`, `valide_par` et `resultat_controle`. Mesuré : la valeur témoin est rendue à Employé Test A. C'est l'état « avant » que décrit le dossier §7 : documenté, non nouveau.
- **Nouveau** : la Phase C écrite (non appliquée) donne SELECT au « manager **ou** titulaire du quart » sur la ligne entière. Après la Phase C, le titulaire lira encore le motif interne par l'API REST. Cela contredit l'intention du dossier (ligne 399 : « ne rend jamais `motif_ecart_texte` »), qui n'est tenue que par les RPC.
- Ce constat ne bloque pas le candidat, puisque la Phase C n'est pas dans ce geste. Il doit être tranché avant d'appliquer la Phase C.

## 6. Options

- **A (recommandée).** Sur le candidat, une 13e migration additive :
  - `revoke execute on function public.fdj_corriger_caisse_employe(uuid,numeric,text,text) from public, anon, authenticated` ;
  - une épreuve statique qui rougit si une fonction remplacée par la vague reste exécutable par `authenticated` ;
  - la mutation « ré-accorder », pour prouver que l'épreuve mord ;
  - ensuite, application de cette seule migration sur Test, puis le cas « ancienne porte » rejoué : refus attendu.
  
  A exige un GO, car c'est une écriture Test hors de `decision-2` et un nouveau commit candidat. Les constantes d'empreinte bougent : c'est le rouge attendu du manifeste.
- **B.** Ne rien changer au candidat et consigner le défaut comme condition de fusion. Je le déconseille : fusionner laisserait en Production une vague annoncée comme correctrice, avec la porte ouverte.
- **C.** Retirer les 12 migrations de Test (scénario A du dossier, `drop`) et suspendre le lot.

Dans tous les cas, le §5 (Phase C) reste à arbitrer à part, avant toute application de la Phase C.

Geste humain indépendant, qui n'attend pas l'arbitrage : la connexion de Frédéric dans le navigateur, sur l'alias du candidat. D'abord en tant qu'Employé Test A, puis en tant que Manager Test. Elle permet le contrôle réseau de l'écran.
