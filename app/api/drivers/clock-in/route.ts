import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { driver_name, vehicle_number, branch, lat, lng } = await req.json();

  if (!driver_name || !vehicle_number || !branch) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  return new Promise<NextResponse>((resolve) => {
    const db = getDatabase();
    db.run(
      `INSERT INTO driver_logs (driver_name, vehicle_number, branch, clock_in_lat, clock_in_lng, status)
       VALUES (?, ?, ?, ?, ?, 'clocked_in')`,
      [driver_name, vehicle_number, branch, lat ?? null, lng ?? null],
      function (err) {
        if (err) resolve(NextResponse.json({ error: err.message }, { status: 500 }));
        else resolve(NextResponse.json({ id: this.lastID, message: 'Clocked in successfully' }));
      }
    );
  });
}
