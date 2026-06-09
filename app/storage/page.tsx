'use client';

import { useEffect, useState } from 'react';
import type { StoredFile } from '@/app/api/storage/route';

function fmt(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GH', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

const LABEL_DISPLAY: Record<string, string> = {
  statement: 'Bank Statement',
  gl: 'GL Statement',
  unknown: 'Unknown',
};

const LABEL_COLOR: Record<string, string> = {
  statement: 'bg-blue-100 text-blue-700',
  gl: 'bg-purple-100 text-purple-700',
  unknown: 'bg-gray-100 text-gray-600',
};

export default function StoragePage() {
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/storage');
      const data = await res.json();
      setFiles(data.files ?? []);
      setSelected(new Set());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function toggleSelect(filename: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(filename) ? next.delete(filename) : next.add(filename);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === files.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(files.map(f => f.filename)));
    }
  }

  async function handleDelete(filename: string) {
    if (!confirm(`Delete "${filename}"? This cannot be undone.`)) return;
    setDeleting(filename);
    await fetch('/api/storage', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename }),
    });
    setDeleting(null);
    await load();
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected file${selected.size > 1 ? 's' : ''}? This cannot be undone.`)) return;
    setBulkDeleting(true);
    await Promise.all(
      [...selected].map(filename =>
        fetch('/api/storage', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename }),
        })
      )
    );
    setBulkDeleting(false);
    await load();
  }

  const allSelected = files.length > 0 && selected.size === files.length;
  const someSelected = selected.size > 0 && selected.size < files.length;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-800">File Storage</h2>
        <p className="text-gray-500 mt-1">
          All uploaded bank and GL statement files are saved here securely. Download or delete them at any time.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <span className="font-semibold text-gray-700">
            Stored Files
            {!loading && (
              <span className="ml-2 text-sm font-normal text-gray-400">
                ({files.length} file{files.length !== 1 ? 's' : ''})
              </span>
            )}
          </span>
          <div className="flex items-center gap-3">
            {selected.size > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="flex items-center gap-1.5 text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg font-medium disabled:opacity-50 transition-colors"
              >
                {bulkDeleting ? 'Deleting…' : `Delete ${selected.size} selected`}
              </button>
            )}
            <button onClick={load} className="text-xs text-primary hover:underline">
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-gray-400">Loading…</div>
        ) : files.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <p className="text-lg font-medium">No files stored yet</p>
            <p className="text-sm mt-1">Files will appear here after you run a reconciliation</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected; }}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 accent-primary cursor-pointer"
                    title="Select all"
                  />
                </th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">File Name</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Type</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Uploaded</th>
                <th className="text-right py-3 px-4 text-gray-500 font-medium">Size</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {files.map(f => {
                const isSelected = selected.has(f.filename);
                return (
                  <tr
                    key={f.filename}
                    className={`border-b border-gray-50 transition-colors ${isSelected ? 'bg-red-50' : 'hover:bg-gray-50'}`}
                  >
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(f.filename)}
                        className="w-4 h-4 accent-primary cursor-pointer"
                      />
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-800">{f.originalName}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LABEL_COLOR[f.label] ?? LABEL_COLOR.unknown}`}>
                        {LABEL_DISPLAY[f.label] ?? f.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-500 whitespace-nowrap">{fmtDate(f.uploadedAt)}</td>
                    <td className="py-3 px-4 text-right text-gray-500">{fmt(f.sizeBytes)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3 justify-end">
                        <a
                          href={`/api/storage/download?file=${encodeURIComponent(f.filename)}`}
                          download={f.originalName}
                          className="text-xs text-primary font-medium hover:underline"
                        >
                          Download
                        </a>
                        <button
                          onClick={() => handleDelete(f.filename)}
                          disabled={deleting === f.filename || bulkDeleting}
                          className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
                        >
                          {deleting === f.filename ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {files.length > 0 && (
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              Files are stored securely on the server and are not publicly accessible.
            </span>
            {selected.size > 0 && (
              <span className="text-xs text-gray-500 font-medium">
                {selected.size} of {files.length} selected
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
