# Gemini API Key Manager - API Usage Examples

This document provides examples of how to use the proxy endpoints provided by the Gemini API Key Manager.

**Base URL:** Assuming the manager is running locally on port 3000, the base URL for the proxy endpoints is `http://localhost:3000/proxy`.

---

## 1. Python Example: Calling Google Gemini API (Non-Streaming)

This example uses the `requests` library to send a simple text generation request to the Google Gemini API via the proxy.

```python
import requests
import json

# Proxy endpoint for Google Gemini
proxy_url = "http://localhost:3000/proxy/google/v1beta/openai/chat/completions"

# Request payload (matches the Google Gemini API format)
payload = {
    "contents": [{
        "parts": [{
            "text": "Explain the concept of a reverse proxy in simple terms."
        }]
    }]
}

headers = {
    "Content-Type": "application/json"
}

try:
    # Send the request to the token manager's proxy endpoint
    response = requests.post(proxy_url, headers=headers, json=payload)
    response.raise_for_status()  # Raise an exception for bad status codes (4xx or 5xx)

    # Parse the JSON response
    result = response.json()

    # Extract and print the generated text
    if result.get("candidates") and result["candidates"][0].get("content"):
        generated_text = result["candidates"][0]["content"]["parts"][0]["text"]
        print("--- Generated Content ---")
        print(generated_text)
    else:
        print("--- Response ---")
        print(json.dumps(result, indent=2))

except requests.exceptions.RequestException as e:
    print(f"An error occurred: {e}")
    if e.response is not None:
        print(f"Status Code: {e.response.status_code}")
        try:
            print(f"Response Body: {e.response.text}")
        except:
            pass # Ignore if response body cannot be read

```

---

## 2. Python Example: Calling OpenAI API (Non-Streaming)

This example uses the `requests` library to send a chat completion request to the OpenAI API via the proxy.

```python
import requests
import json

# Proxy endpoint for OpenAI
proxy_url = "http://localhost:3000/proxy/openai/v1/chat/completions"

# Request payload (matches the OpenAI API format)
payload = {
    "model": "gpt-3.5-turbo", # Or another model you have access to
    "messages": [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "What is the capital of France?"}
    ],
    "max_tokens": 50
}

headers = {
    "Content-Type": "application/json"
}

try:
    # Send the request to the token manager's proxy endpoint
    response = requests.post(proxy_url, headers=headers, json=payload)
    response.raise_for_status()

    # Parse the JSON response
    result = response.json()

    # Extract and print the assistant's reply
    if result.get("choices") and result["choices"][0].get("message"):
        assistant_reply = result["choices"][0]["message"]["content"]
        print("--- Assistant Reply ---")
        print(assistant_reply)
    else:
        print("--- Response ---")
        print(json.dumps(result, indent=2))

except requests.exceptions.RequestException as e:
    print(f"An error occurred: {e}")
    if e.response is not None:
        print(f"Status Code: {e.response.status_code}")
        try:
            print(f"Response Body: {e.response.text}")
        except:
            pass

```

---

## 3. Python Example: Calling Google Gemini API (Streaming)

This example demonstrates handling Server-Sent Events (SSE) for streaming responses from the Google Gemini API via the proxy.

```python
import requests
import json
import sseclient # Requires: pip install sseclient-py

# Proxy endpoint for Google Gemini (Streaming)
proxy_url = "http://localhost:3000/proxy/google/v1beta/models/gemini-pro:streamGenerateContent?alt=sse"

# Request payload
payload = {
    "contents": [{
        "parts": [{
            "text": "Write a short story about a curious cat exploring a garden."
        }]
    }]
}

headers = {
    "Content-Type": "application/json",
    "Accept": "text/event-stream" # Important for streaming
}

try:
    # Use stream=True with requests
    response = requests.post(proxy_url, headers=headers, json=payload, stream=True)
    response.raise_for_status()

    # Use sseclient to parse the stream
    client = sseclient.SSEClient(response)

    print("--- Streaming Response ---")
    full_text = ""
    for event in client.events():
        if event.data:
            try:
                # Parse the JSON data part of the SSE event
                data_chunk = json.loads(event.data)
                if data_chunk.get("candidates") and data_chunk["candidates"][0].get("content"):
                    text_part = data_chunk["candidates"][0]["content"]["parts"][0]["text"]
                    print(text_part, end="", flush=True) # Print chunk immediately
                    full_text += text_part
            except json.JSONDecodeError:
                print(f"\n[Received non-JSON data: {event.data}]")
            except Exception as chunk_error:
                 print(f"\n[Error processing chunk: {chunk_error}]")
                 print(f"[Chunk data: {event.data}]")


    print("\n--- End of Stream ---")
    # print("\nFull Text:", full_text) # Optionally print the combined text

except requests.exceptions.RequestException as e:
    print(f"\nAn error occurred: {e}")
    if e.response is not None:
        print(f"Status Code: {e.response.status_code}")
        try:
            print(f"Response Body: {e.response.text}")
        except:
            pass
except Exception as stream_error:
     print(f"\nAn error occurred during streaming: {stream_error}")

```

---

## 4. Python Example: Calling OpenAI API (Streaming)

This example demonstrates handling Server-Sent Events (SSE) for streaming responses from the OpenAI API via the proxy.

```python
import requests
import json
import sseclient # Requires: pip install sseclient-py

# Proxy endpoint for OpenAI (Streaming)
proxy_url = "http://localhost:3000/proxy/openai/v1/chat/completions"

# Request payload (set stream=True)
payload = {
    "model": "gpt-3.5-turbo",
    "messages": [
        {"role": "user", "content": "Tell me a short joke about computers."}
    ],
    "stream": True # Enable streaming
}

headers = {
    "Content-Type": "application/json",
    "Accept": "text/event-stream"
}

try:
    response = requests.post(proxy_url, headers=headers, json=payload, stream=True)
    response.raise_for_status()

    client = sseclient.SSEClient(response)

    print("--- Streaming Response ---")
    full_text = ""
    for event in client.events():
        if event.data:
            if event.data.strip() == '[DONE]':
                break # OpenAI stream termination signal
            try:
                data_chunk = json.loads(event.data)
                if data_chunk.get("choices") and data_chunk["choices"][0].get("delta"):
                    content_part = data_chunk["choices"][0]["delta"].get("content", "")
                    print(content_part, end="", flush=True)
                    full_text += content_part
            except json.JSONDecodeError:
                print(f"\n[Received non-JSON data: {event.data}]")
            except Exception as chunk_error:
                 print(f"\n[Error processing chunk: {chunk_error}]")
                 print(f"[Chunk data: {event.data}]")


    print("\n--- End of Stream ---")

except requests.exceptions.RequestException as e:
    print(f"\nAn error occurred: {e}")
    if e.response is not None:
        print(f"Status Code: {e.response.status_code}")
        try:
            print(f"Response Body: {e.response.text}")
        except:
            pass
except Exception as stream_error:
     print(f"\nAn error occurred during streaming: {stream_error}")
