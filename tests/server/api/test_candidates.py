import pytest
from unittest.mock import patch
from PIL import Image
from httpx import AsyncClient, ASGITransport
from needicons.server.app import create_app


@pytest.fixture
def app(tmp_path):
    a = create_app(data_dir=tmp_path / "data")
    a.state.app_state.update_config("provider", {"api_key": "sk-test"})
    return a


def _fake_image():
    return Image.new("RGBA", (256, 256), (255, 0, 0, 255))


async def _setup_pack_with_candidates(c):
    pack = (await c.post("/api/packs", json={"name": "CandPack"})).json()
    reqs = (await c.post(f"/api/packs/{pack['id']}/requirements", json=[
        {"name": "tent"},
    ])).json()
    req_id = reqs[0]["id"]
    with patch("needicons.server.api.generate._generate_for_requirement") as mock_gen:
        mock_gen.return_value = [_fake_image(), _fake_image()]
        await c.post(f"/api/requirements/{req_id}/generate", json={"mode": "precision"})
    return pack["id"], req_id


@pytest.mark.asyncio
async def test_list_candidates(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        _, req_id = await _setup_pack_with_candidates(c)
        resp = await c.get(f"/api/requirements/{req_id}/candidates")
        assert resp.status_code == 200
        assert len(resp.json()) >= 1


@pytest.mark.asyncio
async def test_pick_candidate(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        _, req_id = await _setup_pack_with_candidates(c)
        cands = (await c.get(f"/api/requirements/{req_id}/candidates")).json()
        cand_id = cands[0]["id"]
        resp = await c.post(f"/api/candidates/{cand_id}/pick")
        assert resp.status_code == 200
        cands = (await c.get(f"/api/requirements/{req_id}/candidates")).json()
        selected = [c for c in cands if c["selected"]]
        assert len(selected) == 1
        assert selected[0]["id"] == cand_id
