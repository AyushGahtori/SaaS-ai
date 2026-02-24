"use client";

import {
  Avatar,
  AvatarImage,
} from "@/components/ui/avatar";
import { authClient } from "@/lib/auth-client";
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@radix-ui/react-dropdown-menu";

import { GeneratedAvatar } from "@/components/ui/generated-avatar";
import {
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

import { ChevronDownIcon, CreditCardIcon, LogOutIcon } from "lucide-react";

import { useRouter } from "next/navigation";
import { useIsMobile } from "@/hooks/use-mobile";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";

export const DashboardUserButton = () => {
  const { data, isPending } = authClient.useSession();
  const router = useRouter();
  const isMobile = useIsMobile(); // Example breakpoint for mobile devices

  // logout helper must be accessible in both mobile and desktop branches
  const handleLogout = async () => {
    await authClient.signOut();
    router.push("/sign-in");
  };

  if (isPending || !data?.user) return null;

  if (isMobile) {
    return (
      <Drawer>
        <DrawerTrigger asChild className="rounded-lg border border-border/10 p-3 w-full flex items-center justify-between bg-white/5 hover:bg-white/10 overflow-hidden gap-x-2">
          {/* asChild only accepts a single child, so wrap everything in one container */}
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {data.user.image ? (
                <Avatar>
                  <AvatarImage src={data.user.image} />
                </Avatar>
              ) : (
                <GeneratedAvatar
                  seed={data.user.name}
                  variant="initials"
                  className="size-9"
                />
              )}
              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <span className="text-sm font-medium truncate text-white">
                  {data.user.name}
                </span>
                <span className="text-xs truncate text-muted-foreground">
                  {data.user.email}
                </span>
              </div>
            </div>
            <ChevronDownIcon className="size-4 text-muted-foreground shrink-0 ml-2" />
          </div>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{data.user.name}</DrawerTitle>
            <DrawerDescription>{data.user.email}</DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <div className="flex flex-col gap-2 w-full">
              <Button
                variant="outline"
                onClick={() => router.push("/billing")}>
                <CreditCardIcon className="size-4 text-black" />
                Billing
              </Button>
              <Button
                variant="outline"
                onClick={handleLogout}
                className="mt-2">
                <LogOutIcon className="size-4 text-black" />
                Logout
              </Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-lg border border-border/10 p-3 w-full flex items-center justify-between bg-white/5 hover:bg-white/10 overflow-hidden gap-x-2">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {data.user.image ? (
            <Avatar>
              <AvatarImage src={data.user.image} />
            </Avatar>
          ) : (
            <GeneratedAvatar
              seed={data.user.name}
              variant="initials"
              className="size-9"
            />
          )}
          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
            <span className="text-sm font-medium truncate text-white">
              {data.user.name}
            </span>
            <span className="text-xs truncate text-muted-foreground">
              {data.user.email}
            </span>
          </div>
        </div>
        <ChevronDownIcon className="size-4 text-muted-foreground shrink-0 ml-2" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="right" className="w-72">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-1">
            <span className="text-sm truncate w-full">
              {data.user.name}
            </span>
            <span className="text-sm truncate w-full text-muted-foreground font-normal">
              {data.user.email}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer flex items-center justify-between">
          <span>Billing</span>
          <CreditCardIcon className="size-4" />
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer flex items-center justify-between" onSelect={handleLogout}>
          <span>Logout</span>
          <LogOutIcon className="size-4" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
