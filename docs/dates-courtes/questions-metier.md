# Questions métier non tranchées

Pour chaque point : le problème, une ou deux options, une recommandation. Rien n'est décidé ici.

## 1. Renouvellement de la quantité

Problème : la semaine suivante, un nouveau relevé du même groupe s'ajoute-t-il à l'ancien, ou le remplace-t-il ? Additionner gonfle la quantité si le même rayon est recompté.

Options :
- A : un relevé s'ajoute (règle actuelle). Pour recompter, « Corriger le relevé » ramène le groupe à la valeur constatée par une correction signée ; « Ajouter des unités » sert à compléter un comptage partiel.
- B : un recomptage complet remplace les relevés antérieurs du groupe (nécessite une action distincte).

Si personne ne recompte : la quantité affichée garde son âge, calculé depuis le dernier relevé ou la dernière correction du groupe, affiché sur chaque ligne. Au delà de 14 jours la quantité est masquée (règle conservée).

Recommandation : A, sans action supplémentaire, avec l'âge du dernier relevé toujours visible.

## 2. DDM

Problème : la clé (station, EAN, date) ignore le type de date. Une DDM et une DLC identiques sur le même EAN formeraient un seul groupe, alors que leur traitement diffère (DDM : consommation possible après la date).

Options :
- A : les DDM restent dans le module, le type de date entre dans la clé (deux groupes).
- B : les DDM sortent du module.

Recommandation : A, sinon on perd des produits utiles ; le type reste visible et les alertes les distinguent. À arbitrer.

## 3. (retiré)

Produit sans EAN : réglé par l'arbitrage du 21/11.

## 4. EAN partagé entre deux fiches

Problème : un même EAN pourrait désigner deux fiches catalogue. Mesure de Guardian du 21/11 : 0 EAN partagé sur 784, dans chacune des deux dernières périodes d'import.

Options :
- A : la clé reste station + EAN + DLC ; le doublon d'EAN est signalé au manager.
- B : en cas de collision, l'entrée devient provisoire jusqu'à choix d'une fiche.

Recommandation : A tant que le cas reste à 0, avec un contrôle qui le détecte.

## 5. Entrée provisoire d'un EAN inconnu

Problème : qui rattache l'entrée à un produit après coup, et que devient l'historique ?

Options :
- A : le manager rattache l'entrée à une fiche existante ; l'historique est conservé et réaffecté par une écriture tracée.
- B : l'entrée reste provisoire jusqu'à ce qu'un import fasse apparaître l'EAN, rattachement automatique par EAN.

Recommandation : A pour la décision, B comme facilité quand l'EAN apparaît. Aucune création automatique de référence.

## 6. Le retrait physique réduit-il la quantité consolidée ?

Problème : après retrait, la quantité du groupe doit-elle baisser, ou rester et porter un état à côté ?

Options :
- A : état à côté, la quantité relevée reste celle du dernier comptage, avec « retiré » affiché.
- B : le retrait écrit une correction négative liée, la quantité baisse.

Recommandation : B, pour que les quantités du tableau ne trompent pas ; le retrait garde sa trace propre.

## 7. (retiré)

Accès caissière : réglé par le complément du 21/11.

## 8. Portée de la lecture caissière (proposition)

Problème : quand l'accès caissière est activé, voit-elle seulement ses relevés ou tous ceux de la station ?

Recommandation : seulement ses relevés. À confirmer.

## 9. Réglage de l'accès caissière : où le loger

Problème : dans la configuration de station existante ou dans une table dédiée ?

Recommandation : table dédiée si la configuration de station n'est pas écrivable par les trois profils concernés ; à vérifier au lot 1.

## 10. Couverture de la référence catalogue

Problème : `normalized_products.external_product_id` est-il renseigné pour les produits sans EAN ? Non mesuré. Guardian a mesuré que 6 EAN ont changé de libellé entre deux périodes : un libellé ne peut pas servir de clé. Une lecture ciblée par site exige l'accord du pilote.
