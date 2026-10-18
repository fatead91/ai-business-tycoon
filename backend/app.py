from contextlib import asynccontextmanager
from pathlib import Path
import os
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from .engine import Engine
from .store import Store

ROOT = Path(__file__).resolve().parent.parent


def create_app(db_path=None, speed=1.0):
    @asynccontextmanager
    async def lifespan(app):
        store = Store(db_path or os.environ.get('TYCOON_DB', str(ROOT / '.runtime' / 'tycoon.sqlite3')))
        app.state.engine = Engine(store, speed)
        yield
        await app.state.engine.close()
        store.db.close()

    app = FastAPI(title='AI Business Tycoon · local simulation', lifespan=lifespan)

    @app.get('/api/health')
    async def health():
        return dict(status='ok', mode='simulation', real_execution_enabled=False)

    @app.get('/api/state')
    async def state():
        return app.state.engine.snapshot()

    @app.post('/api/tasks', status_code=201)
    async def assign(body: Assignment):
        try:
            return app.state.engine.assign(body.department, body.agent_id, body.stake)
        except ValueError as exc:
            raise HTTPException(409, str(exc))

    @app.post('/api/paper-trades', status_code=201)
    async def paper_trade(body: PaperOrder):
        try:
            return app.state.engine.paper_trade(body.task_id)
        except ValueError as exc:
            raise HTTPException(409, str(exc))

    @app.post('/api/execute-live')
    async def live_disabled():
        raise HTTPException(403, 'Real-money execution is disabled. Only simulated paper orders are supported.')

    if (ROOT / 'dist').exists():
        app.mount('/', StaticFiles(directory=ROOT / 'dist', html=True), name='frontend')
    return app


class Assignment(BaseModel):
    department: str = Field(min_length=1, max_length=40)
    agent_id: str | None = None
    stake: float = Field(default=100, ge=1, le=1000, allow_inf_nan=False)


class PaperOrder(BaseModel):
    task_id: str = Field(min_length=1, max_length=40)


app = create_app()
