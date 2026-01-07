import type { RpcHandlerType } from "./server";
import { assert } from "../common/assert";


async function rpcInvoke(handlerType: RpcHandlerType, handlerName: string, input: any): Promise<any> {
    assert(typeof handlerName === "string", "apiName must be string");
    const opts: RequestInit = {
        method: handlerType === "query" ? "GET" : "POST",
        headers: {
            'Content-Type': 'application/json',
        },
        body: handlerType === "mutation" ? JSON.stringify(input) : undefined,
    }
    let url = `/api/rpc/${encodeURIComponent(handlerName)}`;

    if (handlerType === "query") {
        url += `?${new URLSearchParams({ input: JSON.stringify(input) }).toString()}`;
    }

    const response = await fetch(url, opts);

    if (!response.ok) {
        console.error("error response:", await response.json())
        throw new Error(`Failed to call API: ${handlerType}.${handlerName} ${response.statusText}`);
    }
    return response.json();
}


const queryTarget = {} as any;
const mutationTarget = {} as any;

function invokeApi(handlerType: RpcHandlerType, apiName: string) {
    return (input: any) => {
        return rpcInvoke(handlerType, apiName, input).then(result => {
            return result;
        }).catch(err => {
            console.error('API call failed', err);
            throw err;
        });
    }
}

const proxyHandler: ProxyHandler<any> = {
    get(target, handlerName, receiver) {
        assert(typeof handlerName === 'string', 'prop must be a string');
        return invokeApi(target === queryTarget ? "query" : "mutation", handlerName);
    },
};


export function createApiProxy<T extends { [h in RpcHandlerType]: { [k: string]: (...args: any[]) => Promise<any> } }>() {
    const apis = {
        query: new Proxy(queryTarget, proxyHandler),
        mutation: new Proxy(mutationTarget, proxyHandler),
    }
    return apis as T;
}
