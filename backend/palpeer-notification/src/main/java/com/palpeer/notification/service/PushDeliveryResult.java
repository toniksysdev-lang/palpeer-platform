package com.palpeer.notification.service;

/** Per-notification push attempt counts. */
record PushDeliveryResult(int succeeded, int failed, boolean anySuccess) {

    static final PushDeliveryResult EMPTY = new PushDeliveryResult(0, 0, false);
}
