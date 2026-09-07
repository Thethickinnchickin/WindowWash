export async function runPaymentsReconciliation(
  _params: { webhookLimit?: number; pendingPaymentLimit?: number } = {},
) {
  void _params;

  return {
    stripeDisabled: true,
    webhooks: {
      processed: 0,
      failed: 0,
    },
    payments: {
      synced: 0,
      failed: 0,
      skipped: 0,
    },
    deadLetterCount: 0,
  };
}
