import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, generateToken } from "@/lib/auth";
import { createRefreshToken } from "@/lib/refreshToken";

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    const existingUser = await prisma.users.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists with this email' },
        { status: 409 }
      );
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.users.create({
      data: {
        name,
        email,
        password: hashedPassword
      }
    });

    const token = generateToken({
      userId: user.id.toString(),
      email: user.email
    });

    const refreshToken = await createRefreshToken(user.id.toString(), 'web-app');

    return NextResponse.json({
      message: 'Registration successful',
      token,
      refreshToken,
      user: {
        id: user.id.toString(),
        name: user.name,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}