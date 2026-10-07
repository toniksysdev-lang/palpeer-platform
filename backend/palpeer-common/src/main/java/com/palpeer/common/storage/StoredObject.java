package com.palpeer.common.storage;

public record StoredObject(
        String storageKey,
        String contentType,
        long sizeBytes
) {
}
