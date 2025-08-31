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
        await pusher.trigger(`conversation.${conversation_id}`, 'message-sent', {
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