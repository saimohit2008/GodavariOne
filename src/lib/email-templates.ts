// Godavari One — Automated Email Templates & Localization Engine
// Production-grade bilingual (EN/TE) email templates for all 7 lifecycle events.
// Enforces HTML escaping on all dynamic fields to eliminate HTML injection.

export type EmailEventType =
  | "BOOKING_SUCCESSFUL"
  | "BOOKING_CANCELLED"
  | "BOOKING_APPROVED"
  | "BOOKING_REJECTED"
  | "BOOKING_RESCHEDULED"
  | "BOOKING_REMINDER_24H"
  | "BOOKING_REMINDER_2H"
  | "GHAT_CLOSURE"
  | "GHAT_REOPENED";

export type EmailLanguage = "en" | "te";
export type EmailTemplateEvent = EmailEventType;

export interface BookingEmailPayload {
  customerName?: string;
  bookingReference?: string;
  category?: string;
  serviceName?: string;
  bookingDate?: string;
  bookingTime?: string;
  checkOutDate?: string;
  locationAddress?: string;
  location?: string;
  participantsOrRooms?: string | number;
  status?: string;
  bookingStatus?: string;
  eventType?: string;
  cancellationPolicy?: string;
  cancellationReason?: string;
  cancellationTimestamp?: string;
  rejectionReason?: string;
  rejectionDate?: string;
  previousDate?: string;
  previousTime?: string;
  newDate?: string;
  newTime?: string;
  rescheduleReason?: string;
  qrPassToken?: string;
  qrPassUrl?: string;
  ghatName?: string;
  closureEffectiveTime?: string;
  closureReason?: string;
  alternativeGhats?: string[];
  officialInstructions?: string;
  emergencyPhone?: string;
  emergencyHelpline?: string;
  supportEmail?: string;
  supportPhone?: string;
  myBookingsUrl?: string;
  paymentStatus?: string;
  amount?: number;
  currency?: string;
  [key: string]: any;
}

export function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function getCategoryBadgeLabel(category?: string, lang: EmailLanguage = "en"): string {
  const c = (category || "").toUpperCase();
  if (lang === "te") {
    switch (c) {
      case "HOTEL": return "హోటల్ & వసతి";
      case "RESTAURANT": return "రెస్టారెంట్ & భోజనం";
      case "CEREMONY": return "వేద క్రతువు / పూజ";
      case "GHAT_PRIORITY": return "పుష్కర ఘాట్ ప్రాధాన్యత పాస్";
      case "FREE_ACCOMMODATION": return "ఉచిత వసతి / సత్రం";
      case "NRI_PACKAGE": return "ఎన్ఆర్ఐ యాత్ర ప్యాకేజీ";
      default: return category || "సాధారణ సేవ";
    }
  }
  switch (c) {
    case "HOTEL": return "Hotel Accommodation";
    case "RESTAURANT": return "Dining & Table Reservation";
    case "CEREMONY": return "Vedic Ceremony & Ritual";
    case "GHAT_PRIORITY": return "Ghat Priority Pass (Senior/PwD)";
    case "FREE_ACCOMMODATION": return "Free Satram Accommodation";
    case "NRI_PACKAGE": return "NRI Pilgrimage Package";
    default: return category || "General Service";
  }
}

function getBaseEmailLayout(opts: {
  lang: EmailLanguage;
  preheader: string;
  headerTitle: string;
  headerSubtitle: string;
  headerColor?: string;
  contentHtml: string;
  appBaseUrl: string;
  supportPhone?: string;
  supportEmail?: string;
}): string {
  const bgHeader = opts.headerColor || "linear-gradient(135deg, #0f766e 0%, #0d9488 100%)";
  const supportPhone = opts.supportPhone || "+91 883 2468000";
  const supportEmail = opts.supportEmail || "support@godavari.one";

  const footerText = opts.lang === "te"
    ? `గోదావరి వన్ డిజిటల్ ప్లాట్‌ఫారమ్ · గోదావరి పుష్కరాలు 2027<br>సహాయం కోసం సంప్రదించండి: <a href="mailto:${supportEmail}" style="color:#0f766e;">${supportEmail}</a> | హెల్ప్‌లైన్: <strong>${supportPhone}</strong>`
    : `Godavari One Digital Platform · Godavari Pushkaralu 2027<br>Need assistance? Contact <a href="mailto:${supportEmail}" style="color:#0f766e;">${supportEmail}</a> | Helpline: <strong>${supportPhone}</strong>`;

  return `<!DOCTYPE html>
<html lang="${opts.lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(opts.headerTitle)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b; line-height: 1.5;">
  <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">
    ${escapeHtml(opts.preheader)}
  </div>

  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <!-- Brand Header -->
    <tr>
      <td style="padding: 28px 32px; text-align: center; background: ${bgHeader}; color: #ffffff;">
        <h1 style="margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px; color: #ffffff;">Godavari One</h1>
        <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.95; letter-spacing: 0.5px; text-transform: uppercase; color: #f8fafc;">
          ${escapeHtml(opts.headerSubtitle)}
        </p>
      </td>
    </tr>

    <!-- Content Body -->
    <tr>
      <td style="padding: 32px 32px 24px;">
        ${opts.contentHtml}
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #64748b;">
        ${footerText}
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// 1. BOOKING SUCCESSFUL TEMPLATE
// ---------------------------------------------------------------------------
export function renderBookingSuccessful(data: BookingEmailPayload, lang: EmailLanguage, appBaseUrl: string) {
  const isTe = lang === "te";
  const myBookingsUrl = data.myBookingsUrl || `${appBaseUrl}/bookings`;
  const categoryBadge = getCategoryBadgeLabel(data.category, lang);

  const subject = isTe
    ? `బుకింగ్ ధృవీకరించబడింది: ${data.serviceName} (${data.bookingReference}) — గోదావరి వన్`
    : `Booking Confirmed: ${data.serviceName} (${data.bookingReference}) — Godavari One`;

  const preheader = isTe
    ? `మీ బుకింగ్ రెఫరెన్స్ ${data.bookingReference} విజయవంతంగా నమోదైంది.`
    : `Your booking for ${data.serviceName} has been confirmed. Reference: ${data.bookingReference}.`;

  const qrSection = data.qrPassToken
    ? `
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
        <p style="margin: 0 0 6px; font-weight: 600; color: #166534; font-size: 14px;">
          ${isTe ? "🎫 డిజిటల్ ఎంట్రీ పాస్ / QR టోకెన్" : "🎫 Verified Entry Pass / QR Token"}
        </p>
        <p style="margin: 0 0 10px; font-family: monospace; font-size: 16px; font-weight: 700; color: #15803d; letter-spacing: 1px;">
          ${escapeHtml(data.qrPassToken)}
        </p>
        <a href="${escapeHtml(data.qrPassUrl || `${appBaseUrl}/priority-pass/${data.bookingReference}`)}" style="display: inline-block; background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600;">
          ${isTe ? "పాస్ చూడండి / డౌన్‌లోడ్ చేయండి" : "View / Download QR Pass"}
        </a>
      </div>
    `
    : "";

  const paymentText = data.paymentStatus === "PAID"
    ? (isTe ? "చెల్లింపు స్థితి: ధృవీకరించబడింది (చెల్లించబడింది)" : "Payment Status: Verified (Paid)")
    : (isTe ? "చెల్లింపు: ఆన్‌లైన్ ముందస్తు చెల్లింపు లేదు (వేదిక వద్ద వర్తిస్తుంది లేదా ఉచిత సేవ)" : "Payment: No advance payment collected online (Pay at venue or free service)");

  const contentHtml = `
    <h2 style="font-size: 20px; font-weight: 700; margin: 0 0 12px; color: #0f172a;">
      ${isTe ? `నమస్కారం ${escapeHtml(data.customerName)},` : `Hello ${escapeHtml(data.customerName)},`}
    </h2>
    <p style="font-size: 15px; color: #334155; margin: 0 0 20px;">
      ${isTe
        ? `గోదావరి వన్ ద్వారా మీ <strong>${escapeHtml(data.serviceName)}</strong> బుకింగ్ విజయవంతంగా నిర్ధారించబడింది. వివరాలు క్రింద ఇవ్వబడ్డాయి:`
        : `Your booking for <strong>${escapeHtml(data.serviceName)}</strong> on Godavari One has been confirmed. Below are your booking details:`}
    </p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 16px 0;">
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="6" style="font-size: 14px; color: #334155;">
        <tr>
          <td style="font-weight: 600; width: 40%; color: #64748b;">${isTe ? "బుకింగ్ రెఫరెన్స్:" : "Booking Reference:"}</td>
          <td style="font-weight: 700; color: #0f766e; font-family: monospace;">${escapeHtml(data.bookingReference)}</td>
        </tr>
        <tr>
          <td style="font-weight: 600; color: #64748b;">${isTe ? "విభాగం:" : "Category:"}</td>
          <td><span style="background-color: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">${escapeHtml(categoryBadge)}</span></td>
        </tr>
        <tr>
          <td style="font-weight: 600; color: #64748b;">${isTe ? "తేదీ / సమయం:" : "Date & Time:"}</td>
          <td style="font-weight: 600;">${escapeHtml(data.bookingDate)}${data.bookingTime ? ` (${escapeHtml(data.bookingTime)})` : ""}${data.checkOutDate ? ` → ${escapeHtml(data.checkOutDate)}` : ""}</td>
        </tr>
        <tr>
          <td style="font-weight: 600; color: #64748b;">${isTe ? "స్థల చిరునామా:" : "Location & Address:"}</td>
          <td>${escapeHtml(data.locationAddress)}</td>
        </tr>
        ${data.participantsOrRooms ? `
        <tr>
          <td style="font-weight: 600; color: #64748b;">${isTe ? "గదులు / యాత్రికులు:" : "Guests / Rooms:"}</td>
          <td>${escapeHtml(data.participantsOrRooms)}</td>
        </tr>
        ` : ""}
        <tr>
          <td style="font-weight: 600; color: #64748b;">${isTe ? "స్థితి:" : "Current Status:"}</td>
          <td><span style="background-color: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 700;">${escapeHtml(data.status)}</span></td>
        </tr>
        <tr>
          <td style="font-weight: 600; color: #64748b;">${isTe ? "చెల్లింపు గమనిక:" : "Payment Notice:"}</td>
          <td style="font-size: 12px; color: #64748b;">${escapeHtml(paymentText)}</td>
        </tr>
      </table>
    </div>

    ${qrSection}

    <div style="margin: 24px 0 20px; text-align: center;">
      <a href="${escapeHtml(myBookingsUrl)}" style="background-color: #0f766e; color: #ffffff; text-decoration: none; font-weight: 600; padding: 12px 24px; border-radius: 8px; display: inline-block; font-size: 14px;">
        ${isTe ? "నా బుకింగ్స్ వీక్షించండి" : "View in My Bookings"}
      </a>
    </div>

    <div style="background-color: #f1f5f9; border-radius: 6px; padding: 12px; font-size: 12px; color: #475569;">
      <strong>${isTe ? "రద్దు విధానం & మార్గదర్శకాలు:" : "Cancellation Instructions:"}</strong><br>
      ${isTe
        ? "మీరు ప్లాన్ మార్చుకోవాలనుకుంటే, మీ బుకింగ్స్ పేజీ నుండి నేరుగా రద్దు చేసుకోవచ్చు. దయచేసి ఇతర యాత్రికుల సౌకర్యార్థం సకాలంలో తెలియజేయండి."
        : (data.cancellationPolicy || "You can manage or cancel your reservation via your My Bookings dashboard at any time prior to the scheduled slot.")}
    </div>
  `;

  const html = getBaseEmailLayout({
    lang,
    preheader,
    headerTitle: subject,
    headerSubtitle: isTe ? "బుకింగ్ ధృవీకరణ" : "Booking Confirmation",
    contentHtml,
    appBaseUrl,
    supportEmail: data.supportEmail,
    supportPhone: data.supportPhone,
  });

  const text = `${isTe ? "నమస్కారం" : "Hello"} ${data.customerName},

${isTe ? "మీ బుకింగ్ ధృవీకరించబడింది:" : "Your booking is confirmed:"}
- Reference: ${data.bookingReference}
- Service: ${data.serviceName} (${categoryBadge})
- Date: ${data.bookingDate} ${data.bookingTime || ""} ${data.checkOutDate ? `to ${data.checkOutDate}` : ""}
- Address: ${data.locationAddress}
- Status: ${data.status}
${data.participantsOrRooms ? `- Guests/Rooms: ${data.participantsOrRooms}\n` : ""}${data.qrPassToken ? `- QR Pass Token: ${data.qrPassToken}\n` : ""}
Manage booking: ${myBookingsUrl}

— Godavari One Team`;

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// 2. BOOKING CANCELLED TEMPLATE
// ---------------------------------------------------------------------------
export function renderBookingCancelled(data: BookingEmailPayload, lang: EmailLanguage, appBaseUrl: string) {
  const isTe = lang === "te";
  const subject = isTe
    ? `బుకింగ్ రద్దు చేయబడింది: ${data.serviceName} (${data.bookingReference}) — గోదావరి వన్`
    : `Booking Cancelled: ${data.serviceName} (${data.bookingReference}) — Godavari One`;

  const preheader = isTe
    ? `మీ బుకింగ్ ${data.bookingReference} రద్దు నిర్ధారణ.`
    : `Confirmation of cancellation for booking ${data.bookingReference}.`;

  const refundText = data.paymentStatus === "REFUNDED"
    ? (isTe ? "రీఫండ్ స్థితి: ప్రాసెస్ చేయబడింది" : "Refund Status: Refund Processed")
    : (isTe ? "రీఫండ్ స్థితి: ఆన్‌లైన్ చెల్లింపు వర్తించదు / ఉచిత సేవ" : "Refund Status: No online transaction to refund / Free service");

  const contentHtml = `
    <h2 style="font-size: 20px; font-weight: 700; margin: 0 0 12px; color: #991b1b;">
      ${isTe ? "బుకింగ్ రద్దు నిర్ధారణ" : "Booking Cancellation Confirmation"}
    </h2>
    <p style="font-size: 15px; color: #334155; margin: 0 0 16px;">
      ${isTe
        ? `నమస్కారం <strong>${escapeHtml(data.customerName)}</strong>, మీ అభ్యర్థన మేరకు క్రింది బుకింగ్ రద్దు చేయబడింది:`
        : `Hello <strong>${escapeHtml(data.customerName)}</strong>, your booking has been successfully cancelled as requested:`}
    </p>

    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 18px; margin: 16px 0;">
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="6" style="font-size: 14px; color: #334155;">
        <tr>
          <td style="font-weight: 600; width: 40%; color: #7f1d1d;">${isTe ? "బుకింగ్ రెఫరెన్స్:" : "Booking ID:"}</td>
          <td style="font-weight: 700; font-family: monospace;">${escapeHtml(data.bookingReference)}</td>
        </tr>
        <tr>
          <td style="font-weight: 600; color: #7f1d1d;">${isTe ? "సేవ పేరు:" : "Service Name:"}</td>
          <td style="font-weight: 600;">${escapeHtml(data.serviceName)}</td>
        </tr>
        <tr>
          <td style="font-weight: 600; color: #7f1d1d;">${isTe ? "షెడ్యూల్ తేదీ:" : "Original Schedule:"}</td>
          <td>${escapeHtml(data.bookingDate)}${data.bookingTime ? ` (${escapeHtml(data.bookingTime)})` : ""}</td>
        </tr>
        <tr>
          <td style="font-weight: 600; color: #7f1d1d;">${isTe ? "రద్దు సమయం:" : "Cancellation Time:"}</td>
          <td>${escapeHtml(data.cancellationTimestamp || new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }))}</td>
        </tr>
        <tr>
          <td style="font-weight: 600; color: #7f1d1d;">${isTe ? "రద్దు కారణం:" : "Cancellation Reason:"}</td>
          <td>${escapeHtml(data.cancellationReason || (isTe ? "యాత్రికుని అభ్యర్థన మేరకు" : "Requested by user/administrator"))}</td>
        </tr>
        <tr>
          <td style="font-weight: 600; color: #7f1d1d;">${isTe ? "రీఫండ్ సమాచారం:" : "Refund Status:"}</td>
          <td style="font-size: 13px; color: #475569;">${escapeHtml(refundText)}</td>
        </tr>
      </table>
    </div>

    <p style="font-size: 14px; color: #475569; margin: 20px 0;">
      ${isTe
        ? "మీరు భవిష్యత్తులో ఏదైనా ఇతర సేవను బుక్ చేసుకోవడానికి గోదావరి వన్ పోర్టల్‌ను ఉపయోగించవచ్చు. మీకు ఏవైనా సందేహాలుంటే మా హెల్ప్‌లైన్‌ను సంప్రదించండి."
        : "You may explore and book alternative services at any time on Godavari One. If this cancellation was unintentional, please contact our support team immediately."}
    </p>

    <div style="margin: 20px 0; text-align: center;">
      <a href="${escapeHtml(appBaseUrl)}" style="background-color: #0f766e; color: #ffffff; text-decoration: none; font-weight: 600; padding: 10px 20px; border-radius: 6px; display: inline-block; font-size: 14px;">
        ${isTe ? "గోదావరి వన్ హోమ్‌పేజీ" : "Explore Godavari One"}
      </a>
    </div>
  `;

  const html = getBaseEmailLayout({
    lang,
    preheader,
    headerTitle: subject,
    headerSubtitle: isTe ? "రద్దు నిర్ధారణ" : "Cancellation Confirmation",
    headerColor: "linear-gradient(135deg, #991b1b 0%, #b91c1c 100%)",
    contentHtml,
    appBaseUrl,
  });

  const text = `${isTe ? "నమస్కారం" : "Hello"} ${data.customerName},
${isTe ? "మీ బుకింగ్ రద్దు చేయబడింది:" : "Your booking has been cancelled:"}
- Reference: ${data.bookingReference}
- Service: ${data.serviceName}
- Original Date: ${data.bookingDate} ${data.bookingTime || ""}
- Reason: ${data.cancellationReason || "User/Admin requested"}
- Refund Status: ${refundText}

— Godavari One Team`;

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// 3. BOOKING APPROVED TEMPLATE
// ---------------------------------------------------------------------------
export function renderBookingApproved(data: BookingEmailPayload, lang: EmailLanguage, appBaseUrl: string) {
  const isTe = lang === "te";
  const categoryBadge = getCategoryBadgeLabel(data.category, lang);
  const myBookingsUrl = data.myBookingsUrl || `${appBaseUrl}/bookings`;

  const subject = isTe
    ? `అధికారిక ఆమోదం: ${data.serviceName} (${data.bookingReference}) — గోదావరి వన్`
    : `Booking Approved: ${data.serviceName} (${data.bookingReference}) — Godavari One`;

  const preheader = isTe
    ? `మీ బుకింగ్ ${data.bookingReference} నిర్వాహకులచే ఆమోదించబడింది.`
    : `Your booking request for ${data.serviceName} has been officially approved.`;

  const qrSection = data.qrPassToken
    ? `
      <div style="background-color: #ecfdf5; border: 2px solid #059669; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
        <p style="margin: 0 0 6px; font-weight: 700; color: #065f46; font-size: 15px;">
          ${isTe ? "🎫 ప్రవేశ ద్వారం వద్ద చూపించవలసిన QR పాస్ టోకెన్" : "🎫 Entry Verification QR Pass Token"}
        </p>
        <span style="font-family: monospace; font-size: 20px; font-weight: 800; color: #064e3b; letter-spacing: 2px;">
          ${escapeHtml(data.qrPassToken)}
        </span>
        <div style="margin-top: 10px;">
          <a href="${escapeHtml(data.qrPassUrl || `${appBaseUrl}/priority-pass/${data.bookingReference}`)}" style="background-color: #059669; color: #ffffff; text-decoration: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; display: inline-block;">
            ${isTe ? "డిజిటల్ పాస్ డౌన్‌లోడ్ చేసుకోండి" : "Download Official Pass"}
          </a>
        </div>
      </div>
    `
    : "";

  const contentHtml = `
    <h2 style="font-size: 20px; font-weight: 700; margin: 0 0 12px; color: #15803d;">
      ${isTe ? "బుకింగ్ అధికారికంగా ఆమోదించబడింది!" : "Booking Request Approved!"}
    </h2>
    <p style="font-size: 15px; color: #334155; margin: 0 0 16px;">
      ${isTe
        ? `నమస్కారం <strong>${escapeHtml(data.customerName)}</strong>, మీ <strong>${escapeHtml(data.serviceName)}</strong> అభ్యర్థన సమీక్షించబడి, అధికారికంగా ఆమోదించబడింది.`
        : `Hello <strong>${escapeHtml(data.customerName)}</strong>, your booking request for <strong>${escapeHtml(data.serviceName)}</strong> has been verified and approved by the authorities.`}
    </p>

    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 18px; margin: 16px 0;">
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="6" style="font-size: 14px; color: #334155;">
        <tr>
          <td style="font-weight: 600; width: 40%; color: #166534;">${isTe ? "బుకింగ్ రెఫరెన్స్:" : "Booking Reference:"}</td>
          <td style="font-weight: 700; font-family: monospace; color: #0f766e;">${escapeHtml(data.bookingReference)}</td>
        </tr>
        <tr>
          <td style="font-weight: 600; color: #166534;">${isTe ? "విభాగం:" : "Category:"}</td>
          <td><span style="background-color: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">${escapeHtml(categoryBadge)}</span></td>
        </tr>
        <tr>
          <td style="font-weight: 600; color: #166534;">${isTe ? "ఆమోదిత సమయం:" : "Approved Schedule:"}</td>
          <td style="font-weight: 700; color: #166534;">${escapeHtml(data.bookingDate)}${data.bookingTime ? ` (${escapeHtml(data.bookingTime)})` : ""}</td>
        </tr>
        <tr>
          <td style="font-weight: 600; color: #166534;">${isTe ? "వేదిక / చిరునామా:" : "Venue / Location:"}</td>
          <td>${escapeHtml(data.locationAddress)}</td>
        </tr>
        <tr>
          <td style="font-weight: 600; color: #166534;">${isTe ? "స్థితి:" : "Status:"}</td>
          <td><span style="background-color: #bbf7d0; color: #14532d; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 800;">APPROVED / CONFIRMED</span></td>
        </tr>
      </table>
    </div>

    ${qrSection}

    <div style="background-color: #f8fafc; border-left: 4px solid #0f766e; padding: 12px 16px; margin: 20px 0; font-size: 13px; color: #334155;">
      <strong>${isTe ? "ప్రవేశ మార్గదర్శకాలు:" : "Entry & Participation Instructions:"}</strong><br>
      ${isTe
        ? "• దయచేసి నిర్దేశిత సమయానికి కనీసం 15 నిమిషాల ముందుగా వేదిక వద్దకు చేరుకోండి.<br>• ఒరిజినల్ ఆధార్ కార్డు లేదా ప్రభుత్వ గుర్తింపు కార్డు తప్పనిసరిగా వెంట ఉంచుకోండి.<br>• ప్రవేశ ద్వారం వద్ద డిజిటల్ లేదా ప్రింటెడ్ పాస్ చూపించండి."
        : "• Please arrive at the venue at least 15 minutes before your allotted time.<br>• Carry an original government-issued photo ID (Aadhaar, Voter ID, Passport).<br>• Present this approval email or your QR pass at the entrance checkpoint."}
    </div>

    <div style="margin: 24px 0 16px; text-align: center;">
      <a href="${escapeHtml(myBookingsUrl)}" style="background-color: #0f766e; color: #ffffff; text-decoration: none; font-weight: 600; padding: 12px 24px; border-radius: 8px; display: inline-block; font-size: 14px;">
        ${isTe ? "నా బుకింగ్స్ వీక్షించండి" : "View in My Bookings"}
      </a>
    </div>
  `;

  const html = getBaseEmailLayout({
    lang,
    preheader,
    headerTitle: subject,
    headerSubtitle: isTe ? "ఆమోద నిర్ధారణ" : "Official Approval Notification",
    contentHtml,
    appBaseUrl,
  });

  const text = `${isTe ? "నమస్కారం" : "Hello"} ${data.customerName},
${isTe ? "మీ బుకింగ్ ఆమోదించబడింది:" : "Your booking is APPROVED:"}
- Reference: ${data.bookingReference}
- Service: ${data.serviceName}
- Schedule: ${data.bookingDate} ${data.bookingTime || ""}
- Address: ${data.locationAddress}
${data.qrPassToken ? `- Pass Token: ${data.qrPassToken}\n` : ""}
Instructions: Arrive 15 minutes before time with government photo ID.

— Godavari One Team`;

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// 4. BOOKING REJECTED TEMPLATE
// ---------------------------------------------------------------------------
export function renderBookingRejected(data: BookingEmailPayload, lang: EmailLanguage, appBaseUrl: string) {
  const isTe = lang === "te";
  const subject = isTe
    ? `బుకింగ్ అభ్యర్థన స్థితి: ${data.serviceName} (${data.bookingReference}) — గోదావరి వన్`
    : `Booking Request Update: ${data.serviceName} (${data.bookingReference}) — Godavari One`;

  const preheader = isTe
    ? `మీ బుకింగ్ అభ్యర్థన ${data.bookingReference} వివరాలపై ముఖ్యమైన సమాచారం.`
    : `Important update regarding your booking request ${data.bookingReference}.`;

  const reason = data.rejectionReason || (isTe ? "పరిపాలనా / లభ్యత కారణాల వల్ల అభ్యర్థన ఆమోదించబడలేదు." : "Request could not be accommodated due to capacity or scheduling constraints.");

  const contentHtml = `
    <h2 style="font-size: 20px; font-weight: 700; margin: 0 0 12px; color: #b45309;">
      ${isTe ? "బుకింగ్ అభ్యర్థన ఆమోదించబడలేదు" : "Booking Request Not Approved"}
    </h2>
    <p style="font-size: 15px; color: #334155; margin: 0 0 16px;">
      ${isTe
        ? `నమస్కారం <strong>${escapeHtml(data.customerName)}</strong>, మీ <strong>${escapeHtml(data.serviceName)}</strong> అభ్యర్థనను అధికారులు పరిశీలించారు. క్రింది కారణం వల్ల ప్రస్తుతానికి ఇది ఆమోదించబడలేదు:`
        : `Hello <strong>${escapeHtml(data.customerName)}</strong>, we regret to inform you that your booking request for <strong>${escapeHtml(data.serviceName)}</strong> could not be approved by the management:`}
    </p>

    <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 18px; margin: 16px 0;">
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="6" style="font-size: 14px; color: #334155;">
        <tr>
          <td style="font-weight: 600; width: 40%; color: #92400e;">${isTe ? "బుకింగ్ రెఫరెన్స్:" : "Booking Reference:"}</td>
          <td style="font-weight: 700; font-family: monospace;">${escapeHtml(data.bookingReference)}</td>
        </tr>
        <tr>
          <td style="font-weight: 600; color: #92400e;">${isTe ? "సేవ పేరు:" : "Service Name:"}</td>
          <td style="font-weight: 600;">${escapeHtml(data.serviceName)}</td>
        </tr>
        <tr>
          <td style="font-weight: 600; color: #92400e;">${isTe ? "నిర్ణయ తేదీ:" : "Decision Date:"}</td>
          <td>${escapeHtml(data.rejectionDate || new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }))}</td>
        </tr>
        <tr>
          <td style="font-weight: 600; color: #92400e;">${isTe ? "అధికారిక కారణం:" : "Recorded Reason:"}</td>
          <td style="font-weight: 600; color: #b45309;">${escapeHtml(reason)}</td>
        </tr>
      </table>
    </div>

    <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 13px; color: #475569;">
      <strong>${isTe ? "తదుపరి సహాయం & ప్రత్యామ్నాయాలు:" : "Next Steps & Support:"}</strong><br>
      ${isTe
        ? "మీరు వేరొక తేదీ లేదా ప్రత్యామ్నాయ సేవను ఎంచుకోవడానికి గోదావరి వన్ పోర్టల్‌ను ఉపయోగించవచ్చు. ఏవైనా సందేహాలుంటే మా సపోర్ట్ బృందానికి తెలియజేయండి."
        : "You may submit a new request with an alternative date, timeslot, or partner provider on Godavari One. No charges were levied for this request."}
    </div>

    <div style="margin: 20px 0; text-align: center;">
      <a href="${escapeHtml(appBaseUrl)}" style="background-color: #0f766e; color: #ffffff; text-decoration: none; font-weight: 600; padding: 10px 20px; border-radius: 6px; display: inline-block; font-size: 14px;">
        ${isTe ? "ప్రత్యామ్నాయ సేవలను చూడండి" : "Explore Alternative Options"}
      </a>
    </div>
  `;

  const html = getBaseEmailLayout({
    lang,
    preheader,
    headerTitle: subject,
    headerSubtitle: isTe ? "అభ్యర్థన నవీకరణ" : "Booking Status Update",
    headerColor: "linear-gradient(135deg, #b45309 0%, #d97706 100%)",
    contentHtml,
    appBaseUrl,
  });

  const text = `${isTe ? "నమస్కారం" : "Hello"} ${data.customerName},
${isTe ? "మీ బుకింగ్ అభ్యర్థన ఆమోదించబడలేదు:" : "Your booking request could not be approved:"}
- Reference: ${data.bookingReference}
- Service: ${data.serviceName}
- Reason: ${reason}
- Date: ${data.rejectionDate || new Date().toISOString()}

Please visit Godavari One to explore alternative dates or providers.
— Godavari One Team`;

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// 5. BOOKING RESCHEDULED TEMPLATE
// ---------------------------------------------------------------------------
export function renderBookingRescheduled(data: BookingEmailPayload, lang: EmailLanguage, appBaseUrl: string) {
  const isTe = lang === "te";
  const myBookingsUrl = data.myBookingsUrl || `${appBaseUrl}/bookings`;

  const subject = isTe
    ? `బుకింగ్ రీషెడ్యూల్ చేయబడింది: ${data.serviceName} (${data.bookingReference}) — గోదావరి వన్`
    : `Booking Rescheduled: ${data.serviceName} (${data.bookingReference}) — Godavari One`;

  const preheader = isTe
    ? `మీ బుకింగ్ ${data.bookingReference} కొత్త సమయం ఖరారైంది.`
    : `Your booking ${data.bookingReference} has been rescheduled to a new date/time.`;

  const contentHtml = `
    <h2 style="font-size: 20px; font-weight: 700; margin: 0 0 12px; color: #0284c7;">
      ${isTe ? "షెడ్యూల్ మార్పు నిర్ధారణ" : "Schedule Change Confirmation"}
    </h2>
    <p style="font-size: 15px; color: #334155; margin: 0 0 16px;">
      ${isTe
        ? `నమస్కారం <strong>${escapeHtml(data.customerName)}</strong>, మీ <strong>${escapeHtml(data.serviceName)}</strong> బుకింగ్ విజయవంతంగా రీషెడ్యూల్ చేయబడింది. పాత మరియు కొత్త వివరాలు క్రింద ఇవ్వబడ్డాయి:`
        : `Hello <strong>${escapeHtml(data.customerName)}</strong>, your booking for <strong>${escapeHtml(data.serviceName)}</strong> has been successfully rescheduled. Please note your updated timing details:`}
    </p>

    <!-- Prominent Schedule Comparison Table -->
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 20px 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      <tr style="background-color: #f1f5f9; text-align: left;">
        <th style="padding: 12px 16px; font-size: 13px; color: #64748b; font-weight: 700;">${isTe ? "వివరణ" : "Details"}</th>
        <th style="padding: 12px 16px; font-size: 13px; color: #991b1b; font-weight: 700;">${isTe ? "మునుపటి షెడ్యూల్" : "Previous Schedule"}</th>
        <th style="padding: 12px 16px; font-size: 13px; color: #166534; font-weight: 700;">${isTe ? "కొత్త షెడ్యూల్ (ధృవీకరించబడింది)" : "New Schedule (Confirmed)"}</th>
      </tr>
      <tr style="border-top: 1px solid #e2e8f0;">
        <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #334155;">${isTe ? "తేదీ:" : "Date:"}</td>
        <td style="padding: 12px 16px; font-size: 14px; color: #991b1b; text-decoration: line-through;">${escapeHtml(data.previousDate || data.bookingDate)}</td>
        <td style="padding: 12px 16px; font-size: 14px; font-weight: 700; color: #166534; background-color: #f0fdf4;">${escapeHtml(data.newDate || data.bookingDate)}</td>
      </tr>
      <tr style="border-top: 1px solid #e2e8f0;">
        <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #334155;">${isTe ? "సమయం / స్లాట్:" : "Time / Slot:"}</td>
        <td style="padding: 12px 16px; font-size: 14px; color: #991b1b; text-decoration: line-through;">${escapeHtml(data.previousTime || "—")}</td>
        <td style="padding: 12px 16px; font-size: 14px; font-weight: 700; color: #166534; background-color: #f0fdf4;">${escapeHtml(data.newTime || data.bookingTime || "—")}</td>
      </tr>
    </table>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 16px 0; font-size: 13px; color: #334155;">
      <strong>${isTe ? "బుకింగ్ రెఫరెన్స్:" : "Booking Reference:"}</strong> <span style="font-family: monospace; font-weight: 700; color: #0f766e;">${escapeHtml(data.bookingReference)}</span><br>
      <strong>${isTe ? "చిరునామా:" : "Location:"}</strong> ${escapeHtml(data.locationAddress)}<br>
      ${data.rescheduleReason ? `<strong>${isTe ? "మార్పు కారణం:" : "Reason for Adjustment:"}</strong> ${escapeHtml(data.rescheduleReason)}` : ""}
    </div>

    <div style="margin: 24px 0 16px; text-align: center;">
      <a href="${escapeHtml(myBookingsUrl)}" style="background-color: #0f766e; color: #ffffff; text-decoration: none; font-weight: 600; padding: 12px 24px; border-radius: 8px; display: inline-block; font-size: 14px;">
        ${isTe ? "నవీకరించబడిన బుకింగ్ చూడండి" : "View Updated Booking"}
      </a>
    </div>
  `;

  const html = getBaseEmailLayout({
    lang,
    preheader,
    headerTitle: subject,
    headerSubtitle: isTe ? "షెడ్యూల్ మార్పు" : "Schedule Update",
    headerColor: "linear-gradient(135deg, #0369a1 0%, #0284c7 100%)",
    contentHtml,
    appBaseUrl,
  });

  const text = `${isTe ? "నమస్కారం" : "Hello"} ${data.customerName},
${isTe ? "మీ బుకింగ్ విజయవంతంగా రీషెడ్యూల్ చేయబడింది:" : "Your booking has been rescheduled:"}
- Reference: ${data.bookingReference}
- Service: ${data.serviceName}
- Previous: ${data.previousDate || data.bookingDate} (${data.previousTime || ""})
- New: ${data.newDate || data.bookingDate} (${data.newTime || data.bookingTime || ""})
- Address: ${data.locationAddress}
${data.rescheduleReason ? `- Reason: ${data.rescheduleReason}\n` : ""}
Manage booking: ${myBookingsUrl}
— Godavari One Team`;

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// 6. BOOKING REMINDER TEMPLATE (24H / 2H)
// ---------------------------------------------------------------------------
export function renderBookingReminder(data: BookingEmailPayload, windowType: "24H" | "2H", lang: EmailLanguage, appBaseUrl: string) {
  const isTe = lang === "te";
  const myBookingsUrl = data.myBookingsUrl || `${appBaseUrl}/bookings`;
  const windowLabel = windowType === "24H"
    ? (isTe ? "రేపు (24 గంటల్లో)" : "Tomorrow (in 24 hours)")
    : (isTe ? "త్వరలో (2 గంటల్లో)" : "Soon (in 2 hours)");

  const subject = isTe
    ? `రిమైండర్: మీ బుకింగ్ ${windowLabel} ఉంది — ${data.serviceName}`
    : `Upcoming Booking Reminder (${windowType === "24H" ? "24 Hours" : "2 Hours"}): ${data.serviceName} — Godavari One`;

  const preheader = isTe
    ? `మీ బుకింగ్ ${data.bookingReference} సమయం సమీపిస్తోంది.`
    : `Reminder: Your reservation for ${data.serviceName} is coming up soon.`;

  const contentHtml = `
    <h2 style="font-size: 20px; font-weight: 700; margin: 0 0 12px; color: #0f766e;">
      ${isTe ? `రాబోయే బుకింగ్ రిమైండర్ · ${escapeHtml(windowLabel)}` : `Upcoming Booking Reminder · ${escapeHtml(windowLabel)}`}
    </h2>
    <p style="font-size: 15px; color: #334155; margin: 0 0 16px;">
      ${isTe
        ? `నమస్కారం <strong>${escapeHtml(data.customerName)}</strong>, మీ <strong>${escapeHtml(data.serviceName)}</strong> బుకింగ్ సమయం సమీపిస్తోంది. దయచేసి క్రింది వివరాలను గమనించండి:`
        : `Hello <strong>${escapeHtml(data.customerName)}</strong>, this is a friendly reminder for your upcoming booking with <strong>${escapeHtml(data.serviceName)}</strong>:`}
    </p>

    <div style="background-color: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 18px; margin: 16px 0;">
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="6" style="font-size: 14px; color: #334155;">
        <tr>
          <td style="font-weight: 600; width: 40%; color: #0f766e;">${isTe ? "బుకింగ్ రెఫరెన్స్:" : "Booking Reference:"}</td>
          <td style="font-weight: 700; font-family: monospace; color: #0f766e;">${escapeHtml(data.bookingReference)}</td>
        </tr>
        <tr>
          <td style="font-weight: 600; color: #0f766e;">${isTe ? "తేదీ & సమయం (IST):" : "Date & Time (Asia/Kolkata):"}</td>
          <td style="font-weight: 700; color: #0f172a;">${escapeHtml(data.bookingDate)}${data.bookingTime ? ` at ${escapeHtml(data.bookingTime)}` : ""}</td>
        </tr>
        <tr>
          <td style="font-weight: 600; color: #0f766e;">${isTe ? "స్థల చిరునామా:" : "Location & Address:"}</td>
          <td>${escapeHtml(data.locationAddress)}</td>
        </tr>
      </table>
    </div>

    ${data.qrPassToken ? `
      <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 14px; margin: 16px 0; text-align: center;">
        <span style="font-size: 13px; font-weight: 600; color: #065f46;">${isTe ? "మీ ఎంట్రీ పాస్ టోకెన్:" : "Your Entry Pass Token:"}</span>
        <span style="font-family: monospace; font-size: 18px; font-weight: 700; color: #047857; margin-left: 8px;">${escapeHtml(data.qrPassToken)}</span>
      </div>
    ` : ""}

    <div style="background-color: #f8fafc; border-radius: 6px; padding: 12px; margin: 16px 0; font-size: 13px; color: #475569;">
      <strong>${isTe ? "ముఖ్యమైన సూచనలు:" : "Checklist for your visit:"}</strong><br>
      ${isTe
        ? "• ట్రాఫిక్ రద్దీని దృష్టిలో ఉంచుకుని కనీసం 20 నిమిషాల ముందుగా బయలుదేరండి.<br>• ప్రభుత్వ గుర్తింపు కార్డు వెంట ఉంచుకోండి.<br>• అత్యవసర సహాయం కోసం గోదావరి వన్ హెల్ప్‌లైన్‌ను సంప్రదించండి."
        : "• Please plan to arrive 15-20 minutes ahead to account for Pushkaralu festival transit.<br>• Carry a valid photo ID card.<br>• Keep your digital pass ready on your mobile device."}
    </div>

    <div style="margin: 24px 0 16px; text-align: center;">
      <a href="${escapeHtml(myBookingsUrl)}" style="background-color: #0f766e; color: #ffffff; text-decoration: none; font-weight: 600; padding: 12px 24px; border-radius: 8px; display: inline-block; font-size: 14px;">
        ${isTe ? "పాస్ & వివరాలు చూడండి" : "View Pass & Details"}
      </a>
    </div>
  `;

  const html = getBaseEmailLayout({
    lang,
    preheader,
    headerTitle: subject,
    headerSubtitle: isTe ? "రాబోయే బుకింగ్ రిమైండర్" : "Upcoming Booking Reminder",
    contentHtml,
    appBaseUrl,
  });

  const text = `${isTe ? "నమస్కారం" : "Hello"} ${data.customerName},
${isTe ? `రిమైండర్: మీ బుకింగ్ ${windowLabel} ఉంది:` : `Reminder: Your booking is in ${windowLabel}:`}
- Reference: ${data.bookingReference}
- Service: ${data.serviceName}
- Date: ${data.bookingDate} ${data.bookingTime || ""}
- Address: ${data.locationAddress}
${data.qrPassToken ? `- Pass Token: ${data.qrPassToken}\n` : ""}
Manage booking: ${myBookingsUrl}
— Godavari One Team`;

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// 7. GHAT CLOSURE TEMPLATE (URGENT SAFETY)
// ---------------------------------------------------------------------------
export function renderGhatClosure(data: BookingEmailPayload, lang: EmailLanguage, appBaseUrl: string) {
  const isTe = lang === "te";
  const myBookingsUrl = data.myBookingsUrl || `${appBaseUrl}/bookings`;
  const ghatName = data.ghatName || data.serviceName || "Ghat";

  const subject = isTe
    ? `🚨 అత్యవసర గమనిక: ${ghatName} తాత్కాలికంగా మూసివేయబడింది — గోదావరి వన్`
    : `🚨 URGENT NOTICE: Temporary Closure of ${ghatName} — Godavari One`;

  const preheader = isTe
    ? `ముఖ్యమైన భద్రతా హెచ్చరిక: ${ghatName} తాత్కాలికంగా మూసివేయబడింది. మీ బుకింగ్ వివరాలు చూడండి.`
    : `Official Safety Notice: ${ghatName} has been temporarily closed. Important details regarding your booking.`;

  const alternativesHtml = data.alternativeGhats && data.alternativeGhats.length > 0
    ? `
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px; margin: 16px 0;">
        <strong style="color: #166534; font-size: 13px;">${isTe ? "సిఫార్సు చేయబడిన ప్రత్యామ్నాయ పుష్కర ఘాట్లు:" : "Recommended Alternative Ghats (Verified Open):"}</strong>
        <ul style="margin: 8px 0 0; padding-left: 20px; font-size: 13px; color: #166534;">
          ${data.alternativeGhats.map((g) => `<li>${escapeHtml(g)}</li>`).join("")}
        </ul>
      </div>
    `
    : "";

  const emergencyPhone = data.emergencyPhone || "108 / +91 883 2468000";

  const contentHtml = `
    <!-- High-Impact Red Safety Header -->
    <div style="background-color: #fef2f2; border: 2px solid #ef4444; border-radius: 8px; padding: 16px; margin: 0 0 20px; text-align: center;">
      <h2 style="font-size: 20px; font-weight: 800; color: #991b1b; margin: 0 0 6px;">
        ${isTe ? `🚨 అధికారిక భద్రతా ప్రకటన: ${escapeHtml(ghatName)} మూసివేయబడింది` : `🚨 Official Safety Notice: ${escapeHtml(ghatName)} Temporarily Closed`}
      </h2>
      <p style="font-size: 13px; color: #7f1d1d; margin: 0; font-weight: 600;">
        ${isTe ? "భద్రతా కారణాల దృష్ట్యా పరిపాలన విభాగం ఈ ఘాట్‌ను తాత్కాలికంగా మూసివేసింది" : "Declared officially CLOSED by District Administration & Ghat Supervisors"}
      </p>
    </div>

    <p style="font-size: 15px; color: #334155; margin: 0 0 16px;">
      ${isTe
        ? `నమస్కారం <strong>${escapeHtml(data.customerName)}</strong>, <strong>${escapeHtml(ghatName)}</strong> వద్ద మీ రాబోయే షెడ్యూల్డ్ సందర్శనకు సంబంధించి ఈ అత్యవసర సమాచారం పంపబడుతోంది:`
        : `Hello <strong>${escapeHtml(data.customerName)}</strong>, this is an urgent safety notification regarding your scheduled visit to <strong>${escapeHtml(ghatName)}</strong>:`}
    </p>

    <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 18px; margin: 16px 0;">
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="6" style="font-size: 14px; color: #334155;">
        <tr>
          <td style="font-weight: 600; width: 40%; color: #9f1239;">${isTe ? "బాధిత బుకింగ్ రెఫరెన్స్:" : "Affected Booking ID:"}</td>
          <td style="font-weight: 700; font-family: monospace; color: #881337;">${escapeHtml(data.bookingReference)}</td>
        </tr>
        <tr>
          <td style="font-weight: 600; color: #9f1239;">${isTe ? "మీ అసలు షెడ్యూల్:" : "Original Schedule:"}</td>
          <td style="font-weight: 600;">${escapeHtml(data.bookingDate)}${data.bookingTime ? ` (${escapeHtml(data.bookingTime)})` : ""}</td>
        </tr>
        <tr>
          <td style="font-weight: 600; color: #9f1239;">${isTe ? "మూసివేత ప్రారంభ సమయం:" : "Closure Effective:"}</td>
          <td style="color: #9f1239; font-weight: 700;">${escapeHtml(data.closureEffectiveTime || new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }))}</td>
        </tr>
        <tr>
          <td style="font-weight: 600; color: #9f1239;">${isTe ? "అధికారిక కారణం:" : "Official Reason:"}</td>
          <td style="font-weight: 600; color: #9f1239;">${escapeHtml(data.closureReason || (isTe ? "నదీ ప్రవాహం / నీటి మట్టం హెచ్చరిక లేదా నిర్వహణ పనులు" : "River safety protocol, water level advisory, or infrastructure maintenance"))}</td>
        </tr>
      </table>
    </div>

    ${data.officialInstructions ? `
      <div style="background-color: #fefce8; border-left: 4px solid #ca8a04; padding: 12px 16px; margin: 16px 0; font-size: 13px; color: #713f12;">
        <strong>${isTe ? "అధికారుల ఆదేశాలు & భద్రతా సూచనలు:" : "Official Instructions & Safety Directives:"}</strong><br>
        ${escapeHtml(data.officialInstructions)}
      </div>
    ` : ""}

    ${alternativesHtml}

    <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 13px; color: #334155;">
      <strong>${isTe ? "రీషెడ్యూల్ & రద్దు సమాచారం:" : "Rescheduling & Support:"}</strong><br>
      ${isTe
        ? "మీ బుకింగ్ ఆటోమేటిక్‌గా రద్దు చేయబడదు. మీరు మీ బుకింగ్స్ పేజీ నుండి ఘాట్ తిరిగి తెరిచిన తర్వాత ఉచితంగా రీషెడ్యూల్ చేసుకోవచ్చు లేదా వేరొక ఘాట్‌ను ఎంచుకోవచ్చు."
        : "Your booking pass remains secure. An administrator can assign you to an alternative available slot, or you may reschedule/cancel via your My Bookings dashboard without penalty."}
    </div>

    <div style="margin: 20px 0; text-align: center;">
      <a href="${escapeHtml(myBookingsUrl)}" style="background-color: #991b1b; color: #ffffff; text-decoration: none; font-weight: 700; padding: 12px 24px; border-radius: 8px; display: inline-block; font-size: 14px;">
        ${isTe ? "నా బుకింగ్ నిర్వహించండి" : "Manage / Reschedule My Booking"}
      </a>
    </div>

    <div style="text-align: center; font-size: 12px; color: #dc2626; margin-top: 10px;">
      🚨 ${isTe ? "అత్యవసర పుష్కరాల హెల్ప్‌లైన్:" : "Emergency Pushkaralu Helpline:"} <strong>${escapeHtml(emergencyPhone)}</strong>
    </div>
  `;

  const html = getBaseEmailLayout({
    lang,
    preheader,
    headerTitle: subject,
    headerSubtitle: isTe ? "అత్యవసర భద్రతా గమనిక" : "Urgent Public Safety Notice",
    headerColor: "linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)",
    contentHtml,
    appBaseUrl,
  });

  const text = `🚨 URGENT PUBLIC SAFETY NOTICE — GODAVARI ONE 🚨

${isTe ? `ఘాట్ మూసివేత గమనిక: ${ghatName}` : `Ghat Closure Notice: ${ghatName}`}
- Booking ID: ${data.bookingReference}
- Original Schedule: ${data.bookingDate} ${data.bookingTime || ""}
- Reason: ${data.closureReason || "River safety protocol"}
${data.officialInstructions ? `- Instructions: ${data.officialInstructions}\n` : ""}${data.alternativeGhats ? `- Alternatives: ${data.alternativeGhats.join(", ")}\n` : ""}
Emergency Helpline: ${emergencyPhone}
Manage your booking: ${myBookingsUrl}

— Godavari One Team`;

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// 8. GHAT REOPENED TEMPLATE
// ---------------------------------------------------------------------------
export function renderGhatReopened(data: BookingEmailPayload, lang: EmailLanguage, appBaseUrl: string) {
  const isTe = lang === "te";
  const myBookingsUrl = data.myBookingsUrl || `${appBaseUrl}/bookings`;
  const ghatName = data.ghatName || data.serviceName || "Ghat";

  const subject = isTe
    ? `✅ ఘాట్ తిరిగి తెరవబడింది: ${ghatName} — గోదావరి వన్`
    : `✅ Ghat Reopened: ${ghatName} is Now Open — Godavari One`;

  const preheader = isTe
    ? `${ghatName} తిరిగి యాత్రికుల కోసం తెరవబడింది.`
    : `${ghatName} has officially reopened for pilgrimage and sacred bathing.`;

  const contentHtml = `
    <h2 style="font-size: 20px; font-weight: 700; margin: 0 0 12px; color: #15803d;">
      ${isTe ? `✅ ${escapeHtml(ghatName)} తిరిగి తెరవబడింది!` : `✅ ${escapeHtml(ghatName)} is Now Reopened!`}
    </h2>
    <p style="font-size: 15px; color: #334155; margin: 0 0 16px;">
      ${isTe
        ? `నమస్కారం <strong>${escapeHtml(data.customerName)}</strong>, గతంలో తాత్కాలికంగా మూసివేయబడిన <strong>${escapeHtml(ghatName)}</strong> తిరిగి యాత్రికుల రాక కోసం సాధారణ కార్యకలాపాలను ప్రారంభించింది.`
        : `Hello <strong>${escapeHtml(data.customerName)}</strong>, we are pleased to inform you that <strong>${escapeHtml(ghatName)}</strong> has resumed normal operations following inspection by the authorities.`}
    </p>

    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 18px; margin: 16px 0;">
      <p style="margin: 0 0 8px; font-size: 14px; color: #166534; font-weight: 600;">
        ${isTe ? "మీ బుకింగ్ పునరుద్ధరణ సమాచారం:" : "Booking & Slot Resumption:"}
      </p>
      <p style="margin: 0; font-size: 13px; color: #334155;">
        ${isTe
          ? `మీ బుకింగ్ రెఫరెన్స్: <strong>${escapeHtml(data.bookingReference)}</strong>. మీరు మీ స్లాట్‌ను ఖరారు చేసుకోవడానికి లేదా కొత్త సమయాన్ని ఎంచుకోవడానికి మీ ఖాతాలో లాగిన్ అవ్వండి.`
          : `For booking <strong>${escapeHtml(data.bookingReference)}</strong>, you may confirm your original slot or choose a new time slot via your account dashboard.`}
      </p>
    </div>

    <div style="margin: 24px 0 16px; text-align: center;">
      <a href="${escapeHtml(myBookingsUrl)}" style="background-color: #0f766e; color: #ffffff; text-decoration: none; font-weight: 600; padding: 12px 24px; border-radius: 8px; display: inline-block; font-size: 14px;">
        ${isTe ? "నా బుకింగ్స్ తెరవండి" : "View My Bookings"}
      </a>
    </div>
  `;

  const html = getBaseEmailLayout({
    lang,
    preheader,
    headerTitle: subject,
    headerSubtitle: isTe ? "పునఃప్రారంభ ప్రకటన" : "Ghat Reopening Notice",
    headerColor: "linear-gradient(135deg, #15803d 0%, #16a34a 100%)",
    contentHtml,
    appBaseUrl,
  });

  const text = `${isTe ? "నమస్కారం" : "Hello"} ${data.customerName},
${ghatName} has reopened for pilgrimage.
Reference: ${data.bookingReference}
Manage your booking: ${myBookingsUrl}
— Godavari One Team`;

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// MASTER DISPATCHER
// ---------------------------------------------------------------------------
export function renderEmail(
  eventType: EmailEventType,
  payload: BookingEmailPayload,
  lang: EmailLanguage = "en",
  appBaseUrl = "http://localhost:3000"
): { subject: string; html: string; text: string } {
  switch (eventType) {
    case "BOOKING_SUCCESSFUL":
      return renderBookingSuccessful(payload, lang, appBaseUrl);
    case "BOOKING_CANCELLED":
      return renderBookingCancelled(payload, lang, appBaseUrl);
    case "BOOKING_APPROVED":
      return renderBookingApproved(payload, lang, appBaseUrl);
    case "BOOKING_REJECTED":
      return renderBookingRejected(payload, lang, appBaseUrl);
    case "BOOKING_RESCHEDULED":
      return renderBookingRescheduled(payload, lang, appBaseUrl);
    case "BOOKING_REMINDER_24H":
      return renderBookingReminder(payload, "24H", lang, appBaseUrl);
    case "BOOKING_REMINDER_2H":
      return renderBookingReminder(payload, "2H", lang, appBaseUrl);
    case "GHAT_CLOSURE":
      return renderGhatClosure(payload, lang, appBaseUrl);
    case "GHAT_REOPENED":
      return renderGhatReopened(payload, lang, appBaseUrl);
    default:
      throw new Error(`Unsupported email event type: ${eventType}`);
  }
}

export function renderEmailContent(
  first: EmailEventType | EmailLanguage | string,
  second: any,
  third?: any,
  fourth?: any
): { subject: string; html: string; text: string } {
  if (first === "en" || first === "te") {
    const lang = first as EmailLanguage;
    const payload = second || {};
    const eventType = payload.eventType || "BOOKING_SUCCESSFUL";
    return renderEmail(eventType as EmailEventType, payload, lang, third);
  }
  return renderEmail(first as EmailEventType, second, third, fourth);
}
