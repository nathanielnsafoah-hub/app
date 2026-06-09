'use client'

import { useState } from 'react'
import { generateEventId, getAttendanceLink } from '@/lib/utils'

export default function Home() {
  const [eventName, setEventName] = useState('')
  const [eventId, setEventId] = useState('')
  const [attendanceLink, setAttendanceLink] = useState('')
  const [showLink, setShowLink] = useState(false)

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!eventName.trim()) {
      alert('Please enter an event name')
      return
    }

    const newEventId = generateEventId()
    setEventId(newEventId)
    
    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newEventId,
          name: eventName,
        }),
      })

      if (response.ok) {
        const link = getAttendanceLink(newEventId)
        setAttendanceLink(link)
        setShowLink(true)
        setEventName('')
      }
    } catch (error) {
      console.error('Error creating event:', error)
      alert('Error creating event')
    }
  }

  return (
    <div className="space-y-8">
      <div className="card max-w-2xl">
        <h2 className="text-2xl font-bold mb-6">Create New Event</h2>
        
        <form onSubmit={handleCreateEvent} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Event Name
            </label>
            <input
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="e.g., Company Training 2024"
              className="input"
            />
          </div>

          <button type="submit" className="btn btn-primary w-full">
            Create Event
          </button>
        </form>
      </div>

      {showLink && (
        <div className="card max-w-2xl bg-blue-50 border-2 border-primary">
          <h3 className="text-xl font-bold mb-4 text-green-600">Event Created Successfully!</h3>
          
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">Event ID:</p>
              <p className="text-lg font-mono bg-white p-3 rounded border border-gray-300">{eventId}</p>
            </div>

            <div>
              <p className="text-sm text-gray-600 mb-2">Share this link with participants:</p>
              <input
                type="text"
                value={attendanceLink}
                readOnly
                className="input bg-white"
              />
            </div>

            <button
              onClick={() => navigator.clipboard.writeText(attendanceLink)}
              className="btn btn-secondary w-full"
            >
              Copy Link
            </button>

            <p className="text-sm text-gray-600">
              Go to <a href="/admin" className="text-primary hover:underline">Admin Dashboard</a> to import participants and view attendance.
            </p>
          </div>
        </div>
      )}

      <div className="card max-w-2xl">
        <h3 className="text-lg font-bold mb-4">How it works:</h3>
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>Create a new event and get a unique link</li>
          <li>Share the link with participants</li>
          <li>Participants use the link to check in and see their name on the list</li>
          <li>Use the Admin Dashboard to import participant details via CSV and view attendance records</li>
        </ol>
      </div>
    </div>
  )
}
