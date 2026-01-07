export class AssertionError extends Error {
    override name = 'AssertionError';
}

export function assert(condition: unknown, message?: string, tag?: string): asserts condition {
    if (!condition) {
        const errorMessage = message || "assert " + condition + " failed";
        throw new AssertionError(errorMessage);
    }
}
