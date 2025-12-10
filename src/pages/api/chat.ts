import type { APIRoute } from 'astro';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const RATE_LIMIT_CONFIG = { limit: 20, windowMs: 60 * 60 * 1000 }; // 20 req/hour

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://prettify-ai.com',
  'https://www.prettify-ai.com',
  'https://prettifyai.pages.dev',
  'http://localhost:4321',
  'http://localhost:3000',
];

function getCorsOrigin(request: Request): string {
  const origin = request.headers.get('origin');
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }
  // Default to production domain for non-browser requests
  return ALLOWED_ORIGINS[0];
}

export const POST: APIRoute = async ({ request }) => {
  const corsOrigin = getCorsOrigin(request);

  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle preflight
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

    // Get API key from environment (server-side only)
    const GROQ_API_KEY = import.meta.env.GROQ_API_KEY;

    if (!GROQ_API_KEY) {
      console.error('GROQ_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers }
      );
    }

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        max_tokens,
        temperature,
        stream,
      }),
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error('Groq API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'AI service temporarily unavailable' }),
        { status: 502, headers }
      );
    }

    // If streaming, pass through the stream
    if (stream) {
      return new Response(groqResponse.body, {
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
    const data = await groqResponse.json();
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
