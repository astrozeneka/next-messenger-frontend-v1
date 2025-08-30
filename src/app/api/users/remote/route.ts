import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, AuthenticatedRequest } from "@/lib/authMiddleware";

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const currentUserEmail = searchParams.get('email');
    
    if (!currentUserEmail) {
      return NextResponse.json({ error: "Email parameter is required" }, { status: 400 });
    }

    // Hardcoded logic to determine remote user
    let remoteEmail: string;
    if (currentUserEmail === 'foo@mail.com') {
      remoteEmail = 'bar@mail.com';
    } else if (currentUserEmail === 'bar@mail.com') {
      remoteEmail = 'foo@mail.com';
    } else {
      return NextResponse.json({ error: "Remote user not found for this email" }, { status: 404 });
    }

    // Fetch remote user from database
    const remoteUser = await prisma.users.findUnique({
      where: {
        email: remoteEmail
      },
      select: {
        id: true,
        name: true,
        email: true,
        public_key: true,
        created_at: true,
        updated_at: true
      }
    });

    if (!remoteUser) {
      return NextResponse.json({ error: "Remote user not found in database" }, { status: 404 });
    }

    return NextResponse.json({
      ...remoteUser,
      id: remoteUser.id.toString()
    });
  } catch (error) {
    return NextResponse.json({ error: `${error}` }, { status: 500 });
  }
});