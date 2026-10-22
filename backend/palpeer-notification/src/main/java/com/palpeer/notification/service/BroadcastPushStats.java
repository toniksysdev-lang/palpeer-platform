package com.palpeer.notification.service;

/** Aggregated push delivery metrics for admin broadcast. */
public record BroadcastPushStats(int recipientCount, int devicePushCount, int failedCount) {}
