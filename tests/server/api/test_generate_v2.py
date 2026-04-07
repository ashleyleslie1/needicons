"""Tests for the generation API v2 — validation and error paths only.

Actual generation requires a real API key and is not tested here.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from needicons.server.app import create_app


@pytest.fixture
def app(tmp_path):
    return create_app(data_dir=tmp_path / "data")


@pytest.mark.asyncio
async def test_generate_no_api_key_returns_400(app):
    """With no API key configured, /api/generate should return 400."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/generate", json={
            "prompts": [{"name": "Star"}],
        })
        assert resp.status_code == 400
        assert "No API key" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_generate_empty_prompts_returns_400(app):
    """Empty prompts list should return 400 before the API key is checked."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/generate", json={"prompts": []})
        assert resp.status_code == 400
        assert "No prompts provided" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_generate_invalid_project_id_returns_404(app):
    """A non-existent project_id should return 404 before any other validation."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/generate", json={
            "project_id": "does-not-exist",
            "prompts": [{"name": "Star"}],
        })
        assert resp.status_code == 404
        assert "Project not found" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_pick_nonexistent_generation_returns_404(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/generations/nonexistent/pick/0")
        assert resp.status_code == 404


@pytest.mark.asyncio
async def test_unpick_nonexistent_generation_returns_404(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/generations/nonexistent/unpick")
        assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_nonexistent_generation_returns_404(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.delete("/api/generations/nonexistent")
        assert resp.status_code == 404
