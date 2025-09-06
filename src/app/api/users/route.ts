import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, AuthenticatedRequest } from "@/lib/authMiddleware";

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const url = new URL(request.url);
    const public_key_id = url.searchParams.get('public_key_id');
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

        // 3.A For each conversation, find the latest message
        const whereClause: any = {
          conversation_id: conversationId
        };
        
        if (public_key_id) {
          whereClause.public_key_id = parseInt(public_key_id);
        }
        
        const latestMessage = await prisma.msgs.findFirst({
          where: whereClause,
          orderBy: {
            created_at: 'desc'
          },
          select: {
            id: true,
            content: true,
            created_at: true,
            sender_id: true,
            public_key_id: true,
            batch_id: true
          }
        });

        // 3.B Calculate unread count (messages from other users that are not 'read')
        // Group by batch_id to avoid counting same message multiple times due to encryption per public key
        const unreadBatches = await prisma.msgs.groupBy({
          by: ['batch_id'],
          where: {
            conversation_id: parseInt(conversationId),
            sender_id: {
              not: parseInt(currentUser!.id)
            },
            status: {
              in: ['sent', 'delivered']
            },
            batch_id: {
              not: null
            }
          }
        });
        const unreadCount = unreadBatches.length;

        return {
          ...user,
          id: user.id.toString(),
          conversation_id: conversationId,
          latest_message: latestMessage ? {
            id: latestMessage.id.toString(),
            content: latestMessage.content,
            created_at: latestMessage.created_at,
            sender_id: latestMessage.sender_id.toString(),
            public_key_id: latestMessage.public_key_id?.toString(),
            batch_id: latestMessage.batch_id
          } : null,
          unread_count: unreadCount
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