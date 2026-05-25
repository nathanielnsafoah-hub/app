'use client'

import { useEffect, useState } from 'react'

interface Event {
  id: string
  name: string
  created_at: string
}

interface AttendanceRecord {
  participant_name: string
  check_in_time: string
}

interface Participant {
  id: number
  name: string
  email: string
  invite_token: string
}

export default function AdminDashboard() {
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEvent, setSelectedEvent] = useState<string>('')
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [tab, setTab] = useState<'attendance' | 'links'>('attendance')
  const [copied, setCopied] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [shortLink, setShortLink] = useState('')
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [newEventName, setNewEventName] = useState('')
  const [addingEvent, setAddingEvent] = useState(false)
  const [editingEvent, setEditingEvent] = useState(false)
  const [editEventName, setEditEventName] = useState('')
  const [clearing, setClearing] = useState(false)
  const [clearingParticipants, setClearingParticipants] = useState(false)

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

  useEffect(() => {
    fetchEvents()
  }, [])

  useEffect(() => {
    if (selectedEvent) {
      fetchAttendance(selectedEvent)
      fetchParticipants(selectedEvent)
      setShortLink(`${baseUrl}/amenfiman`)
    }
  }, [selectedEvent])

  const fetchEvents = async () => {
    try {
      const response = await fetch('/api/events')
      const data = await response.json()
      setEvents(data.events || [])
      if (data.events && data.events.length > 0) {
        setSelectedEvent(data.events[0].id)
      }
    } catch (error) {
      console.error('Error fetching events:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAttendance = async (eventId: string) => {
    try {
      const response = await fetch(`/api/attendance?eventId=${eventId}`)
      const data = await response.json()
      setAttendance(data.attendance || [])
    } catch (error) {
      console.error('Error fetching attendance:', error)
    }
  }

  const fetchParticipants = async (eventId: string) => {
    try {
      const response = await fetch(`/api/participants?eventId=${eventId}`)
      const data = await response.json()
      setParticipants(data.participants || [])
    } catch (error) {
      console.error('Error fetching participants:', error)
    }
  }

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedEvent) {
      alert('Please select an event and a CSV file')
      return
    }

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('eventId', selectedEvent)

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      if (data.success) {
        setMessage(`✓ Successfully imported ${data.count} participants`)
        fetchAttendance(selectedEvent)
        fetchParticipants(selectedEvent)
        setTab('links')
        setTimeout(() => setMessage(''), 4000)
      } else {
        setMessage(`✗ Error: ${data.message}`)
      }
    } catch (error) {
      console.error('Error uploading CSV:', error)
      setMessage('✗ Error uploading file')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const copyLink = (token: string) => {
    const link = `${baseUrl}/checkin/${token}`
    navigator.clipboard.writeText(link)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  const copyAllLinks = () => {
    const text = participants
      .map((p) => `${p.name}: ${baseUrl}/checkin/${p.invite_token}`)
      .join('\n')
    navigator.clipboard.writeText(text)
    setCopied('all')
    setTimeout(() => setCopied(null), 2000)
  }

  const handleAddEvent = async () => {
    if (!newEventName.trim()) return
    setAddingEvent(true)
    try {
      const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: newEventName.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        setNewEventName('')
        setShowAddEvent(false)
        await fetchEvents()
        setSelectedEvent(id)
      }
    } catch (error) {
      console.error('Error adding event:', error)
    } finally {
      setAddingEvent(false)
    }
  }

  const handleEditEvent = async () => {
    if (!editEventName.trim() || !selectedEvent) return
    try {
      const res = await fetch('/api/events', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedEvent, name: editEventName.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        setEditingEvent(false)
        await fetchEvents()
      }
    } catch (error) {
      console.error('Error editing event:', error)
    }
  }

  const handleClearParticipants = async () => {
    if (!selectedEvent) return
    const confirmed = window.confirm(
      'Are you sure you want to clear all invite links and attendance records for this event? This cannot be undone.'
    )
    if (!confirmed) return
    setClearingParticipants(true)
    try {
      const res = await fetch(`/api/participants?eventId=${selectedEvent}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setParticipants([])
        setAttendance([])
        setMessage('✓ Invite links and attendance records cleared')
        setTimeout(() => setMessage(''), 4000)
      } else {
        setMessage(`✗ Error: ${data.message}`)
      }
    } catch {
      setMessage('✗ Error clearing participants')
    } finally {
      setClearingParticipants(false)
    }
  }

  const handleClearAttendance = async () => {
    if (!selectedEvent) return
    const confirmed = window.confirm(
      'Are you sure you want to clear all attendance records for this event? This cannot be undone.'
    )
    if (!confirmed) return
    setClearing(true)
    try {
      const res = await fetch(`/api/attendance?eventId=${selectedEvent}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setAttendance([])
        setMessage(`✓ Attendance records cleared`)
        setTimeout(() => setMessage(''), 4000)
      } else {
        setMessage(`✗ Error: ${data.message}`)
      }
    } catch {
      setMessage('✗ Error clearing attendance')
    } finally {
      setClearing(false)
    }
  }

  const downloadAttendance = () => {
    const eventName = events.find((e) => e.id === selectedEvent)?.name || 'event'
    const rows = ['Name,Check-In Time', ...attendance.map((r) =>
      `"${r.participant_name}","${new Date(r.check_in_time).toLocaleString()}"`
    )]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${eventName.replace(/\s+/g, '_')}_attendance.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const sharedLink = selectedEvent ? `${baseUrl}/attendance/${selectedEvent}` : ''

  const copySharedLink = () => {
    navigator.clipboard.writeText(shortLink || sharedLink)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold">Admin Dashboard</h1>

      {/* Shared attendance link */}
      {selectedEvent && (
        <div className="card bg-green-50 border-2 border-green-400">
          <h2 className="text-lg font-bold text-green-800 mb-1">Shared Attendance Link</h2>
          <p className="text-sm text-green-700 mb-3">Share this one link with all participants — they open it and select their name to check in.</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={shortLink || sharedLink}
              readOnly
              className="input bg-white flex-1 text-sm"
            />
            <button onClick={copySharedLink} className="btn btn-primary shrink-0">
              {linkCopied ? '✓ Copied!' : 'Copy Link'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* CSV Upload Section */}
        <div className="lg:col-span-1">
          <div className="card">
            <h2 className="text-xl font-bold mb-4">Import Participants</h2>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Select Event</label>
                  <button
                    onClick={() => { setShowAddEvent(true); setEditingEvent(false) }}
                    className="text-xs btn btn-primary py-1 px-3"
                  >
                    + New Event
                  </button>
                </div>

                {/* Add event form */}
                {showAddEvent && (
                  <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg space-y-2">
                    <input
                      type="text"
                      value={newEventName}
                      onChange={(e) => setNewEventName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddEvent()}
                      placeholder="Event name..."
                      className="input text-sm"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button onClick={handleAddEvent} disabled={addingEvent || !newEventName.trim()} className="btn btn-primary text-xs flex-1">
                        {addingEvent ? 'Adding...' : 'Add'}
                      </button>
                      <button onClick={() => { setShowAddEvent(false); setNewEventName('') }} className="btn btn-secondary text-xs flex-1">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <select
                    value={selectedEvent}
                    onChange={(e) => { setSelectedEvent(e.target.value); setEditingEvent(false) }}
                    className="input"
                  >
                    <option value="">-- Select Event --</option>
                    {events.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.name}
                      </option>
                    ))}
                  </select>
                  {selectedEvent && (
                    <button
                      onClick={() => { setEditingEvent(true); setEditEventName(events.find(e => e.id === selectedEvent)?.name || ''); setShowAddEvent(false) }}
                      className="btn btn-secondary text-xs px-3"
                      title="Rename event"
                    >
                      ✏️
                    </button>
                  )}
                </div>

                {/* Edit event form */}
                {editingEvent && (
                  <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg space-y-2">
                    <p className="text-xs text-yellow-700 font-medium">Rename event</p>
                    <input
                      type="text"
                      value={editEventName}
                      onChange={(e) => setEditEventName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleEditEvent()}
                      className="input text-sm"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button onClick={handleEditEvent} disabled={!editEventName.trim()} className="btn btn-primary text-xs flex-1">
                        Save
                      </button>
                      <button onClick={() => setEditingEvent(false)} className="btn btn-secondary text-xs flex-1">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload CSV File
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVUpload}
                  disabled={!selectedEvent || uploading}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-2">
                  CSV format: one name per line
                </p>
              </div>

              {message && (
                <div className={`p-3 rounded ${message.includes('✓') ? 'bg-green-50' : 'bg-red-50'}`}>
                  <p className={message.includes('✓') ? 'text-green-700' : 'text-red-700'}>
                    {message}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right panel with tabs */}
        <div className="lg:col-span-2">
          <div className="card">
            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b border-gray-200">
              <button
                onClick={() => setTab('attendance')}
                className={`pb-3 px-4 font-semibold text-sm border-b-2 transition-colors ${
                  tab === 'attendance'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Attendance Records
              </button>
              <button
                onClick={() => setTab('links')}
                className={`pb-3 px-4 font-semibold text-sm border-b-2 transition-colors ${
                  tab === 'links'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Invite Links ({participants.length})
              </button>
            </div>

            {/* Attendance tab */}
            {tab === 'attendance' && (
              <>
                {loading ? (
                  <p className="text-gray-600">Loading...</p>
                ) : attendance.length === 0 ? (
                  <p className="text-gray-600">No attendance records yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Check-In Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendance.map((record, idx) => (
                          <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-4">{record.participant_name}</td>
                            <td className="py-3 px-4 text-sm text-gray-600">
                              {new Date(record.check_in_time).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    Total Checked In: <span className="font-bold text-lg">{attendance.length}</span>
                  </p>
                  <div className="flex gap-2">
                    {attendance.length > 0 && (
                      <button onClick={downloadAttendance} className="btn btn-secondary text-sm">
                        Download CSV
                      </button>
                    )}
                    {selectedEvent && (
                      <button
                        onClick={handleClearAttendance}
                        disabled={clearing}
                        className="btn text-sm bg-red-100 text-red-700 hover:bg-red-200 border border-red-300"
                      >
                        {clearing ? 'Clearing...' : 'Clear Records'}
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Invite links tab */}
            {tab === 'links' && (
              <>
                {participants.length === 0 ? (
                  <p className="text-gray-600">No participants yet. Upload a CSV to generate invite links.</p>
                ) : (
                  <>
                    <div className="flex justify-between items-center mb-4">
                      <p className="text-sm text-gray-600">Send each person their personal link to check in.</p>
                      <div className="flex gap-2">
                        <button
                          onClick={copyAllLinks}
                          className="btn btn-secondary text-sm"
                        >
                          {copied === 'all' ? '✓ Copied All!' : 'Copy All Links'}
                        </button>
                        <button
                          onClick={handleClearParticipants}
                          disabled={clearingParticipants}
                          className="btn text-sm bg-red-100 text-red-700 hover:bg-red-200 border border-red-300"
                        >
                          {clearingParticipants ? 'Clearing...' : 'Clear Records'}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {participants.map((p) => (
                        <div key={p.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900">{p.name}</p>
                            <p className="text-xs text-gray-500 truncate">
                              {baseUrl}/checkin/{p.invite_token}
                            </p>
                          </div>
                          <button
                            onClick={() => copyLink(p.invite_token)}
                            className="btn btn-secondary text-xs shrink-0"
                          >
                            {copied === p.invite_token ? '✓ Copied!' : 'Copy'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="card bg-blue-50 border-2 border-primary">
        <h3 className="text-lg font-bold mb-3">CSV Import Format</h3>
        <p className="text-sm text-gray-700 mb-3">Upload a CSV file with one name per line — no header needed:</p>
        <div className="bg-white p-3 rounded font-mono text-sm">
          <div>John Doe</div>
          <div>Jane Smith</div>
          <div>Alice Johnson</div>
        </div>
      </div>
    </div>
  )
}
