import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, AuthenticatedRequest } from "@/lib/authMiddleware";

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const currentUser = request.user;
    const url = new URL(request.url);
    const conversationId = parseInt(url.pathname.split('/')[3]);

    const remoteUsers = await prisma.conversation_members.findMany({
      where: {
        conversation_id: conversationId,
        user_id: {
          not: parseInt(currentUser!.id)
        }
      },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            public_keys: {
              select: {
                id: true,
                public_key_value: true,
                created_at: true
              }
            }
          }
        }
      }
    });

    const serializedUsers = remoteUsers.map((member: any) => ({
      ...member.users,
      id: member.users.id.toString(),
      public_keys: member.users.public_keys.map((key: any) => ({
        id: key.id.toString(),
        public_key_value: key.public_key_value,
        created_at: key.created_at
      }))
    }));

    return NextResponse.json(serializedUsers);
  } catch (error) {
    return NextResponse.json({ error: `${error}` }, { status: 500 });
  }
});