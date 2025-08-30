import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateToken } from "@/lib/auth";
import { findRefreshToken, revokeRefreshToken, createRefreshToken } from "@/lib/refreshToken";

export async function POST(request: NextRequest) {
  try {
    const { refreshToken } = await request.json();

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token is required' },
        { status: 400 }
      );
    }

    const tokenRecord = await findRefreshToken(refreshToken);

    if (!tokenRecord) {
      return NextResponse.json(
        { error: 'Invalid or expired refresh token' },
        { status: 401 }
      );
    }

    const user = await prisma.users.findUnique({
      where: { id: tokenRecord.tokenable_id }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    await revokeRefreshToken(refreshToken);

    const newAccessToken = generateToken({
      userId: user.id.toString(),
      email: user.email
    });

    const newRefreshToken = await createRefreshToken(user.id.toString(), tokenRecord.name);

    return NextResponse.json({
      message: 'Token refreshed successfully',
      token: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id.toString(),
        name: user.name,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}