import pytest
from unittest.mock import AsyncMock, patch
from PIL import Image
from httpx import AsyncClient, ASGITransport
from needicons.server.app import create_app


@pytest.fixture
def app(tmp_path):
    a = create_app(data_dir=tmp_path / "data")
    a.state.app_state.update_config("provider", {"api_key": "sk-test", "default_model": "gpt-4o"})
    return a


def _fake_image():
    return Image.new("RGBA", (256, 256), (255, 0, 0, 255))


@pytest.mark.asyncio
async def test_generate_single_requirement(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        pack = (await c.post("/api/packs", json={"name": "GenPack", "style_prompt": "flat"})).json()
        reqs = (await c.post(f"/api/packs/{pack['id']}/requirements", json=[
            {"name": "tent"},
        ])).json()
        req_id = reqs[0]["id"]

        with patch("needicons.server.api.generate._generate_for_requirement") as mock_gen:
            mock_gen.return_value = [_fake_image()]
            resp = await c.post(f"/api/requirements/{req_id}/generate", json={
                "mode": "precision",
            })
            assert resp.status_code == 200
            data = resp.json()
            assert data["status"] == "generated"
            assert len(data["candidates"]) >= 1
