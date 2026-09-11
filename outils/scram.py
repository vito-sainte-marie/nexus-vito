"""Verificateur SCRAM-SHA-256, tel que PostgreSQL l'attend.

Sert deux fichiers : celui qui EPROUVE le calcul contre un role jetable de
Test, et celui qui pose le secret au trousseau. Un seul endroit ou le calcul
existe, pour qu'on ne puisse pas eprouver une formule et en poser une autre.
"""
import base64, hashlib, hmac, secrets


def verificateur(mot_de_passe: str, iterations: int = 4096, sel: bytes = None) -> str:
    """Rend la chaine 'SCRAM-SHA-256$<it>:<sel>$<StoredKey>:<ServerKey>'."""
    sel = sel or secrets.token_bytes(16)
    cle_salee = hashlib.pbkdf2_hmac('sha256', mot_de_passe.encode('utf-8'), sel, iterations)
    cle_client = hmac.new(cle_salee, b'Client Key', hashlib.sha256).digest()
    cle_serveur = hmac.new(cle_salee, b'Server Key', hashlib.sha256).digest()
    return 'SCRAM-SHA-256$%d:%s$%s:%s' % (
        iterations,
        base64.b64encode(sel).decode('ascii'),
        base64.b64encode(hashlib.sha256(cle_client).digest()).decode('ascii'),
        base64.b64encode(cle_serveur).decode('ascii'),
    )


def mot_de_passe_aleatoire(octets: int = 32) -> str:
    return secrets.token_urlsafe(octets)
