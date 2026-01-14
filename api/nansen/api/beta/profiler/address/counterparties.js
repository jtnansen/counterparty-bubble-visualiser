import fetch from 'node-fetch';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get API key from environment variables (without VITE_ prefix for serverless functions)
  const apiKey = process.env.NANSEN_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    // Transform request body from frontend format to v1 API format
    const params = req.body.parameters || {};
    const pagination = req.body.pagination || {};

    // Convert YYYY-MM-DD to ISO timestamp format
    const fromDate = params.timeRange?.from ? `${params.timeRange.from}T00:00:00Z` : undefined;
    const toDate = params.timeRange?.to ? `${params.timeRange.to}T23:59:59Z` : undefined;

    const transformedBody = {
      address: Array.isArray(params.walletAddresses) ? params.walletAddresses[0] : params.walletAddresses,
      chain: params.chain,
      date: {
        from: fromDate,
        to: toDate
      },
      group_by: params.groupBy,
      pagination: {
        page: pagination.page,
        per_page: pagination.recordsPerPage
      },
      source_input: params.sourceInput
    };

    // Proxy the request to Nansen API
    const response = await fetch('https://api.nansen.ai/api/v1/profiler/address/counterparties', {
      method: 'POST',
      headers: {
        'apiKey': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transformedBody)
    });

    // Handle response properly to avoid double-reading
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
      }
      return res.status(response.status).json(errorData);
    }

    // Get the response data only once
    const data = await response.json();

    // Transform v1 API response to match frontend expectations
    const transformedCounterparties = (data.data || []).map(cp => ({
      interactingAddress: cp.counterparty_address,
      interactingLabel: Array.isArray(cp.counterparty_address_label)
        ? cp.counterparty_address_label.join(', ')
        : (cp.counterparty_address_label || ''),
      volIn: String(cp.volume_in_usd || 0),
      volOut: String(cp.volume_out_usd || 0),
      usdNetflow: String((cp.volume_in_usd || 0) - (cp.volume_out_usd || 0)),
      totalVolume: cp.total_volume_usd,
      interactionCount: cp.interaction_count,
      tokensInfo: cp.tokens_info
    }));

    return res.status(200).json({
      counterparties: transformedCounterparties,
      pagination: data.pagination
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
} 