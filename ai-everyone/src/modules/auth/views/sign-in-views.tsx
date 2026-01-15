"use client"
// Card component is used to wrap the sign-up content in a styled container.
import { Card, CardContent } from "@/components/ui/card"

export const SignInView = () => {
    return (
        <div className = "flex flex-col gap-6">
            <Card className="overflow-hidden p-0">
                <CardContent className="grid p-0 md:grid-cols-2">
                    <p>sign in pag</p>
                    <div className="bg-gradient-to-br from-gray-800 to-gray-600 relative hidden md:flex flex-col gap-y-4 items-center justify-center">
                        <img src="/logo.svg" alt="Logo" className="h-[92px], w-[92]"/>
                        <p className = "text-2xl font-semibold text-white">
                            AI-Everyone
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}