"""Retriever agent for RAG-based document retrieval with relevance scoring."""
from ..core.state import AgentState
from ..tools.vector_store import get_vectorstore_instance

# Minimum relevance score threshold (cosine similarity)
# Higher threshold = stricter matching, more fallback to Wikipedia/Web
RELEVANCE_THRESHOLD = 0.55


def RetrieverAgent(state: AgentState) -> AgentState:
    """Retrieve relevant documents from the vector store with relevance scoring."""
    question = state.get("question", "")
    state["rag_attempted"] = True
    
    vectorstore = get_vectorstore_instance()
    if not vectorstore:
        print("Retriever: No vectorstore available")
        state["rag_success"] = False
        return state
    
    try:
        # Use similarity_search_with_score for relevance checking
        results = vectorstore.similarity_search_with_score(question, k=3)
        
        if not results:
            print("Retriever: No documents found")
            state["rag_success"] = False
            return state
        
        # Filter by relevance score
        # ChromaDB returns (document, distance) where lower distance = more similar
        # Convert distance to similarity: similarity = 1 - distance (for cosine)
        relevant_docs = []
        for doc, distance in results:
            # For cosine distance, convert to similarity
            similarity = 1 - distance if distance <= 1 else 0
            print(f"Retriever: Doc score={similarity:.3f}, preview='{doc.page_content[:50]}...'")
            
            if similarity >= RELEVANCE_THRESHOLD:
                relevant_docs.append(doc)
        
        if relevant_docs:
            state["documents"] = relevant_docs
            state["source"] = "Medical Database"
            state["rag_success"] = True
            print(f"Retriever: SUCCESS - {len(relevant_docs)} relevant documents found")
        else:
            print(f"Retriever: FAIL - No documents above threshold {RELEVANCE_THRESHOLD}")
            state["rag_success"] = False
            
    except Exception as e:
        print(f"Retriever agent error: {e}")
        state["rag_success"] = False
    
    return state
