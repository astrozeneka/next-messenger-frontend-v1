import pusher from "@/lib/pusher-server";
import { NextResponse } from "next/server";

export const POST = async (request: Request) => {
    try {
        const body = await request.json();
        const { message, username, channel = 'chat' } = body;

        // Validate required fields
        if (!message || !username) {
            return NextResponse.json(
                { error: 'Message and username are required' },
                { status: 400 }
            );
        }

        // Broadcast to everyone
        await pusher.trigger(channel, 'new-message', {
            message,
            username
        });

        console.log("Hello intercepted");

        // Return hello world
        return NextResponse.json(
            { message: 'Hello world' },
            { status: 200 }
        );
    } catch (error) {
        console.error('Error processing message:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}