"""Web search tools for fallback information retrieval."""
from duckduckgo_search import DDGS


def search_duckduckgo(query: str, max_results: int = 3) -> list:
    """Search DuckDuckGo for medical information."""
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results))
            return results
    except Exception as e:
        print(f"DuckDuckGo search error: {e}")
        return []
