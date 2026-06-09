'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

export default function PersonalCheckinPage() {
  const params = useParams()
  const token = params.token as string

  const [name, setName] = useState('')
  const [status, setStatus] = useState<'loading' | 'ready' | 'done' | 'already' | 'error'>('loading')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/checkin?token=${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) {
          setStatus('error')
          return
        }
        setName(data.participant.name)
        setStatus(data.alreadyCheckedIn ? 'already' : 'ready')
      })
      .catch(() => setStatus('error'))
  }, [token])

  const handleCheckIn = async () => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()
      setStatus(data.success ? 'done' : 'error')
    } catch {
      setStatus('error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
      <div className="card max-w-md w-full text-center">
        {status === 'loading' && (
          <p className="text-gray-600 text-lg">Loading your invite...</p>
        )}

        {status === 'error' && (
          <>
            <div className="text-5xl mb-4">❌</div>
            <h2 className="text-2xl font-bold text-red-600 mb-2">Invalid Link</h2>
            <p className="text-gray-600">This invite link is not valid. Please check with the organizer.</p>
          </>
        )}

        {status === 'already' && (
          <>
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-green-600 mb-2">Already Checked In</h2>
            <p className="text-gray-700 text-lg">Hi <span className="font-bold">{name}</span>, your attendance has already been recorded.</p>
          </>
        )}

        {status === 'ready' && (
          <>
            <div className="text-5xl mb-4">👋</div>
            <h2 className="text-3xl font-bold mb-2">Hi, {name}!</h2>
            <p className="text-gray-600 mb-8">Click the button below to record your attendance.</p>
            <button
              onClick={handleCheckIn}
              disabled={submitting}
              className="btn btn-primary w-full text-lg py-3"
            >
              {submitting ? 'Checking in...' : 'Check In'}
            </button>
          </>
        )}

        {status === 'done' && (
          <>
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-3xl font-bold text-green-600 mb-2">Checked In!</h2>
            <p className="text-gray-700 text-lg">Hi <span className="font-bold">{name}</span>, your attendance has been recorded. See you there!</p>
          </>
        )}
      </div>
    </div>
  )
}
