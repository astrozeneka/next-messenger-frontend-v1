import { AuthenticatedRequest, withAuth } from "@/lib/authMiddleware";
import { prisma } from "@/lib/prisma";
import pusher from "@/lib/pusher-server";
import { NextResponse } from "next/server";

export const PUT = withAuth(async (request: AuthenticatedRequest) => {
    try {
        const body = await request.json();
        const { content } = body;
        const currentUser = request.user;
        const messageId = parseInt(request.url.split('/').pop() || '');
        console.log("Message id is", messageId);

        // Validate input
        if (!content || isNaN(messageId)) {
            return NextResponse.json(
                { error: 'Invalid input' },
                { status: 400 }
            );
        }

        // Check if message exists and belongs to the current user
        const existingMessage = await prisma.msgs.findUnique({
            where: { id: messageId }
        });

        if (!existingMessage) {
            return NextResponse.json(
                { error: 'Message not found' },
                { status: 404 }
            );
        }

        if (existingMessage.sender_id != currentUser!.id) {
            return NextResponse.json(
                { error: 'Unauthorized to edit this message' },
                { status: 403 }
            );
        }

        // Update the message
        const updatedMessage = await prisma.msgs.update({
            where: { id: messageId },
            data: {
                content,
                updated_at: new Date()
            }
        });

        // Broadcast the updated message to conversation participants
        await pusher.trigger(`conversation.${updatedMessage.conversation_id}`, 'message-updated', {
            ...updatedMessage,
            id: updatedMessage.id.toString(),
            conversation_id: updatedMessage.conversation_id.toString(),
            sender_id: updatedMessage.sender_id.toString()
        });

        return NextResponse.json({
            ...updatedMessage,
            id: updatedMessage.id.toString(),
            conversation_id: updatedMessage.conversation_id.toString(),
            sender_id: updatedMessage.sender_id.toString()
        });
    } catch (error) {
        console.error('Error updating message:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
});