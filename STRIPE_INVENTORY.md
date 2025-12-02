# Stripe Account Inventory

**Account ID:** `acct_1SEYTJAiLddHHjhk`  
**Display Name:** cherishly.ai  
**Mode:** Test (based on `sk_test_` key prefix)

---

## Products

| Product ID | Name | Type | Description |
|------------|------|------|-------------|
| `prod_TWlmtCgj7ZHDAZ` | **Gravilo Premium** | Service | Premium plan with unlimited servers, 3,000 messages/month, custom personality, knowledge base uploads, and analytics dashboard |
| `prod_TNICg8ssfKEw0B` | Business Plan | Service | For agencies & teams. 10 brands tracked, API access, white-label reports, team collaboration, client management, dedicated support. |
| `prod_TNIBGWa81nrBq1` | Pro Plan | Service | For professionals & consultants. 3 brands tracked, daily analysis updates, full competitor visibility, AI optimization tips. |
| `prod_TAzrLJxeEwSpuD` | Cherishly Pro | Service | Unlock AI chats with Claire, email notifications, full Moments Log, and advanced details to deepen your relationships. |

---

## Prices

| Price ID | Product | Amount | Currency | Type | Interval |
|----------|---------|--------|----------|------|----------|
| `price_1SZiF5AiLddHHjhkm32oqSVI` | **Gravilo Premium** (`prod_TWlmtCgj7ZHDAZ`) | $14.99 | USD | Recurring | Monthly |
| `price_1SQXbdAiLddHHjhk53mzMgVg` | Business Plan (`prod_TNICg8ssfKEw0B`) | $99.00 | USD | Recurring | Monthly |
| `price_1SQXbNAiLddHHjhkDHD8mwPx` | Pro Plan (`prod_TNIBGWa81nrBq1`) | $29.00 | USD | Recurring | Monthly |
| `price_1SEdrIAiLddHHjhkSU5RFIjV` | Cherishly Pro (`prod_TAzrLJxeEwSpuD`) | $4.99 | USD | Recurring | Monthly |

---

## Gravilo-Specific Configuration

### Active Price for Gravilo
- **Price ID:** `price_1SZiF5AiLddHHjhkm32oqSVI`
- **Product ID:** `prod_TWlmtCgj7ZHDAZ`
- **Amount:** $14.99/month

### Webhook Endpoint (Configured in Project)
- **URL:** `https://sohyviltwgpuslbjzqzh.supabase.co/functions/v1/stripe-webhook`
- **Events Handled:**
  - `checkout.session.completed` → Upgrades user to premium
  - `customer.subscription.deleted` → Downgrades user to free
- **Security:** Filters by `metadata.app === "gravilo"` and `price_id === "price_1SZiF5AiLddHHjhkm32oqSVI"`

---

## Secrets Configured

| Secret Name | Purpose |
|-------------|---------|
| `STRIPE_SECRET_KEY` | API authentication |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification |

---

## Notes

- All prices are in **test mode** (based on key prefix)
- The Stripe account appears shared across multiple products (Gravilo, Cherishly, unnamed Business/Pro plans)
- Gravilo webhook is scoped to only process its own product via metadata filtering
