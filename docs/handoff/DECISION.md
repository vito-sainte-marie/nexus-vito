# NEXUS Handoff — DECISION

LOT_ID: S-5-SHIFT-ID-INVENTAIRE-20260905
DECISION: APPROVED_WITH_CONDITIONS
AUTHOR: ChatGPT
BRANCH: config-par-environnement

## Décision

S-5 est **approuvé avec conditions**.

Le diagnostic confirme que `inventaire_quart_employes.shift_id` est aujourd'hui une trace structurelle non alimentée : un seul chemin applicatif crée ces lignes, le service courant est déjà résolu depuis S-4, et son identifiant peut être conservé sans nouvelle requête Supabase.

Le principe S-5 est donc validé : toute nouvelle ligne réelle `inventaire_quart_employes` créée dans le parcours NEXUS doit être rattachée au **service courant réellement actif** de l'employé au moment de la création.

## Arbitrages

### Q6 — contrainte d'appartenance en base

Décision : **oui, obligatoire**, avec une précision : la base doit protéger l'invariant, pas seulement le code client.

Le garde doit vérifier, pour toute nouvelle ligne réelle portant un `shift_id`, que le shift référencé :

1. existe ;
2. appartient au même `employee_id` ;
3. appartient au même site que le contexte d'inventaire lorsque ce site est déterminable de manière certaine depuis les relations existantes.

Le minimum non négociable est donc `shift_id -> shifts.id` **et** concordance `shifts.employee_id = inventaire_quart_employes.employee_id`.

Ne pas limiter la protection au seul `BEFORE INSERT` si une mise à jour ultérieure de `shift_id` ou `employee_id` pourrait créer une incohérence. Le contrat doit rester vrai après `UPDATE` également. Une solution trigger `BEFORE INSERT OR UPDATE` est acceptable si elle reste simple, déterministe et sans élévation de privilèges inutile.

Les 6 lignes historiques à `shift_id IS NULL` doivent rester valides. En revanche, pour les **nouvelles créations réelles** après S-5, l'absence de `shift_id` ne doit pas être silencieusement acceptée par le chemin applicatif. Le mode test synthétique reste hors base et n'est pas concerné.

### Q7 — reprise des 6 lignes existantes

Décision : **aucune reprise rétroactive**.

Même lorsqu'un rattachement semble plausible, il ne doit pas être inventé. Les 6 lignes existantes restent `NULL` et constituent de l'historique pré-S-5. Ne pas reconstruire un lien à partir d'horaires, rôles, quarts ou proximité temporelle.

Cette absence de reprise doit être documentée explicitement comme frontière de traçabilité :

- avant S-5 : `shift_id` peut être `NULL` ;
- après S-5 : les nouvelles lignes réelles issues du parcours NEXUS doivent porter le vrai `shift_id`.

### Q8 — faut-il créer un lecteur de `shift_id` ?

Décision : **non**.

S-5 est un lot de traçabilité, pas un prétexte pour créer une nouvelle fonctionnalité d'affichage. Le fait qu'aucun écran ne consomme encore cette colonne ne rend pas la trace inutile : elle prépare l'audit, la preuve de rattachement et les futurs rapprochements sans modifier artificiellement le produit.

Aucun lecteur ne doit être ajouté uniquement pour « justifier » la colonne.

## Conditions / exigences d'implémentation

- Réutiliser le `service` déjà retourné par `nexusServiceCourant()` ; ne pas ajouter une seconde requête pour retrouver le shift.
- Conserver l'objet/service courant résolu suffisamment longtemps pour transmettre son `id` à `obtenirOuCreerQuartEmploye()`.
- À la création réelle de `inventaire_quart_employes`, écrire `shift_id = serviceCourant.id`.
- Si aucun service courant valide n'est disponible, ne pas créer la ligne réelle ; conserver le comportement fail-closed existant.
- Le mode test inventaire reste synthétique et ne reçoit pas de vrai `shift_id`.
- Le garde base doit empêcher une association `shift_id` / `employee_id` incohérente, y compris lors d'une modification ultérieure susceptible de casser l'invariant.
- Ne pas toucher aux 13 `shift_id` FDJ : ils réfèrent à `fdj_shifts`, concept distinct.
- Ne pas ajouter de lecteur produit de `shift_id` dans S-5.
- Ne pas modifier les 6 lignes historiques existantes.

## Preuves attendues pour fermer S-5

1. Diff ciblé montrant qu'il n'existe toujours qu'un seul chemin de création applicative de `inventaire_quart_employes` et qu'il écrit désormais le `shift_id` déjà résolu.
2. Création réelle en `nexus-test` avec un employé ayant un shift `en_cours` : la nouvelle ligne doit porter exactement le même `shift_id` que le service courant.
3. Preuve négative : tentative d'association avec le `shift_id` d'un autre employé refusée par la base.
4. Preuve de mise à jour : une modification qui créerait une discordance `employee_id` / `shift_id` doit également être refusée, ou démonstration structurelle équivalente si une autre contrainte est choisie.
5. Aucun service courant : aucune nouvelle ligne réelle créée.
6. Les 6 lignes historiques restent inchangées à `shift_id = NULL`.
7. Mode test : aucun accès/écriture DB supplémentaire, objet synthétique conservé.
8. Suite automatisée inchangée hors tests S-5 ; seuls les 9 échecs historiques connus peuvent rester.
9. Zéro appel/écriture production ; `main` et `production` inchangés.

## Interdictions

- Ne jamais modifier `main` ou `production` sans autorisation humaine explicite.
- Ne jamais interpréter cette décision comme une autorisation de production.
- Ne pas effectuer de backfill des 6 lignes historiques.
- Ne pas deviner un shift à partir d'une date, d'un rôle, d'un quart ou d'une proximité horaire.
- Ne pas introduire un second concept de service courant en dehors de `nexusServiceCourant()`.
- Ne pas élargir S-5 aux colonnes FDJ homonymes ni à d'autres modules.

## Prochaine gate

Claude peut implémenter S-5 sur `config-par-environnement`, déployer uniquement sur `nexus-test`, produire les preuves ci-dessus, puis réécrire `docs/handoff/CURRENT.md` avec le même `LOT_ID` et `STATUS: AWAITING_DECISION`.

Après fermeture de S-5, **ne pas encore fermer le bloqueur 1**. Il restera le rejeu navigateur réel sous session employé demandé à la fermeture de S-4 afin de prouver S-2/S-3 sous RLS réel et le parcours complet prise de poste -> départ -> absence de service courant -> nouvelle prise de poste.

## Règle de consommation

Claude ne doit consommer cette décision que si le `LOT_ID` correspond exactement à celui de `docs/handoff/CURRENT.md`.
