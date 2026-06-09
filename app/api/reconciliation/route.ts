import { NextRequest, NextResponse } from 'next/server';
import { parseCSV, parsePDF, reconcile, ReconciliationResult } from '@/lib/reconciliation';
import fs from 'fs';
import path from 'path';

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'uploads');

function ensureStorageDir() {
  if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, '_').slice(0, 200);
}

async function saveFile(file: File, label: string): Promise<void> {
  try {
    ensureStorageDir();
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = sanitizeFilename(file.name);
    const dest = path.join(STORAGE_DIR, `${ts}_${label}_${safeName}`);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(dest, buffer);
  } catch {
    // Non-fatal — reconciliation still proceeds even if save fails
  }
}

async function parseFile(file: File): Promise<{ transactions: ReturnType<typeof parseCSV>['transactions']; errors: string[] }> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) {
    const buffer = Buffer.from(await file.arrayBuffer());
    return parsePDF(buffer);
  }
  const text = await file.text();
  return parseCSV(text);
}

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const statementFile = formData.get('statement') as File | null;
  const glFile = formData.get('gl') as File | null;

  if (!statementFile || !glFile) {
    return NextResponse.json({ error: 'Both statement and GL files are required' }, { status: 400 });
  }

  // Save files to storage (non-blocking)
  await Promise.all([
    saveFile(statementFile, 'statement'),
    saveFile(glFile, 'gl'),
  ]);

  const [stmtResult, glResult] = await Promise.all([
    parseFile(statementFile),
    parseFile(glFile),
  ]);

  const allErrors = [
    ...stmtResult.errors.map(e => `Statement: ${e}`),
    ...glResult.errors.map(e => `GL: ${e}`),
  ];

  if (stmtResult.transactions.length === 0 || glResult.transactions.length === 0) {
    return NextResponse.json({
      errors: allErrors,
      matched: [],
      splitMatched: [],
      excluded: [],
      outstandingStatement: stmtResult.transactions,
      outstandingGL: glResult.transactions,
      summary: {
        totalStatement: stmtResult.transactions.length,
        totalGL: glResult.transactions.length,
        matchedCount: 0,
        splitMatchedCount: 0,
        outstandingStatementCount: stmtResult.transactions.length,
        outstandingGLCount: glResult.transactions.length,
        excludedCount: 0,
        matchedAmount: 0,
        outstandingStatementAmount: 0,
        outstandingGLAmount: 0,
      },
    } satisfies ReconciliationResult);
  }

  const result = reconcile(stmtResult.transactions, glResult.transactions);
  return NextResponse.json({ ...result, errors: allErrors } satisfies ReconciliationResult);
}
