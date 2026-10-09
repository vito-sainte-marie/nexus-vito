# Procédure canonique de release Production

S'applique à toute promotion future depuis `config-par-environnement` vers
`production`, pas seulement à la candidate actuelle. Écrite maintenant pour
que la gate finale suive une séquence connue à l'avance, jamais improvisée
sous pression.

## Étapes, dans l'ordre

1. **Figer la candidate** : noter le SHA exact de `config-par-environnement`
   retenu. Aucune migration ni fichier applicatif n'est ajouté après ce
   point sans recommencer la procédure depuis l'étape 1.
2. **Vérifier le rail Handoff** : `node outils/handoff.js verifier` conforme,
   0 lot actif en attente de décision qui contredirait la release.
3. **CI verte sur la candidate exacte** : le run GitHub Actions déclenché par
   le commit exact de l'étape 1 (pas un commit antérieur, pas un commit
   d'une branche de travail non fusionnée) passe entièrement, y compris
   `test_handoff_v2_20260905.js` et la suite Guardians.
4. **Manifeste de migrations à jour** : relire
   `manifeste-migrations-production-1.md` — aucune migration ajoutée depuis
   sans être classée (incluse / exclue / bloquée).
5. **Mesures Production fraîches** : rejouer les mesures en lecture seule
   (comptes `en_cours`, divergences `site_id`/`site`, résultat de
   `comparaison-seed-referentiel-advisor.sql`) — une mesure de plus de 24h
   au moment de la gate est considérée périmée, pas valide par défaut.
6. **Fenêtre de déploiement confirmée** : conditions de
   `plan-reparation-rollback-1.md` satisfaites (activité mesurée, pas
   supposée basse).
7. **Sauvegardes préalables** : export `SELECT` des lignes concernées par
   #3, #5, #6 (voir plan de réparation/rollback), horodaté, conservé hors
   dépôt.
8. **Gate humaine explicite de Frédéric** : cette procédure ne s'auto-valide
   jamais. Aucune étape précédente, même toutes vertes, ne vaut autorisation
   — la gate reste un acte humain distinct, pour une release précise
   (le SHA de l'étape 1) et un impact précis (le manifeste de l'étape 4).
9. **Application** : migrations dans l'ordre du manifeste, jamais en
   parallèle, jamais réordonnées.
10. **Vérification post-application** : rejouer les mêmes mesures de l'étape
    5 contre Production après application, confirmer qu'elles correspondent
    au résultat attendu par chaque migration (ex. `sites.timezone` renseigné
    pour les 2 sites, plus aucune ligne `site_id IS DISTINCT FROM site`).
11. **Retour canonique** : `request-N.md` documentant l'application réelle
    (pas seulement la préparation), avec les mesures avant/après.

## Ce qui ne raccourcit jamais cette procédure

- Une preuve `VERIFIED` obtenue lors d'un lot antérieur ne remplace pas une
  mesure fraîche à l'étape 5 — les données Production changent en continu.
- Une CI verte sur une branche de travail (`claude/issue-*`) ne remplace pas
  l'étape 3 : la CI doit être verte sur le commit **exact** de la candidate,
  intégré à `config-par-environnement`.
- Aucune étape n'est déléguée à un agent pour la gate 8 : c'est la seule
  étape non automatisable de cette liste, par construction.

## Ce que cette procédure NE fait pas

Elle ne s'applique à aucune release ici — aucune migration Production n'a été
exécutée dans ce lot. Elle sert de référence pour la prochaine fois qu'une
release Production sera réellement préparée.
