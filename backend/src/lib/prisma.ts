import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { rawPrisma?: PrismaClient; prisma?: any };

const rawPrisma =
  globalForPrisma.rawPrisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.rawPrisma = rawPrisma;

// Resilient query extension: automatically retries queries when Neon serverless PostgreSQL is waking up from standby (P1001 / connection drops)
export const prisma = (globalForPrisma.prisma ||
  rawPrisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: { model: string; operation: string; args: any; query: (args: any) => Promise<any> }) {
          let attempts = 0;
          const maxAttempts = 3;

          while (attempts < maxAttempts) {
            try {
              return await query(args);
            } catch (error: any) {
              attempts++;
              const isConnectionError =
                error?.code === 'P1001' ||
                error?.code === 'P1002' ||
                error?.code === 'P1008' ||
                error?.code === 'P1017' ||
                error?.message?.includes("Can't reach database server") ||
                error?.message?.includes('connection closed') ||
                error?.message?.includes('ETIMEDOUT') ||
                error?.message?.includes('ECONNRESET') ||
                error?.message?.includes('Connection pool timeout');

              if (isConnectionError && attempts < maxAttempts) {
                console.warn(
                  `⚠️ [Neon PostgreSQL Wakeup]: ${model}.${operation} failed on attempt ${attempts}/${maxAttempts}. Neon may be resuming from sleep. Retrying in ${attempts * 1200}ms...`
                );
                await new Promise((resolve) => setTimeout(resolve, attempts * 1200));
                try {
                  await rawPrisma.$connect();
                } catch {
                  // non-blocking
                }
              } else {
                throw error;
              }
            }
          }
        },
      },
    },
  })) as unknown as PrismaClient;

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
