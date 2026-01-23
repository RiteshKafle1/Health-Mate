"""
Reference Data Loader
=====================
Loads and caches biomarker reference data from JSON file.
"""

import json
from pathlib import Path
from typing import Optional, Dict, List
from functools import lru_cache
from ..models.biomarker import Biomarker, BiomarkersData


# Path to biomarkers.json relative to this file
DATA_DIR = Path(__file__).parent.parent.parent.parent / "data"
BIOMARKERS_FILE = DATA_DIR / "biomarkers.json"


@lru_cache(maxsize=1)
def _load_biomarkers_data() -> BiomarkersData:
    """Load and cache biomarkers data from JSON file."""
    if not BIOMARKERS_FILE.exists():
        raise FileNotFoundError(f"Biomarkers file not found: {BIOMARKERS_FILE}")
    
    with open(BIOMARKERS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    return BiomarkersData(**data)


def get_reference_data() -> BiomarkersData:
    """
    Get the complete biomarkers reference data.
    
    Returns:
        BiomarkersData object with all biomarkers
    """
    return _load_biomarkers_data()


def get_biomarkers_dict() -> Dict[str, Biomarker]:
    """
    Get biomarkers as a dictionary keyed by ID.
    
    Returns:
        Dict mapping biomarker ID to Biomarker object
    """
    data = get_reference_data()
    return {b.id: b for b in data.biomarkers}


def get_biomarker_by_id(biomarker_id: str) -> Optional[Biomarker]:
    """
    Get a single biomarker by its ID.
    
    Args:
        biomarker_id: The biomarker ID (e.g., 'hemoglobin', 'glucose_fasting')
        
    Returns:
        Biomarker object or None if not found
    """
    biomarkers = get_biomarkers_dict()
    return biomarkers.get(biomarker_id.lower())


def find_biomarker_by_synonym(name: str) -> Optional[Biomarker]:
    """
    Find a biomarker by searching synonyms and canonical name.
    
    Args:
        name: Name to search for (case-insensitive)
        
    Returns:
        Matched Biomarker or None
    """
    name_lower = name.lower().strip()
    data = get_reference_data()
    
    for biomarker in data.biomarkers:
        # Check canonical name
        if biomarker.canonical_name.lower() == name_lower:
            return biomarker
        
        # Check ID
        if biomarker.id == name_lower:
            return biomarker
        
        # Check synonyms
        for synonym in biomarker.synonyms:
            if synonym.lower() == name_lower:
                return biomarker
    
    return None


def search_biomarkers(query: str) -> List[Biomarker]:
    """
    Search biomarkers by partial name match.
    
    Args:
        query: Search query (case-insensitive)
        
    Returns:
        List of matching biomarkers
    """
    query_lower = query.lower().strip()
    data = get_reference_data()
    results = []
    
    for biomarker in data.biomarkers:
        # Check canonical name
        if query_lower in biomarker.canonical_name.lower():
            results.append(biomarker)
            continue
        
        # Check synonyms
        for synonym in biomarker.synonyms:
            if query_lower in synonym.lower():
                results.append(biomarker)
                break
    
    return results


def get_biomarkers_by_category(category: str) -> List[Biomarker]:
    """
    Get all biomarkers in a specific category.
    
    Args:
        category: Category name (e.g., 'hematology', 'liver_function')
        
    Returns:
        List of biomarkers in that category
    """
    data = get_reference_data()
    return [b for b in data.biomarkers if b.category.lower() == category.lower()]


def get_all_categories() -> List[str]:
    """Get list of all unique biomarker categories."""
    data = get_reference_data()
    return list(set(b.category for b in data.biomarkers))


# Build a synonym lookup index for fast matching
@lru_cache(maxsize=1)
def _build_synonym_index() -> Dict[str, str]:
    """
    Build an index mapping all synonyms to biomarker IDs.
    
    Returns:
        Dict mapping lowercase synonym/name to biomarker ID
    """
    index = {}
    data = get_reference_data()
    
    for biomarker in data.biomarkers:
        # Add canonical name
        index[biomarker.canonical_name.lower()] = biomarker.id
        
        # Add ID itself
        index[biomarker.id] = biomarker.id
        
        # Add all synonyms
        for synonym in biomarker.synonyms:
            index[synonym.lower()] = biomarker.id
    
    return index


def get_biomarker_id_for_name(name: str) -> Optional[str]:
    """
    Fast lookup of biomarker ID from any name/synonym.
    
    Args:
        name: Any form of the biomarker name
        
    Returns:
        Biomarker ID or None
    """
    index = _build_synonym_index()
    return index.get(name.lower().strip())
