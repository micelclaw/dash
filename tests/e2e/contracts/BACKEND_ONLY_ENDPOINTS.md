# Backend-Only Endpoints (246)

These are backend routes that have **no corresponding frontend API call** in the Dash codebase.
They are typically agent-only APIs, admin tools, internal services, or CLI endpoints.

Generated from `api-coverage.mjs` on 2026-03-26.

---

## admin (11)
- `GET /admin/crons`
- `GET /admin/provisions`
- `GET /admin/reindex/stream`
- `GET /admin/users/:id`
- `POST /admin/crons/:name/run`
- `POST /admin/provision-all`
- `POST /admin/provisions/:userId/retry`
- `POST /admin/provisions/reconcile`
- `POST /admin/reindex`
- `POST /admin/reindex-embeddings`
- `POST /admin/users/invite`

## agent-tokens (4)
- `DELETE /agent-tokens/:id`
- `GET /agent-tokens`
- `PATCH /agent-tokens/:id`
- `POST /agent-tokens`

## api-keys (4)
- `DELETE /admin/api-keys/:id`
- `GET /admin/api-keys`
- `GET /api-keys/mine`
- `POST /admin/api-keys`

## approvals (2)
- `GET /approvals/:id`
- `GET /approvals/history`

## apps (5)
- `GET /apps/clawhub-proxy/:skill_id`
- `GET /apps/registry`
- `GET /apps/registry/:name/versions`
- `POST /apps/registry/import`
- `POST /apps/scan-content`

## auth (10)
- `DELETE /auth/bindings/:id`
- `GET /auth/bindings`
- `GET /auth/me`
- `GET /auth/resolve`
- `PATCH /auth/me`
- `POST /auth/bind`
- `POST /auth/bind/code`
- `POST /auth/logout`
- `POST /auth/register`
- `POST /auth/reset-password`
- `POST /auth/setup`

## bookmarks (2)
- `GET /bookmarks/:id`
- `PATCH /bookmarks/:id/custom`

## browser-screenshots (1)
- `GET /browser-screenshots/:id/download`

## calendars (1)
- `PATCH /calendars/:id`

## canvas (1)
- `POST /canvas/push`

## clipboard (1)
- `POST /clipboard`

## connectors (2)
- `GET /sync/duplicates`
- `POST /sync/duplicates/dismiss`

## contacts (1)
- `PATCH /contacts/:id/custom`

## context (5)
- `GET /context/activity`
- `GET /context/insights`
- `GET /context/relational`
- `GET /context/summary`
- `GET /context/temporal`

## conversations (3)
- `GET /conversations`
- `GET /conversations/:id`
- `GET /conversations/stats`

## crypto (11)
- `GET /crypto/btc/info`
- `GET /crypto/btc/status`
- `GET /crypto/btcpay/wallet`
- `GET /crypto/btcpay/wallet/status`
- `GET /crypto/dependencies`
- `GET /crypto/electrs/config`
- `GET /crypto/lightning/channels/apy`
- `GET /crypto/lightning/status`
- `GET /crypto/monero/status`
- `POST /crypto/:service/stop`
- `PUT /crypto/electrs/config`

## diagrams (1)
- `POST /diagrams/:fileId/extract`

## diary (4)
- `GET /diary/:id`
- `GET /diary/stats`
- `PATCH /diary/:id/custom`
- `POST /diary/date/:date/append`

## digest (4)
- `GET /digest/pending`
- `POST /digest/debug-seed`
- `POST /digest/mark-read`
- `POST /digest/trigger`

## dns (2)
- `GET /dns/local-domains/ca-certificate`
- `GET /dns/zones/:id`

## email-accounts (2)
- `GET /email-accounts/:id/folders`
- `POST /email-accounts/:id/test`

## emails (5)
- `PATCH /emails/:id/custom`
- `POST /emails`
- `POST /emails/:id/send`
- `POST /emails/:id/star`
- `POST /emails/:id/unstar`

## energy (8)
- `GET /hal/energy/policies`
- `POST /hal/core/restart`
- `POST /hal/core/shutdown`
- `POST /hal/energy/hibernate`
- `POST /hal/energy/reboot`
- `POST /hal/energy/shutdown`
- `POST /hal/energy/suspend`
- `PUT /hal/energy/policies/:id`

## events (2)
- `GET /events/:id`
- `PATCH /events/:id/custom`

## exec-approvals (2)
- `GET /exec-approvals/classify`
- `POST /exec-approvals/:id/resolve`

## feeds (9)
- `DELETE /feeds/categories/:id`
- `GET /feeds/:id`
- `GET /feeds/articles/:id`
- `PATCH /feeds/:id`
- `PATCH /feeds/articles/:id/read`
- `PATCH /feeds/articles/:id/unread`
- `PATCH /feeds/categories/:id`
- `PATCH /feeds/categories/:id/reorder`
- `POST /feeds/categories`

## files (19)
- `DELETE /files/:id/versions`
- `DELETE /files/:id/versions/:snapshot_id`
- `DELETE /files/share/:token`
- `GET /files/:id/archive-contents`
- `GET /files/:id/preview`
- `GET /files/:id/shares`
- `GET /files/:id/stream`
- `GET /files/:id/versions`
- `GET /files/:id/versions/:snapshot_id/download`
- `GET /files/duplicates`
- `GET /files/share/:token/qr`
- `GET /files/snapshots/stats`
- `GET /files/stats`
- `PATCH /files/:id/custom`
- `POST /files/:id/restore`
- `POST /files/:id/versions`
- `POST /files/:id/versions/:snapshot_id/restore`
- `POST /files/index`
- `PUT /files/:id/content`

## finance (1)
- `POST /finance/:app/uninstall`

## firewall (4)
- `GET /hal/firewall/services`
- `POST /hal/firewall/disable`
- `POST /hal/firewall/enable`
- `PUT /hal/firewall/services/:name`

## graph (1)
- `GET /graph/connections`

## health (1)
- `GET /health`

## insights (2)
- `GET /insights`
- `POST /insights/:id/feedback`

## lifecycle (3)
- `GET /services/:name`
- `GET /services/:name/activity`
- `PUT /system/profile`

## mail-server (7)
- `GET /mail/server/dkim/:domain`
- `GET /mail/server/relayed-domains/:name`
- `PATCH /mail/server/aliases/:alias`
- `POST /mail/server/provision`
- `POST /mail/server/sync-accounts`
- `PUT /mail/server/domains/:domain`
- `PUT /mail/server/users/:email`

## managed-agents (2)
- `DELETE /managed-agents/:id`
- `PATCH /internal/agent-profile`

## mariadb (5)
- `DELETE /mariadb/databases/:name`
- `GET /mariadb/databases`
- `GET /mariadb/status`
- `POST /mariadb/databases`
- `POST /mariadb/start`

## media (3)
- `DELETE /media/downloads/:id`
- `GET /media/downloads/:id`
- `POST /media/url-info`

## meetings (3)
- `DELETE /meetings/:id`
- `GET /meetings/:id`
- `PATCH /meetings/:id`

## messages (2)
- `DELETE /messages`
- `GET /messages/:id`

## multimedia (3)
- `POST /multimedia/:app/stop`
- `POST /multimedia/init-dirs`
- `POST /multimedia/setup`

## network (5)
- `GET /hal/network/proxy/hosts/:id`
- `GET /hal/network/ssl/status`
- `POST /hal/network/tailscale/generate-cert`
- `POST /hal/network/vpn/disable`
- `POST /hal/network/vpn/enable`

## notes (1)
- `PATCH /notes/:id/custom`

## oauth (1)
- `DELETE /sync/oauth/:provider`

## office (13)
- `GET /office/files/:fileId/download`
- `GET /office/plugins/micelclaw-bridge/*`
- `POST /office/execute`
- `POST /office/files/:fileId/callback`
- `POST /office/generate`
- `POST /office/pdf/compress`
- `POST /office/pdf/convert`
- `POST /office/pdf/merge`
- `POST /office/pdf/ocr`
- `POST /office/pdf/rotate`
- `POST /office/pdf/split`
- `POST /office/pdf/watermark`
- `POST /office/stop/:service`

## photos (8)
- `GET /albums/:id`
- `GET /albums/:id/export`
- `GET /albums/:id/shares`
- `GET /photos/faces/:clusterId/crop`
- `GET /photos/stats`
- `PATCH /albums/:id/photos/reorder`
- `POST /albums/:id/restore`
- `POST /photos/scan`

## portainer (1)
- `POST /portainer/stop`

## preferences (2)
- `DELETE /preferences/:id`
- `GET /preferences`

## projects (27)
- `DELETE /projects/boards/:boardId/cards/:cardId/checklists/:id`
- `DELETE /projects/boards/:boardId/cards/:cardId/comments/:id`
- `DELETE /projects/boards/:boardId/dependencies/:id`
- `DELETE /projects/templates/:id`
- `GET /projects/boards/:boardId/cards`
- `GET /projects/boards/:boardId/cards/:cardId/checklists`
- `GET /projects/boards/:boardId/cards/:cardId/dependencies`
- `GET /projects/boards/:boardId/cards/:cardId/subtasks`
- `GET /projects/boards/:boardId/cards/:id`
- `GET /projects/boards/:boardId/cards/archived`
- `GET /projects/boards/:boardId/custom-fields`
- `GET /projects/boards/:boardId/export`
- `GET /projects/boards/:boardId/labels`
- `GET /projects/templates`
- `GET /projects/templates/:id`
- `PATCH /projects/boards/:boardId/cards/:cardId/checklists/:id`
- `PATCH /projects/boards/:boardId/cards/:cardId/checklists/reorder`
- `PATCH /projects/boards/:boardId/cards/:cardId/comments/:id`
- `PATCH /projects/boards/:boardId/cards/:id/reorder`
- `PATCH /projects/boards/:id/reorder`
- `POST /projects/boards/:boardId/cards/:cardId/checklists`
- `POST /projects/boards/:boardId/cards/:cardId/subtasks`
- `POST /projects/boards/:boardId/cards/:cardId/unarchive`
- `POST /projects/boards/:boardId/dependencies`
- `POST /projects/boards/:boardId/save-as-template`
- `POST /projects/boards/import`
- `POST /projects/templates`

## sensor-fusion (1)
- `GET /sensor-fusion/rules/:id/log`

## shares (4)
- `DELETE /shares/:id`
- `GET /shares/by-me`
- `GET /shares/with-me`
- `PATCH /shares/:id`

## signal-cli / simplex-chat (5)
- `GET /simplex-chat/contacts`
- `GET /simplex-chat/groups`
- `GET /simplex-chat/profile`
- `POST /signal-cli/stop`
- `POST /simplex-chat/stop`

## status (1)
- `GET /hal/status`

## storage (2)
- `DELETE /hal/storage/volumes/:id`
- `POST /hal/storage/volumes`

## terminal (2)
- `GET /terminal/sessions`
- `PATCH /terminal/snippets/:id`

## vfs (4)
- `GET /vfs/read`
- `GET /vfs/search`
- `GET /vfs/stat`
- `PUT /vfs/write`

## voice (8)
- `GET /voice/catalog`
- `GET /voice/config`
- `GET /voice/status`
- `GET /voice/voices`
- `POST /voice/stt`
- `POST /voice/tts`
- `POST /voice/tts/stream`
- `PUT /voice/config`

## web-search (1)
- `POST /web-search`
