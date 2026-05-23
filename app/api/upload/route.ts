import { getDatabase } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

function generateToken(): string {
  return randomBytes(12).toString('hex')
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const eventId = formData.get('eventId') as string

    if (!file || !eventId) {
      return NextResponse.json(
        { success: false, message: 'Missing file or eventId' },
        { status: 400 }
      )
    }

    // Read the file content
    const text = await file.text()
    const lines = text.trim().split('\n')

    if (lines.length < 1) {
      return NextResponse.json(
        { success: false, message: 'CSV file is empty' },
        { status: 400 }
      )
    }

    const participants: Array<{ name: string; email: string; token: string }> = []

    for (const line of lines) {
      const name = line.trim()
      if (name) {
        participants.push({ name, email: '', token: generateToken() })
      }
    }

    if (participants.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No valid participants found in CSV' },
        { status: 400 }
      )
    }

    // Insert participants into database
    const db = getDatabase()
    let insertedCount = 0

    return new Promise((resolve) => {
      db.serialize(() => {
        participants.forEach((participant) => {
          db.run(
            'INSERT INTO participants (name, email, event_id, invite_token) VALUES (?, ?, ?, ?)',
            [participant.name, participant.email, eventId, participant.token],
            (err) => {
              if (!err) {
                insertedCount++
              } else {
                console.error('Error inserting participant:', err)
              }
            }
          )
        })

        // Wait for all inserts to complete
        db.exec('SELECT 1', () => {
          resolve(
            NextResponse.json({
              success: true,
              message: 'CSV imported successfully',
              count: insertedCount,
            })
          )
        })
      })
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { success: false, message: 'Error processing CSV file' },
      { status: 500 }
    )
  }
}
