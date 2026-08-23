import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ method: 'GET', ok: true });
}

export async function POST() {
  return NextResponse.json({ method: 'POST', ok: true });
}
