"""API router aggregation."""
from fastapi import APIRouter
from needicons.server.api.settings import router as settings_router
from needicons.server.api.packs import router as packs_router

api_router = APIRouter()
api_router.include_router(settings_router)
api_router.include_router(packs_router)
