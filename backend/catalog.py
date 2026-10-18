"""Shared world metadata. Add a department and its workers here to expand the station."""
ROOMS = [
    dict(id='arbitrage', name='Arbitrage Betting', code='ARB', color='#b9f36b', x=100, y=90,
         description='Exchange intelligence, commission-aware evaluation and paper execution.', job='Scan exchange fixtures',
         workers=[('scout', 'SCOUT', 'Scanning agent'), ('betfair', 'BEX', 'Betfair exchange worker'),
                  ('smarkets', 'SMAX', 'Smarkets exchange worker'), ('matchbook', 'MATCH', 'Matchbook exchange worker'),
                  ('risk', 'AEGIS', 'Risk management'), ('controller', 'ATLAS', 'Central controller')]),
    dict(id='treasury', name='Treasury', code='TRS', color='#e9c96a', x=880, y=90,
         description='Capital, exposure and transparent financial records across the station.', job='Reconcile paper ledger',
         workers=[('ledger', 'LEDGER', 'Financial analyst'), ('vault', 'VAULT', 'Capital allocator')]),
    dict(id='etsy', name='Etsy Studio', code='ETS', color='#e6ad83', x=100, y=420,
         description='Product research and listing preparation. Marketplace access is not connected.', job='Research a product concept',
         workers=[('muse', 'MUSE', 'Product researcher'), ('loom', 'LOOM', 'Listing specialist')]),
    dict(id='headquarters', name='Agent Headquarters', code='HQ', color='#a5a2ff', x=880, y=420,
         description='Assign purposeful work and inspect the agents behind your operations.', job='Run station diagnostics',
         workers=[('nova', 'NOVA', 'Operations coordinator'), ('orbit', 'ORBIT', 'Systems engineer')]),
    dict(id='retail', name='Retail Arbitrage', code='RTL', color='#78c9e8', x=100, y=750,
         description='Compare fixture prices and review resale margins before committing capital.', job='Compare sample products',
         workers=[('sift', 'SIFT', 'Product analyst'), ('margin', 'MARGIN', 'Margin researcher')]),
    dict(id='fiverr', name='Fiverr Workshop', code='FVR', color='#82d9b4', x=880, y=750,
         description='Service ideation and fulfilment planning. No marketplace orders are placed.', job='Prepare a service outline',
         workers=[('craft', 'CRAFT', 'Service designer'), ('brief', 'BRIEF', 'Delivery planner')]),
]


def departments():
    return [{k: v for k, v in room.items() if k != 'workers'} | {'width': 480, 'height': 250}
            for room in ROOMS]


def initial_agents():
    agents = []
    for room in ROOMS:
        for i, (identifier, name, role) in enumerate(room['workers']):
            col, row = i % 3, i // 3
            home = [room['x'] + 75 + col * 140, room['y'] + 131 + row * 91]
            station = [room['x'] + 98 + col * 140, room['y'] + 101 + row * 91]
            agents.append(dict(id=identifier, name=name, role=role, department=room['id'],
                               color=room['color'], home=home, station=station, position=home[:],
                               state='Idle', state_since=0, task_id=None, route=None, activity='Awaiting assignment'))
    return agents
