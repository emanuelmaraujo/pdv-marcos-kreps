import { createClient } from "@/lib/supabase/client";

export type AuditArea = "all" | "profiles" | "branches" | "branch_payment_fee_rules" | "settings";

export type AuditEvent = {
  id: string;
  action: string;
  table_name: string | null;
  record_id: string | null;
  branch_id: string | null;
  user_id: string | null;
  created_at: string;
  actor_name: string | null;
  branch_name: string | null;
};

export type AuditEventPage = {
  events: AuditEvent[];
  total: number;
};

type AuditRow = Omit<AuditEvent, "actor_name" | "branch_name">;

const PAGE_SIZE = 20;
const columns = "id, action, table_name, record_id, branch_id, user_id, created_at";

export const auditLogsApi = {
  pageSize: PAGE_SIZE,

  async list(input: {
    page: number;
    branchId?: string;
    area?: AuditArea;
  }): Promise<AuditEventPage> {
    const supabase = createClient();
    const first = Math.max(0, input.page) * PAGE_SIZE;
    const last = first + PAGE_SIZE - 1;

    let query = supabase
      .from("audit_logs")
      .select(columns, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(first, last);

    if (input.branchId) query = query.eq("branch_id", input.branchId);
    if (input.area && input.area !== "all") query = query.eq("table_name", input.area);

    const { data, error, count } = await query;
    if (error) throw error;

    const rows = (data ?? []) as unknown as AuditRow[];
    const actorIds = unique(rows.map((row) => row.user_id));
    const branchIds = unique(rows.map((row) => row.branch_id));

    const [actorsResult, branchesResult] = await Promise.all([
      actorIds.length
        ? supabase.from("profiles").select("id, name").in("id", actorIds)
        : Promise.resolve({ data: [], error: null }),
      branchIds.length
        ? supabase.from("branches").select("id, name").in("id", branchIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (actorsResult.error) throw actorsResult.error;
    if (branchesResult.error) throw branchesResult.error;

    const actorNames = new Map((actorsResult.data ?? []).map((actor) => [actor.id, actor.name]));
    const branchNames = new Map((branchesResult.data ?? []).map((branch) => [branch.id, branch.name]));

    return {
      total: count ?? 0,
      events: rows.map((row) => ({
        ...row,
        actor_name: row.user_id ? actorNames.get(row.user_id) ?? null : null,
        branch_name: row.branch_id ? branchNames.get(row.branch_id) ?? null : null,
      })),
    };
  },
};

function unique(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}
