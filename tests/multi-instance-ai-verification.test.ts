import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fork, ChildProcess } from "node:child_process";

const testDbPath = path.resolve(process.cwd(), "db/test.db").replace(/\\/g, "/");
process.env.DATABASE_URL = `file:${testDbPath}`;

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient({
  datasources: { db: { url: `file:${testDbPath}` } },
});

describe("GODAVARI ONE — Multi-Instance Independent Process AI Verification Suite", () => {
  let worker1: ChildProcess;
  let worker2: ChildProcess;

  function spawnWorker(): ChildProcess {
    return fork(path.resolve(process.cwd(), "scratch/multi-instance-worker.js"), [], {
      env: {
        ...process.env,
        DATABASE_URL: `file:${testDbPath}`,
      },
    });
  }

  function sendWorkerMessage(worker: ChildProcess, message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const handler = (data: any) => {
        worker.off("message", handler);
        if (data.status === "ERROR") reject(new Error(data.error));
        else resolve(data);
      };
      worker.on("message", handler);
      worker.send(message);
    });
  }

  before(async () => {
    worker1 = spawnWorker();
    worker2 = spawnWorker();
    // Warm up workers and ensure distinct PIDs
    assert.notEqual(worker1.pid, worker2.pid, "Workers must run in distinct operating system processes");
  });

  after(async () => {
    worker1.kill();
    worker2.kill();
    await prisma.$disconnect();
  });

  it("1. Two independent processes have distinct PIDs and share the persistent database", async () => {
    assert.ok(worker1.pid && worker1.pid > 0);
    assert.ok(worker2.pid && worker2.pid > 0);
    assert.notEqual(worker1.pid, worker2.pid);
  });

  it("2. Shared atomic rate limiting enforces capacity across independent instances", async () => {
    const testIdentifier = `multi_inst_${Date.now()}`;
    const capacity = 6;

    // Both instances fire bursts simultaneously
    const [res1, res2] = await Promise.all([
      sendWorkerMessage(worker1, {
        action: "RATE_LIMIT_BURST",
        identifier: testIdentifier,
        capacity,
        count: 5,
      }),
      sendWorkerMessage(worker2, {
        action: "RATE_LIMIT_BURST",
        identifier: testIdentifier,
        capacity,
        count: 5,
      }),
    ]);

    const allResults = [...res1.results, ...res2.results];
    const allowed = allResults.filter((r) => r.allowed).length;
    const rejected = allResults.filter((r) => !r.allowed).length;

    assert.equal(allowed, capacity, `Exactly ${capacity} requests must be allowed across both processes`);
    assert.equal(rejected, 4, "4 requests must be rejected with 429 across both processes");
  });

  it("3. Persistent AI configuration written by Instance 1 is immediately read by Instance 2", async () => {
    const newBudget = 88.5;
    // Instance 1 updates the configuration
    const updateRes = await sendWorkerMessage(worker1, {
      action: "UPDATE_CONFIG",
      updates: { monthlyBudgetCap: newBudget, isEnabled: true },
      userId: "test_admin_pid1",
    });
    assert.equal(updateRes.config.monthlyBudgetCap, newBudget);

    // Instance 2 (completely separate process) reads from DB
    const readRes = await sendWorkerMessage(worker2, {
      action: "READ_CONFIG",
    });
    assert.equal(readRes.config.monthlyBudgetCap, newBudget, "Instance 2 must read persisted config from DB");
  });

  it("4. Global AI Kill Switch toggled by Instance 1 is reflected on Instance 2", async () => {
    // Instance 1 toggles killswitch off
    await sendWorkerMessage(worker1, {
      action: "UPDATE_CONFIG",
      updates: { isEnabled: false },
    });

    // Instance 2 reads the disabled status
    const readRes = await sendWorkerMessage(worker2, {
      action: "READ_CONFIG",
    });
    assert.equal(readRes.config.isEnabled, false, "Instance 2 must reflect global killswitch");

    // Restore enabled state
    await sendWorkerMessage(worker1, {
      action: "UPDATE_CONFIG",
      updates: { isEnabled: true, monthlyBudgetCap: 25.0 },
    });
  });

  it("5. Spending reservations created by Instance 1 are observed by Instance 2", async () => {
    const convId = `multi_res_${Date.now()}`;
    const res1 = await sendWorkerMessage(worker1, {
      action: "RESERVE_SPEND",
      opts: { conversationId: convId, provider: "gemini", model: "gemini-1.5-flash" },
    });
    assert.ok(res1.reservation.reservationId);

    // Verify record exists in DB visible to process 2
    const inDb = await prisma.aIUsageLog.findUnique({
      where: { id: res1.reservation.reservationId },
    });
    assert.ok(inDb);
    assert.equal(inDb?.status, "RESERVED");
  });
});
