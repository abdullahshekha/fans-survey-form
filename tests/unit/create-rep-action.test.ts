import { describe, it, expect, vi } from "vitest";

const createUser = vi.fn();
const upsert = vi.fn();
const maybeSingle = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  getSessionProfile: async () => ({ id: "admin-1", role: "admin", active: true }),
  usernameToEmail: (u: string) => `${u}@survey.local`,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabase: () => ({
    auth: { admin: { createUser } },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle }) }),
      upsert,
    }),
  }),
}));

import { createRep } from "@/app/admin/users/actions";

const fd = (o: Record<string, string>) => {
  const f = new FormData();
  Object.entries(o).forEach(([k, v]) => f.set(k, v));
  return f;
};

describe("createRep", () => {
  it("rejects an invalid username", async () => {
    const res = await createRep(null, fd({ username: "Rep One", full_name: "R", password: "secret12" }));
    expect(res.error).toMatch(/lowercase letters, digits/i);
    expect(createUser).not.toHaveBeenCalled();
  });

  it("rejects a duplicate username", async () => {
    maybeSingle.mockResolvedValue({ data: { id: "x" } });
    const res = await createRep(null, fd({ username: "rep.one", full_name: "R", password: "secret12" }));
    expect(res.error).toMatch(/already exists/i);
  });

  it("creates the auth user and profile on success", async () => {
    maybeSingle.mockResolvedValue({ data: null });
    createUser.mockResolvedValue({ data: { user: { id: "new-uid" } }, error: null });
    upsert.mockResolvedValue({ error: null });
    const res = await createRep(null, fd({ username: "rep.three", full_name: "Rep Three", password: "secret12" }));
    expect(res.ok).toBe(true);
    expect(createUser).toHaveBeenCalledWith(expect.objectContaining({ email: "rep.three@survey.local", email_confirm: true }));
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ id: "new-uid", username: "rep.three", role: "rep" }), expect.anything());
  });
});
