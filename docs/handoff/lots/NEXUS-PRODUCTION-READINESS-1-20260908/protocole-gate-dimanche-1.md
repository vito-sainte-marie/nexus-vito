# Protocole du dimanche 13/09/2026 — ce qui doit être refait, dans l'ordre

**Posé le 11/09/2026.** Les mesures du 11/09 expirent le **12/09 à 22 h 39
UTC**. La fenêtre de dimanche tombe après. **Aucune mesure existante ne peut
autoriser la gate de dimanche.** Tout ce qui suit est à refaire dans les 24 h
précédant la fenêtre, et rien de ce qui suit n'autorise quoi que ce soit : à la
fin, je reviens demander la gate humaine.

---

## 0 · Avant tout : le SHA

```bash
git fetch origin && git rev-parse origin/config-par-environnement
```

Le HEAD distant exact est noté. C'est lui, et lui seul, qui sera mesuré, vérifié
sur la CI et soumis à la gate. S'il a bougé depuis `b10f9b6`, dire lequel et
pourquoi avant de continuer.

## 1 · Mesures #1 à #4 et #6, avec le rôle readonly

Rôle `nexus_prod_readonly_login`, secret lu dans le trousseau, jamais affiché.

| mesure | attendu | blocage si |
|---|---|---|
| #1 Advisor | 0 `ECRASEE` | une seule ligne `ECRASEE` — examiner champ par champ |
| #2 `site`/`site_id` | 17 et 89, documentés | écart inexpliqué (la migration #3 les répare elle-même) |
| #3 fuseau | `timezone` absente, tout site repris | un site nouveau non couvert |
| #4 reprise, **CTE canonique** | écart < facteur 2 avec 16 | facteur ≥ 2 sans explication écrite |
| #6 `nexus_live_events` | `false` | `true` → **arrêter**, écriture hors migration |

La mesure #4 se joue avec le CTE canonique, chemin `shifts → employees → sites`
intact. La variante par site porté par le service **ne remplace pas** le
canonique : elle coïncidait le 11/09 parce que trois écarts valaient zéro ;
ces trois écarts sont à remesurer, pas à supposer.

## 2 · Mesure #5, observateur privilégié

`outils/mesure-5-ecriture-en-vol-observateur-privilegie.sql`, exécutée par le
connecteur Supabase (rôle déjà autorisé), en lecture seule, **dans les minutes**
précédant la fenêtre — pas quelques heures avant : c'est une mesure d'instant.

`pg_read_all_stats` n'est pas accordé au rôle readonly, et ne le sera pas.

0 ligne → #5 OK. ≥1 ligne → reporter, rejouer. Le rapport ne porte aucun texte
de requête.

## 3 · CI sur le SHA exact

```bash
gh run list --commit <SHA COMPLET> --limit 20
```

Le SHA **complet**. Le SHA court ne filtre rien et rend zéro run, ce qui se lit
à tort comme « CI absente ».

## 4 · Recalcul des onze critères

```bash
node outils/evaluer-pret-pour-production.js
```

Lancé **après** le dernier commit, jamais avant. Le SHA qu'il imprime doit être
celui du §0. Un verdict dont le SHA ne correspond pas au HEAD distant est nul.

`aucun_blocage_non_resolu` reste **BLOQUE** tant que le défaut du parcours
Caissière n'est pas déclaré résolu par Frédéric. Le verdict reste donc
**NON_PRET** et l'autorisation **NON_AUTORISEE** — ce protocole ne les lève pas.

## 5 · Revenir demander la gate

Rapport complet, onze critères, chaque mesure horodatée et attribuée à son
exécutant. Puis la question, posée à Frédéric, et l'attente.

---

## Ce qui est interdit d'ici là, et pendant

Aucune migration Production. Aucun déploiement Production. Aucune écriture
Supabase Production. Rien ne change de côté Production avant la gate humaine,
et la gate humaine n'est pas une conséquence des onze critères : dix critères
au vert n'autorisent toujours rien.
