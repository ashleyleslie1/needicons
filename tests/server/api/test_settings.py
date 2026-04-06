import pytest
from httpx import AsyncClient, ASGITransport
from needicons.server.app import create_app


@pytest.fixture
def app(tmp_path):
    return create_app(data_dir=tmp_path / "data")


@pytest.mark.asyncio
async def test_get_settings(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/settings")
        data = resp.json()
        assert "provider" in data
        assert data["provider"]["default_model"] == "gpt-4o"


@pytest.mark.asyncio
async def test_update_provider(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.put("/api/settings/provider", json={
            "api_key": "sk-test-123",
            "default_model": "dall-e-3",
        })
        assert resp.status_code == 200
        resp = await client.get("/api/settings")
        assert resp.json()["provider"]["default_model"] == "dall-e-3"
        assert "sk-test-123" not in resp.json()["provider"].get("api_key", "")


@pytest.mark.asyncio
async def test_gpu_info(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/settings/gpu")
        data = resp.json()
        assert "backend" in data
        assert "available" in data
