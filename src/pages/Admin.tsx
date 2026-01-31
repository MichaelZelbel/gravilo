import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Users, Crown, UserCheck, Trash2, Coins, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type User = {
  id: string;
  email: string | null;
  plan: string | null;
  discord_user_id: string | null;
  created_at: string;
};

type UserRole = {
  id: string;
  user_id: string;
  role: "admin" | "moderator" | "user";
  created_at: string;
};

type CreditSetting = {
  key: string;
  value_int: number;
  description: string | null;
};

const SETTING_LABELS: Record<string, string> = {
  tokens_per_credit: "Tokens per Credit",
  tokens_free_per_month: "Free Tier Monthly Tokens",
  tokens_premium_per_month: "Premium Tier Monthly Tokens",
};

const Admin = () => {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [userRoles, setUserRoles] = useState<Record<string, UserRole[]>>({});
  const [updating, setUpdating] = useState<string | null>(null);
  const [creditSettings, setCreditSettings] = useState<CreditSetting[]>([]);
  const [editedSettings, setEditedSettings] = useState<Record<string, number>>({});
  const [savingSettings, setSavingSettings] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = "/";
        return;
      }

      // Check if current user is admin
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (roleError || !roleData) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setIsAdmin(true);

      // Fetch all users (admin can see all via RLS policy)
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("id, email, plan, discord_user_id, created_at")
        .order("created_at", { ascending: false });

      if (usersError) {
        console.error("Error fetching users:", usersError);
      } else {
        setUsers(usersData || []);
      }

      // Fetch all roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("id, user_id, role, created_at");

      if (rolesError) {
        console.error("Error fetching roles:", rolesError);
      } else {
        // Group roles by user_id
        const grouped: Record<string, UserRole[]> = {};
        (rolesData || []).forEach((r) => {
          if (!grouped[r.user_id]) grouped[r.user_id] = [];
          grouped[r.user_id].push(r as UserRole);
        });
        setUserRoles(grouped);
      }

      // Fetch credit settings
      const { data: settingsData, error: settingsError } = await supabase
        .from("ai_credit_settings")
        .select("key, value_int, description");

      if (settingsError) {
        console.error("Error fetching credit settings:", settingsError);
      } else {
        setCreditSettings(settingsData || []);
        // Initialize edited values
        const initial: Record<string, number> = {};
        (settingsData || []).forEach((s) => {
          initial[s.key] = s.value_int;
        });
        setEditedSettings(initial);
      }

      setLoading(false);
    };

    init();
  }, []);

  const handleSettingChange = (key: string, value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0) {
      setEditedSettings((prev) => ({ ...prev, [key]: numValue }));
    }
  };

  const saveSetting = async (key: string) => {
    setSavingSettings((prev) => ({ ...prev, [key]: true }));
    
    const { error } = await supabase
      .from("ai_credit_settings")
      .update({ value_int: editedSettings[key] })
      .eq("key", key);

    if (error) {
      toast({ title: "Error", description: `Failed to update ${key}`, variant: "destructive" });
    } else {
      setCreditSettings((prev) =>
        prev.map((s) => (s.key === key ? { ...s, value_int: editedSettings[key] } : s))
      );
      toast({ title: "Success", description: `${SETTING_LABELS[key] || key} updated` });
    }

    setSavingSettings((prev) => ({ ...prev, [key]: false }));
  };

  const isSettingModified = (key: string) => {
    const original = creditSettings.find((s) => s.key === key);
    return original && original.value_int !== editedSettings[key];
  };

  const updateUserPlan = async (userId: string, newPlan: string) => {
    setUpdating(userId);
    const { error } = await supabase
      .from("users")
      .update({ plan: newPlan })
      .eq("id", userId);

    if (error) {
      toast({ title: "Error", description: "Failed to update plan", variant: "destructive" });
    } else {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, plan: newPlan } : u))
      );
      toast({ title: "Success", description: `Plan updated to ${newPlan}` });
    }
    setUpdating(null);
  };

  const addRole = async (userId: string, role: "admin" | "moderator" | "user") => {
    setUpdating(userId);
    const { data, error } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        toast({ title: "Info", description: "User already has this role" });
      } else {
        toast({ title: "Error", description: "Failed to add role", variant: "destructive" });
      }
    } else {
      setUserRoles((prev) => ({
        ...prev,
        [userId]: [...(prev[userId] || []), data as UserRole],
      }));
      toast({ title: "Success", description: `Added ${role} role` });
    }
    setUpdating(null);
  };

  const removeRole = async (userId: string, roleId: string, roleName: string) => {
    setUpdating(userId);
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("id", roleId);

    if (error) {
      toast({ title: "Error", description: "Failed to remove role", variant: "destructive" });
    } else {
      setUserRoles((prev) => ({
        ...prev,
        [userId]: (prev[userId] || []).filter((r) => r.id !== roleId),
      }));
      toast({ title: "Success", description: `Removed ${roleName} role` });
    }
    setUpdating(null);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-500/20 text-red-300 border-red-500/30";
      case "moderator":
        return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
      default:
        return "bg-blue-500/20 text-blue-300 border-blue-500/30";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050814] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 rounded-full border-4 border-[#5865F2] border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#050814] text-white flex items-center justify-center">
        <div className="backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-8 max-w-md text-center">
          <Shield className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-3">Access Denied</h1>
          <p className="text-gray-300 text-sm mb-5">
            You don't have permission to access the admin panel.
          </p>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-[#5865F2] hover:bg-[#6b74ff] shadow-[0_0_18px_rgba(88,101,242,0.7)] text-sm"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050814] text-white">
      <div className="relative min-h-screen overflow-hidden">
        {/* Background effects */}
        <div className="pointer-events-none absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_top,_rgba(88,101,242,0.3),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(59,255,182,0.2),_transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-20 bg-[linear-gradient(to_right,_rgba(255,255,255,0.08)_1px,_transparent_1px),linear-gradient(to_bottom,_rgba(255,255,255,0.08)_1px,_transparent_1px)] bg-[size:80px_80px]" />

        <div className="relative z-10 flex flex-col min-h-screen px-6 py-6 md:px-10 md:py-8 space-y-6">
          {/* Header */}
          <header className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl px-4 md:px-6 py-3 flex items-center justify-between shadow-[0_0_30px_rgba(0,0,0,0.6)]">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-red-500 to-orange-400 flex items-center justify-center">
                <Shield className="h-4 w-4" />
              </div>
              <span className="font-semibold tracking-wide">Admin Panel</span>
            </div>

            <div className="flex items-center gap-3">
              <a
                href="/dashboard"
                className="text-xs sm:text-sm px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 transition"
              >
                Back to Dashboard
              </a>
            </div>
          </header>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-[#5865F2]" />
                <div>
                  <p className="text-2xl font-bold">{users.length}</p>
                  <p className="text-xs text-gray-400">Total Users</p>
                </div>
              </div>
            </div>
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <Crown className="h-8 w-8 text-yellow-400" />
                <div>
                  <p className="text-2xl font-bold">
                    {users.filter((u) => u.plan === "premium").length}
                  </p>
                  <p className="text-xs text-gray-400">Premium Users</p>
                </div>
              </div>
            </div>
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <UserCheck className="h-8 w-8 text-[#3BFFB6]" />
                <div>
                  <p className="text-2xl font-bold">
                    {Object.values(userRoles).flat().filter((r) => r.role === "admin").length}
                  </p>
                  <p className="text-xs text-gray-400">Admins</p>
                </div>
              </div>
            </div>
          </div>

          {/* Users Table */}
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10">
              <h2 className="text-lg font-semibold">User Management</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs text-gray-400 uppercase tracking-wider">
                    <th className="px-6 py-3">Email</th>
                    <th className="px-6 py-3">Discord ID</th>
                    <th className="px-6 py-3">Plan</th>
                    <th className="px-6 py-3">Roles</th>
                    <th className="px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-white/5 hover:bg-white/5 transition"
                    >
                      <td className="px-6 py-4 text-sm">
                        {user.email || <span className="text-gray-500">No email</span>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400 font-mono">
                        {user.discord_user_id || "-"}
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={user.plan || "free"}
                          onChange={(e) => updateUserPlan(user.id, e.target.value)}
                          disabled={updating === user.id}
                          className="bg-white/5 border border-white/20 rounded-lg px-2 py-1 text-sm text-gray-200 disabled:opacity-50"
                        >
                          <option value="free">Free</option>
                          <option value="premium">Premium</option>
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {(userRoles[user.id] || []).map((r) => (
                            <span
                              key={r.id}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${getRoleBadgeColor(r.role)}`}
                            >
                              {r.role}
                              <button
                                onClick={() => removeRole(user.id, r.id, r.role)}
                                disabled={updating === user.id}
                                className="hover:text-white transition disabled:opacity-50"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                          {(userRoles[user.id] || []).length === 0 && (
                            <span className="text-gray-500 text-xs">No roles</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                addRole(user.id, e.target.value as "admin" | "moderator" | "user");
                                e.target.value = "";
                              }
                            }}
                            disabled={updating === user.id}
                            className="bg-white/5 border border-white/20 rounded-lg px-2 py-1 text-xs text-gray-200 disabled:opacity-50"
                            defaultValue=""
                          >
                            <option value="" disabled>
                              Add role...
                            </option>
                            <option value="admin">Admin</option>
                            <option value="moderator">Moderator</option>
                            <option value="user">User</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* AI Credit Settings */}
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10 flex items-center gap-3">
              <Coins className="h-5 w-5 text-[#3BFFB6]" />
              <h2 className="text-lg font-semibold">AI Credit Settings</h2>
            </div>
            <div className="p-6 space-y-6">
              {creditSettings.length === 0 ? (
                <p className="text-gray-400 text-sm">No credit settings found.</p>
              ) : (
                creditSettings.map((setting) => (
                  <div
                    key={setting.key}
                    className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10"
                  >
                    <div className="flex-1 min-w-0">
                      <label className="block text-sm font-medium text-gray-200 mb-1">
                        {SETTING_LABELS[setting.key] || setting.key}
                      </label>
                      {setting.description && (
                        <p className="text-xs text-gray-400">{setting.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        min={0}
                        value={editedSettings[setting.key] ?? setting.value_int}
                        onChange={(e) => handleSettingChange(setting.key, e.target.value)}
                        className="w-36 bg-white/5 border-white/20 text-gray-200"
                      />
                      <Button
                        onClick={() => saveSetting(setting.key)}
                        disabled={!isSettingModified(setting.key) || savingSettings[setting.key]}
                        size="sm"
                        variant={isSettingModified(setting.key) ? "default" : "secondary"}
                        className={isSettingModified(setting.key) 
                          ? "bg-[#3BFFB6] hover:bg-[#2ee8a5] text-black" 
                          : "bg-white/10 text-gray-400"
                        }
                      >
                        {savingSettings[setting.key] ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))
              )}
              
              <div className="mt-4 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-xs text-yellow-300">
                  <strong>Note:</strong> Changes take effect immediately for all new credit calculations. 
                  Existing allowance periods will use the new settings when calculating remaining credits.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin;
