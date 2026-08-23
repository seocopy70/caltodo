import { NextResponse } from 'next/server';
import { verifyRequestUser } from '../../../lib/auth-server';

export async function GET() {
  return NextResponse.json({ test: 'events route works' });
}
