import json
import os
import re
import zipfile

OUT_DIR = r"d:\projects\palpeer-platform\palpeer-mobile\src\newui\content"


def docx_text(path: str) -> str:
    with zipfile.ZipFile(path) as z:
        xml = z.read("word/document.xml").decode("utf-8")
    text = re.sub(r"</w:p>", "\n", xml)
    text = re.sub(r"<[^>]+>", "", text)
    text = (
        text.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
    )
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def write_ts(name: str, title: str, body: str) -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, f"{name}.ts")
    # Prefer JSON string export — avoids template-literal escaping issues.
    with open(path, "w", encoding="utf-8") as f:
        f.write("/** Auto-extracted from review Word doc. Do not hand-edit. */\n")
        f.write(f"export const TITLE = {json.dumps(title)};\n")
        f.write(f"export const BODY = {json.dumps(body)};\n")
    print(name, "chars", len(body), "->", path)


def main() -> None:
    write_ts(
        "termsOfService",
        "Terms and Conditions",
        docx_text(r"C:\Users\Toniksys\Downloads\T&C review updated.docx"),
    )
    write_ts(
        "privacyPolicy",
        "Privacy Policy",
        docx_text(r"C:\Users\Toniksys\Downloads\Privacy Policy review.docx"),
    )


if __name__ == "__main__":
    main()
