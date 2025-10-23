/**
 * DefendAMinecraft reCAPTCHA Server-side Verification Library
 * Secure server-side verification for Node.js applications
 */

export interface ServerVerificationConfig {
  secretKey: string;
  apiUrl?: string;
  timeout?: number;
}

export interface ServerVerificationRequest {
  response: string;
  remoteip?: string;
  userAgent?: string;
  action?: string;
}

export interface ServerVerificationResponse {
  success: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  verification_time?: number;
  'error-codes'?: string[];
}

export class DefendAMinecraftServerVerification {
  private config: Required<ServerVerificationConfig>;

  constructor(config: ServerVerificationConfig) {
    this.config = {
      apiUrl: 'https://api.defendaminecraft.online',
      timeout: 10000,
      ...config
    };
  }

  /**
   * Verify a reCAPTCHA response token
   */
  public async verify(request: ServerVerificationRequest): Promise<ServerVerificationResponse> {
    try {
      const response = await this.makeRequest(request);
      return this.processResponse(response);
    } catch (error) {
      return {
        success: false,
        'error-codes': ['request-failed'],
      };
    }
  }

  /**
   * Verify with additional validation
   */
  public async verifyWithValidation(
    request: ServerVerificationRequest,
    options: {
      expectedAction?: string;
      minimumScore?: number;
      expectedHostname?: string;
    } = {}
  ): Promise<ServerVerificationResponse & { isValid: boolean; validationErrors: string[] }> {
    const result = await this.verify(request);
    const validationErrors: string[] = [];
    let isValid = result.success;

    if (result.success) {
      // Validate action
      if (options.expectedAction && result.action !== options.expectedAction) {
        validationErrors.push('action-mismatch');
        isValid = false;
      }

      // Validate score
      if (options.minimumScore && (result.score || 0) < options.minimumScore) {
        validationErrors.push('score-too-low');
        isValid = false;
      }

      // Validate hostname
      if (options.expectedHostname && result.hostname !== options.expectedHostname) {
        validationErrors.push('hostname-mismatch');
        isValid = false;
      }
    }

    return {
      ...result,
      isValid,
      validationErrors
    };
  }

  /**
   * Make HTTP request to verification API
   */
  private async makeRequest(request: ServerVerificationRequest): Promise<any> {
    const url = `${this.config.apiUrl}/api/v1/verify`;
    
    const body = JSON.stringify({
      token: request.response,
      response: 'server_verification',
      userAgent: request.userAgent,
      ipAddress: request.remoteip,
      action: request.action
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.secretKey,
          'User-Agent': 'DefendAMinecraft-Server/1.0.0'
        },
        body,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Process API response
   */
  private processResponse(apiResponse: any): ServerVerificationResponse {
    return {
      success: apiResponse.success || false,
      score: apiResponse.score,
      action: apiResponse.action,
      challenge_ts: apiResponse.challenge_ts,
      hostname: apiResponse.hostname,
      verification_time: apiResponse.verification_time,
      'error-codes': apiResponse.success ? undefined : ['verification-failed']
    };
  }
}

/**
 * Express.js middleware for automatic reCAPTCHA verification
 */
export function recaptchaMiddleware(config: ServerVerificationConfig & {
  skipOnSuccess?: boolean;
  responseField?: string;
  ipField?: string;
  userAgentField?: string;
}) {
  const verifier = new DefendAMinecraftServerVerification(config);
  
  return async (req: any, res: any, next: any) => {
    try {
      const responseToken = req.body[config.responseField || 'recaptcha_response'] || 
                           req.body['g-recaptcha-response'] ||
                           req.headers['x-recaptcha-response'];

      if (!responseToken) {
        return res.status(400).json({
          success: false,
          error: 'missing-input-response',
          message: 'reCAPTCHA response token is required'
        });
      }

      const verificationRequest: ServerVerificationRequest = {
        response: responseToken,
        remoteip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        action: req.body.action || req.path
      };

      const result = await verifier.verify(verificationRequest);

      // Attach result to request object
      req.recaptcha = result;

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: 'recaptcha-verification-failed',
          message: 'reCAPTCHA verification failed',
          details: result
        });
      }

      next();
    } catch (error) {
      console.error('reCAPTCHA middleware error:', error);
      return res.status(500).json({
        success: false,
        error: 'recaptcha-middleware-error',
        message: 'Internal server error during reCAPTCHA verification'
      });
    }
  };
}

/**
 * Utility function for quick verification
 */
export async function quickVerify(
  secretKey: string, 
  responseToken: string, 
  remoteip?: string
): Promise<boolean> {
  const verifier = new DefendAMinecraftServerVerification({ secretKey });
  const result = await verifier.verify({ 
    response: responseToken, 
    remoteip 
  });
  return result.success;
}

export default DefendAMinecraftServerVerification;
