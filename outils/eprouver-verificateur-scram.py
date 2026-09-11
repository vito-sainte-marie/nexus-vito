#!/usr/bin/env python3
"""Le vérificateur SCRAM que nous calculons est-il accepté par PostgreSQL ?

POURQUOI CETTE ÉPREUVE EXISTE. La procédure de pose du secret n'envoie jamais
le mot de passe : elle envoie son empreinte. Si le calcul de cette empreinte
était faux, le rôle recevrait un mot de passe que personne ne connaît, et
l'échec n'apparaîtrait qu'à la première connexion — loin de sa cause.

CE QU'ELLE FAIT, sur TEST uniquement :
  1. tire un mot de passe aléatoire, en mémoire ;
  2. en calcule le vérificateur avec outils/scram.py, le MÊME module que la
     pose réelle ;
  3. crée un rôle jetable avec ce vérificateur ;
  4. s'y connecte avec le mot de passe en clair — c'est la preuve ;
  5. vérifie qu'un mot de passe FAUX est bien refusé ;
  6. supprime le rôle, toujours.

Le mot de passe n'est jamais affiché, jamais écrit sur disque, jamais mis dans
un argument de processus. Il ne vit qu'en mémoire et dans l'environnement du
sous-processus psql, le temps d'un appel.

  NEXUS_TEST_DB_URL=… python3 outils/eprouver-verificateur-scram.py
"""
import os, subprocess, sys, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scram import verificateur, mot_de_passe_aleatoire

ROLE = 'nexus_scram_sonde'


def psql(url, sql, mot_de_passe=None):
    env = dict(os.environ)
    if mot_de_passe is not None:
        env['PGPASSWORD'] = mot_de_passe
    return subprocess.run(['psql', url, '--quiet', '--no-psqlrc', '-tA',
                           '-v', 'ON_ERROR_STOP=1', '-c', sql],
                          capture_output=True, text=True, env=env, timeout=60)


def main():
    url = os.environ.get('NEXUS_TEST_DB_URL')
    if not url:
        print('  NEXUS_TEST_DB_URL manquante.'); return 2
    mdp = mot_de_passe_aleatoire()
    verif = verificateur(mdp)
    echecs = []

    psql(url, "drop role if exists %s;" % ROLE)
    r = psql(url, "create role %s login password '%s';" % (ROLE, verif))
    if r.returncode != 0:
        print('  PostgreSQL a REFUSÉ le vérificateur :', r.stderr.strip().splitlines()[0]); return 1
    print('  vérificateur accepté par PostgreSQL à la création du rôle.')

    # La preuve : se connecter avec le mot de passe en clair.
    # Le pooler Supabase exige le tenant DANS le nom d'utilisateur
    # (`role.projectref`). Sans lui : « no tenant identifier provided », qu'on
    # prendrait a tort pour un mauvais mot de passe — le piege que le depot
    # documente deja pour l'hote du pooler. On reprend donc le suffixe de
    # l'utilisateur d'origine quand il y en a un.
    parts = urllib.parse.urlsplit(url)
    hote = parts.hostname; port = parts.port or 5432; base = (parts.path or '/postgres').lstrip('/')
    utilisateur = ROLE
    if parts.username and '.' in parts.username:
        utilisateur = ROLE + '.' + parts.username.split('.', 1)[1]
    url_sonde = 'postgresql://%s@%s:%d/%s?sslmode=require' % (utilisateur, hote, port, base)
    print('  connexion de sonde via', 'le pooler (tenant repris)' if utilisateur != ROLE else 'l hote direct')

    r = psql(url_sonde, 'select 1;', mot_de_passe=mdp)
    if r.returncode == 0 and r.stdout.strip() == '1':
        print('  connexion RÉUSSIE avec le mot de passe correspondant : le calcul est juste.')
    else:
        echecs.append('la connexion avec le bon mot de passe a échoué : ' +
                      (r.stderr.strip().splitlines() or ['(sans message)'])[0])

    r = psql(url_sonde, 'select 1;', mot_de_passe=mdp + 'x')
    if r.returncode != 0:
        print('  connexion REFUSÉE avec un mot de passe faux : le témoin négatif mord.')
    else:
        echecs.append('un mot de passe FAUX a été accepté : cette épreuve ne prouve rien')

    psql(url, 'drop role if exists %s;' % ROLE)
    reste = psql(url, "select count(*) from pg_roles where rolname='%s';" % ROLE)
    print('  rôle jetable supprimé :', 'oui' if reste.stdout.strip() == '0' else 'NON')

    if echecs:
        print('\n  ÉCHECS :'); [print('   ·', e) for e in echecs]; return 1
    print('\n  Le vérificateur produit est accepté, et lui seul.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
