describe("Basic Integration Test", () => {
  it("should pass a basic test", () => {
    expect(true).toBe(true);
  });

  it("should test basic math", () => {
    expect(2 + 2).toBe(4);
  });

  it("should test string operations", () => {
    const str = "Hello World";
    expect(str.toLowerCase()).toBe("hello world");
  });
});
