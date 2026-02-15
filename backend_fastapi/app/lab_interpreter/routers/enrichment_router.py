from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
from app.lab_interpreter.services import knowledge_service
from app.lab_interpreter.agents import researcher_agent
from pydantic import BaseModel

router = APIRouter(prefix="/lab/enrichment", tags=["Lab Enrichment"])

class EnrichmentResponse(BaseModel):
    summary: str
    clinical_significance: str
    source_url: str | None = None
    verified: bool = False

@router.get("/{biomarker_name}", response_model=EnrichmentResponse)
async def get_biomarker_enrichment(biomarker_name: str):
    """
    On-demand enrichment for a specific biomarker.
    1. Checks DB cache first.
    2. If missing, triggers Research Agent (Wiki -> LLM).
    3. Stores result and returns.
    """
    # 1. Check Cache
    definition = await knowledge_service.get_biomarker_definition(biomarker_name)
    
    if definition:
        return EnrichmentResponse(
            summary=definition.get("summary", ""),
            clinical_significance=definition.get("clinical_significance", ""),
            source_url=definition.get("source_url"),
            verified=definition.get("verified", False)
        )
    
    # 2. Research if missing
    research_result = await researcher_agent.research_biomarker(biomarker_name)
    
    if research_result:
        # 3. Store result
        await knowledge_service.store_biomarker_definition(
            name=biomarker_name,
            summary=research_result.get("summary", ""),
            clinical_significance=research_result.get("clinical_significance", ""),
            source_url=research_result.get("source_url"),
            category="General"
        )
        
        return EnrichmentResponse(
            summary=research_result.get("summary", ""),
            clinical_significance=research_result.get("clinical_significance", ""),
            source_url=research_result.get("source_url"),
            verified=False
        )
        
    # If all failed
    return EnrichmentResponse(
        summary="No information available for this biomarker.",
        clinical_significance="Please consult your healthcare provider.",
        verified=False
    )
