import { AuthenticatedRequest, withAuth } from "@/lib/authMiddleware";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (request: AuthenticatedRequest) => {
    try {
        const url = new URL(request.url);
        const batch_id = url.searchParams.get('batch_id');
        const currentUser = request.user;
        
        if (!batch_id || isNaN(parseInt(batch_id))) {
            return NextResponse.json(
                { error: 'Invalid batch_id parameter' },
                { status: 400 }
            );
        }

        // Get all messages in the batch and verify user ownership
        const messagesInBatch = await prisma.msgs.findMany({
            where: { 
                batch_id: parseInt(batch_id),
                sender_id: parseInt(currentUser!.id)
            },
            select: {
                id: true,
                public_key_id: true,
                content: true
            }
        });

        if (messagesInBatch.length === 0) {
            return NextResponse.json(
                { error: 'No messages found for this batch or unauthorized access' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            batch_id: parseInt(batch_id),
            messages: messagesInBatch.map(msg => ({
                id: msg.id.toString(),
                public_key_id: msg.public_key_id?.toString(),
                content: msg.content
            }))
        });
    } catch (error) {
        console.error('Error getting batch messages:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
});