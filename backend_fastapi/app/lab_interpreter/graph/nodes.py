import time
import logging
from typing import Dict, Any

from app.lab_interpreter.services.verification_agent import get_verifier
from app.lab_interpreter.services.gemini_interpreter import LabInterpreter
from app.lab_interpreter.services.validator_agent import get_validator
from app.lab_interpreter.models.interpretation import PatientContext, InterpretationResult, ValueStatus, ExtractedValue

from .state import LabReportState

logger = logging.getLogger(__name__)

async def verify_node(state: LabReportState) -> Dict[str, Any]:
    """
    Node: Verify if the image is a valid medical lab report.
    """
    try:
        verifier = get_verifier(state["api_key"])
        result = await verifier.verify(state["image_data"], state["mime_type"])
        
        if not result.is_valid:
            return {
                "verification_result": {
                    "is_valid": False,
                    "rejection_reason": result.rejection_reason
                },
                "error": result.rejection_reason or "Invalid lab report image"
            }
            
        return {
            "verification_result": {
                "is_valid": True,
                "confidence": result.confidence
            }
        }
    except Exception as e:
        logger.error(f"Verification node error: {e}")
        return {"error": f"Verification failed: {str(e)}"}


async def interpret_node(state: LabReportState) -> Dict[str, Any]:
    """
    Node: Extract values using Gemini Interpreter.
    """
    try:
        interpreter = LabInterpreter(state["api_key"])
        
        # We need to construct patient context object
        ctx_data = state["patient_context"]
        context = PatientContext(**ctx_data)
        
        # 1. Build prompt (using updated logic to ask for extraction)
        prompt = interpreter._build_prompt(context)
        
        # 2. Call Gemini
        raw_response = await interpreter._call_gemini(
            prompt, state["image_data"], state["mime_type"]
        )
        
        # 3. Parse JSON
        extracted = interpreter._parse_gemini_response(raw_response)
        
        # 4. Update context with extracted info
        extracted_info = extracted.get("patient_info", {})
        effective_context = context.copy()
        
        if extracted_info.get("sex") and (effective_context.sex == "unknown" or not effective_context.sex):
            effective_context.sex = extracted_info.get("sex").lower()
            
        if extracted_info.get("age") and not effective_context.age:
            try:
                effective_context.age = int(extracted_info.get("age"))
            except:
                pass
                
        if extracted_info.get("is_fasting") is not None and not effective_context.is_fasting:
            effective_context.is_fasting = bool(extracted_info.get("is_fasting"))
            
        # 5. Process values
        processed_values = interpreter._process_extracted_values(
            extracted.get("extracted_values", []),
            effective_context
        )
        
        return {
            "extracted_data": extracted,
            "processed_values": [v.model_dump() for v in processed_values],
            "patient_context": effective_context.model_dump()  # Update state with refined context
        }
        
    except Exception as e:
        logger.error(f"Interpretation node error: {e}")
        return {"error": f"Interpretation failed: {str(e)}"}


async def validate_node(state: LabReportState) -> Dict[str, Any]:
    """
    Node: Validate extracted values.
    """
    try:
        validator = get_validator(state["api_key"])
        
        # Reconstruct objects
        values = [ExtractedValue(**v) for v in state["processed_values"]]
        context = PatientContext(**state["patient_context"])
        
        report = await validator.validate(values, context)
        
        # Convert issues to dicts
        issues = [
            {
                "biomarker": i.biomarker_name,
                "type": i.issue_type,
                "severity": i.severity,
                "message": i.message
            }
            for i in report.issues
        ]
        
        return {
            "validation_issues": issues,
            "validation_passed": report.is_valid,
            "validation_confidence": report.confidence,
            "validation_notes": report.validation_notes
        }
        
    except Exception as e:
        logger.error(f"Validation node error: {e}")
        # Validate node failure typically shouldn't block the whole flow, 
        # but we mark it as failed validation
        return {
            "validation_passed": False,
            "validation_confidence": 0.0,
            "validation_notes": f"Validation process failed: {str(e)}",
            "validation_issues": [] 
        }


async def finalize_node(state: LabReportState) -> Dict[str, Any]:
    """
    Node: Construct final InterpretationResult.
    """
    try:
        # Reconstruct processed values for summary generation
        # (We reuse the service method logic or duplicate it here)
        # To avoid duplicating _generate_summary logic, let's just do it manually here or init interpreter
        
        extracted_data = state.get("extracted_data", {})
        values_dicts = state.get("processed_values", [])
        values = [ExtractedValue(**v) for v in values_dicts]
        
        abnormal = [
            v for v in values 
            if v.status not in [ValueStatus.NORMAL, ValueStatus.UNKNOWN]
        ]
        
        critical = [
            v for v in values 
            if v.status in [ValueStatus.CRITICAL_LOW, ValueStatus.CRITICAL_HIGH]
        ]
        
        # Generate summary (reusing logic from service simplistically)
        total = len(values)
        summary = ""
        if not values:
            summary = "No biomarker values could be extracted."
        elif critical:
            names = ", ".join([v.biomarker_name for v in critical])
            summary = f"⚠️ CRITICAL: {len(critical)} value(s) require immediate attention ({names}). {len(abnormal)} total abnormal."
        elif abnormal:
             names = ", ".join([v.biomarker_name for v in abnormal[:3]])
             more = f" and {len(abnormal) - 3} more" if len(abnormal) > 3 else ""
             summary = f"{len(abnormal)} abnormal value(s) found ({names}{more}). {total - len(abnormal)} normal."
        else:
            summary = f"All {total} extracted values are within normal limits."
            
        critical_flags = [f"{v.biomarker_name}: {v.status.value}" for v in critical]
        
        result = InterpretationResult(
            report_id=state["report_id"],
            patient_context=PatientContext(**state["patient_context"]),
            lab_name=extracted_data.get("lab_name"),
            report_date=extracted_data.get("report_date"),
            extracted_values=values,
            summary=summary,
            abnormal_count=len(abnormal),
            critical_flags=critical_flags,
            processing_time_ms=0, # Router can fill this or we calc here
            validation_passed=state.get("validation_passed", True),
            validation_confidence=state.get("validation_confidence", 1.0),
            validation_issues=state.get("validation_issues", []),
            validation_notes=state.get("validation_notes", "")
        )
        
        return {"final_result": result.model_dump()}
        
    except Exception as e:
        logger.error(f"Finalize node error: {e}")
        return {"error": f"Finalization failed: {str(e)}"}


async def enrich_node(state: LabReportState) -> Dict[str, Any]:
    """
    Node: Enrich biomarkers with educational content from knowledge base.
    Fetches definitions from DB, or researches and stores new ones.
    """
    try:
        from app.lab_interpreter.services import knowledge_service
        from app.lab_interpreter.agents import researcher_agent
        
        values_dicts = state.get("processed_values", [])
        values = [ExtractedValue(**v) for v in values_dicts]
        
        if not values:
            logger.info("Enrich node: No values to enrich")
            return {}  # No enrichment needed
        
        logger.info(f"Enrich node: Starting enrichment for {len(values)} biomarkers")
        
        # Extract biomarker names
        biomarker_names = [v.biomarker_name for v in values]
        logger.info(f"Enrich node: Biomarkers to enrich: {biomarker_names}")
        
        # Batch lookup in knowledge base
        definitions_map = await knowledge_service.batch_get_definitions(biomarker_names)
        cached_count = sum(1 for v in definitions_map.values() if v is not None)
        logger.info(f"Enrich node: Found {cached_count}/{len(biomarker_names)} definitions in cache")
        
        # Identify missing definitions
        missing_names = [name for name, defn in definitions_map.items() if defn is None]
        
        # Research missing biomarkers (if any)
        if missing_names:
            logger.info(f"Enrich node: Researching {len(missing_names)} unknown biomarkers: {missing_names}")
            research_results = await researcher_agent.research_biomarkers_batch(missing_names)
            
            # Store newly researched definitions
            research_success = 0
            for name, research in research_results.items():
                if research:
                    research_success += 1
                    logger.info(f"Enrich node: Successfully researched '{name}'")
                    await knowledge_service.store_biomarker_definition(
                        name=name,
                        summary=research.get("summary", ""),
                        clinical_significance=research.get("clinical_significance", ""),
                        source_url=research.get("source_url"),
                        category="General"
                    )
                    # Update map
                    definitions_map[name] = research
                else:
                    logger.warning(f"Enrich node: Failed to research '{name}'")
            
            logger.info(f"Enrich node: Research completed - {research_success}/{len(missing_names)} successful")
        
        # Augment values with enrichment data
        enriched_values = []
        enriched_count = 0
        for v in values:
            v_dict = v.model_dump()
            definition = definitions_map.get(v.biomarker_name)
            
            if definition:
                enriched_count += 1
                v_dict["enrichment"] = {
                    "summary": definition.get("summary", ""),
                    "clinical_significance": definition.get("clinical_significance", ""),
                    "source_url": definition.get("source_url"),
                    "verified": definition.get("verified", False)
                }
            else:
                v_dict["enrichment"] = None
                
            enriched_values.append(v_dict)
        
        logger.info(f"Enrich node: Completed - {enriched_count}/{len(values)} biomarkers enriched")
        
        return {
            "processed_values": enriched_values
        }
        
    except Exception as e:
        logger.error(f"Enrichment node error: {e}", exc_info=True)
        # Non-critical: continue without enrichment
        return {}

