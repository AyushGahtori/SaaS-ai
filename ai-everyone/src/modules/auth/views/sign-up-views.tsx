"use client";
// Card component is used to wrap the sign-up content in a styled container.
import { Card, CardContent } from "@/components/ui/card";

// npm imports
import { z } from "zod";
// Zod is a TypeScript validation library that ensures data matches a specific structure before using it.
import { zodResolver } from "@hookform/resolvers/zod";
import { OctagonAlert } from "lucide-react";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FaGoogle } from "react-icons/fa";

// package imports
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { signUpWithEmail, signInWithGoogle } from "@/lib/firebaseAuth";
import { Alert, AlertTitle } from "@/components/ui/alert";

const formScehma = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(1, { message: "Password is required" }),
  confirmPassword: z.string().min(1, { message: "Confirm password is required" })
})

  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  })

// When a user submits the form, react-hook-form uses Zod to validate that the email is a valid email and password is provided. If validation fails, error messages display; if it passes, the data is safe to use.

export const SignUpView = () => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const form = useForm<z.infer<typeof formScehma>>({
    resolver: zodResolver(formScehma),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });
  {/* every thing wraped inside the card and cardcontent is just the part of one card other card like google button or input field are not
  the getting the look of the card by the top card content they are getting that look from their on component like Input, Button, Alert etc */}

  const onSubmit = async (data: z.infer<typeof formScehma>) => {
    setError(null);
    setPending(true);
    try {
      // Confirm password validation is done on the frontend by the Zod schema.
      await signUpWithEmail(data.name, data.email, data.password);
      router.push("/");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Sign up failed";
      setError(message);
    } finally {
      setPending(false);
    }
  };

  const onGoogle = async () => {
    setError(null);
    setPending(true);
    try {
      await signInWithGoogle();
      router.push("/");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Google sign in failed";
      setError(message);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card className="overflow-hidden p-0 bg-black border-white/10">
        <CardContent className="grid p-0 md:grid-cols-2">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 md:p-8">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col items-center text-center">
                  <h1 className="text-2xl font-semibold">Let&apos;s get started</h1>
                  <p className="text-sm text-muted-foreground">
                    Create your account
                  </p>
                </div>
                <div className="grid gap-3">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="John Doe"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="m@example.com"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="••••••••"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="••••••••"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {!!error && (
                  <Alert className="bg-destructive/10 border-none">
                    <OctagonAlert className="h-4 w-4 text-destructive!" />
                    <AlertTitle>{error}</AlertTitle>
                  </Alert>
                )}
                <Button disabled={pending} type="submit" className="w-full">
                </Button>
                <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:insert-0 after:top-0.5 after:z-0 after:flex after:items-center after:border-t">
                  <span className="bg-black text-muted-foreground relative z-10 px-2">
                    Or continue with
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {/* Google sign-in/sign-up button */}
                  <Button onClick={onGoogle} disabled={pending} variant="outline" className="w-full" type="button">
                    <FaGoogle />
                  </Button>
                </div>
                <div className="text-center text-sm">
                  Already have an account?{' '}
                  <Link href="/sign-in" className="text-primary hover:underline">
                    Sign In
                  </Link>
                </div>
              </div>
            </form>
          </Form>
          <div className="bg-[#000000] relative hidden md:flex flex-col gap-y-4 items-center justify-center">
            <img src="/logo.png" alt="Logo" className="h-[92px], w-[92]" />
            <p className="text-2xl font-semibold text-white">AI-Everyone</p>
          </div>
        </CardContent>
      </Card>
      <div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
        © 2024 AI-Everyone. All rights reserved.
      </div>
      <div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
        By signing up, you agree to our{' '}
        <a href="/terms-of-service" target="_blank" rel="noreferrer">
          Terms of Service
        </a>{' '}and{' '}
        <a href="/privacy-policy" target="_blank" rel="noreferrer">
          Privacy Policy
        </a>
      </div>
    </div>
  );
};
