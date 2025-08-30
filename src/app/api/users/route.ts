import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, AuthenticatedRequest } from "@/lib/authMiddleware";

export const GET = withAuth(async () => {
  try {
    const users = await prisma.users.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        created_at: true,
        updated_at: true
      }
    });
    
    const serializedUsers = users.map(user => ({
      ...user,
      id: user.id.toString()
    }));
    return NextResponse.json(serializedUsers);
  } catch (error) {
    return NextResponse.json({ error: `${error}` }, { status: 500 });
  }
});

export const POST = withAuth(async (request: AuthenticatedRequest) => {
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
});