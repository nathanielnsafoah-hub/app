import { getDatabase } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, eventId } = body

    if (!name || !eventId) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      )
    }

    const db = getDatabase()

    return new Promise((resolve) => {
      db.run(
        'INSERT INTO participants (name, email, event_id) VALUES (?, ?, ?)',
        [name, email || '', eventId],
        function (err) {
          if (err) {
            console.error('Error adding participant:', err)
            resolve(
              NextResponse.json(
                { success: false, message: 'Error adding participant' },
                { status: 500 }
              )
            )
          } else {
            resolve(
              NextResponse.json({ success: true, participantId: this.lastID })
            )
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

    return new Promise((resolve) => {
      db.all(
        'SELECT id, name, email, invite_token FROM participants WHERE event_id = ? ORDER BY name',
        [eventId],
        (err, rows) => {
          if (err) {
            console.error('Error fetching participants:', err)
            resolve(
              NextResponse.json(
                { success: false, message: 'Error fetching participants' },
                { status: 500 }
              )
            )
          } else {
            resolve(NextResponse.json({ success: true, participants: rows || [] }))
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
