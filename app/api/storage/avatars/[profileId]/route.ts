import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { logServerError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import {
  isExternalFileUrl,
  isLocalStoredFilePath,
  readPrivateUpload,
} from "@/lib/storage/local";

export const runtime = "nodejs";

function getAvatarContentType(filePath: string) {
  const normalizedPath = filePath.toLowerCase();

  if (normalizedPath.endsWith(".png")) {
    return "image/png";
  }

  if (normalizedPath.endsWith(".webp")) {
    return "image/webp";
  }

  return "image/jpeg";
}

export async function GET(_: Request, context: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await context.params;
  const currentProfile = await getCurrentProfile();

  if (!currentProfile?.organization_id || !currentProfile.is_active) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const targetProfile = await prisma.user.findFirst({
    where: {
      id: profileId,
      organization_id: currentProfile.organization_id,
    },
    select: {
      id: true,
      organization_id: true,
      image: true,
    },
  });

  if (!targetProfile?.image) {
    return NextResponse.json({ error: "Avatar not found." }, { status: 404 });
  }

  if (!targetProfile.organization_id) {
    return NextResponse.json({ error: "Avatar not found." }, { status: 404 });
  }

  if (isExternalFileUrl(targetProfile.image)) {
    return NextResponse.redirect(targetProfile.image);
  }

  if (!isLocalStoredFilePath(targetProfile.image)) {
    return NextResponse.json({ error: "Avatar file is missing." }, { status: 404 });
  }

  try {
    const file = await readPrivateUpload(targetProfile.image);

    return new NextResponse(file.content, {
      headers: {
        "Content-Type": getAvatarContentType(targetProfile.image),
        "Cache-Control": "private, max-age=60",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (readError) {
    logServerError("storage.avatar.read", readError, {
      profileId,
      avatarPath: targetProfile.image,
    });
    return NextResponse.json({ error: "Avatar file is missing." }, { status: 404 });
  }
}
