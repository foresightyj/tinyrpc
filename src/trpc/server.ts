import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { assert } from "../common/assert";

interface InputContext {
    headers: Record<string, any>;
}
interface InputContext2<T> {
    headers: Record<string, any>;
    input: T;
}

type MethodDef<O> = (i: InputContext) => Promise<O>
type MethodDef2<S extends z.ZodType, O> = (i: InputContext2<z.infer<S>>) => Promise<O>

interface ClientRequestOpts {
    beforeRequest?: (req: RequestInit) => void,
}

export type RpcHandlerType = "query" | "mutation";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

class RpcDefinition<H extends RpcHandlerType, TInput extends z.ZodType, THandler extends (arg: InputContext2<z.infer<TInput>>) => Promise<any>> {
    constructor(readonly handlerType: H, readonly input: TInput, readonly handler: THandler) { }
    proxiedApi(arg: z.infer<TInput>, opts?: ClientRequestOpts): ReturnType<THandler> {
        throw new Error("only used for purposes of typing, so throwing error purposefully");
    }
}


class RpcBuilder {
    constructor() { }
    input<S extends z.ZodType>(input: S): RpcDescriptorWithInput<S> {
        return new RpcDescriptorWithInput<S>(input,);
    }
    query<O>(fn: MethodDef<O>) {
        return new RpcDefinition<"query", z.ZodVoid, MethodDef<O>>("query", undefined, fn);
    }
    mutation<O>(fn: MethodDef<O>) {
        return new RpcDefinition<"mutation", z.ZodVoid, MethodDef<O>>("mutation", undefined, fn);
    }
}

class RpcDescriptorWithInput<S extends z.ZodType> {
    constructor(private readonly input: S) { }
    query<O>(fn: MethodDef2<S, O>) {
        return new RpcDefinition<"query", S, MethodDef2<S, O>>("query", this.input, fn)
    }
    mutation<O>(fn: MethodDef2<S, O>) {
        return new RpcDefinition<"mutation", S, MethodDef2<S, O>>("mutation", this.input, fn)
    }
}

type RpcDefinitionBase = { [k: string]: RpcDefinition<RpcHandlerType, z.ZodType, any> }

export function defineRPC<T extends RpcDefinitionBase>(rpcDefinitions: (b: RpcBuilder) => T) {
    const rpcDefs = rpcDefinitions(new RpcBuilder())
    const rpcApis: {
        query: { [k in keyof T as ("query" extends T[k]["handlerType"] ? k : never)]: T[k]['proxiedApi'] },
        mutation: { [k in keyof T as ("mutation" extends T[k]["handlerType"] ? k : never)]: T[k]['proxiedApi'] },
    } = { query: {} as any, mutation: {} as any };

    for (const [name, rpcDef] of Object.entries(rpcDefs)) {
        const m = rpcApis[rpcDef.handlerType];
        rpcDef.handlerType === "query"
        const api = (payload: unknown) => {
            if (rpcDef.input) {
                const input = rpcDef.input.parse(payload);
                return rpcDef.handler({ input });
            }
            return rpcDef.handler({});
        }
        m[name as any] = api;
    }

    function dispatchRpcRequest(handlerType: RpcHandlerType, handlerName: string, payload: any): Promise<any> {
        const m = rpcApis[handlerType];
        const handler = m[handlerName];
        return handler(payload);
    }

    async function nextjsRpcHandler(req: NextApiRequest, res: NextApiResponse) {
        const method = req.method as HttpMethod;
        if (method !== "GET" && method !== "POST") {
            throw new Error("RPC only supports GET and POST");
        }
        const handlerType: RpcHandlerType = method === "GET" ? "query" : "mutation";
        const { handler } = req.query;
        assert(typeof handler === "string", "method must be string");
        let payload = req.body;
        if (handlerType === "query") {
            const input = req.query["input"] as string;
            if (typeof input === "string") {
                try {
                    payload = JSON.parse(input);
                } catch (err) {
                    throw new Error("failed to parse input from query: " + input)
                }
            }
        }
        try {
            const result = await dispatchRpcRequest(handlerType, handler, payload);
            res.status(200).json(result);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    return {
        rpcApis,
        nextjsRpcHandler,
    };
}

