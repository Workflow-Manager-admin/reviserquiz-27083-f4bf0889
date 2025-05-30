const axios = require('axios');

/**
 * MCQGeneratorService connects to an LLM/NLP endpoint and generates MCQs
 * from educational text, handling API key and error responses.
 */
class MCQGeneratorService {
  /**
   * PUBLIC_INTERFACE
   * Generates multiple-choice questions from provided text using a third-party API.
   * @param {string} text - Clean, educational extracted text.
   * @returns {Promise<{mcqs: Array}|{error: string}>}
   * @throws {Error} If generation fails (invalid API key, network, etc.).
   */
  async generateMCQs(text) {
    // Configurable via environment variables
    const apiEndpoint = process.env.MCQ_API_URL || 'https://api.fake-llm.com/generate-mcqs'; // Demo endpoint
    const apiKey = process.env.MCQ_API_KEY;

    if (!apiKey) {
      throw new Error('MCQ_API_KEY (LLM API key) is not set in environment variables.');
    }
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('No text provided for MCQ generation.');
    }

    try {
      const response = await axios.post(
        apiEndpoint,
        { text },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 20000, // 20s timeout
        }
      );

      // Simulate response format: { mcqs: [...] }
      if (response.data && Array.isArray(response.data.mcqs)) {
        return { mcqs: response.data.mcqs };
      } else if (response.data && response.data.error) {
        throw new Error(`API error: ${response.data.error}`);
      } else {
        throw new Error('Unexpected MCQ API response format.');
      }
    } catch (err) {
      if (err.response && err.response.data) {
        // API returned an error payload
        throw new Error(
          `MCQ API failure: ${err.response.data.error || err.response.data.message || 'Unknown API error'}`
        );
      }
      if (err.code === 'ECONNABORTED') {
        throw new Error('The MCQ generation service timed out.');
      }
      throw new Error(
        `MCQ generation failed: ${err.message || err.toString()}`
      );
    }
  }
}

module.exports = new MCQGeneratorService();
