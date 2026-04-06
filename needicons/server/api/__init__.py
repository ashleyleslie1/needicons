"""API router aggregation."""
from fastapi import APIRouter
from needicons.server.api.settings import router as settings_router

api_router = APIRouter()
api_router.include_router(settings_router)
