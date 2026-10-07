package com.palpeer.common.storage;

import com.palpeer.common.exception.BusinessException;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Private local filesystem storage.
 * CONTRACT_PENDING: production provider (S3/GCS/Azure private bucket) not specified.
 */
@Slf4j
@Component
public class LocalPrivateObjectStorage implements ObjectStorage {

    private final Path root;

    public LocalPrivateObjectStorage(
            @Value("${palpeer.storage.local.root:./data/private-storage}") String rootPath) throws IOException {
        this.root = Path.of(rootPath).toAbsolutePath().normalize();
        Files.createDirectories(this.root);
        log.info("Local private object storage root={}", this.root);
    }

    @Override
    public StoredObject store(StoreObjectRequest request) {
        String safeName = sanitizeFilename(request.originalFilename());
        String relativeKey = request.keyPrefix().replaceAll("^/+|/+$", "")
                + "/" + UUID.randomUUID() + "_" + safeName;
        Path target = resolve(relativeKey);
        try {
            Files.createDirectories(target.getParent());
            try (InputStream in = request.content().open()) {
                Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
            }
            return new StoredObject(relativeKey, request.contentType(), request.sizeBytes());
        } catch (IOException ex) {
            throw new BusinessException("STORAGE_WRITE_FAILED", "Failed to store object", HttpStatus.INTERNAL_SERVER_ERROR, ex);
        }
    }

    @Override
    public InputStream open(String storageKey) {
        try {
            return Files.newInputStream(resolve(storageKey));
        } catch (IOException ex) {
            throw new BusinessException("STORAGE_READ_FAILED", "Failed to read object", HttpStatus.NOT_FOUND, ex);
        }
    }

    @Override
    public void delete(String storageKey) {
        try {
            Files.deleteIfExists(resolve(storageKey));
        } catch (IOException ex) {
            throw new BusinessException("STORAGE_DELETE_FAILED", "Failed to delete object", HttpStatus.INTERNAL_SERVER_ERROR, ex);
        }
    }

    @Override
    public boolean exists(String storageKey) {
        return Files.exists(resolve(storageKey));
    }

    private Path resolve(String storageKey) {
        Path resolved = root.resolve(storageKey).normalize();
        if (!resolved.startsWith(root)) {
            throw new BusinessException("STORAGE_INVALID_KEY", "Invalid storage key", HttpStatus.BAD_REQUEST);
        }
        return resolved;
    }

    private static String sanitizeFilename(String originalFilename) {
        if (originalFilename == null || originalFilename.isBlank()) {
            return "file.bin";
        }
        return originalFilename.replaceAll("[^a-zA-Z0-9._-]", "_");
    }
}
