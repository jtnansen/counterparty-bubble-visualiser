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
    const filters = req.body.filters || {};

    // Convert date format from YYYY-MM-DD to ISO timestamps
    const fromDate = filters.blockTimestamp?.from ? `${filters.blockTimestamp.from}T00:00:00Z` : undefined;
    const toDate = filters.blockTimestamp?.to ? `${filters.blockTimestamp.to}T23:59:59Z` : undefined;

    const transformedBody = {
      address: Array.isArray(params.walletAddresses) ? params.walletAddresses[0] : params.walletAddresses,
      chain: params.chain,
      date: fromDate && toDate ? {
        from: fromDate,
        to: toDate
      } : undefined,
      hide_spam_token: params.hideSpamToken,
      pagination: {
        page: pagination.page,
        per_page: pagination.recordsPerPage
      },
      filters: {
        volume_usd: filters.volumeUsd?.from ? {
          min: filters.volumeUsd.from
        } : undefined,
        counterparty_address_hex: filters.counterpartyAddressHex
      }
    };

    // Remove undefined fields
    if (!transformedBody.date) delete transformedBody.date;
    if (!transformedBody.filters.volume_usd) delete transformedBody.filters.volume_usd;
    if (!transformedBody.filters.counterparty_address_hex) delete transformedBody.filters.counterparty_address_hex;

    // Proxy the request to Nansen API
    const response = await fetch('https://api.nansen.ai/api/v1/profiler/address/transactions', {
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
    // Frontend expects transaction objects with specific field names
    const transformedTransactions = (data.data || []).map(tx => ({
      chain: tx.chain,
      method: tx.method,
      tokensSent: tx.tokens_sent,
      tokensReceived: tx.tokens_received,
      volumeUsd: tx.volume_usd,
      blockTimestamp: tx.block_timestamp,
      transactionHash: tx.transaction_hash,
      sourceType: tx.source_type
    }));

    return res.status(200).json({
      data: transformedTransactions,
      pagination: data.pagination
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
} 