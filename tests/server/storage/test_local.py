import pytest
import asyncio
from needicons.server.storage.local import LocalStorage


@pytest.fixture
def storage(tmp_path):
    return LocalStorage(base_dir=tmp_path / "data")


@pytest.mark.asyncio
async def test_save_and_load(storage):
    key = "packs/test/icon.png"
    data = b"fake-png-data"
    path = await storage.save(key, data)
    assert "icon.png" in path
    loaded = await storage.load(key)
    assert loaded == data


@pytest.mark.asyncio
async def test_delete(storage):
    key = "packs/test/icon.png"
    await storage.save(key, b"data")
    await storage.delete(key)
    with pytest.raises(FileNotFoundError):
        await storage.load(key)


@pytest.mark.asyncio
async def test_list(storage):
    await storage.save("packs/a/1.png", b"a")
    await storage.save("packs/a/2.png", b"b")
    await storage.save("packs/b/1.png", b"c")
    keys = await storage.list("packs/a")
    assert len(keys) == 2


@pytest.mark.asyncio
async def test_load_missing_raises(storage):
    with pytest.raises(FileNotFoundError):
        await storage.load("does/not/exist.png")
