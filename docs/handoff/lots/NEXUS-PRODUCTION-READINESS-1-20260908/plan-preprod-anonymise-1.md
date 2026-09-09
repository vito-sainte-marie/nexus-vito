# Plan PREPROD anonymisé — conception, pas exécution

Ce document conçoit comment un environnement PREPROD anonymisé serait
construit à partir d'un dump Production, et ce qui prouverait l'absence de
données personnelles avant qu'un humain ou un agent n'y touche. Il ne
construit rien : aucun dump Production n'a été lu ni demandé dans ce lot
(aucun accès Production disponible dans ce canal). Toute case marquée
**INCONNU** le reste tant que la preuve correspondante n'existe pas — ce
n'est pas une case à remplir par confort.

## Pourquoi PREPROD anonymisé, et pas un accès Production direct

`decision-1.md` de ce lot autorise la lecture Production pour les mesures
d'impact, mais la Bible NEXUS et `CLAUDE.md` distinguent strictement l'accès
en lecture à des fins de mesure de l'exposition de données clientes réelles
à un agent ou à un humain non habilité. PREPROD anonymisé permet de répéter
des migrations et des recettes sur un jeu de données au volume et à la
structure réels, sans que quiconque — humain ou agent — manipule une donnée
personnelle réelle.

## Recensement des champs porteurs de donnée personnelle (lecture de schéma, pas de données)

Fait à partir de `supabase/migrations/20260101000000_baseline_pre_existing_schema.sql`
et des migrations suivantes. Les volumes réels (nombre de lignes, valeurs
observées) restent **INCONNU** sans accès Production.

| Table | Champ(s) | Nature | Traitement PREPROD |
|---|---|---|---|
| `employees` | `nom`, `username` | identité directe | substitution déterministe (voir mapping) |
| `evaluations_employes` | `commentaires`, `autocritique_forts`, `autocritique_ameliorer` | texte libre, peut nommer des personnes ou décrire des faits individuels | **rédaction de contenu**, pas une simple substitution d'identifiant (voir limite ci-dessous) |
| `audits_caisse` | `commentaire` | texte libre, peut nommer un employé ou décrire un évènement identifiable | idem |
| `controles_tenue`, `employee_indisponibilites`, `employee_contraintes` | commentaires/motifs éventuels | à confirmer champ par champ — **INCONNU** sans lecture du schéma complet de chaque table lors de la construction réelle | audit de schéma exhaustif requis avant toute construction |
| `advisor_messages` | texte généré (gabarits + variables) | peut inclure `employee_name` interpolé | régénérable à partir de `advisor_rules`/templates sur données déjà anonymisées — ne pas copier le texte déjà généré tel quel |
| `role_changes`, `journal_decisions` | `candidate_id`, contexte | identifiants à faire correspondre au mapping `employees`/`sites` | substitution des identifiants référencés |
| toutes les tables portant `site_id`/`site` | nom de site | `sites.nom` peut révéler l'identité commerciale du client | substitution vers des noms de site génériques (`site-test-1`, `site-test-2`, ...) |

**Limite assumée** : une substitution d'identifiant (UUID → UUID stable,
`nom` → nom généré) ne suffit pas pour les champs de texte libre. Un
commentaire peut contenir un nom, un numéro, une situation identifiable même
après que la colonne porteuse de l'identité structurée a été anonymisée.
Tant qu'un outil de détection de contenu identifiable (nom propre, numéro de
téléphone, motif de date de naissance) dans ces champs texte n'existe pas et
n'a pas été éprouvé, ces colonnes doivent être **remplacées entièrement**
par un texte générique représentatif (même longueur approximative, même
distribution de vocabulaire métier), jamais recopiées puis retouchées à la
main — une retouche manuelle est exactement le type d'opération qui laisse
passer un oubli.

## Mapping d'anonymisation — principe, pas table de correspondance réelle

Principe déterministe et stable (le même identifiant Production produit
toujours le même substitut, pour que les relations et les recettes
comportementales restent cohérentes d'une exécution à l'autre) :

```
substitut(id) = HMAC-SHA256(cle_session_ephemere, id)  → tronqué, formaté UUID
```

- `cle_session_ephemere` : générée aléatoirement à la construction de CHAQUE
  PREPROD, jamais réutilisée, jamais committée, jamais journalisée — sans
  cette clé, aucun tiers ne peut retrouver quel substitut correspond à quel
  employé réel, y compris en connaissant les deux jeux de données.
- `employees.nom` : remplacé par un nom généré depuis une liste fixe hors
  dépôt (prénoms/noms génériques), indexé par le même HMAC — jamais un
  identifiant du type « Employé 1 », qui casserait les tests d'affichage
  attendant un vrai nom.
- `sites.nom`/`site_id` textuel : remplacé par `site-preprod-<rang>`, rang
  déterminé par l'ordre de création (préserve le nombre réel de sites).
- Dates (`created_at`, `date`, horodatages) : **jamais décalées** — la
  Bible NEXUS interdit d'inventer un temps qui n'a pas eu lieu, et la
  cohérence temporelle (quart de nuit, cutoff 11h, fuseau station) est
  précisément ce que ce lot cherche à éprouver. Décaler les dates casserait
  la valeur de test de PREPROD sans gagner en confidentialité (la date
  seule n'identifie personne).
- Champs numériques métier (montants, volumes, écarts) : **jamais modifiés**
  — ce sont les valeurs que les migrations et les recettes doivent
  effectivement traiter ; les altérer invaliderait la preuve de non-
  régression que PREPROD est censé apporter.

## Preuve d'absence de donnée personnelle — ce qui manque encore

Aucune preuve de ce type n'existe aujourd'hui. Avant de déclarer un PREPROD
« anonymisé et prouvé », il faut au minimum :

1. un script de construction déterministe (dump Production → transformation
   → PREPROD), rejouable, sans étape manuelle ;
2. une épreuve automatisée qui, après construction, cherche dans **toutes**
   les colonnes texte de **toutes** les tables une occurrence d'un `nom` ou
   `username` réel connu (les valeurs Production, jamais committées, servent
   uniquement d'entrée à cette épreuve pendant la construction — jamais
   stockées ni journalisées après) ; un résultat non vide bloque la
   promotion vers PREPROD, fail closed ;
3. une revue humaine (Frédéric) du résultat de cette épreuve avant tout accès
   agent à PREPROD — la preuve automatisée réduit le risque, elle ne le
   supprime pas pour des champs de texte libre non structurés.

Tant que ces trois éléments n'existent pas, le statut de ce plan est
**INCONNU / NON CONSTRUIT** — pas « prêt », pas « en cours ». Le construire
est un travail de fond distinct (script + épreuve + revue), proposé comme
lot séparé, pas fabriqué à la hâte dans cette session sans accès Production
pour le valider contre des données réelles.

## Ce que ce plan NE fait pas

Il ne lit, ne copie, ni ne transforme aucune donnée Production. Il ne crée
aucun script exécutable. Il pose la méthode et les critères de preuve pour
qu'une session future, avec accès Production en lecture, puisse construire
et éprouver PREPROD sans improviser sa définition de « anonymisé ».
