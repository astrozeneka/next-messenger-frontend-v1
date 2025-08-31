import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword, generateToken } from "@/lib/auth";
import { createRefreshToken } from "@/lib/refreshToken";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const user = await prisma.users.findUnique({
      where: { email },
      include: {
        public_keys: {
          select: {
            id: true,
            public_key_value: true,
            created_at: true
          }
        }
      }
    });

    if (!user || !(await comparePassword(password, user.password))) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const token = generateToken({
      userId: user.id.toString(),
      email: user.email
    });

    const refreshToken = await createRefreshToken(user.id.toString(), 'web-app');

    return NextResponse.json({
      message: 'Login successful',
      token,
      refreshToken,
      user: {
        id: user.id.toString(),
        name: user.name,
        email: user.email
      },
      publicKeys: user.public_keys.map(key => ({
        id: key.id.toString(),
        publicKey: key.public_key_value,
        createdAt: key.created_at
      }))
    });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}