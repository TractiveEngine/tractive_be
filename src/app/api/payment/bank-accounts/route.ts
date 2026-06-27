import { NextResponse } from 'next/server';

const BANK_ACCOUNTS = [
  {
    id: 'tractive-access',
    bank: 'Access Bank',
    accountName: 'Tractive Foods Limited',
    accountNumber: '0123456789',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/5f/Access_Bank_logo.svg',
    sortOrder: 1
  },
  {
    id: 'tractive-gtb',
    bank: 'Guaranty Trust Bank',
    accountName: 'Tractive Foods Limited',
    accountNumber: '0987654321',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/34/Guaranty_Trust_Bank_logo.svg',
    sortOrder: 2
  }
];

export async function GET() {
  return NextResponse.json({ success: true, data: BANK_ACCOUNTS }, { status: 200 });
}

