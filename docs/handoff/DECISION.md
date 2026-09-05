# NEXUS Handoff — DECISION

LOT_ID: S-4-LECTEURS-SERVICE-COURANT-20260905
DECISION: APPROVED_WITH_CONDITIONS
AUTHOR: ChatGPT
BRANCH: config-par-environnement

## Décision

S-4 est approuvé. Le diagnostic confirme que S-2/S-3 rendent désormais dangereuses les anciennes heuristiques de lecture : un service terminé ne doit plus pouvoir être interprété comme service courant.

Le contrat unique est validé :

```text
service courant = employee_id = employé courant
                  AND site_id = site courant
                  AND statut = 'en_cours'
                  ORDER BY heure_debut DESC
                  LIMIT 1
```

Aucun lecteur ne doit retomber sur un ancien service terminé, sur le rôle du dernier service historique, sur une fenêtre de 24 h, ni sur une borne de journée pour décider quel service est courant.

## Arbitrages

### Q1 — Fenêtre de 24 h de Missions

Décision : **option (a), supprimer la fenêtre de 24 h comme définition du service courant**.

La décision historique « valable 24 h, pas jusqu'à minuit » compensait l'absence de cycle de vie réel des `shifts`. Depuis S-2 et S-3, la base possède maintenant une vérité explicite : `en_cours` ou clos. Conserver 24 h en parallèle créerait deux vérités concurrentes.

Une mission ne doit donc être rattachable au service courant que si ce service est réellement `en_cours`.

### Q2 — `nexus-auth.js` comme porte d'accès

Décision : **oui, aligner `nexus-auth` sur le service réellement actif**.

Après un pointage de départ ayant clôturé le shift, l'employé n'a plus de service courant. S'il revient dans l'application sur un parcours qui exige une prise de poste, il doit être renvoyé vers la prise de poste.

Cette redirection est une conséquence volontaire du nouveau contrat, pas un effet secondaire à masquer.

Important : ne pas en déduire qu'un employé doit perdre l'accès à toute fonction indépendante d'un service si l'architecture en prévoit. S-4 doit uniquement corriger les gates qui utilisent aujourd'hui l'existence d'un shift comme condition d'accès.

### Q3 — Bornes journalières / UTC / heure appareil et `Missions:397`

Décision : **distinction obligatoire**.

1. Les problèmes généraux de « journée » en UTC, heure appareil ou heure station qui servent à d'autres calculs restent consignés en A17 et ne sont pas élargis ici.
2. En revanche, **aucune de ces bornes ne doit continuer à participer à la détermination du service courant après S-4**.
3. `NEXUS-Missions-v1.html:397` est dans le périmètre S-4 dès lors qu'il cherche un shift utilisé comme service de référence. Il doit cesser de pouvoir remonter vers un service historique clos. Si ce lecteur cherche en réalité un historique comparable et non le service courant, le code doit le nommer explicitement comme tel et ne pas être utilisé pour autoriser ou rattacher une action au service actif.

Donc : on ne traite pas A17 en général, mais on retire A17 du chemin de décision « quel est le service courant ? ».

## Conditions / exigences

- Créer une primitive commune de lecture du service courant plutôt que neuf variantes locales, sauf impossibilité technique démontrée.
- La primitive doit exiger `employee_id`, `site_id` et `statut = 'en_cours'`.
- Aucun fallback vers le dernier shift historique, le rôle habituel de l'employé, une date du jour ou une fenêtre de 24 h pour déterminer le service courant.
- Aucun shift actif : retourner un état explicite `aucun service actif` et laisser chaque écran appliquer son comportement métier prévu.
- Conserver `ORDER BY heure_debut DESC` comme défense de lecture.
- Si plusieurs `en_cours` sont observables malgré S-1, signaler une anomalie technique ; ne pas la masquer silencieusement. La base doit normalement rendre ce cas impossible.
- Ne pas modifier les règles métier de Missions au-delà de ce qui est nécessaire pour faire dépendre ses actions du vrai service actif.
- Ne pas traiter les autres dettes A17 dans ce lot.

## Interdictions

- Ne jamais modifier `main` ou `production` sans autorisation humaine explicite.
- Ne jamais interpréter cette décision comme une autorisation de production.
- Ne pas réintroduire une fenêtre temporelle de secours pour remplacer `statut`.
- Ne pas utiliser l'heure locale de l'appareil ou UTC comme substitut à l'état du shift.
- Ne pas corriger d'autres sujets A17 latéraux sous couvert de S-4.

## Preuves attendues pour fermer le lot

1. Inventaire avant/après des neuf lectures diagnostiquées et justification de leur nouvel usage.
2. Après clôture S-2 d'un service, Pointage, Missions, `nexus-auth`, Accueil, Cockpit, Brief et Inventaire ne doivent plus considérer le shift clos comme courant.
3. Avec un shift `en_cours`, les mêmes lecteurs doivent converger sur le même `shift.id`, rôle et site lorsqu'ils consomment le service courant.
4. Missions ne doit plus autoriser/rattacher une action au shift clos via sa fenêtre 24 h ou son historique role+quart.
5. `nexus-auth` doit rediriger correctement après départ lorsque le parcours exige un service actif.
6. Aucun fallback date/24 h/dernier historique dans le chemin de détermination du service courant.
7. Suite automatisée inchangée hors corrections attendues : seuls les 9 échecs historiques connus peuvent rester.
8. Zéro appel/écriture production ; `main` et `production` inchangés.
9. Rejeu navigateur sous session employé après S-4 : prise de poste réelle, départ réel, fermeture S-2, absence de service courant après départ, puis nouvelle prise de poste S-3.
10. Lors de ce rejeu, exercer autant que possible les branches de contrôle sous RLS réel et confirmer qu'aucun refus silencieux ne laisse pointage et shift incohérents.

## Prochaine gate

Claude peut implémenter S-4 sur `config-par-environnement`, déployer sur `nexus-test`, produire les preuves ci-dessus, puis réécrire `docs/handoff/CURRENT.md` avec le **même LOT_ID** et `STATUS: AWAITING_DECISION` pour fermeture du lot.

Ne pas commencer S-5 avant décision de fermeture S-4.

## Règle de consommation

Claude ne doit consommer cette décision que si le `LOT_ID` correspond exactement à celui de `docs/handoff/CURRENT.md`.
