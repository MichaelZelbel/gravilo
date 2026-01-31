# AI Credits System Implementation Guide (Gravilo)

This document provides step-by-step prompts to implement a complete AI credit/token system for Gravilo. The key difference from user-based systems is that **Gravilo tracks tokens per Discord server**, not per user. Copy each prompt in sequence to build the system incrementally.

---

## Overview

The AI Credits system provides:
- **Token-based tracking** per Discord server with dynamic credit conversion
- **Monthly allowance periods** with automatic rollover per server
- **Server admin interface** for viewing usage
- **Global admin interface** for managing server balances
- **Low credit warnings** and rollover previews
- **Audit logging** for all token changes
- **Cron job** for automatic period resets

---

## Prerequisites

Before starting, ensure your project has:
- Supabase connected (Cloud or external)
- Authentication implemented (users can sign in with Discord OAuth)
- A `servers` table with `id`, `discord_guild_id`, `owner_id`, and plan info
- A `server_plans` table tracking server subscription status (`free`/`premium`)
- A `users` table with `id`, `discord_user_id`, and user info
- A `user_servers` table linking users to servers they can access
- User roles system (`user_roles` table with `has_role()` function)

---

## Key Differences from User-Based Systems

| Aspect | User-Based (Querino) | Server-Based (Gravilo) |
|--------|----------------------|------------------------|
| Tracking entity | `user_id` | `server_id` (discord_guild_id) |
| Plan lookup | `profiles.plan_type` | `server_plans.plan` |
| Admin check | `profiles.role = 'admin'` | `has_role(uid, 'admin')` or server owner |
| Allowance table | `ai_allowance_periods.user_id` | `server_token_allowances.server_id` |
| Usage logging | `llm_usage_events.user_id` | `server_token_events.server_id` |
| Frontend context | Current user session | Selected server in dashboard |

---

## Step 1: Database Schema

### Prompt 1.1: Create Core Tables

```
Create an AI credit system for tracking tokens per Discord server with the following database tables:

1. `ai_credit_settings` table (global settings):
   - key (text, primary key)
   - value_int (integer, not null)
   - description (text, nullable)
   
   Insert these default rows:
   - tokens_per_credit: 200 (LLM tokens per display credit)
   - tokens_free_per_month: 60000 (300 credits × 200 = monthly tokens for free servers)
   - tokens_premium_per_month: 600000 (3000 credits × 200 = monthly tokens for premium servers)

   RLS: Anyone authenticated can SELECT, only admins (has_role(auth.uid(), 'admin')) can UPDATE.

2. `server_token_allowances` table (per-server monthly allowances):
   - id (uuid, primary key, default gen_random_uuid())
   - server_id (text, not null) -- references discord_guild_id
   - tokens_granted (bigint, default 0)
   - tokens_used (bigint, default 0)
   - period_start (timestamptz, not null)
   - period_end (timestamptz, not null)
   - source (text, nullable - values like 'subscription', 'free_tier', 'admin_grant')
   - metadata (jsonb, default '{}' - stores rollover_tokens, base_tokens)
   - created_at (timestamptz, default now())
   - updated_at (timestamptz, default now())

   Add unique constraint on (server_id, period_start).
   
   RLS: 
   - Users can SELECT allowances for servers they have access to via user_servers
   - Admins (has_role) can SELECT/INSERT/UPDATE all
   - Server owners can SELECT their own servers' allowances

3. `server_token_events` table (append-only ledger):
   - id (uuid, primary key, default gen_random_uuid())
   - server_id (text, not null) -- references discord_guild_id
   - user_id (uuid, nullable) -- the user who triggered the action (if from dashboard)
   - discord_user_id (text, nullable) -- Discord user who triggered (if from bot)
   - idempotency_key (text, not null, unique)
   - feature (text, nullable - e.g., 'discord_chat', 'dashboard_chat', 'admin_adjustment')
   - model (text, nullable)
   - provider (text, nullable)
   - prompt_tokens (bigint, default 0)
   - completion_tokens (bigint, default 0)
   - total_tokens (bigint, default 0)
   - credits_charged (numeric, default 0) -- for historical reference
   - channel_name (text, nullable) -- Discord channel if applicable
   - metadata (jsonb, default '{}')
   - created_at (timestamptz, default now())

   RLS: 
   - Users can SELECT events for servers they have access to via user_servers
   - No client-side INSERT/UPDATE/DELETE (service role only)
```

### Prompt 1.2: Create the View

```
Create a database view called `v_server_token_allowance_current` that:

1. Selects the CURRENT allowance period for each server (where now() is between period_start and period_end)
2. Joins with ai_credit_settings to get the current tokens_per_credit value
3. Calculates these dynamic fields:
   - remaining_tokens = tokens_granted - tokens_used
   - credits_granted = tokens_granted / tokens_per_credit
   - credits_used = tokens_used / tokens_per_credit
   - remaining_credits = remaining_tokens / tokens_per_credit

The view should expose: id, server_id, tokens_granted, tokens_used, remaining_tokens, tokens_per_credit, credits_granted, credits_used, remaining_credits, period_start, period_end, source, metadata, created_at, updated_at.

This view uses tokens as the source of truth and calculates credits dynamically.

RLS on the view should allow:
- Users to see allowances for servers they access via user_servers
- Server owners to see their servers' allowances
- Admins to see all
```

---

## Step 2: Edge Functions for Token Management

### Prompt 2.1: Create ensure-server-token-allowance Edge Function

```
Create a Supabase Edge Function called `ensure-server-token-allowance` that:

1. Accepts JSON body with:
   - server_id (required - discord_guild_id)
   - batch_init (optional boolean - for cron job to initialize all servers)

2. Authorization:
   - For single server: user must have access via user_servers or be server owner or be admin
   - For batch_init: require admin role via has_role() or service role

3. Logic for single server:
   - Check if server has a current allowance period (now() between period_start and period_end)
   - If yes, return the existing period
   - If no, create a new period:
     a. Calculate period_start (1st of current month) and period_end (1st of next month)
     b. Look up server's plan from server_plans table (default to 'free' if not found)
     c. Get tokens_free_per_month or tokens_premium_per_month from ai_credit_settings
     d. base_tokens = the appropriate token amount for the plan
     e. Check for previous expired period and calculate rollover:
        - rollover_tokens = MIN(previous remaining_tokens, base_tokens)
     f. Insert new period with tokens_granted = base_tokens + rollover_tokens
     g. Store metadata: { base_tokens, rollover_tokens, plan }

4. For batch_init:
   - Query all active servers from servers table
   - For each server without a current period, create one (same logic as above)
   - Return count of initialized servers

5. Return the allowance period data including calculated credits

Use SUPABASE_SERVICE_ROLE_KEY for database operations to bypass RLS.
Set verify_jwt = false in config.toml (we validate auth inside).
```

### Prompt 2.2: Create log-server-token-usage Edge Function

```
Create a Supabase Edge Function called `log-server-token-usage` that:

1. Accepts JSON body with:
   - server_id (required - discord_guild_id)
   - prompt_tokens (required - integer)
   - completion_tokens (required - integer)
   - feature (required - e.g., 'discord_chat', 'dashboard_chat')
   - model (optional - LLM model name)
   - provider (optional - e.g., 'openai', 'anthropic')
   - discord_user_id (optional - if called from Discord bot)
   - user_id (optional - if called from dashboard)
   - channel_name (optional - Discord channel)
   - metadata (optional - additional context)
   - idempotency_key (optional - if not provided, generate one)

2. Authorization:
   - Accept x-bot-secret header for Discord bot calls
   - Or accept Authorization header with valid JWT for dashboard calls
   - Either must be valid to proceed

3. Logic:
   a. Calculate total_tokens = prompt_tokens + completion_tokens
   b. Get current tokens_per_credit from ai_credit_settings
   c. Calculate credits_charged = total_tokens / tokens_per_credit
   d. Get or create current allowance period via ensure-server-token-allowance logic
   e. Check if server has sufficient remaining tokens:
      - If tokens_used + total_tokens > tokens_granted, return error with remaining info
   f. Insert record into server_token_events
   g. Update server_token_allowances.tokens_used += total_tokens
   h. Return updated allowance info

4. Response includes:
   - success: boolean
   - tokens_used: new total
   - tokens_remaining: updated remaining
   - credits_remaining: calculated
   - event_id: the logged event ID

Use SUPABASE_SERVICE_ROLE_KEY for database operations.
Set verify_jwt = false in config.toml (we validate auth inside).
```

### Prompt 2.3: Create get-server-token-status Edge Function

```
Create a Supabase Edge Function called `get-server-token-status` that:

1. Accepts query params or JSON body:
   - server_id (required - discord_guild_id)

2. Authorization:
   - Accept x-bot-secret header for Discord bot calls
   - Or accept Authorization header with valid JWT
   - User must have access to server via user_servers or be owner

3. Logic:
   a. Call ensure-server-token-allowance to ensure period exists
   b. Fetch from v_server_token_allowance_current view
   c. Also fetch server plan from server_plans
   d. Get ai_credit_settings for tokens_per_credit

4. Response:
   {
     "server_id": "...",
     "plan": "free" | "premium",
     "tokens_granted": 60000,
     "tokens_used": 15000,
     "tokens_remaining": 45000,
     "tokens_per_credit": 200,
     "credits_granted": 300,
     "credits_used": 75,
     "credits_remaining": 225,
     "period_start": "2026-01-01T00:00:00Z",
     "period_end": "2026-02-01T00:00:00Z",
     "rollover_tokens": 0,
     "base_tokens": 60000,
     "at_limit": false,
     "usage_percentage": 25
   }

This endpoint is called by both the dashboard and the Discord bot to check limits.
```

---

## Step 3: Frontend Hooks

### Prompt 3.1: Create useServerTokens Hook

```
Create a React hook called `useServerTokens` in src/hooks/useServerTokens.ts that:

1. Accepts a server_id (discord_guild_id) parameter
2. On mount or when server_id changes:
   - Call the get-server-token-status edge function
   - Store the response in state

3. Returns an object with:
   - tokens: {
       serverId, plan, tokensGranted, tokensUsed, tokensRemaining,
       tokensPerCredit, creditsGranted, creditsUsed, creditsRemaining,
       periodStart, periodEnd, rolloverTokens, baseTokens,
       atLimit, usagePercentage
     }
   - isLoading: boolean
   - error: string | null
   - refetch: function

4. Include a low credit warning effect:
   - Use a ref to track if warning was shown this session for this server
   - If usagePercentage > 85%, show a toast warning
   - Toast message: "Low AI Credits" with "This server has X credits remaining. Consider upgrading to Premium for more."
   - Show only once per server per session
```

### Prompt 3.2: Create useServerTokenGate Hook

```
Create a hook called `useServerTokenGate` in src/hooks/useServerTokenGate.ts that:

1. Accepts server_id parameter
2. Uses useServerTokens internally
3. Provides a checkTokens() function that:
   - Returns true if server has tokensRemaining > 0
   - Returns false and shows toast "This server has reached its AI credit limit" if no tokens
   - Returns true while still loading (fail-open, server will catch)

4. Returns: { hasTokens, isLoading, checkTokens, tokens, refetchTokens }

Use this hook to gate AI features in the dashboard before making API calls.
```

---

## Step 4: Dashboard Integration

### Prompt 4.1: Create ServerTokenDisplay Component

```
Create a component called `ServerTokenDisplay` in src/components/dashboard/ServerTokenDisplay.tsx that:

1. Accepts server_id prop
2. Uses useServerTokens hook to get token data
3. Shows loading state with spinner while fetching
4. Displays:
   - Header: "AI Credits remaining" with "X of Y" on the right
   - Progress bar showing remaining/total percentage
   - Visual indicator for rollover credits (darker section on progress bar)
   - Color coding: 
     - Green (0-50% used)
     - Yellow (50-85% used)
     - Red (85-100% used)
   - Rollover preview banner (when within 5 days of period end):
     "X credits will carry over to next period (in N days)"
   - Info lines:
     - Server plan badge (Free / Premium)
     - "Resets on [date]"
     - "Up to X credits can rollover"

5. Show upgrade CTA for free servers when usage > 70%

6. Use semantic Tailwind classes matching Gravilo's dark theme
7. Use date-fns for date formatting
8. Use lucide-react icons
```

### Prompt 4.2: Update Dashboard to Show Token Status

```
Update the Dashboard page to:

1. Import and display the ServerTokenDisplay component in the usage section
2. Replace the existing hardcoded usage ring with data from useServerTokens
3. When selected server changes, refetch token status
4. Show the token status in the "Current Usage" card area
5. Keep the existing styling consistent with Gravilo's glassmorphic dark theme
```

---

## Step 5: Discord Bot Integration

### Prompt 5.1: Pre-Chat Token Check

```
The Discord bot (external, not in this repo) should call get-server-token-status before each AI interaction:

1. Before processing a user message:
   GET /functions/v1/get-server-token-status?server_id={guild_id}
   Headers: x-bot-secret: {DISCORD_BOT_SYNC_SECRET}

2. Check response:
   - If at_limit is true, reply with friendly message:
     "This server has used all its AI credits for this month. The server owner can upgrade to Premium for more credits, or wait until [period_end] for the reset."
   - If tokens_remaining < tokens needed for response (estimate ~500 tokens per response):
     Consider warning but proceed

3. After successful AI response:
   POST /functions/v1/log-server-token-usage
   Body: {
     server_id, prompt_tokens, completion_tokens,
     feature: "discord_chat",
     discord_user_id, channel_name, model, provider
   }
   Headers: x-bot-secret: {DISCORD_BOT_SYNC_SECRET}
```

### Prompt 5.2: Update chat-server Edge Function

```
Update the existing chat-server edge function to:

1. Before calling n8n:
   - Call get-server-token-status internally (or check v_server_token_allowance_current directly)
   - If at_limit, return error response with message about credit limit

2. After receiving response from n8n:
   - If n8n returns token usage info in response, call log-server-token-usage
   - Or delegate token logging to n8n (preferred for actual token counts)

3. Response should include remaining credits info for dashboard display
```

---

## Step 6: Admin Interface

### Prompt 6.1: Add AI Credit Settings to Admin Page

```
Add an "AI Credit Settings" section to the Admin page that:

1. Fetches all rows from ai_credit_settings table
2. Displays each setting with:
   - Setting key as label (formatted nicely)
   - Current value in an editable input
   - Description as helper text
3. Allows admins to update values inline
4. Shows save button per setting
5. Updates take effect immediately for all servers (since credits are calculated dynamically)

Settings to show:
- tokens_per_credit: "Tokens per Credit" - how many LLM tokens equal 1 display credit
- tokens_free_per_month: "Free Tier Monthly Tokens" - tokens granted to free servers
- tokens_premium_per_month: "Premium Tier Monthly Tokens" - tokens granted to premium servers
```

### Prompt 6.2: Add Server Token Management

```
Add a server token management interface to Admin page that:

1. Lists all servers with their current token usage
2. For each server, shows:
   - Server name and Discord ID
   - Current plan (Free/Premium)
   - Usage progress bar (tokens_used / tokens_granted)
   - Period end date
3. Click on a server to open a modal with:
   - Period details (start, end)
   - Tokens granted (editable)
   - Tokens used (editable)
   - Calculated credits display
   - Rollover info from metadata
4. On save:
   - Update server_token_allowances
   - Log to server_token_events with feature: "admin_adjustment"
   - Include admin info in metadata
```

---

## Step 7: Cron Job for Automatic Resets

### Prompt 7.1: Set Up Daily Cron Job

```
Set up a pg_cron job to automatically reset/initialize server token allowances daily:

1. Enable pg_cron and pg_net extensions in Supabase

2. Create a cron job that runs daily at 00:05 UTC:
   - Calls the ensure-server-token-allowance edge function with { "batch_init": true }
   - Uses the service role key for authentication

3. The cron job ensures:
   - Servers that are active on the 1st of the month already have their new period ready
   - Rollover calculations happen automatically
   - No server needs to wait for lazy initialization

SQL for the cron job:
SELECT cron.schedule(
  'daily-server-token-allowance-reset',
  '5 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://sohyviltwgpuslbjzqzh.supabase.co/functions/v1/ensure-server-token-allowance',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer SERVICE_ROLE_KEY"}'::jsonb,
    body := '{"batch_init": true}'::jsonb
  ) AS request_id;
  $$
);
```

---

## Step 8: Integrate with Existing Features

### Prompt 8.1: Gate Dashboard Chat with Token Check

```
Update the Dashboard chat feature to use token gating:

1. Import useServerTokenGate hook
2. Before sending a message via chat-server:
   - Call checkTokens()
   - If false, show toast and abort
3. After successful response:
   - Call refetchTokens() to update the usage display
4. Show remaining credits in chat UI footer

Example pattern:
const { checkTokens, refetchTokens } = useServerTokenGate(selectedServerId);

const handleSendMessage = async () => {
  if (!checkTokens()) return;
  
  try {
    const response = await sendChatMessage();
    refetchTokens(); // Update credits display
  } catch (error) {
    // handle error
  }
};
```

### Prompt 8.2: Update n8n Integration

```
The n8n workflow that handles AI responses should:

1. Receive token status check from chat-server edge function
2. If over limit, return appropriate error message
3. After successful LLM call, extract token usage from LLM response:
   - prompt_tokens
   - completion_tokens
   - model
   - provider
4. Call log-server-token-usage endpoint with extracted data
5. Return token info to chat-server for dashboard display
```

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
├─────────────────────────────────────────────────────────────────┤
│  useServerTokens       - Fetches & calculates server credits    │
│  useServerTokenGate    - Gates AI features by credit balance    │
│  ServerTokenDisplay    - Dashboard UI with progress bar         │
│  Admin Token Management - Admin server token management         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     EDGE FUNCTIONS                               │
├─────────────────────────────────────────────────────────────────┤
│  ensure-server-token-allowance - Creates/returns server periods │
│  log-server-token-usage        - Logs usage and decrements      │
│  get-server-token-status       - Returns current server status  │
│  chat-server (updated)         - Checks limits before AI call   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DATABASE                                  │
├─────────────────────────────────────────────────────────────────┤
│  ai_credit_settings              - Global config                 │
│  server_token_allowances         - Server monthly allowances     │
│  server_token_events             - Audit log of all AI usage     │
│  v_server_token_allowance_current - View with calculated credits │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     EXTERNAL SYSTEMS                             │
├─────────────────────────────────────────────────────────────────┤
│  Discord Bot           - Calls get-server-token-status          │
│                        - Calls log-server-token-usage           │
│  n8n Workflow          - Receives token info, returns usage     │
│  pg_cron               - Daily batch initialization             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Principles

1. **Tokens are the source of truth** - Credits are always calculated dynamically
2. **Per-server tracking** - Each Discord server has its own token balance independent of users
3. **Dynamic conversion** - Changing `tokens_per_credit` affects all servers immediately
4. **Rollover capped** - Servers can carry over up to their plan's monthly allowance
5. **Audit everything** - Every token change is logged to `server_token_events`
6. **Fail-safe resets** - Cron + lazy initialization ensures no server misses their allowance
7. **Premium gating** - AI features require both Premium plan AND remaining tokens

---

## Existing Gravilo Tables Reference

The following tables already exist and should be referenced (not recreated):

- `servers` - Server info with `discord_guild_id`, `owner_id`
- `server_plans` - Server subscription status (`plan`: 'free'/'premium')
- `users` - User info with `discord_user_id`
- `user_servers` - Links users to servers they can access
- `user_roles` - Admin role tracking with `has_role()` function

---

## Migration Notes

When implementing, consider these existing patterns in Gravilo:

1. **Server selection** - Dashboard already has server dropdown; token display should update on selection
2. **Message usage** - Existing `servers.message_usage_current_cycle` can coexist or be deprecated in favor of token tracking
3. **Plan detection** - Use `server_plans.plan` for determining token allowance tier
4. **Access control** - Reuse `user_servers` table for determining server access

---

## Customization Points

- **Plan tiers**: Adjust `tokens_free_per_month` and `tokens_premium_per_month`
- **Conversion rate**: Change `tokens_per_credit` to adjust credit "value"
- **Rollover cap**: Modify the rollover calculation in ensure-server-token-allowance
- **Warning threshold**: Change the 85% threshold in useServerTokens
- **Preview window**: Adjust the 5-day rollover preview window in ServerTokenDisplay
- **Enterprise tier**: Add `tokens_enterprise_per_month` for future enterprise plans
