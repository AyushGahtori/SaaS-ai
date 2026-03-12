// tRPC router for the Agents Marketplace.
// Exposes queries and mutations consumed by the agents frontend module.

import { z } from "zod";
import { baseProcedure, createTRPCRouter } from "../init";
import {
    getAllAgents,
    getFeaturedAgents,
    getTrendingAgents,
    incrementInstallCount,
    decrementInstallCount,
} from "@/lib/firestore-agents";
import {
    installAgentForUser,
    uninstallAgentForUser,
    getUserInstalledAgents,
} from "@/lib/firestore";

export const agentsRouter = createTRPCRouter({
    // -----------------------------------------------------------------------
    // Queries
    // -----------------------------------------------------------------------

    /** Return every agent in the marketplace. */
    getAll: baseProcedure.query(async () => {
        return getAllAgents();
    }),

    /** Return only featured agents (isFeatured === true). */
    getFeatured: baseProcedure.query(async () => {
        return getFeaturedAgents();
    }),

    /** Return top agents sorted by trendingScore. */
    getTrending: baseProcedure
        .input(z.object({ limit: z.number().min(1).max(50).default(10) }))
        .query(async ({ input }) => {
            return getTrendingAgents(input.limit);
        }),

    /** Full-text-ish search — fetches all agents then filters client-side
     *  because Firestore doesn't support native full-text search. */
    search: baseProcedure
        .input(z.object({ query: z.string() }))
        .query(async ({ input }) => {
            const agents = await getAllAgents();
            const q = input.query.toLowerCase();
            if (!q) return agents;
            return agents.filter(
                (a) =>
                    a.name.toLowerCase().includes(q) ||
                    a.category.toLowerCase().includes(q) ||
                    a.description.toLowerCase().includes(q)
            );
        }),

    /** Return the array of agent IDs installed by a specific user. */
    getUserInstalled: baseProcedure
        .input(z.object({ userId: z.string() }))
        .query(async ({ input }) => {
            return getUserInstalledAgents(input.userId);
        }),

    // -----------------------------------------------------------------------
    // Mutations
    // -----------------------------------------------------------------------

    /** Install an agent for a user (add to user array + increment count). */
    install: baseProcedure
        .input(z.object({ userId: z.string(), agentId: z.string() }))
        .mutation(async ({ input }) => {
            await installAgentForUser(input.userId, input.agentId);
            await incrementInstallCount(input.agentId);
            return { success: true };
        }),

    /** Uninstall an agent for a user (remove from user array + decrement count). */
    uninstall: baseProcedure
        .input(z.object({ userId: z.string(), agentId: z.string() }))
        .mutation(async ({ input }) => {
            await uninstallAgentForUser(input.userId, input.agentId);
            await decrementInstallCount(input.agentId);
            return { success: true };
        }),
});
