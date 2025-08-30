import { NextRequest, NextResponse } from 'next/server';
import AWS from 'aws-sdk';

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_DEFAULT_REGION,
});

export async function POST(request: NextRequest) {
  try {
    const { fileName, fileType, fileSize } = await request.json();

    if (!fileName || !fileType) {
      return NextResponse.json(
        { error: 'fileName and fileType are required' },
        { status: 400 }
      );
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (fileSize && fileSize > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      );
    }

    const key = `uploads/${Date.now()}-${fileName}`;
    
    const params = {
      Bucket: process.env.AWS_BUCKET,
      Key: key,
      Expires: 300, // 5 minutes
      ContentType: fileType,
    };

    const presignedUrl = s3.getSignedUrl('putObject', params);

    return NextResponse.json({
      presignedUrl,
      key,
      bucket: process.env.AWS_BUCKET,
    });

  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate presigned URL' },
      { status: 500 }
    );
  }
}