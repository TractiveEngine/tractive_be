import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import { getAuthUser } from '@/lib/apiAuth';

function normalizeBankAccount(user: any) {
  return {
    bankName: user?.bankName || null,
    accountName: user?.bankAccountName || null,
    accountNumber: user?.bankAccountNumber || null
  };
}

export async function GET(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  const currentUser = await User.findById(user._id).select('bankName bankAccountName bankAccountNumber');
  if (!currentUser) {
    return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: normalizeBankAccount(currentUser)
  }, { status: 200 });
}

export async function PATCH(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  const body: any = await request.json().catch(() => ({}));
  const bankName = typeof body?.bankName === 'string' ? body.bankName.trim() : '';
  const accountName = typeof body?.accountName === 'string' ? body.accountName.trim() : '';
  const accountNumber = typeof body?.accountNumber === 'string' ? body.accountNumber.trim() : '';

  if (!bankName || !accountName || !accountNumber) {
    return NextResponse.json({
      success: false,
      message: 'bankName, accountName, and accountNumber are required'
    }, { status: 400 });
  }

  const updatedUser = await User.findByIdAndUpdate(
    user._id,
    {
      $set: {
        bankName,
        bankAccountName: accountName,
        bankAccountNumber: accountNumber
      }
    },
    { new: true }
  ).select('bankName bankAccountName bankAccountNumber');

  if (!updatedUser) {
    return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: normalizeBankAccount(updatedUser),
    message: 'Bank account updated'
  }, { status: 200 });
}
