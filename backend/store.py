import json
import sqlite3
import time
from pathlib import Path


class Store:
    def __init__(self, path):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(path)
        self.db.row_factory = sqlite3.Row
        self.db.executescript('''
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS trades (
                id INTEGER PRIMARY KEY, task_id TEXT UNIQUE NOT NULL, created REAL NOT NULL,
                capital REAL NOT NULL, payload TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY, created REAL NOT NULL, message TEXT NOT NULL,
                department TEXT NOT NULL, task_id TEXT
            );
        ''')
        self.db.commit()

    def save_task(self, task):
        self.db.execute('INSERT OR REPLACE INTO tasks VALUES (?, ?)', (task['id'], json.dumps(task)))
        self.db.commit()

    def tasks(self):
        return sorted([json.loads(r['payload']) for r in self.db.execute('SELECT payload FROM tasks')],
                      key=lambda t: t['created'], reverse=True)

    def event(self, message, department, task_id=None):
        self.db.execute('INSERT INTO events (created, message, department, task_id) VALUES (?, ?, ?, ?)',
                        (time.time(), message, department, task_id))
        self.db.commit()

    def events(self):
        return [dict(r) for r in self.db.execute('SELECT * FROM events ORDER BY id DESC LIMIT 60')]

    def trades(self):
        return [dict(json.loads(r['payload']), id=r['id'], created=r['created'], task_id=r['task_id'])
                for r in self.db.execute('SELECT * FROM trades ORDER BY id DESC')]

    def paper_capital(self):
        return round(10000.0 - self.db.execute('SELECT COALESCE(SUM(capital), 0) FROM trades').fetchone()[0], 2)

    def add_trade(self, task_id, opportunity):
        # Callers run on one asyncio event loop. This transaction also protects the reserve check.
        with self.db:
            if self.db.execute('SELECT 1 FROM trades WHERE task_id = ?', (task_id,)).fetchone():
                raise ValueError('This scan already has a paper order')
            if opportunity['capital_required'] > self.paper_capital():
                raise ValueError('Insufficient unallocated paper capital')
            self.db.execute('INSERT INTO trades (task_id, created, capital, payload) VALUES (?, ?, ?, ?)',
                            (task_id, time.time(), opportunity['capital_required'], json.dumps(opportunity)))
        self.event('Paper order recorded · capital reserved · no exchange order sent', 'arbitrage', task_id)
