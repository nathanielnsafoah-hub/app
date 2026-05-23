import { getDatabase } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.json({ success: false, message: 'Missing token' }, { status: 400 })
  }

  const db = getDatabase()

  return new Promise((resolve) => {
    db.get(
      'SELECT id, name, email, event_id FROM participants WHERE invite_token = ?',
      [token],
      (err, row: { id: number; name: string; email: string; event_id: string } | undefined) => {
        if (err || !row) {
          resolve(NextResponse.json({ success: false, message: 'Invalid link' }, { status: 404 }))
          return
        }
        db.get(
          'SELECT id FROM attendance WHERE participant_id = ? AND event_id = ? AND DATE(check_in_time) = DATE(CURRENT_TIMESTAMP)',
          [row.id, row.event_id],
          (err2, existing) => {
            resolve(
              NextResponse.json({
                success: true,
                participant: { id: row.id, name: row.name, event_id: row.event_id },
                alreadyCheckedIn: !!existing,
              })
            )
          }
        )
      }
    )
  })
}

export async function POST(request: NextRequest) {
  const { token } = await request.json()

  if (!token) {
    return NextResponse.json({ success: false, message: 'Missing token' }, { status: 400 })
  }

  const db = getDatabase()

  return new Promise((resolve) => {
    db.get(
      'SELECT id, event_id FROM participants WHERE invite_token = ?',
      [token],
      (err, row: { id: number; event_id: string } | undefined) => {
        if (err || !row) {
          resolve(NextResponse.json({ success: false, message: 'Invalid link' }, { status: 404 }))
          return
        }

        db.get(
          'SELECT id FROM attendance WHERE participant_id = ? AND event_id = ? AND DATE(check_in_time) = DATE(CURRENT_TIMESTAMP)',
          [row.id, row.event_id],
          (err2, existing) => {
            if (existing) {
              resolve(NextResponse.json({ success: false, message: 'Already checked in today' }))
              return
            }

            db.run(
              'INSERT INTO attendance (participant_id, event_id) VALUES (?, ?)',
              [row.id, row.event_id],
              (err3) => {
                if (err3) {
                  resolve(NextResponse.json({ success: false, message: 'Check-in failed' }, { status: 500 }))
                } else {
                  resolve(NextResponse.json({ success: true, message: 'Checked in!' }))
                }
              }
            )
          }
        )
      }
    )
  })
}
