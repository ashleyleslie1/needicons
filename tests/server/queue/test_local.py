import pytest
import asyncio
from needicons.server.queue.local import LocalQueue
from needicons.core.models import JobStatus


@pytest.fixture
def queue():
    return LocalQueue(max_workers=2)


@pytest.mark.asyncio
async def test_enqueue_and_status(queue):
    async def dummy_task():
        return "done"

    job_id = await queue.enqueue(dummy_task)
    assert job_id is not None
    await asyncio.sleep(0.1)
    status = await queue.get_status(job_id)
    assert status in (JobStatus.RUNNING, JobStatus.COMPLETED)


@pytest.mark.asyncio
async def test_get_result(queue):
    async def return_42():
        return 42

    job_id = await queue.enqueue(return_42)
    await asyncio.sleep(0.2)
    result = await queue.get_result(job_id)
    assert result == 42


@pytest.mark.asyncio
async def test_failed_task(queue):
    async def fail():
        raise ValueError("intentional")

    job_id = await queue.enqueue(fail)
    await asyncio.sleep(0.2)
    status = await queue.get_status(job_id)
    assert status == JobStatus.FAILED
