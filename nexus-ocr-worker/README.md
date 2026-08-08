# NEXUS — Worker OCR local (à installer sur l'iMac)

Ce dossier contient le worker du moteur documentaire NEXUS en **Mode Local**
(V1) : il tourne sur l'iMac, utilise PaddleOCR + OCRmyPDF, et ne coûte rien
à héberger. Voir `NEXUS-Moteur-Documentaire-OCR-Note-Conception.md` (à la
racine du dossier projet) pour l'architecture complète.

## Important — pourquoi tu dois lancer ça toi-même

Ce dossier a été écrit dans ton dossier iCloud, donc il va se synchroniser
automatiquement vers ton iMac (comme le reste du dossier projet). Mais
l'installation elle-même (Homebrew, Python, démarrage automatique) doit être
faite **directement dans le Terminal de l'iMac** — je travaille depuis un
environnement isolé qui n'a pas la main sur ta machine physique.

## Étapes sur l'iMac

1. **Attendre la synchronisation iCloud** : ouvre le Finder sur l'iMac,
   vérifie que le dossier `nexus-ocr-worker` est bien apparu dans
   `projet NEXUS OS/Code Nexus/nexus/image nexus project/`.

2. **Ouvrir le Terminal** (Applications > Utilitaires > Terminal), puis :
   ```
   cd ~/Library/Mobile\ Documents/com~apple~CloudDocs/Desktop/projet\ NEXUS\ OS/Code\ Nexus/nexus/image\ nexus\ project/nexus-ocr-worker
   chmod +x install_mac.sh installer_demarrage_auto.sh
   ./install_mac.sh
   ```
   (adapte le chemin `cd` si ton dossier iCloud n'est pas exactement à cet
   emplacement — regarde dans le Finder pour le chemin exact, clic droit sur
   le dossier > "Copier … en tant que chemin d'accès").

3. **Récupérer la clé service_role Supabase** (une seule fois) :
   Dashboard Supabase → ton projet → *Project Settings* → *API* →
   section *Project API keys* → copie la clé **service_role** (pas la clé
   `anon`/publique, qui est déjà utilisée ailleurs dans NEXUS et n'a pas les
   mêmes droits).

   ⚠️ Cette clé donne un accès total à la base, sans passer par les règles de
   sécurité (RLS). Ne la mets jamais dans un fichier HTML, ni dans un
   dépôt partagé — uniquement dans le `.env` de ce dossier, sur l'iMac.

4. **Coller la clé** dans le fichier `.env` créé par `install_mac.sh`
   (ouvre-le avec TextEdit), puis relance `./install_mac.sh` si besoin.

5. **Tester manuellement** :
   ```
   source .venv/bin/activate
   python main.py
   ```
   Tu dois voir dans le Terminal : `Worker documentaire NEXUS démarré —
   mode=local moteur=local site=vito-sainte-marie`. Laisse tourner, arrête
   avec Ctrl+C une fois que tu as vérifié que ça démarre sans erreur.

6. **Démarrage automatique** (pour ne pas avoir à laisser le Terminal
   ouvert) :
   ```
   ./installer_demarrage_auto.sh
   ```
   Le worker démarrera désormais tout seul à chaque connexion sur l'iMac, et
   redémarrera automatiquement s'il plante. Le journal est dans
   `worker.log`, dans ce même dossier.

## Vérifier que ça fonctionne depuis NEXUS

Une fois le worker lancé, une ligne apparaît (ou se met à jour) dans la
table Supabase `moteur_documentaire_etat` toutes les ~30 secondes — c'est ce
battement de cœur que NEXUS lira plus tard pour afficher un avertissement si
l'iMac est éteint ou le worker arrêté (voir la note de conception, §7).

## Dossier surveillé (optionnel) — dépôt automatique

Si un scanner (ou n'importe quel appareil) dépose des fichiers dans un
dossier local de l'iMac, le worker peut les récupérer et les trier tout
seul, exactement comme si tu les avais glissés dans la Boîte de réception
de NEXUS.

Pour l'activer : ajoute dans `.env` (adapte le chemin) :
```
NEXUS_DOSSIER_SURVEILLE=/Users/fredericbragance/Desktop/SCANVITO
```
Puis relance le worker (`launchctl unload` puis `launchctl load`, voir
message affiché par `installer_demarrage_auto.sh`).

Un fichier traité avec succès est déplacé automatiquement dans un
sous-dossier `Traités` (créé tout seul) — il ne sera donc jamais réimporté
deux fois. Si la variable n'est pas définie, cette fonctionnalité reste
simplement désactivée, sans rien changer au reste du worker.

## Limite assumée du Mode Local

Le traitement des documents ne peut avoir lieu que si l'iMac est **allumé et
connecté à internet**. C'est la contrainte volontaire de la V1 (coût zéro) —
le passage en Mode Cloud (V2, Railway/Fly.io) lèvera cette limite plus tard,
sans qu'aucune table Supabase ni aucun écran NEXUS n'ait besoin de changer :
seul ce dossier serait redéployé ailleurs, avec `NEXUS_OCR_MODE=cloud`.

## Ce qui alimente déjà ce worker

Deux points d'entrée alimentent la file `documents_ocr_file` (mise à jour
07/08/2026) :
- L'écran "Boîte de réception" de NEXUS (dépôt manuel, glisser-déposer),
  disponible depuis Comptes Clients.
- Le dossier surveillé décrit ci-dessus (dépôt automatique), si activé.
