"""Integration tests covering the full HTTP surface."""
from __future__ import annotations


SAMPLE_CLAIMS = {
    "name": "Sahaj Gaur",
    "degree": "B.Tech Computer Science",
    "graduationYear": 2026,
    "cgpa": 9.1,
    "marks": 920,
    "issuer": "IIT Madras",
}


class TestAuth:
    def test_register_returns_token(self, client) -> None:
        r = client.post(
            "/api/auth/register",
            json={"email": "a@b.com", "password": "supersecret1", "full_name": "A B"},
        )
        assert r.status_code == 201
        body = r.json()
        assert body["access_token"]
        assert body["token_type"] == "bearer"

    def test_register_duplicate_rejected(self, client) -> None:
        payload = {"email": "a@b.com", "password": "supersecret1", "full_name": "A B"}
        client.post("/api/auth/register", json=payload)
        r = client.post("/api/auth/register", json=payload)
        assert r.status_code == 409

    def test_login_success(self, client) -> None:
        client.post(
            "/api/auth/register",
            json={"email": "a@b.com", "password": "supersecret1", "full_name": "A B"},
        )
        r = client.post("/api/auth/login", json={"email": "a@b.com", "password": "supersecret1"})
        assert r.status_code == 200

    def test_login_wrong_password(self, client) -> None:
        client.post(
            "/api/auth/register",
            json={"email": "a@b.com", "password": "supersecret1", "full_name": "A B"},
        )
        r = client.post("/api/auth/login", json={"email": "a@b.com", "password": "wrong-password"})
        assert r.status_code == 401

    def test_me_requires_auth(self, client) -> None:
        assert client.get("/api/auth/me").status_code == 401

    def test_me_with_token(self, client, auth_headers) -> None:
        r = client.get("/api/auth/me", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["email"] == "test@example.com"


class TestCredentials:
    def test_issue_credential(self, client, auth_headers) -> None:
        r = client.post(
            "/api/credentials/issue",
            headers=auth_headers,
            json={"claims": SAMPLE_CLAIMS},
        )
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["merkle_root"] and body["signature"]
        assert set(body["leaf_order"]) == set(SAMPLE_CLAIMS.keys())

    def test_list_credentials(self, client, auth_headers) -> None:
        client.post("/api/credentials/issue", headers=auth_headers, json={"claims": SAMPLE_CLAIMS})
        r = client.get("/api/credentials", headers=auth_headers)
        assert r.status_code == 200
        assert len(r.json()) == 1

    def test_issue_requires_auth(self, client) -> None:
        assert client.post("/api/credentials/issue", json={"claims": SAMPLE_CLAIMS}).status_code == 401

    def test_issue_rejects_empty_claims(self, client, auth_headers) -> None:
        r = client.post("/api/credentials/issue", headers=auth_headers, json={"claims": {}})
        assert r.status_code == 422


class TestSelectiveDisclosure:
    def _issue(self, client, headers) -> str:
        r = client.post("/api/credentials/issue", headers=headers, json={"claims": SAMPLE_CLAIMS})
        return r.json()["id"]

    def test_share_and_verify_roundtrip(self, client, auth_headers) -> None:
        cred_id = self._issue(client, auth_headers)
        r = client.post(
            "/api/credentials/share",
            headers=auth_headers,
            json={
                "credential_id": cred_id,
                "fields": ["name", "degree", "graduationYear"],
                "expires_in_minutes": 10,
            },
        )
        assert r.status_code == 201, r.text
        token = r.json()["share_token"]

        # Public verify (no auth)
        v = client.post("/api/credentials/verify", json={"share_token": token})
        assert v.status_code == 200
        body = v.json()
        assert body["verified"] is True
        assert set(body["fields_verified"]) == {"name", "degree", "graduationYear"}
        assert "cgpa" not in body["revealed_claims"]

    def test_verify_rejects_tampered_inline_presentation(self, client, auth_headers) -> None:
        cred_id = self._issue(client, auth_headers)
        share = client.post(
            "/api/credentials/share",
            headers=auth_headers,
            json={"credential_id": cred_id, "fields": ["cgpa"]},
        ).json()
        token = share["share_token"]

        # Fetch the presentation, tamper, send back via /verify.
        pres = client.get(f"/api/credentials/share/{token}").json()
        pres["revealed_claims"]["cgpa"] = 10.0
        r = client.post("/api/credentials/verify", json={"presentation": pres})
        assert r.status_code == 200
        assert r.json()["verified"] is False

    def test_share_unknown_field_rejected(self, client, auth_headers) -> None:
        cred_id = self._issue(client, auth_headers)
        r = client.post(
            "/api/credentials/share",
            headers=auth_headers,
            json={"credential_id": cred_id, "fields": ["does_not_exist"]},
        )
        assert r.status_code == 400

    def test_verify_unknown_token(self, client) -> None:
        r = client.post("/api/credentials/verify", json={"share_token": "nope"})
        assert r.status_code == 200
        assert r.json()["verified"] is False

    def test_other_user_cannot_share(self, client, auth_headers) -> None:
        cred_id = self._issue(client, auth_headers)
        # Register a second user.
        r = client.post(
            "/api/auth/register",
            json={"email": "other@example.com", "password": "supersecret1", "full_name": "Other"},
        )
        other_headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
        r = client.post(
            "/api/credentials/share",
            headers=other_headers,
            json={"credential_id": cred_id, "fields": ["name"]},
        )
        assert r.status_code == 400


class TestMeta:
    def test_health(self, client) -> None:
        assert client.get("/health").json() == {"status": "ok"}

    def test_root(self, client) -> None:
        assert client.get("/").status_code == 200

    def test_openapi(self, client) -> None:
        assert client.get("/openapi.json").status_code == 200
