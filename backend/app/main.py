from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
from app import models
from app.api.routes.auth import router as auth_router
from app.api.routes.organizations import router as organizations_router
from app.api.routes.boards import router as boards_router
from app.websockets.routes import router as websocket_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Multi-tenant real-time collaborative Kanban board API",
    lifespan=lifespan,
)
app.include_router(auth_router)
app.include_router(organizations_router)
app.include_router(boards_router)
app.include_router(websocket_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "message": "Welcome to CollabKanban API",
        "status": "running",
        "version": settings.APP_VERSION,
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "database": "configured",
        "application": settings.APP_NAME,
    }