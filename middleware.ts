import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const pathname = request.nextUrl.pathname

  // When accessed via driverapp.amenfiman.com, redirect root to /drivers
  if (hostname.includes('driverapp.amenfiman.com') && pathname === '/') {
    return NextResponse.redirect(new URL('/drivers', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/',
}
