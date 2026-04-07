"""Tests for the projects API."""
import pytest
from httpx import AsyncClient, ASGITransport
from needicons.server.app import create_app


@pytest.fixture
def app(tmp_path):
    return create_app(data_dir=tmp_path / "data")


@pytest.mark.asyncio
async def test_create_project(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/projects", json={"name": "Test Pack"})
        assert resp.status_code == 200
        data = resp.json()
        assert "id" in data
        assert data["name"] == "Test Pack"
        assert "post_processing" in data
        assert "icons" in data


@pytest.mark.asyncio
async def test_list_projects_has_default(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/projects")
        assert resp.status_code == 200
        projects = resp.json()
        assert len(projects) >= 1
        names = [p["name"] for p in projects]
        assert "My Icons" in names


@pytest.mark.asyncio
async def test_get_project_by_id(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create a project to fetch
        create_resp = await client.post("/api/projects", json={"name": "Fetch Me"})
        project_id = create_resp.json()["id"]

        resp = await client.get(f"/api/projects/{project_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == project_id
        assert data["name"] == "Fetch Me"


@pytest.mark.asyncio
async def test_get_project_bad_id_returns_404(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/projects/nonexistent-id-xyz")
        assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_project_name(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        create_resp = await client.post("/api/projects", json={"name": "Original Name"})
        project_id = create_resp.json()["id"]

        update_resp = await client.put(f"/api/projects/{project_id}", json={"name": "Updated Name"})
        assert update_resp.status_code == 200
        assert update_resp.json()["name"] == "Updated Name"

        # Confirm persistence via GET
        get_resp = await client.get(f"/api/projects/{project_id}")
        assert get_resp.json()["name"] == "Updated Name"


@pytest.mark.asyncio
async def test_delete_project(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        create_resp = await client.post("/api/projects", json={"name": "To Delete"})
        project_id = create_resp.json()["id"]

        delete_resp = await client.delete(f"/api/projects/{project_id}")
        assert delete_resp.status_code == 200

        # Subsequent GET should 404
        get_resp = await client.get(f"/api/projects/{project_id}")
        assert get_resp.status_code == 404
