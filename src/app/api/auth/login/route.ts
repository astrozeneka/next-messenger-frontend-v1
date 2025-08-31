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
      where: { email }
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
        email: user.email,
        public_key: user.public_key
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}