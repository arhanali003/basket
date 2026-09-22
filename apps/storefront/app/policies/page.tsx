import { Logo } from '@daybasket/ui';
export default function Policies() {
  return (
    <main className="policies">
      <Logo />
      <h1>A little clarity.</h1>
      <p>
        This is a development store. Daybasket, its Bengaluru operating area, contact details and
        business policies are placeholders. Test orders do not trigger a real delivery.
      </p>
      <h2>Delivery & cancellation</h2>
      <p>
        The demo serves an 8 km radius around Indiranagar. Estimated delivery is 30–60 minutes,
        subject to real store capacity. Orders can be cancelled before picking begins. Cancellation
        restores stock and marks test payments as mock-refunded.
      </p>
      <h2>Payments & returns</h2>
      <p>
        Cash on delivery and simulated online payments are available in development. No real online
        payment is collected. Production refund, damaged-goods and return policies must be approved
        by the business before launch.
      </p>
      <h2>Privacy & location</h2>
      <p>
        We ask for location only after you choose to share it. Your order and partner location are
        available to you, the assigned delivery partner, and authorized store staff. Raw GPS samples
        expire after seven days when the maintenance worker is running. Phone numbers are shown only
        to the assigned partner and authorized operations staff.
      </p>
      <h2>Get in touch</h2>
      <p>
        Development placeholder: support@example.invalid · Phone: [REPLACE_SUPPORT_PHONE] · GSTIN:
        [REPLACE_GSTIN]. Replace these with your registered business details before accepting real
        customers.
      </p>
    </main>
  );
}
