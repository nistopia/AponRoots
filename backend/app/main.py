from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .routers import persons, relationships

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AponRoots API",
    description="Family tree backend. Store only parent-child links; derive everything else.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(persons.router)
app.include_router(relationships.router)


@app.get("/")
def root():
    return {"app": "AponRoots", "version": "0.1.0", "docs": "/docs"}
