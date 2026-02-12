"""
Async Endpoints for Lab Interpretation
=====================================
POST /interpret/async - Start background job
GET /interpret/status/{job_id} - Check job status
"""

@router.post("/interpret/async", response_model=StartJobResponse, status_code=202)
async def start_interpretation_job(
    request: InterpretRequest,
    background_tasks: BackgroundTasks
):
    """
    Start lab report interpretation as a background job.
    
    This endpoint immediately returns a job ID, allowing the user to continue
    using the application while interpretation runs in the background.
    
    Poll GET /interpret/status/{job_id} to check progress and retrieve results.
    """
    from ..services.background_processor import process_interpretation_background
    
    interpretations = get_interpretations_collection()
    reports = get_reports_collection()
    
    # Validate report ID
    if not ObjectId.is_valid(request.report_id):
        raise HTTPException(status_code=400, detail="Invalid report ID")
    
    # Check for cached interpretation first
    cached = await interpretations.find_one({"report_id": request.report_id})
    if cached:
        # Return existing interpretation wrapped in a job response
        return StartJobResponse(
            success=True,
            message="Interpretation already exists (cached)",
            job_id="cached",
            report_id=request.report_id
        )
    
    # Check if there's already a pending/processing job for this report
    existing_job = await interpretation_jobs.get_job_by_report(request.report_id)
    if existing_job and existing_job["status"] in ["pending", "processing"]:
        return StartJobResponse(
            success=True,
            message="Interpretation job already in progress",
            job_id=existing_job["job_id"],
            report_id=request.report_id
        )
    
    # Get report from database
    report = await reports.find_one({"_id": ObjectId(request.report_id)})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Get file URL
    file_url = report.get("file_url")
    if not file_url:
        raise HTTPException(status_code=400, detail="Report has no file URL")
    
    # Check file type
    file_type = report.get("file_type", "")
    if not (file_type.startswith("image/") or file_type == "application/pdf"):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file_type}. Only images and PDFs can be interpreted."
        )
    
    # Check Llama Parser API key (required for extraction)
    if not settings.LLAMA_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Lab interpretation service not configured. LLAMA_API_KEY required."
        )
    
    # Fetch image data
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(file_url)
            resp.raise_for_status()
            image_data = resp.content
            
            content_type = resp.headers.get("content-type", "image/jpeg")
            mime_type = content_type.split(";")[0].strip()
            if mime_type == "application/pdf":
                mime_type = "application/pdf"
            elif not mime_type.startswith("image/"):
                mime_type = "image/jpeg"
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch report file: {str(e)}"
        )
    
    # Create job
    user_id = report.get("user_id", "unknown")
    job_id = await interpretation_jobs.create_job(
        report_id=request.report_id,
        user_id=user_id,
        patient_context=request.patient_context.model_dump()
    )
    
    # Launch background task
    background_tasks.add_task(
        process_interpretation_background,
        job_id=job_id,
        report_id=request.report_id,
        image_data=image_data,
        mime_type=mime_type,
        patient_context=request.patient_context.model_dump(),
        user_id=user_id,
        get_interpretations_collection_func=get_interpretations_collection
    )
    
    logger.info(f"Started background job {job_id} for report {request.report_id}")
    
    return StartJobResponse(
        success=True,
        message="Interpretation job started. Poll /interpret/status/{job_id} for progress.",
        job_id=job_id,
        report_id=request.report_id
    )


@router.get("/interpret/status/{job_id}", response_model=JobStatusResponse)
async def get_job_status_endpoint(job_id: str):
    """
    Get the status of an interpretation job.
    
    Returns current status, progress percentage, and interpretation result when complete.
    """
    # Check for cached result first (job_id = "cached")
    if job_id == "cached":
        raise HTTPException(
            status_code=400,
            detail="Use GET /interpret/{report_id} for cached results"
        )
    
    job = await interpretation_jobs.get_job_status(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return JobStatusResponse(
        job_id=job["job_id"],
        report_id=job["report_id"],
        status=JobStatus(job["status"]),
        progress=job["progress"],
        current_step=job["current_step"],
        result=job.get("result"),
        error_message=job.get("error_message"),
        created_at=job["created_at"].isoformat(),
        updated_at=job["updated_at"].isoformat()
    )
