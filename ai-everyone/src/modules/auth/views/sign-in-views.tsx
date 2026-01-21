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
import { FaGithub, FaGoogle } from "react-icons/fa";

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
import { authClient } from "@/lib/auth-client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const formScehma = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(1, "Password must be at least 6 characters long"),
});

// When a user submits the form, react-hook-form uses Zod to validate that the email is a valid email and password is provided. If validation fails, error messages display; if it passes, the data is safe to use.

export const SignInView = () => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const form = useForm<z.infer<typeof formScehma>>({
    resolver: zodResolver(formScehma),
    defaultValues: {
      email: "",
      password: "",
    },
  });
{/* every thing wraped inside the card and cardcontent is just the part of one card other card like google button or input field are not
  the getting the look of the card by the top card content they are getting that look from their on component like Input, Button, Alert etc */}

  const onSubmit = (data: z.infer<typeof formScehma>) => {
    setError(null);
    setPending(true);
    authClient.signIn.email({
        email: data.email,
        password: data.password,
        callbackURL: "/",
      },
      {
        onSuccess: () => {
          setPending(false);
          router.push("/");
        },
        onError: ({ error }) => {
          setError(error.message);
          setPending(false);
        },
      }
    );
  };

  const onSocial = (provider: "github" | "google") => {
    setError(null);
    setPending(true);
    {/*We cannon add the confirmPassword here cause authClient.signUp.email() function dosen't accept that parameter in the backend, confirm passoword validation is done one the frontend by the zod schema */}
    authClient.signIn.social({
        provider: provider,
        callbackURL: "/",
      },
      {
        onSuccess: () => {
          setPending(false);
        },
        onError: ({ error }) => {
          setError(error.message);
          setPending(false);
        },
      }
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 md:p-8">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col items-center text-center">
                  <h1 className="text-2xl font-semibold">Welcome back</h1>
                  <p className="text-sm text-muted-foreground">
                    Enter your email and password to sign in
                  </p>
                </div>
                <div className="grid gap-3">
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
                </div>
              {!!error && (
                <Alert className="bg-destructive/10 border-none">
                  <OctagonAlert className="h-4 w-4 text-destructive!" />
                  <AlertTitle>{error}</AlertTitle>
                </Alert>
              )}
              <Button disabled={pending} type="submit" className="w-full">
                Sign In
              </Button>
              <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:insert-0 after:top-0.5 after:z-0 after:flex after:items-center after:border-t">
                <span className="bg-card text-muted-foreground relative z-10 px-2">
                    Or continue with
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {/* we have to add button type = "button" because or else it will act as a submit button */}
                <Button onClick={() => onSocial("google")} disabled={pending} variant="outline" className="w-full" type="button">
                  <FaGoogle />
                </Button>
                <Button onClick={() => onSocial("github")} disabled={pending} variant="outline" className="w-full" type="button">
                  <FaGithub />
                </Button>
              </div>
              <div className="text-center text-sm">
                Don&apos;t have an account?{' '}
                <Link href="/sign-up" className="text-primary hover:underline">
                  Sign Up
                </Link>
              </div>
              </div>
            </form>
          </Form>
          <div className="bg-linear-to-br from-gray-800 to-gray-600 relative hidden md:flex flex-col gap-y-4 items-center justify-center">
            <img src="/logo.svg" alt="Logo" className="h-[92px], w-[92]" />
            <p className="text-2xl font-semibold text-white">AI-Everyone</p>
          </div>
        </CardContent>
      </Card>
    <div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
      © 2024 AI-Everyone. All rights reserved.
    </div>
    <div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
      By signing in, you agree to our{' '}
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
