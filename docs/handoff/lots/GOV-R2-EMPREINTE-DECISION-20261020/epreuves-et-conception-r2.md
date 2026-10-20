# GOV-R2 : épreuves falsifiantes et conception (conditions 2, 3, 4, 5 de decision-1)

Aucun code n'est écrit. Les épreuves précèdent la conception ; elles sont jouées rouges sur l'outillage actuel avant tout code, verte(s) après.

## A. Source désignée et indépendante (condition 2)

Une empreinte stockée dans la décision, comparée au texte de la même décision, ne prouve rien : qui altère le texte recalcule l'empreinte. La vérification compare donc la décision **à une source qui ne vit pas dans le fichier** :

- **Source désignée** : le commentaire du relais sur l'issue #28, lu par l'API GitHub (auteur `github-actions[bot]`, cite un run de `tests.yml` dont l'étape de relais a réussi, même acquis que l'E5 de R1). Le texte du verdict et le contrat y figurent.
- **Empreinte** : sha256 du corps canonique du verdict. Le fichier `decision-N.md` ne porte qu'un **pointeur** (identifiant du commentaire) ; l'empreinte est **recalculée par le vérificateur** à partir du commentaire récupéré, jamais lue dans le fichier comme preuve.
- **Verdict de la comparaison** : le corps de la décision déposée (hors enveloppe) doit égaler le corps du commentaire, et le contrat (DECISION, CLOSES, LOT, REQUEST) doit égaler celui de l'enveloppe.
- API injoignable : arrêt explicite, rien n'est consommé (comme E5 de R1).

## B. Épreuves (condition 2)

| # | Entrée hostile | Attendu | Outillage actuel |
|---|---|---|---|
| F1 | `decision-N.md` modifiée d'un octet après dépôt, empreinte du fichier **recalculée** pour rester cohérente | `DECISION_ALTEREE` : le corps ne correspond plus au commentaire source | ROUGE (aucune comparaison à une source) |
| F2 | Décision sans commentaire source désigné (pointeur absent) | `SOURCE_NON_DESIGNEE`, pas de consommation | ROUGE |
| F3 | Pointeur vers un commentaire d'un autre auteur que `github-actions[bot]` | `SOURCE_INADMISSIBLE` | ROUGE |
| F4 | Pointeur vers un commentaire valide d'un **autre lot** ou d'une autre request | `SOURCE_HORS_LOT` | ROUGE |
| F5 | Enveloppe modifiée (`closes: false` → `true`) corps intact | `CONTRAT_DIVERGENT` (contrat du commentaire ≠ enveloppe) | ROUGE |
| F6 | API GitHub injoignable | arrêt explicite `SOURCE_INJOIGNABLE`, niveau atteint nommé, aucun avertissement seul | ROUGE |
| F7 | Empreinte et texte altérés **ensemble** dans le fichier et le pointeur laissé intact | refusé comme F1 (preuve que la garde ne valide pas un couple texte–empreinte fourni ensemble) | ROUGE |
| F8 | Cas de contrôle : décision matérialisée par la CI, intacte | acceptée, empreinte concordante | VERT (doit le rester) |

F1 et F7 sont les épreuves de la condition 2 : une garde qui ne lirait que le fichier les ferait passer à tort.

## C. Ce que l'empreinte ne prouve pas (condition 3)

- Elle prouve qu'une décision correspond au commentaire désigné ; elle ne prouve pas **qui** a écrit ce commentaire.
- `claude.yml` et le relais partagent le jeton `github-actions[bot]` : un job d'agent peut poster sous le même nom. Risque résiduel explicite, **non résolu** par R2 (renvoyé à la voie B).
- Le compte `vito-sainte-marie` est partagé entre Frédéric et les sessions Claude Code.

## D. Conception de la consommation automatique mécanique (conditions 4 et 5)

Cause mesurée (`mesure-consommations-20261020.md`) : le juge `outils/relancer-claude-ci.js` (l. 113, 153) rend `RIEN_A_FAIRE` pour tout `closes: true`.

Conditions mécaniques pour consommer une clôture, toutes vérifiées par outil, aucune de jugement :
1. contrat valide et classé `CLOTURE_MATERIALISATION` ou `CLOTURE_SANS_ACTION` par `coherence-decision.js` ;
2. empreinte et commentaire source concordants (épreuves F1–F8) ;
3. preuves attendues présentes au lot ;
4. provenance CI admissible (R1) ;
5. geste tracé (commit de consommation nommant le run et le commentaire).
Si une condition manque : pas de consommation, état explicite ; si la décision est `CLOTURE_AVEC_ACTION`, `BLOCKED` ou à palier Frédéric, la boucle reste humaine.

Options pour l'acteur de la consommation, **documentées seulement, rien exécuté** :
- **O1** : le juge relance Claude aussi pour `closes: true` classé `CLOTURE_MATERIALISATION`. Touche le workflow d'armement (`tests.yml`, `claude.yml`) → `SECRET_PERMISSION_SURFACE_SECURITE` / `ARMEMENT_BOUCLE_AU_NOM_DE_FREDERIC`. **Arrêt avant exécution.**
- **O2** : une étape de `tests.yml` consomme directement avec le jeton du workflow (levée de la condition d'ARMEMENT-ARBITRAGE-AUTONOME-1 decision-1:54). Touche workflow + permission. **Arrêt avant exécution.**
- **O3** : consommation à l'ouverture de session / par `outils/` à la demande (vigie R4). Hors workflow, mais non automatique tant qu'aucune session ne s'ouvre.

Dans le périmètre autorisé de R2 : l'outil de vérification (`outils/`, F1–F8) et le classement mécanique. Le câblage O1/O2 n'est pas dans le périmètre.
