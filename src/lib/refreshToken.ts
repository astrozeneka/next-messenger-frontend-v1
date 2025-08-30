import { prisma } from "@/lib/prisma";
import { generateRefreshToken, getRefreshTokenExpiration } from "@/lib/auth";

export const createRefreshToken = async (userId: string, deviceName: string = 'default') => {
  const refreshToken = generateRefreshToken();
  const expiresAt = getRefreshTokenExpiration();

  await prisma.personal_access_tokens.create({
    data: {
      tokenable_type: 'App\\Models\\User',
      tokenable_id: BigInt(userId),
      name: deviceName,
      token: refreshToken,
      abilities: JSON.stringify(['refresh']),
      expires_at: expiresAt,
      created_at: new Date(),
      updated_at: new Date()
    }
  });

  return refreshToken;
};

export const findRefreshToken = async (token: string) => {
  return await prisma.personal_access_tokens.findFirst({
    where: {
      token,
      expires_at: {
        gt: new Date()
      }
    }
  });
};

export const revokeRefreshToken = async (token: string) => {
  await prisma.personal_access_tokens.deleteMany({
    where: { token }
  });
};

export const revokeAllUserRefreshTokens = async (userId: string) => {
  await prisma.personal_access_tokens.deleteMany({
    where: {
      tokenable_id: BigInt(userId),
      tokenable_type: 'App\\Models\\User'
    }
  });
};

export const cleanExpiredTokens = async () => {
  await prisma.personal_access_tokens.deleteMany({
    where: {
      expires_at: {
        lt: new Date()
      }
    }
  });
};