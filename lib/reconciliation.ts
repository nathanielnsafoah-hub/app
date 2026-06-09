export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  reference?: string;
}

export interface MatchedPair {
  statement: Transaction;
  gl: Transaction;
  matchType: 'reference' | 'exact' | 'amount_date' | 'amount_desc'
    | 'cross_ref' | 'cross_exact' | 'cross_date' | 'cross_desc'
    | 'amount_only';
}

export interface SplitMatchedPair {
  statements: Transaction[];  // 1 or 2 bank statement transactions
  gls: Transaction[];         // 1 or 2 GL transactions
}

export interface ReconciliationResult {
  matched: MatchedPair[];
  splitMatched: SplitMatchedPair[];
  outstandingStatement: Transaction[];
  outstandingGL: Transaction[];
  excluded: Transaction[];
  summary: {
    totalStatement: number;
    totalGL: number;
    matchedCount: number;
    splitMatchedCount: number;
    outstandingStatementCount: number;
    outstandingGLCount: number;
    excludedCount: number;
    matchedAmount: number;
    outstandingStatementAmount: number;
    outstandingGLAmount: number;
  };
  errors: string[];
}

// Transactions whose description matches any of these patterns are excluded before reconciliation
const EXCLUDE_PATTERNS = [
  /standing\s+instr\s+dr/i,
  /online\s+sweep/i,
  /\bSW\b/,
  /0310587000101-\d{6}-SW/i,
];

const DATE_COLS = new Set(['date', 'transaction date', 'txn date', 'value date', 'posting date',
  'trans date', 'entry date', 'book date', 'transaction_date', 'txn_date', 'value_date',
  'posting_date', 'trans_date', 'entry_date']);
const AMOUNT_COLS = new Set(['amount', 'transaction amount', 'net amount', 'txn amount',
  'transaction_amount', 'net_amount', 'txn_amount', 'total amount', 'total_amount']);
const DEBIT_COLS = new Set(['debit', 'dr', 'withdrawal', 'withdrawals', 'payment',
  'debit amount', 'debit_amount', 'dr_amount', 'dr amount',
  'debit amt', 'debit_amt', 'dr amt', 'dr_amt', 'debit(dr)', 'debit (dr)']);
const CREDIT_COLS = new Set(['credit', 'cr', 'deposit', 'deposits', 'receipt',
  'credit amount', 'credit_amount', 'cr_amount', 'cr amount',
  'credit amt', 'credit_amt', 'cr amt', 'cr_amt', 'credit(cr)', 'credit (cr)']);
const DESC_COLS = new Set(['description', 'narration', 'details', 'memo', 'particulars',
  'remarks', 'narrative', 'transaction details', 'payee', 'beneficiary',
  'transaction_details', 'narration/description', 'trans description', 'trans_description']);
const REF_COLS = new Set(['reference', 'ref', 'ref no', 'reference no', 'transaction id',
  'txn id', 'cheque no', 'check no', 'folio', 'voucher', 'reference_no', 'transaction_id',
  'txn_id', 'cheque_no', 'check_no', 'doc_no', 'document no', 'document_no', 'ref_no',
  'trans. ref. no', 'trans ref no', 'trans.ref.no', 'trans ref', 'tran ref',
  'trans. ref', 'transaction ref', 'transaction ref no', 'tran. ref. no',
  'ref chq no', 'chq no', 'chq. no', 'chq. no.', 'ref chq no.']);

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .trim()
    .replace(/\s*\([^)]*\)\s*/g, ' ') // strip anything in parentheses e.g. "(GHS)", "(USD)"
    .replace(/\s*\/\s*/g, ' ')         // normalize slashes e.g. "Ref / Chq No" → "Ref  Chq No"
    .replace(/\s+/g, ' ')              // collapse multiple spaces
    .replace(/\.$/g, '')               // strip trailing period
    .trim();
}

function findCol(headers: string[], set: Set<string>): number {
  return headers.findIndex(h => {
    const norm = normalizeHeader(h);
    return set.has(norm) || set.has(h.toLowerCase().trim());
  });
}

function parseAmount(val: string): number {
  if (!val) return 0;
  // Strip surrounding single or double quotes (e.g. '-99,293.00' exported from Excel)
  let s = val.trim().replace(/^['"]|['"]$/g, '').replace(/,/g, '').replace(/\s/g, '');
  if (s.startsWith('(') && s.endsWith(')')) {
    return -(parseFloat(s.slice(1, -1)) || 0);
  }
  return parseFloat(s) || 0;
}

export function parseDate(val: string): string {
  if (!val) return '';
  val = val.trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.substring(0, 10);

  const slashMatch = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const [, d, m, y] = slashMatch;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const dashMatch = val.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (dashMatch) {
    const [, d, m, y] = dashMatch;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const monMatch = val.match(/^(\d{1,2})[-\s]([a-zA-Z]{3})[-\s](\d{2,4})$/);
  if (monMatch) {
    const [, d, mon, y] = monMatch;
    const mi = MONTHS.indexOf(mon.toLowerCase());
    if (mi >= 0) {
      const year = y.length === 2 ? `20${y}` : y;
      return `${year}-${String(mi + 1).padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }

  const d = new Date(val);
  if (!isNaN(d.getTime())) return d.toISOString().substring(0, 10);

  return val;
}

function detectDelimiter(lines: string[]): string {
  // Sample first few non-empty lines and count candidate delimiters
  const sample = lines.slice(0, 5).join('\n');
  const counts = {
    ',': (sample.match(/,/g) || []).length,
    ';': (sample.match(/;/g) || []).length,
    '\t': (sample.match(/\t/g) || []).length,
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function parseCSVLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (line.slice(i, i + delimiter.length) === delimiter && !inQuotes) {
      fields.push(current.trim());
      current = '';
      i += delimiter.length - 1;
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function scoreHeaderRow(fields: string[]): number {
  // Count how many fields match known column sets — higher = more likely a real header row
  let score = 0;
  for (const f of fields) {
    const key = f.toLowerCase().trim();
    if (DATE_COLS.has(key)) score += 3;
    else if (AMOUNT_COLS.has(key)) score += 3;
    else if (DEBIT_COLS.has(key)) score += 3;
    else if (CREDIT_COLS.has(key)) score += 3;
    else if (DESC_COLS.has(key)) score += 3;
    else if (REF_COLS.has(key)) score += 2;
    // Penalise rows that look like metadata (single long string, or all numeric)
    else if (fields.length === 1) score -= 5;
  }
  return score;
}

export function parseCSV(content: string): { transactions: Transaction[]; errors: string[] } {
  const errors: string[] = [];
  // Strip UTF-8 BOM if present
  const cleaned = content.replace(/^﻿/, '');
  const lines = cleaned.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) {
    return { transactions: [], errors: ['File is empty or has only a header row'] };
  }

  const delim = detectDelimiter(lines);

  // Scan up to first 20 rows to find the best header row (handles bank statement preambles)
  const SCAN_LIMIT = Math.min(20, lines.length - 1);
  let headerRowIdx = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < SCAN_LIMIT; i++) {
    const score = scoreHeaderRow(parseCSVLine(lines[i], delim));
    if (score > bestScore) { bestScore = score; headerRowIdx = i; }
  }

  const headers = parseCSVLine(lines[headerRowIdx], delim);
  const dateIdx = findCol(headers, DATE_COLS);
  const amountIdx = findCol(headers, AMOUNT_COLS);
  const debitIdx = findCol(headers, DEBIT_COLS);
  const creditIdx = findCol(headers, CREDIT_COLS);
  const descIdx = findCol(headers, DESC_COLS);
  const refIdx = findCol(headers, REF_COLS);

  const hasAmount = amountIdx !== -1;
  const hasDebitCredit = debitIdx !== -1 || creditIdx !== -1;

  if (dateIdx === -1) {
    errors.push(`Could not find a date column. Headers detected: ${headers.join(', ')}`);
  }
  if (!hasAmount && !hasDebitCredit) {
    errors.push(`Could not find an amount column. Headers detected: ${headers.join(', ')}`);
  }
  if (descIdx === -1) {
    errors.push(`Could not find a description column. Headers detected: ${headers.join(', ')}`);
  }

  if (errors.length > 0) return { transactions: [], errors };

  const transactions: Transaction[] = [];
  for (let i = headerRowIdx + 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i], delim);
    if (fields.every(f => !f)) continue;

    // Skip continuation rows (no date = extra description line for the previous transaction)
    const dateVal = (fields[dateIdx] ?? '').trim().replace(/^['"]|['"]$/g, '');
    if (!dateVal) continue;

    let amount: number;
    if (hasAmount) {
      amount = parseAmount(fields[amountIdx] ?? '0');
    } else {
      // Use Math.abs on each column — some exports store debits as negative numbers already.
      // Treat debit as an outflow (negative) and credit as an inflow (positive).
      const debit = Math.abs(parseAmount(fields[debitIdx] ?? '0'));
      const credit = Math.abs(parseAmount(fields[creditIdx] ?? '0'));
      amount = credit - debit;
    }

    transactions.push({
      id: `csv_${i}`,
      date: parseDate(dateVal),
      description: (fields[descIdx] ?? '').trim(),
      amount,
      reference: refIdx !== -1 && fields[refIdx] ? fields[refIdx].trim() : undefined,
    });
  }

  return { transactions, errors };
}

export async function parsePDF(buffer: Buffer): Promise<{ transactions: Transaction[]; errors: string[] }> {
  const errors: string[] = [];
  let text = '';
  try {
    const { PDFParse } = require('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    const data = await parser.getText();
    text = data.text;
  } catch (e) {
    errors.push(`Failed to read PDF: ${e instanceof Error ? e.message : 'Unknown error'}`);
    return { transactions: [], errors };
  }

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const transactions: Transaction[] = [];

  const DATE_RE = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{2}[\/\-]\d{2}|\d{1,2}[-\s][A-Za-z]{3}[-\s]\d{2,4})/;
  const AMOUNT_RE = /-?\(?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\)?/g;

  let idx = 0;
  for (const line of lines) {
    const dateMatch = line.match(DATE_RE);
    if (!dateMatch) continue;
    const amounts = line.match(AMOUNT_RE);
    if (!amounts) continue;

    const date = parseDate(dateMatch[1]);
    const amount = parseAmount(amounts[amounts.length - 1]);

    const dateEnd = line.indexOf(dateMatch[1]) + dateMatch[1].length;
    const lastAmtStart = line.lastIndexOf(amounts[amounts.length - 1]);
    const description = line.substring(dateEnd, lastAmtStart > dateEnd ? lastAmtStart : undefined).trim() || line;

    const refMatch = description.match(/\b[A-Z]{2,4}\d{4,12}\b|\b\d{8,15}\b/);

    transactions.push({
      id: `pdf_${idx++}`,
      date,
      description,
      amount,
      reference: refMatch ? refMatch[0] : undefined,
    });
  }

  if (transactions.length === 0) {
    errors.push(
      'Could not extract transactions from the PDF. The layout may not be supported. ' +
      'Try exporting your statement as CSV instead.'
    );
  }

  return { transactions, errors };
}

function daysDiff(a: string, b: string): number {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (isNaN(ta) || isNaN(tb)) return 9999;
  return Math.abs(ta - tb) / 86_400_000;
}

function descSimilar(a: string, b: string): boolean {
  const na = a.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  const nb = b.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  if (na.includes(nb) || nb.includes(na)) return true;
  const wordsA = new Set(na.split(/\s+/).filter(w => w.length > 3));
  return nb.split(/\s+/).filter(w => w.length > 3).some(w => wordsA.has(w));
}

const MAX_SPLIT = 5;

// Finds a subset of pool (size 2..MAX_SPLIT) whose absolute amounts sum to target.
// Sorted descending for fast pruning; checks unmatchedSet live so consumed items are skipped.
function findSubsetSum(
  pool: Transaction[],
  target: number,
  unmatchedSet: Set<string>,
): Transaction[] | null {
  const candidates = pool
    .filter(t => unmatchedSet.has(t.id))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

  function search(start: number, remaining: number, current: Transaction[]): Transaction[] | null {
    if (Math.abs(remaining) < 0.01) return current.length >= 2 ? current : null;
    if (current.length >= MAX_SPLIT || start >= candidates.length) return null;
    for (let i = start; i < candidates.length; i++) {
      const amt = Math.abs(candidates[i].amount);
      if (amt > remaining + 0.01) continue;
      const result = search(i + 1, remaining - amt, [...current, candidates[i]]);
      if (result) return result;
    }
    return null;
  }
  return search(0, target, []);
}

function isExcluded(t: Transaction): boolean {
  const fields = [t.description, t.reference ?? ''];
  return EXCLUDE_PATTERNS.some(p => fields.some(f => p.test(f)));
}

export function reconcile(
  statementTxns: Transaction[],
  glTxns: Transaction[],
): Omit<ReconciliationResult, 'errors'> {
  // Remove excluded transactions from both sides before matching
  const excluded = [...statementTxns, ...glTxns].filter(isExcluded);
  const filteredStmt = statementTxns.filter(t => !isExcluded(t));
  const filteredGL   = glTxns.filter(t => !isExcluded(t));

  const matched: MatchedPair[] = [];
  const unmatchedStmt = new Set(filteredStmt.map(t => t.id));
  const unmatchedGL   = new Set(filteredGL.map(t => t.id));

  function tryMatch(
    stmt: Transaction,
    candidates: Transaction[],
    matchType: MatchedPair['matchType'],
  ) {
    if (!unmatchedStmt.has(stmt.id)) return;
    for (const gl of candidates) {
      if (!unmatchedGL.has(gl.id)) continue;
      matched.push({ statement: stmt, gl, matchType });
      unmatchedStmt.delete(stmt.id);
      unmatchedGL.delete(gl.id);
      return;
    }
  }

  // Pass 1 — same reference + same amount
  for (const stmt of filteredStmt) {
    if (!stmt.reference) continue;
    tryMatch(
      stmt,
      filteredGL.filter(gl =>
        unmatchedGL.has(gl.id) &&
        gl.reference === stmt.reference &&
        Math.abs(gl.amount - stmt.amount) < 0.01,
      ),
      'reference',
    );
  }

  // Pass 2 — exact amount + exact date
  for (const stmt of filteredStmt) {
    if (!unmatchedStmt.has(stmt.id)) continue;
    tryMatch(
      stmt,
      filteredGL.filter(gl =>
        unmatchedGL.has(gl.id) &&
        Math.abs(gl.amount - stmt.amount) < 0.01 &&
        gl.date === stmt.date,
      ),
      'exact',
    );
  }

  // Pass 3 — same amount + date within ±7 days
  for (const stmt of filteredStmt) {
    if (!unmatchedStmt.has(stmt.id)) continue;
    const candidates = filteredGL
      .filter(gl =>
        unmatchedGL.has(gl.id) &&
        Math.abs(gl.amount - stmt.amount) < 0.01 &&
        daysDiff(gl.date, stmt.date) <= 7,
      )
      .sort((a, b) => daysDiff(a.date, stmt.date) - daysDiff(b.date, stmt.date));
    tryMatch(stmt, candidates, 'amount_date');
  }

  // Pass 4 — same amount + similar description
  for (const stmt of filteredStmt) {
    if (!unmatchedStmt.has(stmt.id)) continue;
    tryMatch(
      stmt,
      filteredGL.filter(gl =>
        unmatchedGL.has(gl.id) &&
        Math.abs(gl.amount - stmt.amount) < 0.01 &&
        descSimilar(gl.description, stmt.description),
      ),
      'amount_desc',
    );
  }

  // Cross-sign passes: bank credit matches GL debit (and vice versa)

  // Pass 5 — cross-sign + same reference
  for (const stmt of filteredStmt) {
    if (!unmatchedStmt.has(stmt.id) || !stmt.reference) continue;
    tryMatch(
      stmt,
      filteredGL.filter(gl =>
        unmatchedGL.has(gl.id) &&
        gl.reference === stmt.reference &&
        Math.abs(Math.abs(gl.amount) - Math.abs(stmt.amount)) < 0.01 &&
        Math.sign(gl.amount) !== Math.sign(stmt.amount),
      ),
      'cross_ref',
    );
  }

  // Pass 6 — cross-sign + exact date
  for (const stmt of filteredStmt) {
    if (!unmatchedStmt.has(stmt.id)) continue;
    tryMatch(
      stmt,
      filteredGL.filter(gl =>
        unmatchedGL.has(gl.id) &&
        Math.abs(Math.abs(gl.amount) - Math.abs(stmt.amount)) < 0.01 &&
        Math.sign(gl.amount) !== Math.sign(stmt.amount) &&
        gl.date === stmt.date,
      ),
      'cross_exact',
    );
  }

  // Pass 7 — cross-sign + date within ±7 days
  for (const stmt of filteredStmt) {
    if (!unmatchedStmt.has(stmt.id)) continue;
    const candidates = filteredGL
      .filter(gl =>
        unmatchedGL.has(gl.id) &&
        Math.abs(Math.abs(gl.amount) - Math.abs(stmt.amount)) < 0.01 &&
        Math.sign(gl.amount) !== Math.sign(stmt.amount) &&
        daysDiff(gl.date, stmt.date) <= 7,
      )
      .sort((a, b) => daysDiff(a.date, stmt.date) - daysDiff(b.date, stmt.date));
    tryMatch(stmt, candidates, 'cross_date');
  }

  // Pass 8 — cross-sign + similar description
  for (const stmt of filteredStmt) {
    if (!unmatchedStmt.has(stmt.id)) continue;
    tryMatch(
      stmt,
      filteredGL.filter(gl =>
        unmatchedGL.has(gl.id) &&
        Math.abs(Math.abs(gl.amount) - Math.abs(stmt.amount)) < 0.01 &&
        Math.sign(gl.amount) !== Math.sign(stmt.amount) &&
        descSimilar(gl.description, stmt.description),
      ),
      'cross_desc',
    );
  }

  // Pass 9 — N-way split: 2..MAX_SPLIT statement transactions summing to one GL transaction
  // Largest GL amounts processed first to protect large combined groups
  const splitMatched: SplitMatchedPair[] = [];
  {
    const stmtPool = filteredStmt.filter(t => unmatchedStmt.has(t.id));
    const glBySize = filteredGL
      .filter(t => unmatchedGL.has(t.id))
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    for (const gl of glBySize) {
      if (!unmatchedGL.has(gl.id)) continue;
      const subset = findSubsetSum(stmtPool, Math.abs(gl.amount), unmatchedStmt);
      if (subset) {
        splitMatched.push({ statements: subset, gls: [gl] });
        subset.forEach(t => unmatchedStmt.delete(t.id));
        unmatchedGL.delete(gl.id);
      }
    }
  }

  // Pass 10 — N-way split: 2..MAX_SPLIT GL transactions summing to one statement transaction
  {
    const glPool = filteredGL.filter(t => unmatchedGL.has(t.id));
    const stmtBySize = filteredStmt
      .filter(t => unmatchedStmt.has(t.id))
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    for (const stmt of stmtBySize) {
      if (!unmatchedStmt.has(stmt.id)) continue;
      const subset = findSubsetSum(glPool, Math.abs(stmt.amount), unmatchedGL);
      if (subset) {
        splitMatched.push({ statements: [stmt], gls: subset });
        unmatchedStmt.delete(stmt.id);
        subset.forEach(t => unmatchedGL.delete(t.id));
      }
    }
  }

  // Pass 11 — bank credits matched to GL debits, descending by amount (largest first)
  const unmatchedBankCredits = filteredStmt
    .filter(t => unmatchedStmt.has(t.id) && t.amount > 0)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

  const unmatchedGLDebits = filteredGL
    .filter(t => unmatchedGL.has(t.id) && t.amount < 0)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

  for (const stmt of unmatchedBankCredits) {
    if (!unmatchedStmt.has(stmt.id)) continue;
    tryMatch(
      stmt,
      unmatchedGLDebits.filter(gl =>
        unmatchedGL.has(gl.id) &&
        Math.abs(Math.abs(gl.amount) - Math.abs(stmt.amount)) < 0.01,
      ),
      'amount_only',
    );
  }

  // Pass 12 — bank debits matched to GL credits, descending by amount (largest first)
  const unmatchedBankDebits = filteredStmt
    .filter(t => unmatchedStmt.has(t.id) && t.amount < 0)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

  const unmatchedGLCredits = filteredGL
    .filter(t => unmatchedGL.has(t.id) && t.amount > 0)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

  for (const stmt of unmatchedBankDebits) {
    if (!unmatchedStmt.has(stmt.id)) continue;
    tryMatch(
      stmt,
      unmatchedGLCredits.filter(gl =>
        unmatchedGL.has(gl.id) &&
        Math.abs(Math.abs(gl.amount) - Math.abs(stmt.amount)) < 0.01,
      ),
      'amount_only',
    );
  }

  const outstandingStatement = filteredStmt.filter(t => unmatchedStmt.has(t.id));
  const outstandingGL = filteredGL.filter(t => unmatchedGL.has(t.id));
  const absSum = (txns: Transaction[]) => txns.reduce((acc, t) => acc + Math.abs(t.amount), 0);

  return {
    matched,
    splitMatched,
    outstandingStatement,
    outstandingGL,
    excluded,
    summary: {
      totalStatement: filteredStmt.length,
      totalGL: filteredGL.length,
      matchedCount: matched.length,
      splitMatchedCount: splitMatched.length,
      outstandingStatementCount: outstandingStatement.length,
      outstandingGLCount: outstandingGL.length,
      excludedCount: excluded.length,
      matchedAmount: absSum(matched.map(p => p.statement)),
      outstandingStatementAmount: absSum(outstandingStatement),
      outstandingGLAmount: absSum(outstandingGL),
    },
  };
}
