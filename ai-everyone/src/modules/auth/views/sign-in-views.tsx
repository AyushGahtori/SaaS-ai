"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { FaGoogle } from "react-icons/fa";

import { Card, CardContent } from "@/components/ui/card";
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
import { signInWithEmail, signInWithGoogle } from "@/lib/firebaseAuth";
import {
  normalizeUserFacingError,
  type UserFacingError,
} from "@/lib/errors/user-facing-errors";
import { ThemedErrorBanner } from "@/components/error-ui/themed-error-banner";

const formSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const SignInView = () => {
  const router = useRouter();
  const [error, setError] = useState<UserFacingError | null>(null);
  const [pending, setPending] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setError(null);
    setPending(true);
    try {
      await signInWithEmail(data.email, data.password);
      router.push("/");
    } catch (err: unknown) {
      setError(
        normalizeUserFacingError(err, {
          surface: "auth_sign_in",
          fallbackMessage: "Sign in failed. Please try again.",
        })
      );
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
      setError(
        normalizeUserFacingError(err, {
          surface: "auth_sign_in",
          fallbackMessage: "Google sign in failed. Please try again.",
        })
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card className="ui-surface-strong overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 md:p-8">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col items-center text-center">
                  <h1 className="text-2xl font-semibold text-white">Welcome back</h1>
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
                          <Input type="email" placeholder="m@example.com" {...field} />
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
                          <Input type="password" placeholder="........" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <ThemedErrorBanner error={error} />

                <Button disabled={pending} type="submit" className="w-full">
                  {pending ? "Signing in..." : "Sign In"}
                </Button>

                <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-white/10">
                  <span className="relative z-10 bg-(--surface-1) px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>

                <Button onClick={onGoogle} disabled={pending} variant="outline" className="w-full" type="button">
                  <FaGoogle className="size-4" />
                  Continue with Google
                </Button>

                <div className="text-center text-sm">
                  Don&apos;t have an account?{" "}
                  <Link href="/sign-up" className="text-primary hover:underline">
                    Sign Up
                  </Link>
                </div>
              </div>
            </form>
          </Form>

          <div className="hidden flex-col items-center justify-center gap-y-4 border-l border-white/8 bg-[linear-gradient(180deg,rgba(124,88,255,0.14),rgba(8,10,18,0.7))] p-8 md:flex">
            <div className="rounded-2xl border border-primary/25 bg-primary/10 p-3 shadow-[0_14px_30px_rgb(92_53_229/28%)]">
              <Image src="/logo.png" alt="Logo" width={84} height={84} />
            </div>
            <p className="text-2xl font-semibold tracking-tight text-white">AI-Everyone</p>
            <p className="max-w-xs text-center text-sm text-white/65">
              Your premium AI workspace for chat, agents, and automated execution.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="text-center text-xs text-muted-foreground">
        Copyright 2024 AI-Everyone. All rights reserved.
      </div>

      <div className="text-center text-xs text-muted-foreground">
        By signing in, you agree to our{" "}
        <a href="/terms-of-service" target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-primary">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="/privacy-policy" target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-primary">
          Privacy Policy
        </a>
      </div>
    </div>
  );
};
