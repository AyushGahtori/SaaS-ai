import { createAvatar } from "@dicebear/core"
import { botttsNeutral, initials } from "@dicebear/collection"

import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface GenerateAvatarProps {
    seed: string
    className?: string
    variant?: "bottts" | "initials" | "botttsNeutral"
}

export function GeneratedAvatar({
    seed,
    className,
    variant = "bottts",
}: GenerateAvatarProps) {
    let avatar;

    if (variant === "botttsNeutral") {
        avatar = createAvatar(botttsNeutral, {
            seed,
        })
    } else {
        avatar = createAvatar(initials, {
            seed,
            fontWeight: 500,
            fontSize: 42,
        })
    }

    return (
        <Avatar className={cn("h-10 w-10", className)}>
            <AvatarImage src={avatar.toDataUri()} alt="Awatar" />
            <AvatarFallback>{seed.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
    )
}