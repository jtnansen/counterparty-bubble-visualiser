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

    // Store counterparty address for client-side filtering
    const counterpartyAddressFilter = filters.counterpartyAddressHex;

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
        } : undefined
      }
    };

    // Remove undefined fields
    if (!transformedBody.date) delete transformedBody.date;
    if (!transformedBody.filters.volume_usd) delete transformedBody.filters.volume_usd;
    if (Object.keys(transformedBody.filters).length === 0) delete transformedBody.filters;

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
    let transformedTransactions = (data.data || []).map(tx => ({
      chain: tx.chain,
      method: tx.method,
      tokensSent: tx.tokens_sent,
      tokensReceived: tx.tokens_received,
      volumeUsd: tx.volume_usd,
      blockTimestamp: tx.block_timestamp,
      transactionHash: tx.transaction_hash,
      sourceType: tx.source_type
    }));

    // Filter by counterparty address if specified (client-side filtering)
    if (counterpartyAddressFilter) {
      transformedTransactions = transformedTransactions.filter(tx => {
        // Check if counterparty address is in tokens_sent or tokens_received
        const hasCounterpartyInSent = tx.tokensSent?.some(token =>
          token.from_address === counterpartyAddressFilter ||
          token.to_address === counterpartyAddressFilter
        );
        const hasCounterpartyInReceived = tx.tokensReceived?.some(token =>
          token.from_address === counterpartyAddressFilter ||
          token.to_address === counterpartyAddressFilter
        );
        return hasCounterpartyInSent || hasCounterpartyInReceived;
      });
    }

    return res.status(200).json({
      data: transformedTransactions,
      pagination: {
        ...data.pagination,
        // Update pagination to reflect filtered results
        per_page: transformedTransactions.length
      }
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
} 