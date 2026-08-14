import { createCommercialServerClient } from "@/lib/supabase/commercial/server";
import {
  getCommercialSession,
  type CommercialSession,
} from "@/lib/commercial/session";
import { requireStaffSession } from "@/lib/commercial/backoffice";

export type CrmCustomerRow = {
  id: string;
  legal_name: string;
  trade_name: string | null;
  cuit: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  province: string | null;
  address: string | null;
  active: boolean;
  created_at: string;
  active_rep_name: string | null;
  active_rep_id: string | null;
};

export type CrmContactRow = {
  id: string;
  customer_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  position: string | null;
  is_primary: boolean;
  active: boolean;
};

export type CrmAssignmentRow = {
  id: string;
  customer_id: string;
  sales_rep_id: string;
  sales_rep_name: string | null;
  valid_from: string;
  valid_to: string | null;
  active: boolean;
  created_at: string;
};

export type CrmRepRow = {
  id: string;
  name: string;
  email: string | null;
  active: boolean;
  created_at: string;
  customer_count: number;
};

export type CustomerInput = {
  legal_name: string;
  trade_name?: string | null;
  cuit?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  province?: string | null;
  address?: string | null;
  active?: boolean;
};

export type ContactInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  position?: string | null;
  is_primary?: boolean;
};

export type RepInput = {
  name: string;
  email?: string | null;
  active?: boolean;
};

function roleOf(session: CommercialSession): string {
  return session.claims.app_role ?? "";
}

function salesRepIdOf(session: CommercialSession): string | null {
  return session.claims.sales_rep_id;
}

export function canManageAssignments(session: CommercialSession): boolean {
  return ["sales_manager", "operations", "admin"].includes(roleOf(session));
}

export function canManageReps(session: CommercialSession): boolean {
  return ["sales_manager", "operations", "admin"].includes(roleOf(session));
}

function emptyToNull(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t.length ? t : null;
}

function pickRepName(
  sales_reps: { name: string } | { name: string }[] | null | undefined,
): string | null {
  if (!sales_reps) return null;
  if (Array.isArray(sales_reps)) return sales_reps[0]?.name ?? null;
  return sales_reps.name ?? null;
}

export async function listCrmCustomers(q?: string): Promise<CrmCustomerRow[]> {
  const session = await getCommercialSession();
  requireStaffSession(session);
  const supabase = await createCommercialServerClient();

  let query = supabase
    .from("customers")
    .select(
      `
      id, legal_name, trade_name, cuit, email, phone, city, province, address, active, created_at,
      customer_sales_rep (
        sales_rep_id, active, valid_to,
        sales_reps ( name )
      )
    `,
    )
    .order("legal_name", { ascending: true });

  if (q?.trim()) {
    const term = `%${q.trim()}%`;
    query = query.or(
      `legal_name.ilike.${term},trade_name.ilike.${term},cuit.ilike.${term},email.ilike.${term}`,
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const links = (row.customer_sales_rep ?? []) as Array<{
      sales_rep_id: string;
      active: boolean;
      valid_to: string | null;
      sales_reps: { name: string } | { name: string }[] | null;
    }>;
    const activeLink = links.find((l) => l.active && l.valid_to == null);
    return {
      id: row.id as string,
      legal_name: row.legal_name as string,
      trade_name: (row.trade_name as string | null) ?? null,
      cuit: (row.cuit as string | null) ?? null,
      email: (row.email as string | null) ?? null,
      phone: (row.phone as string | null) ?? null,
      city: (row.city as string | null) ?? null,
      province: (row.province as string | null) ?? null,
      address: (row.address as string | null) ?? null,
      active: Boolean(row.active),
      created_at: row.created_at as string,
      active_rep_id: activeLink?.sales_rep_id ?? null,
      active_rep_name: pickRepName(activeLink?.sales_reps),
    };
  });
}

export async function getCrmCustomer(customerId: string): Promise<{
  customer: CrmCustomerRow;
  contacts: CrmContactRow[];
  assignments: CrmAssignmentRow[];
} | null> {
  const session = await getCommercialSession();
  requireStaffSession(session);
  const supabase = await createCommercialServerClient();

  const { data: row, error } = await supabase
    .from("customers")
    .select(
      `
      id, legal_name, trade_name, cuit, email, phone, city, province, address, active, created_at,
      customer_sales_rep (
        sales_rep_id, active, valid_to,
        sales_reps ( name )
      )
    `,
    )
    .eq("id", customerId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!row) return null;

  const links = (row.customer_sales_rep ?? []) as Array<{
    sales_rep_id: string;
    active: boolean;
    valid_to: string | null;
    sales_reps: { name: string } | { name: string }[] | null;
  }>;
  const activeLink = links.find((l) => l.active && l.valid_to == null);

  const customer: CrmCustomerRow = {
    id: row.id as string,
    legal_name: row.legal_name as string,
    trade_name: (row.trade_name as string | null) ?? null,
    cuit: (row.cuit as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    province: (row.province as string | null) ?? null,
    address: (row.address as string | null) ?? null,
    active: Boolean(row.active),
    created_at: row.created_at as string,
    active_rep_id: activeLink?.sales_rep_id ?? null,
    active_rep_name: pickRepName(activeLink?.sales_reps),
  };

  const { data: contacts, error: cErr } = await supabase
    .from("customer_contacts")
    .select("id, customer_id, name, email, phone, position, is_primary, active")
    .eq("customer_id", customerId)
    .order("is_primary", { ascending: false })
    .order("name", { ascending: true });
  if (cErr) throw new Error(cErr.message);

  const { data: assigns, error: aErr } = await supabase
    .from("customer_sales_rep")
    .select(
      `
      id, customer_id, sales_rep_id, valid_from, valid_to, active, created_at,
      sales_reps ( name )
    `,
    )
    .eq("customer_id", customerId)
    .order("valid_from", { ascending: false });
  if (aErr) throw new Error(aErr.message);

  return {
    customer,
    contacts: (contacts ?? []).map((c) => ({
      id: c.id as string,
      customer_id: c.customer_id as string,
      name: (c.name as string | null) ?? null,
      email: (c.email as string | null) ?? null,
      phone: (c.phone as string | null) ?? null,
      position: (c.position as string | null) ?? null,
      is_primary: Boolean(c.is_primary),
      active: Boolean(c.active),
    })),
    assignments: (assigns ?? []).map((a) => ({
      id: a.id as string,
      customer_id: a.customer_id as string,
      sales_rep_id: a.sales_rep_id as string,
      sales_rep_name: pickRepName(
        a.sales_reps as { name: string } | { name: string }[] | null,
      ),
      valid_from: a.valid_from as string,
      valid_to: (a.valid_to as string | null) ?? null,
      active: Boolean(a.active),
      created_at: a.created_at as string,
    })),
  };
}

export async function listCrmReps(q?: string): Promise<CrmRepRow[]> {
  const session = await getCommercialSession();
  requireStaffSession(session);
  const supabase = await createCommercialServerClient();

  let query = supabase
    .from("sales_reps")
    .select(
      `
      id, name, email, active, created_at,
      customer_sales_rep ( id, active, valid_to )
    `,
    )
    .order("name", { ascending: true });

  if (q?.trim()) {
    const term = `%${q.trim()}%`;
    query = query.or(`name.ilike.${term},email.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const links = (row.customer_sales_rep ?? []) as Array<{
      id: string;
      active: boolean;
      valid_to: string | null;
    }>;
    const count = links.filter((l) => l.active && l.valid_to == null).length;
    return {
      id: row.id as string,
      name: row.name as string,
      email: (row.email as string | null) ?? null,
      active: Boolean(row.active),
      created_at: row.created_at as string,
      customer_count: count,
    };
  });
}

export async function getCrmRep(repId: string): Promise<{
  rep: CrmRepRow;
  customers: Array<{
    customer_id: string;
    legal_name: string;
    active: boolean;
    valid_from: string;
  }>;
} | null> {
  const session = await getCommercialSession();
  requireStaffSession(session);
  const supabase = await createCommercialServerClient();

  const { data: row, error } = await supabase
    .from("sales_reps")
    .select("id, name, email, active, created_at")
    .eq("id", repId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return null;

  const { data: portfolio, error: pErr } = await supabase
    .from("customer_sales_rep")
    .select(
      `
      valid_from,
      customers ( id, legal_name, active )
    `,
    )
    .eq("sales_rep_id", repId)
    .eq("active", true)
    .is("valid_to", null)
    .order("valid_from", { ascending: false });
  if (pErr) throw new Error(pErr.message);

  const customers = (portfolio ?? []).map((p) => {
    const c = p.customers as
      | { id: string; legal_name: string; active: boolean }
      | { id: string; legal_name: string; active: boolean }[]
      | null;
    const cust = Array.isArray(c) ? c[0] : c;
    return {
      customer_id: cust?.id ?? "",
      legal_name: cust?.legal_name ?? "—",
      active: Boolean(cust?.active),
      valid_from: p.valid_from as string,
    };
  });

  return {
    rep: {
      id: row.id as string,
      name: row.name as string,
      email: (row.email as string | null) ?? null,
      active: Boolean(row.active),
      created_at: row.created_at as string,
      customer_count: customers.length,
    },
    customers,
  };
}

export async function createCustomer(input: {
  customer: CustomerInput;
  assignToSelf?: boolean;
  salesRepId?: string | null;
  contact?: ContactInput | null;
}): Promise<string> {
  const session = await getCommercialSession();
  const staff = requireStaffSession(session);
  if (!input.customer.legal_name?.trim()) throw new Error("LEGAL_NAME_REQUIRED");

  const supabase = await createCommercialServerClient();
  const { data: created, error } = await supabase
    .from("customers")
    .insert({
      legal_name: input.customer.legal_name.trim(),
      trade_name: emptyToNull(input.customer.trade_name),
      cuit: emptyToNull(input.customer.cuit),
      email: emptyToNull(input.customer.email),
      phone: emptyToNull(input.customer.phone),
      city: emptyToNull(input.customer.city),
      province: emptyToNull(input.customer.province),
      address: emptyToNull(input.customer.address),
      active: input.customer.active ?? true,
      source_system: "platform",
    })
    .select("id")
    .single();

  if (error || !created) throw new Error(error?.message ?? "CREATE_CUSTOMER_FAILED");
  const customerId = created.id as string;

  let assignRepId: string | null = null;
  if (input.salesRepId && canManageAssignments(staff)) {
    assignRepId = input.salesRepId;
  } else if (input.assignToSelf !== false && salesRepIdOf(staff)) {
    assignRepId = salesRepIdOf(staff);
  }

  if (assignRepId) {
    const { error: aErr } = await supabase.from("customer_sales_rep").insert({
      customer_id: customerId,
      sales_rep_id: assignRepId,
      active: true,
    });
    if (aErr) throw new Error(`ASSIGN_FAILED: ${aErr.message}`);
  }

  if (input.contact?.name?.trim()) {
    const { error: cErr } = await supabase.from("customer_contacts").insert({
      customer_id: customerId,
      name: input.contact.name.trim(),
      email: emptyToNull(input.contact.email),
      phone: emptyToNull(input.contact.phone),
      position: emptyToNull(input.contact.position),
      is_primary: input.contact.is_primary ?? true,
      active: true,
    });
    if (cErr) throw new Error(`CONTACT_FAILED: ${cErr.message}`);
  }

  await supabase.from("audit_log").insert({
    actor_user_id: staff.user.id,
    entity_type: "customer",
    entity_id: customerId,
    action: "create",
    after: { legal_name: input.customer.legal_name.trim() },
  });

  return customerId;
}

export async function updateCustomer(
  customerId: string,
  input: CustomerInput,
): Promise<void> {
  const session = await getCommercialSession();
  const staff = requireStaffSession(session);
  if (!input.legal_name?.trim()) throw new Error("LEGAL_NAME_REQUIRED");

  const supabase = await createCommercialServerClient();
  const { error } = await supabase
    .from("customers")
    .update({
      legal_name: input.legal_name.trim(),
      trade_name: emptyToNull(input.trade_name),
      cuit: emptyToNull(input.cuit),
      email: emptyToNull(input.email),
      phone: emptyToNull(input.phone),
      city: emptyToNull(input.city),
      province: emptyToNull(input.province),
      address: emptyToNull(input.address),
      active: input.active ?? true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", customerId);

  if (error) throw new Error(error.message);

  await supabase.from("audit_log").insert({
    actor_user_id: staff.user.id,
    entity_type: "customer",
    entity_id: customerId,
    action: "update",
    after: {
      legal_name: input.legal_name.trim(),
      active: input.active ?? true,
    },
  });
}

export async function addContact(
  customerId: string,
  input: ContactInput,
): Promise<void> {
  const session = await getCommercialSession();
  requireStaffSession(session);
  if (!input.name?.trim()) throw new Error("CONTACT_NAME_REQUIRED");

  const supabase = await createCommercialServerClient();
  const { error } = await supabase.from("customer_contacts").insert({
    customer_id: customerId,
    name: input.name.trim(),
    email: emptyToNull(input.email),
    phone: emptyToNull(input.phone),
    position: emptyToNull(input.position),
    is_primary: Boolean(input.is_primary),
    active: true,
  });
  if (error) throw new Error(error.message);
}

export async function deactivateContact(
  customerId: string,
  contactId: string,
): Promise<void> {
  const session = await getCommercialSession();
  requireStaffSession(session);
  const supabase = await createCommercialServerClient();
  const { error } = await supabase
    .from("customer_contacts")
    .update({ active: false })
    .eq("id", contactId)
    .eq("customer_id", customerId);
  if (error) throw new Error(error.message);
}

export async function assignSalesRep(
  customerId: string,
  salesRepId: string,
): Promise<void> {
  const session = await getCommercialSession();
  const staff = requireStaffSession(session);
  if (!salesRepId) throw new Error("REP_REQUIRED");

  const isManager = canManageAssignments(staff);
  const selfId = salesRepIdOf(staff);
  if (!isManager && selfId !== salesRepId) {
    throw new Error("REASSIGN_FORBIDDEN");
  }

  const supabase = await createCommercialServerClient();
  const now = new Date().toISOString();

  const { data: current } = await supabase
    .from("customer_sales_rep")
    .select("id, sales_rep_id")
    .eq("customer_id", customerId)
    .eq("active", true)
    .is("valid_to", null);

  const previousIds = (current ?? []).map((c) => c.id as string);
  const previousRep = (current ?? [])[0]?.sales_rep_id as string | undefined;

  if (previousIds.length) {
    if (!isManager) throw new Error("ALREADY_ASSIGNED");
    const { error: closeErr } = await supabase
      .from("customer_sales_rep")
      .update({ valid_to: now, active: false })
      .in("id", previousIds);
    if (closeErr) throw new Error(closeErr.message);
  }

  const { error: insErr } = await supabase.from("customer_sales_rep").insert({
    customer_id: customerId,
    sales_rep_id: salesRepId,
    valid_from: now,
    active: true,
  });
  if (insErr) throw new Error(insErr.message);

  await supabase.from("audit_log").insert({
    actor_user_id: staff.user.id,
    entity_type: "customer_sales_rep",
    entity_id: customerId,
    action: "reassign",
    before: { sales_rep_id: previousRep ?? null },
    after: { sales_rep_id: salesRepId },
  });
}

export async function createRep(input: RepInput): Promise<string> {
  const session = await getCommercialSession();
  const staff = requireStaffSession(session);
  if (!canManageReps(staff)) throw new Error("MANAGE_REPS_FORBIDDEN");
  if (!input.name?.trim()) throw new Error("REP_NAME_REQUIRED");

  const supabase = await createCommercialServerClient();
  const { data, error } = await supabase
    .from("sales_reps")
    .insert({
      name: input.name.trim(),
      email: emptyToNull(input.email),
      active: input.active ?? true,
      source_system: "platform",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "CREATE_REP_FAILED");

  await supabase.from("audit_log").insert({
    actor_user_id: staff.user.id,
    entity_type: "sales_rep",
    entity_id: data.id as string,
    action: "create",
    after: { name: input.name.trim() },
  });

  return data.id as string;
}

export async function updateRep(repId: string, input: RepInput): Promise<void> {
  const session = await getCommercialSession();
  const staff = requireStaffSession(session);
  const isManager = canManageReps(staff);
  const isSelf = salesRepIdOf(staff) === repId;
  if (!isManager && !isSelf) throw new Error("UPDATE_REP_FORBIDDEN");
  if (!input.name?.trim()) throw new Error("REP_NAME_REQUIRED");

  const supabase = await createCommercialServerClient();
  const patch = {
    name: input.name.trim(),
    email: emptyToNull(input.email),
    ...(isManager && typeof input.active === "boolean"
      ? { active: input.active }
      : {}),
  };

  const { error } = await supabase.from("sales_reps").update(patch).eq("id", repId);
  if (error) throw new Error(error.message);

  await supabase.from("audit_log").insert({
    actor_user_id: staff.user.id,
    entity_type: "sales_rep",
    entity_id: repId,
    action: "update",
    after: patch,
  });
}
