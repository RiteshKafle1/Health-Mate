# HealthMate Clinician - Technical Documentation

## Executive Summary

HealthMate Clinician is an AI-powered medical question-answering system built on a multi-agent architecture using **LangGraph**. It implements a sophisticated **Retrieval-Augmented Generation (RAG)** pipeline with a cascading fallback mechanism to ensure reliable, accurate, and safe medical information delivery.


## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [RAG Implementation with Agent Orchestration](#2-rag-implementation-with-agent-orchestration)
3. [Fallback Mechanism](#3-fallback-mechanism)
4. [Performance Analysis](#4-performance-analysis)
5. [Validation](#5-validation)
6. [Safety & Compliance](#6-safety--compliance)
7. [Results and Discussion](#7-results-and-discussion)

---

## 1. System Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        HealthMate Clinician                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐    ┌──────────┐    ┌─────────────┐    ┌──────────┐   │
│  │  Memory  │───▶│ Planner  │───▶│  Retriever  │───▶│ Executor │   │
│  │  Agent   │    │  Agent   │    │    (RAG)    │    │  Agent   │   │
│  └──────────┘    └────┬─────┘    └──────┬──────┘    └──────────┘   │
│                       │                  │                          │
│                       ▼                  ▼                          │
│                  ┌──────────┐      ┌──────────┐                     │
│                  │Rejection │      │ Fallback │                     │
│                  │  Agent   │      │  Chain   │                     │
│                  └──────────┘      └──────────┘                     │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │   Fallback Chain: Wikipedia → Tavily/DuckDuckGo → LLM       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Core Components

| Component | File | Purpose |
|-----------|------|---------|
| **ChatbotManager** | `chatbot_manager.py` | Main orchestrator managing sessions, state, and workflow |
| **LangGraph Workflow** | `core/langgraph_workflow.py` | Defines agent graph and routing logic |
| **AgentState** | `core/state.py` | Typed state object shared between agents |
| **Vector Store** | `tools/vector_store.py` | ChromaDB-based document storage with HuggingFace embeddings |

### 1.3 Agent Inventory

| Agent | File | Function |
|-------|------|----------|
| **MemoryAgent** | `agents/memory_agent.py` | Manages conversation context |
| **PlannerAgent** | `agents/planner_agent.py` | Routes queries (medical vs non-medical) |
| **RetrieverAgent** | `agents/retriever_agent.py` | RAG-based document retrieval with relevance scoring |
| **WikipediaAgent** | `agents/wikipedia_agent.py` | First fallback - Wikipedia search |
| **TavilyAgent** | `agents/tavily_agent.py` | Second fallback - Web search via DuckDuckGo |
| **LLMAgent** | `agents/llm_agent.py` | Final fallback - Direct LLM response |
| **ExecutorAgent** | `agents/executor_agent.py` | Generates final formatted responses |
| **RejectionAgent** | `agents/rejection_agent.py` | Handles non-medical queries politely |
| **SymptomCheckerAgent** | `agents/symptom_checker_agent.py` | Structured symptom collection flow |

---

## 2. RAG Implementation with Agent Orchestration

### 2.1 Vector Store Architecture

The system uses **ChromaDB** with **HuggingFace Embeddings** for semantic document retrieval:

```python
# Embedding Model
model_name = "sentence-transformers/all-MiniLM-L6-v2"

# Vector Store Configuration
- Persist Directory: ./medical_db/
- Collection Metadata: {"hnsw:space": "cosine"}
- Search Method: similarity_search_with_score
```

**Key Features:**
- **Lazy Loading**: Vector store is initialized on first use, not at startup
- **Persistent Storage**: Documents are stored in SQLite and indexed for fast retrieval
- **Cosine Similarity**: Uses cosine distance for semantic matching

### 2.2 Document Ingestion Pipeline

```
┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐
│  PDF File  │───▶│ PDF Loader │───▶│ Text Split │───▶│ Embeddings │
│            │    │            │    │            │    │            │
└────────────┘    └────────────┘    └────────────┘    └────────────┘
                                                            │
                                                            ▼
                                                    ┌────────────┐
                                                    │  ChromaDB  │
                                                    │ Vector DB  │
                                                    └────────────┘
```

### 2.3 RAG Retrieval Process

The **RetrieverAgent** implements relevance-scored retrieval:

```python
# Relevance Threshold
RELEVANCE_THRESHOLD = 0.55  # Cosine similarity

# Retrieval Process:
1. Query vectorstore with similarity_search_with_score(question, k=3)
2. Convert distance to similarity: similarity = 1 - distance
3. Filter documents above threshold (0.55)
4. If relevant docs found → RAG Success → Route to Executor
5. If no relevant docs → RAG Failure → Route to Wikipedia fallback
```

**Relevance Scoring Logic:**
```python
for doc, distance in results:
    similarity = 1 - distance if distance <= 1 else 0
    if similarity >= RELEVANCE_THRESHOLD:
        relevant_docs.append(doc)
```

### 2.4 LangGraph Workflow

The multi-agent workflow is orchestrated using **LangGraph StateGraph**:

```
Memory → Planner → [Rejection] → END
              ↓
          Retriever → [Success] → Executor → END
              ↓ [Failure]
          Wikipedia → [Success] → Executor → END
              ↓ [Failure]
          Tavily → [Success] → Executor → END
              ↓ [Failure]
          LLM → Executor → END
```

---

## 3. Fallback Mechanism

### 3.1 Cascading Fallback Strategy

The system implements a **4-tier fallback chain** to ensure response reliability:

| Priority | Source | Agent | Trigger Condition |
|----------|--------|-------|-------------------|
| 1 | Medical Database (RAG) | RetrieverAgent | Default for medical queries |
| 2 | Wikipedia | WikipediaAgent | RAG fails (no relevant docs) |
| 3 | Web Search | TavilyAgent | Wikipedia fails |
| 4 | AI Knowledge | LLMAgent | All retrievals fail |

### 3.2 Fallback Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Query Processing                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌────────────┐     ┌──────────────────────────────────────────┐   │
│  │Is Medical? │ No  │ RejectionAgent: Polite decline message   │   │
│  │(Planner)   │────▶│ "I'm specifically designed for medical   │   │
│  └─────┬──────┘     │  questions only..."                      │   │
│        │ Yes        └──────────────────────────────────────────┘   │
│        ▼                                                            │
│  ┌────────────┐     ┌──────────────────────────────────────────┐   │
│  │RAG Search  │ Fail│ Wikipedia: Search medical articles       │   │
│  │(Retriever) │────▶│ - Auto-suggest disabled for speed        │   │
│  └─────┬──────┘     │ - First 1000 chars per article           │   │
│        │ Success    └─────────────────────┬────────────────────┘   │
│        │                                  │ Fail                    │
│        ▼                                  ▼                         │
│  ┌────────────┐     ┌──────────────────────────────────────────┐   │
│  │ Executor   │     │ Web Search (DuckDuckGo): 2 results       │   │
│  │(Response)  │     │ - Prepends "medical" to query            │   │
│  └────────────┘     │ - 800 char limit per result              │   │
│                     └─────────────────────┬────────────────────┘   │
│                                           │ Fail                    │
│                                           ▼                         │
│                     ┌──────────────────────────────────────────┐   │
│                     │ LLM Direct: Final safety net             │   │
│                     │ - Uses medical prompt template           │   │
│                     │ - Follow-up question strategy            │   │
│                     └──────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.3 State Tracking

Each fallback step updates state flags for debugging and routing:

```python
# State Flags
{
    "rag_attempted": True/False,
    "rag_success": True/False,
    "wiki_attempted": True/False,
    "wiki_success": True/False,
    "tavily_attempted": True/False,
    "tavily_success": True/False,
    "llm_attempted": True/False,
    "llm_success": True/False
}
```

### 3.4 Ultimate Fallback Response

If all sources fail, the ExecutorAgent provides a safe fallback:

```
Hello. I'm here to help with medical questions.

To better understand your concern, could you tell me:
1. What specific symptoms are you experiencing?
2. When did these symptoms start?

This will help me provide more relevant information. Remember, I provide 
general health information and not medical diagnoses - please consult a 
healthcare provider for personalized advice.
```

---

## 4. Performance Analysis

### 4.1 Performance Optimizations

| Optimization | Implementation | Impact |
|--------------|----------------|--------|
| **Keyword-based Routing** | PlannerAgent uses regex instead of LLM | **Saves 1-2 seconds** per query |
| **Lazy Loading** | Vector store loads only when needed | Faster app startup |
| **Limited Retrieval** | k=3 documents, 1000 char limit | Reduced token usage |
| **Content Truncation** | Wikipedia/Web: 800-1000 chars | Faster LLM processing |
| **Auto-suggest Disabled** | Wikipedia API optimization | Faster Wikipedia queries |

### 4.2 Planner Agent Performance

The PlannerAgent avoids LLM calls entirely by using compiled regex patterns:

```python
# Pre-compiled patterns for O(1) matching
NON_MEDICAL_REGEX = re.compile('|'.join(NON_MEDICAL_PATTERNS), re.IGNORECASE)

# Medical keyword set for O(1) lookup
MEDICAL_KEYWORDS = {
    'symptom', 'symptoms', 'pain', 'fever', 'headache', 
    'medication', 'disease', 'treatment', ...
}
```

**Routing Logic Performance:**
- Medical keyword check: O(n) where n = words in query
- Non-medical pattern check: O(m) where m = query length
- Total: < 1ms for typical queries

### 4.3 Response Time Breakdown

| Stage | Typical Time | Notes |
|-------|--------------|-------|
| Planner (keyword) | < 1ms | No LLM call |
| RAG Retrieval | 50-200ms | ChromaDB similarity search |
| Wikipedia API | 500-1500ms | Rate-limited |
| Web Search | 500-2000ms | External API |
| LLM Generation | 1-3 seconds | Depends on response length |

### 4.4 Scalability Considerations

- **Session State**: Stored in-memory per user+session key
- **Vector Store**: Single global instance (singleton pattern)
- **Database**: SQLite for chat history (concurrent read, sequential write)

---

## 5. Validation

### 5.1 Query Validation

The **PlannerAgent** validates queries using a dual-check approach:

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Query Validation Flow                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Step 1: Check for MEDICAL_KEYWORDS                          │   │
│  │ - If found → Accept (route to retriever)                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                           │ Not found                               │
│                           ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Step 2: Check for NON_MEDICAL_PATTERNS                      │   │
│  │ - Sports, entertainment, politics, tech, gaming, etc.       │   │
│  │ - If matched → Reject (route to rejection agent)            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                           │ Not matched                             │
│                           ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Step 3: Default → Accept (err on side of caution)           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 Retrieval Validation

The **RetrieverAgent** validates document relevance:

```python
# Relevance threshold validation
RELEVANCE_THRESHOLD = 0.55

# Documents must pass:
1. Non-empty results from vectorstore
2. Cosine similarity >= 0.55
3. At least one document passes threshold

# If validation fails → triggers fallback chain
```

### 5.3 Response Validation

The **ExecutorAgent** ensures response quality:

```python
# Response validation checks:
1. LLM client available → if not, return unavailable message
2. Documents exist and non-empty → use document-based response
3. LLM fallback successful → use LLM response
4. All failed → use safe fallback message
```

### 5.4 Symptom Checker Validation

The **SymptomCheckerAgent** validates user input through structured collection:

| Step | Validation | Options |
|------|------------|---------|
| 1 | Body Area | 8 predefined options |
| 2 | Severity | 4 intensity levels |
| 3 | Duration | 6 time ranges |
| 4 | Associated Symptoms | 8 common symptoms |
| 5 | Additional Context | 6 contextual options |

---

## 6. Safety & Compliance

### 6.1 Medical Disclaimer Integration

Every response includes safety caveats through the **MEDICAL_PROMPT_TEMPLATE**:

```
BEHAVIOR RULES:
1. Use non-judgmental, empathetic language
2. Do NOT diagnose - present differential considerations
3. Include red flags that require urgent care
4. Recommend consulting healthcare professionals
```

### 6.2 Response Format Standards

Responses follow a structured format for clarity:

```
SUMMARY
[1-3 sentences describing the main point]

WHAT TO DO NOW
[Practical steps: when to seek care, home care tips]

RED FLAGS
[Urgent warning signs - call emergency if present]

POSSIBLE CONSIDERATIONS
[Likely possibilities to discuss with your doctor - NOT a diagnosis]
```

### 6.3 Non-Medical Query Handling

The **RejectionAgent** politely redirects non-medical queries:
- Lists supported topics (symptoms, conditions, treatments, mental health)
- Includes reminder about consultation with healthcare professionals
- Maintains conversation history for context

---

## 7. Results and Discussion

### 7.1 System Strengths

| Aspect | Finding |
|--------|---------|
| **Multi-Source Reliability** | 4-tier fallback ensures consistent responses |
| **Performance** | Keyword-based planner eliminates LLM latency for routing |
| **Safety** | Clear disclaimers and rejection of off-topic queries |
| **Scalability** | Stateless agents with centralized state management |
| **Maintainability** | Modular agent design allows easy updates |

### 7.2 RAG Effectiveness

The RAG system provides:
- **Contextualized responses** from medical knowledge base
- **Source attribution** (Medical Database, Wikipedia, Web Search, AI Knowledge)
- **Relevance filtering** via similarity threshold (0.55)

### 7.3 Fallback Success Rates

The cascading fallback mechanism ensures:

| Scenario | Expected Resolution |
|----------|---------------------|
| Query matches RAG content | Primary source used |
| Query is general medical | Wikipedia often succeeds |![alt text](image.png)
| Query is current/novel | Web search fills gaps |
| All else fails | LLM provides safe guidance |

### 7.4 Identified Limitations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| Static medical keywords | May miss novel terms | Default to "accept" for ambiguous queries |
| Relevance threshold | Fixed at 0.55 | May need tuning per use case |
| Single embedding model | Limited semantic coverage | MiniLM-L6-v2 is general-purpose |

### 7.5 Future Recommendations

1. **Dynamic Threshold Tuning**: Implement adaptive relevance thresholds based on query type
2. **Medical NER Integration**: Use named entity recognition for better keyword detection
3. **Caching Layer**: Add Redis caching for frequently asked questions
4. **Feedback Loop**: Collect user feedback to improve response quality
5. **Multi-modal Support**: Add image analysis for symptom identification

---

## Appendix: File Structure

```
healthmate_clinician/
├── __init__.py
├── chatbot_manager.py          # Main orchestrator
├── database.py                 # Chat history persistence
├── agents/
│   ├── __init__.py
│   ├── executor_agent.py       # Response generation
│   ├── llm_agent.py            # Final fallback
│   ├── memory_agent.py         # Conversation context
│   ├── planner_agent.py        # Query routing
│   ├── rejection_agent.py      # Non-medical handling
│   ├── retriever_agent.py      # RAG retrieval
│   ├── symptom_assessment_agent.py
│   ├── symptom_checker_agent.py
│   ├── tavily_agent.py         # Web search fallback
│   └── wikipedia_agent.py      # Wikipedia fallback
├── core/
│   ├── __init__.py
│   ├── langgraph_workflow.py   # Agent graph definition
│   └── state.py                # Shared state schema
└── tools/
    ├── __init__.py
    ├── llm_client.py           # LLM interface
    ├── pdf_loader.py           # Document ingestion
    ├── search_tools.py         # Web search utilities
    └── vector_store.py         # ChromaDB management
```

---

## Conclusion

HealthMate Clinician demonstrates a robust implementation of multi-agent RAG architecture with intelligent fallback mechanisms. The system balances performance optimization (keyword routing, lazy loading) with response reliability (4-tier fallback) and safety compliance (medical disclaimers, rejection handling). The modular design using LangGraph allows for easy extension and maintenance while the ChromaDB-based vector store provides efficient semantic retrieval from medical knowledge sources.

---

*Document Generated: January 23, 2026*  
*Version: 1.0*
