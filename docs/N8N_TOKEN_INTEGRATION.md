# n8n Token Usage Integration Guide

This guide explains how to integrate AI token tracking into the Gravilo n8n workflows.

## Overview

The Gravilo SaaS tracks AI token usage per Discord server. n8n workflows that call LLM APIs should:

1. Extract actual token usage from LLM responses
2. Call the `log-server-token-usage` endpoint with accurate token counts
3. Return token info for dashboard display

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────────────┐
│  Dashboard  │────▶│ chat-server  │────▶│    n8n      │────▶│ log-server-token-usage│
│   or Bot    │     │ Edge Function│     │  Workflow   │     │    Edge Function       │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────────────────┘
                           │                    │
                           │                    │ (extracts actual token usage)
                           │                    ▼
                           │              ┌───────────┐
                           │              │   LLM API │
                           │              │ (Gemini,  │
                           │              │  OpenAI)  │
                           └──────────────┴───────────┘
```

## n8n Workflow Requirements

### 1. Receive Token Status from chat-server

The chat-server edge function already checks token status before calling n8n. The n8n webhook receives:

```json
{
  "content": "User's question",
  "supabase_user_id": "uuid",
  "channel_name": "dashboard",
  "server_id": "discord_guild_id"
}
```

### 2. Extract Token Usage from LLM Response

Most LLM APIs return token usage in their response. Extract these values:

#### OpenRouter / OpenAI Format
```json
{
  "usage": {
    "prompt_tokens": 150,
    "completion_tokens": 200,
    "total_tokens": 350
  },
  "model": "google/gemini-2.0-flash-exp:free"
}
```

#### Google Gemini Format
```json
{
  "usageMetadata": {
    "promptTokenCount": 150,
    "candidatesTokenCount": 200,
    "totalTokenCount": 350
  }
}
```

### 3. Call log-server-token-usage Endpoint

After receiving the LLM response, call the token logging endpoint:

**Endpoint:** `POST https://sohyviltwgpuslbjzqzh.supabase.co/functions/v1/log-server-token-usage`

**Headers:**
```
Content-Type: application/json
x-bot-secret: ${DISCORD_BOT_SYNC_SECRET}
```

**Request Body:**
```json
{
  "server_id": "discord_guild_id",
  "prompt_tokens": 150,
  "completion_tokens": 200,
  "feature": "discord_chat",
  "model": "google/gemini-2.0-flash-exp:free",
  "provider": "openrouter",
  "discord_user_id": "123456789",
  "channel_name": "#general",
  "idempotency_key": "unique-key-for-this-request",
  "metadata": {
    "message_id": "discord_message_id",
    "workflow_run_id": "n8n_execution_id"
  }
}
```

**Response (Success):**
```json
{
  "success": true,
  "event_id": "uuid",
  "tokens_used": 1500,
  "tokens_remaining": 58500,
  "credits_remaining": 292,
  "tokens_granted": 60000,
  "credits_granted": 300
}
```

**Response (Over Limit - 402):**
```json
{
  "success": false,
  "error": "Insufficient tokens",
  "tokens_remaining": 0,
  "credits_remaining": 0,
  "tokens_requested": 350,
  "tokens_granted": 60000
}
```

### 4. Return Token Info in Response

For dashboard chat, the response to chat-server should include token info:

```json
{
  "output": "Gravilo's response text",
  "token_usage": {
    "prompt_tokens": 150,
    "completion_tokens": 200,
    "credits_remaining": 292,
    "credits_granted": 300
  }
}
```

## n8n Node Configuration Examples

### HTTP Request Node for Token Logging

```
Method: POST
URL: https://sohyviltwgpuslbjzqzh.supabase.co/functions/v1/log-server-token-usage
Headers:
  - Content-Type: application/json
  - x-bot-secret: {{ $credentials.discordBotSecret }}
Body (JSON):
{
  "server_id": "{{ $json.server_id }}",
  "prompt_tokens": {{ $json.usage.prompt_tokens }},
  "completion_tokens": {{ $json.usage.completion_tokens }},
  "feature": "discord_chat",
  "model": "{{ $json.model }}",
  "provider": "openrouter",
  "discord_user_id": "{{ $json.discord_user_id }}",
  "channel_name": "{{ $json.channel_name }}",
  "idempotency_key": "{{ $json.message_id }}-{{ $now.toMillis() }}"
}
```

### Extracting Token Usage from OpenRouter Response

In a Set node after the LLM call:
```javascript
{
  "prompt_tokens": {{ $json.message.response_metadata.tokenUsage.promptTokens }},
  "completion_tokens": {{ $json.message.response_metadata.tokenUsage.completionTokens }},
  "model": "{{ $json.message.response_metadata.model_name }}",
  "output": "{{ $json.message.content }}"
}
```

### Feature Values

Use these feature values for different use cases:

| Feature | Description |
|---------|-------------|
| `discord_chat` | Direct Discord message replies |
| `dashboard_chat` | Chat from web dashboard |
| `kb_query` | Knowledge base queries |
| `proactive_reply` | Bot's proactive messages |
| `moderation` | Moderation checks |
| `admin_adjustment` | Manual admin adjustments |

## Handling Errors

### Token Limit Reached

If the token logging endpoint returns 402 (Payment Required):

1. Don't send the AI response to the user
2. Send a friendly message explaining the limit:
   ```
   ⚠️ This server has used all its AI credits for this month.
   Credits will reset at the beginning of next month.
   Consider upgrading to Premium for more credits!
   ```

### Idempotency

Always include an `idempotency_key` to prevent duplicate charges:
- For Discord: Use message ID
- For dashboard: Use a unique combination of server_id + user_id + timestamp
- The endpoint will return success with "Already processed" note for duplicates

## Token-to-Credit Conversion

Current default: **200 tokens = 1 credit**

This is configurable in `ai_credit_settings` table:
- `tokens_per_credit`: 200
- `tokens_free_per_month`: 60,000 (= 300 credits)
- `tokens_premium_per_month`: 600,000 (= 3,000 credits)

## Testing

You can test the token logging endpoint directly:

```bash
curl -X POST https://sohyviltwgpuslbjzqzh.supabase.co/functions/v1/log-server-token-usage \
  -H "Content-Type: application/json" \
  -H "x-bot-secret: YOUR_BOT_SECRET" \
  -d '{
    "server_id": "1234567890",
    "prompt_tokens": 100,
    "completion_tokens": 50,
    "feature": "test",
    "model": "test-model",
    "provider": "test"
  }'
```

## Integration Checklist

- [ ] Extract actual token counts from LLM response (not estimates)
- [ ] Call `log-server-token-usage` after each LLM call
- [ ] Include proper `idempotency_key` to prevent duplicates
- [ ] Handle 402 responses gracefully (limit reached)
- [ ] Include model and provider info for analytics
- [ ] Return credit info in response for dashboard display
