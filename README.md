# 🛡️ Veridian IT Support Agent

An internal employee IT helpdesk AI agent prototype for **Veridian Corp**.

Built for an Internal Service Agent assessment (21–25 September 2026).

---

## Problem Statement

Veridian Corp employees need a fast, consistent IT support experience without long wait times or misinformation. This agent provides instant, policy-grounded responses — resolving simple issues, routing department-owned requests, escalating risky ones, and always showing its sources.

---

## Features

| Feature | Description |
|---|---|
| 🧠 **Policy-grounded** | Answers only from the supplied KB and data files |
| 🔍 **Intent detection** | Identifies the employee's issue category |
| ❓ **Follow-up questions** | Asks for clarification only when needed |
| ✅ **Resolution** | Self-service guidance for solvable issues |
| 🚨 **Escalation** | Raises simulated tickets for high-risk/complex issues |
| ↪️ **Routing** | Routes finance/manager-owned requests correctly |
| 🎫 **Simulated tickets** | Structured JSON ticket on every escalation |
| 📋 **Audit trail** | Timestamped agent decision log |
| 📌 **Source citation** | Every answer cites the KB article or ticket used |
| 🌑 **Dark enterprise UI** | Professional React dashboard |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, Vanilla CSS |
| Backend | Node.js, Express 4 |
| Agent | Deterministic rule-based engine (no external AI API) |
| Data | Local JSON files |

---

## Architecture

```
React Frontend  (Vite, port 5173)
       │
       │  POST /api/chat
       ▼
Express API  (server.js, port 3001)
       │
       ▼
Agent Engine  (agent.js)
       │  Tools:
       │  ├── searchPolicies(query)
       │  ├── searchRequests(query)
       │  ├── searchTickets(query)
       │  ├── getTicketHistory(ticketId)
       │  ├── createTicket(ticketData)
       │  └── escalateRequest(requestData)
       │
       ▼
┌─────────────────────────┐
│  data/policies.json     │  10 KB articles + Asset Mgmt Policy
│  data/requests.json     │  15 employee requests (REQ-01…15)
│  data/tickets.json      │  10 existing tickets (TK-1042…51)
└─────────────────────────┘
       │
       ▼
Decision: RESOLVED | NEEDS_INFORMATION | ESCALATE | ROUTE_TO_TEAM
       │
       ▼
Simulated Ticket (SIM-TK-XXXX) + Audit Trail → Response
```

---

## Agent Workflow

```
1. Receive employee message
2. Detect intent (keyword/rule matching)
3. Search policies (keyword scoring)
4. Check existing tickets if relevant
5. Determine if information is sufficient
   └─ If not → ask clarification question (NEEDS_INFORMATION)
6. Apply decision logic:
   ├─ RESOLVED       → self-service guidance
   ├─ ESCALATE       → create simulated ticket + escalation response
   └─ ROUTE_TO_TEAM  → identify correct team (Finance / Manager)
7. Cite sources used
8. Record all steps in audit trail
```

---

## Tools

| Tool | Description |
|---|---|
| `searchPolicies(query)` | Keyword-scored search over `policies.json` |
| `searchRequests(query)` | Search employee requests by keyword |
| `searchTickets(query)` | Search ticket queue by keyword |
| `getTicketHistory(ticketId)` | Fetch a specific ticket by ID |
| `createTicket(ticketData)` | Create an in-memory simulated ticket |
| `escalateRequest(requestData)` | Shorthand to create escalation ticket |

---

## Data Sources

| File | Contents |
|---|---|
| `backend/data/policies.json` | KB-01 … KB-10 + Asset Management Policy |
| `backend/data/requests.json` | REQ-01 … REQ-15 (15 employee requests) |
| `backend/data/tickets.json` | TK-1042 … TK-1051 (10 existing tickets) |

---

## Assumptions

1. The prototype only uses the supplied Veridian data — no external knowledge is used.
2. The AI cannot perform real enterprise IT actions (password resets, VPN provisioning, etc.).
3. Tickets created by the prototype are clearly labelled **SIMULATED** (SIM-TK-XXXX).
4. Human escalation is represented through routing / ticket creation.
5. The agent asks for clarification only when required information is genuinely missing.
6. The agent never invents policies when information is unavailable.
7. Laptop replacement requests are evaluated against **both** KB-03 and the Asset Management Policy.

---

## Setup Instructions

### Prerequisites

- Node.js v18+ ([nodejs.org](https://nodejs.org))
- npm v9+

### 1. Install backend dependencies

```bash
cd backend
npm install
```

### 2. Install frontend dependencies

```bash
cd frontend
npm install
```

---

## Environment Variables

No environment variables are required. The prototype uses local JSON data files and no external APIs.

---

## Run Commands

### Start the backend (terminal 1)

```bash
cd backend
node server.js
```

Backend runs on: **http://localhost:3001**

### Start the frontend (terminal 2)

```bash
cd frontend
npm run dev
```

Frontend runs on: **http://localhost:5173**

Open **http://localhost:5173** in your browser.

---

## Demo Scenarios

Test all 8 scenarios via the quick-select chips on the home screen, or type them manually:

| # | Message | Expected Decision | Source |
|---|---|---|---|
| 1 | "Can I get Wi-Fi access for a guest visiting tomorrow?" | RESOLVED | KB-07 |
| 2 | "I'm locked out of my account, tried my password 6 times." | ESCALATE | KB-01 |
| 3 | "I think I got a phishing email asking for my login." | ESCALATE | KB-09 |
| 4 | "hey can you help, its not working" | NEEDS_INFORMATION | — |
| 5 | "My VPN says my credentials expired." | RESOLVED | KB-02 |
| 6 | "I can't log into the expense management tool." | ROUTE_TO_TEAM | KB-08 |
| 7 | "A contractor needs VPN access." | ROUTE_TO_TEAM | KB-02 |
| 8 | "My laptop won't turn on. I've had it about 3.5 years." | ESCALATE | KB-03 + Asset Mgmt |

---

## UI Layout

```
┌─────────────────────────────────────────────────────┐
│  🛡️ VERIDIAN IT SUPPORT AGENT           ● Agent Online │
├──────────────────────────────────┬──────────────────┤
│                                  │  🔍 CASE ANALYSIS │
│         CHAT PANEL               │  ─────────────── │
│  [Employee Message]              │  Intent           │
│  [AI Response + Decision badge]  │  Category         │
│                                  │  Decision         │
│  ...                             │  Risk             │
│                                  │  Status           │
│  [employee selector]             │  ─────────────── │
│  [message input]    [↑ Send]    │  📋 SOURCE USED   │
├──────────────────────────────────┴──────────────────┤
│  📋 Audit Trail  |  🎫 Simulated Ticket              │
│  14:32:01 — Request received                         │
│  14:32:02 — Intent identified: VPN                   │
└─────────────────────────────────────────────────────┘
```

---

## Limitations

- No authentication — any user can send any message.
- No persistent storage — simulated tickets are in-memory and reset on server restart.
- No real IT actions are performed (this is a prototype/demo).
- Agent uses rule-based keyword matching, not an LLM — very complex or unusual phrasings may not match correctly.
- No multi-turn conversation context (each message is processed independently).
- Not designed for production deployment.
