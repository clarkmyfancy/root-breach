declare module 'node:test' {
  interface TestContext {}
  type TestFn = (name: string, fn: (t: TestContext) => void | Promise<void>) => void;
  const test: TestFn;
  export default test;
}

declare module 'node:assert/strict' {
  const assert: {
    equal(actual: unknown, expected: unknown, message?: string): void;
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
    ok(value: unknown, message?: string): void;
    match(value: string, regex: RegExp, message?: string): void;
  };
  export default assert;
}
