import { PrismaClient } from '@prisma/client';
import { applyTenantMiddleware } from './tenant-middleware';

let prismaInstance: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
    });

    applyTenantMiddleware(prismaInstance);
  }
  return prismaInstance;
}

export const prisma = getPrismaClient();
