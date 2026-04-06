import pytest
from httpx import AsyncClient, ASGITransport
from needicons.server.app import create_app


@pytest.fixture
def app(tmp_path):
    return create_app(data_dir=tmp_path / "data")


@pytest.mark.asyncio
async def test_create_profile(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.post("/api/profiles", json={
            "name": "TestProfile",
            "stroke": {"enabled": True, "width": 2, "color": "#FFF", "position": "outer"},
        })
        assert resp.status_code == 200
        assert resp.json()["name"] == "TestProfile"
        assert resp.json()["stroke"]["enabled"] is True


@pytest.mark.asyncio
async def test_list_profiles(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        await c.post("/api/profiles", json={"name": "P1"})
        await c.post("/api/profiles", json={"name": "P2"})
        resp = await c.get("/api/profiles")
        assert len(resp.json()) == 2


@pytest.mark.asyncio
async def test_update_profile(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        create_resp = await c.post("/api/profiles", json={"name": "Editable"})
        pid = create_resp.json()["id"]
        resp = await c.put(f"/api/profiles/{pid}", json={
            "mask": {"shape": "circle"},
        })
        assert resp.status_code == 200
        assert resp.json()["mask"]["shape"] == "circle"
