import asyncio
import tempfile
import unittest
from pathlib import Path
import httpx
from backend.app import create_app
from backend.arbitrage import FIXTURES, evaluate
from backend.engine import Engine
from backend.store import Store


class CalculationTests(unittest.TestCase):
    def test_commission_adjusted_profit_matches_both_outcomes(self):
        result = evaluate(FIXTURES[0])
        self.assertTrue(result['approved'])
        self.assertAlmostEqual(result['profit_if_win'], result['profit_if_lose'], delta=0.02)
        self.assertEqual(result['lay_stake'], 104.62)
        self.assertEqual(result['capital_required'], 215.08)
        self.assertEqual(result['estimated_profit'], 2.52)

    def test_unprofitable_quote_is_rejected(self):
        result = evaluate(FIXTURES[1])
        self.assertFalse(result['approved'])
        self.assertLess(result['estimated_profit'], 0)

    def test_liquidity_and_available_capital_are_checked(self):
        result = evaluate(FIXTURES[0] | {'lay_liquidity': 1}, available_capital=10)
        self.assertFalse(result['approved'])
        self.assertIn('Insufficient fixture liquidity', result['reasons'])
        self.assertIn('Insufficient unallocated paper capital', result['reasons'])

    def test_commission_can_remove_an_apparent_edge(self):
        result = evaluate(FIXTURES[0] | {'back_commission': 0.2, 'lay_commission': 0.2})
        self.assertFalse(result['approved'])

    def test_invalid_inputs_are_rejected(self):
        for quote in [FIXTURES[0] | {'lay_odds': 1}, FIXTURES[0] | {'back_commission': -1},
                      FIXTURES[0] | {'back_odds': float('nan')}]:
            with self.assertRaises(ValueError):
                evaluate(quote)


class WorkflowTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = str(Path(self.tmp.name) / 'test.sqlite3')
        self.app = create_app(self.path, speed=0.02)
        self.lifespan = self.app.router.lifespan_context(self.app)
        await self.lifespan.__aenter__()
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=self.app), base_url='http://test')

    async def asyncTearDown(self):
        await self.client.aclose()
        await self.lifespan.__aexit__(None, None, None)
        self.tmp.cleanup()

    async def snapshot(self):
        return (await self.client.get('/api/state')).json()

    async def finish(self, task_id):
        for _ in range(200):
            snap = await self.snapshot()
            task = next(t for t in snap['tasks'] if t['id'] == task_id)
            if task['status'] in ('Completed', 'Error') and not any(a['task_id'] == task_id for a in snap['agents']):
                return snap, task
            await asyncio.sleep(0.01)
        self.fail('Task did not complete and return workers to idle')

    async def test_idle_agents_stay_still(self):
        before = await self.snapshot()
        await asyncio.sleep(0.06)
        after = await self.snapshot()
        self.assertEqual(before['agents'], after['agents'])
        self.assertEqual(len(before['departments']), 6)
        self.assertEqual(len(before['agents']), 16)

    async def test_scan_is_task_driven_and_paper_order_is_idempotent(self):
        response = await self.client.post('/api/tasks', json={'department': 'arbitrage', 'stake': 100})
        self.assertEqual(response.status_code, 201)
        task_id = response.json()['id']
        seen_states = set()
        saw_route = False
        for _ in range(200):
            snap = await self.snapshot()
            crew = [a for a in snap['agents'] if a['department'] == 'arbitrage']
            seen_states.update(a['state'] for a in crew)
            for a in crew:
                if a['route']:
                    saw_route = True
                    self.assertEqual(a['state'], 'Moving')
                    self.assertEqual(a['task_id'], task_id)
                if a['state'] in ('Working', 'Reviewing'):
                    self.assertEqual(a['position'], a['station'])
            task = next(t for t in snap['tasks'] if t['id'] == task_id)
            if task['status'] == 'Completed' and all(a['state'] == 'Idle' for a in crew):
                break
            await asyncio.sleep(0.005)
        self.assertEqual(task['status'], 'Completed')
        self.assertTrue(saw_route)
        self.assertTrue({'Assigned','Moving','Working','Waiting','Reviewing','Completed','Idle'} <= seen_states)
        self.assertEqual(len(task['result']['opportunities']), 2)
        self.assertTrue(all(a['position'] == a['home'] for a in crew))
        first = await self.client.post('/api/paper-trades', json={'task_id':task_id})
        self.assertEqual(first.status_code, 201)
        duplicate = await self.client.post('/api/paper-trades', json={'task_id':task_id})
        self.assertEqual(duplicate.status_code, 409)
        snap = await self.snapshot()
        self.assertEqual(len(snap['trades']), 1)
        self.assertEqual(snap['treasury']['available'], 9784.92)
        self.assertEqual(snap['treasury']['real_revenue'], 0)
        self.assertFalse(snap['real_execution_enabled'])

    async def test_busy_crew_cannot_receive_duplicate_assignment(self):
        one = await self.client.post('/api/tasks', json={'department':'arbitrage'})
        two = await self.client.post('/api/tasks', json={'department':'arbitrage'})
        self.assertEqual(one.status_code, 201)
        self.assertEqual(two.status_code, 409)

    async def test_other_department_can_work_during_a_scan(self):
        scan = await self.client.post('/api/tasks', json={'department':'arbitrage'})
        etsy = await self.client.post('/api/tasks', json={'department':'etsy','agent_id':'loom'})
        self.assertEqual(etsy.status_code, 201)
        snap, task = await self.finish(etsy.json()['id'])
        self.assertEqual(task['status'], 'Completed')
        self.assertEqual(task['agent_ids'], ['loom'])
        self.assertIn('No listing was published', task['result']['lines'][-1])
        await self.finish(scan.json()['id'])

    async def test_validation_and_live_execution_guard(self):
        for body in [{'department':'arbitrage','stake':0},{'department':'arbitrage','stake':1001}]:
            self.assertEqual((await self.client.post('/api/tasks',json=body)).status_code,422)
        self.assertEqual((await self.client.post('/api/tasks',json={'department':'missing'})).status_code,409)
        self.assertEqual((await self.client.post('/api/tasks',json={'department':'etsy','agent_id':'risk'})).status_code,409)
        self.assertEqual((await self.client.post('/api/execute-live',json={})).status_code,403)
        self.assertEqual((await self.client.post('/api/paper-trades',json={'task_id':'missing'})).status_code,409)

    async def test_all_departments_produce_reports(self):
        for department in ['treasury','headquarters','retail','fiverr']:
            r = await self.client.post('/api/tasks',json={'department':department})
            self.assertEqual(r.status_code,201)
            _, task = await self.finish(r.json()['id'])
            self.assertEqual(task['status'],'Completed')
            self.assertTrue(task['result']['lines'])


class RestartTests(unittest.IsolatedAsyncioTestCase):
    async def test_history_and_trades_survive_restart_and_interruption_is_explicit(self):
        with tempfile.TemporaryDirectory() as folder:
            path = str(Path(folder)/'history.sqlite3')
            store = Store(path)
            task = dict(id='done',department='arbitrage',status='Completed',created=1,result={'test':True})
            store.save_task(task)
            store.add_trade('done',evaluate(FIXTURES[0]))
            store.save_task(dict(id='interrupted',department='etsy',status='Working',created=2))
            store.db.close()
            reopened = Store(path)
            engine = Engine(reopened)
            snap = engine.snapshot()
            self.assertEqual(snap['tasks'][0]['status'],'Error')
            self.assertIn('restarted',snap['tasks'][0]['error'])
            self.assertEqual(snap['tasks'][1],task)
            self.assertEqual(len(snap['trades']),1)
            self.assertEqual(snap['treasury']['available'],9784.92)
            await engine.close()
            reopened.db.close()


if __name__ == '__main__':
    unittest.main()
