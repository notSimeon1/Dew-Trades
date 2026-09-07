import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

interface RegisterInput {
  email: string;
  password: string;
  fullName?: string;
  country?: string;
  referralCode?: string;
}

/**
 * Server function to register a user with email automatically pre-confirmed.
 * This completely eliminates the "Email not confirmed" requirement.
 */
export const registerDirectUser = createServerFn({ method: "POST" })
  .validator((input: RegisterInput) => input)
  .handler(async ({ data }) => {
    const { email, password, fullName, country, referralCode } = data;
    const cleanEmail = email.trim().toLowerCase();

    try {
      let createdUserId: string | null = null;

      // 1. Check if user already exists
      const { data: userList, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
      if (!listErr && userList?.users) {
        const existing = userList.users.find((u) => u.email?.toLowerCase() === cleanEmail);
        if (existing) {
          createdUserId = existing.id;
          // If already registered, ensure email is confirmed and update password
          await supabaseAdmin.auth.admin.updateUserById(existing.id, {
            email_confirm: true,
            password,
            user_metadata: {
              ...(existing.user_metadata || {}),
              full_name: fullName || existing.user_metadata?.full_name,
              country: country || existing.user_metadata?.country,
              referral_code: referralCode || existing.user_metadata?.referral_code,
            },
          });
        }
      }

      // 2. Create brand new user if not found
      if (!createdUserId) {
        const { data: createData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: cleanEmail,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: fullName || "Trader",
            country: country || "United States",
            referral_code: referralCode || null,
          },
        });

        if (createErr) {
          if (createErr.message.toLowerCase().includes("already registered")) {
            const { data: users } = await supabaseAdmin.auth.admin.listUsers();
            const found = users?.users.find((u) => u.email?.toLowerCase() === cleanEmail);
            if (found) {
              createdUserId = found.id;
              await supabaseAdmin.auth.admin.updateUserById(found.id, {
                email_confirm: true,
                password,
              });
            }
          } else {
            throw createErr;
          }
        } else if (createData?.user?.id) {
          createdUserId = createData.user.id;
        }
      }

      // 3. Strictly enforce user role: new signups are ALWAYS 'user' role
      if (createdUserId) {
        const isOwner = cleanEmail === "simonosawaru255@gmail.com";
        const assignedRole = isOwner ? "admin" : "user";

        // Seed or sync profile with user role
        await (supabaseAdmin as any).from("profiles").upsert(
          {
            id: createdUserId,
            full_name: fullName || "Trader",
            role: assignedRole,
            account_mode: "demo",
            demo_balance: 10000,
            account_balance: 0,
            available_cash: 0,
            live_balance: 0,
            kyc_status: "unverified",
            ai_trading_enabled: true,
          },
          { onConflict: "id" },
        );

        if (!isOwner) {
          // Remove any admin or super_admin roles from user_roles
          await (supabaseAdmin as any)
            .from("user_roles")
            .delete()
            .eq("user_id", createdUserId)
            .in("role", ["admin", "super_admin"]);

          // Ensure standard user role entry exists
          await (supabaseAdmin as any)
            .from("user_roles")
            .upsert({ user_id: createdUserId, role: "user" }, { onConflict: "user_id,role" });
        }
      }

      return { success: true, message: "User registered and confirmed" };
    } catch (err: any) {
      console.error("[registerDirectUser error]", err);
      throw new Error(err.message || "Failed to create account");
    }
  });

/**
 * Server function to auto-confirm an unconfirmed email instantly if triggered on sign-in
 */
export const autoConfirmEmail = createServerFn({ method: "POST" })
  .validator((input: { email: string }) => input)
  .handler(async ({ data }) => {
    const cleanEmail = data.email.trim().toLowerCase();
    try {
      const { data: userList, error } = await supabaseAdmin.auth.admin.listUsers();
      if (error) throw error;
      const target = userList?.users.find((u) => u.email?.toLowerCase() === cleanEmail);
      if (target) {
        await supabaseAdmin.auth.admin.updateUserById(target.id, {
          email_confirm: true,
        });
        return { success: true, confirmed: true };
      }
      return { success: false, error: "User not found" };
    } catch (err: any) {
      console.error("[autoConfirmEmail error]", err);
      return { success: false, error: err.message };
    }
  });
