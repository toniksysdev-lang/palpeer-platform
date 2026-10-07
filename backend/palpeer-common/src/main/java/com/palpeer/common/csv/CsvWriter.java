package com.palpeer.common.csv;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

/**
 * RFC 4180 CSV builder (UTF-8, CRLF line endings, header row first).
 */
public final class CsvWriter {

    public static final MediaType TEXT_CSV = new MediaType("text", "csv", StandardCharsets.UTF_8);
    private static final DateTimeFormatter FILE_DATE = DateTimeFormatter.ofPattern("yyyyMMdd");

    private final StringBuilder out = new StringBuilder();

    public CsvWriter(List<String> header) {
        row(header.toArray());
    }

    public CsvWriter row(Object... values) {
        for (int i = 0; i < values.length; i++) {
            if (i > 0) {
                out.append(',');
            }
            out.append(escape(values[i]));
        }
        out.append("\r\n");
        return this;
    }

    public byte[] toBytes() {
        return out.toString().getBytes(StandardCharsets.UTF_8);
    }

    public ResponseEntity<byte[]> toResponse(String filename) {
        return ResponseEntity.ok()
                .contentType(TEXT_CSV)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(filename, StandardCharsets.UTF_8).build().toString())
                .body(toBytes());
    }

    /** {@code palpeer-{dataset}-{yyyyMMdd}.csv} using the current UTC date. */
    public static String filename(String dataset) {
        return "palpeer-" + dataset + "-" + LocalDate.now(ZoneOffset.UTC).format(FILE_DATE) + ".csv";
    }

    static String escape(Object value) {
        if (value == null) {
            return "";
        }
        String s = value instanceof java.math.BigDecimal bd ? bd.toPlainString() : value.toString();
        boolean quote = s.indexOf(',') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0 || s.indexOf('\r') >= 0
                || (!s.isEmpty() && (Character.isWhitespace(s.charAt(0)) || Character.isWhitespace(s.charAt(s.length() - 1))));
        if (!quote) {
            return s;
        }
        return '"' + s.replace("\"", "\"\"") + '"';
    }
}
