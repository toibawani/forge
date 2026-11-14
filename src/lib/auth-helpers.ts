import { createClient } from "@/lib/supabase/client";

export async function getCurrentUser() {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return { user, profile };
}

export async function requireAuth() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    throw new Error("Unauthorized");
  }

  return currentUser;
}

export async function requireRole(allowedRoles: string[]) {
  const currentUser = await requireAuth();

  if (!currentUser.profile || !allowedRoles.includes(currentUser.profile.role)) {
    throw new Error("Forbidden");
  }

  return currentUser;
}

export async function isRecruiter() {
  try {
    await requireRole(["recruiter", "admin"]);
    return true;
  } catch {
    return false;
  }
}

export async function isAdmin() {
  try {
    await requireRole(["admin"]);
    return true;
  } catch {
    return false;
  }
}
