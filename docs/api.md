# API reference

Base URL: `http://localhost:8000` (dev) · Swagger: `/docs`

All payloads are JSON. Authenticated routes require `Authorization: Bearer <jwt>`.

## Auth

### `POST /api/auth/register` — 201
```json
{ "email": "alice@example.com", "password": "supersecret1", "full_name": "Alice" }
```
→ `{ "access_token": "...", "token_type": "bearer", "expires_in_minutes": 60 }`

### `POST /api/auth/login` — 200
```json
{ "email": "alice@example.com", "password": "supersecret1" }
```
→ same as register.

### `GET /api/auth/me` — 200 (auth)
→ `{ "id": "...", "email": "...", "full_name": "..." }`

## Credentials

### `POST /api/credentials/issue` — 201 (auth)
```json
{
  "credential_type": "AcademicCredential",
  "claims": {
    "name": "Sahaj Gaur",
    "degree": "B.Tech",
    "graduationYear": 2026,
    "cgpa": 9.1,
    "marks": 920
  }
}
```
→ Full credential including `merkle_root`, `signature`, `issuer_public_key`.

### `GET /api/credentials` — 200 (auth)
List the holder's credentials.

### `GET /api/credentials/{id}` — 200 (auth)
Single credential.

### `POST /api/credentials/share` — 201 (auth)
```json
{
  "credential_id": "<uuid>",
  "fields": ["name", "degree"],
  "expires_in_minutes": 15
}
```
→ `{ "share_token": "...", "share_url": "https://.../verify/...", "expires_at": "...", "revealed_fields": [...] }`

## Verification (public, rate-limited)

### `GET /api/credentials/share/{share_token}` — 200
Returns the full `Presentation` document.

### `POST /api/credentials/verify` — 200
Verify by token (preferred) or by inline presentation.

```json
{ "share_token": "abc123" }
```
or
```json
{ "presentation": { /* full presentation doc */ } }
```

→
```json
{
  "verified": true,
  "fields_verified": ["name", "degree"],
  "failure_reason": null,
  "issuer_name": "CyStar Demo Issuer",
  "issued_at": "...",
  "expires_at": "...",
  "revealed_claims": { "name": "...", "degree": "..." },
  "trust_score": 92
}
```

## Errors

All errors return `{"detail": "<human readable message>"}` with an appropriate
HTTP status:

- `400` — bad input (e.g. unknown claim field)
- `401` — missing or invalid bearer token
- `404` — resource not found / share token unknown
- `409` — email already registered
- `422` — Pydantic validation failure
- `429` — rate limit exceeded

## Rate limits

| Endpoint | Limit |
| --- | --- |
| `POST /api/auth/*` | 10 / minute / IP |
| `GET /api/credentials/share/{t}` | 30 / minute / IP |
| `POST /api/credentials/verify` | 30 / minute / IP |
