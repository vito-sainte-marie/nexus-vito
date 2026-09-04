# Plan — remplacer définitivement `employees_public` (connexion)

Lot séparé, **rendu nécessaire par une mesure provisoire déjà en place**.

## Où on en est

La migration `20260904182000_login_non_enumerable.sql` a fermé la fuite la
plus grave — l'annuaire complet des employés, lisible par un visiteur
anonyme — en remplaçant la lecture de vue par la fonction
`nexus_identifiant_de_connexion(p_prenom)`.

**Ce n'est pas la solution décidée.** Le cadrage
`.github/recettes/CADRAGE-nexus-test.md` (branche `securisation-vues`,
04/09/2026) écarte explicitement ce choix : « Une simple fonction SECURITY
DEFINER publique est exclue : elle contourne RLS elle aussi et déplacerait la
porte au lieu de la fermer. »

La mesure provisoire a été retenue parce que la fuite était réelle et
atteignable le jour même, et que la recette restait bloquée tant que la
connexion ne fonctionnait pas. Elle rétrécit la porte sans la condamner :

| | avant | après la mesure provisoire | après l'Edge Function |
|---|---|---|---|
| Lister tous les employés | ✅ un appel | ❌ | ❌ |
| Confirmer un prénom deviné | ✅ | ⚠️ oui, par le délai de réponse | ❌ |
| Message distinguant prénom inconnu / PIN faux | ✅ | ❌ message unique | ❌ |
| Essais illimités | ✅ | ✅ **toujours** | ❌ |
| Verrouillage de compte, déverrouillage manager | ❌ | ❌ | ✅ |

La ligne qui compte est l'avant-dernière : **rien ne limite aujourd'hui le
nombre de tentatives**. Face à un PIN de 4 à 6 chiffres, c'est le point
faible restant.

## À construire — exigences du cadrage, reprises telles quelles

- Edge Function, clé `service_role` uniquement dans ses secrets ;
- jamais de JWT fabriqué à la main — mécanismes officiels Supabase Auth ;
- limitation des tentatives **atomique** : deux essais simultanés ne
  contournent pas le compteur ;
- limitation par IP/appareil **et** protection du compte, pour qu'un
  attaquant ne puisse pas verrouiller un employé en saisissant son prénom en
  boucle ;
- déverrouillage manager, et expiration automatique du verrouillage ;
- message strictement identique pour prénom inconnu, PIN incorrect, compte
  désactivé, compte verrouillé — **déjà fait** côté écran ;
- délai de réponse homogène, sans prétendre au temps constant ;
- ne jamais journaliser prénom complet, PIN, jeton ni clé `service_role` ;
- IP pseudonymisée dans les journaux, conservation limitée ;
- pas d'en-tête IP fourni par le client considéré comme fiable ;
- `EXECUTE` retiré à `PUBLIC` sur toute fonction créée, `search_path` figé.

## Tests obligatoires — cadrage

1. Connexion valide pour les quatre rôles.
2. Prénom inconnu et PIN incorrect : même réponse visible.
3. Énumération des employés impossible.
4. Verrouillage progressif après plusieurs échecs.
5. Un autre employé n'est pas bloqué pour autant.
6. Déverrouillage manager fonctionnel.
7. Aucun secret dans les journaux.
8. Session Supabase valide après connexion.
9. Ancienne vue inaccessible après son retrait.
10. Échec **fermé** si l'Edge Function ou la base est indisponible.

## Contraintes d'ordre

- Le projet `nexus-test` n'héberge **aucune** Edge Function aujourd'hui. Ce
  lot est aussi l'occasion de rétablir la parité : `admin-api`, `api-v1`,
  `google-sheets-sync` et `clever-endpoint` sont appelées par les écrans et
  échoueront en recette tant qu'elles n'y sont pas déployées.
- `employees_public` n'est supprimée qu'**après** déploiement et validation
  complète du nouveau parcours — exigence du cadrage. Elle est aujourd'hui
  fermée à `anon` et repassée sous RLS ; elle n'est plus une porte, elle est
  un vestige.
- La migration provisoire est **incompatible avec le code de production
  actuel** : promouvoir le nouvel écran de connexion d'abord, appliquer la
  migration ensuite.
