"""Tests for lasso mask API endpoints."""
import pytest
from httpx import AsyncClient, ASGITransport


@pytest.fixture
def app():
    from needicons.server.app import create_app
    return create_app()


@pytest.mark.asyncio
async def test_get_strategies(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/generation-tools/strategies")
        assert resp.status_code == 200
        data = resp.json()
        assert "strategies" in data
        assert "grabcut" in data["strategies"]


@pytest.mark.asyncio
async def test_add_lasso_mask_not_found(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/generations/nonexistent/lasso-mask", json={
            "point": [0.5, 0.5],
            "mode": "remove",
            "strategy": "grabcut",
        })
        assert resp.status_code == 404


@pytest.mark.asyncio
async def test_add_lasso_mask_invalid_strategy(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/generations/nonexistent/lasso-mask", json={
            "point": [0.5, 0.5],
            "mode": "remove",
            "strategy": "nonexistent_strategy",
        })
        assert resp.status_code in (400, 404)


@pytest.mark.asyncio
async def test_delete_lasso_mask_not_found(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.delete("/api/generations/nonexistent/lasso-mask/mask123")
        assert resp.status_code == 404
