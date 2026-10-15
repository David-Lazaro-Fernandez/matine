"""Cifrado de los secretos que guarda `app.db` (la clave del proveedor de IA de cada organización).

`kms` cifra directo con AWS KMS: una clave de proveedor cabe en los 4 KB que admite `Encrypt`, así que no hay clave de
datos que guardar. El contexto de cifrado lleva la organización: un texto cifrado copiado a otra organización no abre.
Cada uso queda en CloudTrail. `dev` solo codifica en base64 para trabajar sin AWS y no arranca con `AC_ENV=prod`.
Ejemplo: `decrypt(encrypt("sk-…", 1), 1)` → `"sk-…"`.
"""
import base64
import os

from scraper import config

_CONTEXT_KEY = "org_id"


def _context(org_id):
    return {_CONTEXT_KEY: str(org_id)}


def _kms():
    import boto3

    if not config.KMS_KEY_ID:
        raise ValueError("Falta AC_KMS_KEY_ID para cifrar con KMS.")
    return boto3.client("kms")


def _encrypt_kms(plaintext, org_id):
    blob = _kms().encrypt(KeyId=config.KMS_KEY_ID, Plaintext=plaintext.encode(), EncryptionContext=_context(org_id))
    return base64.b64encode(blob["CiphertextBlob"]).decode()


def _decrypt_kms(token, org_id):
    blob = _kms().decrypt(CiphertextBlob=base64.b64decode(token), EncryptionContext=_context(org_id))
    return blob["Plaintext"].decode()


def _encode_dev(plaintext, org_id):
    return base64.b64encode(plaintext.encode()).decode()


def _decode_dev(token, org_id):
    return base64.b64decode(token).decode()


_BACKENDS = {"kms": (_encrypt_kms, _decrypt_kms), "dev": (_encode_dev, _decode_dev)}


def _backend(index):
    if config.KEY_BACKEND not in _BACKENDS:
        raise ValueError(f"AC_KEY_BACKEND desconocido: {config.KEY_BACKEND!r} (kms | dev)")
    if config.KEY_BACKEND == "dev" and os.environ.get("AC_ENV") == "prod":
        raise ValueError("AC_KEY_BACKEND=dev no cifra: en prod usa kms.")
    return _BACKENDS[config.KEY_BACKEND][index]


def encrypt(plaintext, org_id):
    """Texto cifrado (base64) de `plaintext`, ligado a la organización."""
    return _backend(0)(plaintext, org_id)


def decrypt(token, org_id):
    """El texto en claro de `encrypt`; falla si la organización no es la misma."""
    return _backend(1)(token, org_id)
