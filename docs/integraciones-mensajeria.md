# Integraciones de mensajería: hallazgos

Estado: investigación, sin implementar. Fecha: 2026-10-12.

## Alcance

- **Esta iteración:** Slack y correo (Gmail).
- **Después:** Microsoft Teams. Hoy no sabemos qué usa cada cliente, así que se decide por cliente cuando haga falta.
- **Qué se sirve:** el aviso de cambios de la competencia y el resumen semanal de hallazgos.

## Idea central

El contenido sale de un modelo neutral, no del formato de una plataforma:

1. Una función arma el resumen: título, periodo, plaza y hallazgos (etiqueta, acción, contexto, gráfica y enlace "Ver más").
2. Un renderer por formato lo convierte: `markdown`, `slack` (mrkdwn y bloques), `teams` (Adaptive Card) y `html`/texto para correo.
3. Cada organización guarda su destino y su plataforma. Ya no hace falta una variable de entorno para elegir el webhook.

La presentación vive en `integrations/`. `analytics/` no conoce formatos.

Los comandos entrantes son otro caso: cada plataforma manda su propia petición y firma. Ahí sí va un endpoint por plataforma.

## Slack

- Webhook entrante por organización. Se guarda en `organization.integrations`.
- Formato: mrkdwn, no Markdown. Negrita con `*texto*` y enlace con `<url|texto>`.
- Ya funciona: el aviso semanal y los cambios de la competencia salen por webhook (`integrations/slack.py`).
- Pendiente para comandos: verificar la firma de cada petición con el *signing secret* de la app. Cada entorno tiene su propia app.

## Gmail (correo)

- No hay webhook ni API de Slack que usar. El canal es el correo.
- Hoy el resumen sale por SES (`AC_MAIL_BACKEND=ses`, `auth/mail.py`) con parte HTML y parte de texto.
- El HTML usa estilos en línea, que Gmail respeta mejor que un bloque `<style>`.
- Verificado el 2026-10-12 con capturas del correo recibido: las gráficas de barras, las cifras y los textos se ven bien.
- Observado: los nombres largos de funciones se cortan con `…` en las etiquetas de las gráficas.

## Microsoft Teams (para después)

Fuentes: [Create an Incoming Webhook](https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook), [Send messages in Teams using incoming webhooks](https://support.microsoft.com/en-us/teams/apps-service/create-incoming-webhooks-with-workflows-for-microsoft-teams), [retiro de conectores de Microsoft 365](https://devblogs.microsoft.com/microsoft365dev/retirement-of-office-365-connectors-within-microsoft-teams/).

- **Conectores retirados.** Los webhooks de Office 365 Connectors están en retiro. Lo vigente son los flujos de Workflows (Power Automate).
- **Configuración.** En el canal: `…` → Workflows → plantilla **Send webhook alerts to a channel** → guardar → copiar la URL.
- **Formato del cuerpo:**

  ```json
  {"type": "message", "attachments": [{"contentType": "application/vnd.microsoft.card.adaptive",
    "content": {"$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                "type": "AdaptiveCard", "version": "1.2", "body": [...]}}]}
  ```

  La versión `1.2` es la que aparece en los ejemplos oficiales.
- **Límites.** 28 KB por mensaje. Más de 4 peticiones por segundo se limitan (429).
- **Texto.** Markdown básico en los campos de texto. No se usa HTML.
- **Dueño del flujo.** Un flujo pertenece a una persona. Si sale de la organización, queda huérfano. Hay que pedir un co-dueño al admin del cliente.
- **Canales privados.** Publicar como bot de flujo en canales privados no está disponible todavía. Hoy el mensaje sale en nombre de un usuario.
- **Código de respuesta.** La documentación no lo especifica. No asumir 202; probarlo con un flujo real.
- **Pendiente:** una URL de flujo de prueba en un canal de Teams para verificar el envío.

## Pendientes

- [ ] Modelo neutral del resumen y renderers `markdown`, `slack` y `html`/texto.
- [ ] Reemplazar `slack_webhook` por un destino genérico con plataforma (`slack` o `teams`).
- [x] Verificar el correo en Gmail con un envío real.
- [ ] Revisar el corte con `…` de los nombres largos en las gráficas del correo.
- [ ] Teams: flujo de prueba, verificar código de respuesta y renderer.
- [ ] Comandos de Slack: endpoint, verificación de firma, y una app por entorno.
