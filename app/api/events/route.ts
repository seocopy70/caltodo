import { NextResponse } from 'next/server';
import { turso } from '../../../lib/turso';

export async function GET() {
  return NextResponse.json({ test: 'events route works' });
}
