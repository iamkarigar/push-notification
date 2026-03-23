

const MSG91_WHATSAPP_BULK_URL =
  "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/";

const TEMPLATE_NAME_JOB_APPLICATION_TEAM_UPDATE =
  "job_requirement_application_team_update";

const TEMPLATE_NAMESPACE = "5a483c05_306a_44fb_aaf9_1245be4077e7";

/** Parse TEAM_MEMBERS_NUMBERS into an array of WhatsApp numbers with country code. */
function getTeamNumbers() {
  const raw = process.env.TEAM_MEMBERS_NUMBERS;
  if (!raw || !raw.trim()) return [];
  return raw
    .split(/[\s,]+/)
    .map((n) => n.trim().replace(/^\+/, ""))
    .filter(Boolean);
}

/**
 * Notify team on WhatsApp when a labour applies to a job requirement.
 * Numbers are taken from TEAM_MEMBERS_NUMBERS env.
 */
export async function notifyTeamAboutLabourSelectionOnWhatsapp(
  jobId,
  labourName,
  jobDate
) {
  const authkey = process.env.MSG91_AUTH_KEY;
  const integratedNumber =
    process.env.MSG91_WHATSAPP_INTEGRATED_NUMBER || "15557129540";

  if (!authkey) {
    console.warn(
      "notifyTeamAboutLabourSelectionOnWhatsapp: MSG91_AUTH_KEY not set"
    );
    return false;
  }

  const toList = getTeamNumbers();
  if (toList.length === 0) {
    console.warn(
      "notifyTeamAboutLabourSelectionOnWhatsapp: No team numbers in TEAM_MEMBERS_NUMBERS"
    );
    return false;
  }

  const urlText =
    "https://admin.innovkarigar.com/labour/jobs/" + String(jobId || "");

  const payload = {
    integrated_number: integratedNumber,
    content_type: "template",
    payload: {
      messaging_product: "whatsapp",
      type: "template",
      template: {
        name: TEMPLATE_NAME_JOB_APPLICATION_TEAM_UPDATE,
        language: {
          code: "en",
          policy: "deterministic",
        },
        namespace: TEMPLATE_NAMESPACE,
        to_and_components: [
          {
            to: toList,
            components: {
              body_job_id: {
                type: "text",
                value: String(jobId || ""),
                parameter_name: "job_id",
              },
              body_labour_name: {
                type: "text",
                value: String(labourName || ""),
                parameter_name: "labour_name",
              },
              body_date_of_job: {
                type: "text",
                value: String(jobDate || ""),
                parameter_name: "date_of_job",
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
      headers: {
        "Content-Type": "application/json",
        authkey,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(
        "notifyTeamAboutLabourSelectionOnWhatsapp MSG91 error:",
        response.status,
        data
      );
      return false;
    }

    return true;
  } catch (err) {
    console.error("notifyTeamAboutLabourSelectionOnWhatsapp:", err);
    return false;
  }
}