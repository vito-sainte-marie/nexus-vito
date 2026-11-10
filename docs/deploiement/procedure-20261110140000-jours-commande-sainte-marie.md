# Procédure — migration 20261110140000 (jours de commande Sainte-Marie)

Fichier : `supabase/migrations/20261110140000_carburant_commande_jours_commande_sainte_marie.sql`.
Effet : ajoute `jours_commande_iso = [1,2,3,4,5]` à `station_config.carburant_commande_config` pour `vito-sainte-marie`, si la clé est absente.

Cette migration est **déjà appliquée en Production** (constatée le 10/11/2026). Ce fichier la consigne ; il n'y a rien à rejouer.

## AVANT (lecture seule)

```sql
select carburant_commande_config->'jours_commande_iso'
from public.station_config
where site = 'vito-sainte-marie';
```

Attendu : `[1,2,3,4,5]`. Cela veut dire déjà appliquée : aucun geste.

## Application

Aucune en Production, l'effet est constaté. Si un rejeu avait lieu, il serait sans effet par construction, grâce à `not (carburant_commande_config ? 'jours_commande_iso')`.

## Ordre vis-à-vis du code

Aucun : la donnée est déjà présente en Production.
