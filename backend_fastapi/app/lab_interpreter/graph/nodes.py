import time
import logging
from typing import Dict, Any

from app.lab_interpreter.services.llama_parser_service import get_llama_parser_service
from app.lab_interpreter.services.markdown_parser import parse_lab_markdown
from app.lab_interpreter.services.qwen_interpreter import QwenLabInterpreter
from app.lab_interpreter.services.validator_agent import get_validator
from app.lab_interpreter.models.interpretation import PatientContext, InterpretationResult, ValueStatus, ExtractedValue

from .state import LabReportState

logger = logging.getLogger(__name__)

async def verify_node(state: LabReportState) -> Dict[str, Any]:
    """
    Node: Verify if the image is a valid medical lab report.
    
    Uses Llama Parser extraction as verification — if the parser
    can extract a markdown table with biomarker-like data, it's valid.
    """
    try:
        parser_service = get_llama_parser_service()
        
        # Extract markdown from the image
        markdown = await parser_service.extract(state["image_data"], state["mime_type"])
        
        if not markdown or len(markdown.strip()) < 50:
            return {
                "verification_result": {
                    "is_valid": False,
                    "rejection_reason": "Could not extract any text from the image. Please upload a clear lab report."
                },
                "error": "No text could be extracted from the image"
            }
        
        # Parse the markdown to check if it contains lab data
        parsed = parse_lab_markdown(markdown)
        
        if not parsed.get("extracted_values"):
            return {
                "verification_result": {
                    "is_valid": False,
                    "rejection_reason": "No biomarker values found. Please upload a medical lab report with test results."
                },
                "error": "No biomarker values found in uploaded image"
            }
        
        # Valid — store the extracted markdown for the interpret node
        logger.info(
            f"Verification passed: {len(parsed['extracted_values'])} biomarkers found"
        )
        
        return {
            "verification_result": {
                "is_valid": True,
                "confidence": 0.95
            },
            # Pass extracted data forward so interpret_node doesn't re-extract
            "extracted_data": {
                "raw_markdown": markdown,
                "parsed": parsed,
            }
        }
    except Exception as e:
        logger.error(f"Verification node error: {e}")
        return {"error": f"Verification failed: {str(e)}"}


async def interpret_node(state: LabReportState) -> Dict[str, Any]:
    """
    Node: Extract and interpret lab values.
    
    Pipeline:
      1. Llama Parser extracts markdown (done in verify_node if available)
      2. Markdown parser converts tables → JSON
      3. Qwen interpreter generates clinical interpretation per biomarker
    """
    try:
        # Check if verify_node already extracted data
        existing_data = state.get("extracted_data", {})
        parsed = existing_data.get("parsed") if existing_data else None
        
        if not parsed:
            # Extraction not done yet — do it now
            parser_service = get_llama_parser_service()
            markdown = await parser_service.extract(state["image_data"], state["mime_type"])
            parsed = parse_lab_markdown(markdown)
        
        raw_values = parsed.get("extracted_values", [])
        
        if not raw_values:
            return {"error": "No biomarker values could be extracted from the report"}
        
        # Build patient context (merge extracted info with user-provided context)
        ctx_data = state["patient_context"]
        context = PatientContext(**ctx_data)
        
        # Update context with info extracted from the report
        extracted_patient = parsed.get("patient_info", {})
        if extracted_patient.get("sex") and (context.sex == "unknown" or not context.sex):
            context.sex = extracted_patient["sex"].lower()
        if extracted_patient.get("age") and not context.age:
            try:
                context.age = int(extracted_patient["age"])
            except (ValueError, TypeError):
                pass
        
        # Interpret using Qwen
        interpreter = QwenLabInterpreter()
        result = await interpreter.interpret(
            extracted_values=raw_values,
            patient_context=context,
            report_id=state["report_id"],
        )
        
        return {
            "extracted_data": {
                "patient_info": extracted_patient,
                "extracted_count": len(raw_values),
            },
            "processed_values": [v.model_dump() for v in result.extracted_values],
            "patient_context": context.model_dump(),
        }
        
    except Exception as e:
        logger.error(f"Interpretation node error: {e}")
        return {"error": f"Interpretation failed: {str(e)}"}


async def validate_node(state: LabReportState) -> Dict[str, Any]:
    """
    Node: Validate extracted values using rule-based checks.
    
    No LLM used — pure rule-based validation:
      - Plausibility checks (values within physically possible ranges)
      - Unit consistency
      - Reference range logic
    """
    try:
        validator = get_validator()
        
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
        # Don't block the flow on validation failure
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
        
        # Generate summary
        total = len(values)
        summary = ""
        if not values:
            summary = "No biomarker values could be extracted."
        elif critical:
            names = ", ".join([v.biomarker_name for v in critical])
            summary = f" CRITICAL: {len(critical)} value(s) require immediate attention ({names}). {len(abnormal)} total abnormal."
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
            processing_time_ms=0,
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
            return {}
        
        logger.info(f"Enrich node: Starting enrichment for {len(values)} biomarkers")
        
        biomarker_names = [v.biomarker_name for v in values]
        logger.info(f"Enrich node: Biomarkers to enrich: {biomarker_names}")
        
        definitions_map = await knowledge_service.batch_get_definitions(biomarker_names)
        cached_count = sum(1 for v in definitions_map.values() if v is not None)
        logger.info(f"Enrich node: Found {cached_count}/{len(biomarker_names)} definitions in cache")
        
        missing_names = [name for name, defn in definitions_map.items() if defn is None]
        
        if missing_names:
            logger.info(f"Enrich node: Researching {len(missing_names)} unknown biomarkers: {missing_names}")
            research_results = await researcher_agent.research_biomarkers_batch(missing_names)
            
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
                    definitions_map[name] = research
                else:
                    logger.warning(f"Enrich node: Failed to research '{name}'")
            
            logger.info(f"Enrich node: Research completed - {research_success}/{len(missing_names)} successful")
        
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
        return {}
