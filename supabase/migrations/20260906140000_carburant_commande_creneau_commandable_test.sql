-- NEXUS — lot CARBURANTS-PERFORMANCE-CORRECTION-COMMANDE-20260906 (Test uniquement).
--
-- Origine : audit CARBURANTS-PERFORMANCE-AUDIT-COMMANDE-20260906 (decision-1.md,
-- APPROVED) — écart E1 : le moteur confondait "jour de LIVRAISON autorisé"
-- (jours_livraison_iso) et "créneau encore COMMANDABLE" (nouveau
-- `jours_commande_iso`, voir nexus-carburant-commande-moteur.js,
-- estJourCommandePossible/prochainJourCommandePossible). Un samedi pouvait donc
-- présenter lundi comme livraison directement commandable, alors que le bureau
-- fournisseur n'accepte pas de commande le week-end.
--
-- Portée VOLONTAIREMENT limitée au site fixture Test `nexus-station-test` — ne
-- touche AUCUN autre site (Article 5/l'audit : "ne jamais corriger ce défaut
-- par un if(samedi) spécifique à Sainte-Marie [...] la commandabilité doit
-- être configurable et compatible multi-site"). `jours_commande_iso` étant lu
-- comme OPTIONNEL par le moteur (absent = comportement historique inchangé),
-- ne rien écrire pour les autres sites ne les régresse en rien.
--
-- Valeur choisie : identique à `jours_livraison_iso` déjà en place pour ce
-- site ([1,2,3,4,5], lundi-vendredi) — le bureau fournisseur de Sainte-Marie
-- n'accepte pas de commande le week-end, exactement le fait métier confirmé
-- par le terrain (samedi -> lundi non commandable).
--
-- Non appliquée par ce commit (Test-only, aucun accès réseau/identifiants
-- Supabase depuis ce canal Handoff GitHub Issue — voir request-N.md du lot) :
-- à exécuter par une session outillée avec accès `nexus-test`
-- (udljdqxerrbbbajxubfn), jamais contre Supabase Production.
UPDATE station_config
SET carburant_commande_config = carburant_commande_config || '{"jours_commande_iso": [1,2,3,4,5]}'::jsonb
WHERE site = 'nexus-station-test'
  AND carburant_commande_config IS NOT NULL
  AND NOT (carburant_commande_config ? 'jours_commande_iso');
