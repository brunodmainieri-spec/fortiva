import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { blankData } from "./domain";

const db = new PGlite();
const alice = "00000000-0000-4000-8000-000000000001";
const bob = "00000000-0000-4000-8000-000000000002";
async function asUser(id: string) {
  await db.exec("reset role; set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
}
async function save(document: unknown, revision: number) {
  return db.query<{ revision: number }>(
    "select public.fortiva_save($1::jsonb, $2::bigint) as revision",
    [JSON.stringify(document), revision],
  );
}
async function load() {
  const result = await db.query<{
    data: { revision: number; document: ReturnType<typeof blankData> } | null;
  }>("select public.fortiva_load() as data");
  return result.rows[0].data;
}
beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key);
    insert into auth.users values ('${alice}'), ('${bob}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('email', 'verified@example.com') $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on all functions in schema auth to anon, authenticated;
  `);
  await db.exec(
    readFileSync("supabase/migrations/202609230001_fortiva.sql", "utf8"),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202609230002_meal_photo_usage.sql",
      "utf8",
    ),
  );
}, 30000);
afterAll(async () => {
  await db.close();
});
describe.sequential("Supabase SQL permissions and transactions", () => {
  it("starts empty, persists data, and trusts authenticated email only", async () => {
    await asUser(alice);
    expect(await load()).toBeNull();
    const data = blankData("forged@example.com", "Alice");
    data.meals = [
      {
        id: "meal-1",
        date: "2026-09-23",
        time: "12:00",
        type: "Lunch",
        items: [],
      },
    ];
    data.mealDrafts = {
      draft: {
        meal: data.meals[0],
        mode: "manual",
        photo: "",
        analyzed: false,
      },
    };
    await save(data, 0);
    const stored = await load();
    expect(stored?.revision).toBe(1);
    expect(stored?.document.meals).toEqual(data.meals);
    expect(stored?.document.mealDrafts).toEqual(data.mealDrafts);
    expect(stored?.document.profile.email).toBe("verified@example.com");
  });
  it("rejects stale writes without losing existing rows", async () => {
    await expect(save(blankData("", "Stale"), 0)).rejects.toThrow(
      "Concurrent update",
    );
    expect((await load())?.document.meals).toHaveLength(1);
  });
  it("does not expose another user through RPC or tables", async () => {
    await asUser(bob);
    expect(await load()).toBeNull();
    expect(
      (await db.query("select * from public.fortiva_profiles")).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select * from public.fortiva_meals")).rows,
    ).toHaveLength(0);
    await expect(
      db.query(
        `insert into public.fortiva_profiles(user_id,document) values ('${alice}', '{}')`,
      ),
    ).rejects.toThrow("permission denied");
    await save(blankData("", "Bob"), 0);
    expect((await load())?.document.profile.name).toBe("Bob");
    await asUser(alice);
    expect((await load())?.document.profile.name).toBe("Alice");
  });
  it("rolls back every table when a record is invalid", async () => {
    const data = (await load())!.document;
    data.profile.name = "Should rollback";
    data.meals = [data.meals[0], data.meals[0]];
    await expect(save(data, 1)).rejects.toThrow();
    expect((await load())?.document.profile.name).toBe("Alice");
    expect((await load())?.revision).toBe(1);
  });
  it("supports deleting real records and prevents simulated imports", async () => {
    await save(blankData("", "Alice"), 1);
    expect((await load())?.document.meals).toEqual([]);
    const data = blankData("", "Alice");
    data.energy = [
      {
        id: "fake",
        date: "2026-09-23",
        source: "watch",
        simulated: true,
        activeCalories: 100,
        totalCalories: 200,
        minutes: 5,
        updatedAt: "",
      },
    ];
    await expect(save(data, 2)).rejects.toThrow("Simulated energy");
    expect((await load())?.revision).toBe(2);
  });
  it("limits photo calls per user with cooldown, daily cap and no direct reset", async () => {
    const claim = async () =>
      (
        await db.query<{ allowed: boolean }>(
          "select public.fortiva_claim_photo_analysis() as allowed",
        )
      ).rows[0].allowed;
    await asUser(alice);
    expect(await claim()).toBe(true);
    expect(await claim()).toBe(false);
    await expect(
      db.exec("update public.fortiva_photo_usage set calls=1"),
    ).rejects.toThrow("permission denied");
    await asUser(bob);
    expect(await claim()).toBe(true);
    await db.exec("reset role");
    await db.query(
      "update public.fortiva_photo_usage set calls=29, last_requested_at=now()-interval '1 minute' where user_id=$1",
      [alice],
    );
    await asUser(alice);
    expect(await claim()).toBe(true);
    await db.exec("reset role");
    await db.query(
      "update public.fortiva_photo_usage set last_requested_at=now()-interval '1 minute' where user_id=$1",
      [alice],
    );
    await asUser(alice);
    expect(await claim()).toBe(false);
  });
  it("denies anonymous access to tables and RPCs", async () => {
    await db.exec("reset role; set role anon");
    await expect(
      db.query("select public.fortiva_claim_photo_analysis()"),
    ).rejects.toThrow("permission denied");
    await expect(load()).rejects.toThrow("permission denied");
    await expect(save(blankData("", ""), 0)).rejects.toThrow(
      "permission denied",
    );
    await expect(
      db.query("select * from public.fortiva_meals"),
    ).rejects.toThrow("permission denied");
  });
});
