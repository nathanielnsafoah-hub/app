import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  if (!url) {
    return NextResponse.json({ success: false }, { status: 400 })
  }

  try {
    const res = await fetch('https://cleanuri.com/api/v1/shorten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `url=${encodeURIComponent(url)}`,
    })
    const data = await res.json()
    if (data.result_url) {
      return NextResponse.json({ success: true, shortUrl: data.result_url })
    }
    return NextResponse.json({ success: false }, { status: 500 })
  } catch {
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
