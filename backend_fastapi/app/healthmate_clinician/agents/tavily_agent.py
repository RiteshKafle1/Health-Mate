"""Tavily/DuckDuckGo agent for web search fallback - with timeout."""
from ..core.state import AgentState
from ..tools.search_tools import search_duckduckgo
from langchain.schema import Document


def TavilyAgent(state: AgentState) -> AgentState:
    """Search the web for medical information as last resort."""
    question = state.get("question", "")
    state["tavily_attempted"] = True
    
    try:
        # Add "medical" to the search query for better results
        search_query = f"medical {question}"
        results = search_duckduckgo(search_query, max_results=2)  # Reduced from 3
        
        if not results:
            print("Tavily Agent: No results found")
            state["tavily_success"] = False
            return state
        
        documents = []
        for result in results:
            content = f"{result.get('title', '')}\n{result.get('body', '')}"
            doc = Document(
                page_content=content[:800],  # Limit content size
                metadata={
                    "source": "Web Search",
                    "url": result.get('href', ''),
                    "title": result.get('title', '')
                }
            )
            documents.append(doc)
        
        if documents:
            state["documents"] = documents
            state["source"] = "Web Search"
            state["tavily_success"] = True
            print(f"Tavily Agent: SUCCESS - {len(documents)} docs")
        else:
            state["tavily_success"] = False
            
    except Exception as e:
        print(f"Web search agent error: {e}")
        state["tavily_success"] = False
    
    return state
