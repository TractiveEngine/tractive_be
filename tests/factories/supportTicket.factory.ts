import SupportTicket from '@/models/supportTicket';
import mongoose from 'mongoose';

export interface CreateSupportTicketOptions {
  user?: mongoose.Types.ObjectId | string;
  subject?: string;
  message?: string;
  status?: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority?: 'low' | 'medium' | 'high';
  linkedOrder?: mongoose.Types.ObjectId | string | null;
  linkedTransaction?: mongoose.Types.ObjectId | string | null;
  adminNotes?: string;
}

/**
 * Create a support ticket
 */
export async function createSupportTicket(options: CreateSupportTicketOptions = {}) {
  const {
    user,
    subject = 'Test Support Ticket',
    message = 'I need help with my order',
    status = 'open',
    priority = 'medium',
    linkedOrder = null,
    linkedTransaction = null,
    adminNotes,
  } = options;

  if (!user) {
    throw new Error('SupportTicket user is required');
  }

  const ticket = await SupportTicket.create({
    user,
    subject,
    message,
    status,
    priority,
    linkedOrder,
    linkedTransaction,
    adminNotes,
  });

  return ticket;
}

/**
 * Create multiple support tickets
 */
export async function createSupportTickets(
  count: number,
  user: mongoose.Types.ObjectId | string,
  options: Omit<CreateSupportTicketOptions, 'user'> = {}
) {
  const tickets = [];
  for (let i = 0; i < count; i++) {
    tickets.push(await createSupportTicket({ ...options, user }));
  }
  return tickets;
}
