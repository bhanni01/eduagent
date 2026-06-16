#!/Library/Developer/CommandLineTools/usr/bin/python3

from pypdf import PdfReader
from sentence_transformers import SentenceTransformer
import chromadb

PDF_PATH = "science_grade6_english.pdf"
COLLECTION_NAME = "syllabus"
CHUNK_SIZE = 300  # words
OVERLAP = 50      # words


def read_pdf(filepath):
    print(f"[1/5] Reading PDF: {filepath}")
    reader = PdfReader(filepath)
    num_pages = len(reader.pages)
    print(f"      Pages found: {num_pages}")

    full_text = ""
    for page in reader.pages:
        text = page.extract_text()
        if text:
            full_text += text + "\n"

    print(f"      Characters extracted: {len(full_text):,}")
    return full_text, num_pages


def chunk_text(text, chunk_size=CHUNK_SIZE, overlap=OVERLAP):
    print(f"\n[2/5] Chunking text  (size={chunk_size} words, overlap={overlap} words)")
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        chunk = " ".join(words[start : start + chunk_size])
        chunks.append(chunk)
        start += chunk_size - overlap
    print(f"      Chunks created: {len(chunks)}")
    return chunks


def embed_and_store(chunks):
    print("\n[3/5] Loading embedding model (all-MiniLM-L6-v2) ...")
    model = SentenceTransformer("all-MiniLM-L6-v2")

    print(f"[4/5] Embedding {len(chunks)} chunks ...")
    embeddings = model.encode(chunks, show_progress_bar=True)

    print(f"\n[5/5] Storing in ChromaDB collection '{COLLECTION_NAME}' ...")
    client = chromadb.PersistentClient(path="./chroma_db")

    existing_names = [c.name for c in client.list_collections()]
    if COLLECTION_NAME in existing_names:
        client.delete_collection(COLLECTION_NAME)
        print(f"      Cleared existing '{COLLECTION_NAME}' collection")

    collection = client.create_collection(COLLECTION_NAME)
    collection.add(
        documents=chunks,
        embeddings=embeddings.tolist(),
        ids=[f"chunk_{i}" for i in range(len(chunks))],
    )
    print(f"      Stored {len(chunks)} chunks successfully!")
    return collection, model


def test_retrieval(collection, model):
    print("\n" + "=" * 55)
    print("  RETRIEVAL TEST — 3 Sample Science Questions")
    print("=" * 55)

    questions = [
        "What is photosynthesis?",
        "How do plants make their own food?",
        "What are the parts of a cell?",
    ]

    for i, q in enumerate(questions, 1):
        print(f"\nQ{i}: {q}")
        embedding = model.encode([q])[0].tolist()
        results = collection.query(query_embeddings=[embedding], n_results=2)
        for j, doc in enumerate(results["documents"][0], 1):
            snippet = doc[:220].replace("\n", " ")
            print(f"  Match {j}: {snippet} ...")


if __name__ == "__main__":
    text, num_pages = read_pdf(PDF_PATH)
    chunks = chunk_text(text)
    collection, model = embed_and_store(chunks)
    test_retrieval(collection, model)

    print("\n" + "=" * 55)
    print("  SUMMARY")
    print("=" * 55)
    print(f"  Pages processed : {num_pages}")
    print(f"  Chunks created  : {len(chunks)}")
    print(f"  Stored in       : ./chroma_db  (collection: '{COLLECTION_NAME}')")
    print("  Status          : READY — run eduagent.py next")
    print("=" * 55)
