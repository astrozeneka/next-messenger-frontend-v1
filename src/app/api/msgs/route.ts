import { AuthenticatedRequest, withAuth } from "@/lib/authMiddleware";
import { prisma } from "@/lib/prisma";
import pusher from "@/lib/pusher-server";
import { NextResponse } from "next/server";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
    try {
        const body = await request.json();
        const { conversation_id, content } = body;
        const currentUser = request.user;

        // Validate input
        if (!conversation_id || !content) {
            return NextResponse.json(
                { error: 'Invalid input' },
                { status: 400 }
            );
        }

        // Save the message as an entity
        const entity = await prisma.msgs.create({
            data: {
                conversation_id,
                sender_id: currentUser!.id,
                content,
                status: 'sent' // Possible are 'sent', 'delivered', 'read' (sending is only available for front-end)
            }
        });

        // Broadcast to everyone
        await pusher.trigger(`conversation.${conversation_id}`, 'message-updated', {
            ...entity,
            id: entity.id.toString(),
            conversation_id: entity.conversation_id.toString(),
            sender_id: entity.sender_id.toString()
        })

        // For each conversation member
        const conversation_members = await prisma.conversation_members.findMany({
            where: {
                conversation_id: conversation_id
            }
        })
        for (const cm of conversation_members || []) {
            // Retrieve the last message
            const latestMessage = await prisma.msgs.findFirst({
                where: {
                    conversation_id: conversation_id
                },
                orderBy: {
                    created_at: 'desc'
                }
            });

            // Calculate unread count for this specific user
            const unreadCount = await prisma.msgs.count({
                where: {
                    conversation_id: conversation_id,
                    sender_id: {
                        not: cm.user_id
                    },
                    status: {
                        in: ['sent', 'delivered']
                    }
                }
            });

            const remoteId = cm.user_id;
            console.log("Trigger 'conversation updated' to", `user.${remoteId}.conversations`)
            
            const updatePayload = {
                ...entity,
                id: entity.id.toString(),
                conversation_id: entity.conversation_id.toString(),
                sender_id: entity.sender_id.toString(),
                latestMessage: latestMessage ? {
                    id: latestMessage.id.toString(),
                    content: latestMessage.content,
                    created_at: latestMessage.created_at,
                    sender_id: latestMessage.sender_id.toString()
                } : null,
                unread_count: unreadCount
            };

            await pusher.trigger(`user.${remoteId}.conversations`, 'conversation-updated', updatePayload);
        }
        

        return NextResponse.json({
            ...entity,
            id: entity.id.toString(),
            conversation_id: entity.conversation_id.toString(),
            sender_id: entity.sender_id.toString()
        });
    } catch (error) {
        console.error('Error processing message:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
})

export const GET = withAuth(async (request: AuthenticatedRequest) => {
    try {
        const url = new URL(request.url);
        const conversation_id = url.searchParams.get('conversation_id');
        const currentUser = request.user;

        // Validate input
        if (!conversation_id) {
            return NextResponse.json(
                { error: 'conversation_id is required' },
                { status: 400 }
            );
        }

        // Convert conversation_id to number for consistency
        const conversationIdNum = parseInt(conversation_id);
        if (isNaN(conversationIdNum)) {
            return NextResponse.json(
                { error: 'Invalid conversation_id' },
                { status: 400 }
            );
        }

        // Fetch messages for the conversation
        const messages = await prisma.msgs.findMany({
            where: {
                conversation_id: conversationIdNum
            },
            orderBy: {
                created_at: 'asc'
            }
        });

        // Note: Messages are no longer automatically marked as delivered when fetched
        // They will be marked as read when actually viewed in the detail view

        return NextResponse.json(messages.map((msg: any) => ({
            ...msg,
            id: msg.id.toString(),
            conversation_id: msg.conversation_id.toString(),
            sender_id: msg.sender_id.toString(),
            status: msg.status
        })));
    } catch (error) {
        console.error('Error fetching messages:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
})