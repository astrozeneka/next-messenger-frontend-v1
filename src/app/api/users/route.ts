import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const users = await prisma.users.findMany();
    // [{"id":"1","name":"Admin","email":"admin@localhost.com","email_verified_at":null,"password":"","remember_token":null,"created_at":null,"updated_at":null,"google_id":null}]
    const serializedUsers = users.map(user => ({
      ...user,
      id: user.id.toString()
    }));
    return NextResponse.json(serializedUsers);
  } catch (error) {
    return NextResponse.json({ error: `${error}` }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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
}