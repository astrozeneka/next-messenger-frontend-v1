import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthenticatedRequest, withAuth } from "@/lib/authMiddleware";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { publicKey } = await request.json();
    const currentUser = request.user;

    if (!publicKey) {
      return NextResponse.json(
        { error: 'Public key is required' },
        { status: 400 }
      );
    }

    if (!currentUser?.id) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // Check if this public key already exists for this user
    const existingKey = await prisma.public_keys.findFirst({
      where: {
        public_key_value: publicKey,
        user_id: parseInt(currentUser.id)
      }
    });

    if (existingKey) {
      return NextResponse.json(
        { 
          message: 'Public key already exists',
          publicKeyId: existingKey.id.toString()
        },
        { status: 200 }
      );
    }

    // Create new public key entry
    const newPublicKey = await prisma.public_keys.create({
      data: {
        public_key_value: publicKey,
        user_id: parseInt(currentUser.id)
      }
    });

    return NextResponse.json({
      message: 'Public key stored successfully',
      publicKeyId: newPublicKey.id.toString(),
      public_key: {
        id: newPublicKey.id.toString(),
        public_key_value: newPublicKey.public_key_value
      }
    });

  } catch (error) {
    console.error('Error storing public key:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});