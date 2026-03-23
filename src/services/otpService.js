/**
 * OTP generation and MSG91 send (aligned with Karigar_server-new-).
 */
export function generateOtp() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export async function sendOtp(mobile_number, otp, authKey, senderId, templateId) {
  const url = `https://api.msg91.com/api/v5/otp?authkey=${authKey}&template_id=${templateId}&mobile=${mobile_number}&otp=${otp}&sender=${senderId}`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await response.json();
    if (response.ok && data.type === "success") return true;
    console.error("MSG91 OTP failed:", data);
    return false;
  } catch (error) {
    console.error("Error sending OTP:", error);
    return false;
  }
}
