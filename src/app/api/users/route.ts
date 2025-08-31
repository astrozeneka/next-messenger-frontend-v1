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
    console.log("==>", conversations)
    
    // 3. Match each user with their conversation ID with current user
    const serializedUsers = users.map(user => {
      const userConversation = conversations.find(conv => 
        conv.user_id.toString() === user.id.toString() && conv.user_id.toString() !== currentUser!.id
      );
      
      return {
        ...user,
        id: user.id.toString(),
        conversation_id: userConversation ? userConversation.conversation_id.toString() : null
      };
    });
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