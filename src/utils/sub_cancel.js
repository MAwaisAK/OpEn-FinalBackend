// src/cron/subscriptionUpdater.js
import cron     from 'node-cron';
import mongoose from 'mongoose';
import Stripe   from 'stripe';
import User     from '../models/user';
import Payment  from '../models/payment';
import Price    from '../models/price';
import dotenv   from 'dotenv';
dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function checkSubscriptions() {
  console.log('⏱ Reconciliation pass at', new Date().toISOString());

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI);
  }

  const priceDoc = await Price.findOne();
  if (!priceDoc) {
    console.error('⚠️  Missing Price config');
    return;
  }

  const now = new Date();
  const due = await User.find({
    stripeSubscriptionId: { $exists: true, $ne: null },
    nextBillingDate:      { $lte: now }
  });

  console.log(`🔍 ${due.length} user(s) due for billing`);

  for (let user of due) {
    console.log(`\n— User ${user._id} (trial_used=${user.trial_used}) —`);

    try {
      const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
      console.log('  Stripe status:', sub.status);

      if (sub.status !== 'active' && sub.status !== 'trialing') {
        console.log('  🔴 subscription ended at Stripe, cancelling locally');
        user.subscription    = 'none';
        user.nextBillingDate = null;
        user.downgrade       = true;
        await user.save();
        continue;
      }

      // Determine plan key
      let planKey = user.subscription;
      if (user.downgrade && planKey === 'premium') {
        planKey = 'basic';
        user.subscription = 'basic';
        user.downgrade    = false;
        console.log('   ↘ Downgraded this cycle → basic');
      }

      const bucket = priceDoc[planKey][ user.period === 'year' ? 'perYear' : 'perMonth' ];

      // Create and pay invoice
      const invoice = await stripe.invoices.create({
        customer:     sub.customer,
        subscription: sub.id,
        auto_advance: true
      });
      console.log('   → Invoice created', invoice.id);

      try {
        const paidInvoice = await stripe.invoices.pay(invoice.id);

        if (paidInvoice.status === 'paid') {
          console.log('   ✔️ Invoice paid');

          // Award tokens and record payment
          user.tokens += bucket.tokens;
          user.status  = 'active';
          if (!user.trial_used) user.trial_used = true;

          await Payment.create({
            user:                 user._id,
            data:                 planKey,
            paymentid:            `P-${Date.now()}`,
            payment:              bucket.price,
            discount:             null,
            discountValue:        0,
            tokens:               bucket.tokens,
            status:               'paid',
            period:               user.period,
            stripeSubscriptionId: sub.id
          });

          console.log(`   ➕ Awarded ${bucket.tokens} tokens (total: ${user.tokens})`);
          user.nextBillingDate = new Date(Date.now() + 5 * 60 * 1000);
          await user.save();
          console.log('   🔜 Next billing in 5 min');

        } else {
          throw new Error(`Invoice status is "${paidInvoice.status}", not "paid"`);
        }

      } catch (err) {
        console.error('   ❌ Payment failed:', err.message);
        console.log('   🔴 cancelling user locally');
        user.subscription    = 'none';
        user.nextBillingDate = null;
        user.downgrade       = true;
        await user.save();

        await Payment.findOneAndUpdate(
          { stripeSubscriptionId: sub.id, status: { $in: ['paid','trialing'] } },
          { status: 'cancelled' }
        );
        continue;
      }

    } catch (err) {
      console.error('  ⚠️  Unexpected error:', err.message);
    }
  }

  console.log('\n🏁 Reconciliation pass complete\n');
}

cron.schedule('0 0 * * *', () => {
  checkSubscriptions().catch(console.error);
}, {
  timezone: 'America/Toronto'
});

// Run once at startup
checkSubscriptions().catch(console.error);
