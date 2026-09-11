# Plan — enregistrer le rôle exercé dans la trace FDJ (A11-4)

Lot séparé, **avec migration**. Arbitrage de principe déjà pris : la trace doit
enregistrer le rôle **exercé au moment de l'acte**, pas le rôle habituel. Ce
qui manque n'est pas la décision, c'est le rattachement.

## Pourquoi ce n'est pas une ligne à changer

`NEXUS-FDJ-v1.html:2141` persiste, dans la signature de clôture de caisse :

    role: employeeCourant.role || 'employe'

Remplacer par « le rôle du service actif maintenant » serait faux plus souvent
qu'aujourd'hui. Les quatre questions, et leurs réponses :

| Question | Réponse |
|---|---|
| Existe-t-il un `shift_id` ou équivalent ? | Oui, mais **pas le bon** : la signature porte `quart_id = fdj_shifts.id`, qui identifie le **quart FDJ**, pas le **service employé** (`shifts`). Aucune clé étrangère ne relie les deux. |
| La clôture peut-elle être saisie après la fin du service ? | **Oui.** `releve_cloture_statut`, `needs_replay` et `last_replayed_at` existent précisément pour les clôtures reprises après coup. |
| Peut-elle être corrigée ultérieurement ? | **Oui.** Table `fdj_corrections`, fonction `fdj_corriger_caisse_employe()` (manager), et `a_revoir` — documenté comme « indicateur ORTHOGONAL : un quart déjà valide peut être marqué a_revoir ». |
| Quel identifiant retrouve sans ambiguïté le service concerné ? | **Aucun.** Il faudrait inférer par `(fdj_shifts.employee_id, date, quart)` → `shifts`. Or `fdj_shifts.employee_id` est **nullable**, un employé peut avoir plusieurs services dans la journée, et le signataire — `employeeCourant` — n'est pas nécessairement le titulaire du quart : un manager peut clôturer ou corriger celui d'un autre. |

**Conclusion : le rattachement n'est pas fiable. FDJ reste inchangé.** Une
correction apparemment évidente dégraderait ici la piste d'audit au lieu de
l'améliorer — c'est le seul endroit du chantier A11 où c'était le cas.

## Modèle cible

La trace doit porter, pour chaque acte :

    employee_id            qui a agi
    shift_id / service_id  à quel service l'acte se rattache
    role_exerce_snapshot   le rôle tenu à ce moment, FIGÉ
    date_heure_acte        quand

**Le snapshot est conservé même quand `shift_id` existe.** Une preuve d'audit
doit rester lisible si la donnée de référence change plus tard : un service
corrigé, un rôle rectifié, un employé qui quitte l'entreprise. La trace dit ce
qui était vrai au moment de l'acte, pas ce qui est vrai aujourd'hui.

## Déroulé proposé

1. **Décider du rattachement.** Deux voies : ajouter `fdj_shifts.service_id`
   référençant `shifts`, renseigné à l'ouverture du quart FDJ ; ou ajouter
   directement `fdj_shifts.role_tenu`, snapshot pris à l'ouverture. La seconde
   est plus simple et suffit à la trace ; la première ouvre davantage.
2. **Traiter le cas du signataire tiers.** Quand un manager clôture le quart
   d'un autre, la signature doit distinguer *le rôle du titulaire du quart* et
   *la qualité de celui qui signe*. Deux champs, pas un.
3. **Rendre le champ obligatoire** une fois renseigné partout, pour qu'aucune
   trace future ne naisse sans rôle exercé.
4. **Ne pas réécrire les traces existantes.** Elles portent le rôle habituel :
   c'est ce qui a été enregistré, et une piste d'audit ne se corrige pas a
   posteriori. Documenter la césure par une date.

## Ce qu'il ne faut pas faire

- Remplacer `employeeCourant.role` par le rôle du service actif au moment de
  l'ouverture de l'écran. Sur une clôture tardive ou faite par un tiers, la
  signature attribuerait un rôle qui n'est pas celui de l'acte — plus faux
  qu'aujourd'hui, et plus difficile à détecter.
- Inférer le service par `(employee_id, date, quart)` sans traiter les trois
  cas dégradés recensés plus haut.
