import { PrismaClient } from '@prisma/client';
import { applyTenantMiddleware } from './tenant-middleware';
import { immutableTablesExtension } from '../../domains/payments/immutable-tables.extension';

let prismaInstance: ReturnType<typeof createExtendedPrismaClient> | null = null;

function createExtendedPrismaClient() {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

  applyTenantMiddleware(client);

  // Apply immutable tables extension for NFR42 compliance
  // Blocks DELETE/UPDATE on PaymentStateChange, CashReceipt, Refund
  // Blocks financial field updates on Payment
  return client.$extends(immutableTablesExtension);
}

export function getPrismaClient() {
  if (!prismaInstance) {
    prismaInstance = createExtendedPrismaClient();
  }
  return prismaInstance;
}

export const prisma = getPrismaClient();

// Export the extended client type for use in services
export type ExtendedPrismaClient = ReturnType<typeof createExtendedPrismaClient>;
