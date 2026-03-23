

// sending new order sms to the merchant (supports one or multiple numbers)
export const sendNewOrderSMS = async (
    mobile_number,
    productName,
    amount,
    merchantName,
  ) => {
    const templateId = process.env.NEW_ORDER_TEMPLATE_ID;
    const authKey = process.env.MSG91_AUTH_KEY;
    try {
      const url = `https://control.msg91.com/api/v5/flow`
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "authkey": authKey,
        },
        body: JSON.stringify({
                "template_id": templateId, 
                "recipients": [
                  {
                    "mobiles": mobile_number,
                    "MerchantName": merchantName,
                  },
                  {
                    "mobiles": "919318455101",
                    "MerchantName": merchantName,
                  },
                  {
                    "mobiles": "917015126008",
                    "MerchantName": merchantName,
                  }

                ]
              
      }),
    });
      const data = await response.json();
      console.log("MSG91 response:", data);
      return response.ok && data.type === "success";

    
    } catch (error) {
      console.error("Error sending SMS:", error);
      return false;
    }
  };

