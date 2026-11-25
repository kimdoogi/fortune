import { describe, expect, it } from "vitest";
import {
  decryptPii,
  encryptPii,
  fromBase64Url,
  randomToken,
  sha256Hex,
  toBase64,
  toBase64Url,
} from "../src/crypto";

const key = toBase64(new Uint8Array(32).map((_, i) => i));
const otherKey = toBase64(new Uint8Array(32).fill(9));

describe("AES-GCM", () => {
  it("암호화 → 복호화", async () => {
    const plain = JSON.stringify({
      birthDate: "1996-02-14",
      isLeapMonth: false,
      birthTime: { kind: "unknown" },
    });
    const a = await encryptPii(key, plain);
    const b = await encryptPii(key, plain);
    expect(a).not.toBe(b); // iv가 매번 다르다
    expect(a).not.toContain("1996");
    expect(await decryptPii(key, a)).toBe(plain);
  });

  it("다른 키로는 못 푼다", async () => {
    const a = await encryptPii(key, "secret");
    await expect(decryptPii(otherKey, a)).rejects.toThrow();
  });

  it("키 길이가 32바이트가 아니면 오류", async () => {
    await expect(encryptPii(toBase64(new Uint8Array(16)), "x")).rejects.toThrow();
  });
});

describe("토큰·해시", () => {
  it("토큰은 32바이트 base64url", () => {
    const t = randomToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(fromBase64Url(t)).toHaveLength(32);
    expect(randomToken()).not.toBe(t);
  });

  it("base64url 왕복", () => {
    const bytes = new Uint8Array([251, 255, 0, 1, 62, 63]);
    expect([...fromBase64Url(toBase64Url(bytes))]).toEqual([...bytes]);
  });

  it("sha256", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
