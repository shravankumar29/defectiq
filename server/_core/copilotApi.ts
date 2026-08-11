import express from "express";

const ENGINE_URL = process.env.ENGINE_URL || "http://127.0.0.1:8901";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const messages = req.body.messages;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid request. 'messages' array is required." });
    }

    // 1. Fetch current analytics from python engine
    const resultsReq = await fetch(`${ENGINE_URL}/results`, {
      headers: { "Content-Type": "application/json" }
    });
    
    if (!resultsReq.ok) {
      if (resultsReq.status === 404) {
        return res.json({ answer: "Upload a manufacturing dataset first. Once data is available, I can analyze machines, shifts, batches, defect types, patterns, and anomalies.", sources: [] });
      }
      throw new Error(`Engine returned ${resultsReq.status}`);
    }

    const results = await resultsReq.json();
    
    if (!results || !results.kpis) {
      return res.json({ answer: "Upload a manufacturing dataset first. Once data is available, I can analyze machines, shifts, batches, defect types, patterns, and anomalies.", sources: [] });
    }

    // 2. Build structured context from current dataset
    const contextStr = JSON.stringify({
      dataset: {
        filename: results.filename || "Uploaded Dataset",
        records: results.kpis.total_inspections,
        date_range: results.kpis.date_range,
        defect_types: results.defect_types
      },
      overall_metrics: {
        units_inspected: results.kpis.total_inspections,
        defective_units: results.kpis.total_defective,
        overall_defect_rate_pct: results.kpis.defect_rate_pct
      },
      machine_analysis: results.machine_analysis?.details?.map((m: any) => ({
        machine: m.machine_id,
        units_inspected: m.units_inspected,
        defective_units: m.defective_units,
        defect_rate_pct: m.defect_rate_pct,
        rank: m.rank,
        top_defect_type: m.top_defect_type
      })) || [],
      shift_analysis: results.shift_analysis?.details?.map((s: any) => ({
        shift: s.shift,
        units_inspected: s.units_inspected,
        defective_units: s.defective_units,
        defect_rate_pct: s.defect_rate_pct,
        top_defect_types: s.top_defect_types
      })) || [],
      batch_analysis: results.overview?.batch?.batches?.map((b: any) => ({
        batch: b.batch_id,
        units: b.units,
        defects: b.defects,
        defect_rate_pct: b.defect_rate_pct,
        diff_from_baseline: b.diff_from_baseline,
        flagged: b.flagged
      })).filter((b: any) => b.flagged) || [],
      pattern_discovery: results.patterns?.slice(0, 10).map((p: any) => ({
        pattern_id: p.pattern_id,
        description: p.description,
        defect_type: p.defect_type,
        lift: p.lift,
        p_value: p.p_display,
        support: p.sample_size,
        confidence_score: p.pattern_score,
        effect_size: p.effect_size
      })) || [],
      anomalies: {
        change_points: results.change_points,
      },
      clustering: {
        k_means: results.clustering_kmeans
      },
      recommendations: results.recommendations?.slice(0, 5) || [],
    });

    // 3. Build groq prompt
    const systemPrompt = `You are DefectIQ AI Copilot, an industrial manufacturing quality-analysis assistant.
You answer questions ONLY using the statistical analytics and evidence supplied in the DefectIQ context.

Never invent statistics, machines, batches, defect rates, patterns, causes, dates, or recommendations.
If the supplied evidence does not contain enough information to answer a question, explicitly say that there is insufficient evidence.
Do not perform your own unsupported statistical calculations when the required metric is not supplied.

Distinguish clearly between:
- observed data
- statistical association
- hypothesis
- recommendation

Correlation does not imply causation.
Never claim that a machine, shift, temperature, pressure, vibration, speed, humidity, or any other factor CAUSED a defect unless the provided evidence explicitly supports causal inference.

Use language such as:
'associated with', 'observed under', 'linked with', 'candidate factor', 'requires validation'.

When discussing a finding, include the relevant evidence:
- defect rate
- baseline
- lift
- p-value
- sample size/support
- confidence
when available.

Be concise but useful.
Structure answers clearly using headings and bullet points when appropriate.
You are an analytical assistant, not a causal diagnosis engine.

IMPORTANT: Format your response clearly. If you are citing evidence for a specific finding (like a machine, shift, or pattern), you MUST append a small structured "Evidence" section at the very end of your response, for example:

Evidence
• Machine: M02
• Defect rate: 2.25%
• Units inspected: 19,231
• Defective units: 433

Use the exact numbers from the context.

Here is the current dataset context:
${contextStr}
`;

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      console.error("[Copilot] GROQ_API_KEY is missing from environment variables.");
      return res.status(500).json({ error: "AI Copilot is temporarily unavailable. Check the Groq API configuration or try again." });
    }

    const groqModel = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

    const payload = {
      model: groqModel,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m: any) => ({
          role: m.role,
          content: m.text || m.content
        }))
      ],
      temperature: 0.1,
    };

    const groqReq = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!groqReq.ok) {
      console.error(`[Copilot] Groq API error: ${groqReq.status} ${groqReq.statusText}`);
      const text = await groqReq.text();
      console.error(text);
      return res.status(500).json({ error: "AI Copilot is temporarily unavailable. Check the Groq API configuration or try again." });
    }

    const groqData = await groqReq.json();
    const answer = groqData.choices?.[0]?.message?.content || "No response generated.";

    return res.json({ answer, sources: ["DefectIQ Analytics Engine"] });

  } catch (error: any) {
    console.error("[Copilot] Internal error:", error);
    return res.status(500).json({ error: "AI Copilot is temporarily unavailable. Check the Groq API configuration or try again." });
  }
});

export { router as copilotRouter };
