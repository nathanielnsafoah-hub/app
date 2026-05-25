import { getDatabase } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { participantId, eventId } = body

    if (!participantId || !eventId) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      )
    }

    const db = getDatabase()

    return new Promise<NextResponse>((resolve) => {
      // Check if already checked in
      db.get(
        'SELECT id FROM attendance WHERE participant_id = ? AND event_id = ?',
        [participantId, eventId],
        (err, row) => {
          if (err) {
            console.error('Error checking attendance:', err)
            resolve(
              NextResponse.json(
                { success: false, message: 'Error during check-in' },
                { status: 500 }
              )
            )
            return
          }

          if (row) {
            resolve(
              NextResponse.json({
                success: false,
                message: 'You have already checked in today',
              })
            )
            return
          }

          // Record new attendance
          db.run(
            'INSERT INTO attendance (participant_id, event_id) VALUES (?, ?)',
            [participantId, eventId],
            function (err) {
              if (err) {
                console.error('Error recording attendance:', err)
                resolve(
                  NextResponse.json(
                    { success: false, message: 'Error recording attendance' },
                    { status: 500 }
                  )
                )
              } else {
                resolve(
                  NextResponse.json({ success: true, message: 'Check-in successful' })
                )
              }
            }
          )
        }
      )
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const eventId = searchParams.get('eventId')

    if (!eventId) {
      return NextResponse.json(
        { success: false, message: 'Missing eventId' },
        { status: 400 }
      )
    }

    const db = getDatabase()

    return new Promise<NextResponse>((resolve) => {
      db.run(
        'DELETE FROM attendance WHERE event_id = ?',
        [eventId],
        function (err) {
          if (err) {
            console.error('Error clearing attendance:', err)
            resolve(
              NextResponse.json(
                { success: false, message: 'Error clearing attendance' },
                { status: 500 }
              )
            )
          } else {
            resolve(NextResponse.json({ success: true, deleted: this.changes }))
          }
        }
      )
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const eventId = searchParams.get('eventId')

    if (!eventId) {
      return NextResponse.json(
        { success: false, message: 'Missing eventId' },
        { status: 400 }
      )
    }

    const db = getDatabase()

    return new Promise<NextResponse>((resolve) => {
      db.all(
        `SELECT p.name as participant_name, a.check_in_time 
         FROM attendance a 
         JOIN participants p ON a.participant_id = p.id 
         WHERE a.event_id = ? 
         ORDER BY a.check_in_time DESC`,
        [eventId],
        (err, rows) => {
          if (err) {
            console.error('Error fetching attendance:', err)
            resolve(
              NextResponse.json(
                { success: false, message: 'Error fetching attendance' },
                { status: 500 }
              )
            )
          } else {
            resolve(NextResponse.json({ success: true, attendance: rows || [] }))
          }
        }
      )
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
