import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, extractTokenFromHeader } from "@/lib/auth";

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export const withAuth = (handler: (request: AuthenticatedRequest) => Promise<NextResponse>) => {
  return async (request: NextRequest) => {
    try {
      const authHeader = request.headers.get('Authorization');
      const token = extractTokenFromHeader(authHeader || '');

      if (!token) {
        return NextResponse.json(
          { error: 'Authorization token required' },
          { status: 401 }
        );
      }

      const payload = verifyToken(token);
      if (!payload) {
        return NextResponse.json(
          { error: 'Invalid or expired token' },
          { status: 401 }
        );
      }

      const user = await prisma.users.findUnique({
        where: { id: BigInt(payload.userId) },
        select: {
          id: true,
          name: true,
          email: true
        }
      });

      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      const authenticatedRequest = request as AuthenticatedRequest;
      authenticatedRequest.user = {
        id: user.id.toString(),
        name: user.name,
        email: user.email
      };

      return await handler(authenticatedRequest);

    } catch (error) {
      console.error('Auth middleware error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
};