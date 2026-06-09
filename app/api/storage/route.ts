import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'uploads');

export interface StoredFile {
  filename: string;
  label: string;
  originalName: string;
  uploadedAt: string;
  sizeBytes: number;
}

export async function GET() {
  if (!fs.existsSync(STORAGE_DIR)) {
    return NextResponse.json({ files: [] });
  }

  const entries = fs.readdirSync(STORAGE_DIR)
    .filter(f => !f.startsWith('.'))
    .map(filename => {
      const stat = fs.statSync(path.join(STORAGE_DIR, filename));
      // filename format: 2026-01-15T10-30-00-000Z_statement_MyFile.csv
      const parts = filename.match(/^(.+?)_(statement|gl)_(.+)$/);
      const label = parts?.[2] ?? 'unknown';
      const originalName = parts?.[3] ?? filename;
      const uploadedAt = parts?.[1]?.replace(/-(\d{2})-(\d{2})-(\d{3})Z$/, ':$1:$2.$3Z') ?? stat.mtime.toISOString();
      return {
        filename,
        label,
        originalName,
        uploadedAt,
        sizeBytes: stat.size,
      } satisfies StoredFile;
    })
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));

  return NextResponse.json({ files: entries });
}

export async function DELETE(req: Request) {
  const { filename } = await req.json() as { filename: string };
  if (!filename || filename.includes('..') || filename.includes('/')) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
  }
  const filePath = path.join(STORAGE_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
  fs.unlinkSync(filePath);
  return NextResponse.json({ ok: true });
}
