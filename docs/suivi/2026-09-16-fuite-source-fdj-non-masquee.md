# Suivi — la source FDJ n'est pas masquée côté serveur

*Ouvert le 16/09/2026. **Dossier de constat : aucun code, aucune migration, aucune
écriture Production.** Il décrit une fuite, il ne la corrige pas.*

Ce dossier est ouvert à la demande de Frédéric, en marge de la PR #61. La PR #61
referme le provisoire **côté caisse**. Elle ne touche pas FDJ, et il vaut mieux
écrire pourquoi que le laisser en note de bas de page.

---

## 1. Ce qui est en cause

Deux tables, `public.fdj_shifts` et `public.fdj_cash_controls`, lues **en direct
par PostgREST** depuis le navigateur :

```
NEXUS-Progression-v1.html:353
  nexusClient.from('fdj_shifts').select('*, fdj_cash_controls(*)')
             .eq('site', siteId).eq('employee_id', cible.id)
```

Puis, `nexus-progression.js:1367` :

```
function ligneActiviteFdj(service) {
  const statut  = statutCaisseJourFdj(service);
  const montant = statut === 'provisoire' ? service.ecartOrigine : service.ecart;
  ...
}
```

Quand le contrôle est `provisoire`, la ligne d'activité porte `ecartOrigine` —
**un montant avant validation**, celui-là même que l'arbitrage du 16/09 interdit
de présenter à l'employé.

## 2. Pourquoi ce n'est pas le même problème que la caisse

L'asymétrie est entière, et c'est elle qui compte :

| | Caisse (`audits_caisse`) | FDJ (`fdj_cash_controls`) |
|---|---|---|
| Chemin de lecture | RPC `mes_ecarts_caisse()` | PostgREST direct sur les tables |
| Nature | `SECURITY DEFINER`, sans paramètre | requête composée par le navigateur |
| Identité | `auth.uid()`, non choisissable | `.eq('employee_id', …)` — **un filtre client** |
| Provisoire | `null` **avant** de quitter le serveur | `ecart_origine` traverse la réponse réseau |
| Cloisonnement RLS | par employé | **par site** |

Côté caisse, la règle vit dans la source. Côté FDJ, elle vit dans l'interface —
c'est-à-dire nulle part.

## 3. Ce que dit la RLS, mesurée sur Test le 16/09/2026

`fdj_shifts` et `fdj_cash_controls` ont bien `rowsecurity = true`, et leurs
politiques `SELECT` sont, toutes les deux :

```
site = (select current_employee_site_id())
```

**Il n'y a aucune condition sur l'employé.** Le serveur autorise donc tout
employé authentifié à lire les lignes FDJ de *tous ses collègues du même site*.
Le seul obstacle est le `.eq('employee_id', cible.id)` écrit dans la page, que
l'utilisateur contrôle entièrement.

C'est précisément le scénario que la mission du 16/09 demande de rendre
impossible : *« preuve qu'une modification de la requête dans la console du
navigateur ne permet pas de consulter un autre salarié »*. Côté caisse, la preuve
est faite. Côté FDJ, elle ne peut pas l'être en l'état.

## 4. Ampleur réelle, relevée en Production le 16/09/2026 (lecture seule)

| Mesure | Valeur |
|---|---|
| Lignes `fdj_cash_controls` jointes à un quart | **81** |
| Dont au statut `provisoire` | **0** |
| Dont provisoires portant un `ecart_origine` | **0** |
| Employés distincts concernés | **8** |
| Sites | **1** |

Ce relevé nuance le constat, et la nuance mérite d'être dite dans les deux sens :

- **La fuite du montant provisoire n'a, à cette heure, aucune matière** en
  Production : il n'y a pas un seul contrôle FDJ provisoire. Rien n'est en train
  de fuir *aujourd'hui* par ce chemin précis.
- **La fuite entre collègues, elle, est effective** : 81 lignes et 8 employés
  sont derrière une politique qui ne cloisonne que le site. Un employé qui
  retire le filtre de la requête lit les écarts validés et les motifs de ses
  collègues.

Autrement dit, ce n'est pas un incident en cours ; c'est une porte ouverte qui
n'a pas encore servi. Le jour où un contrôle FDJ restera provisoire — ce qui est
le fonctionnement normal entre la transmission et la validation manager — la
première ligne du tableau cessera d'être à zéro sans que personne n'ait rien
changé.

## 5. Ce qu'il faudra décider, et qui n'est pas décidé ici

1. **Une projection FDJ dédiée**, sur le modèle de `mes_ecarts_caisse()` :
   `SECURITY DEFINER`, sans paramètre, identité par `auth.uid()`, provisoire
   renvoyé à `null`, `EXECUTE` à `authenticated` et `service_role` seulement.
2. **Le resserrement de la RLS** de `fdj_shifts` / `fdj_cash_controls` du site
   vers l'employé — avec l'arbitrage qui va avec : le manager, lui, doit
   continuer à voir tout le site. Un resserrement naïf casserait
   `NEXUS-FDJ-Manager-v1.html`.
3. **Le sort de `motif_ecart`** : s'il porte des commentaires internes du
   manager, il relève de la même interdiction que les commentaires de la caisse
   et n'a rien à faire dans une réponse destinée à l'employé.

Aucune de ces trois décisions ne peut être prise sans arbitrage produit. Aucune
n'est engagée par ce dossier.

## 6. État

**Ouvert, non traité, hors périmètre de la PR #61.** Attend un arbitrage.
Aucune ligne de code, aucune migration et aucune écriture Production n'a été
produite pour ce sujet.
