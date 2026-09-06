---
protocol: nexus-handoff/2
kind: request
lot_id: SITE-EXPLICITE-1-STATIC-GUARD-UNKNOWN-TRIAGE-20260906
seq: 1
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=501c0c7 production=501c0c7
  - id: triage
    classe: VERIFIED
    valeur: UNKNOWN 27 vers 3, SAFE 183 vers 209, aucune policy modifiee
  - id: aide-nommee
    classe: VERIFIED
    valeur: nexus_clients_ecriture_ok verifie role ET site, lue en base
  - id: frontiere-service-role
    classe: VERIFIED
    valeur: clause TO documentee, non traitee comme absolution
  - id: constat-createur
    classe: VERIFIED
    valeur: escalade non materialisee, protection incidente par select_sites
  - id: aucune-derogation-inscrite
    classe: VERIFIED
    valeur: autorise_par doit nommer un humain
  - id: adr-0001-enrichie
    classe: VERIFIED
    valeur: distinction USING / WITH CHECK ajoutee
  - id: corpus-qa
    classe: VERIFIED
    valeur: seul 42501 atteste un refus de politique
  - id: suite
    classe: VERIFIED
    valeur: 192/201
  - id: safe-par-lecture
    classe: HUMAN
    valeur: 209 classees par expression, non par comportement
  - id: aides-nommees-futures
    classe: HUMAN
    valeur: rendront la garde aveugle si non declarees
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete, aucun merge, aucun deploiement
---

# SITE-EXPLICITE-1-STATIC-GUARD-UNKNOWN-TRIAGE — 27 → 3, et un constat

## Contrat anti-dérive

| Champ | Valeur |
|---|---|
| `objectif_metier` | Qu'aucune question ne reste ouverte dans le périmètre de la garde avant de la rendre bloquante. |
| `gain_attendu` | **Fiabilité** — un `UNKNOWN` qui dure est une question qu'on a cessé de se poser ; 24 en étaient. |
| `contrats_touches` | **aucun** — phase de connaissance |
| `guardians_requis` | Architecture · Security & Isolation · QA / Regression |
| `preuves_exigees` | table / policy / acteur / mécanisme / frontière / verdict / preuve |
| `definition_de_termine` | Zéro `UNKNOWN` non expliqué ; constats remontés sans correction. **Atteinte.** |

## Résumé

**27 `UNKNOWN` → 3.** Aucune policy modifiée. Les trois restants portent un
**constat de sécurité**, remonté sans correction.

Détail : `docs/gouvernance/2026-09-06-unknown-triage.md`.

## 1. Les 24 premiers n'étaient pas des défauts — c'était ma garde

### Quatrième forme de portée : une aide nommée

Vingt-deux policies contrôlent la portée par `nexus_clients_ecriture_ok(site)` :

```sql
select current_employee_role() = any(array['manager','gerant'])
   and p_site = current_employee_site_id()
```

Rôle **et** site : exactement le contrôle attendu, mais nommé. La garde ne
cherchait que des motifs syntaxiques.

> Une aide bien nommée est plus lisible qu'une expression recopiée. Elle est
> aussi invisible à qui ne lit que la syntaxe. C'est le prix d'une garde
> statique, et il se paie en lui apprenant les noms.

### La clause `TO` : une frontière de confiance ignorée

`fdj_site_settings_write_service_role` est en `using (true)` — mais **`TO
service_role`**. Cette clé ne transite jamais par le navigateur.

Conformément à la règle 4 : **ce n'est pas une absolution**. Le contrôle est
**déplacé** vers qui détient la clé de service. Et aujourd'hui `nexus-test`
n'héberge aucune fonction Edge : **personne n'emprunte ce chemin**. La
frontière est documentée, pas supposée.

## 2. Répartition finale

| Classe | Avant | Après |
|---|---:|---:|
| `SAFE` | 183 | **209** |
| `VULNERABLE` | 0 | **0** |
| `UNKNOWN` | 27 | **3** |
| `NOT_APPLICABLE` | 152 | 153 |

| Verdict | Policies |
|---|---:|
| `SAFE` — aide nommée | 22 |
| `NOT_APPLICABLE` — `TO service_role`, frontière documentée | 1 |
| **Constat de sécurité — retour Handoff** | **3** |

## 3. Le constat : les trois branches créateur sur `sites`

| | |
|---|---|
| Acteur | créateur, rôle `authenticated` |
| Mécanisme de portée | **aucun** |
| Frontière | protection **incidente** par la policy de lecture |

```
createur_update_sites : using / with check = je_suis_createur()   -- aucun site
createur_delete_sites : using              = je_suis_createur()   -- aucun site
createur_insert_sites : with check         = je_suis_createur()   -- aucun site
```

Prises isolément, elles permettent de modifier ou supprimer **n'importe quelle
ligne de `sites`** — dont `acces_createur_autorise`, le drapeau par lequel un
commerce **refuse** l'accès du créateur. Un créateur pourrait lever lui-même
le refus qu'on lui oppose.

### Éprouvé — l'escalade ne se matérialise pas

```
fixture : site-ferme-createur, acces_createur_autorise = false
1. acces au site ferme, AVANT          : REFUSE [42501]
2. le createur leve lui-meme le refus  : 0 ligne(s) modifiee(s)
3. acces au site ferme, APRES          : REFUSE [42501]
4. CONTROLE employe ordinaire          : 0 ligne(s) modifiee(s)
```

**Mais ce n'est pas la policy d'écriture qui l'empêche.** C'est celle de
lecture :

```sql
select_sites using (site_id = current_employee_site_id()
                    OR (je_suis_createur() AND acces_createur_autorise = true))
```

Un site fermé est **invisible** au créateur : son `UPDATE` ne trouve aucune
ligne à cibler.

> La protection est réelle, mais **incidente**. Elle tient à ce que l'écriture
> doive d'abord lire, et repose sur une policy dont ce n'est pas l'objet. Un
> élargissement futur de `select_sites` rouvrirait le chemin **sans que
> personne ne fasse le lien**.

Même famille que les 17 vues `SECURITY DEFINER` du registre : *ne fuitent pas
par accident de configuration, pas par règle.*

### Verdicts proposés — aucun appliqué

| Policy | Verdict proposé | Raison |
|---|---|---|
| `createur_update_sites` | **VULNERABLE (latente)** | non exploitable aujourd'hui ; devrait porter sa propre condition |
| `createur_delete_sites` | **VULNERABLE (latente)** | même incidence, et supprimer un commerce est plus destructeur |
| `createur_insert_sites` | **DÉROGATION à autoriser** | créer un commerce est la capacité constitutive du créateur |

**Aucune dérogation n'a été inscrite au registre.** Une dérogation que je
m'accorderais moi-même serait exactement l'exclusion silencieuse que la
décision interdit : `autorise_par` doit nommer un humain.

## 4. ADR-0001 mise à jour

Ajout de la distinction, formulée comme demandé :

> `USING` borne les lignes que l'acteur peut **cibler** ; `WITH CHECK` borne
> l'**état final** de la ligne après mutation. Quand une clé de portée peut
> changer, contrôler seulement la ligne visible ne suffit pas.

Avec la nuance exigée : PostgreSQL réutilise `USING` quand `WITH CHECK` est
absent, NEXUS **préfère** l'explicite quand une portée mutable est en jeu, et
ce n'est **pas** une obligation de recopier `USING` partout — certaines
policies ont légitimement des contrats différents entre visibilité de
l'ancienne ligne et validité de la nouvelle.

## 5. Point méthodologique QA, intégré au corpus

L'exigence issue du faux signal P3/P5 est désormais une épreuve de la garde :
**seul `42501` atteste un refus de politique**. `23502`, `23503`, `23514`,
`22P02` sont des erreurs de schéma ou de donnée — la RLS n'a pas été
atteinte, et conclure « sécurité OK » sur l'une d'elles ment dans les deux
sens.

## Avis des Guardians

### Security & Isolation Guardian

Vingt-trois questions se sont dissoutes en connaissance ; la vingt-quatrième
est un vrai constat.

Le cas `sites` me préoccupe plus que sa non-exploitabilité ne rassure. **Une
protection incidente n'est pas une protection** : elle est vraie tant que
personne ne touche à une policy voisine dont ce n'est pas l'objet. C'est
précisément le genre de dépendance implicite que ce chantier a passé six lots
à éliminer ailleurs.

**Avis : les deux `VULNERABLE (latentes)` doivent être fermées avant
l'activation bloquante** — sinon la garde bloquerait sur un constat connu, ce
qui apprend à la contourner.

### Architecture Guardian

Deux angles morts de la garde en un tri : une aide nommée, une clause `TO`.
Tous deux du même genre — la garde lisait la **forme** et non le **sens**.

**Avis : la leçon vaut au-delà de ce lot.** Chaque nouvelle aide nommée qui
encapsule un contrôle de portée devra être déclarée à la garde, sans quoi elle
la rendra progressivement aveugle. C'est une dette de maintenance à assumer,
pas un défaut à corriger.

### QA / Regression Guardian

Le tri a fait ce qu'on lui demandait : il a **réduit le bruit sans le
supprimer**. Aucun `UNKNOWN` n'a été converti en `NOT_APPLICABLE` pour obtenir
zéro.

**Réserve** : les 209 `SAFE` le sont **par lecture d'expression**. Une
poignée seulement a été éprouvée sous identité réelle. La garde dit que le
contrat est écrit ; elle ne dit pas qu'il s'applique.

## Preuves

- Garde : `SAFE 183 → 209`, `UNKNOWN 27 → 3`, `VULNERABLE 0`, incohérences 0.
- `nexus_clients_ecriture_ok` lue en base : rôle **et** site.
- Escalade créateur éprouvée : 4 mesures, transaction annulée.
- `test_garde_portee_site_20260906.js` — **18 vérifications** (+3).
- ADR-0001 enrichie.
- Suite `192/201`, mêmes 9 échecs historiques.
- **Aucune policy modifiée, aucune dérogation inscrite.**
- `main` et `production` : `501c0c7` — preuve calculée par l'outillage.

## Risques / anomalies

1. **Trois constats ouverts** sur `sites`, non corrigés par respect de la gate.
2. **209 `SAFE` par lecture**, non par comportement.
3. **Frontière `service_role` documentée, non éprouvée** — aucune fonction
   Edge en Test.
4. **Chaque aide nommée future rendra la garde aveugle** si elle ne lui est
   pas déclarée.

## Questions pour arbitrage

**Q55 — Fermer les deux `VULNERABLE (latentes)` ?** Recommandation : **oui,
avant l'activation bloquante**. Ajouter à `createur_update_sites` et
`createur_delete_sites` la condition `acces_createur_autorise = true`, pour
que la protection cesse d'être incidente. Le comportement observable ne
changerait pas — c'est bien le signe qu'on ne retire rien à personne.

**Q56 — Autoriser la dérogation `createur_insert_sites` ?** Recommandation :
**oui, mais c'est une gate humaine** : `autorise_par` doit nommer Frédéric.

**Q57 — Déclarer les aides nommées à la garde ?** Recommandation : **oui,
dans un registre versionné** à côté des dérogations. Sans cela, la garde
perdra en couverture à chaque refactorisation bien intentionnée.

## Action attendue de ChatGPT

Arbitrer Q55, Q56, Q57 pour le `LOT_ID`
**SITE-EXPLICITE-1-STATIC-GUARD-UNKNOWN-TRIAGE-20260906**. **Aucune
correction, aucune activation bloquante, aucune ouverture de la classe D
n'est demandée.**
