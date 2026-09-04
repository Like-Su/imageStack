import { Prisma, PrismaClient } from '../../prisma/generated/prisma/client';

type TransactionWork<T> = (tx: Prisma.TransactionClient) => Promise<T>;

// 检查是否为可重试的事务错误
function isRetryableTransactionError(error: unknown): boolean {
  const value = error as {
    code?: string;
    message?: string;
    meta?: {
      code?: string;
    };
  };

  const prismaCode = value?.code;
  const sqlState = value?.meta?.code;
  const message = value?.message ?? '';

  // 业务冲突不尝试, 序列化冲突或死锁才会重试
  return (
    prismaCode === 'P2034' ||
    sqlState === '40001' ||
    sqlState === '40P01' ||
    /serialization|deadlock|40001|40P01/i.test(message)
  );
}

// 尝试执行可重试的事务
// 每次重试会重新执行每个事务
export async function withSerializable<T>(
  prisma: PrismaClient,
  work: TransactionWork<T>,
  maxRetries = 3,
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 10_000,
      });
    } catch (error) {
      const lastAttempt = attempt === maxRetries - 1;

      if (!isRetryableTransactionError(error) || lastAttempt) {
        throw error;
      }

      const delay = 25 * 2 ** attempt + Math.floor(Math.random() * 25);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error('transaction retry unexpectedly exhausted');
}
