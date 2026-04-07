"""API router aggregation."""
from fastapi import APIRouter
from needicons.server.api.settings import router as settings_router
from needicons.server.api.packs import router as packs_router
from needicons.server.api.profiles import router as profiles_router
from needicons.server.api.generate import router as generate_router
from needicons.server.api.candidates import router as candidates_router
from needicons.server.api.pipeline import router as pipeline_router
from needicons.server.api.jobs import router as jobs_router
from needicons.server.api.projects import router as projects_router

api_router = APIRouter()
api_router.include_router(settings_router)
api_router.include_router(packs_router)
api_router.include_router(profiles_router)
api_router.include_router(generate_router)
api_router.include_router(candidates_router)
api_router.include_router(pipeline_router)
api_router.include_router(jobs_router)
api_router.include_router(projects_router)
