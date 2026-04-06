"""End-to-end integration test: create pack → add requirements → generate → pick → export."""
import pytest
import zipfile
import io
import json
from unittest.mock import patch
from PIL import Image
from httpx import AsyncClient, ASGITransport
from needicons.server.app import create_app


def _fake_image(color=(255, 0, 0, 255)):
    return Image.new("RGBA", (256, 256), color)


@pytest.mark.asyncio
async def test_full_workflow(tmp_path):
    app = create_app(data_dir=tmp_path / "data")
    app.state.app_state.update_config("provider", {"api_key": "sk-test"})

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        # 1. Create pack
        pack = (await c.post("/api/packs", json={
            "name": "IntegrationPack",
            "style_prompt": "flat minimalist icons",
        })).json()
        assert pack["name"] == "IntegrationPack"

        # 2. Add requirements
        reqs = (await c.post(f"/api/packs/{pack['id']}/requirements", json=[
            {"name": "tent", "description": "camping tent"},
            {"name": "jerky", "description": "beef jerky"},
        ])).json()
        assert len(reqs) == 2

        # 3. Create profile
        profile = (await c.post("/api/profiles", json={
            "name": "TestProfile",
            "stroke": {"enabled": False},
            "mask": {"shape": "none"},
            "output": {"sizes": [64, 32], "formats": ["png"]},
        })).json()

        # 4. Generate for each requirement (mocked)
        for req in reqs:
            with patch("needicons.server.api.generate._generate_for_requirement") as mock_gen:
                mock_gen.return_value = [_fake_image()]
                gen_resp = await c.post(
                    f"/api/requirements/{req['id']}/generate",
                    json={"mode": "precision"},
                )
                assert gen_resp.status_code == 200

        # 5. Pick candidates
        for req in reqs:
            cands = (await c.get(f"/api/requirements/{req['id']}/candidates")).json()
            assert len(cands) >= 1
            await c.post(f"/api/candidates/{cands[0]['id']}/pick")

        # 6. Export
        export_resp = await c.post(f"/api/packs/{pack['id']}/export", json={
            "profile_id": profile["id"],
            "sizes": [64, 32],
            "formats": ["png"],
        })
        assert export_resp.status_code == 200
        assert export_resp.headers["content-type"] == "application/zip"

        # 7. Verify ZIP contents
        zf = zipfile.ZipFile(io.BytesIO(export_resp.content))
        names = zf.namelist()
        assert "64x/tent.png" in names
        assert "64x/jerky.png" in names
        assert "32x/tent.png" in names
        assert "32x/jerky.png" in names
        assert "manifest.json" in names

        manifest = json.loads(zf.read("manifest.json"))
        assert manifest["pack_name"] == "IntegrationPack"
        assert "tent" in manifest["icons"]
        assert "jerky" in manifest["icons"]

        # Verify actual image sizes
        img = Image.open(io.BytesIO(zf.read("32x/tent.png")))
        assert img.size == (32, 32)
