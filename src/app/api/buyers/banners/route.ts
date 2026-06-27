import { NextResponse } from 'next/server';

const BANNERS = [
  {
    id: 'fresh-harvest',
    imageUrl: '/banners/fresh-harvest.jpg',
    link: '/buyers/products',
    alt: 'Fresh harvest deals',
    position: 1
  },
  {
    id: 'fleet-booking',
    imageUrl: '/banners/fleet-booking.jpg',
    link: '/buyers/transporter-list',
    alt: 'Book trusted transporters',
    position: 2
  }
];

export async function GET() {
  return NextResponse.json({ success: true, data: BANNERS }, { status: 200 });
}
