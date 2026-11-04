# Service de lecture des photos de jaugeage (iMac, Apple Vision)

Ce service lit les photos d'écran Veeder-Root (TLS4B) déposées par l'écran
Relevés Piste et écrit, pour chaque photo, une **proposition** de volumes par
cuve. Il est **séparé du worker des bons** (`com.nexus.ocr-worker`) : il ne
traite que les documents de type `jaugeage_veeder_root`.

Ce dépôt est public : il ne contient ni clé, ni `.env`, ni photo réelle.

## Ce qu'il fait

1. Cherche dans `documents_ocr_file` les lignes `status = 'en_attente'`,
   `type_document = 'jaugeage_veeder_root'`, du site configuré (8 s entre deux
   passages, 3 documents au plus par passage).
2. Réserve la ligne (`en_attente` → `en_cours`, seulement si personne ne l'a prise).
3. Télécharge la photo du bucket `documents-a-traiter` et la lit avec
   `lecteur-vision` (Apple Vision, local, aucun envoi réseau).
4. Traduit la lecture avec `lecture_jaugeage.py` : cinq valeurs par cuve, format
   de l'écran, bornes de vraisemblance, volume + espace vide égal à la
   contenance de référence (`reference_cuves.json`, ± 1 L), volume du dessin égal
   à celui du tableau. Un titre « RESERVOIR n » illisible est reconstitué d'après
   la disposition fixe de l'écran, uniquement si la cuve a une somme de
   référence : le contrôle exact volume + espace vide protège du mauvais
   rattachement.
5. Écrit `status = 'traite'` (ou `'erreur'`), `resultat_json` (lecture complète
   et contrôles) et `resultat_texte` (texte lu par `nexus-veeder-root.js`).
   Seule une cuve dont **tous** les contrôles passent porte un volume ; les
   autres s'affichent « illisible » et le pompiste saisit à la main.

**Il n'écrit rien dans Carburants.** Le pompiste voit la lecture proposée, la
reprend ou la corrige, et confirme lui-même.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `lecteur.swift` | Lecteur Apple Vision : `./lecteur-vision <photo>` affiche les lignes lues en JSON. |
| `lecture_jaugeage.py` | Traduction des lignes en volumes par cuve, avec contrôles. `python3 lecture_jaugeage.py <photo>` ou `--json <fichier>`. |
| `jaugeage_service.py` | Boucle du service (Supabase). |
| `reference_cuves.json` | Volume + espace vide attendu par cuve, en litres. |

## Installation (iMac, macOS)

```bash
cd nexus-ocr-worker/jaugeage
swiftc -O lecteur.swift -o lecteur-vision
```

Le binaire `lecteur-vision` doit être **à côté** des scripts Python. Il n'est pas versionné.

Le service utilise l'environnement Python du worker des bons
(`~/.nexus-ocr-worker-venv`), qui contient le paquet `supabase`.

## Configuration : le fichier `.env`

Le service lit `.env` **dans son propre dossier** (à côté de `jaugeage_service.py`).
Ce fichier n'est pas versionné. Variables attendues, **sans valeurs ici** :

```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
NEXUS_SITE=
```

- `SUPABASE_URL` : URL du projet visé.
- `SUPABASE_SERVICE_KEY` : clé de service de ce projet. Elle n'est jamais affichée ni journalisée.
- `NEXUS_SITE` : identifiant du site dont le service lit les documents.
- `NEXUS_JAUGEAGE_PRODUCTION` : facultative, voir ci-dessous.

## Refus de démarrer sur Production

Si `SUPABASE_URL` vise la base de Production, le service **refuse de démarrer**
tant que `NEXUS_JAUGEAGE_PRODUCTION=oui` n'est pas posé. Cette valeur n'est
posée que sur décision de Frédéric. Sur Test, ne la posez pas.

## Lancement

```bash
~/.nexus-ocr-worker-venv/bin/python jaugeage_service.py
```

`--une-fois` traite ce qui attend puis s'arrête. Le journal est écrit dans
`jaugeage.log` (non versionné). Aucun démarrage automatique n'est installé.

## Épreuve

`test_jaugeage_service_resultat_texte_20261104.js` (à la racine du dépôt) fabrique
des lectures Vision synthétiques, les passe dans `lecture_jaugeage.py` et
`texte_pour_releves_piste`, puis vérifie que `nexus-veeder-root.js` lit le texte
produit. Elle contrôle aussi que ce dossier ne contient ni secret, ni photo, ni `.env`.
