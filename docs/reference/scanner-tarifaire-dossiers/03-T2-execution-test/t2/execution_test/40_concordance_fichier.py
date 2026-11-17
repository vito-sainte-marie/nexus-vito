# Preuve reproductible côté fichiers : python3 40_concordance_fichier.py (depuis le dossier execution_test).
# Montre que le fichier gelé de la migration 4 est exactement le texte exécuté suivi d'un octet 0x0A, sans autre différence.
import hashlib, pathlib
M = pathlib.Path(__file__).resolve().parent.parent / 'migrations'
STOCKE = {'20261118100000_tarif_registres.sql': '4ab17baa5eafc80c1c4331375dc38c67040dc550e442fe0498941ec0994f70dc',
          '20261118100100_tarif_registres_controles_rls.sql': '47bca01a763a0664a214b0a85a4f97a822c30ac3efb7a917838c6043aa2204c5',
          '20261118100200_tarif_registres_vues.sql': '24170b86d22b132d10f178feeafb2fdbbd06f74d493272e6fe231df4ee63f8b2',
          '20261118100300_tarif_registres_comptes_desactives.sql': '51548d17da845b1b708719f0f4106d817c41ca0e24018f831ce40b427204cd5e'}
for nom, h in STOCKE.items():
    b = (M / nom).read_bytes()
    exact = hashlib.sha256(b).hexdigest() == h
    moins_un = b.endswith(b'\n\n') and hashlib.sha256(b[:-1]).hexdigest() == h
    print(f"{nom} : {'identique' if exact else 'identique à un octet 0x0A final près' if moins_un else 'DIFFÉRENT'} (fin {b[-2:].hex()})")
