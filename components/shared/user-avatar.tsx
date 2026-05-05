"use client";

import { useState } from "react";
import Image from "next/image";
import { cn, getInitials } from "@/lib/utils";

type UserAvatarProps = {
  imageUrl?: string | null;
  fullName?: string | null;
  email?: string | null;
  className?: string;
  initialsClassName?: string;
};

export function UserAvatar({
  imageUrl,
  fullName,
  email,
  className,
  initialsClassName,
}: UserAvatarProps) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const initials = getInitials(fullName, email);
  const altText = fullName?.trim() || email || "User avatar";
  const shouldShowImage = !!imageUrl && failedImageUrl !== imageUrl;
  const avatarImageUrl = shouldShowImage ? imageUrl : null;

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-full bg-primary text-primary-foreground shadow-sm",
        className,
      )}
    >
      {shouldShowImage ? (
        <Image
          src={avatarImageUrl as string}
          alt={altText}
          fill
          unoptimized
          className="object-cover"
          sizes="128px"
          onError={() => setFailedImageUrl(imageUrl)}
        />
      ) : (
        <span className={cn("text-sm font-semibold", initialsClassName)}>{initials}</span>
      )}
    </div>
  );
}
