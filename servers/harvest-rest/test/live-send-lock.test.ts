import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertDangerousSendAllowed,
  attachLiveSendAudit,
  DangerousSendBlockedError,
  MIN_GO_REF_LENGTH,
} from "../src/env.js";
import {
  buildCreateInvoiceMessageBody,
  createInvoiceMessage,
  createInvoiceMessageInputSchema,
} from "../src/tools/invoice-messages.js";
import {
  buildCreateInvoicePaymentBody,
  createInvoicePayment,
  createInvoicePaymentInputSchema,
} from "../src/tools/invoice-payments.js";
import { createMockClient } from "./helpers.js";

const GO_REF = "unit-test-go-ref";
const allowEnv = { DANGEROUS_SEND: "1" };
const liveConfirm = { confirm_live_send: true as const, go_ref: GO_REF };

function captureStderr(work: () => Promise<unknown> | unknown): { lines: string[]; result: unknown } | Promise<{
  lines: string[];
  result: unknown;
}> {
  const lines: string[] = [];
  const original = process.stderr.write.bind(process.stderr);
  process.stderr.write = ((chunk: unknown, ...args: unknown[]) => {
    lines.push(String(chunk));
    return original(chunk as string, ...(args as []));
  }) as typeof process.stderr.write;

  const restore = (): void => {
    process.stderr.write = original;
  };

  try {
    const pending = work();
    if (pending !== undefined && typeof (pending as Promise<unknown>).then === "function") {
      return (pending as Promise<unknown>)
        .then((result) => {
          restore();
          return { lines, result };
        })
        .catch((error: unknown) => {
          restore();
          throw error;
        });
    }
    restore();
    return { lines, result: pending };
  } catch (error) {
    restore();
    throw error;
  }
}

describe("assertDangerousSendAllowed per-call lock", () => {
  it("blocks with no DANGEROUS_SEND env", () => {
    assert.throws(
      () => assertDangerousSendAllowed("test-action", {}, liveConfirm),
      (error: unknown) => {
        assert.ok(error instanceof DangerousSendBlockedError);
        assert.match(error.message, /DANGEROUS_SEND=1/);
        assert.match(error.message, /confirm_live_send=true/);
        assert.match(error.message, new RegExp(`go_ref=${GO_REF}`));
        return true;
      },
    );
  });

  it("blocks when DANGEROUS_SEND=1 but confirm_live_send is missing", () => {
    assert.throws(
      () => assertDangerousSendAllowed("test-action", allowEnv, { go_ref: GO_REF }),
      (error: unknown) => {
        assert.ok(error instanceof DangerousSendBlockedError);
        assert.match(error.message, /confirm_live_send=true/);
        assert.match(error.message, new RegExp(`go_ref=${GO_REF}`));
        return true;
      },
    );
  });

  it("blocks when confirm_live_send is true but go_ref is empty or too short", () => {
    for (const go_ref of ["", "   ", "short"]) {
      assert.throws(
        () => assertDangerousSendAllowed("test-action", allowEnv, { confirm_live_send: true, go_ref }),
        (error: unknown) => {
          assert.ok(error instanceof DangerousSendBlockedError);
          assert.match(error.message, /go_ref/);
          assert.match(error.message, new RegExp(String(MIN_GO_REF_LENGTH)));
          return true;
        },
      );
    }
  });

  it("blocks in smoke, test, and HARVEST_SEND_LOCKOUT even with env + confirm", () => {
    const lockouts = [
      { ...allowEnv, HARVEST_SMOKE: "1" },
      { ...allowEnv, NODE_ENV: "test" },
      { ...allowEnv, HARVEST_SEND_LOCKOUT: "1" },
    ];
    for (const env of lockouts) {
      assert.throws(
        () => assertDangerousSendAllowed("test-action", env, liveConfirm),
        (error: unknown) => {
          assert.ok(error instanceof DangerousSendBlockedError);
          assert.match(error.message, /smoke\/test\/lockout/);
          assert.match(error.message, new RegExp(`go_ref=${GO_REF}`));
          return true;
        },
      );
    }
  });

  it("allows DANGEROUS_SEND=1 + confirm_live_send + go_ref and logs one stderr line", () => {
    const captured = captureStderr(() => assertDangerousSendAllowed("test-action", allowEnv, liveConfirm)) as {
      lines: string[];
      result: unknown;
    };
    assert.equal(captured.result, GO_REF);
    const joined = captured.lines.join("");
    assert.match(joined, /harvest-rest live send:/);
    assert.match(joined, /action=test-action/);
    assert.match(joined, new RegExp(`go_ref=${GO_REF}`));
    assert.doesNotMatch(joined, /test-token/);
    assert.doesNotMatch(joined, /Bearer /);
  });
});

describe("create_invoice_message live-send lock", () => {
  it("blocks email send with no env and does not call Harvest", async () => {
    const { client, requests } = createMockClient({ responseBody: { id: 1 } });
    const input = createInvoiceMessageInputSchema.parse({
      invoice_id: 13150403,
      recipients: [{ email: "richard@example.com" }],
    });
    await assert.rejects(
      () => createInvoiceMessage(client, input, {}),
      (error: unknown) => error instanceof DangerousSendBlockedError,
    );
    assert.equal(requests.length, 0);
  });

  it("blocks event_type=send when env is on but confirm_live_send is missing", async () => {
    const { client, requests } = createMockClient({ responseBody: { id: 1 } });
    const input = createInvoiceMessageInputSchema.parse({
      invoice_id: 13150403,
      event_type: "send",
      go_ref: GO_REF,
    });
    await assert.rejects(
      () => createInvoiceMessage(client, input, allowEnv),
      (error: unknown) => {
        assert.ok(error instanceof DangerousSendBlockedError);
        assert.match(error.message, /confirm_live_send=true/);
        return true;
      },
    );
    assert.equal(requests.length, 0);
  });

  it("blocks event_type=send when confirm is true but go_ref is empty", async () => {
    const { client, requests } = createMockClient({ responseBody: { id: 1 } });
    const input = createInvoiceMessageInputSchema.parse({
      invoice_id: 13150403,
      event_type: "send",
      confirm_live_send: true,
      go_ref: "   ",
    });
    await assert.rejects(
      () => createInvoiceMessage(client, input, allowEnv),
      (error: unknown) => {
        assert.ok(error instanceof DangerousSendBlockedError);
        assert.match(error.message, /go_ref/);
        return true;
      },
    );
    assert.equal(requests.length, 0);
  });

  it("blocks in HARVEST_SMOKE=1 even with env + confirm", async () => {
    const { client, requests } = createMockClient({ responseBody: { id: 1 } });
    const input = createInvoiceMessageInputSchema.parse({
      invoice_id: 13150403,
      event_type: "send",
      ...liveConfirm,
    });
    await assert.rejects(
      () => createInvoiceMessage(client, input, { ...allowEnv, HARVEST_SMOKE: "1" }),
      (error: unknown) => {
        assert.ok(error instanceof DangerousSendBlockedError);
        assert.match(error.message, /HARVEST_SMOKE/);
        return true;
      },
    );
    assert.equal(requests.length, 0);
  });

  it("allows event_type=send when env + confirm + go_ref (mocked; no live email)", async () => {
    const { client, requests } = createMockClient({
      responseBody: { id: 27835325, event_type: "send" },
    });
    const input = createInvoiceMessageInputSchema.parse({
      invoice_id: 13150403,
      event_type: "send",
      ...liveConfirm,
    });
    const captured = await captureStderr(() => createInvoiceMessage(client, input, allowEnv));
    assert.deepEqual(captured.result, attachLiveSendAudit({ id: 27835325, event_type: "send" }, GO_REF));
    assert.equal(requests.length, 1);
    assert.deepEqual(requests[0]?.bodyJson, { event_type: "send" });
    assert.equal(Object.hasOwn(requests[0]?.bodyJson as object, "go_ref"), false);
    assert.equal(Object.hasOwn(requests[0]?.bodyJson as object, "confirm_live_send"), false);
    assert.match(captured.lines.join(""), new RegExp(`go_ref=${GO_REF}`));
    assert.doesNotMatch(captured.lines.join(""), /test-token/);
  });

  it("allows omitted event_type email when env + confirm + go_ref (mocked)", async () => {
    const { client, requests } = createMockClient({
      responseBody: { id: 27835324, event_type: null, subject: "Invoice #1001" },
    });
    const input = createInvoiceMessageInputSchema.parse({
      invoice_id: 13150403,
      subject: "Invoice #1001",
      recipients: [{ name: "Richard Roe", email: "richard@example.com" }],
      ...liveConfirm,
    });
    const result = await createInvoiceMessage(client, input, allowEnv);
    assert.deepEqual(result, {
      harvest: { id: 27835324, event_type: null, subject: "Invoice #1001" },
      go_ref: GO_REF,
    });
    assert.deepEqual(requests[0]?.bodyJson, {
      recipients: [{ name: "Richard Roe", email: "richard@example.com" }],
      subject: "Invoice #1001",
    });
    assert.equal(Object.hasOwn(requests[0]?.bodyJson as object, "go_ref"), false);
  });

  it("leaves close, draft, and re-open ungated", async () => {
    for (const event_type of ["close", "draft", "re-open"] as const) {
      const { client, requests } = createMockClient({
        responseBody: { id: 9, event_type },
      });
      const input = createInvoiceMessageInputSchema.parse({ invoice_id: 1, event_type });
      const result = await createInvoiceMessage(client, input, {});
      assert.deepEqual(result, { id: 9, event_type });
      assert.deepEqual(requests[0]?.bodyJson, { event_type });
      assert.deepEqual(buildCreateInvoiceMessageBody(input), { event_type });
    }
  });
});

describe("create_invoice_payment thank-you live-send lock", () => {
  it("blocks send_thank_you=true with no env and does not call Harvest", async () => {
    const { client, requests } = createMockClient({ responseBody: { id: 1 } });
    const input = createInvoicePaymentInputSchema.parse({
      invoice_id: 1,
      amount: 10,
      send_thank_you: true,
    });
    await assert.rejects(
      () => createInvoicePayment(client, input, {}),
      (error: unknown) => {
        assert.ok(error instanceof DangerousSendBlockedError);
        assert.match(error.message, /DANGEROUS_SEND/);
        return true;
      },
    );
    assert.equal(requests.length, 0);
  });

  it("blocks send_thank_you=true when env is on but confirm_live_send is missing", () => {
    assert.throws(
      () =>
        buildCreateInvoicePaymentBody(
          createInvoicePaymentInputSchema.parse({
            invoice_id: 1,
            amount: 10,
            send_thank_you: true,
            go_ref: GO_REF,
          }),
          allowEnv,
        ),
      /confirm_live_send/,
    );
  });

  it("blocks send_thank_you=true when confirm is true but go_ref is empty", () => {
    assert.throws(
      () =>
        buildCreateInvoicePaymentBody(
          createInvoicePaymentInputSchema.parse({
            invoice_id: 1,
            amount: 10,
            send_thank_you: true,
            confirm_live_send: true,
            go_ref: "",
          }),
          allowEnv,
        ),
      /go_ref/,
    );
  });

  it("blocks send_thank_you=true in smoke mode even with env + confirm", async () => {
    const { client, requests } = createMockClient({ responseBody: { id: 1 } });
    const input = createInvoicePaymentInputSchema.parse({
      invoice_id: 1,
      amount: 10,
      send_thank_you: true,
      ...liveConfirm,
    });
    await assert.rejects(
      () => createInvoicePayment(client, input, { ...allowEnv, HARVEST_SMOKE: "1" }),
      (error: unknown) => error instanceof DangerousSendBlockedError,
    );
    assert.equal(requests.length, 0);
  });

  it("allows send_thank_you=true when env + confirm + go_ref (mocked; no live email)", async () => {
    const { client, requests } = createMockClient({
      responseBody: { id: 10336386, amount: 10, send_thank_you: true },
    });
    const input = createInvoicePaymentInputSchema.parse({
      invoice_id: 13150378,
      amount: 10,
      send_thank_you: true,
      ...liveConfirm,
    });
    const captured = await captureStderr(() => createInvoicePayment(client, input, allowEnv));
    assert.deepEqual(captured.result, {
      harvest: { id: 10336386, amount: 10, send_thank_you: true },
      go_ref: GO_REF,
    });
    assert.deepEqual(requests[0]?.bodyJson, { amount: 10, send_thank_you: true });
    assert.equal(Object.hasOwn(requests[0]?.bodyJson as object, "go_ref"), false);
    assert.equal(Object.hasOwn(requests[0]?.bodyJson as object, "confirm_live_send"), false);
    assert.match(captured.lines.join(""), /create_invoice_payment send_thank_you=true/);
    assert.doesNotMatch(captured.lines.join(""), /test-token/);
  });

  it("does not require confirm when send_thank_you is not true", () => {
    const body = buildCreateInvoicePaymentBody(
      createInvoicePaymentInputSchema.parse({
        invoice_id: 1,
        amount: 10,
      }),
      {},
    );
    assert.equal(body.send_thank_you, false);
    assert.equal(Object.hasOwn(body, "go_ref"), false);
    assert.equal(Object.hasOwn(body, "confirm_live_send"), false);
  });
});
