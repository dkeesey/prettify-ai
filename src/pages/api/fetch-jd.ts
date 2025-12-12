import type { APIRoute } from 'astro';

/**
 * Fetch and parse job description from URL (Indeed, LinkedIn, etc.)
 * Uses Firecrawl API for intelligent scraping
 */

// Job URL patterns we support
const JOB_URL_PATTERNS = [
  /indeed\.com\/viewjob/i,
  /indeed\.com\/job\//i,
  /linkedin\.com\/jobs\/view/i,
  /greenhouse\.io\/.*\/jobs/i,
  /lever\.co\//i,
  /boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /workday\.com/i,
  /careers\./i,
  /jobs\./i,
];

interface JobData {
  title: string;
  company: string;
  location: string;
  description: string;
  requirements: string[];
  url: string;
  scrapedAt: string;
}

/**
 * Extract job data from scraped markdown content
 */
function parseJobContent(markdown: string, url: string): Partial<JobData> {
  const lines = markdown.split('\n');

  // Try to extract title (usually first h1 or prominent text)
  let title = '';
  let company = '';
  let location = '';
  const requirements: string[] = [];

  // Look for common patterns
  for (const line of lines) {
    const trimmed = line.trim();

    // Title is usually the first heading
    if (!title && trimmed.startsWith('# ')) {
      title = trimmed.replace(/^#\s*/, '');
    }

    // Company often follows title or is in a specific format
    if (!company && (trimmed.includes('Company:') || trimmed.includes('Employer:'))) {
      company = trimmed.split(':')[1]?.trim() || '';
    }

    // Location patterns
    if (!location && (trimmed.includes('Location:') || trimmed.match(/^(Remote|Hybrid|On-site)/i))) {
      location = trimmed.replace(/^Location:\s*/i, '');
    }

    // Requirements often in bullet points after "Requirements" or "Qualifications"
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const bullet = trimmed.replace(/^[-*]\s*/, '');
      if (bullet.length > 10 && bullet.length < 500) {
        requirements.push(bullet);
      }
    }
  }

  return {
    title: title || 'Job Position',
    company: company || extractCompanyFromUrl(url),
    location: location || 'Not specified',
    description: markdown,
    requirements: requirements.slice(0, 20), // Limit to top 20
    url,
    scrapedAt: new Date().toISOString(),
  };
}

/**
 * Try to extract company name from URL
 */
function extractCompanyFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    // For job boards, company might be in path
    if (hostname.includes('greenhouse.io') || hostname.includes('lever.co')) {
      const match = url.match(/\/([^\/]+)\/jobs/i);
      if (match) return match[1].replace(/-/g, ' ');
    }
    return '';
  } catch {
    return '';
  }
}

/**
 * Check if URL looks like a job posting
 */
export function isJobUrl(url: string): boolean {
  return JOB_URL_PATTERNS.some(pattern => pattern.test(url));
}

export const POST: APIRoute = async ({ request, locals }) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers }
      );
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid URL format' }),
        { status: 400, headers }
      );
    }

    // Get Firecrawl API key from environment (check multiple sources)
    const runtime = (locals as any).runtime;
    const firecrawlKey = runtime?.env?.FIRECRAWL_API_KEY ||
                         process.env.FIRECRAWL_API_KEY ||
                         import.meta.env.FIRECRAWL_API_KEY;

    if (!firecrawlKey) {
      // Fallback: return a message asking user to paste JD directly
      return new Response(
        JSON.stringify({
          error: 'JD fetching not configured',
          fallback: true,
          message: 'Please paste the job description text directly instead of the URL.'
        }),
        { status: 503, headers }
      );
    }

    // Call Firecrawl API to scrape the job posting
    console.log(`Fetching JD from: ${url}`);

    const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 2000, // Wait for dynamic content
      }),
    });

    if (!firecrawlResponse.ok) {
      const errorText = await firecrawlResponse.text();
      console.error('Firecrawl error:', errorText);

      return new Response(
        JSON.stringify({
          error: 'Failed to fetch job posting',
          fallback: true,
          message: 'Could not fetch the job posting. Please paste the job description text directly.'
        }),
        { status: 502, headers }
      );
    }

    const firecrawlData = await firecrawlResponse.json();
    const markdown = firecrawlData.data?.markdown || firecrawlData.data?.content || '';

    if (!markdown || markdown.length < 100) {
      return new Response(
        JSON.stringify({
          error: 'Could not extract job content',
          fallback: true,
          message: 'The page didn\'t contain readable job content. Please paste the job description directly.'
        }),
        { status: 422, headers }
      );
    }

    // Parse the scraped content
    const jobData = parseJobContent(markdown, url);

    return new Response(
      JSON.stringify({
        success: true,
        job: jobData,
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error('Fetch JD error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        fallback: true,
        message: 'Something went wrong. Please paste the job description directly.'
      }),
      { status: 500, headers }
    );
  }
};

// Handle OPTIONS for CORS
export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};
