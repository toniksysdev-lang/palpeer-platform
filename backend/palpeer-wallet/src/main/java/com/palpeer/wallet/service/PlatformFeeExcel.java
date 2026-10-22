package com.palpeer.wallet.service;

import com.palpeer.wallet.web.dto.PlatformFeeRevenueResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

/**
 * Excel-compatible SpreadsheetML (.xls) export for platform fee revenue rows.
 * Opens natively in Microsoft Excel without a third-party library.
 */
public final class PlatformFeeExcel {

    private static final MediaType EXCEL_XML =
            MediaType.parseMediaType("application/vnd.ms-excel");
    private static final DateTimeFormatter FILE_DATE = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final DateTimeFormatter CELL_INSTANT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(ZoneOffset.UTC);

    private PlatformFeeExcel() {}

    public static ResponseEntity<byte[]> toResponse(List<PlatformFeeRevenueResponse> rows) {
        byte[] body = buildWorkbook(rows).getBytes(StandardCharsets.UTF_8);
        String filename = "palpeer-platform-revenue-"
                + LocalDate.now(ZoneOffset.UTC).format(FILE_DATE)
                + ".xls";
        return ResponseEntity.ok()
                .contentType(EXCEL_XML)
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment()
                                .filename(filename, StandardCharsets.UTF_8)
                                .build()
                                .toString())
                .body(body);
    }

    static String buildWorkbook(List<PlatformFeeRevenueResponse> rows) {
        StringBuilder xml = new StringBuilder(Math.max(1024, rows.size() * 180));
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n");
        xml.append("<?mso-application progid=\"Excel.Sheet\"?>\r\n");
        xml.append("<Workbook xmlns=\"urn:schemas-microsoft-com:office:spreadsheet\" ");
        xml.append("xmlns:ss=\"urn:schemas-microsoft-com:office:spreadsheet\">\r\n");
        xml.append(" <Worksheet ss:Name=\"Platform Revenue\">\r\n");
        xml.append("  <Table>\r\n");
        appendHeader(xml);
        for (PlatformFeeRevenueResponse row : rows) {
            appendDataRow(xml, row);
        }
        xml.append("  </Table>\r\n");
        xml.append(" </Worksheet>\r\n");
        xml.append("</Workbook>\r\n");
        return xml.toString();
    }

    private static void appendHeader(StringBuilder xml) {
        xml.append("   <Row>\r\n");
        stringCell(xml, "Recorded (UTC)");
        stringCell(xml, "Source");
        stringCell(xml, "Currency");
        stringCell(xml, "Amount");
        stringCell(xml, "User ID");
        stringCell(xml, "User email");
        stringCell(xml, "Reference type");
        stringCell(xml, "Reference ID");
        stringCell(xml, "Description");
        stringCell(xml, "Fee ID");
        xml.append("   </Row>\r\n");
    }

    private static void appendDataRow(StringBuilder xml, PlatformFeeRevenueResponse row) {
        xml.append("   <Row>\r\n");
        stringCell(xml, formatInstant(row.createdAt()));
        stringCell(xml, row.sourceType() == null ? "" : row.sourceType().name());
        stringCell(xml, row.currencyCode());
        numberCell(xml, row.amount() == null ? null : row.amount().toPlainString());
        stringCell(xml, row.userId() == null ? "" : row.userId().toString());
        stringCell(xml, row.userEmail());
        stringCell(xml, row.referenceType());
        stringCell(xml, row.referenceId() == null ? "" : row.referenceId().toString());
        stringCell(xml, row.description());
        stringCell(xml, row.id() == null ? "" : row.id().toString());
        xml.append("   </Row>\r\n");
    }

    private static void stringCell(StringBuilder xml, String value) {
        xml.append("    <Cell><Data ss:Type=\"String\">")
                .append(escapeXml(value))
                .append("</Data></Cell>\r\n");
    }

    private static void numberCell(StringBuilder xml, String value) {
        if (value == null || value.isBlank()) {
            stringCell(xml, "");
            return;
        }
        xml.append("    <Cell><Data ss:Type=\"Number\">")
                .append(escapeXml(value))
                .append("</Data></Cell>\r\n");
    }

    private static String formatInstant(Instant value) {
        return value == null ? "" : CELL_INSTANT.format(value);
    }

    private static String escapeXml(String value) {
        if (value == null || value.isEmpty()) {
            return "";
        }
        StringBuilder out = new StringBuilder(value.length() + 16);
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '&' -> out.append("&amp;");
                case '<' -> out.append("&lt;");
                case '>' -> out.append("&gt;");
                case '"' -> out.append("&quot;");
                case '\'' -> out.append("&apos;");
                default -> {
                    if (c < 0x20 && c != '\t' && c != '\n' && c != '\r') {
                        // skip illegal XML 1.0 control chars
                    } else {
                        out.append(c);
                    }
                }
            }
        }
        return out.toString();
    }
}
