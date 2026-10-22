"""PIX / Mercado Pago integration backend tests (Padaria do Brunão)."""
import base64
import os
import re
import subprocess
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://brunao-orders.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "Padariadobruno04@gmail.com"
ADMIN_PASS = "brunao2026"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, r.text
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok
    return tok


@pytest.fixture(scope="module")
def customer_token():
    email = f"TEST_pix_{uuid.uuid4().hex[:8]}@teste.com"
    r = requests.post(
        f"{API}/auth/register",
        json={"email": email, "password": "test1234", "name": "PIX Tester", "phone": "11999990000"},
        timeout=30,
    )
    assert r.status_code in (200, 201), r.text
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture(scope="module")
def product_id(admin_token):
    AH = {"Authorization": f"Bearer {admin_token}"}
    # ensure category exists
    r = requests.post(f"{API}/admin/categories", json={"name": "PIX_TEST"}, headers=AH, timeout=30)
    assert r.status_code in (200, 201, 400, 409), r.text
    if r.status_code in (200, 201):
        cat_id = r.json().get("id")
    else:
        cats = requests.get(f"{API}/categories", timeout=30).json()
        cat_id = cats[0]["id"]
    r = requests.post(
        f"{API}/admin/products",
        json={
            "name": "TEST_PIX_Product",
            "price": 10.0,
            "unit": "un",
            "stock": 500,
            "category_id": cat_id,
            "active": True,
        },
        headers=AH,
        timeout=30,
    )
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


# ---- 1. Integration status ----
def test_integrations_status_mp_configured(admin_token):
    r = requests.get(f"{API}/integrations/status", headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    mp = data.get("mercadopago") or {}
    assert mp.get("configured") is True, f"MP not configured: {data}"
    assert mp.get("webhook_url"), f"webhook_url missing: {data}"


# ---- 2. PIX order creates MP charge with valid QR ----
def test_create_pix_order_returns_valid_qr(customer_token, product_id):
    payload = {
        "items": [{"product_id": product_id, "quantity": 2}],
        "delivery_type": "pickup",
        "payment_method": "pix",
        "notes": "TEST pix order",
    }
    r = requests.post(
        f"{API}/orders", json=payload, headers={"Authorization": f"Bearer {customer_token}"}, timeout=60
    )
    assert r.status_code in (200, 201), r.text
    order = r.json()
    assert str(order.get("order_number")).lstrip("0").isdigit()
    assert order.get("payment_status") == "pending"
    pix = order.get("pix_info") or {}
    assert pix.get("provider_configured") is True, pix
    assert pix.get("provider") == "mercadopago", pix
    mp_pid = pix.get("mp_payment_id")
    assert isinstance(mp_pid, int) and mp_pid > 0, f"mp_payment_id not int: {mp_pid}"
    qr = pix.get("qr_code") or ""
    assert isinstance(qr, str) and qr.startswith("00020126"), f"qr_code bad prefix: {qr[:40]}"
    qr64 = pix.get("qr_code_base64") or ""
    assert isinstance(qr64, str) and len(qr64) > 1000, f"qr_code_base64 too short: {len(qr64)}"
    decoded = base64.b64decode(qr64)
    assert decoded[:4] == b"\x89PNG", f"not a PNG: {decoded[:8]!r}"
    ticket = pix.get("ticket_url") or ""
    assert "mercadopago" in ticket.lower() or "mercadolibre" in ticket.lower() or ticket.startswith("http"), ticket


# ---- 3. Non-PIX orders don't call MP ----
@pytest.mark.parametrize("method", ["dinheiro", "cartao"])
def test_non_pix_orders_no_pix_info(customer_token, product_id, method):
    payload = {
        "items": [{"product_id": product_id, "quantity": 2}],
        "delivery_type": "pickup",
        "payment_method": method,
    }
    r = requests.post(
        f"{API}/orders", json=payload, headers={"Authorization": f"Bearer {customer_token}"}, timeout=30
    )
    assert r.status_code in (200, 201), r.text
    pix = r.json().get("pix_info")
    assert pix in (None, {}), f"pix_info should be null for {method}: {pix}"


# ---- 4. Webhook rejects invalid signature ----
def test_webhook_rejects_invalid_signature():
    r = requests.post(
        f"{API}/webhook/mercadopago",
        json={"type": "payment", "data": {"id": 1}},
        headers={"x-signature": "ts=1,v1=deadbeef", "x-request-id": "test"},
        timeout=30,
    )
    assert r.status_code in (401, 403), f"expected 401, got {r.status_code}: {r.text}"


def test_webhook_rejects_missing_signature():
    r = requests.post(f"{API}/webhook/mercadopago", json={"type": "payment", "data": {"id": 1}}, timeout=30)
    assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"


# ---- 5. No token leakage in API responses ----
def test_no_token_leakage_in_responses(admin_token, customer_token, product_id):
    AH = {"Authorization": f"Bearer {admin_token}"}
    CH = {"Authorization": f"Bearer {customer_token}"}
    # Create a pix order to inspect full body
    order = requests.post(
        f"{API}/orders",
        json={
            "items": [{"product_id": product_id, "quantity": 2}],
            "delivery_type": "pickup",
            "payment_method": "pix",
        },
        headers=CH,
        timeout=60,
    ).text
    bodies = [
        requests.get(f"{API}/integrations/status", headers=AH, timeout=30).text,
        requests.get(f"{API}/auth/me", headers=AH, timeout=30).text,
        requests.get(f"{API}/auth/me", headers=CH, timeout=30).text,
        order,
    ]
    for body in bodies:
        assert "TEST-379" not in body, "MP_ACCESS_TOKEN prefix leaked"
        assert "APP_USR-" not in body
        # No whole MP token patterns
        assert not re.search(r"TEST-\d{10,}-\d{6}-[a-f0-9]{20,}", body), "MP access token leaked"


# ---- 6. No token leakage in backend logs ----
def test_no_token_in_backend_logs():
    try:
        out = subprocess.check_output(
            "grep -hE 'TEST-[0-9]{10,}|APP_USR-[A-Za-z0-9]{10,}' /var/log/supervisor/backend.*.log || true",
            shell=True, text=True, timeout=20,
        )
    except subprocess.CalledProcessError as e:
        out = e.output or ""
    assert out.strip() == "", f"Token leaked in logs:\n{out[:500]}"


# ---- 7. Status flow still works for pix orders ----
def test_pix_order_status_flow(admin_token, customer_token, product_id):
    CH = {"Authorization": f"Bearer {customer_token}"}
    AH = {"Authorization": f"Bearer {admin_token}"}
    r = requests.post(
        f"{API}/orders",
        json={
            "items": [{"product_id": product_id, "quantity": 2}],
            "delivery_type": "pickup",
            "payment_method": "pix",
        },
        headers=CH,
        timeout=60,
    )
    assert r.status_code in (200, 201)
    oid = r.json()["id"]
    for st in ["accepted", "preparing", "ready", "dispatched", "finished"]:
        rr = requests.patch(f"{API}/admin/orders/{oid}/status", json={"status": st}, headers=AH, timeout=30)
        assert rr.status_code == 200, f"{st} -> {rr.status_code} {rr.text}"
