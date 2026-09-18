import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session.user) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }
    return NextResponse.json({ authenticated: true, user: session.user });
  } catch (error: any) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }
}
