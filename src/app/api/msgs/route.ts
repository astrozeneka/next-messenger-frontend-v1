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
            console.log("Trigger 'conversation updated' to", `user.${cm.id}.conversations`)
            await pusher.trigger(`user.${cm.id}.conversations`, 'conversation-updated', {
                ...entity,
                id: entity.id.toString(),
                conversation_id: entity.conversation_id.toString(),
                sender_id: entity.sender_id.toString()
            });
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

        // Update messages status from 'sent' to 'delivered' when fetched
        const updatedMessages = await prisma.msgs.updateMany({
            where: {
                conversation_id: conversationIdNum,
                sender_id: {
                    not: currentUser!.id
                },
                status: 'sent'  // Only update messages that are currently 'sent'
            },
            data: {
                status: 'delivered'
            }
        });

        console.log(`Updated ${updatedMessages.count} messages to 'delivered' status`);

        // Get conversation members to notify about status updates
        const conversation_members = await prisma.conversation_members.findMany({
            where: {
                conversation_id: conversationIdNum
            }
        });

        // If messages were updated to 'delivered', send Pusher notifications
        if (updatedMessages.count > 0) {
            // Get the updated messages to send in notifications
            const updatedMessagesList = await prisma.msgs.findMany({
                where: {
                    conversation_id: conversationIdNum,
                    sender_id: {
                        not: currentUser!.id
                    },
                    status: 'delivered'
                },
                orderBy: {
                    created_at: 'asc'
                }
            });

            // Send notification for each updated message
            for (const msg of updatedMessagesList) {
                // Broadcast to the conversation channel
                console.log("Trigger 'message-updated' to", `conversation.${conversationIdNum}`);
                await pusher.trigger(`conversation.${conversationIdNum}`, 'message-updated', {
                    ...msg,
                    id: msg.id.toString(),
                    conversation_id: msg.conversation_id.toString(),
                    sender_id: msg.sender_id.toString()
                });

                // Notify each conversation member (TODO LATER)
                /*for (const cm of conversation_members || []) {
                    console.log("Trigger 'conversation updated' to", `user.${cm.user_id}.conversations`);
                    await pusher.trigger(`user.${cm.user_id}.conversations`, 'conversation-updated', {
                        ...msg,
                        id: msg.id.toString(),
                        conversation_id: msg.conversation_id.toString(),
                        sender_id: msg.sender_id.toString()
                    });
                }*/
            }
        }

        console.log("====>", messages);
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