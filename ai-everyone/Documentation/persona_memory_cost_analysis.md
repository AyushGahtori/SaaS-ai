# Persona/Memory: Performance & Cost Analysis (v1)

This document analyzes the scalability and economic impact of using the local TF-IDF ranking method for a 1M user application.

## 1. Scale Assumptions
- **Total Registered Users**: 1 Million
- **Daily Active Users (DAU)**: 10,000
- **Average Chats per DAU**: 20
- **Memories per User**: 20 items (average)
- **Memory Item Size**: ~300 bytes

## 2. Performance Metrics (Speed)

Since TF-IDF ranking is performed **locally** on a small set of documents (20-50) per request, the compute time is negligible.

| Operation | Time (Estimated) | Note |
|-----------|------------------|------|
| Memory Retrieval (Firestore) | 50ms - 150ms | Parallel fetch of 20 items |
| TF-IDF Tokenization | < 0.5ms | Pure JS execution |
| Vectorization/Similarity | < 1.0ms | Pure Math (1x20 matrix) |
| **Total Overhead** | **~152ms** | Mostly I/O bound (DB reads) |

> [!NOTE]
> Even at 1M users, the retrieval speed does **not** degrade because we only query a specific user's sub-collection (`users/{uid}/memories`). This is an $O(k)$ operation relative to total users.

## 3. Cost Analysis (v1 Architecture)

### Firestore (Primary Cost)
The main cost is reading memories from Firestore for each context-aware chat.

- **Total Reads/Day**: 10,000 DAU * 20 chats = 200,000 operations.
- **Monthly Reads**: 6,000,000.
- **Monthly Cost (Reads)**: ~$3.60 (Assuming $0.06/100k reads).
- **Monthly Cost (Storage)**: 1M users * 20 items * 300 bytes = ~6GB = ~$1.20/month.

### External API Costs
- **Vector DB (e.g., Pinecone)**: $0/month.
- **Embedding API (e.g., Ada-002)**: $0/month.

**Total Feature Cost: ~$5.00/month for 1M users.**

## 4. Comparison: Local TF-IDF vs. Global Vector DB

| Metric | Local TF-IDF (Current) | Managed Vector DB |
|--------|-------------------------|-------------------|
| Monthly Cost (1M Users) | < $10 | $70 - $200+ |
| Latency | ~1ms (compute) + DB read | 50ms - 200ms (API trip) |
| Privacy | 100% In-house | Data sent to provider |
| Precision | High (for per-user context) | Extreme (Global search) |

## 5. Conclusion
For the current use case—personalized context where we only need to look at a user's *own* past data—the **Local TF-IDF** method is ~20x cheaper and faster than a managed Vector Database solution. 

The architecture becomes a candidate for Vector DBs only if we need to perform **cross-user similarity search** (e.g., "Find other users with similar interests").
