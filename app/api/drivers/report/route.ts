import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const branch = searchParams.get('branch');

  return new Promise<NextResponse>((resolve) => {
    const db = getDatabase();
    let sql = `SELECT * FROM driver_logs WHERE 1=1`;
    const params: string[] = [];

    if (date) {
      sql += ` AND DATE(clock_in_time) = ?`;
      params.push(date);
    }
    if (branch && branch !== 'ALL') {
      sql += ` AND branch = ?`;
      params.push(branch);
    }

    sql += ` ORDER BY clock_in_time DESC`;

    db.all(sql, params, (err, rows) => {
      if (err) resolve(NextResponse.json({ error: err.message }, { status: 500 }));
      else resolve(NextResponse.json({ logs: rows }));
    });
  });
}
