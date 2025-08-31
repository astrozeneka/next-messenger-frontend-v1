import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, AuthenticatedRequest } from "@/lib/authMiddleware";

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const currentUser = request.user;

    // 1. Get the list of users from table
    const users = await prisma.users.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        created_at: true,
        updated_at: true
      },
      where: {
        id: {
          not: parseInt(currentUser!.id)
        }
      }
    });

    // 2. Get conversations with other members
    const conversations = await prisma.conversation_members.findMany({
      where: {
        conversations: {
          conversation_members: {
            some: {
              user_id: parseInt(currentUser!.id)
            }
          }
        }
      },
      select: {
        conversation_id: true,
        user_id: true
      }
    });
    
    // 3. For each user, find or create a conversation
    const serializedUsers = await Promise.all(
      users.map(async (user) => {
        const userConversation = conversations.find((conv: any) => 
          conv.user_id.toString() === user.id.toString() && conv.user_id.toString() !== currentUser!.id
        );
        
        let conversationId: string;
        
        if (userConversation) {
          conversationId = userConversation.conversation_id.toString();
        } else {
          // Create new private conversation
          const newConversation = await prisma.conversations.create({
            data: {
              type: 'private',
              conversation_members: {
                createMany: {
                  data: [
                    { user_id: parseInt(currentUser!.id) },
                    { user_id: user.id }
                  ]
                }
              }
            }
          });
          conversationId = newConversation.id.toString();
        }
        
        return {
          ...user,
          id: user.id.toString(),
          conversation_id: conversationId
        };
      })
    );
    return NextResponse.json(serializedUsers);
  } catch (error) {
    return NextResponse.json({ error: `${error}` }, { status: 500 });
  }
});

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { name, email } = await request.json();
    
    const user = await prisma.users.create({
      data: {
        name,
        email,
        password: "foobar"
      }
    });

    return NextResponse.json({ 
      message: 'User created', 
      user: {
        ...user,
        id: user.id.toString()
      }
    });
  } catch (error) {
    return NextResponse.json({ error: `${error}` }, { status: 500 });
  }
});