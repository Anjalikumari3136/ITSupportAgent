/**
 * agent.js — Veridian IT Support Agent Engine
 *
 * LLM-powered agentic workflow grounded exclusively in the
 * supplied JSON data (policies, requests, tickets).
 *
 * Tools:
 *   searchPolicies(query)
 *   searchRequests(query)
 *   searchTickets(query)
 *   getTicketHistory(ticketId)
 *   createTicket(ticketData)
 *   escalateRequest(requestData)
 *
 * Decision types: RESOLVED | NEEDS_INFORMATION | ESCALATE | ROUTE_TO_TEAM
 *
 * Response generation: Google Gemini API (gemini-1.5-flash)
 * The LLM reasons over retrieved policy evidence and the user's specific
 * message to produce a dynamic, grounded response — NOT a predefined string.
 */

require('dotenv').config();

const fs   = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { GoogleGenAI } = require('@google/genai');

// ─── Gemini Setup ─────────────────────────────────────────────────────────────

const GEMINI_MODEL          = process.env.GEMINI_MODEL          || 'gemini-3.6-flash';
const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.5-flash';

console.log('Gemini API key loaded:', !!process.env.GEMINI_API_KEY);
console.log('Gemini model:         ', GEMINI_MODEL);
console.log('Gemini fallback model:', GEMINI_FALLBACK_MODEL);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// ─── Load datasets ────────────────────────────────────────────────────────────

const DATA_DIR = path.join(__dirname, 'data');

function loadData(filename) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, filename), 'utf-8'));
}

let policies = loadData('policies.json');
let tickets  = loadData('tickets.json');
let requests = loadData('requests.json');

// In-memory store for simulated tickets created during this session
let simulatedTickets = [];
let ticketCounter    = 1;

// ─── Tools ───────────────────────────────────────────────────────────────────

/**
 * searchPolicies — keyword search over policies
 * Returns array of matched policies sorted by relevance score.
 */
function searchPolicies(query) {
  const q     = query.toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);

  const scored = policies.map(policy => {
    let score = 0;
    const searchText = [
      policy.title,
      policy.content,
      ...(policy.keywords || [])
    ].join(' ').toLowerCase();

    for (const word of words) {
      if (word.length < 3) continue;
      const count = (searchText.match(new RegExp(word, 'g')) || []).length;
      score += count;
    }
    // Keyword-list exact matches score higher
    for (const kw of (policy.keywords || [])) {
      if (q.includes(kw.toLowerCase())) score += 5;
    }
    return { policy, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(s => s.policy);
}

/**
 * searchRequests — search employee requests by keyword
 */
function searchRequests(query) {
  const q = query.toLowerCase();
  return requests.filter(r =>
    r.employee.toLowerCase().includes(q) ||
    r.request.toLowerCase().includes(q) ||
    r.category.toLowerCase().includes(q)
  );
}

/**
 * searchTickets — search tickets by keyword or status
 */
function searchTickets(query) {
  const q = query.toLowerCase();
  return tickets.filter(t =>
    t.ticketId.toLowerCase().includes(q) ||
    t.employee.toLowerCase().includes(q) ||
    t.issue.toLowerCase().includes(q) ||
    t.category.toLowerCase().includes(q) ||
    t.status.toLowerCase().includes(q)
  );
}

/**
 * getTicketHistory — fetch a specific ticket by ID
 */
function getTicketHistory(ticketId) {
  const allTickets = [...tickets, ...simulatedTickets];
  return allTickets.find(t => t.ticketId === ticketId) || null;
}

/**
 * createTicket — create a simulated ticket
 */
function createTicket(ticketData) {
  const ticket = {
    ticketId:  `SIM-TK-${String(ticketCounter++).padStart(4, '0')}`,
    ...ticketData,
    status:    ticketData.status || 'Escalated',
    createdAt: new Date().toISOString(),
    simulated: true
  };
  simulatedTickets.push(ticket);
  return ticket;
}

/**
 * escalateRequest — creates a structured escalation ticket
 */
function escalateRequest(requestData) {
  return createTicket({ ...requestData, status: 'Escalated' });
}

// ─── Audit Trail ─────────────────────────────────────────────────────────────

function makeAudit(entries) {
  return entries.map(entry => ({
    timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false }),
    ...entry
  }));
}

// ─── Intent Detection ─────────────────────────────────────────────────────────
// Used only to build a good search query; no longer used to route responses.

function detectIntent(message) {
  const m = message.toLowerCase();

  // Ambiguous / unclear
  const ambiguousPatterns = [
    /^hey\s*can you help/i,
    /^it('?s| is) not working/i,
    /^(help|please help)\s*[,.]?\s*$/i,
    /^not working\s*$/i
  ];
  if (
    ambiguousPatterns.some(p => p.test(message.trim())) ||
    (message.split(' ').length <= 6 && !hasSpecificKeyword(m))
  ) {
    return {
      label: 'Unclear request',
      searchQuery: message,
      needsClarification: false   // Let the LLM ask the follow-up
    };
  }

  // Phishing / security incident
  if (/phish|malware|virus|suspicious email|unauthorized access|hack|security threat|scam/.test(m)) {
    return { label: 'Security Incident', searchQuery: 'phishing security incident unauthorized access', needsClarification: false };
  }

  // Password / account lockout
  if (/locked out|lock out|lockout|password.*reset|reset.*password|forgot.*password|failed.*attempt|wrong password/.test(m)) {
    return { label: 'Password / Account Lockout', searchQuery: 'password reset locked out account', needsClarification: false };
  }

  // VPN
  if (/vpn|virtual private network|credentials.*expired|expired.*credentials|remote access/.test(m)) {
    if (/contractor/.test(m)) {
      return { label: 'VPN Access — Contractor', searchQuery: 'vpn contractor access', needsClarification: false };
    }
    return { label: 'VPN Access', searchQuery: 'vpn credentials expired', needsClarification: false };
  }

  // Laptop
  if (/laptop|macbook|computer|pc|machine/.test(m)) {
    if (/flicker|screen|display|monitor/.test(m)) {
      return { label: 'Laptop Hardware Issue (Screen)', searchQuery: 'laptop replacement hardware failure', needsClarification: false };
    }
    if (/won'?t turn on|dead|not turning on|broken|crashed|replacement|replace/.test(m)) {
      return { label: 'Laptop Hardware Failure / Replacement', searchQuery: 'laptop replacement hardware failure', needsClarification: false };
    }
    return { label: 'Laptop Issue', searchQuery: 'laptop replacement hardware', needsClarification: false };
  }

  // Printer
  if (/print|printer|paper jam|spooler|queue/.test(m)) {
    return { label: 'Printer Issue', searchQuery: 'printer paper jam troubleshooting', needsClarification: false };
  }

  // Software / browser extension
  if (/software|install|extension|browser extension|application|app|catalog/.test(m)) {
    return { label: 'Software Installation', searchQuery: 'software installation catalog security review', needsClarification: false };
  }

  // Email / mailbox
  if (/email|mailbox|mail.*full|quota|inbox/.test(m)) {
    return { label: 'Email Mailbox Quota', searchQuery: 'email mailbox quota full', needsClarification: false };
  }

  // Wi-Fi / guest
  if (/wi-?fi|wireless|guest.*access|guest.*wifi|visitor/.test(m)) {
    return { label: 'Guest Wi-Fi Access', searchQuery: 'guest wifi access', needsClarification: false };
  }

  // Expense tool
  if (/expense|concur|expense tool|expense management|expense report/.test(m)) {
    return { label: 'Expense Software Access', searchQuery: 'expense software access login', needsClarification: false };
  }

  // WFH / home office
  if (/work.?from.?home|wfh|home office|remote.*monitor|monitor.*remote|chair|equipment.*remote|allowance/.test(m)) {
    return { label: 'Work-From-Home Equipment', searchQuery: 'work from home equipment monitor allowance', needsClarification: false };
  }

  // Admin access
  if (/admin access|administrator|admin.*server|server.*access|elevated access/.test(m)) {
    return { label: 'Admin Access Request', searchQuery: 'admin access server', needsClarification: false };
  }

  // Contractor VPN (fall-through)
  if (/contractor/.test(m)) {
    return { label: 'Contractor Access', searchQuery: 'vpn contractor', needsClarification: false };
  }

  // Default — unknown
  return {
    label: 'General IT Request',
    searchQuery: message,
    needsClarification: false
  };
}

function hasSpecificKeyword(m) {
  const keywords = [
    'vpn', 'password', 'laptop', 'printer', 'email', 'wifi', 'wi-fi', 'software', 'expense',
    'mailbox', 'remote', 'monitor', 'phish', 'virus', 'malware', 'admin', 'account', 'locked',
    'install', 'extension', 'quota', 'contractor', 'screen', 'flicker', 'hardware'
  ];
  return keywords.some(kw => m.includes(kw));
}

// ─── LLM Agent Core ───────────────────────────────────────────────────────────

/**
 * buildLLMPrompt — assemble the full context prompt for Gemini.
 *
 * The LLM receives:
 *   - The employee's actual message
 *   - Retrieved policy content (raw facts, NOT predefined answers)
 *   - Relevant existing tickets (if any)
 *   - Relevant employee requests (if any)
 *   - Agent decision rules and output format
 */
function buildLLMPrompt({ userMessage, matchedPolicies, relatedTickets, relatedRequests, employee, email, employmentType, employeeId }) {
  const policiesBlock = matchedPolicies.length > 0
    ? matchedPolicies.map(p =>
        `### ${p.id} — ${p.title}\n${p.content}` +
        (p.selfServeNote ? `\nSelf-serve note: ${p.selfServeNote}` : '') +
        (p.resolution    ? `\nResolution guidance: ${p.resolution}` : '') +
        (p.requiresEscalation ? `\nRequires escalation: YES → ${p.escalateTo || 'IT Team'}` : '\nRequires escalation: NO') +
        (p.canSelfServe  ? '\nCan self-serve: YES' : '\nCan self-serve: NO') +
        (p.routeTo       ? `\nRoute to: ${p.routeTo}` : '') +
        (p.escalateEmail ? `\nEscalate email: ${p.escalateEmail}` : '')
      ).join('\n\n')
    : 'No matching policies found in the knowledge base.';

  const ticketsBlock = relatedTickets.length > 0
    ? relatedTickets.map(t =>
        `- Ticket ${t.ticketId}: [${t.status}] ${t.issue || t.issueSummary || ''} (Employee: ${t.employee})`
      ).join('\n')
    : 'No related tickets found.';

  const requestsBlock = relatedRequests.length > 0
    ? relatedRequests.map(r =>
        `- ${r.employee}: "${r.request}" [Status: ${r.status}] [Category: ${r.category}]`
      ).join('\n')
    : 'No related employee requests found.';

  return `You are the Veridian IT Support Agent — an intelligent AI assistant for Veridian Corp's internal IT helpdesk.

## YOUR ROLE
You reason over company policy facts to generate helpful, accurate, and situation-specific responses. You do NOT invent policies or facts. Every claim you make must be grounded in the retrieved policies below.

## RETRIEVED COMPANY POLICIES (use these as evidence)
${policiesBlock}

## RELATED EXISTING TICKETS
${ticketsBlock}

## RELATED EMPLOYEE REQUESTS
${requestsBlock}

## EMPLOYEE INFORMATION
${employee       ? `Name: ${employee}`                     : 'Name: Unknown'}
${email          ? `Email: ${email}`                        : ''}
${employeeId     ? `Employee ID: ${employeeId}`             : ''}
${employmentType ? `Employment type: ${employmentType}` : 'Employment type: Unknown'}

## IMPORTANT CONTEXT FOR EMPLOYMENT-TYPE-AWARE POLICIES
${employmentType === 'CONTRACTOR'
  ? 'This employee is a CONTRACTOR. Policies that differ for contractors (e.g., VPN requires manager approval for contractors) MUST reflect contractor rules.'
  : employmentType === 'FULL_TIME'
    ? 'This employee is a FULL_TIME employee. Standard employee policies apply unless otherwise noted.'
    : 'Employment type is unknown. Apply general policy guidance and note if the answer may differ by employment type.'}

## EMPLOYEE'S MESSAGE
"${userMessage}"

## DECISION RULES
- RESOLVED: The issue can be fully addressed using self-service or by providing clear policy guidance.
- NEEDS_INFORMATION: You don't have enough detail to help. Ask ONE specific, useful follow-up question.
- ESCALATE: The issue requires IT or another team to take a manual action (e.g., account unlock, security incident, hardware failure). Create a ticket.
- ROUTE_TO_TEAM: The request must go to a specific team (e.g., Finance, Manager) before IT can act. May or may not need a ticket.

## STRICT RULES — NEVER VIOLATE THESE
1. NEVER invent company policies, approval rules, departments, timelines, ticket statuses, or permissions.
2. NEVER return the full raw policy text as your answer. Reason over it — apply it to the user's specific situation.
3. If the same KB applies to two different situations (e.g., "forgot password" vs "locked out after 6 attempts"), your response must reflect the SPECIFIC situation in the user's message.
4. If you need a ticket, set needsTicket=true and fill in ticketData precisely.
5. If you're unsure, ask a clarifying question (NEEDS_INFORMATION) instead of guessing.
6. Always cite the source KB(s) you used.
7. Format your response using markdown (bold, bullet points). Be concise and helpful.

## OUTPUT FORMAT
Respond with ONLY a valid JSON object, no markdown fences, no explanation outside the JSON:
{
  "decision": "RESOLVED" | "NEEDS_INFORMATION" | "ESCALATE" | "ROUTE_TO_TEAM",
  "response": "<markdown formatted response to show the employee>",
  "reasoning": "<internal reasoning: what situation did you detect, which policies applied, why this decision>",
  "needsTicket": true | false,
  "ticketData": {
    "category": "<category>",
    "issueSummary": "<brief summary>",
    "priority": "Low" | "Medium" | "High",
    "reasonForEscalation": "<why escalated>",
    "recommendedNextAction": "<what IT/team should do>",
    "source": "<KB IDs used>"
  } | null,
  "sources": [
    { "id": "<KB-XX>", "title": "<policy title>" }
  ],
  "risk": "Low" | "Medium" | "High",
  "category": "<short category label for the case analysis panel>"
}`;
}

// ─── Retry helpers ────────────────────────────────────────────────────────────

/** Returns true for transient errors that are worth retrying */
function isRetryableError(err) {
  const status = err.status || err.httpStatus || err.code ||
                 (err.message && err.message.match(/(\d{3})/)?.[1]);
  return ['503', '500', '429', '408', 503, 500, 429, 408].includes(status);
}

/** Promise-based sleep */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * callModelOnce — single Gemini API call for a given model name.
 */
async function callModelOnce(modelName, prompt) {
  const response = await ai.models.generateContent({
    model:    modelName,
    contents: prompt,
    config: {
      temperature:      0.3,   // Low for factual, grounded responses
      responseMimeType: 'application/json'
    }
  });

  const text    = response.text.trim();
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  return JSON.parse(cleaned);
}

/**
 * callGemini — exponential backoff retry on primary model, then fallback.
 *
 * Retry schedule (primary model):
 *   attempt 1 → immediate
 *   attempt 2 → wait ~1 s
 *   attempt 3 → wait ~2 s
 * If all 3 primary attempts fail with retryable errors → try fallback once.
 * If fallback also fails → throw with clear message.
 */
async function callGemini(prompt) {
  const MAX_ATTEMPTS = 3;

  // ── Primary model with retry ────────────────────────────────────────────
  let lastPrimaryErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`Gemini primary attempt ${attempt} (${GEMINI_MODEL})`);
    try {
      const result = await callModelOnce(GEMINI_MODEL, prompt);
      console.log('Gemini response received');
      return result;
    } catch (err) {
      lastPrimaryErr = err;
      console.error(`❌ Gemini primary attempt ${attempt} failed:`, err.message || err);
      if (err.status)        console.error('   HTTP status:', err.status);
      if (err.errorDetails)  console.error('   Details:', JSON.stringify(err.errorDetails));

      if (!isRetryableError(err) || attempt === MAX_ATTEMPTS) break;

      const waitMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s
      console.log(`   Retrying in ${waitMs / 1000}s...`);
      await sleep(waitMs);
    }
  }

  // ── Fallback model (single attempt) ────────────────────────────────────
  console.log('Primary model unavailable. Trying fallback model:', GEMINI_FALLBACK_MODEL);
  try {
    const result = await callModelOnce(GEMINI_FALLBACK_MODEL, prompt);
    console.log('Gemini response received (via fallback model)');
    return result;
  } catch (fallbackErr) {
    console.error('❌ Fallback model also failed:', fallbackErr.message || fallbackErr);
    // Throw a combined error so the caller can surface it to the user
    const combinedMsg = `Primary (${GEMINI_MODEL}): ${lastPrimaryErr?.message || lastPrimaryErr}. ` +
                        `Fallback (${GEMINI_FALLBACK_MODEL}): ${fallbackErr.message || fallbackErr}`;
    throw new Error(combinedMsg);
  }
}

// ─── LLM-based Decision Logic ─────────────────────────────────────────────────

/**
 * applyDecisionLogic — replaces the previous 780-line if/else block.
 *
 * Now async: retrieves evidence with tools, calls Gemini, and interprets
 * the structured JSON to optionally create a ticket.
 */
async function applyDecisionLogic(intent, message, context, addAudit) {
  // ── Tool calls: gather evidence ───────────────────────────────────────────
  const searchQuery    = intent.searchQuery || message;
  const matchedPolicies = searchPolicies(searchQuery);
  addAudit('KB search', searchQuery);

  if (matchedPolicies.length > 0) {
    addAudit('Policies matched', matchedPolicies.map(p => `${p.id} — ${p.title}`).join(', '));
  } else {
    addAudit('KB search', 'No direct policy match found');
  }

  // Also fetch broadly from the full message for more coverage
  const broadMatches = searchPolicies(message);
  const allPolicies  = [...matchedPolicies];
  for (const p of broadMatches) {
    if (!allPolicies.find(x => x.id === p.id)) allPolicies.push(p);
  }
  const topPolicies = allPolicies.slice(0, 4); // Top 4 most relevant

  const relatedTickets  = searchTickets(searchQuery).slice(0, 3);
  const relatedRequests = searchRequests(searchQuery).slice(0, 3);

  if (relatedTickets.length > 0) {
    addAudit('Related tickets found', relatedTickets.map(t => t.ticketId).join(', '));
  }

  // ── Build prompt & call LLM ───────────────────────────────────────────────
  addAudit('LLM reasoning', 'Sending context to Gemini for analysis...');

  const prompt = buildLLMPrompt({
    userMessage:     message,
    matchedPolicies: topPolicies,
    relatedTickets,
    relatedRequests,
    employee:        context.employee,
    email:           context.email,
    employmentType:  context.employmentType,
    employeeId:      context.employeeId
  });

  let llmResult;
  try {
    llmResult = await callGemini(prompt);
    console.log('Gemini response received. Decision:', llmResult.decision);
  } catch (err) {
    // Both primary and fallback exhausted — log full error and return clear message to user
    console.error('\n❌ Gemini service unavailable (both models failed):', err.message || err);
    const errMessage = err.message || String(err);
    addAudit('LLM error', 'Both primary and fallback Gemini models failed');
    return {
      decision: 'NEEDS_INFORMATION',
      response: '⚠️ **AI service is temporarily unavailable. Please try again in a moment.**',
      sources:  [],
      ticket:   null,
      caseAnalysis: {
        intent:   intent.label,
        category: 'System Error',
        decision: 'NEEDS_INFORMATION',
        risk:     'Low',
        status:   'AI service temporarily unavailable — see backend console'
      }
    };
  }

  addAudit('LLM decision', llmResult.decision);
  addAudit('LLM reasoning summary', llmResult.reasoning?.substring(0, 120) || '');

  // ── Conditionally call tools based on LLM decision ────────────────────────
  let ticket = null;

  if (llmResult.needsTicket && llmResult.ticketData) {
    const td = llmResult.ticketData;

    if (llmResult.decision === 'ESCALATE') {
      ticket = escalateRequest({
        employee:             context.employee || 'Unknown',
        employeeEmail:        context.email    || 'Unknown',
        category:             td.category               || 'IT Request',
        issueSummary:         td.issueSummary           || message,
        source:               td.source                 || (topPolicies[0] ? `${topPolicies[0].id} — ${topPolicies[0].title}` : 'No KB matched'),
        priority:             td.priority               || 'Medium',
        reasonForEscalation:  td.reasonForEscalation    || '',
        recommendedNextAction: td.recommendedNextAction || ''
      });
    } else {
      ticket = createTicket({
        employee:             context.employee || 'Unknown',
        employeeEmail:        context.email    || 'Unknown',
        category:             td.category               || 'IT Request',
        issueSummary:         td.issueSummary           || message,
        source:               td.source                 || (topPolicies[0] ? `${topPolicies[0].id} — ${topPolicies[0].title}` : 'No KB matched'),
        priority:             td.priority               || 'Medium',
        reasonForEscalation:  td.reasonForEscalation    || '',
        recommendedNextAction: td.recommendedNextAction || ''
      });
    }

    addAudit('Simulated ticket created', ticket.ticketId);

    // Inject ticket ID into the response so the employee sees it
    if (ticket && llmResult.response) {
      llmResult.response = llmResult.response.replace(
        /\*\*TICKET_ID\*\*/g, `**${ticket.ticketId}**`
      );
      // If the model didn't use the placeholder, append ticket info
      if (!llmResult.response.includes(ticket.ticketId)) {
        llmResult.response += `\n\nA simulated ticket (**${ticket.ticketId}**) has been created for this request.`;
      }
    }
  }

  // ── Build sources list ────────────────────────────────────────────────────
  const sources = llmResult.sources && llmResult.sources.length > 0
    ? llmResult.sources
    : topPolicies.slice(0, 2).map(p => ({ id: p.id, title: p.title }));

  return {
    decision: llmResult.decision,
    response: llmResult.response,
    sources,
    ticket,
    caseAnalysis: {
      intent:   intent.label,
      category: llmResult.category  || intent.label,
      decision: llmResult.decision,
      risk:     llmResult.risk      || 'Low',
      status:   ticket
        ? `${llmResult.decision} — ticket ${ticket.ticketId}`
        : llmResult.decision === 'RESOLVED'
          ? 'Resolved'
          : llmResult.decision === 'NEEDS_INFORMATION'
            ? 'Awaiting clarification'
            : llmResult.decision === 'ROUTE_TO_TEAM'
              ? 'Routed to team'
              : llmResult.decision
    }
  };
}

// ─── Agent Decision Logic (main entry) ───────────────────────────────────────

/**
 * processMessage — main agent function (now async for LLM calls)
 *
 * @param {string} message — the employee's message
 * @param {object} [context] — optional: { employee, email }
 * @returns {Promise<object>} — { decision, response, sources, ticket, auditTrail, caseAnalysis }
 */
async function processMessage(message, context = {}) {
  const audit    = [];
  const addAudit = (event, detail = '') => {
    audit.push({
      timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false }),
      event,
      detail
    });
  };

  addAudit('Request received', message.substring(0, 100));

  // ── STEP 1: Understand intent (used for search query building) ─────────────
  const intent = detectIntent(message);
  addAudit('Intent identified', intent.label);

  // ── STEPS 2–7: LLM-based reasoning (tools + Gemini) ──────────────────────
  const result = await applyDecisionLogic(intent, message, context, addAudit);

  // ── STEP 8: Record final decision ─────────────────────────────────────────
  addAudit('Decision', result.decision);
  addAudit('Response generated', '');

  return buildResponse({
    decision:     result.decision,
    response:     result.response,
    sources:      result.sources,
    ticket:       result.ticket,
    audit,
    caseAnalysis: result.caseAnalysis
  });
}

// ─── Response builder ─────────────────────────────────────────────────────────

function buildResponse({ decision, response, sources, ticket, audit, caseAnalysis }) {
  return { decision, response, sources, ticket, auditTrail: audit, caseAnalysis };
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  processMessage,
  searchPolicies,
  searchRequests,
  searchTickets,
  getTicketHistory,
  createTicket,
  escalateRequest
};
