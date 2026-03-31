import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const appRouter = createTRPCRouter({
	hello: publicProcedure
		.input(z.object({ name: z.string().optional() }).optional())
		.query(({ input }) => {
			const name = input?.name ?? "world";
			return { greeting: "Hello, " + name + "!" };
		}),
});

export type AppRouter = typeof appRouter;
