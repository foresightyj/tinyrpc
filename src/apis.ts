import { z } from "zod";

import { defineRPC } from "./trpc/server";
import { assert } from "./common/assert";

const appRouter = defineRPC(b => {
    return {
        userById: b
            .input(z.object({
                userId: z.number(),
            }))
            .query(async (opts) => {
                const { input, headers } = opts;
                console.log('headers', headers);
                assert(typeof input.userId === "number", "userId must be number");
                return {
                    id: input.userId,
                    name: "yuan jian",
                    age: 40
                };
            }),
        getAllMyApps: b
            .mutation(async ({ headers }) => {
                console.log('headers', headers);
                return [{ id: "19282811", name: "Tesla Access" }];
            }),
    };
});


export type RpcApis = typeof appRouter.rpcApis;

export type ApiResponseType<K extends keyof RpcApis, T extends keyof RpcApis[K]> = RpcApis[K][T] extends (...args: any[]) => Promise<infer O> ? O : never;

export const nextjsRpcHandler = appRouter.nextjsRpcHandler;
