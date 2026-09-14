#!/usr/bin/env python3
"""Pose un secret dans le Trousseau macOS sans qu'il quitte jamais la mémoire.

POURQUOI CE FICHIER PLUTÔT QU'UNE LIGNE `security add-generic-password -w …`.
Cette commande-là passe le secret en ARGUMENT DE PROCESSUS : le temps de son
exécution, il est lisible par tout processus de la machine via la table des
processus. Sans affichage, mais pas sans exposition.

Ici, le secret ne sort jamais de ce processus. Il est écrit dans le Trousseau
par l'API Security de macOS, appelée directement. Ni argument de processus, ni
variable d'environnement, ni presse-papiers, ni fichier temporaire, ni sortie
standard, ni journal.

CE QUI EST AFFICHÉ, et rien d'autre : le vérificateur SCRAM. Il ne permet pas
de se connecter — c'est une empreinte salée, éprouvée par
`outils/eprouver-verificateur-scram.py`.

  python3 outils/poser-secret-trousseau.py [--service nexus-prod-db-readonly]
"""
import argparse, ctypes, ctypes.util, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scram import verificateur, mot_de_passe_aleatoire

COMPTE_DEFAUT = 'nexus'
SERVICE_DEFAUT = 'nexus-prod-db-readonly'


def _securite():
    chemin = ctypes.util.find_library('Security')
    if not chemin:
        raise SystemExit('  Framework Security introuvable : rien n\'est écrit.')
    return ctypes.cdll.LoadLibrary(chemin)


def trouver(service: str, compte: str):
    """Rend True si une entrée existe déjà. Ne lit JAMAIS sa valeur."""
    sec = _securite()
    longueur = ctypes.c_uint32()
    donnees = ctypes.c_void_p()
    element = ctypes.c_void_p()
    statut = sec.SecKeychainFindGenericPassword(
        None, len(service), service.encode(), len(compte), compte.encode(),
        ctypes.byref(longueur), ctypes.byref(donnees), ctypes.byref(element))
    if statut == 0:
        # On libère immédiatement : la valeur ne doit pas rester en mémoire.
        sec.SecKeychainItemFreeContent(None, donnees)
        return True
    return False


def poser(service: str, compte: str, secret: str) -> None:
    sec = _securite()
    octets = secret.encode('utf-8')
    statut = sec.SecKeychainAddGenericPassword(
        None, len(service), service.encode(), len(compte), compte.encode(),
        len(octets), octets, None)
    if statut != 0:
        raise SystemExit('  Écriture au Trousseau refusée (statut %d). Rien n\'a été posé.' % statut)


def main() -> int:
    a = argparse.ArgumentParser()
    a.add_argument('--service', default=SERVICE_DEFAUT)
    a.add_argument('--compte', default=COMPTE_DEFAUT)
    a.add_argument('--remplacer', action='store_true',
                   help='autorise l\'écrasement d\'une entrée existante')
    o = a.parse_args()

    if trouver(o.service, o.compte):
        if not o.remplacer:
            print('  ARRÊT : l\'entrée « %s » existe déjà pour le compte « %s ».' % (o.service, o.compte))
            print('  Rien n\'a été écrit, et sa valeur n\'a pas été lue.')
            print('  Relancez avec --remplacer si vous voulez délibérément l\'écraser.')
            return 3
        print('  Entrée existante : elle sera remplacée, à votre demande explicite.')
        # Suppression par l'API, sans jamais lire l'ancienne valeur.
        sec = _securite()
        longueur = ctypes.c_uint32(); donnees = ctypes.c_void_p(); element = ctypes.c_void_p()
        if sec.SecKeychainFindGenericPassword(
                None, len(o.service), o.service.encode(), len(o.compte), o.compte.encode(),
                ctypes.byref(longueur), ctypes.byref(donnees), ctypes.byref(element)) == 0:
            sec.SecKeychainItemFreeContent(None, donnees)
            sec.SecKeychainItemDelete(element)

    secret = mot_de_passe_aleatoire()
    empreinte = verificateur(secret)
    poser(o.service, o.compte, secret)
    del secret   # la référence disparaît ; rien n'a été affiché ni écrit ailleurs

    print('  Secret posé dans le Trousseau : service « %s », compte « %s ».' % (o.service, o.compte))
    print('  Collez le vérificateur ci-dessous dans le SQL Editor, et lui seul :\n')
    print(empreinte)
    return 0


if __name__ == '__main__':
    sys.exit(main())
