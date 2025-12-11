import { NextResponse } from 'next/server';

export async function GET() {
  // Only show partial keys for security
  const envStatus = {
    RAPIDAPI_KEY: process.env.RAPIDAPI_KEY ? `${process.env.RAPIDAPI_KEY.substring(0, 8)}...` : 'NOT SET',
    APP_RAPIDAPI_KEY: process.env.APP_RAPIDAPI_KEY ? `${process.env.APP_RAPIDAPI_KEY.substring(0, 8)}...` : 'NOT SET',
    NODE_ENV: process.env.NODE_ENV,
    // List all env vars starting with APP_ or RAPIDAPI
    allEnvKeys: Object.keys(process.env).filter(key =>
      key.includes('RAPID') || key.startsWith('APP_')
    ),
  };

  return NextResponse.json(envStatus);
}
