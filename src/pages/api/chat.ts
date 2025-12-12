import type { APIRoute } from 'astro';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { getAIConfig, getAPIKey, getProviderInfo } from '@/lib/ai-config';
import { recordUsage, estimateNeurons, getUsageSummary } from '@/lib/token-tracker';

const RATE_LIMIT_CONFIG = { limit: 20, windowMs: 60 * 60 * 1000 }; // 20 req/hour

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://prettify-ai.com',
  'https://www.prettify-ai.com',
  'https://prettifyai.pages.dev',
  'https://resumecoach.co',
  'https://www.resumecoach.co',
  'http://localhost:4321',
  'http://localhost:3000',
];

function getCorsOrigin(request: Request): string {
  const origin = request.headers.get('origin');
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }
  return ALLOWED_ORIGINS[0];
}

/**
 * Call Groq API (OpenAI-compatible)
 */
async function callGroq(
  apiKey: string,
  model: string,
  messages: any[],
  options: { max_tokens: number; temperature: number; stream: boolean }
) {
  return fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      ...options,
    }),
  });
}

/**
 * Call OpenAI API
 */
async function callOpenAI(
  apiKey: string,
  model: string,
  messages: any[],
  options: { max_tokens: number; temperature: number; stream: boolean }
) {
  return fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      ...options,
    }),
  });
}

/**
 * Call Anthropic API (different format)
 */
async function callAnthropic(
  apiKey: string,
  model: string,
  messages: any[],
  options: { max_tokens: number; temperature: number; stream: boolean }
) {
  // Convert OpenAI format to Anthropic format
  const systemMessage = messages.find(m => m.role === 'system');
  const otherMessages = messages.filter(m => m.role !== 'system');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: options.max_tokens,
      temperature: options.temperature,
      stream: options.stream,
      system: systemMessage?.content || '',
      messages: otherMessages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
    }),
  });

  // If not streaming, convert response to OpenAI format
  if (!options.stream && response.ok) {
    const data = await response.json();
    return new Response(JSON.stringify({
      choices: [{
        message: {
          role: 'assistant',
          content: data.content[0]?.text || '',
        },
        finish_reason: data.stop_reason,
      }],
      usage: {
        prompt_tokens: data.usage?.input_tokens,
        completion_tokens: data.usage?.output_tokens,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return response;
}

/**
 * Call Google Gemini API
 */
async function callGemini(
  apiKey: string,
  model: string,
  messages: any[],
  options: { max_tokens: number; temperature: number; stream: boolean }
) {
  // Convert OpenAI format to Gemini format
  const systemMessage = messages.find(m => m.role === 'system');
  const otherMessages = messages.filter(m => m.role !== 'system');

  const geminiMessages = otherMessages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  // Prepend system message as first user message if present
  if (systemMessage) {
    geminiMessages.unshift({
      role: 'user',
      parts: [{ text: `System instructions: ${systemMessage.content}` }],
    });
    // Add a model acknowledgment
    geminiMessages.splice(1, 0, {
      role: 'model',
      parts: [{ text: 'Understood. I will follow these instructions.' }],
    });
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: geminiMessages,
      generationConfig: {
        maxOutputTokens: options.max_tokens,
        temperature: options.temperature,
      },
    }),
  });

  // Convert response to OpenAI format
  if (response.ok) {
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return new Response(JSON.stringify({
      choices: [{
        message: {
          role: 'assistant',
          content: text,
        },
        finish_reason: data.candidates?.[0]?.finishReason || 'stop',
      }],
      usage: {
        prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
        completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return response;
}

/**
 * Call Cloudflare Workers AI (uses binding)
 */
async function callCloudflare(
  runtime: any,
  model: string,
  messages: any[],
  options: { max_tokens: number; temperature: number; stream: boolean }
) {
  const ai = runtime?.env?.AI;
  if (!ai) {
    throw new Error('Cloudflare AI binding not available');
  }

  const result = await ai.run(model, {
    messages,
    max_tokens: options.max_tokens,
    temperature: options.temperature,
    stream: options.stream,
  });

  // Convert to OpenAI format
  if (options.stream) {
    return new Response(result, {
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  return new Response(JSON.stringify({
    choices: [{
      message: {
        role: 'assistant',
        content: result.response,
      },
      finish_reason: 'stop',
    }],
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  const corsOrigin = getCorsOrigin(request);

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  // Rate limiting
  const clientIp = getClientIp(request);
  const { allowed, remaining } = checkRateLimit(clientIp, RATE_LIMIT_CONFIG);

  if (!allowed) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
      {
        status: 429,
        headers: {
          ...headers,
          'X-RateLimit-Remaining': '0',
          'Retry-After': '3600',
        }
      }
    );
  }

  try {
    const body = await request.json();
    const { messages, stream = false, max_tokens = 3000, temperature = 0.7 } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: messages array required' }),
        { status: 400, headers }
      );
    }

    // Get AI configuration with automatic provider selection
    const runtime = (locals as any).runtime;
    const config = getAIConfig(runtime);
    const providerInfo = getProviderInfo(runtime);

    console.log(`AI Provider: ${config.provider} (strategy: ${providerInfo.strategy}, configured: ${providerInfo.configured.join(', ')})`);
    console.log(`Usage: ${JSON.stringify(getUsageSummary().cloudflareNeurons)}`);

    let response: Response;

    // Route to appropriate provider
    switch (config.provider) {
      case 'cloudflare': {
        try {
          response = await callCloudflare(runtime, config.model, messages, {
            max_tokens,
            temperature,
            stream,
          });
        } catch (error) {
          console.error('Cloudflare AI error:', error);
          return new Response(
            JSON.stringify({ error: 'AI service temporarily unavailable' }),
            { status: 502, headers }
          );
        }
        break;
      }

      case 'anthropic': {
        const apiKey = getAPIKey(runtime);
        if (!apiKey) {
          console.error('ANTHROPIC_API_KEY not configured');
          return new Response(
            JSON.stringify({ error: 'Server configuration error' }),
            { status: 500, headers }
          );
        }
        response = await callAnthropic(apiKey, config.model, messages, {
          max_tokens,
          temperature,
          stream,
        });
        break;
      }

      case 'openai': {
        const apiKey = getAPIKey(runtime);
        if (!apiKey) {
          console.error('OPENAI_API_KEY not configured');
          return new Response(
            JSON.stringify({ error: 'Server configuration error' }),
            { status: 500, headers }
          );
        }
        response = await callOpenAI(apiKey, config.model, messages, {
          max_tokens,
          temperature,
          stream,
        });
        break;
      }

      case 'gemini': {
        const apiKey = getAPIKey(runtime, 'gemini');
        if (!apiKey) {
          console.error('GEMINI_API_KEY not configured');
          return new Response(
            JSON.stringify({ error: 'Server configuration error' }),
            { status: 500, headers }
          );
        }
        response = await callGemini(apiKey, config.model, messages, {
          max_tokens,
          temperature,
          stream,
        });
        break;
      }

      case 'groq':
      default: {
        const apiKey = getAPIKey(runtime);
        if (!apiKey) {
          console.error('GROQ_API_KEY not configured');
          return new Response(
            JSON.stringify({ error: 'Server configuration error' }),
            { status: 500, headers }
          );
        }
        response = await callGroq(apiKey, config.model, messages, {
          max_tokens,
          temperature,
          stream,
        });
        break;
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${config.provider} API error:`, errorText);
      return new Response(
        JSON.stringify({ error: 'AI service temporarily unavailable' }),
        { status: 502, headers }
      );
    }

    // If streaming, pass through the stream
    if (stream) {
      return new Response(response.body, {
        status: 200,
        headers: {
          ...headers,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-RateLimit-Remaining': remaining.toString(),
        },
      });
    }

    // Non-streaming response
    const data = await response.json();

    // Record token usage for cost tracking
    const inputTokens = data.usage?.prompt_tokens || 0;
    const outputTokens = data.usage?.completion_tokens || 0;
    if (inputTokens || outputTokens) {
      const neurons = config.provider === 'cloudflare'
        ? estimateNeurons(inputTokens, outputTokens)
        : undefined;
      recordUsage(config.provider, inputTokens, outputTokens, neurons);
      console.log(`Recorded usage: ${config.provider} - ${inputTokens} in / ${outputTokens} out${neurons ? ` (~${neurons} neurons)` : ''}`);
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        ...headers,
        'X-RateLimit-Remaining': remaining.toString(),
      },
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers }
    );
  }
};

// Handle OPTIONS for CORS preflight
export const OPTIONS: APIRoute = async ({ request }) => {
  const corsOrigin = getCorsOrigin(request);
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};
