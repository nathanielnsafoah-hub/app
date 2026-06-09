import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'uploads');

export async function GET(req: NextRequest) {
  const filename = req.nextUrl.searchParams.get('file');
  if (!filename || filename.includes('..') || filename.includes('/')) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
  }

  const filePath = path.join(STORAGE_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filename).toLowerCase();
  const contentType = ext === '.pdf' ? 'application/pdf' : 'text/csv';

  // Extract the original filename from the stored name for the download prompt
  const originalName = filename.replace(/^.+?_(statement|gl)_/, '');

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${originalName}"`,
    },
  });
}
