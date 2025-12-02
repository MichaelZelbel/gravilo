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

| Product ID | Name | Type | Description |
|------------|------|------|-------------|
| `prod_TX0pMjxOeHYC3p` | **Gravilo Premium** | Service | Premium plan with unlimited servers, 3,000 messages/month, custom personality, knowledge base uploads, and analytics dashboard |
| `prod_TX0qbQtNsiUEwZ` | Business Plan | Service | For agencies & teams. 10 brands tracked, API access, white-label reports, team collaboration, client management, dedicated support. |
| `prod_TX0qX4T3tK40ZT` | Pro Plan | Service | For professionals & consultants. 3 brands tracked, daily analysis updates, full competitor visibility, AI optimization tips. |
| `prod_TX0qOI3M2YPRlX` | Cherishly Pro | Service | Unlock AI chats with Claire, email notifications, full Moments Log, and advanced details to deepen your relationships. |

### Prices

| Price ID | Product | Amount | Currency | Type | Interval |
|----------|---------|--------|----------|------|----------|
| `price_1SZwoBAiLddHHjhkaOKsbtvJ` | **Gravilo Premium** (`prod_TX0pMjxOeHYC3p`) | $14.99 | USD | Recurring | Monthly |
| `price_1SZwoUAiLddHHjhk3wf35XB0` | Business Plan (`prod_TX0qbQtNsiUEwZ`) | $99.00 | USD | Recurring | Monthly |
| `price_1SZwofAiLddHHjhkXLy2geu7` | Pro Plan (`prod_TX0qX4T3tK40ZT`) | $29.00 | USD | Recurring | Monthly |
| `price_1SZwopAiLddHHjhkoO1z5Bjx` | Cherishly Pro (`prod_TX0qOI3M2YPRlX`) | $4.99 | USD | Recurring | Monthly |

### Webhooks

*None configured* - Add test webhook endpoint for local development

---

## Gravilo-Specific Configuration

### Live Mode
- **Product ID:** `prod_TWlmtCgj7ZHDAZ`
- **Price ID:** `price_1SZiF5AiLddHHjhkm32oqSVI`

### Test Mode
- **Product ID:** `prod_TX0pMjxOeHYC3p`
- **Price ID:** `price_1SZwoBAiLddHHjhkaOKsbtvJ`

### Webhook Security
- Filters by `metadata.app === "gravilo"`
- Verifies price matches Gravilo Premium price ID

---

## Secrets Required

| Secret Name | Purpose | Live Value | Test Value |
|-------------|---------|------------|------------|
| `STRIPE_SECRET_KEY` | API authentication | `sk_live_...` | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification | From live webhook | From test webhook |

---

## Notes

- Test mode now mirrors live mode with all 4 products
- Remember to update `STRIPE_SECRET_KEY` in Supabase secrets when switching modes
- For testing, also add a test webhook endpoint in Stripe Dashboard
