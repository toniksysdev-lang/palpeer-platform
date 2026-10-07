package com.palpeer.common.storage;

public record StoreObjectRequest(
        String keyPrefix,
        String originalFilename,
        String contentType,
        long sizeBytes,
        InputStreamSupplier content
) {
    @FunctionalInterface
    public interface InputStreamSupplier {
        java.io.InputStream open() throws java.io.IOException;
    }
}
