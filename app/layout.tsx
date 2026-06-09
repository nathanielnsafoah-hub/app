import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Attendance Tracker',
  description: 'Track attendance for events and trainings',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-green-100">
        <nav className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <img src="/logo.jpg" alt="Amenfiman Community Bank" className="h-24 w-56 object-contain" />
                <h1 className="text-2xl font-bold text-primary">Attendance Tracker</h1>
              </div>
              <div className="space-x-4">
                <a href="/" className="text-gray-600 hover:text-primary">Home</a>
                <a href="/admin" className="text-gray-600 hover:text-primary">Admin</a>
                <a href="/reconciliation" className="text-gray-600 hover:text-primary">Reconciliation</a>
                <a href="/storage" className="text-gray-600 hover:text-primary">Storage</a>
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
