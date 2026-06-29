import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { id, lat, lng, km_consumed, notes } = await req.json();

  if (!id) return NextResponse.json({ error: 'Log ID required' }, { status: 400 });

  return new Promise<NextResponse>((resolve) => {
    const db = getDatabase();
    db.run(
      `UPDATE driver_logs SET
        clock_out_time = CURRENT_TIMESTAMP,
        clock_out_lat = ?,
        clock_out_lng = ?,
        km_consumed = ?,
        notes = ?,
        status = 'clocked_out'
       WHERE id = ? AND status = 'clocked_in'`,
      [lat ?? null, lng ?? null, km_consumed ?? 0, notes ?? null, id],
      function (err) {
        if (err) resolve(NextResponse.json({ error: err.message }, { status: 500 }));
        else if (this.changes === 0) resolve(NextResponse.json({ error: 'Log not found or already clocked out' }, { status: 404 }));
        else resolve(NextResponse.json({ message: 'Clocked out successfully' }));
      }
    );
  });
}
