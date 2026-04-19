export async function onRequestGet() {
  return new Response(
    JSON.stringify({ ok: true, message: "Function is live." }),
    {
      headers: { "Content-Type": "application/json; charset=utf-8" }
    }
  );
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    const contentType = request.headers.get("content-type") || "";
    if (
      !contentType.includes("multipart/form-data") &&
      !contentType.includes("application/x-www-form-urlencoded")
    ) {
      return json(
        { ok: false, error: "Unsupported content type." },
        400
      );
    }

    const formData = await request.formData();

    const honeypot = clean(formData.get("company"));
    const formStart = Number(formData.get("form_start"));
    const now = Date.now();

    if (honeypot) {
      return json({ ok: true }, 200);
    }

    if (formStart && now - formStart < 3000) {
      return json({ ok: true }, 200);
    }

    const firstName = clean(formData.get("first_name"));
    const lastName = clean(formData.get("last_name"));
    const phone = clean(formData.get("phone"));
    const email = clean(formData.get("email"));
    const eventType = clean(formData.get("event_type"));
    const estimatedAttending = clean(formData.get("estimated_attending"));
    const startDate = clean(formData.get("start_date"));
    const startTime = clean(formData.get("start_time"));
    const endDate = clean(formData.get("end_date"));
    const endTime = clean(formData.get("end_time"));
    const message = clean(formData.get("message"));

    if (message.length < 10) {
      return json({ ok: true }, 200);
    }

    const lowerMsg = message.toLowerCase();
    if (lowerMsg.includes("http://") || lowerMsg.includes("https://")) {
      return json({ ok: true }, 200);
    }

    const missing = [];
    if (!firstName) missing.push("first_name");
    if (!lastName) missing.push("last_name");
    if (!phone) missing.push("phone");
    if (!eventType) missing.push("event_type");
    if (!estimatedAttending) missing.push("estimated_attending");
    if (!startDate) missing.push("start_date");
    if (!startTime) missing.push("start_time");
    if (!endDate) missing.push("end_date");
    if (!endTime) missing.push("end_time");
    if (!message) missing.push("message");

    if (missing.length) {
      return json(
        { ok: false, error: "Missing required fields.", missing },
        400
      );
    }

    const basinEndpoint = env.BASIN_ENDPOINT;
    const resendApiKey = env.RESEND_API_KEY;
    const notifyEmails = parseEmailList(env.NOTIFY_EMAILS);
    const fromEmail = clean(env.FROM_EMAIL);
    const confirmationFromEmail = clean(env.CONFIRMATION_FROM_EMAIL || env.FROM_EMAIL);
    const sendConfirmation = String(env.SEND_CONFIRMATION || "false").toLowerCase() === "true";

    if (!basinEndpoint) {
      return json(
        { ok: false, error: "Missing BASIN_ENDPOINT secret." },
        500
      );
    }

    if (!resendApiKey) {
      return json(
        { ok: false, error: "Missing RESEND_API_KEY secret." },
        500
      );
    }

    if (!notifyEmails.length) {
      return json(
        { ok: false, error: "Missing NOTIFY_EMAILS secret." },
        500
      );
    }

    if (!fromEmail) {
      return json(
        { ok: false, error: "Missing FROM_EMAIL secret." },
        500
      );
    }

    const sourceUrl = request.headers.get("origin") || "";
    const cfRay = request.headers.get("cf-ray") || "";

    // 1. Send submission to Basin for storage/logging
    const outbound = new FormData();
    outbound.set("_subject", "New Copper Roost Event Request");
    outbound.set("first_name", firstName);
    outbound.set("last_name", lastName);
    outbound.set("phone", phone);
    outbound.set("email", email);
    outbound.set("event_type", eventType);
    outbound.set("estimated_attending", estimatedAttending);
    outbound.set("start_date", startDate);
    outbound.set("start_time", startTime);
    outbound.set("end_date", endDate);
    outbound.set("end_time", endTime);
    outbound.set("message", message);
    outbound.set("source_url", sourceUrl);
    outbound.set("cf_ray", cfRay);

    const basinResponse = await fetch(basinEndpoint, {
      method: "POST",
      body: outbound
    });

    if (!basinResponse.ok) {
      const basinText = await basinResponse.text();
      return json(
        {
          ok: false,
          error: "Basin rejected the submission.",
          status: basinResponse.status,
          details: basinText.slice(0, 500)
        },
        502
      );
    }

    // 2. Send notification email(s) through Resend
    const notificationSubject = `New Copper Roost Event Request: ${firstName} ${lastName}`;
    const notificationHtml = buildNotificationHtml({
      firstName,
      lastName,
      phone,
      email,
      eventType,
      estimatedAttending,
      startDate,
      startTime,
      endDate,
      endTime,
      message,
      sourceUrl
    });

    const notifyPayload = {
      from: fromEmail,
      to: notifyEmails,
      subject: notificationSubject,
      html: notificationHtml,
      reply_to: email || undefined
    };

    const resendNotifyResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(notifyPayload)
    });

    if (!resendNotifyResponse.ok) {
      const resendText = await resendNotifyResponse.text();
      return json(
        {
          ok: false,
          error: "Notification email failed.",
          status: resendNotifyResponse.status,
          details: resendText.slice(0, 500)
        },
        502
      );
    }

    // 3. Optional confirmation email to submitter
    if (sendConfirmation && email) {
      const confirmationPayload = {
        from: confirmationFromEmail,
        to: [email],
        subject: "We received your Copper Roost event request",
        html: buildConfirmationHtml({
          firstName,
          eventType,
          startDate,
          endDate
        })
      };

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(confirmationPayload)
      });
    }

    return json({ ok: true }, 200);
  } catch (error) {
    return json(
      {
        ok: false,
        error: "Unexpected server error.",
        details: error instanceof Error ? error.message : String(error)
      },
      500
    );
  }
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseEmailList(value) {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function detailRow(label, value) {
  return `
    <tr>
      <td style="padding:12px 14px; border:1px solid #e7dfd2; width:220px; background:#f8f4ed; font-size:13px; font-weight:700; color:#5a4d42; vertical-align:top;">
        ${escapeHtml(label)}
      </td>
      <td style="padding:12px 14px; border:1px solid #e7dfd2; font-size:15px; color:#1f1f1f;">
        ${escapeHtml(value)}
      </td>
    </tr>
  `;
}

function buildNotificationHtml(data) {
  return `
    <div style="margin:0; padding:0; background:#f6f3ee; font-family:Arial, sans-serif; color:#1f1f1f;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; background:#f6f3ee; padding:24px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; max-width:720px; background:#ffffff; border:1px solid #e7dfd2;">
              
              <tr>
                <td style="padding:28px 32px; background:#b8720a; color:#ffffff;">
                  <div style="font-size:12px; letter-spacing:2px; text-transform:uppercase; opacity:0.9;">The Copper Roost</div>
                  <h1 style="margin:10px 0 0; font-size:28px; line-height:1.2; font-weight:700; color:#ffffff;">New Event Request</h1>
                </td>
              </tr>

              <tr>
                <td style="padding:28px 32px 12px;">
                  <p style="margin:0 0 16px; font-size:16px; line-height:1.7; color:#40372f;">
                    A new event request has been submitted through the website.
                  </p>
                </td>
              </tr>

              <tr>
                <td style="padding:0 32px 12px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                    ${detailRow("Name", `${escapeHtml(data.firstName)} ${escapeHtml(data.lastName)}`)}
                    ${detailRow("Phone", data.phone)}
                    ${detailRow("Email", data.email || "Not provided")}
                    ${detailRow("Event Type", data.eventType)}
                    ${detailRow("Estimated Attendance", data.estimatedAttending)}
                    ${detailRow("Start Date", data.startDate)}
                    ${detailRow("Start Time", data.startTime)}
                    ${detailRow("End Date", data.endDate)}
                    ${detailRow("End Time", data.endTime)}
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding:8px 32px 12px;">
                  <div style="font-size:13px; letter-spacing:1.5px; text-transform:uppercase; color:#b8720a; margin-bottom:10px;">
                    Additional Details
                  </div>
                  <div style="padding:16px; border:1px solid #e7dfd2; background:#faf8f4; font-size:15px; line-height:1.7; color:#2f2a25; white-space:pre-wrap;">
${escapeHtml(data.message)}
                  </div>
                </td>
              </tr>

              <tr>
                <td style="padding:8px 32px 28px;">
                  <div style="font-size:12px; color:#7b6e61; line-height:1.6;">
                    Submission source: ${escapeHtml(data.sourceUrl || "Unknown")}
                  </div>
                </td>
              </tr>

              <tr>
                <td style="padding:18px 32px; background:#f3eee7; border-top:1px solid #e7dfd2; font-size:12px; color:#7b6e61;">
                  The Copper Roost event request notification
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

function buildConfirmationHtml(data) {
  return `
    <div style="margin:0; padding:0; background:#f6f3ee; font-family:Arial, sans-serif; color:#1f1f1f;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; background:#f6f3ee; padding:24px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; max-width:720px; background:#ffffff; border:1px solid #e7dfd2;">
              
              <tr>
                <td style="padding:28px 32px; background:#b8720a; color:#ffffff;">
                  <div style="font-size:12px; letter-spacing:2px; text-transform:uppercase; opacity:0.9;">The Copper Roost</div>
                  <h1 style="margin:10px 0 0; font-size:28px; line-height:1.2; font-weight:700; color:#ffffff;">We Received Your Request</h1>
                </td>
              </tr>

              <tr>
                <td style="padding:28px 32px;">
                  <p style="margin:0 0 16px; font-size:16px; line-height:1.7; color:#40372f;">
                    Hi ${escapeHtml(data.firstName)},
                  </p>
                  <p style="margin:0 0 16px; font-size:16px; line-height:1.7; color:#40372f;">
                    We received your event request${data.eventType ? ` for <strong>${escapeHtml(data.eventType)}</strong>` : ""}.
                  </p>
                  <p style="margin:0 0 16px; font-size:16px; line-height:1.7; color:#40372f;">
                    Requested dates: <strong>${escapeHtml(data.startDate)}</strong> to <strong>${escapeHtml(data.endDate)}</strong>
                  </p>
                  <p style="margin:0 0 16px; font-size:16px; line-height:1.7; color:#40372f;">
                    We’ll review the details and be in touch soon.
                  </p>
                  <p style="margin:24px 0 0; font-size:16px; line-height:1.7; color:#40372f;">
                    Thanks,<br>The Copper Roost
                  </p>
                </td>
              </tr>

              <tr>
                <td style="padding:18px 32px; background:#f3eee7; border-top:1px solid #e7dfd2; font-size:12px; color:#7b6e61;">
                  The Copper Roost event request confirmation
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}
