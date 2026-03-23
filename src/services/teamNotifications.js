const MSG91_WHATSAPP_BULK_URL =
  "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/";
const WELCOME_TEMPLATE_NAME = "job_requirement_team_update";
const MATERIAL_PURCHASE_TEMPLATE_NAME = "material_purchase_team_update";
const TEMPLATE_NAMESPACE = "5a483c05_306a_44fb_aaf9_1245be4077e7";

/** Parse TEAM_MEMBERS_NUMBERS (comma/space separated; numbers with country code e.g. 919319455101) */
function getTeamNumbers() {
  const raw = process.env.TEAM_MEMBERS_NUMBERS;
  if (!raw || !raw.trim()) return [];
  return raw
    .split(/[\s,]+/)
    .map((n) => n.trim().replace(/^\+/, ""))
    .filter(Boolean);
}

/**
 * Send WhatsApp template to team (TEAM_MEMBERS_NUMBERS) for new labour requirement.
 * One bulk request with to_and_components; to = list of numbers from env.
 */
export async function notifyTeamForLabourRequirement(
  jobId,
  name,
  date,
  location,
  jobType = "",
  buttonUrl = null
) {
  const authkey = process.env.MSG91_AUTH_KEY;
  const integratedNumber = process.env.MSG91_WHATSAPP_INTEGRATED_NUMBER || "15557129540";
  const toList = getTeamNumbers();

  if (!authkey) {
    console.warn("notifyTeamForLabourRequirement: MSG91_AUTH_KEY not set");
    return false;
  }
  if (toList.length === 0) {
    console.warn("notifyTeamForLabourRequirement: No team numbers in TEAM_MEMBERS_NUMBERS");
    return false;
  }

  const urlText = buttonUrl || "https://admin.innovkarigar.com/labour/jobs/" + jobId;

  const payload = {
    integrated_number: integratedNumber,
    content_type: "template",
    payload: {
      messaging_product: "whatsapp",
      type: "template",
      template: {
        name: WELCOME_TEMPLATE_NAME,
        language: { code: "en", policy: "deterministic" },
        namespace: TEMPLATE_NAMESPACE,
        to_and_components: [
          {
            to: toList,
            components: {
              body_name: {
                type: "text",
                value: String(name || ""),
                parameter_name: "name",
              },
              body_jobtype: {
                type: "text",
                value: String(jobType || ""),
                parameter_name: "jobtype",
              },
              body_date: {
                type: "text",
                value: String(date || ""),
                parameter_name: "date",
              },
              body_locatio: {
                type: "text",
                value: String(location || ""),
                parameter_name: "locatio",
              },
              button_1: {
                subtype: "url",
                type: "text",
                value: urlText,
              },
            },
          },
        ],
      },
    },
  };

  try {
    const response = await fetch(MSG91_WHATSAPP_BULK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("notifyTeamForLabourRequirement MSG91 error:", response.status, data);
      return false;
    }
    return true;
  } catch (err) {
    console.error("notifyTeamForLabourRequirement:", err);
    return false;
  }
}

export async function notifyTeamForNoLabourApplied(jobId, name, date, location) {
  // TODO: implement when template/flow is defined
}

/**
 * Send WhatsApp template to team for material purchase request.
 * One bulk request with to_and_components; to = list of numbers from env.
 */
export async function notifyTeamForMaterialPurchaseRequest(orderId, buttonUrl = null) {
  const authkey = process.env.MSG91_AUTH_KEY;
  const integratedNumber = process.env.MSG91_WHATSAPP_INTEGRATED_NUMBER || "15557129540";
  const toList = getTeamNumbers();

  if (!authkey) {
    console.warn("notifyTeamForMaterialPurchaseRequest: MSG91_AUTH_KEY not set");
    return false;
  }
  if (toList.length === 0) {
    console.warn("notifyTeamForMaterialPurchaseRequest: No team numbers in TEAM_MEMBERS_NUMBERS");
    return false;
  }

  const urlText = buttonUrl || "https://admin.innovkarigar.com/labour/jobs";

  const payload = {
    integrated_number: integratedNumber,
    content_type: "template",
    payload: {
      messaging_product: "whatsapp",
      type: "template",
      template: {
        name: MATERIAL_PURCHASE_TEMPLATE_NAME,
        language: { code: "en", policy: "deterministic" },
        namespace: TEMPLATE_NAMESPACE,
        to_and_components: [
          {
            to: toList,
            components: {
              button_1: { subtype: "url", type: "text", value: urlText },
            },
          },
        ],
      },
    },
  };

  try {
    const response = await fetch(MSG91_WHATSAPP_BULK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("notifyTeamForMaterialPurchaseRequest MSG91 error:", response.status, data);
      return false;
    }
    return true;
  } catch (err) {
    console.error("notifyTeamForMaterialPurchaseRequest:", err);
    return false;
  }
}
