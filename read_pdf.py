
import pypdf
import sys

try:
    reader = pypdf.PdfReader("/Users/sainacomputer/Desktop/8thsem/cuty-main/final defense healthmate report.pdf")
    text = ""
    for page in reader.pages:
        text += page.extract_text() + "\n"
    print(text)
except Exception as e:
    print(f"Error reading PDF: {e}")
