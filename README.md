# RefHunters

[![CI](https://github.com/negarHosseinAliPour/Simplify-Hidden-Scientific-References/actions/workflows/ci.yml/badge.svg)](https://github.com/negarHosseinAliPour/Simplify-Hidden-Scientific-References/actions/workflows/ci.yml)

**RefHunters** is an AI-powered research assistant that helps you understand scientific papers. Upload a PDF, ask questions, and get intelligent answers with precise citations.

## What Is RefHunters?

RefHunters uses **3 specialized AI agents** to:
1. **Extract citations** from your uploaded paper
2. **Search and download** related papers from arXiv
3. **Answer your questions** with evidence from multiple sources
4. **Highlight exact locations** in the paper where information comes from

Think of it as having a research assistant that reads papers for you and answers questions with specific citations.

## Key Features

- 📄 **PDF Upload**: Upload papers or provide a DOI
- 🤖 **Multi-Agent AI**: 3 specialized agents work together to answer questions
- 🔍 **Smart Citations**: See exact paragraph, line, and sentence where information comes from
- 📚 **Related Papers**: Automatically finds and cites relevant arXiv papers
- 💬 **Interactive Q&A**: Ask follow-up questions and provide feedback
- ✨ **Beautiful UI**: Dual-pane workspace with PDF viewer and AI answers side-by-side

## System Architecture

```
┌─────────────┐         ┌─────────────┐
│             │         │             │
│  Frontend   │ ◄─────► │   Backend   │
│  (React)    │         │  (3 Agents) │
│             │         │             │
└─────────────┘         └──────┬──────┘
                               │
                    ┌──────────┼──────────┐
                    │          │          │
               ┌────▼───┐  ┌───▼────┐ ┌──▼────┐
               │ Redis  │  │ GROBID │ │ OpenAI│
               │(Memory)│  │  (PDF) │ │ (LLM) │
               └────────┘  └────────┘ └───────┘
```

### Components

1. **[Frontend](./Second-Frontend/README.md)** - React + Vite interface
   - Dual-pane PDF viewer and Q&A workspace
   - Citation highlighting and navigation
   
2. **[Backend](./Second-backend/README.md)** - Node.js + TypeScript
   - 3 AI agents: Coordinator, Evidence Collector, Answer Generator
   - API for query processing and feedback

3. **External Services**
   - **Redis**: Session and state storage
   - **GROBID**: PDF citation extraction
   - **OpenAI**: LLM for agent reasoning

## Quick Start

### Option A: Docker (one command)

Requires Docker and an LLM key (the free Gemini tier works).

```bash
cp Second-backend/.env.example Second-backend/.env   # add your key
docker compose up --build
```

Open **http://localhost:8080**. This starts Redis, GROBID, the backend and the frontend together.

### Option B: Run locally

#### Prerequisites

- Node.js (v20+)
- Redis server
- GROBID service (Docker)
- A Gemini or OpenAI API key

### 1. Setup Backend

```bash
cd Second-backend
npm install
cp .env.example .env  # Add your Gemini or OpenAI key
npm run dev
```

Backend will run on `http://localhost:3001`

### 2. Setup Frontend

```bash
cd Second-Frontend
npm install
npm run dev
```

Frontend will run on `http://localhost:5173` or `http://localhost:5174`

### 3. Start External Services

See **[OPERATIONS_GUIDE.md](./OPERATIONS_GUIDE.md)** for detailed commands to start:
- Redis
- GROBID

## How to Use

1. **Open the frontend** in your browser
2. **Upload a PDF** or provide a DOI
3. **Ask a question** about the paper
4. **View the answer** with highlighted citations in the PDF
5. **Click citations** to jump to exact locations
6. **Provide feedback** to improve future answers

## Documentation

- **[Backend README](./Second-backend/README.md)** - Agent architecture and API
- **[Frontend README](./Second-Frontend/README.md)** - UI features and tech stack
- **[Operations Guide](./OPERATIONS_GUIDE.md)** - How to start, stop, and check all services

## Environment Variables

### Backend (.env)
Copy `Second-backend/.env.example` to `Second-backend/.env` and pick one LLM provider.
RefHunters talks to any OpenAI-compatible endpoint, so switching provider needs no code change:

```env
LLM_PROVIDER=gemini            # openai | gemini | custom
GEMINI_API_KEY=your_key_here   # or OPENAI_API_KEY / LLM_API_KEY
LLM_MODEL_FAST=gemini-flash-lite-latest
LLM_MODEL_STRONG=gemini-flash-lite-latest
PORT=3001
GROBID_URL=http://localhost:8070
```

The free Gemini tier from Google AI Studio is enough to run the app without billing.

### Frontend (.env)
```env
VITE_API_URL=http://localhost:3001
```

## Testing

The backend has an automated test suite (Vitest) that runs on every push through GitHub Actions.
LLM calls are replaced by a scripted fake client, so the tests are deterministic, need no API key and cost nothing.

```bash
cd Second-backend
npm test          # run all tests once
npm run typecheck # TypeScript checks
```

What is covered:
- **LLM configuration**: provider detection, model overrides and clear errors for missing keys
- **GROBID parsing**: section extraction, page numbers and per-section citation mapping
- **LLM output parsing**: JSON wrapped in markdown or extra text
- **Agent A2's tool loop**: answer synthesis, removal of citations to non-existent evidence, and error paths

## Citation evaluation

`Second-backend/eval/questions.json` holds 18 questions about the MagNet paper (CVPR 2021): 12 about the paper itself and 6 that compare it with work it cites. The runner sends each one through the full agent pipeline and measures:

- **Section precision**: main-paper citations that point to a section which actually covers the question
- **Named-citation accuracy**: in comparison answers, citations attached to a named paper (e.g. "GLNet [5]") that point to that paper or to a section discussing it
- **External usage**: comparison answers that cite at least one downloaded reference

```bash
docker compose run --build --rm \
  -v "$PWD/path/to/magnet.pdf:/data/paper.pdf:ro" \
  -v "$PWD/Second-backend/eval/results:/app/eval/results" \
  backend npm run eval -- /data/paper.pdf --label baseline
```

Use `--only Q01,C06` to run a subset. Results are written to `Second-backend/eval/results/`.

## Tech Stack

**Frontend:**
- React, TypeScript, Vite, Tailwind CSS, PDF.js

**Backend:**
- Node.js, Express, TypeScript, LangGraph, OpenAI

**Services:**
- Redis, GROBID, arXiv API

## Project Structure

```
.
├── Second-backend/          # Backend (3 AI agents)
│   ├── src/
│   │   ├── agents/         # A0, A1, A2 agent logic
│   │   ├── routes/         # API endpoints
│   │   └── server.ts       # Express server
│   └── README.md
│
├── Second-Frontend/         # Frontend (React UI)
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── services/       # API client
│   │   └── store/          # State management
│   └── README.md
│
├── README.md               # This file
└── OPERATIONS_GUIDE.md     # Service management guide
```

## Need Help?

- **Can't start a service?** Check `OPERATIONS_GUIDE.md`
- **Backend not responding?** Run `curl http://localhost:3001/api/health`
- **Frontend can't connect?** Verify `VITE_API_URL` in `.env`
- **GROBID errors?** Ensure Docker container is running on port 8070
- **Redis errors?** Run `redis-cli ping` to check status

## License

MIT