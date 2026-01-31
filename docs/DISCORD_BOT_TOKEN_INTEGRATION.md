# Discord Bot Token Integration Guide

This document describes how the external Discord bot should integrate with the Gravilo token/credit system.

## Overview

The bot must:
1. **Check token status** before processing AI requests
2. **Log token usage** after successful AI responses

---

## 1. Check Token Status (Before AI Interaction)

### Request

```http
GET /functions/v1/get-server-token-status?server_id={discord_guild_id}
Host: sohyviltwgpuslbjzqzh.supabase.co
x-bot-secret: {DISCORD_BOT_SYNC_SECRET}
```

### Response (200 OK)

```json
{
  "server_id": "123456789012345678",
  "plan": "free",
  "tokens_granted": 60000,
  "tokens_used": 15000,
  "tokens_remaining": 45000,
  "tokens_per_credit": 200,
  "credits_granted": 300,
  "credits_used": 75,
  "credits_remaining": 225,
  "period_start": "2026-01-01T00:00:00.000Z",
  "period_end": "2026-02-01T00:00:00.000Z",
  "rollover_tokens": 0,
  "base_tokens": 60000,
  "at_limit": false,
  "usage_percentage": 25
}
```

### Bot Logic

```python
# Pseudocode for Discord bot

async def handle_message(message):
    guild_id = str(message.guild.id)
    
    # Step 1: Check token status
    status = await check_token_status(guild_id)
    
    if status["at_limit"]:
        # Reply with friendly limit message
        period_end = format_date(status["period_end"])
        await message.reply(
            f"⚠️ This server has used all its AI credits for this month.\n\n"
            f"The server owner can upgrade to Premium for more credits, "
            f"or wait until **{period_end}** for the monthly reset."
        )
        return
    
    # Optional: Warn if low on credits (< 500 tokens remaining)
    ESTIMATED_RESPONSE_TOKENS = 500
    if status["tokens_remaining"] < ESTIMATED_RESPONSE_TOKENS:
        # Still proceed, but could add a warning
        pass
    
    # Step 2: Process AI request
    ai_response = await call_ai_model(message.content)
    
    # Step 3: Log token usage
    await log_token_usage(
        server_id=guild_id,
        prompt_tokens=ai_response.usage.prompt_tokens,
        completion_tokens=ai_response.usage.completion_tokens,
        feature="discord_chat",
        discord_user_id=str(message.author.id),
        channel_name=message.channel.name,
        model=ai_response.model,
        provider="openai"  # or "anthropic", "google", etc.
    )
    
    # Step 4: Reply to user
    await message.reply(ai_response.content)
```

---

## 2. Log Token Usage (After AI Response)

### Request

```http
POST /functions/v1/log-server-token-usage
Host: sohyviltwgpuslbjzqzh.supabase.co
Content-Type: application/json
x-bot-secret: {DISCORD_BOT_SYNC_SECRET}

{
  "server_id": "123456789012345678",
  "prompt_tokens": 150,
  "completion_tokens": 350,
  "feature": "discord_chat",
  "discord_user_id": "987654321098765432",
  "channel_name": "general",
  "model": "gpt-4o",
  "provider": "openai",
  "metadata": {
    "message_id": "1234567890123456789"
  }
}
```

### Request Body Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `server_id` | string | ✅ | Discord guild ID |
| `prompt_tokens` | integer | ✅ | Input tokens used |
| `completion_tokens` | integer | ✅ | Output tokens generated |
| `feature` | string | ✅ | Feature identifier (e.g., `discord_chat`, `dashboard_chat`) |
| `discord_user_id` | string | ❌ | Discord user who triggered the request |
| `channel_name` | string | ❌ | Channel where interaction occurred |
| `model` | string | ❌ | LLM model name (e.g., `gpt-4o`, `claude-3-sonnet`) |
| `provider` | string | ❌ | Provider name (e.g., `openai`, `anthropic`, `google`) |
| `metadata` | object | ❌ | Additional context (message_id, etc.) |
| `idempotency_key` | string | ❌ | Unique key to prevent duplicate logging |

### Response (200 OK)

```json
{
  "success": true,
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "tokens_used": 15500,
  "tokens_remaining": 44500,
  "credits_remaining": 222,
  "tokens_granted": 60000,
  "credits_granted": 300
}
```

### Error Response (402 Payment Required)

If the server is at limit when logging usage:

```json
{
  "success": false,
  "error": "Insufficient tokens",
  "tokens_remaining": 0,
  "credits_remaining": 0,
  "tokens_requested": 500,
  "tokens_granted": 60000
}
```

---

## 3. Feature Identifiers

Use these standard feature identifiers for the `feature` field:

| Feature | Description |
|---------|-------------|
| `discord_chat` | Regular Discord message responses |
| `discord_slash_command` | Slash command interactions |
| `discord_thread` | Thread-based conversations |
| `dashboard_chat` | Chat from the web dashboard |
| `kb_query` | Knowledge base queries |

---

## 4. Error Handling

### HTTP Status Codes

| Status | Meaning | Action |
|--------|---------|--------|
| 200 | Success | Proceed normally |
| 400 | Bad Request | Check request format |
| 401 | Unauthorized | Check `x-bot-secret` header |
| 402 | Payment Required | Server at limit, show upgrade message |
| 500 | Server Error | Retry with backoff |

### Retry Strategy

```python
async def check_token_status_with_retry(guild_id, max_retries=3):
    for attempt in range(max_retries):
        try:
            response = await check_token_status(guild_id)
            return response
        except Exception as e:
            if attempt == max_retries - 1:
                # On final failure, fail-open (allow the request)
                # The log-server-token-usage call will catch over-limit
                return {"at_limit": False, "tokens_remaining": 999999}
            await asyncio.sleep(2 ** attempt)  # Exponential backoff
```

---

## 5. Idempotency

To prevent duplicate token logging (e.g., on retries), use the `idempotency_key` field:

```python
idempotency_key = f"{guild_id}-{message_id}-{timestamp}"

await log_token_usage(
    server_id=guild_id,
    prompt_tokens=150,
    completion_tokens=350,
    feature="discord_chat",
    idempotency_key=idempotency_key
)
```

If the same `idempotency_key` is sent twice, the second request returns success without double-counting tokens.

---

## 6. Example Python Implementation

```python
import aiohttp
from datetime import datetime

SUPABASE_URL = "https://sohyviltwgpuslbjzqzh.supabase.co"
BOT_SECRET = os.environ["DISCORD_BOT_SYNC_SECRET"]

async def check_token_status(guild_id: str) -> dict:
    """Check if server has available AI credits."""
    async with aiohttp.ClientSession() as session:
        url = f"{SUPABASE_URL}/functions/v1/get-server-token-status"
        headers = {"x-bot-secret": BOT_SECRET}
        params = {"server_id": guild_id}
        
        async with session.get(url, headers=headers, params=params) as resp:
            if resp.status == 200:
                return await resp.json()
            else:
                error = await resp.text()
                raise Exception(f"Token status check failed: {error}")


async def log_token_usage(
    server_id: str,
    prompt_tokens: int,
    completion_tokens: int,
    feature: str,
    discord_user_id: str = None,
    channel_name: str = None,
    model: str = None,
    provider: str = None,
    metadata: dict = None,
    idempotency_key: str = None
) -> dict:
    """Log token usage after AI response."""
    async with aiohttp.ClientSession() as session:
        url = f"{SUPABASE_URL}/functions/v1/log-server-token-usage"
        headers = {
            "x-bot-secret": BOT_SECRET,
            "Content-Type": "application/json"
        }
        body = {
            "server_id": server_id,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "feature": feature,
        }
        
        if discord_user_id:
            body["discord_user_id"] = discord_user_id
        if channel_name:
            body["channel_name"] = channel_name
        if model:
            body["model"] = model
        if provider:
            body["provider"] = provider
        if metadata:
            body["metadata"] = metadata
        if idempotency_key:
            body["idempotency_key"] = idempotency_key
        
        async with session.post(url, headers=headers, json=body) as resp:
            data = await resp.json()
            if resp.status == 200:
                return data
            elif resp.status == 402:
                raise InsufficientCreditsError(data)
            else:
                raise Exception(f"Token logging failed: {data}")


class InsufficientCreditsError(Exception):
    def __init__(self, data):
        self.tokens_remaining = data.get("tokens_remaining", 0)
        self.credits_remaining = data.get("credits_remaining", 0)
        super().__init__("Server has insufficient AI credits")
```

---

## 7. Friendly Limit Messages

### At Limit (No Credits Remaining)

```
⚠️ This server has used all its AI credits for this month.

The server owner can upgrade to Premium for more credits, or wait until **February 1, 2026** for the monthly reset.

🔗 Upgrade: https://gravilo.lovable.app/pricing
```

### Low Credits Warning (Optional)

```
📊 This server is running low on AI credits ({credits_remaining} remaining).

The server owner can upgrade to Premium for 10x more credits.
```

---

## 8. Dashboard Integration

The web dashboard at `gravilo.lovable.app` uses the same endpoints with JWT authentication instead of `x-bot-secret`. The `ServerTokenDisplay` component shows:

- Progress bar with remaining credits
- Color coding (green/yellow/red)
- Reset date
- Rollover credits info
- Upgrade CTA for free servers

Both bot and dashboard share the same token pool per server.
