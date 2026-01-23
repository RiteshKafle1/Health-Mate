"""
Biomarker Knowledge Service
Handles storage and retrieval of biomarker definitions from the knowledge base.
"""
from typing import Optional, Dict, Any, List
from datetime import datetime
from app.core.database import get_biomarker_definitions_collection


async def get_biomarker_definition(biomarker_name: str) -> Optional[Dict[str, Any]]:
    """
    Retrieve biomarker definition from the knowledge base.
    Searches by exact name or alias match.
    
    Args:
        biomarker_name: Name of the biomarker to look up
        
    Returns:
        Definition dict if found, None otherwise
    """
    collection = get_biomarker_definitions_collection()
    
    # Try exact match first, then check aliases
    definition = await collection.find_one({
        "$or": [
            {"name": {"$regex": f"^{biomarker_name}$", "$options": "i"}},
            {"aliases": {"$regex": f"^{biomarker_name}$", "$options": "i"}}
        ]
    })
    
    return definition


async def store_biomarker_definition(
    name: str,
    summary: str,
    clinical_significance: str,
    aliases: List[str] = None,
    category: str = "General",
    source_url: str = None
) -> Dict[str, Any]:
    """
    Store a new biomarker definition in the knowledge base.
    
    Args:
        name: Canonical name of the biomarker
        summary: Brief explanation of what it is
        clinical_significance: Why it matters clinically
        aliases: Alternative names/abbreviations
        category: Category (Hematology, Lipids, etc.)
        source_url: URL where information was sourced from
        
    Returns:
        The stored document
    """
    collection = get_biomarker_definitions_collection()
    
    document = {
        "name": name,
        "aliases": aliases or [],
        "summary": summary,
        "clinical_significance": clinical_significance,
        "category": category,
        "source_url": source_url,
        "verified": False,  # Requires manual verification
        "last_updated": datetime.utcnow(),
        "created_at": datetime.utcnow()
    }
    
    # Upsert to avoid duplicates
    result = await collection.update_one(
        {"name": {"$regex": f"^{name}$", "$options": "i"}},
        {"$set": document},
        upsert=True
    )
    
    # Fetch and return the document
    stored = await collection.find_one({"name": {"$regex": f"^{name}$", "$options": "i"}})
    return stored


async def batch_get_definitions(biomarker_names: List[str]) -> Dict[str, Optional[Dict[str, Any]]]:
    """
    Retrieve multiple biomarker definitions in a single query.
    
    Args:
        biomarker_names: List of biomarker names to look up
        
    Returns:
        Dictionary mapping biomarker names to their definitions (or None if not found)
    """
    collection = get_biomarker_definitions_collection()
    
    # Build query for all names
    definitions = await collection.find({
        "$or": [
            {"name": {"$in": biomarker_names}},
            {"aliases": {"$in": biomarker_names}}
        ]
    }).to_list(length=None)
    
    # Build result map
    result_map = {}
    for name in biomarker_names:
        # Find matching definition
        matched = None
        for definition in definitions:
            if (definition["name"].lower() == name.lower() or 
                name.lower() in [alias.lower() for alias in definition.get("aliases", [])]):
                matched = definition
                break
        result_map[name] = matched
    
    return result_map


async def create_indexes():
    """Create necessary indexes for the biomarker_definitions collection."""
    collection = get_biomarker_definitions_collection()
    
    # Unique index on name
    await collection.create_index("name", unique=True)
    
    # Text index for flexible searching
    await collection.create_index([
        ("name", "text"),
        ("aliases", "text")
    ])
    
    print("✓ Biomarker definitions indexes created")
