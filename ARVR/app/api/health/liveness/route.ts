import { NextResponse } from 'next/server';

const processStartTime = Date.now();

/**
 * Liveness Probe: GET /api/health/liveness
 * Lightweight event-loop check. Zero database calls.
 * Used by orchestrators (ECS, K8s, Docker) to determine if the process is alive.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'alive',
      uptime: Math.round((Date.now() - processStartTime) / 1000),
      timestamp: new Date().toISOString(),
      pid: process.pid,
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    }
  );
}
