## Current models

| | Jev 1.14 | Jev 1.13 |
| :- | :- | :- |
| Model ID | `jev-1.14.0` | `jev-1.13.0` |
| Price (per Btok / per Mtok) | \$42 / \$0.042 | \$42 / \$0.042 |
| Context length | 64k per-request / 32k per-question | 64k per-request / 32k per-question |
| Input | Text, images | Text, images |
| Question types | Choice, Score, Noul, Box | Choice, Score, Noul |

Jev 1.14 is the newest Jev release, available from October 14, 2026.

* **Price:** You pay per input token. Output tokens are free. A Btok is a billion tokens and an Mtok is a million tokens.
* **Context length:** Two limits, the per-request context and the per-question context. See [Context length](#context-length). To raise both, see [Long context](#long-context).
* **Input:** Jev reads natural-language text, sent as a string, a JSON object, or an array of text values. It also reads PNG and JPEG [images](https://docs.typesafe.ai/images.md) anywhere in the request. It does not natively accept audio or video (yet). See [State](https://docs.typesafe.ai/concepts/state.md) for the shapes `state` accepts.
* **Question types:** [Box](https://docs.typesafe.ai/primitives/box.md) questions need Jev 1.14.

## Context length

Jev ingests the `state` once and evaluates every question against it in parallel. A request has to fit two context limits:

* **Per-request context** (`per_request_context`): the `state` plus all questions combined.
* **Per-question context** (`per_question_context`): the `state` plus any one question.

There is no separate limit on the number of questions in a request. Any number of questions is allowed as long as the request fits both limits. See [Speculative fan-out](https://docs.typesafe.ai/patterns/fan-out.md) for packing many questions into one request, and [Model jaggedness](https://docs.typesafe.ai/model-jaggedness.md) for how accuracy shifts as the state grows.

To raise both limits, see [Long context](#long-context).

### Long context

Long context is off by default and works on both Jev 1.14 and Jev 1.13. To turn it on, send the `TypeSafe-Danger-Zone-Long-Context: true` header with each request that needs it. With the header, the per-request context and the per-question context are both 262k tokens. Requests without the header keep the default limits in the table above.

```bash theme={null}
curl https://api.typesafe.ai/v1/systemone \
  -H "Authorization: Bearer $TYPESAFE_API_KEY" \
  -H "Content-Type: application/json" \
  -H "TypeSafe-Danger-Zone-Long-Context: true" \
  -d '{
    "model": "jev-latest",
    "state": "<a long contract, transcript, or record>",
    "questions": {
      "has_termination_clause": {
        "type": "noul",
        "instructions": "Does the `state` include a clause that lets either party end the agreement early?"
      }
    }
  }'
```

Long context costs the same per token as any other request. It is slower and less accurate than staying within the default limits, so turn it on only for requests that need it.

## Rate limits

Ra
