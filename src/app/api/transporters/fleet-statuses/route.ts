import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    data: [
      { value: 'available', label: 'Available' },
      { value: 'under_maintenance', label: 'Under Maintenance' },
      { value: 'on_transit', label: 'On Transit' }
    ]
  }, { status: 200 });
}
