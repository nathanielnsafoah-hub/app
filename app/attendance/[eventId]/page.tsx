'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface Participant {
  id: number
  name: string
  email?: string
}

export default function AttendancePage() {
  const params = useParams()
  const eventId = params.eventId as string

  const [participants, setParticipants] = useState<Participant[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Participant | null>(null)
  const [checked, setChecked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/participants?eventId=${eventId}`)
      .then((r) => r.json())
      .then((data) => setParticipants(data.participants || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [eventId])

  const filtered = search.trim()
    ? participants.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase())
      )
    : []

  const handleSelect = (p: Participant) => {
    setSelected(p)
    setSearch(p.name)
  }

  const handleCheckIn = async () => {
    if (!selected) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: selected.id, eventId }),
      })
      const data = await res.json()
      if (data.success) {
        setChecked(true)
      } else {
        alert(data.message || 'Check-in failed')
      }
    } catch {
      alert('Error during check-in')
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setSearch('')
    setSelected(null)
    setChecked(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-100 to-green-50 flex items-center justify-center p-4">
      <div className="card max-w-md w-full">
        <h2 className="text-3xl font-bold text-center mb-8">Event Check-in</h2>

        {loading ? (
          <p className="text-center text-gray-600">Loading...</p>
        ) : participants.length === 0 ? (
          <p className="text-center text-yellow-600 font-medium">
            No participants found for this event. Please check the event link.
          </p>
        ) : checked ? (
          <div className="text-center space-y-4">
            <div className="text-6xl">🎉</div>
            <h3 className="text-2xl font-bold text-green-600">Checked In!</h3>
            <p className="text-gray-700">
              Welcome, <span className="font-bold">{selected?.name}</span>! Your attendance has been recorded.
            </p>
            <button onClick={reset} className="btn btn-secondary w-full mt-4">
              Check in another person
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Search input */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search your name
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setSelected(null) }}
                  placeholder="Type your name..."
                  className="input pl-9"
                  autoComplete="off"
                />
                {search && (
                  <button
                    onClick={() => { setSearch(''); setSelected(null) }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Dropdown results */}
              {filtered.length > 0 && !selected && (
                <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filtered.map((p) => (
                    <li
                      key={p.id}
                      onClick={() => handleSelect(p)}
                      className="px-4 py-3 hover:bg-green-50 cursor-pointer border-b border-gray-100 last:border-0"
                    >
                      {p.name}
                    </li>
                  ))}
                </ul>
              )}

              {search.trim() && filtered.length === 0 && !selected && (
                <p className="mt-2 text-sm text-red-500">No participant found with that name.</p>
              )}
            </div>

            {/* Selected name confirmation */}
            {selected && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 text-sm">
                  Checking in as: <span className="font-bold">{selected.name}</span>
                </p>
              </div>
            )}

            <button
              onClick={handleCheckIn}
              disabled={!selected || submitting}
              className={`btn w-full ${!selected ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'btn-primary'}`}
            >
              {submitting ? 'Checking in...' : 'Check In'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
