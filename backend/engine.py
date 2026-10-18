"""Event-driven workers; replace execute() with an adapter without changing the scene protocol."""
import asyncio
import time
import uuid
from .arbitrage import FIXTURES, evaluate
from .catalog import ROOMS, departments, initial_agents


class Engine:
    def __init__(self, store, speed=1.0):
        self.store, self.speed = store, speed
        self.agents = {a['id']: a for a in initial_agents()}
        self.running = {}
        # Work interrupted by a process stop is explicit, never silently reported as completed.
        for task in store.tasks():
            if task['status'] not in ('Completed', 'Error'):
                task.update(status='Error', phase='Interrupted by server restart', finished=time.time(),
                            error='Server restarted before completion. Assign a new task to retry.')
                store.save_task(task)
                store.event('Interrupted task marked Error after restart', task['department'], task['id'])

    def snapshot(self):
        trades = self.store.trades()
        return dict(mode='SIMULATION', real_execution_enabled=False, departments=departments(),
                    agents=list(self.agents.values()), tasks=self.store.tasks(), events=self.store.events(),
                    trades=trades, server_time=time.time(),
                    treasury=dict(paper_capital=10000, available=self.store.paper_capital(),
                                  reserved=round(10000 - self.store.paper_capital(), 2),
                                  estimated_profit=round(sum(t['estimated_profit'] for t in trades), 2),
                                  real_revenue=0, real_expenses=0, realized_paper_profit=0))

    def assign(self, department, agent_id=None, stake=100):
        room = next((r for r in ROOMS if r['id'] == department), None)
        if not room:
            raise ValueError('Unknown department')
        if department == 'arbitrage':
            ids = [w[0] for w in room['workers']]
        else:
            agent_id = agent_id or room['workers'][0][0]
            if agent_id not in self.agents or self.agents[agent_id]['department'] != department:
                raise ValueError('Agent does not belong to this department')
            ids = [agent_id]
        if any(self.agents[i]['task_id'] is not None for i in ids):
            raise ValueError('Agent is busy. Wait for the current assignment to finish.')
        task = dict(id=uuid.uuid4().hex[:12], department=department, title=room['job'],
                    agent_ids=ids, stake=stake, status='Assigned', phase='Dispatching workers',
                    progress=0, created=time.time(), finished=None, result=None, error=None,
                    simulated=True, history=[])
        self.store.save_task(task)
        for identifier in ids:
            self.set_state(identifier, 'Assigned', task, 'Task received')
        self.store.event(f"{room['job']} · assignment accepted", department, task['id'])
        self.running[task['id']] = asyncio.create_task(self.execute(task))
        return task

    def set_state(self, identifier, state, task, activity):
        agent = self.agents[identifier]
        agent.update(state=state, state_since=time.time(), task_id=task['id'], activity=activity, route=None)

    async def pause(self, seconds):
        await asyncio.sleep(seconds * self.speed)

    def phase(self, task, state, label, progress):
        task.update(status=state, phase=label, progress=progress)
        task['history'].append(dict(state=state, label=label, at=time.time()))
        self.store.save_task(task)
        self.store.event(label, task['department'], task['id'])

    async def move(self, identifier, task, home=False):
        agent = self.agents[identifier]
        start, end = agent['position'][:], agent['home' if home else 'station'][:]
        points = [start, [end[0], start[1]], end]
        distance = sum(abs(a[0]-b[0])+abs(a[1]-b[1]) for a,b in zip(points,points[1:]))
        duration = max(1.5, distance / 42) * self.speed
        self.set_state(identifier, 'Moving', task, 'Returning to standby' if home else 'Walking to workstation')
        agent['route'] = dict(points=points, started=time.time(), duration=duration)
        await asyncio.sleep(duration)
        agent.update(position=end, route=None)

    async def work(self, identifier, task, activity='Processing fixture data', reviewing=False):
        await self.move(identifier, task)
        self.set_state(identifier, 'Reviewing' if reviewing else 'Working', task, activity)
        await self.pause(3.5)

    async def execute(self, task):
        try:
            await self.pause(0.8)
            self.phase(task, 'Moving', 'Workers en route to their stations', 10)
            if task['department'] == 'arbitrage':
                for i in ('risk', 'controller'):
                    self.set_state(i, 'Waiting', task, 'Waiting for scan evidence')
                scans = [self.work(i, task, 'Reading synthetic exchange snapshot')
                         for i in ('scout', 'betfair', 'smarkets', 'matchbook')]
                self.phase(task, 'Working', 'Exchange workers reading synthetic odds and liquidity', 25)
                await asyncio.gather(*scans)
                for i in ('scout', 'betfair', 'smarkets', 'matchbook'):
                    self.set_state(i, 'Waiting', task, 'Scan delivered · awaiting review')
                self.phase(task, 'Reviewing', 'AEGIS checking commission, liquidity and paper exposure', 65)
                await self.work('risk', task, 'Evaluating both outcome profits and capital limits', True)
                self.set_state('risk', 'Waiting', task, 'Risk assessment delivered')
                self.phase(task, 'Reviewing', 'ATLAS reviewing the paper opportunity report', 85)
                await self.work('controller', task, 'Reviewing evidence · execution remains disabled', True)
                opportunities = [evaluate(q, task['stake'], self.store.paper_capital()) for q in FIXTURES]
                task['result'] = dict(kind='scan', summary='Synthetic snapshot evaluated. No live markets were queried.',
                                      opportunities=opportunities, sources=['Betfair fixture', 'Smarkets fixture', 'Matchbook fixture'])
            else:
                await self.move(task['agent_ids'][0], task)
                self.phase(task, 'Working', 'Processing the department assignment', 40)
                self.set_state(task['agent_ids'][0], 'Working', task, 'Preparing local demonstration output')
                await self.pause(4)
                task['result'] = self.department_result(task['department'])
            task['finished'] = time.time()
            self.phase(task, 'Completed', 'Report ready for inspection', 100)
            for i in task['agent_ids']:
                self.set_state(i, 'Completed', task, 'Report delivered')
            await self.pause(2)
            await asyncio.gather(*(self.move(i, task, home=True) for i in task['agent_ids']))
            for i in task['agent_ids']:
                self.agents[i].update(state='Idle', state_since=time.time(), task_id=None, route=None,
                                      activity='Awaiting assignment')
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            task.update(error=str(exc), finished=time.time())
            self.phase(task, 'Error', 'Task failed · inspect report', 0)
            for i in task['agent_ids']:
                self.agents[i].update(state='Error', task_id=None, route=None, activity='Assignment failed')
        finally:
            self.running.pop(task['id'], None)

    def department_result(self, department):
        rows = {
            'etsy': ['Concept: printable weekly garden planner.', 'Draft positioning: beginner gardeners with small outdoor spaces.',
                     'Next step: validate demand, originality and marketplace policies. No listing was published.'],
            'fiverr': ['Service concept: format a client-provided report into a clean PDF.',
                       'Delivery checklist: clarify scope → prepare draft → human review → delivery.',
                       'Demonstration outline only. No client contacted and no order accepted.'],
            'retail': ['Sample product: desk lamp. Fixture buy price £18.00; fixture resale £32.00.',
                       'Assumed fees £4.80 + shipping £3.50 = estimated margin £5.70 before tax.',
                       'Synthetic prices; verify stock, condition, returns and demand before purchase.'],
            'headquarters': ['Local task controller online. SQLite history available.',
                             f'{len(self.agents)} agents registered across {len(ROOMS)} departments.',
                             'All external business adapters disconnected. Real-money execution disabled.'],
            'treasury': [f"Available paper capital: £{self.store.paper_capital():,.2f}.",
                         f"Paper orders recorded: {len(self.store.trades())}.",
                         'Real revenue £0.00; real expenses £0.00. Paper estimates are not earned income.'],
        }
        return dict(kind='report', summary='Local demonstration report · not real business research.', lines=rows[department])

    def paper_trade(self, task_id):
        task = next((t for t in self.store.tasks() if t['id'] == task_id), None)
        if not task or task['department'] != 'arbitrage' or task['status'] != 'Completed':
            raise ValueError('A completed arbitrage scan is required')
        quote = task['result']['opportunities'][0]
        checked = evaluate(quote, task['stake'], self.store.paper_capital())
        if not checked['approved']:
            raise ValueError('; '.join(checked['reasons']))
        self.store.add_trade(task_id, checked)
        return dict(status='paper_recorded', simulated=True, opportunity=checked)

    async def close(self):
        pending = list(self.running.values())
        for job in pending:
            job.cancel()
        await asyncio.gather(*pending, return_exceptions=True)
