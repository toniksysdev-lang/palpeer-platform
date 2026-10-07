package com.palpeer.common.storage;

import java.io.InputStream;

/**
 * Private object storage abstraction for KYC documents, selfies, and other sensitive blobs.
 * Implementations must keep objects non-public.
 */
public interface ObjectStorage {

    StoredObject store(StoreObjectRequest request);

    InputStream open(String storageKey);

    void delete(String storageKey);

    boolean exists(String storageKey);
}
