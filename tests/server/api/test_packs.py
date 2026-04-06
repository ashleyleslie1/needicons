import pytest
from httpx import AsyncClient, ASGITransport
from needicons.server.app import create_app


@pytest.fixture
def app(tmp_path):
    return create_app(data_dir=tmp_path / "data")


@pytest.mark.asyncio
async def test_create_pack(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.post("/api/packs", json={
            "name": "TestPack", "style_prompt": "flat minimalist"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "TestPack"
        assert "id" in data


@pytest.mark.asyncio
async def test_list_packs(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        await c.post("/api/packs", json={"name": "Pack1"})
        await c.post("/api/packs", json={"name": "Pack2"})
        resp = await c.get("/api/packs")
        assert len(resp.json()) == 2


@pytest.mark.asyncio
async def test_get_pack(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        create_resp = await c.post("/api/packs", json={"name": "MyPack"})
        pack_id = create_resp.json()["id"]
        resp = await c.get(f"/api/packs/{pack_id}")
        assert resp.status_code == 200
        assert resp.json()["name"] == "MyPack"


@pytest.mark.asyncio
async def test_delete_pack(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        create_resp = await c.post("/api/packs", json={"name": "ToDelete"})
        pack_id = create_resp.json()["id"]
        resp = await c.delete(f"/api/packs/{pack_id}")
        assert resp.status_code == 200
        resp = await c.get(f"/api/packs/{pack_id}")
        assert resp.status_code == 404


@pytest.mark.asyncio
async def test_add_requirements(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        create_resp = await c.post("/api/packs", json={"name": "ReqPack"})
        pack_id = create_resp.json()["id"]
        resp = await c.post(f"/api/packs/{pack_id}/requirements", json=[
            {"name": "tent", "description": "camping tent"},
            {"name": "jerky"},
        ])
        assert resp.status_code == 200
        assert len(resp.json()) == 2
        pack = (await c.get(f"/api/packs/{pack_id}")).json()
        assert len(pack["requirements"]) == 2


@pytest.mark.asyncio
async def test_delete_requirement(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        create_resp = await c.post("/api/packs", json={"name": "ReqPack"})
        pack_id = create_resp.json()["id"]
        reqs = (await c.post(f"/api/packs/{pack_id}/requirements", json=[
            {"name": "tent"},
        ])).json()
        req_id = reqs[0]["id"]
        resp = await c.delete(f"/api/requirements/{req_id}")
        assert resp.status_code == 200
