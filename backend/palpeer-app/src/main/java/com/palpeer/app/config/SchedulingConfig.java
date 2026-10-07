package com.palpeer.app.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Background jobs, e.g. {@code P2PExpiryJob}. Each job must be safe to run on several instances. */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
