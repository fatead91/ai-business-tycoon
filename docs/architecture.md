# Architecture and runtime contract

## One local service, one interactive client

The built Phaser/TypeScript client is served by FastAPI. SQLite is local; no broker, database service or cloud account is needed. Vite is used only to build or develop the client. The shipped build has no runtime CDN dependency.

`GET /api/state` returns departments, agents, tasks, events, paper orders, treasury values and server time. The browser polls sequentially every 450 ms; failed requests back off and show an offline state. The server continues its jobs while a tab is closed. Fresh clients interpolate an in-progress route using server time rather than restarting an animation.

## Task lifecycle and movement

`POST /api/tasks` accepts a department, optional department worker and a finite virtual stake between £1 and £1,000. All six arbitrage workers are reserved atomically on the event loop; conflicting assignments receive HTTP 409. Other departments can run independently.

An agent's backend state is authoritative:

1. **Assigned**: reservation and dispatch.
2. **Moving**: route includes waypoints, start time and duration. The browser animates that route. The worker is not marked at its destination until the duration elapses.
3. **Working**: the worker is at its workstation and processes the job.
4. **Waiting**: dependent evidence is not yet ready or the worker has delivered it.
5. **Reviewing**: a reviewer is at its own workstation checking evidence.
6. **Completed**: a report has been saved.
7. **Moving**, with activity “Returning to standby”: a task-completion event sends the worker back to its home position.
8. **Idle**: no route or assignment. No timer initiates another trip.

Failures become **Error**. Tasks survive a restart; in-flight tasks are marked interrupted and can be retried with a new assignment. Agent runtime state is recreated at standby after a process restart. Custom agent editing and indefinite autonomous schedules are outside the prototype.

The current execution adapter uses timed, explicit fixture work. For real services, replace the work inside `Engine.execute()` and `department_result()` with asynchronous adapters. Emit the same state transitions around actual work. Avoid placing credentials or network client code in the Phaser scene. Durable queueing and recovery are prerequisites for unattended production use.

## Paper arbitrage model

For back stake `B`, back odds `b`, lay odds `l`, back commission `cb` and lay commission `cl`, the two net outcomes are balanced with:

```text
lay stake L = B × (1 + (b − 1) × (1 − cb)) / (l − cl)
lay liability = L × (l − 1)
profit if selection wins = B × (b − 1) × (1 − cb) − lay liability
profit if selection loses = L × (1 − cl) − B
required capital = B + lay liability
```

Stakes and liability are rounded to pennies. The smaller rounded outcome is the estimated edge. A quote is rejected if either outcome is nonpositive, liquidity cannot cover either stake, or available virtual capital cannot cover the back stake plus lay liability. This isolated market model assumes the quoted commission applies to positive winnings on each leg; live exchange net-market commission rules may differ.

`POST /api/paper-trades` reevaluates a completed fixture scan against current paper capital. Each scan can reserve virtual capital once. A SQLite unique constraint prevents duplicate paper records; the reserve check and insertion share a transaction. Paper orders are deliberately left unsettled. Their estimated edge is not credited to capital or real revenue. `POST /api/execute-live` always rejects execution with HTTP 403; there is no supported runtime toggle.

## Before live integrations

Implement exchange adapters, authenticated read-only connections, event/selection matching, compatible market settlement rules, quote timestamps, currency handling, full-depth liquidity, rate limits and exchange-specific commission. Add realistic paper fills and settlement, rejection and partial-fill scenarios, unmatched exposure recovery, risk limits and audit records. Any future real-money mode requires separate implementation, tests and explicit user authorisation.
