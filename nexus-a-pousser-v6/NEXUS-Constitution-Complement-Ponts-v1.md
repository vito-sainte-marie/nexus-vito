# NEXUS — Complément à la Constitution : le principe du pont

Date : 08/08/2026 · Demande de Frédéric, suite à la revue du rapprochement Decenium dans
NEXUS-Inventaire-Manager-v1.html.

Ce fichier n'a pas vocation à remplacer la Constitution NEXUS existante (citée dans le code sous
la forme « Article X de la Constitution NEXUS » — Articles 3, 5, 11 et 13 identifiés à ce jour).
Il consigne une règle que Frédéric a formulée le 08/08/2026 et qui n'était nulle part écrite,
avant qu'elle ne se perde. Le numéro d'article définitif reste à assigner par Frédéric dans le
document maître.

## La règle, telle que formulée

> Une limitation d'intégration ne doit jamais justifier une transformation de NEXUS en système
> métier. Aujourd'hui tu n'as pas l'API : tu crées un pont. Demain tu obtiens l'API : le pont
> change. La philosophie de NEXUS ne change pas.

## Ce que ça veut dire concrètement

NEXUS n'est pas — et ne doit jamais devenir — le système où vivent les ventes, le stock ou la
caisse. Son rôle est de comparer ce qui est déclaré (import, fichier, saisie) à ce qui est
constaté (comptage terrain, mouvement réel), et de signaler l'écart. Quand l'intégration directe
avec le logiciel métier (Decenium ou autre) n'existe pas encore, NEXUS construit un **pont** —
un adaptateur temporaire, explicitement identifié comme tel — jamais une copie durable de la
logique métier de ce logiciel.

Un pont se reconnaît à ceci : le jour où l'API existe, on **supprime** le pont, on ne le
**fait pas évoluer**. S'il faut migrer une logique plutôt que la jeter, ce n'était pas un pont —
c'était NEXUS en train de devenir un système métier par accumulation.

## L'exemple qui a déclenché cette règle — le rapprochement Decenium dans Inventaire

`NEXUS-Inventaire-Manager-v1.html` compare l'écoulement physique constaté (ouverture − clôture +
mouvements, déjà tracé dans `inventaire_comptages`/`inventaire_mouvements`) au fichier de ventes
Decenium importé manuellement pour le même quart, et fait ressortir les écarts en démarque
potentielle. Trois choix de conception, déjà en place, illustrent la règle :

1. **La ligne brute du fichier est toujours conservée**, même si le produit n'a pas pu être
   identifié — jamais une ligne silencieusement ignorée ou une donnée reconstituée à sa place.
2. **Le rapprochement sans code-barres passe par une liste d'alias vérifiée à la main**
   (`ALIAS_VENTES_SANS_CODE_BARRES`), jamais par une correspondance floue automatique qui
   pourrait confondre deux produits différents.
3. **Une ligne non reconnue reste `produit_id = null`** — NEXUS ne devine jamais, il attend une
   vérification humaine plutôt que d'inventer un rattachement.

Ce pont fonctionne parce qu'il ne prétend jamais être une intégration : c'est un import de
fichier, une table d'alias auditable, et un principe explicite de ne rien deviner. Le jour où
NEXUS a un accès API à Decenium (ou à un autre logiciel de caisse), cette page perd son bouton
d'import de fichier et sa table d'alias — remplacés par un appel API — mais elle continue de
faire exactement la même chose : comparer déclaré et constaté, jamais absorber l'un des deux.

## Test à trois questions, avant de construire tout futur pont

À appliquer chaque fois qu'une limitation d'intégration (API absente, connecteur non construit,
format de fichier imposé) pousse à écrire du code de contournement — dans le même esprit que les
5 questions de l'Article 13 déjà utilisées avant de développer un nouveau moteur :

1. Est-ce que je construis un pont (un adaptateur pour une donnée qui vient d'ailleurs), ou un
   système (une logique métier que NEXUS n'a pas à posséder) ?
2. Le jour où l'intégration directe existe, est-ce que ce code se **supprime**, ou faudrait-il le
   **faire évoluer** ? S'il faut le faire évoluer, ce n'est pas un pont.
3. NEXUS reste-t-il uniquement décideur/contrôleur de l'écart entre déclaré et constaté, sans
   jamais devenir la source de vérité de la donnée métier elle-même (ventes, stock, prix) ?

## Chantiers actuels à relire à la lumière de cette règle

D'après `NEXUS-Data-Dictionary-v2.md` (§4, Chantiers ouverts) : Rupture et Rotation restent
non résolus et dépendront d'un futur connecteur stock — le jour où ce connecteur existe, tout
pont construit d'ici là (import manuel de relevés dans Scanner Stock, par exemple) devrait être
conçu dès maintenant pour disparaître, pas pour être conservé en parallèle d'un flux automatique.
