# Observations UX du parcours du 13/09 — formulation, pas fonctionnement

**13/09/2026, relevées par Frédéric Bragance** pendant et après le parcours
navigateur d'Employé Test B.

Ce fichier est **volontairement séparé** des défauts fonctionnels du lot. Rien
ici ne remet en cause la preuve obtenue : l'enchaînement `pause_fin` → départ →
clôture par `pointage_depart` → rafraîchissement immédiat sans rechargement a
été joué et vérifié en base. Ce qui suit concerne ce que l'écran **dit**, pas ce
qu'il **fait**. Aucune de ces deux observations n'a été corrigée dans ce lot :
les mélanger à un correctif fonctionnel reviendrait à faire passer un changement
de formulation pour une réparation, et à obliger à reprouver un parcours pour
un mot.

## UX-1 — « Historique du service » affiche en réalité toute la journée

L'intitulé de la section, dans `NEXUS-Pointage-v1.html`, annonce le service.
Le contenu est celui de la **journée** : `renderTimeline` reçoit
`pointagesJour`, chargé par `(employee_id, date)` sans filtre de service.

Constaté le 13/09 : après la clôture du service du soir, l'écran affiche
**six** lignes — les deux du service du midi (arrivée 12:27, départ 12:32) et
les quatre du service du soir.

**Ce n'est pas le défaut de portée corrigé ce jour-là.** L'historique est
délibérément celui de la journée, et doit le rester : c'est le contexte que
l'employée veut voir, et il ne commande rien. Le code le dit explicitement
(« L'historique reste celui de la JOURNÉE »), et une épreuve le verrouille.
C'est **le titre** qui est faux, pas le contenu.

Piste, à trancher par Frédéric : intituler la section « Historique du jour »,
ou conserver « du service » en séparant visuellement les services de la
journée. La seconde option coûte plus cher et change ce que l'employée voit ;
la première ne change qu'un mot.

## UX-2 — « Photo non reçue (problème technique) » subsiste dans l'historique

Sur un pointage volontairement fait sans photo, l'historique porte une mention
de problème technique. Or il n'y a eu aucun problème : le départ de recette a
été pointé **délibérément** sans photo, par le chemin « sans photo ».

En base, la colonne le confirme : `photo_echec_technique = true` sur l'arrivée
et le départ, alors qu'aucune photo n'a été tentée. La colonne ne distingue pas
« la photo a échoué » de « il n'y a pas eu de photo ». Le bandeau de
confirmation, lui, a été corrigé le 11/09 pour dire « Enregistré SANS PHOTO »
en toutes lettres — l'historique, non : il parle encore d'un problème
technique.

Deux questions distinctes, dans cet ordre :

1. **De formulation** — ce que l'historique affiche pour une photo absente.
2. **De donnée** — faut-il distinguer en base une photo absente d'une photo
   échouée ? Aujourd'hui une seule colonne porte les deux cas, et le manager ne
   peut pas les séparer. Cette seconde question est un changement de schéma :
   elle n'appartient pas à un lot de formulation.

## Ce que ce fichier ne fait pas

Il ne corrige rien et ne lève aucun blocage. `aucun_blocage_non_resolu` reste
**BLOQUE**. Les mesures d'impact Production, expirées le 12/09 à 22:39 UTC,
restent un blocage indépendant de tout ce qui précède.
