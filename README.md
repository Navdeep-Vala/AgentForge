# AgentForge — AI Multi-Agent Coding Team

A self-hosted, browser-based multi-agent AI system for solo developers. Spin up a team of specialized AI agents (Manager, Researcher, Coder, Tester, R&D Analyst) that autonomously collaborate on software development tasks, visualized on a real-time Kanban board.

## Setup

1. Clone the repo
2. Run: `npm run install:all`
3. Copy `backend/.env.example` → `backend/.env`
4. Add your OpenRouter API key (free at openrouter.ai)
5. Create a MySQL database named `agentforge`
6. Update MySQL credentials in `backend/.env`
7. Run: `npm run dev`
8. Open: http://localhost:5173

## Getting a Free OpenRouter Key

1. Go to https://openrouter.ai
2. Sign up (free)
3. Go to API Keys → Create Key
4. Copy the key to `backend/.env`

## MySQL Setup

Make sure you have MySQL running locally, then:

```sql
CREATE DATABASE agentforge CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

The app will auto-create all tables on first startup.

## Adding Custom Agents

Click "Manage Agents" in the top nav → "Add Custom Agent"
Fill in the form and choose any free model from the dropdown.
Your new agent will appear in the Kanban board on the next run.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + Zustand
- **Backend**: Node.js + Express 5 + TypeScript
- **Database**: MySQL (via mysql2)
- **AI**: OpenRouter API (free tier models)

## Free Models Supported

- `deepseek/deepseek-r1:free` — best for coding tasks
- `meta-llama/llama-3.3-70b-instruct:free` — best for reasoning/planning
- `google/gemini-2.0-flash-exp:free` — fast, good for research
- `mistralai/mistral-7b-instruct:free` — lightweight fallback
