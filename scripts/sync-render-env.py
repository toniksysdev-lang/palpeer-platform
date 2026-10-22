#!/usr/bin/env python3
"""One-shot sync of critical palpeer-api env vars on Render (no secret printing)."""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CLI_YAML = Path.home() / ".render" / "cli.yaml"
SERVICE_ID = "srv-db3ca6tg1s2s739rpof0"
PG_ID = "dpg-db3b06cs728c73btuss0-a"
KV_ID = "red-db3b06ijnfac7399b920"
API = "https://api.render.com/v1"


def load_api_key() -> str:
    text = CLI_YAML.read_text(encoding="utf-8")
    m = re.search(r"key:\s*(rnd_\w+)", text)
    if not m:
        raise SystemExit("Render API key not found in ~/.render/cli.yaml")
    return m.group(1)


def load_dotenv(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.exists():
        return out
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        if line.startswith("export "):
            line = line[7:].strip()
        k, _, v = line.partition("=")
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        out[k] = v
    return out


def api(method: str, path: str, key: str, body: object | None = None) -> object:
    data = None
    headers = {
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
    }
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(f"{API}{path}", data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw) if raw else None


def parse_pg(conn: dict) -> tuple[str, str, str, str, str]:
    internal = conn.get("internalConnectionString") or ""
    # postgresql://user:pass@host/db
    m = re.match(r"postgres(?:ql)?://([^:]+):([^@]+)@([^:/]+)(?::(\d+))?/([^?]+)", internal)
    if not m:
        raise SystemExit("Could not parse Postgres internal connection string")
    user, password, host, port, db = m.group(1), m.group(2), m.group(3), m.group(4) or "5432", m.group(5)
    if conn.get("password"):
        password = conn["password"]
    return host, port, db, user, password


def parse_redis(conn: dict) -> tuple[str, str, str, str]:
    internal = conn.get("internalConnectionString") or ""
    external = conn.get("externalConnectionString") or ""
    host, port = "localhost", "6379"
    password = ""
    m = re.match(r"rediss?://(?::([^@]*)@)?([^:/]+):(\d+)", internal)
    if m:
        password = m.group(1) or ""
        host, port = m.group(2), m.group(3)
    m2 = re.match(r"rediss?://(?::([^@]*)@)?([^:/]+):(\d+)", external)
    if m2 and m2.group(1):
        password = m2.group(1)
    # Internal Render KV is plain redis (no TLS)
    return host, port, password, "false"


def main() -> int:
    key = load_api_key()
    local = load_dotenv(ROOT / ".env")
    pg = api("GET", f"/postgres/{PG_ID}/connection-info", key)
    kv = api("GET", f"/key-value/{KV_ID}/connection-info", key)
    assert isinstance(pg, dict) and isinstance(kv, dict)

    db_host, db_port, db_name, db_user, db_password = parse_pg(pg)
    redis_host, redis_port, redis_password, redis_ssl = parse_redis(kv)

    env: dict[str, str] = {
        "SPRING_PROFILES_ACTIVE": "prod",
        "OTP_LOG_CODE": "true",
        "DB_HOST": db_host,
        "DB_PORT": db_port,
        "DB_NAME": db_name,
        "DB_USER": db_user,
        "DB_PASSWORD": db_password,
        "DB_SSLMODE": "require",
        "REDIS_HOST": redis_host,
        "REDIS_PORT": redis_port,
        "REDIS_SSL": redis_ssl,
        "CORS_ALLOWED_ORIGINS": "https://palpeer-admin.onrender.com",
        "KUDA_ENABLED": "true",
    }
    if redis_password:
        env["REDIS_PASSWORD"] = redis_password

    # Copy selected local keys when present
    copy_prefixes = (
        "KUDA_",
        "APAYLO_",
        "KORAPAY_",
        "PALPEER_",
        "ADMIN_BOOTSTRAP_",
        "JWT_",
        "GOOGLE_",
        "TELNYX_",
        "TWILIO_",
        "BULKSMS_",
    )
    for k, v in local.items():
        if any(k.startswith(p) for p in copy_prefixes) and v:
            env[k] = v
    env["KUDA_ENABLED"] = "true"

    payload = [{"key": k, "value": v} for k, v in sorted(env.items())]
    result = api("PUT", f"/services/{SERVICE_ID}/env-vars", key, payload)
    assert isinstance(result, list)

    # Redacted summary
    print(f"put_count={len(payload)} after_count={len(result)}")
    interesting = sorted(
        (item.get("key") or item.get("envVar", {}).get("key"))
        for item in result
    )
    print("keys=" + ",".join(interesting))
    for item in result:
        k = item.get("key") or item.get("envVar", {}).get("key")
        v = item.get("value")
        if v is None:
            v = item.get("envVar", {}).get("value")
        if k and k.startswith(("DB_", "REDIS_", "KUDA_", "CORS_", "JWT_", "SPRING_")):
            flag = "EMPTY" if not v else f"SET(len={len(str(v))})"
            print(f"{k}={flag}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
