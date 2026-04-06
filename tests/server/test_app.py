import pytest
from httpx import AsyncClient, ASGITransport
from needicons.server.app import create_app


@pytest.fixture
def app(tmp_path):
    return create_app(data_dir=tmp_path / "data")


@pytest.mark.asyncio
async def test_app_starts(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/settings")
        assert resp.status_code == 200


@pytest.mark.asyncio
async def test_app_serves_api(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/settings/gpu")
        assert resp.status_code == 200
