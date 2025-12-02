# Stripe Account Inventory

**Account ID:** `acct_1SEYTJAiLddHHjhk`  
**Display Name:** cherishly.ai

---

## Live Mode (Production)

### Products

| Product ID | Name | Type | Description |
|------------|------|------|-------------|
| `prod_TWlmtCgj7ZHDAZ` | **Gravilo Premium** | Service | Premium plan with unlimited servers, 3,000 messages/month, custom personality, knowledge base uploads, and analytics dashboard |
| `prod_TNICg8ssfKEw0B` | Business Plan | Service | For agencies & teams. 10 brands tracked, API access, white-label reports, team collaboration, client management, dedicated support. |
| `prod_TNIBGWa81nrBq1` | Pro Plan | Service | For professionals & consultants. 3 brands tracked, daily analysis updates, full competitor visibility, AI optimization tips. |
| `prod_TAzrLJxeEwSpuD` | Cherishly Pro | Service | Unlock AI chats with Claire, email notifications, full Moments Log, and advanced details to deepen your relationships. |

### Prices

| Price ID | Product | Amount | Currency | Type | Interval |
|----------|---------|--------|----------|------|----------|
| `price_1SZiF5AiLddHHjhkm32oqSVI` | **Gravilo Premium** (`prod_TWlmtCgj7ZHDAZ`) | $14.99 | USD | Recurring | Monthly |
| `price_1SQXbdAiLddHHjhk53mzMgVg` | Business Plan (`prod_TNICg8ssfKEw0B`) | $99.00 | USD | Recurring | Monthly |
| `price_1SQXbNAiLddHHjhkDHD8mwPx` | Pro Plan (`prod_TNIBGWa81nrBq1`) | $29.00 | USD | Recurring | Monthly |
| `price_1SEdrIAiLddHHjhkSU5RFIjV` | Cherishly Pro (`prod_TAzrLJxeEwSpuD`) | $4.99 | USD | Recurring | Monthly |

### Webhooks

| Name | Endpoint URL | Events |
|------|--------------|--------|
| Gravilo | `https://sohyviltwgpuslbjzqzh.supabase.co/functions/v1/stripe-webhook` | `checkout.session.completed`, `customer.subscription.deleted` |

---

## Test Mode

### Products
*None configured*

### Prices
*None configured*

### Webhooks
*None configured*

---

## Gravilo-Specific Configuration

### Active IDs for Gravilo
- **Product ID:** `prod_TWlmtCgj7ZHDAZ`
- **Price ID:** `price_1SZiF5AiLddHHjhkm32oqSVI`
- **Amount:** $14.99/month

### Webhook Security
- Filters by `metadata.app === "gravilo"`
- Verifies `price_id === "price_1SZiF5AiLddHHjhkm32oqSVI"`

---

## Secrets Required

| Secret Name | Purpose | Mode |
|-------------|---------|------|
| `STRIPE_SECRET_KEY` | API authentication (edge functions) | Should be `sk_live_...` for production |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification | From Stripe webhook settings |

---

## Notes

- Test mode is empty - **create test products/prices before testing**
- Stripe account is shared across multiple apps (Gravilo, Cherishly, Business/Pro plans)
- Gravilo webhook filters ensure only Gravilo subscriptions trigger plan updates
