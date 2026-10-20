package com.palpeer.common.sms;

/**
 * Platform SMS delivery abstraction — OTP and operational alerts go through this.
 */
public interface SmsSender {

    /** Sends a plain SMS to an E.164 (or MSISDN) destination. Soft-fails should be logged by callers. */
    void send(String to, String body);
}
