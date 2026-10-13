"""Envíos a los canales del cliente: avisos de Slack tras cada captura y el resumen del lunes por correo.

Cada organización elige en `auth/orgs.py` qué recibe. Este paquete lee la base de análisis en solo lectura y guarda su
estado (cursor de avisos, semana enviada) con `auth/`, que es el único escritor de `app.db`. Lo corre el trabajo
`integrations` del registro.
"""
