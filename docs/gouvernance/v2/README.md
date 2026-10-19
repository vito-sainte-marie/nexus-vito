# NEXUS Handoff V2 : dossier de gouvernance (R0)

**Statut : CIBLE, NON APPLIQUÉE.** Ce dossier est documentaire. Il ne modifie aucune règle en vigueur.

Les textes en vigueur restent : `CLAUDE.md`, `docs/handoff/PROTOCOL.md`, `docs/handoff/ARBITRAGES-ACQUIS.json` et `docs/handoff/ARBITRE-CHATGPT.md`.

## Contenu

| Fichier | Rôle |
|---|---|
| `CHARTE-ROLES-V2.md` | Rôles cibles des acteurs ; contre-arbitrage du 18/10/2026 cité mot pour mot |
| `PROPOSITIONS-CONCEPTION-20261019.md` | Propositions de conception de ChatGPT du 19/10/2026, à confirmer par Frédéric : répartition, trois conditions, objectif incontournable, tableau de performance |
| `sources/proposition-chatgpt-20261019.txt` | Texte source de ces propositions, mot pour mot, avec son empreinte (intégrité seulement) |
| `PLAN-RACCORDEMENT-GUARDIAN.md` | Plan révisé R0 à R7 et banc de recette, essais A à I |
| `MATRICE-VARIANTES-BOUCLE-V2.md` | Toutes les variantes de la boucle : invariants, états, décisions, actions, indisponibilités, incidents |

Produits de Guardian, déposés dans le même lot sous `docs/guardian/` :

| Fichier | Rôle |
|---|---|
| `docs/guardian/README.md` | Organisation de l'espace Guardian ; définition d'un constat (jamais une décision) ; voie d'écriture unique |
| `docs/guardian/constats/CONSTATS-20261019.md` | Constats du 19/10/2026 |
| `docs/guardian/preuves/MESURES-REFERENCE-20261008-20261018.md` | Mesure de référence de la boucle actuelle (reproduite par le même script, non vérifiée indépendamment), avec ses définitions |
| `docs/guardian/preuves/mesures-20261008-20261018/` | Script de mesure rejouable, en lecture seule, et ses résultats bruts |

## Objectif incontournable

Aucune écriture Test sans décision canonique préalable ; aucune opération Production sans autorisation humaine vérifiable.

## Ce que ce dépôt ne fait pas

- Il ne modifie aucun workflow, aucune garde, aucun outil, aucun registre de `docs/handoff/` hors du lot qui le porte.
- Il ne réduit aucun motif de réveil de Frédéric.
- Il ne crée, ne lit ni ne change aucun secret, aucune identité, aucune permission.
- Il n'arme ni la vigie, ni une session Guardian planifiée, ni la nouvelle boucle. La boucle actuelle continue telle quelle.
- Il ne touche ni à `main`, ni à `production`, ni à Supabase.

Il remplace le projet de lot GOV-00, qui ne portait que la charte.

## Dépendances et points ouverts

- **Lot actif.** Au 19/10/2026, le lot actif est `SECURITE-DEFINER-ETAPE5-20261018`. Une dérogation n'est pas possible : `handoff.js` (l. 920) refuse toute nouvelle demande tant qu'un lot actif porte une décision. Condition minimale, vérifiée sur une copie jetable du rail : la `decision-3` (confirmée par Frédéric, provenance de niveau 2, voir `docs/deploiement/provenance-decision-3-etape5-20261019.md`) est prise en charge puis consommée avec une preuve d'action ; ETAPE5 passe en `DECISION_CONSOMMEE`, **sans clôture**. La demande R0 doit désigner `--rail handoff-continuite-20260920`.
- **Incident SQL de l'étape 5.** L'exécution SQL de l'étape 5 aurait eu lieu hors session, à une heure et sous un GO non vérifiés. Il reste ouvert ; ce dossier ne le clôt pas et ne le tient pas pour autorisé.
- **Provenance.** Les textes de conception sont des propositions (niveau a), pas des décisions (niveau c).

## Suite

Chaque étape du plan (R1 à R7) fait l'objet de son propre lot, avec ses preuves et l'autorisation qui lui revient. Le passage de « cible » à « appliquée » est une décision de Frédéric, prise sur le banc de recette vert.
