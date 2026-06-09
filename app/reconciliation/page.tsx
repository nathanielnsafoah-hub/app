'use client';

import { useState, useRef } from 'react';
import type { ReconciliationResult, MatchedPair, SplitMatchedPair, Transaction } from '@/lib/reconciliation';

const MATCH_LABELS: Record<MatchedPair['matchType'], string> = {
  reference:   'Reference',
  exact:       'Exact',
  amount_date: 'Amt+Date',
  amount_desc: 'Amt+Desc',
  cross_ref:    'Cross Ref',
  cross_exact:  'Cross Exact',
  cross_date:   'Cross Date',
  cross_desc:   'Cross Desc',
  amount_only:  'Amt Only',
};

const MATCH_COLORS: Record<MatchedPair['matchType'], string> = {
  reference:   'bg-green-100 text-green-800',
  exact:       'bg-blue-100 text-blue-800',
  amount_date: 'bg-yellow-100 text-yellow-800',
  amount_desc: 'bg-orange-100 text-orange-800',
  cross_ref:    'bg-purple-100 text-purple-800',
  cross_exact:  'bg-purple-100 text-purple-800',
  cross_date:   'bg-pink-100 text-pink-800',
  cross_desc:   'bg-pink-100 text-pink-800',
  amount_only:  'bg-gray-100 text-gray-700',
};

function fmt(n: number) {
  return n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function FileUploadBox({
  label,
  file,
  onChange,
}: {
  label: string;
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div
      className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center gap-3 bg-white hover:border-primary transition-colors cursor-pointer"
      onClick={() => ref.current?.click()}
      onDragOver={e => e.preventDefault()}
      onDrop={e => {
        e.preventDefault();
        const f = e.dataTransfer.files[0];
        if (f) onChange(f);
      }}
    >
      <input
        ref={ref}
        type="file"
        accept=".csv,.pdf"
        className="hidden"
        onChange={e => onChange(e.target.files?.[0] ?? null)}
      />
      <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <div className="text-center">
        <p className="font-semibold text-gray-700">{label}</p>
        {file ? (
          <p className="text-sm text-green-600 mt-1 font-medium">{file.name}</p>
        ) : (
          <p className="text-sm text-gray-400 mt-1">Click or drag a CSV or PDF file here</p>
        )}
      </div>
      {file && (
        <button
          className="text-xs text-red-400 hover:text-red-600"
          onClick={e => { e.stopPropagation(); onChange(null); }}
        >
          Remove
        </button>
      )}
    </div>
  );
}

function SummaryCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className={`rounded-xl p-4 ${color ?? 'bg-white'} shadow-sm`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function TxnTable({ transactions, label }: { transactions: Transaction[]; label: string }) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-6 text-gray-400 text-sm">No outstanding items in {label}</div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-2 px-3 text-gray-500 font-medium">Date</th>
            <th className="text-left py-2 px-3 text-gray-500 font-medium">Description</th>
            <th className="text-left py-2 px-3 text-gray-500 font-medium">Reference</th>
            <th className="text-right py-2 px-3 text-gray-500 font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map(t => (
            <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="py-2 px-3 whitespace-nowrap">{t.date}</td>
              <td className="py-2 px-3 max-w-xs truncate" title={t.description}>{t.description}</td>
              <td className="py-2 px-3 text-gray-400">{t.reference ?? '—'}</td>
              <td className={`py-2 px-3 text-right font-mono ${t.amount < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                {t.amount < 0 ? `(${fmt(Math.abs(t.amount))})` : fmt(t.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatchedTable({ pairs }: { pairs: MatchedPair[] }) {
  if (pairs.length === 0) {
    return <div className="text-center py-6 text-gray-400 text-sm">No matched transactions</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-2 px-3 text-gray-500 font-medium">Match</th>
            <th className="text-left py-2 px-3 text-gray-500 font-medium">Date (Stmt)</th>
            <th className="text-left py-2 px-3 text-gray-500 font-medium">Description (Stmt)</th>
            <th className="text-right py-2 px-3 text-gray-500 font-medium">Amount (Stmt)</th>
            <th className="text-left py-2 px-3 text-gray-500 font-medium">Date (GL)</th>
            <th className="text-left py-2 px-3 text-gray-500 font-medium">Description (GL)</th>
            <th className="text-right py-2 px-3 text-gray-500 font-medium">Amount (GL)</th>
          </tr>
        </thead>
        <tbody>
          {pairs.map((p, i) => (
            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="py-2 px-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${MATCH_COLORS[p.matchType]}`}>
                  {MATCH_LABELS[p.matchType]}
                </span>
              </td>
              <td className="py-2 px-3 whitespace-nowrap">{p.statement.date}</td>
              <td className="py-2 px-3 max-w-[180px] truncate" title={p.statement.description}>{p.statement.description}</td>
              <td className="py-2 px-3 text-right font-mono">{fmt(Math.abs(p.statement.amount))}</td>
              <td className="py-2 px-3 whitespace-nowrap">{p.gl.date}</td>
              <td className="py-2 px-3 max-w-[180px] truncate" title={p.gl.description}>{p.gl.description}</td>
              <td className="py-2 px-3 text-right font-mono">{fmt(Math.abs(p.gl.amount))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TxnCell({ txns }: { txns: Transaction[] }) {
  return (
    <td className="py-2 px-3 align-top">
      {txns.map((t, i) => (
        <div key={i} className={i > 0 ? 'mt-1 pt-1 border-t border-gray-100' : ''}>
          <div className="whitespace-nowrap text-gray-500 text-xs">{t.date}</div>
          <div className="max-w-[160px] truncate font-medium" title={t.description}>{t.description}</div>
          <div className="font-mono text-xs text-right">{fmt(Math.abs(t.amount))}</div>
        </div>
      ))}
    </td>
  );
}

function SplitMatchedTable({ pairs }: { pairs: SplitMatchedPair[] }) {
  if (pairs.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-2 px-3 text-gray-500 font-medium">Type</th>
            <th className="text-left py-2 px-3 text-gray-500 font-medium">Bank Statement</th>
            <th className="text-left py-2 px-3 text-gray-500 font-medium">GL Statement</th>
          </tr>
        </thead>
        <tbody>
          {pairs.map((p, i) => (
            <tr key={i} className="border-b border-gray-50 hover:bg-indigo-50">
              <td className="py-2 px-3 align-top">
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-700 whitespace-nowrap">
                  {p.statements.length} Stmt → {p.gls.length} GL
                </span>
              </td>
              <TxnCell txns={p.statements} />
              <TxnCell txns={p.gls} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function exportCSV(rows: Record<string, string | number>[], filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => `"${String(r[h]).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type Tab = 'outstanding' | 'matched' | 'excluded';

export default function ReconciliationPage() {
  const [statementFile, setStatementFile] = useState<File | null>(null);
  const [glFile, setGLFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReconciliationResult | null>(null);
  const [tab, setTab] = useState<Tab>('outstanding');

  async function handleReconcile() {
    if (!statementFile || !glFile) return;
    setLoading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('statement', statementFile);
      fd.append('gl', glFile);
      const res = await fetch('/api/reconciliation', { method: 'POST', body: fd });
      const data = await res.json();
      setResult(data);
      setTab('outstanding');
    } catch {
      alert('Unexpected error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const matchRate = result
    ? Math.round(((result.summary.matchedCount + result.summary.splitMatchedCount * 2) / Math.max(result.summary.totalStatement, 1)) * 100)
    : 0;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-800">Statement Reconciliation</h2>
        <p className="text-gray-500 mt-1">
          Upload your bank statement and GL statement to identify outstanding items
        </p>
      </div>

      {/* Upload area */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <FileUploadBox label="Bank Statement" file={statementFile} onChange={setStatementFile} />
        <FileUploadBox label="GL Statement" file={glFile} onChange={setGLFile} />
      </div>

      <div className="flex justify-center mb-8">
        <button
          onClick={handleReconcile}
          disabled={!statementFile || !glFile || loading}
          className="px-8 py-3 rounded-xl bg-primary text-white font-semibold text-lg shadow
            disabled:opacity-40 disabled:cursor-not-allowed hover:bg-green-700 transition-colors"
        >
          {loading ? 'Reconciling…' : 'Reconcile Statements'}
        </button>
      </div>

      {/* Errors */}
      {result?.errors && result.errors.length > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="font-semibold text-red-700 mb-1">Parsing warnings</p>
          {result.errors.map((e, i) => (
            <p key={i} className="text-sm text-red-600">{e}</p>
          ))}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <SummaryCard label="Statement Transactions" value={result.summary.totalStatement} color="bg-white" />
            <SummaryCard label="GL Transactions" value={result.summary.totalGL} color="bg-white" />
            <SummaryCard
              label="Matched"
              value={result.summary.matchedCount}
              sub={`GHS ${fmt(result.summary.matchedAmount)}`}
              color="bg-green-50"
            />
            <SummaryCard
              label="Outstanding"
              value={result.summary.outstandingStatementCount + result.summary.outstandingGLCount}
              sub={`Stmt: ${result.summary.outstandingStatementCount} · GL: ${result.summary.outstandingGLCount}`}
              color="bg-orange-50"
            />
            <SummaryCard
              label="Excluded"
              value={result.summary.excludedCount}
              sub="Standing instr. removed"
              color="bg-gray-50"
            />
          </div>

          {/* Match rate bar */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium text-gray-700">Match Rate</span>
              <span className="font-bold text-gray-800">{matchRate}%</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-3 bg-green-500 rounded-full transition-all duration-700"
                style={{ width: `${matchRate}%` }}
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="flex border-b border-gray-100">
              <button
                className={`px-6 py-3 text-sm font-medium transition-colors ${tab === 'outstanding'
                  ? 'text-primary border-b-2 border-primary bg-green-50'
                  : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setTab('outstanding')}
              >
                Outstanding
                {(result.summary.outstandingStatementCount + result.summary.outstandingGLCount) > 0 && (
                  <span className="ml-2 bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full">
                    {result.summary.outstandingStatementCount + result.summary.outstandingGLCount}
                  </span>
                )}
              </button>
              <button
                className={`px-6 py-3 text-sm font-medium transition-colors ${tab === 'matched'
                  ? 'text-primary border-b-2 border-primary bg-green-50'
                  : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setTab('matched')}
              >
                Matched
                <span className="ml-2 bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">
                  {result.summary.matchedCount + result.summary.splitMatchedCount}
                </span>
              </button>
              {result.summary.excludedCount > 0 && (
                <button
                  className={`px-6 py-3 text-sm font-medium transition-colors ${tab === 'excluded'
                    ? 'text-gray-700 border-b-2 border-gray-400 bg-gray-50'
                    : 'text-gray-500 hover:text-gray-700'}`}
                  onClick={() => setTab('excluded')}
                >
                  Excluded
                  <span className="ml-2 bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                    {result.summary.excludedCount}
                  </span>
                </button>
              )}
            </div>

            <div className="p-4">
              {tab === 'outstanding' && (
                <div className="space-y-6">
                  {/* Outstanding in Statement */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-700">
                        Outstanding in Bank Statement
                        <span className="ml-2 text-orange-600 font-bold">
                          ({result.summary.outstandingStatementCount})
                        </span>
                      </h3>
                      {result.outstandingStatement.length > 0 && (
                        <button
                          onClick={() => exportCSV(
                            result.outstandingStatement.map(t => ({
                              Date: t.date,
                              Description: t.description,
                              Reference: t.reference ?? '',
                              Amount: t.amount,
                            })),
                            'outstanding_statement.csv',
                          )}
                          className="text-xs text-primary hover:underline"
                        >
                          Export CSV
                        </button>
                      )}
                    </div>
                    <TxnTable transactions={result.outstandingStatement} label="Bank Statement" />
                    {result.outstandingStatement.length > 0 && (
                      <div className="text-right text-sm font-semibold text-gray-700 mt-2 pr-3">
                        Total: GHS {fmt(result.summary.outstandingStatementAmount)}
                      </div>
                    )}
                  </div>

                  <hr className="border-gray-100" />

                  {/* Outstanding in GL */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-700">
                        Outstanding in GL Statement
                        <span className="ml-2 text-orange-600 font-bold">
                          ({result.summary.outstandingGLCount})
                        </span>
                      </h3>
                      {result.outstandingGL.length > 0 && (
                        <button
                          onClick={() => exportCSV(
                            result.outstandingGL.map(t => ({
                              Date: t.date,
                              Description: t.description,
                              Reference: t.reference ?? '',
                              Amount: t.amount,
                            })),
                            'outstanding_gl.csv',
                          )}
                          className="text-xs text-primary hover:underline"
                        >
                          Export CSV
                        </button>
                      )}
                    </div>
                    <TxnTable transactions={result.outstandingGL} label="GL" />
                    {result.outstandingGL.length > 0 && (
                      <div className="text-right text-sm font-semibold text-gray-700 mt-2 pr-3">
                        Total: GHS {fmt(result.summary.outstandingGLAmount)}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tab === 'matched' && (
                <div className="space-y-6">
                  {/* 1-to-1 matches */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex gap-3 text-xs flex-wrap">
                        {Object.entries(MATCH_LABELS).map(([k, label]) => (
                          <span key={k} className={`px-2 py-0.5 rounded-full font-medium ${MATCH_COLORS[k as MatchedPair['matchType']]}`}>
                            {label}
                          </span>
                        ))}
                      </div>
                      {result.matched.length > 0 && (
                        <button
                          onClick={() => exportCSV(
                            result.matched.map(p => ({
                              'Stmt Date': p.statement.date,
                              'Stmt Description': p.statement.description,
                              'Stmt Amount': p.statement.amount,
                              'GL Date': p.gl.date,
                              'GL Description': p.gl.description,
                              'GL Amount': p.gl.amount,
                              'Match Type': MATCH_LABELS[p.matchType],
                            })),
                            'matched_transactions.csv',
                          )}
                          className="text-xs text-primary hover:underline"
                        >
                          Export CSV
                        </button>
                      )}
                    </div>
                    <MatchedTable pairs={result.matched} />
                  </div>

                  {/* Split matches — two statement lines → one GL line */}
                  {result.splitMatched.length > 0 && (
                    <div>
                      <hr className="border-gray-100 mb-4" />
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-gray-700">
                          Split Matches
                          <span className="ml-2 bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-medium">
                            {result.splitMatched.length}
                          </span>
                        </h3>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">2 bank statement lines = 1 GL line</span>
                          <button
                            onClick={() => exportCSV(
                              result.splitMatched.flatMap(p => [{
                                'Stmt Date 1': p.statements[0]?.date ?? '',
                                'Stmt Description 1': p.statements[0]?.description ?? '',
                                'Stmt Amount 1': p.statements[0]?.amount ?? '',
                                'Stmt Date 2': p.statements[1]?.date ?? '',
                                'Stmt Description 2': p.statements[1]?.description ?? '',
                                'Stmt Amount 2': p.statements[1]?.amount ?? '',
                                'GL Date 1': p.gls[0]?.date ?? '',
                                'GL Description 1': p.gls[0]?.description ?? '',
                                'GL Amount 1': p.gls[0]?.amount ?? '',
                                'GL Date 2': p.gls[1]?.date ?? '',
                                'GL Description 2': p.gls[1]?.description ?? '',
                                'GL Amount 2': p.gls[1]?.amount ?? '',
                                'Match Type': p.statements.length === 2 ? '2 Stmt → 1 GL' : '1 Stmt → 2 GL',
                              }]),
                              'split_matched.csv',
                            )}
                            className="text-xs text-primary hover:underline"
                          >
                            Export CSV
                          </button>
                        </div>
                      </div>
                      <SplitMatchedTable pairs={result.splitMatched} />
                    </div>
                  )}
                </div>
              )}

              {tab === 'excluded' && (
                <div>
                  <p className="text-sm text-gray-500 mb-3">
                    These transactions were removed before reconciliation because they match an excluded pattern (e.g. <span className="font-mono">STANDING INSTR DR</span>).
                  </p>
                  <TxnTable transactions={result.excluded} label="excluded" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
