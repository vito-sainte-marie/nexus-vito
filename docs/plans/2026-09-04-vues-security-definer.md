# Plan — les 17 vues `SECURITY DEFINER`

Lot séparé, **à traiter avant toute promotion générale**. Une partie du
travail existe déjà sur la branche `securisation-vues`.

## Le constat

17 vues du schéma `public` sont définies sans `security_invoker` : elles
s'exécutent avec les droits de leur propriétaire, et la RLS des tables
sous-jacentes est donc évaluée pour lui, pas pour l'appelant. Les advisors
Supabase les remontent toutes en `ERROR`.

    nexus_stock_etat_v2, nexus_stock_etat_v3, employees_public,
    v_caisse_ecart_a_traiter, view_inventaire_dernier_controle_produit,
    view_fdj_daily_summary, view_fdj_weekly_summary, view_fdj_monthly_summary,
    view_fdj_yearly_summary, view_fdj_shift_facts, view_fdj_employee_daily,
    view_fdj_employee_price_tier_daily, view_fdj_game_daily,
    view_fdj_game_daily_ventes, view_fdj_game_daily_mouvements,
    view_fdj_price_tier_daily, view_fdj_discrepancy_daily

**Elles ne fuitent pas aujourd'hui.** Vérifié le 04/09 : un manager de
`nexus-station-test` interrogeant `nexus_stock_etat_v3` obtient zéro ligne,
alors que 119 lignes existent sur un autre site. La raison tient à l'identité
du propriétaire, pour qui `current_employee_site_id()` vaut `NULL`.

C'est exactement ce qui rend le sujet sérieux : **la fermeture est un
accident de configuration, pas une règle**. Un changement de propriétaire, un
`grant` mal placé, une vue recréée par un outil, et le comportement bascule
de « rien » à « tout » sans qu'aucun test ne l'annonce. Une vue qui protège
par accident protège jusqu'au jour où elle ne protège plus.

## Ce qui est déjà fait

Branche `securisation-vues` :

- `e51c5ef` — sauvegarde de l'état des 17 vues avant toute correction ;
- `702dadb` — accès anonyme fermé sur les 17 vues (migration `20260904105000`,
  avec sa migration de retour) ;
- `c05c68a` — outil de reconstruction d'une base de test.

Cette branche n'est **pas** fusionnée dans `config-par-environnement`. Les
deux lots se recouvrent : la migration d'urgence appliquée à `nexus-test`
porte la version `20260904105148`, et son fichier existe bien sur
`config-par-environnement`. `securisation-vues` en porte une **autre
numérotation**, `20260904105000`, accompagnée d'une migration de retour qui,
elle, n'existe nulle part ailleurs.

Il ne s'agit donc pas d'une migration absente du dépôt, mais de deux
numérotations concurrentes du même correctif. C'est la branche qui doit
s'aligner sur la base, jamais l'inverse — et la migration de retour est à
récupérer au passage.

## Déroulé proposé

1. **Réconcilier les branches** : décider laquelle porte les migrations
   `20260904105000` et `20260904105148`, et faire en sorte que la branche
   promue les contienne. Aujourd'hui la base de recette a des migrations que
   `config-par-environnement` ne connaît pas.
2. **Vue par vue, décider de l'intention** : chacune est-elle censée être
   filtrée par site, ou est-ce une vue d'agrégation destinée au créateur ?
   Écrire la réponse dans la migration — c'est elle qui manquera dans six
   mois.
3. **Basculer en `security_invoker = true`** celles qui doivent suivre la RLS
   de l'appelant, et vérifier écran par écran qu'elles renvoient encore
   quelque chose. Une vue passée sous RLS peut se vider si les politiques des
   tables sous-jacentes sont plus strictes que l'usage réel : c'est le risque
   principal de ce lot, et la raison pour laquelle il ne se fait pas à la
   va-vite.
4. **Pour celles qui doivent rester en definer** — s'il y en a — appliquer le
   même patron que `nexus_stock_lire_etat` : une garde explicite qui compare
   le site demandé à celui du compte, et lève au lieu de renvoyer vide.
5. **Faire retomber les advisors à zéro ERROR**, et le vérifier.

## Ce qu'il ne faut pas faire

- Basculer les 17 vues en une seule migration. Le risque n'est pas la
  sécurité, c'est la régression fonctionnelle silencieuse : des écrans qui se
  vident sans erreur.
- Considérer le sujet clos parce que l'accès anonyme est fermé. Le trou
  restant est entre sites authentifiés, pas entre anonyme et authentifié.
