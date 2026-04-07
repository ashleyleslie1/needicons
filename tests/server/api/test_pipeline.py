import pytest
import io
import zipfile
from PIL import Image
from httpx import AsyncClient, ASGITransport
from needicons.server.app import create_app


@pytest.fixture
def app(tmp_path):
    a = create_app(data_dir=tmp_path / "data")
    a.state.app_state.update_config("provider", {"api_key": "sk-test"})
    return a


def _save_fake_icon(state, path: str):
    """Save a fake icon image to the data directory."""
    img = Image.new("RGBA", (256, 256), (255, 0, 0, 255))
    full_path = state.data_dir / path
    full_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(full_path, format="PNG")


async def _setup_project_with_icons(client, state):
    """Create a project and manually add saved icons."""
    from needicons.core.models import SavedIcon

    # Get the default project
    resp = await client.get("/api/projects")
    project_id = resp.json()[0]["id"]
    project = state.projects[project_id]

    # Create fake source images and add icons
    for name in ["tent", "jerky"]:
        path = f"images/fake/{name}.png"
        _save_fake_icon(state, path)
        icon = SavedIcon(name=name, prompt=name, source_path=path)
        project.icons.append(icon)

    state.save_data()
    return project_id


@pytest.mark.asyncio
async def test_export_creates_zip(app):
    import asyncio
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        project_id = await _setup_project_with_icons(c, app.state.app_state)
        resp = await c.post(f"/api/projects/{project_id}/export", json={
            "sizes": [128, 64],
            "formats": ["png"],
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "job_id" in data
        job_id = data["job_id"]

        # Poll until export completes
        for _ in range(50):
            status_resp = await c.get(f"/api/projects/{project_id}/export/{job_id}/status")
            status = status_resp.json()
            if status["status"] in ("completed", "failed"):
                break
            await asyncio.sleep(0.1)

        assert status["status"] == "completed", f"Export failed: {status.get('error')}"

        # Download the ZIP
        dl_resp = await c.get(f"/api/projects/{project_id}/export/{job_id}/download")
        assert dl_resp.status_code == 200
        assert dl_resp.headers["content-type"] == "application/zip"
        zf = zipfile.ZipFile(io.BytesIO(dl_resp.content))
        names = zf.namelist()
        assert "128x/tent.png" in names
        assert "64x/jerky.png" in names
        assert "manifest.json" in names


@pytest.mark.asyncio
async def test_export_no_icons_returns_400(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.get("/api/projects")
        project_id = resp.json()[0]["id"]
        resp = await c.post(f"/api/projects/{project_id}/export", json={
            "sizes": [128],
            "formats": ["png"],
        })
        assert resp.status_code == 400


@pytest.mark.asyncio
async def test_preview_icon(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        project_id = await _setup_project_with_icons(c, app.state.app_state)
        project = app.state.app_state.projects[project_id]
        icon_id = project.icons[0].id
        resp = await c.get(f"/api/projects/{project_id}/icons/{icon_id}/preview")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "image/png"


@pytest.mark.asyncio
async def test_preview_caching(app):
    """Second request for same settings should hit cache."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        project_id = await _setup_project_with_icons(c, app.state.app_state)
        project = app.state.app_state.projects[project_id]
        icon_id = project.icons[0].id

        resp1 = await c.get(f"/api/projects/{project_id}/icons/{icon_id}/preview")
        assert resp1.status_code == 200

        # Second request should return same content (from cache)
        resp2 = await c.get(f"/api/projects/{project_id}/icons/{icon_id}/preview")
        assert resp2.status_code == 200
        assert resp1.content == resp2.content
