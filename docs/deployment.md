# Deployment

## Backend → Render

1. Create a new **Web Service** from the `cystar` repo, root directory `backend/`.
2. **Build command:** `pip install -r requirements.txt`
3. **Start command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. **Environment variables:**

   ```
   APP_ENV=production
   JWT_SECRET_KEY=<generate with: python -c "import secrets; print(secrets.token_urlsafe(32))">
   ISSUER_SIGNING_KEY=<generate with: python -c "from nacl.signing import SigningKey; print(SigningKey.generate().encode().hex())">
   ISSUER_PUBLIC_KEY=<derived from the signing key>
   DATABASE_URL=sqlite:////var/data/cystar.db
   CORS_ORIGINS=https://<your-vercel-url>
   PUBLIC_FRONTEND_URL=https://<your-vercel-url>
   ```

5. Add a **Persistent Disk** mounted at `/var/data` (1 GB is plenty).

## Frontend → Vercel

1. Import the repo, root directory `frontend/`.
2. Framework: **Next.js** (auto-detected).
3. **Environment variables:**

   ```
   NEXT_PUBLIC_API_URL=https://<your-render-backend-url>
   ```

4. Deploy. After the first deploy, update `CORS_ORIGINS` on the backend to
   include the Vercel URL.

## Issuer key generation

```python
from nacl.signing import SigningKey
sk = SigningKey.generate()
print("ISSUER_SIGNING_KEY=", sk.encode().hex())
print("ISSUER_PUBLIC_KEY=",  sk.verify_key.encode().hex())
```

Treat the signing key like a TLS private key. In production it should live
in a secrets manager or HSM, never in plaintext env vars.
