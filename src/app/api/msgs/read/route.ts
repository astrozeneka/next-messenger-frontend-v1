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
        if (!message_ids || !Array.isArray(message_ids) || message_ids.length === 0) {
            return NextResponse.json(
                { error: 'message_ids array is required' },
                { status: 400 }
            );
        }

        if (!conversation_id) {
            return NextResponse.json(
                { error: 'conversation_id is required' },
                { status: 400 }
            );
        }

        // Convert message_ids to numbers and conversation_id to number for consistency
        const messageIdsNum = message_ids.map(id => parseInt(id.toString()));
        const conversationIdNum = parseInt(conversation_id.toString());

        // Validate conversions
        if (messageIdsNum.some(id => isNaN(id)) || isNaN(conversationIdNum)) {
            return NextResponse.json(
                { error: 'Invalid message_ids or conversation_id format' },
                { status: 400 }
            );
        }

        // Update messages status to 'read' 
        // Only for messages not sent by current user and currently in 'delivered' or 'sent' status
        const updateResult = await prisma.msgs.updateMany({
            where: {
                id: {
                    in: messageIdsNum
                },
                conversation_id: conversationIdNum,
                sender_id: {
                    not: currentUser!.id
                },
                status: {
                    in: ['sent', 'delivered']  // Can mark messages as read from either sent or delivered status
                }
            },
            data: {
                status: 'read'
            }
        });

        console.log(`Marked ${updateResult.count} messages as read`);

        // If messages were updated to 'read', send Pusher notifications
        if (updateResult.count > 0) {
            // Get the updated messages to send in notifications
            const updatedMessages = await prisma.msgs.findMany({
                where: {
                    id: {
                        in: messageIdsNum
                    },
                    conversation_id: conversationIdNum,
                    status: 'read'
                },
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
                    public_key_id: msg.public_key_id?.toString()
                });
            }
        }

        return NextResponse.json({
            success: true,
            updated_count: updateResult.count,
            message: `${updateResult.count} messages marked as read`
        });
    } catch (error) {
        console.error('Error marking messages as read:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
});