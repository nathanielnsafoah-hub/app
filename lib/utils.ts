// Generate a unique event ID
export function generateEventId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Generate shareable link for attendees
export function getAttendanceLink(eventId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  return `${baseUrl}/attendance/${eventId}`;
}

// Generate admin link
export function getAdminLink(): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  return `${baseUrl}/admin`;
}
