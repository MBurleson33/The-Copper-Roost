export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data") && !contentType.includes("application/x-www-form-urlencoded")) {
      return json(
        { ok: false, error: "Unsupported content type." },
        400
      );
    }

    const formData = await request.formData();

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
    if (!basinEndpoint) {
      return json(
        { ok: false, error: "Missing BASIN_ENDPOINT secret." },
        500
      );
    }

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
    outbound.set("source_url", request.headers.get("origin") || "");
    outbound.set("cf_ray", request.headers.get("cf-ray") || "");

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

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}
