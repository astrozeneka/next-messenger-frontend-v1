import { AuthenticatedRequest, withAuth } from "@/lib/authMiddleware";
import { prisma } from "@/lib/prisma";
import pusher from "@/lib/pusher-server";
import { NextResponse } from "next/server";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
    try {
        const body = await request.json();
        const { conversation_id, messages } = body;
        const currentUser = request.user;

        // Validate input
        if (!conversation_id || !messages || !Array.isArray(messages) || messages.length === 0) {
            return NextResponse.json(
                { error: 'Invalid input: conversation_id and messages array are required' },
                { status: 400 }
            );
        }

        // Validate each message in the array
        for (const msg of messages) {
            if (!msg.content || !msg.public_key_id) {
                return NextResponse.json(
                    { error: 'Invalid message: content and public_key_id are required for each message' },
                    { status: 400 }
                );
            }
        }

        // Get the next incremental batch_id
        const lastMessage = await prisma.msgs.findFirst({
            orderBy: {
                batch_id: 'desc'
            },
            select: {
                batch_id: true
            }
        });
        
        const batchId = (lastMessage?.batch_id || 0) + 1;
        
        // Create all messages in a transaction
        const entities = await prisma.$transaction(async (tx) => {
            const createdMessages = [];
            for (const msg of messages) {
                const entity = await tx.msgs.create({
                    data: {
                        conversation_id,
                        sender_id: currentUser!.id,
                        content: msg.content,
                        public_key_id: parseInt(msg.public_key_id),
                        batch_id: batchId,
                        status: 'sent' // Possible are 'sent', 'delivered', 'read' (sending is only available for front-end)
                    }
                });
                createdMessages.push(entity);
            }
            return createdMessages;
        });

        // Broadcast each message to conversation channel
        for (const entity of entities) {
            await pusher.trigger(`conversation.${conversation_id}`, 'message-updated', {
                ...entity,
                id: entity.id.toString(),
                conversation_id: entity.conversation_id.toString(),
                sender_id: entity.sender_id.toString(),
                public_key_id: entity.public_key_id?.toString(),
                batch_id: entity.batch_id
            });
        }

        // For each conversation member, update conversation list
        const conversation_members = await prisma.conversation_members.findMany({
            where: {
                conversation_id: conversation_id
            }
        });
        
        // Get the latest batch in this conversation
        const latestBatchMessage = await prisma.msgs.findFirst({
            where: {
                conversation_id: conversation_id
            },
            orderBy: {
                batch_id: 'desc'
            }
        });

        for (const cm of conversation_members || []) {
            // Calculate unread count for this specific user
            // Group by batch_id to avoid counting same message multiple times due to encryption per public key
            const unreadBatches = await prisma.msgs.groupBy({
                by: ['batch_id'],
                where: {
                    conversation_id: conversation_id,
                    sender_id: {
                        not: cm.user_id
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

            const remoteId = cm.user_id;
            console.log("Trigger 'conversation updated' to", `user.${remoteId}.conversations`);
            
            // For e2e encryption: get all public keys for this remote user
            const remoteUserPublicKeys = await prisma.public_keys.findMany({
                where: {
                    user_id: remoteId
                },
                select: {
                    id: true
                }
            });

            // Get all messages from the latest batch that are encrypted for this remote user
            const latestBatchMessagesForUser = await prisma.msgs.findMany({
                where: {
                    conversation_id: conversation_id,
                    batch_id: latestBatchMessage?.batch_id,
                    public_key_id: {
                        in: remoteUserPublicKeys.map(pk => pk.id)
                    }
                }
            });

            // Send notification for each message from the latest batch encrypted for this remote user
            for (const messageForUser of latestBatchMessagesForUser) {
                const updatePayload = {
                    ...messageForUser,
                    id: messageForUser.id.toString(),
                    conversation_id: messageForUser.conversation_id.toString(),
                    sender_id: messageForUser.sender_id.toString(),
                    public_key_id: messageForUser.public_key_id?.toString(),
                    batch_id: messageForUser.batch_id,
                    latestMessage: { // If send via pusher, it should have a value
                        id: messageForUser.id.toString(),
                        content: messageForUser.content,
                        created_at: messageForUser.created_at,
                        sender_id: messageForUser.sender_id.toString(),
                        public_key_id: messageForUser.public_key_id?.toString(),
                        batch_id: messageForUser.batch_id
                    },
                    unread_count: unreadCount
                };

                await pusher.trigger(`user.${remoteId}.conversations`, 'conversation-updated', updatePayload);
            }
        }
        
        return NextResponse.json({
            success: true,
            batch_id: batchId,
            messages_created: entities.length,
            messages: entities.map(entity => ({
                ...entity,
                id: entity.id.toString(),
                conversation_id: entity.conversation_id.toString(),
                sender_id: entity.sender_id.toString(),
                public_key_id: entity.public_key_id!.toString(),
                batch_id: entity.batch_id
            }))
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
        const public_key_id = url.searchParams.get('public_key_id');
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
        const whereClause: any = {
            conversation_id: conversationIdNum
        };
        
        if (public_key_id) {
            whereClause.public_key_id = parseInt(public_key_id);
        }
        
        const messages = await prisma.msgs.findMany({
            where: whereClause,
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
            public_key_id: msg.public_key_id?.toString(),
            batch_id: msg.batch_id,
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