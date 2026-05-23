import { getDatabase } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, description } = body

    if (!id || !name) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      )
    }

    const db = getDatabase()

    return new Promise<NextResponse>((resolve) => {
      db.run(
        'INSERT INTO events (id, name, description) VALUES (?, ?, ?)',
        [id, name, description || ''],
        function (err) {
          if (err) {
            console.error('Error creating event:', err)
            resolve(
              NextResponse.json(
                { success: false, message: 'Error creating event' },
                { status: 500 }
              )
            )
          } else {
            resolve(
              NextResponse.json({ success: true, eventId: id })
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

export async function PATCH(request: NextRequest) {
  try {
    const { id, name } = await request.json()
    if (!id || !name) {
      return NextResponse.json({ success: false, message: 'Missing id or name' }, { status: 400 })
    }
    const db = getDatabase()
    return new Promise<NextResponse>((resolve) => {
      db.run('UPDATE events SET name = ? WHERE id = ?', [name, id], function (err) {
        if (err) {
          resolve(NextResponse.json({ success: false, message: 'Error updating event' }, { status: 500 }))
        } else {
          resolve(NextResponse.json({ success: true }))
        }
      })
    })
  } catch {
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(_request: NextRequest) {
  try {
    const db = getDatabase()

    return new Promise<NextResponse>((resolve) => {
      db.all('SELECT * FROM events ORDER BY created_at DESC', (err, rows) => {
        if (err) {
          console.error('Error fetching events:', err)
          resolve(
            NextResponse.json(
              { success: false, message: 'Error fetching events' },
              { status: 500 }
            )
          )
        } else {
          resolve(NextResponse.json({ success: true, events: rows }))
        }
      })
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
