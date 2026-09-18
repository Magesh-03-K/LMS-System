import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getOAuth2Client } from '@/lib/googleDrive';

export async function GET() {
  try {
    await requireAuth(['ADMIN']);

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured in environment variables.' },
        { status: 400 }
      );
    }

    const oauth2Client = getOAuth2Client();

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      prompt: 'consent',
    });

    return NextResponse.json({ success: true, url: authUrl });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to initiate Google OAuth flow.' }, { status: 500 });
  }
}
