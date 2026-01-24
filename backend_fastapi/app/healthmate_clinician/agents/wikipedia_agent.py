"""Wikipedia agent for fallback medical information - with timeout."""
import wikipedia
from ..core.state import AgentState
from langchain.schema import Document

# Set timeout for Wikipedia API calls
wikipedia.set_rate_limiting(True)


def WikipediaAgent(state: AgentState) -> AgentState:
    """Search Wikipedia for medical information as fallback."""
    question = state.get("question", "")
    state["wiki_attempted"] = True
    
    try:
        # Search Wikipedia with timeout
        search_results = wikipedia.search(question, results=2)
        
        if not search_results:
            print("Wikipedia Agent: No results found")
            state["wiki_success"] = False
            return state
        
        documents = []
        for title in search_results[:2]:
            try:
                # Get page with auto_suggest disabled for speed
                page = wikipedia.page(title, auto_suggest=False)
                # Get first 1000 chars (reduced from 1500 for speed)
                content = page.content[:1000]
                doc = Document(
                    page_content=content,
                    metadata={"source": f"Wikipedia: {title}", "url": page.url}
                )
                documents.append(doc)
            except (wikipedia.DisambiguationError, wikipedia.PageError) as e:
                print(f"Wikipedia Agent: Skipping {title} - {type(e).__name__}")
                continue
        
        if documents:
            state["documents"] = documents
            state["source"] = "Wikipedia"
            state["wiki_success"] = True
            print(f"Wikipedia Agent: SUCCESS - {len(documents)} docs")
        else:
            state["wiki_success"] = False
            
    except Exception as e:
        print(f"Wikipedia agent error: {e}")
        state["wiki_success"] = False
    
    return state
