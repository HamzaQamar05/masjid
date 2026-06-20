# Ummah Connect WhatsApp sender

This internal service uses [`tulir/whatsmeow`](https://github.com/tulir/whatsmeow) as a linked WhatsApp Web device. It is intentionally separate from the public Node API so WhatsApp outages never prevent posts, events, programs, jobs, or push notifications.

## Required environment

- `WHATSAPP_SERVICE_TOKEN`: long random bearer token shared only with the Node backend.
- `WHATSAPP_DATABASE_URL`: optional separate PostgreSQL connection for the whatsmeow device store. When omitted, `DATABASE_URL` is used.
- `DATABASE_URL`: the app database used for delivery idempotency. If omitted, `WHATSAPP_DATABASE_URL` is used for both.
- `WHATSAPP_LISTEN_ADDR`: optional, defaults to `:8080`.
- `WHATSAPP_LOG_LEVEL`: optional, defaults to `INFO`.

## Pair the linked device

The Docker Compose port is bound to localhost only. After startup, request a pairing code:

```powershell
$headers = @{ Authorization = "Bearer $env:WHATSAPP_SERVICE_TOKEN" }
$body = @{ phone = "15551234567" } | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:8088/pair-code -Method Post -Headers $headers -ContentType application/json -Body $body
```

Enter the returned code in WhatsApp under **Linked devices → Link a device → Link with phone number**. The session is stored in PostgreSQL and reconnects after restarts.

## Security and reliability

- `/messages`, `/status`, and `/pair-code` require the shared bearer token.
- The service is not exposed publicly by the supplied Compose configuration.
- Every message requires an idempotency key stored in PostgreSQL.
- Recipient numbers are masked in logs.
- Failed sends return an error to the Node backend, which records the failure but does not fail the triggering app action.

whatsmeow is an unofficial implementation of the WhatsApp Web multidevice protocol. Operate it with a dedicated account and review WhatsApp's terms and account-risk implications before production use.
