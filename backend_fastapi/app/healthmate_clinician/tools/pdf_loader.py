"""PDF document loader for medical reference materials."""
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter


def process_pdf(pdf_path: str):
    """Load and process a PDF file into document chunks."""
    loader = PyPDFLoader(pdf_path)
    documents = loader.load()
    
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200
    )
    
    doc_splits = text_splitter.split_documents(documents)
    print(f"Processed {len(doc_splits)} document chunks from PDF")
    
    return doc_splits
