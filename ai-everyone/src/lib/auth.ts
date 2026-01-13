import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db/database"; // your drizzle instance
import * as schema from "@/db/schema"; // * meens import everything from schema

export const auth = betterAuth({

    emailAndPassword: {
        enabled: true,
    },
    secret: process.env.BETTER_AUTH_SECRET!,
    url: process.env.BETTER_AUTH_URL!,

    database: drizzleAdapter(db, {
        provider: "pg", // pg stands for PostgreSQL
        schema: {
            ...schema, // ...schema means spread all the exports from schema
        },
    }),
});