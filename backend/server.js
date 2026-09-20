/**
 * server.js — Veridian IT Support Agent — Express API
 */

require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const { v4: uuidv4 } = require('uuid');

const agent = require('./agent');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ─── Load data ────────────────────────────────────────────────────────────────

const DATA_DIR = path.join(__dirname, 'data');

function loadJSON(filename) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, filename), 'utf-8'));
}

// In-memory stores (seeded from JSON files)
let employees       = loadJSON('employees.json');
let requestsStore   = loadJSON('requests.json');
let reqCounter      = requestsStore.length + 1;

// ─── Auth Routes ──────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Returns: employee profile (without password)
 */
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const emp = employees.find(
    e => e.email.toLowerCase() === email.toLowerCase() && e.password === password
  );

  if (!emp) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  // Return profile without password
  const { password: _pw, ...profile } = emp;
  return res.json({ employee: profile });
});

/**
 * POST /api/auth/signup
 * Body: { name, email, password, employmentType, department? }
 * Returns: employee profile
 */
app.post('/api/auth/signup', (req, res) => {
  const { name, email, password, employmentType, department } = req.body;

  if (!name || !email || !password || !employmentType) {
    return res.status(400).json({ error: 'Name, email, password and employment type are required.' });
  }

  if (!['FULL_TIME', 'CONTRACTOR'].includes(employmentType)) {
    return res.status(400).json({ error: 'employmentType must be FULL_TIME or CONTRACTOR.' });
  }

  const existing = employees.find(e => e.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const newEmp = {
    employeeId:     `EMP${String(employees.length + 1).padStart(3, '0')}`,
    name:           name.trim(),
    email:          email.toLowerCase().trim(),
    password,
    employmentType,
    department:     department || 'General'
  };

  employees.push(newEmp);

  const { password: _pw, ...profile } = newEmp;
  return res.status(201).json({ employee: profile });
});

// ─── Chat Route ───────────────────────────────────────────────────────────────

/**
 * POST /api/chat
 * Body: { message, employee?, email?, employeeId?, employmentType? }
 * Returns: agent response object
 */
app.post('/api/chat', async (req, res) => {
  const { message, employee, email, employeeId, employmentType } = req.body;

  if (!message || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({ error: 'Message is required.' });
  }

  try {
    const result = await agent.processMessage(message.trim(), {
      employee,
      email,
      employeeId,
      employmentType
    });
    return res.json(result);
  } catch (err) {
    console.error('Agent error:', err);
    return res.status(500).json({ error: 'Agent processing error.' });
  }
});

// ─── Requests Routes ──────────────────────────────────────────────────────────

/**
 * GET /api/requests
 * Returns all requests
 */
app.get('/api/requests', (req, res) => {
  return res.json(requestsStore);
});

/**
 * GET /api/requests/my/:employeeId
 * Returns requests belonging to a specific employee
 */
app.get('/api/requests/my/:employeeId', (req, res) => {
  const { employeeId } = req.params;
  const emp = employees.find(e => e.employeeId === employeeId);
  if (!emp) {
    return res.status(404).json({ error: 'Employee not found.' });
  }
  const myRequests = requestsStore.filter(
    r => r.email && r.email.toLowerCase() === emp.email.toLowerCase()
  );
  return res.json(myRequests);
});

/**
 * POST /api/requests
 * Body: { employeeId, category, request, note? }
 * Creates a new simulated request
 */
app.post('/api/requests', (req, res) => {
  const { employeeId, category, request, note } = req.body;

  if (!employeeId || !category || !request) {
    return res.status(400).json({ error: 'employeeId, category, and request are required.' });
  }

  const emp = employees.find(e => e.employeeId === employeeId);
  if (!emp) {
    return res.status(404).json({ error: 'Employee not found.' });
  }

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  const newReq = {
    id:            `REQ-${String(String(reqCounter++)).padStart(2, '0')}`,
    employee:      emp.name,
    email:         emp.email,
    employeeId:    emp.employeeId,
    employmentType: emp.employmentType,
    date:          today,
    request,
    category,
    initialAction: 'Submitted',
    status:        'Submitted',
    note:          note || ''
  };

  requestsStore.push(newReq);
  return res.status(201).json(newReq);
});

// ─── Existing Data Routes ─────────────────────────────────────────────────────

/**
 * GET /api/tickets
 */
app.get('/api/tickets', (req, res) => {
  try {
    const tickets = loadJSON('tickets.json');
    return res.json(tickets);
  } catch (err) {
    return res.status(500).json({ error: 'Could not load tickets.' });
  }
});

/**
 * GET /api/tickets/:ticketId
 */
app.get('/api/tickets/:ticketId', (req, res) => {
  const result = agent.getTicketHistory(req.params.ticketId);
  if (!result) {
    return res.status(404).json({ error: 'Ticket not found.' });
  }
  return res.json(result);
});

/**
 * GET /api/policies
 */
app.get('/api/policies', (req, res) => {
  try {
    const policies = loadJSON('policies.json');
    return res.json(policies);
  } catch (err) {
    return res.status(500).json({ error: 'Could not load policies.' });
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Veridian IT Support Agent', timestamp: new Date().toISOString() });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🟢 Veridian IT Support Agent Backend`);
  console.log(`   Running on: http://localhost:${PORT}`);
  console.log(`   Health:     http://localhost:${PORT}/api/health\n`);
});
