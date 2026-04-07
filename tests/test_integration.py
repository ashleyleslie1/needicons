"""End-to-end integration test: create project → add icons → preview → export."""
import pytest
import zipfile
import io
import json
from PIL import Image
from httpx import AsyncClient, ASGITransport
from needicons.server.app import create_app
from needicons.core.models import SavedIcon


def _save_fake_icon(state, path: str):
    img = Image.new("RGBA", (256, 256), (255, 0, 0, 255))
    full_path = state.data_dir / path
    full_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(full_path, format="PNG")


@pytest.mark.asyncio
async def test_full_workflow(tmp_path):
    app = create_app(data_dir=tmp_path / "data")
    app.state.app_state.update_config("provider", {"api_key": "sk-test"})
    state = app.state.app_state

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        # 1. Create project
        resp = await c.post("/api/projects", json={"name": "IntegrationPack"})
        project = resp.json()
        assert project["name"] == "IntegrationPack"
        project_id = project["id"]

        # 2. Add icons directly (simulating pick after generation)
        for name in ["tent", "jerky"]:
            path = f"images/test/{name}.png"
            _save_fake_icon(state, path)
            icon = SavedIcon(name=name, prompt=name, source_path=path)
            state.projects[project_id].icons.append(icon)
        state.save_data()

        # 3. Verify project has icons
        resp = await c.get(f"/api/projects/{project_id}")
        assert len(resp.json()["icons"]) == 2

        # 4. Preview an icon
        icon_id = state.projects[project_id].icons[0].id
        resp = await c.get(f"/api/projects/{project_id}/icons/{icon_id}/preview")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "image/png"

        # 5. Export (async job-based)
        export_resp = await c.post(f"/api/projects/{project_id}/export", json={
            "sizes": [64, 32],
            "formats": ["png"],
        })
        assert export_resp.status_code == 200
        export_data = export_resp.json()
        job_id = export_data["job_id"]

        # Poll until complete
        import asyncio as _asyncio
        for _ in range(60):
            status_resp = await c.get(f"/api/projects/{project_id}/export/{job_id}/status")
            status = status_resp.json()
            if status["status"] in ("completed", "failed"):
                break
            await _asyncio.sleep(0.1)
        assert status["status"] == "completed"

        # Download ZIP
        dl_resp = await c.get(f"/api/projects/{project_id}/export/{job_id}/download")
        assert dl_resp.status_code == 200
        assert dl_resp.headers["content-type"] == "application/zip"

        # 6. Verify ZIP contents
        zf = zipfile.ZipFile(io.BytesIO(dl_resp.content))
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

        # 7. Remove icon from project
        resp = await c.delete(f"/api/projects/{project_id}/icons/{icon_id}")
        assert resp.status_code == 200
        resp = await c.get(f"/api/projects/{project_id}")
        assert len(resp.json()["icons"]) == 1
