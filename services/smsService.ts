// Get BT SMS API URL from environment variables
const BT_SMS_API = process.env.EXPO_PUBLIC_BT_SMS_API;

// Get Tashicell SMS API URL from environment variables
const TASHI_SMS_API = process.env.EXPO_PUBLIC_TASHI_SMS_API;

interface SMSPayload {
  phone: string;
  message: string;
}

/**
 * Validates that required environment variables are set
 */
function validateEnvironment(): void {
  if (!BT_SMS_API || !TASHI_SMS_API) {
    console.error('SMS API URLs are not configured in environment variables');
  }
}

/**
 * Send SMS via the appropriate API based on phone number prefix
 * - 97517 numbers use BT SMS API
 * - 97577 numbers use Tashicell SMS API
 * @param phone - Recipient phone number (format: 975XXXXXXXX)
 * @param message - SMS message content
 * @returns Promise<boolean> - Success status
 */
export async function sendSMS({ phone, message }: SMSPayload): Promise<boolean> {
  try {
    // Validate environment variables are set
    validateEnvironment();

    if (!BT_SMS_API || !TASHI_SMS_API) {
      console.error('SMS API configuration is missing');
      return false;
    }

    // Format phone number - ensure it has Bhutan country code 975
    let formattedPhone = phone;
    if (!phone.startsWith('975')) {
      formattedPhone = `975${phone}`;
    }

    // Determine which API to use based on phone prefix
    // TypeScript assertion: we've validated these are strings above
    let apiUrl: string = BT_SMS_API;
    if (formattedPhone.startsWith('97577')) {
      apiUrl = TASHI_SMS_API;
      console.log('Using Tashicell SMS API');
    } else {
      console.log('Using BT SMS API');
    }

    console.log('Sending SMS to:', formattedPhone);
    console.log('Message:', message);
    console.log('API URL:', apiUrl);

    const payload = {
      number: formattedPhone,
      message: message,
    };
    console.log('Request payload:', JSON.stringify(payload));

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('Response status:', response.status);
    
    // Try to get response text for debugging
    const responseText = await response.text();
    console.log('Response body:', responseText);

    if (!response.ok) {
      console.error('SMS API error:', response.status, response.statusText);
      console.error('Error details:', responseText);
      return false;
    }

    try {
      const data = JSON.parse(responseText);
      console.log('SMS sent successfully:', data);
    } catch (e) {
      console.log('Response was not JSON, but request succeeded');
    }
    
    return true;
  } catch (error) {
    console.error('SMS sending error:', error);
    // Don't throw error to prevent signup failure due to SMS issues
    return false;
  }
}

/**
 * Send welcome SMS after successful signup
 * - Sends to users with phone numbers starting with 97517 (BT)
 * - Sends to users with phone numbers starting with 97577 (Tashicell)
 * @param phone - User's phone number
 * @returns Promise<boolean> - Success status
 */
export async function sendWelcomeSMS(phone: string): Promise<boolean> {
  // Check if phone number starts with 97517 or 97577 (or local format 17/77)
  const shouldSendSMS = 
    phone.startsWith('97517') || phone.startsWith('17') || 
    phone.startsWith('97577') || phone.startsWith('77');
  
  if (!shouldSendSMS) {
    console.log('SMS not sent: Phone number does not start with 97517 or 97577');
    return false;
  }

  const welcomeMessage = 'Welcome to NamZoed! Your account has been successfully created. Discover and explore what’s waiting for you.';
  return sendSMS({ phone, message: welcomeMessage });
}
/**
 * Send OTP SMS for password reset
 * - Sends to users with phone numbers starting with 97517 (BT)
 * - Sends to users with phone numbers starting with 97577 (Tashicell)
 * @param phone - User's phone number
 * @param otp - 4-digit OTP code
 * @returns Promise<boolean> - Success status
 */
export async function sendOTPSMS(phone: string, otp: string): Promise<boolean> {
  // Check if phone number starts with 97517 or 97577 (or local format 17/77)
  const shouldSendSMS = 
    phone.startsWith('97517') || phone.startsWith('17') || 
    phone.startsWith('97577') || phone.startsWith('77');
  
  if (!shouldSendSMS) {
    console.log('SMS not sent: Phone number does not start with 97517 or 97577');
    return false;
  }

  const otpMessage = `Your NamZoed password reset OTP is: ${otp}. Valid for 10 minutes.`;
  return sendSMS({ phone, message: otpMessage });
}
