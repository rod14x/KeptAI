# KeptAI — Cambios del DER en V10 (fuente editable)

Fecha: 11/10/2026. Fuente: BD/migrations/V10__contacto_whatsapp.sql, D-011. Conserva el [DER V9](keptai-der-v9.md) (láminas PNG vigentes de V1–V9); este documento solo describe la **diferencia** y su fuente Mermaid. La exportación a lámina PNG queda pendiente (no se alteró ningún diagrama existente).

```mermaid
erDiagram
  ORGANIZACION ||--o{ CLIENTE : tiene
  CLIENTE ||--o{ CONTACTO : "tiene (V10)"
  CONTACTO ||--o| CANAL_WHATSAPP : "contacto_id (V10)"
  CLIENTE ||--o{ CANAL_WHATSAPP : cliente_id
  CANAL_WHATSAPP ||--o{ ORDEN : "canal_id + cliente_id"
  CANAL_WHATSAPP ||--o{ PAGO : "canal_id + cliente_id (V10)"
  ORDEN ||--o{ PAGO : "orden_contexto_id (V10, contexto)"
  PAGO ||--o{ APLICACION_PAGO : "aplicación (verificada; no cambia en V10)"
  CONTACTO {
    uuid id PK
    uuid organizacion_id FK
    uuid cliente_id FK
    text nombre
    text whatsapp_jid "UNIQUE por organizacion; formato canonico"
    boolean activo
  }
```

Reglas: el contacto no es vendedor, ni organización, ni usuario de Auth. Las FK compuestas (organización, canal, cliente, jid) impiden asociaciones cruzadas. `pago.orden_contexto_id` no reemplaza a `aplicacion_pago`.
