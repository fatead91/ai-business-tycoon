# First task implementation

## Goal

## Author's notes 
I think the easiest way to really run this would be locally. The agent needs to run locally so that it can post tasks statues to your backend, which is then ultimately visualised in your frontend. Below I've got copilot to suggest a first task implementation for this, which would just be using one of your existing agents to run a real task, and assign it to your agent headquarters department nova agent for now to see how it works as a proof of concept. You should be able to get AI to implement the notes given below.

Run one OpenAI Agents SDK task in the FastAPI backend, record its status and result in the existing task store, and show that data through `/api/state` and **Inspect report**. The browser remains a viewer. The agent never writes to SQLite directly.

## Task flow

1. `POST /api/tasks` creates and saves a task, then starts the SDK runner with its task ID and input.
2. The backend sets the task to `Working` when the run starts. An agent tool can report short progress messages through a backend function that appends to task history and the event log.
3. When the run succeeds, the backend saves the final output to `task.result` and marks the task `Completed`.
4. If the run fails, the backend saves a readable message to `task.error` and marks the task `Error`.
5. The frontend receives these updates through its existing `/api/state` polling and displays the saved result in the report.

`Engine.assign()` currently starts the simulated `Engine.execute()` workflow. Route the first SDK task through a separate runner instead; do not start both implementations for the same task. Keep task status changes and SQLite writes in the backend. The report UI already reads `result.summary`, `result.lines`, and `error`.

## Frontend request

Add a **Translate test sentence** action to the Agent Headquarters overview. It sends `department: "headquarters"`, `agent_id: "nova"`, `task_type: "translate_es"`, and the sentence to `POST /api/tasks`. NOVA, the Operations coordinator, is the visual worker; the SDK translator runs in the backend and is not a separate on-screen agent. Extend the request model and `Engine.assign()` to validate and dispatch this task type to the SDK runner. Do not send it through the current generic demonstration workflow.

The current form sends only a department, worker, and optional stake. It has no task type or sentence field, so the translation action must provide those values. For this first test, use the fixed sentence below. A text input can be added later. Make the report's simulated-output banner conditional so it does not label the SDK result as simulated.

## Translation example

Install the `openai-agents` package and add it to `requirements.txt`. Set `OPENAI_API_KEY` in the backend environment. Do not put the key in frontend code or commit it.

The first test uses `Good morning, how are you?` and asks the agent to translate it into Spanish. The backend sets the task to `Working`, then saves the runner's final output as the task summary. A progress tool is optional for this short task; add one when a task needs intermediate updates.

A reporting tool can be scoped to the task ID by passing backend context to the runner:

```python
from dataclasses import dataclass
from agents import Agent, RunContextWrapper, Runner, function_tool

@dataclass
class TaskContext:
    task_id: str

@function_tool
async def report_progress(ctx: RunContextWrapper[TaskContext], message: str) -> str:
    engine.report_progress(ctx.context.task_id, message)
    return "Progress recorded"

translator = Agent(
    name="Spanish translator",
    instructions="Translate the given sentence into Spanish. Return only the translation.",
    tools=[report_progress],
)

result = await Runner.run(
    translator,
    "Good morning, how are you?",
    context=TaskContext(task_id=task_id),
)
engine.complete_task(task_id, summary=result.final_output)
```

Implement `report_progress()` in the backend so it validates the task is still active, limits message length, and records the event. Wrap the runner call in `try`/`except` and call a backend failure method on errors. The model controls whether it calls the progress tool, so the backend must set the initial and terminal statuses itself.

## First test limits

Use one task at a time, a short input, a run timeout, and a turn limit. Keep the agent limited to translation and the progress tool. Test successful output, runner failure, and server restart before adding file access, web access, or other actions. The current backend marks unfinished tasks as interrupted on restart; durable job recovery is a later step.

*This implementation can use another agent SDK of your choice, such as Claude Code, if it can report task status and results to this backend.*
