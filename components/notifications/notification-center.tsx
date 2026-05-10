"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type NotificationRow,
} from "@/lib/notifications/notifications";
import { cn } from "@/lib/utils";

type NotificationCenterProps = {
  initialNotifications: NotificationRow[];
  initialUnreadCount: number;
};

export function NotificationCenter({
  initialNotifications,
  initialUnreadCount,
}: NotificationCenterProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [isPending, startTransition] = useTransition();
  const notificationsRef = useRef(initialNotifications);
  const unreadCountRef = useRef(initialUnreadCount);

  const hasNotifications = notifications.length > 0;
  const unreadLabel = useMemo(() => (unreadCount > 9 ? "9+" : String(unreadCount)), [unreadCount]);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  useEffect(() => {
    unreadCountRef.current = unreadCount;
  }, [unreadCount]);

  useEffect(() => {
    let isMounted = true;

    async function refreshNotifications() {
      if (document.visibilityState === "hidden") {
        return;
      }

      try {
        const response = await fetch("/api/notifications", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          notifications: NotificationRow[];
          unreadCount: number;
        };

        if (!isMounted) {
          return;
        }

        const currentIds = notificationsRef.current.map((notification) => notification.id).join("|");
        const nextIds = data.notifications.map((notification) => notification.id).join("|");
        const currentUnread = unreadCountRef.current;

        if (currentIds !== nextIds || currentUnread !== data.unreadCount) {
          setNotifications(data.notifications);
          setUnreadCount(data.unreadCount);
        }
      } catch {
        // Keep the bell quiet on transient polling failures.
      }
    }

    const intervalId = window.setInterval(refreshNotifications, 25000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshNotifications();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  function updateAsRead(notificationId: string) {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? {
              ...notification,
              is_read: true,
              read_at: new Date().toISOString(),
            }
          : notification,
      ),
    );
    setUnreadCount((current) => Math.max(0, current - 1));
  }

  function handleNotificationClick(notification: NotificationRow) {
    if (!notification.is_read) {
      updateAsRead(notification.id);
      startTransition(async () => {
        await markNotificationAsRead(notification.id);
        router.refresh();
      });
    }
  }

  function handleMarkAllAsRead() {
    if (unreadCount === 0) {
      return;
    }

    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        is_read: true,
        read_at: notification.read_at ?? new Date().toISOString(),
      })),
    );
    setUnreadCount(0);
    startTransition(async () => {
      await markAllNotificationsAsRead();
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm outline-none transition-all hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/90 dark:hover:border-slate-700 dark:hover:bg-slate-900" aria-label="Open notifications">
          <Bell className="size-5 text-slate-600 dark:text-slate-300" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-black text-white shadow-sm ring-2 ring-white dark:ring-slate-950">
              {unreadLabel}
            </span>
          ) : null}
          <span className="sr-only">Notifications</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} className="w-[min(22rem,calc(100vw-1rem))] rounded-2xl border-slate-200 p-0 shadow-xl dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center justify-between px-3 py-3">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          <Button type="button" variant="ghost" size="sm" className="h-auto px-2 text-xs" disabled={isPending || unreadCount === 0} onClick={handleMarkAllAsRead}>
            Mark all as read
          </Button>
        </div>
        <DropdownMenuSeparator className="dark:bg-slate-800" />
        {!hasNotifications ? (
          <div className="px-3 py-6 text-sm text-muted-foreground">No notifications yet.</div>
        ) : (
          <div className="max-h-[26rem] overflow-y-auto p-2">
            {notifications.map((notification) => (
              <DropdownMenuItem key={notification.id} asChild className={cn("block cursor-pointer rounded-xl px-3 py-3", !notification.is_read && "bg-primary/5 dark:bg-primary/10")}>
                <Link href={notification.link ?? "#"} onClick={() => handleNotificationClick(notification)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{notification.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{notification.message}</p>
                    </div>
                    {!notification.is_read ? (
                      <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                    ) : null}
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {new Date(notification.created_at).toLocaleString()}
                  </p>
                </Link>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
