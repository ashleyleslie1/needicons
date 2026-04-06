import pytest
import io
import zipfile
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


async def _setup_accepted_pack(c):
    """Create pack with accepted requirement + profile."""
    pack = (await c.post("/api/packs", json={"name": "ExportPack"})).json()
    reqs = (await c.post(f"/api/packs/{pack['id']}/requirements", json=[
        {"name": "tent"}, {"name": "jerky"},
    ])).json()

    for req in reqs:
        with patch("needicons.server.api.generate._generate_for_requirement") as mock_gen:
            mock_gen.return_value = [_fake_image()]
            await c.post(f"/api/requirements/{req['id']}/generate", json={"mode": "precision"})
        cands = (await c.get(f"/api/requirements/{req['id']}/candidates")).json()
        await c.post(f"/api/candidates/{cands[0]['id']}/pick")

    profile = (await c.post("/api/profiles", json={"name": "TestProfile"})).json()
    return pack["id"], profile["id"]


@pytest.mark.asyncio
async def test_export_creates_zip(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        pack_id, profile_id = await _setup_accepted_pack(c)
        resp = await c.post(f"/api/packs/{pack_id}/export", json={
            "profile_id": profile_id,
            "sizes": [128, 64],
            "formats": ["png"],
        })
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/zip"
        zf = zipfile.ZipFile(io.BytesIO(resp.content))
        names = zf.namelist()
        assert "128x/tent.png" in names
        assert "64x/jerky.png" in names
        assert "manifest.json" in names
