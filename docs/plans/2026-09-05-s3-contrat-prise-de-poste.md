# S-3 — la prise de poste suivante clôture le service précédent

**05/09/2026 · contrat · aucun code**

## L'événement déclencheur

**L'insertion d'un service.** Pas le clic, pas l'écran : l'arrivée d'une
nouvelle ligne dans `shifts` pour un employé qui en a déjà une `en_cours`.

Même raisonnement qu'en S-2 : c'est un invariant de la donnée. Un appelant
futur — Edge Function, import, écran de reprise manager — ne doit pas avoir à
s'en souvenir.

## Mécanisme : trigger `BEFORE INSERT`, et non `AFTER`

C'est la différence essentielle avec S-2, et elle est imposée par l'index.

```
S-2 : AFTER INSERT on pointages   → l'insert a déjà eu lieu, on clôture ensuite
S-3 : BEFORE INSERT on shifts     → on clôture AVANT que l'index ne soit évalué
```

`shifts_un_seul_service_en_cours` est un index **unique**. Il est vérifié au
moment de l'insertion de la nouvelle ligne. Avec un trigger `AFTER`, l'insert
échouerait **avant** que la clôture n'ait lieu : la prise de poste serait
purement et simplement impossible. Avec `BEFORE`, l'ancien service passe à
`termine` d'abord, il sort de l'index partiel, et la nouvelle ligne entre.

L'ordre n'est donc pas un choix de style : `AFTER` ne peut pas fonctionner.

## L'heure de clôture

```
heure_fin = new.heure_debut
```

**L'heure de la nouvelle prise de poste, et rien d'autre.** C'est la seule
heure défendable : elle matérialise l'instant à partir duquel l'ancien service
ne peut plus être considéré comme actif.

Ce n'est pas l'heure à laquelle l'employé a réellement cessé son activité
précédente — nous ne la connaissons pas, et S-1 a déjà posé la règle : on
n'invente pas une heure de fin. Ici nous n'inventons rien, nous enregistrons
un fait vérifiable : à cet instant précis, un nouveau service a commencé.

`new.heure_debut` est un `timestamptz` porté par la ligne elle-même — aucune
construction de fuseau n'est nécessaire, contrairement à S-2 où l'heure venait
d'un couple `date` + `time` local. Le piège C1/C2 ne se présente pas ici.

## Le statut de l'ancien service

```
statut         = 'termine'
heure_fin      = new.heure_debut
cloture_source = 'prise_de_poste_suivante'
cloture_le     = now()
```

`termine`, et non `clos_sans_pointage` : la fin est **connue**, elle vaut
`new.heure_debut`. La contrainte `shifts_heure_fin_coherente` exige d'ailleurs
une `heure_fin` non nulle pour `termine` — les deux se répondent.

`cloture_le` reste `now()` : l'instant où NEXUS a effectué la clôture. Il peut
différer de `heure_fin` de quelques millisecondes, et cette distinction est
volontaire — l'une est un fait métier, l'autre un fait technique.

## Sans ancien service

Le trigger ne fait rien et laisse l'insertion se poursuivre. C'est le cas
normal d'une première prise de poste. **Aucun `NOTICE`** : contrairement à S-2,
il n'y a ici aucune anomalie à signaler.

## Atomicité et concurrence

Clôture et insertion sont dans **la même transaction**, par construction : le
trigger `BEFORE INSERT` s'exécute à l'intérieur de l'instruction `INSERT`.

Face à deux onglets ou un double clic, la séquence est :

```
T1  BEFORE : clôture l'ancien (verrou ligne)   INSERT : nouvelle ligne A
T2  BEFORE : attend le verrou de T1
    T1 commit
T2  BEFORE : relit — plus aucun service `en_cours` à clôturer
    T2  INSERT : nouvelle ligne B  →  VIOLATION D'UNICITÉ, T2 annulé
```

**L'index reste le juge de dernier ressort.** Le trigger rend la prise de
poste possible ; l'index garantit qu'une seule aboutit. Le second onglet
reçoit une erreur franche plutôt que de créer un doublon — c'est exactement
ce qui manquait le 05/09 à 11:17.

Le `select … for update` sur l'ancien service est ce qui sérialise les deux
transactions. Sans lui, les deux pourraient clôturer le même service et
tenter d'insérer ; l'index les départagerait quand même, mais après un
travail inutile et avec un message moins clair.

## Droits

`SECURITY INVOKER`, comme S-2. La politique `update_shifts` autorise déjà un
employé à modifier son propre service :

```sql
using : employee_id = auth.uid()  OR  (manager/gérant du même site)
```

Le trigger conserve exactement les droits de l'appelant et ne crée aucun
privilège. Ce qu'il peut clôturer est ce que `update_shifts` lui permet déjà
de modifier.

**Le contrôle `ROW_COUNT` de S-2 est repris à l'identique** : un `UPDATE`
refusé par RLS n'affecte aucune ligne sans lever d'exception. Si un service a
été identifié mais que la clôture n'affecte pas exactement une ligne, la
prise de poste est annulée. Sans quoi on obtiendrait le symétrique du défaut
de S-2 : un nouveau service ouvert et l'ancien resté actif — puis un échec
d'index incompréhensible.

## Filtre

```sql
where employee_id = new.employee_id
  and site_id     = new.site_id
  and statut      = 'en_cours'
  and id         <> new.id            -- ceinture : ne jamais se clôturer soi-même
order by heure_debut desc
for update
```

Employé **et** site, comme en S-2 : l'invariant est « le service actif de cet
employé sur ce site ».

## Le contrôle chronologique — ce qui définit « suivante »

Ajouté au contrat le 05/09/2026, avant rédaction.

Le trigger ne doit **pas** fermer un service actif simplement parce qu'une
ligne `shifts` est insérée. Il ne le ferme que si la nouvelle prise de poste
est **chronologiquement postérieure** :

```sql
new.heure_debut > ancien.heure_debut
```

Sans cette condition, un import, une reprise ou une insertion rétroactive
produirait ceci : un service actif commencé à 14:00, puis l'insertion
historique d'un service de 09:00 — et le trigger tenterait de fermer le
service de 14:00 **à 09:00**. Une `heure_fin` antérieure à `heure_debut` : au
mieux une contrainte le refuse, au pire la donnée devient absurde.

**Comportement retenu : `RAISE EXCEPTION`, aucune clôture, aucun insert.**

C'est un refus, pas un arbitrage. Ni « on ignore la clôture et on insère »
— cela buterait sur l'index avec un message incompréhensible — ni « on
clôture quand même » — cela fabriquerait une durée négative. Une insertion
antérieure à un service actif n'est pas une prise de poste suivante : c'est
une opération dont NEXUS ne connaît pas le sens, et il le dit.

Le cas `=` est traité comme `<` : deux services commençant à la même
microseconde ne se succèdent pas.

## Ce que S-3 ne fait pas

- **Il ne modifie aucun écran.** `NEXUS-Prise-De-Poste-v1.html` reste
  inchangé, comme Pointage l'est resté en S-2.
- **Il ne touche pas aux lecteurs.** L'alignement sur « service courant =
  `en_cours` + le plus récent » est S-4.
- **Il ne gère pas le changement de rôle en cours de service.** Un employé qui
  reprend un poste différent ferme l'ancien et en ouvre un nouveau : c'est le
  comportement attendu, et `role_changes` existe pour la traçabilité fine.

## Nom proposé

```
supabase/migrations/20260905190000_cloture_shift_a_la_prise_de_poste_suivante.sql
```

**Aucun code écrit. `main` et `production` restent à `501c0c7`.**
