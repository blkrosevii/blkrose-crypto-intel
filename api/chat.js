export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) {
    return res.status(500).json({ 
      error: "API key not configured",
      hint: "Add ANTHROPIC_API_KEY to Vercel environment variables"
    });
  }

  try {
    const body = req.body;
    
    // Ensure model and max_tokens are set
    const payload = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
      ...body,
    };

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "Anthropic API error",
        type: data.error?.type || "unknown",
        status: response.status,
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ 
      error: error.message,
      hint: "Network or parsing error"
    });
  }
}
