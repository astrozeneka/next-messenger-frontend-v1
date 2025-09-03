import { AuthenticatedRequest, withAuth } from "@/lib/authMiddleware";
import { prisma } from "@/lib/prisma";
import pusher from "@/lib/pusher-server";
import { NextResponse } from "next/server";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
    try {
        const body = await request.json();
        const { message_ids, conversation_id } = body;
        const currentUser = request.user;

        // Validate input
        if (!conversation_id) {
            return NextResponse.json(
                { error: 'conversation_id is required' },
                { status: 400 }
            );
        }

        // Convert conversation_id to number for consistency
        const conversationIdNum = parseInt(conversation_id.toString());

        // Validate conversion
        if (isNaN(conversationIdNum)) {
            return NextResponse.json(
                { error: 'Invalid conversation_id format' },
                { status: 400 }
            );
        }

        let updateResult;

        if (message_ids && Array.isArray(message_ids) && message_ids.length > 0) {
            // Specific messages mode: mark only specified messages as delivered
            const messageIdsNum = message_ids.map(id => parseInt(id.toString()));

            // Validate conversions
            if (messageIdsNum.some(id => isNaN(id))) {
                return NextResponse.json(
                    { error: 'Invalid message_ids format' },
                    { status: 400 }
                );
            }

            updateResult = await prisma.msgs.updateMany({
                where: {
                    id: {
                        in: messageIdsNum
                    },
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
        } else {
            // All messages mode: mark all sent messages from remote users as delivered
            updateResult = await prisma.msgs.updateMany({
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
        }

        console.log(`Marked ${updateResult.count} messages as delivered`);

        // If messages were updated to 'delivered', send Pusher notifications
        if (updateResult.count > 0) {
            // Get the updated messages to send in notifications
            let whereClause;
            
            if (message_ids && Array.isArray(message_ids) && message_ids.length > 0) {
                // Specific messages mode
                const messageIdsNum = message_ids.map(id => parseInt(id.toString()));
                whereClause = {
                    id: {
                        in: messageIdsNum
                    },
                    conversation_id: conversationIdNum,
                    status: 'delivered'
                };
            } else {
                // All messages mode
                whereClause = {
                    conversation_id: conversationIdNum,
                    sender_id: {
                        not: currentUser!.id
                    },
                    status: 'delivered'
                };
            }

            const updatedMessages = await prisma.msgs.findMany({
                where: whereClause,
                orderBy: {
                    created_at: 'asc'
                }
            });

            // Send notification for each updated message using a different event name to avoid loops
            for (const msg of updatedMessages) {
                console.log("Trigger 'message-status-updated' to", `conversation.${conversationIdNum}`);
                await pusher.trigger(`conversation.${conversationIdNum}`, 'message-status-updated', {
                    ...msg,
                    id: msg.id.toString(),
                    conversation_id: msg.conversation_id.toString(),
                    sender_id: msg.sender_id.toString(),
                    public_key_id: msg.public_key_id.toString()
                });
            }
        }

        return NextResponse.json({
            success: true,
            updated_count: updateResult.count,
            message: `${updateResult.count} messages marked as delivered`
        });
    } catch (error) {
        console.error('Error marking messages as delivered:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
});