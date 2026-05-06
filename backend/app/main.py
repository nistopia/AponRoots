import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .routers import auth, grants, persons, relationships

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AponRoots API",
    description="Family tree backend. Store only parent-child links; derive everything else.",
    version="0.2.0",
)

# Comma-separated list of allowed origins, override via env in prod.
DEFAULT_ORIGINS = ",".join([
    "http://localhost:3000",
    "https://aponroots.com",
    "https://www.aponroots.com",
])
allowed_origins = [
    o.strip()
    for o in os.environ.get("ALLOWED_ORIGINS", DEFAULT_ORIGINS).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(persons.router)
app.include_router(grants.router)
app.include_router(relationships.router)


@app.get("/")
def root():
    return {"app": "AponRoots", "version": "0.2.0", "docs": "/docs"}
